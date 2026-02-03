# Sizing e Ottimizzazioni per Flotta 10 Bus

## AGGIORNAMENTO REQUIREMENTS

**Flotta**: Massimo 10 autobus (vs 100 stimati inizialmente)

Questo riduce significativamente i requisiti infrastrutturali e i costi operativi.

---

## 1. INFRASTRUTTURA OTTIMIZZATA

### Server Production (VPS Ridimensionato)

**Configurazione Raccomandata**:
```
Provider: Hetzner / DigitalOcean / Contabo
Tipo: VPS Cloud (non dedicato)
CPU: 2-4 vCPU
RAM: 4-8GB
Storage: 50GB SSD
OS: Ubuntu 22.04 LTS
Costo: €15-25/mese
```

**Motivazione**: 10 bus con invii ogni 120s = 0.08 req/s per telemetria, carico minimo.

### Alternativa: VPS Economico + Managed DB

```
VPS Base (2 vCPU, 2GB RAM): €5/mese (Hetzner CX11)
+ Managed PostgreSQL (hobby tier): €15/mese (DigitalOcean)
+ Redis (self-hosted sul VPS): €0
Totale: €20/mese
```

### Alternativa 2: Tutto-in-Uno VPS Minimo

```
Provider: Contabo / Hetzner
VPS: 4 vCPU, 8GB RAM, 50GB SSD
Costo: €5-10/mese
```

**Raccomandazione per 10 bus**: **VPS 4vCPU/8GB @ €10-15/mese** (sufficiente per tutto: API, DB, Redis, Frontend)

---

## 2. COSTI AGGIORNATI

### Setup Iniziale (One-Time)

| Voce | Costo Originale (100 bus) | Costo Ottimizzato (10 bus) | Note |
|------|---------------------------|----------------------------|------|
| Sviluppo Backend | €8,000 | €6,000 | Meno complessità scaling |
| Sviluppo Console Admin | €4,000 | €3,000 | UI più semplice |
| Sviluppo Monitoring | €2,000 | €1,500 | Meno ottimizzazioni necessarie |
| Sviluppo PWA + Capacitor | €6,000 | €6,000 | Invariato |
| Testing & QA | €2,000 | €1,500 | Meno dispositivi da testare |
| Deploy & Training | €1,500 | €1,000 | Meno utenti |
| **Totale Setup** | **€23,500** | **€19,000** | **-19%** |

### Costi Ricorrenti Mensili (10 bus)

| Voce | Costo 100 bus | Costo 10 bus | Riduzione |
|------|---------------|--------------|-----------|
| VPS Hosting | €70/mese | €10-15/mese | **-79%** |
| Google Maps API | €50/mese | €5-10/mese | **-85%** |
| SSL Certificates | €0 | €0 | - |
| Backup Storage | €10/mese | €2/mese | -80% |
| Monitoring | €0 | €0 | - |
| **Totale Mensile** | **€130/mese** | **€17-27/mese** | **-83%** |

**💰 Risparmio Annuale**: €1,560 → €204-324/anno (€1,236-1,356 risparmiati)

---

## 3. GOOGLE MAPS API - COSTI DETTAGLIATI (10 bus)

### Utilizzo Stimato Mensile

**Map Loads** (Monitoring Frontend):
- 10 operatori × 20 aperture/giorno × 30 giorni = 6,000 loads/mese
- Costo: 6,000 × $0.007 = **$42/mese**
- **NOTA**: Primi 28,000 loads/mese sono GRATUITI!
- **Costo effettivo: $0/mese** ✅

**Marker Updates** (inclusi in Map Loads): $0

**Geocoding API** (reverse geocoding fermate):
- ~50 fermate × 1 geocoding = 50 calls one-time
- Costo: 50 × $0.005 = **$0.25 one-time**

**Directions API** (opzionale, ETA calcolo):
- Se usato: ~100 calls/mese = $5/mese
- **Raccomandazione**: Non implementare per 10 bus, non necessario

### Totale Google Maps API: **€0-5/mese** (vs €50 stimato per 100 bus)

**Strategia**:
- Restare sotto 28,000 map loads/mese (quota gratuita)
- Caching aggressivo geocoding results
- No Directions API (calcolo ETA client-side approssimativo)

---

## 4. DATABASE SIZING (10 bus)

### Stima Dati

