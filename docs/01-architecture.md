# Architettura Sistema Bus Tracker

## 1. PANORAMICA ARCHITETTURALE

### 1.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                          │
├─────────────────┬──────────────────────┬───────────────────────────┤
│   PWA Android   │   Console Admin      │   Monitoring Frontend     │
│  (Bus Tracker)  │   (Operations)       │   (Desktop + Mobile)      │
│                 │                      │                           │
│ - Geolocation   │ - Fleet Management   │ - Real-time Map          │
│ - Offline Queue │ - Route Editor       │ - Filters & Search       │
│ - Auto-sync     │ - Device Association │ - Status Dashboard       │
└────────┬────────┴──────────┬───────────┴────────┬──────────────────┘
         │                   │                    │
         │ HTTPS/WSS         │ HTTPS              │ HTTPS/WSS
         │                   │                    │
┌────────▼───────────────────▼────────────────────▼──────────────────┐
│                        API GATEWAY / LOAD BALANCER                  │
│                     (NGINX / Traefik / Cloud LB)                    │
│                                                                     │
│  - TLS Termination                                                 │
│  - Rate Limiting                                                   │
│  - Request Routing                                                 │
└────────┬───────────────────────────────────────────────────────────┘
         │
┌────────▼───────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                            │
├─────────────────┬───────────────────────┬──────────────────────────┤
│  REST API       │  WebSocket Server     │  Background Workers      │
│  (Node.js)      │  (Socket.io/WS)       │  (Bull/BullMQ)           │
│                 │                       │                          │
│ - Auth Service  │ - Real-time Updates   │ - Location Processing    │
│ - Device API    │ - Presence Detection  │ - Offline Detection      │
│ - Fleet API     │ - Broadcast Events    │ - Data Retention         │
│ - Telemetry API │                       │ - Report Generation      │
└────────┬────────┴──────────┬────────────┴────────┬─────────────────┘
         │                   │                     │
┌────────▼───────────────────▼─────────────────────▼─────────────────┐
│                         DATA LAYER                                  │
├──────────────────┬──────────────────┬──────────────────────────────┤
│  PostgreSQL      │  Redis           │  Object Storage              │
│  + PostGIS       │                  │  (S3/MinIO)                  │
│                  │                  │                              │
│ - Devices        │ - Session Cache  │ - Audit Logs                 │
│ - Buses          │ - Last Positions │ - Export Files               │
│ - Lines/Routes   │ - Rate Limits    │ - Static Assets              │
│ - Locations      │ - Job Queue      │                              │
│ - Users/Roles    │ - Pub/Sub        │                              │
└──────────────────┴──────────────────┴──────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                 │
├──────────────────┬──────────────────┬───────────────────────────────┤
│  Google Maps API │  Monitoring      │  Notification Service         │
│                  │  (Prometheus +   │  (Optional: Email/SMS)        │
│  - Maps JS API   │   Grafana)       │                               │
│  - Geocoding API │                  │                               │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

## 2. STACK TECNOLOGICO

### 2.1 Frontend Stack

#### PWA Android (Bus Tracker)
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand / Redux Toolkit
- **Storage**: IndexedDB (via Dexie.js)
- **HTTP Client**: Axios con interceptor retry
- **Geolocation**: Navigator.geolocation API + Capacitor (se wrapper nativo)
- **PWA Tools**: Workbox (service worker), Web App Manifest
- **UI**: Tailwind CSS / Material UI
- **Alternativa Nativa**: Capacitor per TWA con background geolocation plugin

#### Console Admin (Operations Backend)
- **Framework**: React 18 + TypeScript / Next.js 14
- **Routing**: React Router / Next.js App Router
- **State**: React Query + Zustand
- **Forms**: React Hook Form + Zod validation
- **Maps**: @react-google-maps/api
- **UI Components**: shadcn/ui + Tailwind CSS
- **Data Tables**: TanStack Table
- **Charts**: Recharts / Chart.js

#### Monitoring Frontend
- **Framework**: React 18 + TypeScript
- **Real-time**: Socket.io-client
- **Maps**: Google Maps JavaScript API
- **Marker Clustering**: @googlemaps/markerclusterer
- **State**: React Query + WebSocket sync
- **UI**: Responsive design (Mobile-first)

