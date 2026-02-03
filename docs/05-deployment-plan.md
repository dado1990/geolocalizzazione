# Deployment Plan & Operational Checklist

## 1. DEPLOYMENT STRATEGY

### 1.1 Ambienti

| Ambiente | Scopo | Hosting | URL |
|----------|-------|---------|-----|
| Development | Sviluppo locale | Docker Compose | localhost:3000 |
| Staging | Test pre-produzione | Cloud VPS/K8s | staging-api.bustracker.com |
| Production | Produzione | Cloud VPS/K8s | api.bustracker.com |

### 1.2 Infrastruttura Target

#### Opzione A: Self-Hosted VPS (Costo Ottimizzato)
```
Provider: Hetzner / DigitalOcean / OVH
Instance: 8 vCPU, 16GB RAM, 200GB SSD
OS: Ubuntu 22.04 LTS
Orchestrazione: Docker Swarm / Docker Compose
Costo stimato: €60-80/mese
```

#### Opzione B: Managed Cloud (Scalabilità)
```
Provider: AWS / GCP / Azure
Compute: Kubernetes (EKS/GKE/AKS)
Database: Managed PostgreSQL
Cache: Managed Redis
Costo stimato: €250-350/mese
```

**Raccomandazione Iniziale**: Opzione A (VPS) per fase 1 (<100 bus), migrazione a Opzione B se scaling >500 bus.

---

## 2. CONTAINERIZATION

### 2.1 Docker Images

#### Backend API Dockerfile
```dockerfile
# Dockerfile.api
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Frontend Nginx Dockerfile
```dockerfile
# Dockerfile.frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2.2 Docker Compose (Development + Staging)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3-alpine
    container_name: bustracker_db
    environment:
      POSTGRES_DB: bustracker
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: bustracker_redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile.api
    container_name: bustracker_api
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/bustracker
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_MAPS_API_KEY: ${GOOGLE_MAPS_API_KEY}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  websocket:
    build:
      context: ./backend
      dockerfile: Dockerfile.api
    container_name: bustracker_ws
    command: ["node", "dist/websocket-server.js"]
    environment:
      NODE_ENV: production
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3001:3001"
    depends_on:
      - redis
    restart: unless-stopped

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.api
    container_name: bustracker_worker
    command: ["node", "dist/worker.js"]
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/bustracker
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  console:
    build:
      context: ./console-frontend
      dockerfile: Dockerfile.frontend
    container_name: bustracker_console
    ports:
      - "8080:80"
    restart: unless-stopped

  monitor:
    build:
      context: ./monitor-frontend
      dockerfile: Dockerfile.frontend
    container_name: bustracker_monitor
    ports:
      - "8081:80"
    restart: unless-stopped

  pwa:
    build:
      context: ./pwa
      dockerfile: Dockerfile.frontend
    container_name: bustracker_pwa
    ports:
      - "8082:80"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: bustracker_nginx
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
      - websocket
      - console
      - monitor
      - pwa
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

---

## 3. NGINX CONFIGURATION

### 3.1 Reverse Proxy + Load Balancing