**Locations Table** (storico 90 giorni):
- 10 bus × 720 invii/giorno × 90 giorni = 648,000 records
- Dimensione record: ~200 bytes
- Totale: **648,000 × 200 bytes ≈ 123 MB**

**Last Positions** (cache): 10 records × 200 bytes = **2 KB**

**Altri dati** (buses, lines, routes, stops, users): **<1 MB**

**Totale Database**: ~150 MB (con indices: ~300 MB)

**Implicazioni**:
- ✅ NO partitioning necessario (locations table piccola)
- ✅ NO read replica necessaria
- ✅ Backup veloci (<1 min)
- ✅ Migrations istantanee

### PostgreSQL Configuration Ottimizzata (4GB RAM)

```sql
-- postgresql.conf per VPS 4GB RAM
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1  # SSD
effective_io_concurrency = 200
work_mem = 10MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 50  # ridotto da 100
```

---

## 5. REDIS SIZING (10 bus)

### Utilizzo Memoria Stimato

**Last Positions Cache**:
- 10 bus × 500 bytes/record = **5 KB**

**Session Cache** (10 operatori max):
- 10 sessions × 2 KB = **20 KB**

**Job Queue** (BullMQ):
- ~100 jobs in queue × 1 KB = **100 KB**

**Totale Redis**: **<1 MB** (con overhead: ~10 MB)

**Implicazioni**:
- ✅ Redis può girare con 256 MB RAM allocati
- ✅ NO Redis Cluster necessario
- ✅ RDB snapshot < 1s

### Redis Configuration Ottimizzata

```conf
# redis.conf per low memory
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

---

## 6. ARCHITETTURA SEMPLIFICATA

### Docker Compose Ottimizzato (Monolith)

```yaml
version: '3.8'

services:
  postgres:
    image: postgis/postgis:15-3.3-alpine
    environment:
      POSTGRES_DB: bustracker
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    shm_size: 256mb  # ridotto da 1gb
    command: >
      postgres
      -c shared_buffers=512MB
      -c max_connections=50
      -c work_mem=10MB

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data

  app:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/bustracker
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"   # API
      - "3001:3001"   # WebSocket (stesso container)
    depends_on:
      - postgres
      - redis

  # Frontends serviti da NGINX statico (no Node.js runtime)
  nginx:
    image: nginx:alpine
    volumes:
      - ./console/dist:/usr/share/nginx/html/console
      - ./monitor/dist:/usr/share/nginx/html/monitor
      - ./pwa/dist:/usr/share/nginx/html/pwa
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"

volumes:
  postgres_data:
  redis_data:
```

**Semplificazioni**:
- API + WebSocket nello stesso container (no separazione necessaria)
- No background worker separato (cron jobs interni all'API)
- Frontend statici (no SSR Next.js, React build statico)

---

## 7. PERFORMANCE TARGETS AGGIORNATI

### QPS (Queries Per Second)

**Telemetria**:
- 10 bus × 1 invio/120s = **0.08 req/s** (picco: 0.5 req/s)

**API Operatori**:
- 10 operatori × 10 req/min = **1.6 req/s** (picco: 10 req/s)

**Totale atteso**: **~2 req/s** (picco: 15 req/s)

**Capacità VPS 4vCPU**: >1000 req/s

**Overhead**: **99.8% risorse inutilizzate** → perfetto per small fleet

### Latency Targets (più rilassati)

| Metrica | Target 100 bus | Target 10 bus | Motivo |
|---------|----------------|---------------|--------|
| API Latency (p95) | <200ms | <100ms | Carico minimo |
| Database Queries (p95) | <50ms | <20ms | Dati ridotti |
| Map Load Time | <2s | <1.5s | Meno marker |
| WebSocket Latency | <50ms | <30ms | Meno connessioni |

---

## 8. MONITORING SEMPLIFICATO

### Opzione 1: Self-Hosted Leggero (Raccomandato)

**Grafana Cloud Free Tier**:
- Metrics: 10k series (sufficiente)
- Logs: 50GB/mese (abbondante)
- Dashboards: illimitati
- Costo: **€0/mese** ✅

**Setup**:
```yaml
# docker-compose.yml
services:
  grafana-agent:
    image: grafana/agent:latest
    volumes:
      - ./grafana-agent.yaml:/etc/agent/agent.yaml
    environment:
      GRAFANA_CLOUD_API_KEY: ${GRAFANA_API_KEY}