### 2.2 Backend Stack

#### API Server
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js / Fastify
- **Language**: TypeScript
- **Validation**: Zod / Joi
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Rate Limiting**: express-rate-limit + Redis
- **CORS**: cors middleware
- **Logging**: Winston / Pino
- **API Docs**: Swagger UI (@fastify/swagger)

#### WebSocket Server
- **Library**: Socket.io / ws
- **Authentication**: JWT in handshake
- **Rooms**: Line-based rooms per filtri

#### Background Jobs
- **Queue**: BullMQ (Redis-backed)
- **Scheduler**: node-cron
- **Tasks**:
  - Offline bus detection (ogni 5 min)
  - Data retention cleanup (daily)
  - Report generation
  - Location history aggregation

### 2.3 Database & Cache

#### PostgreSQL 15+ con PostGIS
- **ORM**: Prisma / TypeORM
- **Migrations**: Prisma Migrate / TypeORM CLI
- **Connection Pool**: pg-pool (max 20 connessioni)
- **Extensions**:
  - PostGIS (geospatial)
  - pg_trgm (text search)
  - uuid-ossp (UUID generation)

#### Redis 7+
- **Use Cases**:
  - Session storage
  - Last position cache (Hash per device_id)
  - Rate limiting
  - Job queue (BullMQ)
  - Pub/Sub per WebSocket broadcast
- **Persistence**: RDB snapshot + AOF

#### Object Storage
- **Solution**: MinIO (self-hosted) / AWS S3
- **Use Cases**:
  - Audit log archives
  - CSV exports
  - Route GPX files

### 2.4 Infrastructure

#### Container Orchestration
- **Local Dev**: Docker Compose
- **Production**: Kubernetes / Docker Swarm / AWS ECS
- **Images**: Node Alpine, PostgreSQL 15-alpine, Redis Alpine

#### Reverse Proxy / Load Balancer
- **Option 1**: NGINX (self-hosted)
- **Option 2**: Traefik (cloud-native)
- **Option 3**: AWS ALB / GCP Load Balancer

#### CI/CD
- **Pipeline**: GitHub Actions / GitLab CI
- **Stages**:
  1. Lint (ESLint, Prettier)
  2. Test (Jest, Vitest)
  3. Build (Docker images)
  4. Deploy (rolling update)
- **Registries**: Docker Hub / AWS ECR / GitLab Registry

#### Monitoring & Observability
- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana) / Loki
- **Tracing**: Jaeger (optional)
- **Uptime**: UptimeRobot / Pingdom
- **Alerts**: Alertmanager + PagerDuty/Slack

#### Secrets Management
- **Dev**: .env files (git-ignored)
- **Prod**: HashiCorp Vault / AWS Secrets Manager / Kubernetes Secrets

## 3. SCELTE ARCHITETTURALI MOTIVATE

### 3.1 Perché Node.js + TypeScript per Backend?
- **Pro**:
  - Ecosistema maturo per API real-time (Socket.io)
  - Condivisione tipi tra frontend e backend
  - Performance adeguata per I/O-bound workloads
  - Ampio supporto librerie geospaziali (Turf.js)
- **Contro**:
  - Single-threaded (mitigato con cluster mode)
- **Alternativa**: Go / Rust per microservizi critici (futuro)

### 3.2 Perché PostgreSQL + PostGIS?
- **Pro**:
  - Supporto nativo geospaziale (ST_Distance, ST_Within)
  - ACID compliance per transazioni critiche
  - JSON/JSONB per metadata flessibili
  - Open-source, matura, scalabile verticalmente
- **Contro**:
  - Scaling orizzontale complesso (mitigato con read replicas)
- **Alternativa**: MongoDB + geospatial indexes (meno ACID)

### 3.3 Perché Redis per Last Position Cache?
- **Pro**:
  - Latenza <1ms per read
  - Struttura HASH perfetta per `last_position:{device_id}`
  - TTL automatico per pulizia
  - Pub/Sub per notifiche real-time