```nginx
# nginx/nginx.conf

upstream api_backend {
    least_conn;
    server api:3000 max_fails=3 fail_timeout=30s;
    # Add more instances for load balancing:
    # server api_2:3000;
    # server api_3:3000;
}

upstream websocket_backend {
    ip_hash; # Sticky sessions for WebSocket
    server websocket:3001;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=telemetry_limit:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

server {
    listen 80;
    server_name api.bustracker.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.bustracker.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Endpoints
    location /v1/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Telemetry endpoint (stricter rate limit)
    location /v1/telemetry/location {
        limit_req zone=telemetry_limit burst=5 nodelay;

        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket endpoint
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400; # 24h keep-alive
    }

    # Health check (no rate limit)
    location /health {
        proxy_pass http://api_backend;
        access_log off;
    }
}

# Console Frontend
server {
    listen 443 ssl http2;
    server_name console.bustracker.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /usr/share/nginx/html/console;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Monitoring Frontend
server {
    listen 443 ssl http2;
    server_name monitor.bustracker.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /usr/share/nginx/html/monitor;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# PWA
server {
    listen 443 ssl http2;
    server_name pwa.bustracker.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    root /usr/share/nginx/html/pwa;
    index index.html;

    # PWA requires proper caching headers
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /manifest.json {
        add_header Cache-Control "no-cache";
    }

    location /service-worker.js {
        add_header Cache-Control "no-cache";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 4. CI/CD PIPELINE (GitHub Actions)

### 4.1 Build & Test Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: ./backend

      - name: Run ESLint
        run: npm run lint
        working-directory: ./backend

      - name: Run Tests
        run: npm test
        working-directory: ./backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  build-and-push:
    needs: lint-and-test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write

    strategy:
      matrix:
        component: [api, console, monitor, pwa]

    steps:
      - uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/${{ matrix.component }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: ./${{ matrix.component }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging

    steps:
      - name: Deploy to Staging
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/bustracker
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker system prune -f

  deploy-production:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to Production
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/bustracker
            docker-compose pull
            docker-compose up -d --remove-orphans --no-recreate
            docker system prune -f

      - name: Health Check
        run: |
          sleep 10
          curl -f https://api.bustracker.com/health || exit 1
```

---

## 5. DATABASE MIGRATIONS

### 5.1 Migration Strategy

```bash
# Pre-deployment script
#!/bin/bash
# scripts/migrate.sh

set -e

echo "Running database migrations..."

# Backup before migration
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations (Prisma example)
npx prisma migrate deploy

# Verify
npx prisma migrate status

echo "Migrations completed successfully"
```

### 5.2 Rollback Plan

```bash
# scripts/rollback.sh

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./rollback.sh <backup_file>"
  exit 1
fi

echo "Rolling back to: $BACKUP_FILE"
pg_restore -d $DATABASE_URL --clean $BACKUP_FILE

echo "Rollback completed"
```

---

## 6. SECRETS MANAGEMENT

### 6.1 Environment Variables (.env.production)

```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/bustracker
DB_POOL_SIZE=20

# Redis
REDIS_URL=redis://:password@redis:6379
REDIS_MAX_RETRIES=3

# JWT
JWT_SECRET=<64-char-random-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google Maps
GOOGLE_MAPS_API_KEY=<your-api-key>

# Rate Limiting
RATE_LIMIT_TELEMETRY=10 # req/min per device
RATE_LIMIT_API=100 # req/min per user

# Monitoring
SENTRY_DSN=<sentry-dsn>
LOG_LEVEL=info

# CORS
CORS_ORIGINS=https://console.bustracker.com,https://monitor.bustracker.com

# Email (optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@bustracker.com
SMTP_PASSWORD=<smtp-password>
```

### 6.2 Secret Injection (Production)

**Option 1: Docker Secrets**
```yaml
# docker-compose.prod.yml
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

services:
  api:
    secrets:
      - db_password
      - jwt_secret
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret
```

**Option 2: Vault (Kubernetes)**
```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: bustracker-secrets
type: Opaque
data:
  DATABASE_URL: <base64-encoded>
  JWT_SECRET: <base64-encoded>
```

---

## 7. SSL/TLS CERTIFICATES

### 7.1 Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d api.bustracker.com \
                      -d console.bustracker.com \
                      -d monitor.bustracker.com \
                      -d pwa.bustracker.com

# Auto-renewal (cron)
0 3 * * * certbot renew --quiet --post-hook "docker-compose restart nginx"
```

---

## 8. MONITORING & OBSERVABILITY

### 8.1 Prometheus + Grafana Stack

```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      DATA_SOURCE_NAME: ${DATABASE_URL}
    ports:
      - "9187:9187"

  redis-exporter:
    image: oliver006/redis_exporter
    environment:
      REDIS_ADDR: redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    ports:
      - "9121:9121"