```

### Opzione 2: Monitoring Minimalista

**Healthchecks.io**:
- Ping endpoint /health ogni 5 min
- Email alert se down
- Costo: **€0/mese** (free tier)

**UptimeRobot**:
- 50 monitor gratuiti
- Check interval: 5 min
- Costo: **€0/mese**

**Raccomandazione**: Grafana Cloud Free + UptimeRobot (totale: €0)

---

## 9. BACKUP SEMPLIFICATO

### Script Backup Ottimizzato (10 bus)

```bash
#!/bin/bash
# backup-light.sh

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d)

# PostgreSQL backup (database <500MB)
docker exec bustracker_postgres pg_dump -U postgres bustracker | \
  gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Redis snapshot (già auto-salvato)
docker exec bustracker_redis redis-cli BGSAVE

# Retention: 30 giorni (totale ~15GB)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Optional: sync to Google Drive (rclone)
# rclone copy $BACKUP_DIR gdrive:bus-tracker-backups
```

**Storage Backup** (30 giorni retention):
- Database: 500 MB/backup × 30 = 15 GB
- Costo: Locale (€0) o Google Drive 15GB (€0, free tier)

---

## 10. SCALING PATH (Se Crescita Futura)

### 10 → 20 bus
- **Azione**: Nessuna, stessa infra (overhead 99%)
- **Costo**: Invariato

### 20 → 50 bus
- **Azione**: Upgrade VPS a 8GB RAM (€20/mese)
- **Costo**: +€5-10/mese

### 50 → 100 bus
- **Azione**: Seguire piano originale (doc 01)
- **Costo**: €130/mese

**Conclusione**: Architettura scalabile, nessun refactoring necessario.

---

## 11. DEVELOPMENT SEMPLIFICATO

### Timeline Rivista (10 bus)

| Fase | Originale | Ottimizzato | Risparmio |
|------|-----------|-------------|-----------|
| Backend + Console | 4 settimane | 3 settimane | -25% |
| Monitoring + WS | 2 settimane | 1.5 settimane | -25% |
| PWA + Capacitor | 3 settimane | 3 settimane | 0% |
| Deploy + Test | 1 settimana | 0.5 settimane | -50% |
| **Totale** | **10 settimane** | **8 settimane** | **-20%** |

**Semplificazioni Possibili**:
- No partitioning DB
- No horizontal scaling logic
- No advanced caching strategies
- Monitoring base (no Prometheus stack)
- Testing con 3 dispositivi (vs 10)

### Team Ridotto

**Originale** (100 bus): 3.5 FTE
**Ottimizzato** (10 bus): **2 FTE**

- 1× Full-Stack Developer (backend + frontend)
- 0.5× Mobile Developer (PWA Capacitor part-time)
- 0.5× DevOps (setup infra part-time)

**Saving**: -43% team size

---

## 12. FEATURE PRIORITIZATION

### Must Have (MVP - 10 bus)
- ✅ Invio posizione automatico PWA
- ✅ Mappa real-time con 10 marker
- ✅ CRUD base (bus, linee, fermate)
- ✅ Associazione device → bus → linea
- ✅ Filtro per linea
- ✅ Alert bus offline

### Nice to Have (Fase 2)
- ⏸️ Creazione percorsi complessa (polyline drag-drop)
  - **Alternativa semplice**: Upload GPX o lista coordinate
- ⏸️ Storico posizioni con replay
- ⏸️ Report analytics
- ⏸️ Multi-tenancy (più aziende)

### Not Needed (10 bus)
- ❌ Marker clustering (solo 10 marker)
- ❌ Database sharding
- ❌ Read replicas
- ❌ Redis Cluster
- ❌ Multi-region deployment
- ❌ Advanced caching (Redis sufficiente)

---

## 13. COSTI FINALI RIVISTI

### Investimento Totale Anno 1

**Setup** (one-time): €19,000
**Operativi** (12 mesi): €20/mese × 12 = €240
**Google Maps API**: €0-60/anno
**Totale Anno 1**: **€19,240-19,300**

### Costo per Bus per Anno

**Anno 1**: €19,300 / 10 bus = **€1,930/bus**
**Anno 2+**: €240 / 10 bus = **€24/bus/anno** (solo operativi)

### Confronto Alternative

| Soluzione | Costo Setup | Costo Annuale | Note |
|-----------|-------------|---------------|------|
| **Sistema Custom (questo progetto)** | €19,000 | €240 | Pieno controllo |
| GPS Tracker Hardware (Teltonika) | €1,500 (10×€150) | €600 (10×€5/mese SIM) | No UI custom |
| SaaS Fleet Tracking (es. Samsara) | €0 | €3,000-5,000 | Vendor lock-in |

**ROI**: Sistema custom si ripaga in 4-5 anni vs hardware dedicato, immediato vs SaaS.

---

## 14. DEPLOYMENT ULTRA-SEMPLIFICATO

### One-Command Deploy

```bash
# deploy.sh
#!/bin/bash