- **Contro**:
  - In-memory, costo RAM
- **Mitigazione**: Retention 24h in Redis, storico in PostgreSQL

### 3.4 PWA vs App Nativa?
- **Scelta iniziale**: PWA con Capacitor fallback
- **Motivazione**:
  - Deployment rapido (no app store review)
  - Single codebase
  - Update istantanei
- **Limitazione critica**: Background geolocation su Android
  - Chrome PWA: sospensione dopo 5 min schermo spento
  - **Soluzione**: Capacitor + Trusted Web Activity + Foreground Service
    - Plugin: @capacitor/geolocation + background mode plugin
    - Notifica persistente per foreground service
- **Criterio fallback**: se <80% affidabilità invii, migrare a native Kotlin

### 3.5 Aggiornamento UI: Polling vs WebSocket?
- **Scelta**: Hybrid approach
  - **WebSocket** per operatori attivi (latenza real-time)
  - **Polling 120s** come fallback se WS fail
- **Motivazione**:
  - WS riduce traffico (broadcast push)
  - Polling garantisce resilienza
  - Operatori mobili possono avere NAT/firewall issues
- **Implementazione**:
  - Socket.io con auto-reconnect
  - Heartbeat ogni 30s
  - Fallback automatico a polling dopo 3 retry

### 3.6 Google Maps API Strategy
- **API utilizzate**:
  - Maps JavaScript API (rendering mappe)
  - Geocoding API (reverse geocoding fermate)
  - Directions API (optional: calcolo ETA)
- **Gestione costi**:
  - Caching geocoding results
  - Lazy loading maps (solo quando visibili)
  - Restrict API key per dominio/IP
  - Budget alerts su GCP Console
- **Quota stimate** (100 bus, 10 operatori):
  - Map loads: ~200/day → $1.40/day ($42/month)
  - Marker updates: inclusi in map loads
  - Geocoding: ~50/day → $2.50/month
  - **Totale**: ~$45-50/month

## 4. DATA FLOW

### 4.1 Invio Posizione (Bus → Server)
```
[PWA] Geolocation API (ogni 120s)
  ↓
[PWA] Valida movimento >50m (throttling)
  ↓
[PWA] Aggiungi metadata (battery, network)
  ↓
[PWA] POST /telemetry/location + device token
  ↓
[API Gateway] Rate limit (10 req/min per device)
  ↓
[API Server] Valida JWT token + nonce anti-replay
  ↓
[API Server] Inserisci in locations table (PostgreSQL)
  ↓
[API Server] Aggiorna last_position cache (Redis Hash)
  ↓
[WebSocket] Broadcast a room line_id
  ↓
[Monitoring Frontend] Aggiorna marker su mappa
```

### 4.2 Visualizzazione Mappa (Operatore)
```
[Frontend] Carica mappa + filtri linea
  ↓
[Frontend] GET /fleet/live?line_id=5
  ↓
[API Server] Query Redis per last_position di bus su linea 5
  ↓
[API Server] Return JSON {buses: [{id, lat, lng, ts, status}]}
  ↓
[Frontend] Render markers su Google Map
  ↓
[Frontend] Connetti WebSocket (room: line_5)
  ↓
[WebSocket] Ricevi update real-time
  ↓
[Frontend] Update marker position (smooth transition)
```

### 4.3 Creazione Percorso (Admin)
```
[Console] Drawing mode su mappa (polyline)
  ↓
[Console] Aggiungi waypoints, fermate (POI markers)
  ↓
[Console] Form: nome, linea, direzione, validità
  ↓
[Console] POST /routes { polyline, stops[], metadata }
  ↓
[API Server] Valida admin JWT
  ↓
[API Server] Insert in routes table
  ↓
[API Server] Audit log (chi, quando, cosa)
  ↓
[Console] Success + redirect a lista percorsi
```

## 5. SICUREZZA

### 5.1 Authentication & Authorization
- **Device Auth**: JWT token firmato, rotazione ogni 30 giorni
- **User Auth**: JWT access token (15 min) + refresh token (7 giorni)
- **RBAC**:
  - `ADMIN`: full access
  - `OPERATOR`: read-only fleet data
  - `DEVICE`: write-only telemetry