volumes:
  prometheus_data:
  grafana_data:
```

### 8.2 Key Metrics to Monitor

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| API Response Time (p95) | >500ms | Scale up instances |
| Database Connection Pool | >80% usage | Increase pool size |
| Redis Memory Usage | >85% | Scale up RAM |
| Disk Space | >80% | Cleanup old data |
| Bus Offline Count | >10% fleet | Notify operations |
| Error Rate | >5% | Check logs, rollback |
| WebSocket Connections | >1000 | Scale WS server |

### 8.3 Alertmanager Configuration

```yaml
# alertmanager.yml
route:
  receiver: 'slack-critical'
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
    - match:
        severity: warning
      receiver: 'slack-warnings'

receivers:
  - name: 'slack-critical'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#alerts-critical'
        title: 'Bus Tracker Alert'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<pagerduty-key>'
```

---

## 9. BACKUP & DISASTER RECOVERY

### 9.1 Automated Backups

```bash
# scripts/backup.sh
#!/bin/bash

BACKUP_DIR="/backups/bustracker"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Redis backup (RDB snapshot)
docker exec bustracker_redis redis-cli BGSAVE
cp /var/lib/docker/volumes/redis_data/_data/dump.rdb $BACKUP_DIR/redis_$DATE.rdb

# Retention: keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 sync $BACKUP_DIR s3://bustracker-backups/

echo "Backup completed: $DATE"
```

**Cron Schedule**:
```cron
# Daily at 3 AM
0 3 * * * /opt/bustracker/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### 9.2 Disaster Recovery Procedure

**RTO (Recovery Time Objective)**: 2 hours
**RPO (Recovery Point Objective)**: 24 hours (daily backups)

**Steps**:
1. Provision new VPS (or restore from snapshot)
2. Install Docker + Docker Compose
3. Clone repository: `git clone https://github.com/org/bustracker.git`
4. Restore database: `gunzip -c backup.sql.gz | psql $DATABASE_URL`
5. Restore Redis: `cp backup.rdb /var/lib/docker/volumes/redis_data/_data/`
6. Update DNS records (if IP changed)
7. Start services: `docker-compose up -d`
8. Verify health: `curl https://api.bustracker.com/health`

---

## 10. OPERATIONAL CHECKLIST

### 10.1 Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] Database migrations tested on staging
- [ ] Environment variables configured
- [ ] SSL certificates valid (>30 days remaining)
- [ ] Backup taken before deployment
- [ ] Rollback plan documented
- [ ] Monitoring dashboards updated
- [ ] API documentation updated
- [ ] Changelog updated
- [ ] Stakeholders notified of maintenance window

### 10.2 Post-Deployment Checklist

- [ ] Health check passed: `/health` returns 200
- [ ] Database migrations applied successfully
- [ ] All services running (`docker-compose ps`)
- [ ] Logs show no critical errors
- [ ] Metrics dashboard showing normal values
- [ ] Sample API requests working (test device, fleet/live)
- [ ] WebSocket connection working
- [ ] Frontend apps loading correctly
- [ ] PWA installable and service worker registered
- [ ] Rate limiting working (test with burst)
- [ ] Email notifications sent (if configured)
- [ ] Monitoring alerts configured

### 10.3 Daily Operations Checklist

- [ ] Check overnight errors in logs
- [ ] Review offline bus count
- [ ] Check disk space usage
- [ ] Verify backup completed
- [ ] Review API latency metrics
- [ ] Check database slow queries
- [ ] Monitor Redis memory usage
- [ ] Review rate limit violations
- [ ] Check SSL expiry dates

### 10.4 Weekly Maintenance

- [ ] Review and analyze logs for patterns
- [ ] Update dependencies (security patches)
- [ ] Review database query performance
- [ ] Cleanup old location data (>90 days)
- [ ] Review and optimize indexes
- [ ] Test backup restoration
- [ ] Review monitoring alerts (false positives)
- [ ] Update documentation