# Variabili
SERVER="user@your-vps-ip"

# Build locale
docker-compose build

# Push images a registry (opzionale, o copia diretta)
scp -r ./* $SERVER:/opt/bustracker/

# SSH ed avvia
ssh $SERVER << 'EOF'
  cd /opt/bustracker
  docker-compose down
  docker-compose up -d
  docker-compose logs -f
EOF
```

**Tempo deploy**: <5 minuti

### Gestione Via Portainer (Optional)

**Portainer Community Edition** (free):
- Web UI per gestire Docker containers
- No command line necessario
- Deploy/restart/logs via browser

```bash
# Installa Portainer sul VPS
docker volume create portainer_data
docker run -d -p 9000:9000 \
  --name portainer --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce
```

Accedi: `https://your-vps-ip:9000`

---

## 15. RACCOMANDAZIONI FINALI (10 BUS)

### Architettura Consigliata

✅ **VPS Singolo 4vCPU/8GB** (€10-15/mese)
✅ **Docker Compose monolith** (API+WS stesso container)
✅ **PostgreSQL + Redis stesso VPS**
✅ **Frontend statici via NGINX** (no SSR)
✅ **Capacitor TWA per PWA** (background location affidabile)
✅ **Google Maps Free Tier** (sotto 28k loads/mese)
✅ **Grafana Cloud Free** (monitoring)
✅ **Backup locale + Google Drive sync** (€0)

### Non Implementare (Over-Engineering per 10 bus)

❌ Kubernetes / Docker Swarm
❌ Load balancer (NGINX reverse proxy sufficiente)
❌ Separate WebSocket server
❌ Database partitioning
❌ Redis Cluster
❌ Prometheus + Grafana self-hosted (usa Cloud)
❌ Multi-region deployment
❌ Advanced CDN (CloudFlare Free sufficiente)

### Priorità Sviluppo

1. **Settimana 1-2**: Backend core + DB + PWA base
2. **Settimana 3-4**: Console CRUD semplice + Maps integration
3. **Settimana 5-6**: Monitoring frontend + WebSocket
4. **Settimana 7**: Capacitor build + field test (3 bus)
5. **Settimana 8**: Bug fix + deploy production + rollout graduale

**Go-Live**: 8 settimane (vs 10 originali)

---

## 16. CHECKLIST DECISIONALE

Prima di iniziare sviluppo, conferma:

- [ ] Budget approvato: €19k setup + €20/mese operativi
- [ ] VPS provider scelto (raccomandato: Hetzner CX31 - 4vCPU/8GB @ €10/mese)
- [ ] Google Maps API key creata (budget alert a €10/mese)
- [ ] Team disponibile: 2 FTE per 8 settimane
- [ ] 3 dispositivi Android disponibili per field test
- [ ] Stakeholder allineati su timeline 8 settimane
- [ ] Piano rollout graduale: 3 bus (week 7) → 6 bus (week 8) → 10 bus (week 9)

---

## CONCLUSIONE

Con **10 bus invece di 100**, il progetto diventa:

- **83% più economico** (€20/mese vs €130/mese operativi)
- **20% più veloce** (8 settimane vs 10 settimane)
- **Molto più semplice** (no scaling complexity)
- **Stesso livello di affidabilità** (Capacitor TWA garantisce 96%)

L'architettura proposta nei documenti 01-06 rimane valida, ma con significative semplificazioni che riducono costi e complessità senza compromettere funzionalità.

**Raccomandazione Finale**: Procedere con architettura semplificata (VPS monolith + Docker Compose). Scalabile se futuro crescita flotta.