- **Anti-replay**: nonce + timestamp window (±5 min)

### 5.2 Transport Security
- **TLS 1.3**: Let's Encrypt certificates
- **HSTS**: Strict-Transport-Security header
- **CSP**: Content-Security-Policy per XSS mitigation

### 5.3 API Security
- **Rate Limiting**:
  - Device: 10 req/min
  - Operator: 100 req/min
  - Admin: 200 req/min
- **Input Validation**: Zod schema, SQL injection prevention (prepared statements)
- **CORS**: whitelist domini frontend

### 5.4 Data Privacy (GDPR)
- **Base giuridica**: Legittimo interesse (tracciamento mezzi aziendali)
- **Informativa**: privacy policy per autisti
- **Minimizzazione**: retention 90 giorni storico
- **Right to access**: API export dati utente
- **Audit**: log accessi admin con IP + timestamp

## 6. SCALABILITÀ

### 6.1 Dimensionamento Stimato
- **Bus attivi**: 100 (picco)
- **Frequenza invio**: 120s → 0.83 req/s
- **Operatori simultanei**: 10-20
- **QPS totale atteso**: ~5-10 req/s (con burst 50 req/s)

### 6.2 Vertical Scaling (Fase 1)
- **API Server**: 2 vCPU, 4GB RAM (handle 1000 req/s)
- **PostgreSQL**: 4 vCPU, 8GB RAM, SSD
- **Redis**: 1 vCPU, 2GB RAM

### 6.3 Horizontal Scaling (Fase 2, >500 bus)
- **API Server**: Load balancer + 3+ replicas (stateless)
- **WebSocket**: Sticky sessions + Redis adapter per broadcast cross-instance
- **PostgreSQL**: Read replicas per query analytics
- **Redis**: Redis Cluster (sharding)

### 6.4 Database Optimization
- **Indexes**:
  - `locations(device_id, created_at DESC)`
  - `locations(bus_id, created_at DESC)`
  - `locations USING GIST(point)` (geospatial)
- **Partitioning**: locations table partitioned by month (range partitioning)
- **Retention**: DELETE job mensile per dati >90 giorni

## 7. RESILIENZA

### 7.1 Fault Tolerance
- **API Server**: Health check endpoint `/health`, restart automatico
- **Database**: Streaming replication (PostgreSQL), failover automatico
- **Queue**: Dead letter queue per job falliti, retry con backoff esponenziale

### 7.2 Disaster Recovery
- **Backup**:
  - PostgreSQL: pg_dump daily + WAL archiving
  - Redis: RDB snapshot ogni 6h + AOF
- **RTO**: <1h (restore da backup)
- **RPO**: <15 min (WAL archiving)

### 7.3 Degradation Strategy
- Se Google Maps API down: fallback a OpenStreetMap (Leaflet.js)
- Se Redis down: fallback a PostgreSQL per last position (slower)
- Se WebSocket down: polling mode attivo

## 8. PERFORMANCE TARGETS

| Metrica | Target | Misurazione |
|---------|--------|-------------|
| API Latency (p95) | <200ms | Prometheus |
| Map Load Time | <2s | Lighthouse |
| Location Write | <100ms | Application logs |
| WebSocket Latency | <50ms | Client-side timing |
| Database Queries (p95) | <50ms | pg_stat_statements |
| Uptime | 99.5% | Pingdom |

## 9. COSTI STIMATI (Infra Cloud)

### AWS / GCP Stima Mensile (100 bus)
- **Compute** (EC2/Compute Engine): $100
- **Database** (RDS/Cloud SQL): $80
- **Redis** (ElastiCache/Memorystore): $40
- **Storage** (S3/GCS): $10
- **Load Balancer**: $20
- **Google Maps API**: $50
- **Monitoring** (CloudWatch/Stackdriver): $15
- **Total**: ~$315/month

### Alternative Self-Hosted (VPS)
- **VPS 8vCPU/16GB** (Hetzner, DigitalOcean): $60-80/month
- **Google Maps API**: $50
- **Total**: ~$110-130/month (senza managed services)