### 10.5 Monthly Tasks

- [ ] Security audit (dependency vulnerabilities)
- [ ] Load testing (simulate peak traffic)
- [ ] Database vacuum and analyze
- [ ] Review and renew SSL certificates
- [ ] Capacity planning review
- [ ] Cost optimization analysis
- [ ] User feedback review
- [ ] Update disaster recovery plan

---

## 11. SCALING PLAN

### Phase 1: 1-100 Bus (Current)
- Single VPS (8 vCPU, 16GB RAM)
- Docker Compose
- PostgreSQL single instance
- Redis single instance

### Phase 2: 100-500 Bus
- Add API server replica (load balancing)
- PostgreSQL read replica
- Redis Sentinel (HA)
- Separate WebSocket server instances

### Phase 3: 500+ Bus
- Migrate to Kubernetes
- Horizontal pod autoscaling
- PostgreSQL sharding by region
- Redis Cluster
- CDN for static assets
- Multi-region deployment

---

## 12. TROUBLESHOOTING GUIDE

### 12.1 Common Issues

**Issue: High API latency**
```bash
# Check database connections
docker exec bustracker_db psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check slow queries
docker exec bustracker_db psql -U postgres -d bustracker -c "
  SELECT query, mean_exec_time
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Solution: Add indexes, increase connection pool, scale horizontally
```

**Issue: Redis memory full**
```bash
# Check memory usage
docker exec bustracker_redis redis-cli INFO memory

# Clear old last_positions (keep only active)
docker exec bustracker_redis redis-cli --scan --pattern "last_position:*" | xargs redis-cli DEL

# Solution: Increase Redis memory, implement TTL
```

**Issue: WebSocket disconnections**
```bash
# Check nginx timeout settings
grep proxy_read_timeout /etc/nginx/nginx.conf

# Increase timeout to 86400s (24h)
# Check client-side reconnect logic
```

**Issue: Bus not appearing on map**
```bash
# Verify device registration
curl -H "Authorization: Bearer <token>" https://api.bustracker.com/v1/fleet/live

# Check device last_seen
SELECT * FROM devices WHERE uuid = '<device-uuid>';

# Check last_positions table
SELECT * FROM last_positions WHERE device_id = <id>;
```

---

## 13. RUNBOOK

### Start Services
```bash
cd /opt/bustracker
docker-compose up -d
docker-compose logs -f api
```

### Stop Services
```bash
docker-compose down
```

### Restart Service
```bash
docker-compose restart api
```

### View Logs
```bash
docker-compose logs -f --tail=100 api
docker-compose logs -f --tail=100 worker
```

### Database Console
```bash
docker exec -it bustracker_db psql -U postgres -d bustracker
```

### Redis Console
```bash
docker exec -it bustracker_redis redis-cli -a <password>
```

### Manual Migration
```bash
docker exec bustracker_api npm run migrate
```

### Clear Redis Cache
```bash
docker exec bustracker_redis redis-cli -a <password> FLUSHDB
```

### Force Rebuild
```bash
docker-compose build --no-cache api
docker-compose up -d api
```

---

## 14. CONTACTS & ESCALATION

| Role | Contact | Escalation Level |
|------|---------|------------------|
| On-Call Engineer | +39 XXX XXX XXXX | L1 (immediate) |
| DevOps Lead | devops@example.com | L2 (30 min) |
| CTO | cto@example.com | L3 (critical only) |
| Database Admin | dba@example.com | Database issues |
| Cloud Provider Support | AWS/GCP Support | Infrastructure issues |

**Incident Severity**:
- **P0 (Critical)**: Service down, data loss → Escalate immediately
- **P1 (High)**: Major feature broken, >50% buses offline → Escalate within 30 min
- **P2 (Medium)**: Minor feature broken, <10% buses offline → Next business day
- **P3 (Low)**: Cosmetic issues, documentation → Backlog
