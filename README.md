# Bus Tracker System - Progetto di Tracciamento Autobus in Tempo Reale

Sistema completo per il tracciamento GPS in tempo quasi-reale di flotte autobus con webapp di monitoraggio, console amministrativa e PWA Android per l'invio automatico delle posizioni.

## Panoramica

Questo progetto implementa una soluzione end-to-end per il tracking di autobus che include:

- **PWA Android**: App mobile installabile sui dispositivi a bordo autobus per invio automatico posizione GPS ogni 2 minuti
- **Console Admin**: Interfaccia web desktop per gestione flotta, linee, percorsi e fermate
- **Monitoring Frontend**: Dashboard real-time con Google Maps per visualizzare posizioni autobus live
- **Backend API**: Server Node.js con PostgreSQL+PostGIS e Redis per gestione dati e real-time updates

## Documentazione Completa

Tutta la documentazione tecnica è disponibile nella cartella [`/docs`](./docs/):

### 📋 Documenti Principali

1. **[Executive Summary](./docs/00-executive-summary.md)** - Panoramica progetto, decisioni architetturali, timeline e costi
2. **[Architettura e Stack](./docs/01-architecture.md)** - Component diagram, scelte tecnologiche motivate, data flow
3. **[API Specification](./docs/02-api-specification.md)** - OpenAPI 3.0 completa con esempi payload e WebSocket events
4. **[Database Schema](./docs/03-database-schema.md)** - DDL PostgreSQL+PostGIS, indexes, views, functions e migrations
5. **[UI Flows & Wireframes](./docs/04-ui-flows-wireframes.md)** - Flussi utente e wireframe testuali per PWA, Console e Monitoring
6. **[Deployment Plan](./docs/05-deployment-plan.md)** - Docker, CI/CD, NGINX config, monitoring e operational checklist
7. **[PWA Background Location](./docs/06-pwa-background-location-risks.md)** - Analisi rischi e mitigazioni per geolocation in background

## Quick Start

### Prerequisiti

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ con PostGIS
- Redis 7+
- Google Maps API Key

### Setup Locale

```bash
# Clone repository
git clone https://github.com/your-org/bus-tracker.git
cd bus-tracker

# Setup environment variables
cp .env.example .env
# Edita .env con le tue credenziali

# Avvia infrastruttura con Docker Compose
docker-compose up -d

# Verifica servizi
docker-compose ps

# API Health Check
curl http://localhost:3000/health
```

### Struttura Progetto (Monorepo)

```
geolocalizzazione/
├── docs/                       # Documentazione completa
├── backend/                    # API Server (Node.js + TypeScript)
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database models (Prisma/TypeORM)
│   │   └── workers/           # Background jobs
│   └── Dockerfile
├── console-frontend/           # Console Admin (Next.js)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── Dockerfile
├── monitor-frontend/           # Monitoring Dashboard (React)
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── Dockerfile
├── pwa/                        # PWA Android (React + Capacitor)
│   ├── src/
│   ├── android/               # Native Android wrapper
│   └── capacitor.config.json
├── docker-compose.yml          # Orchestrazione locale
├── nginx/                      # Reverse proxy config
└── scripts/                    # Utility scripts (backup, migrations)
```

## Stack Tecnologico

### Frontend
- React 18 + TypeScript
- Next.js 14 (Console Admin)
- Capacitor (PWA → Native Android)
- Google Maps JavaScript API
- Socket.io-client (real-time)
- Tailwind CSS + shadcn/ui

### Backend
- Node.js 20 + Express/Fastify
- TypeScript
- Socket.io (WebSocket server)
- BullMQ (background jobs)
- Prisma/TypeORM (ORM)

### Database & Cache
- PostgreSQL 15 + PostGIS (geospatial)
- Redis 7 (cache, queue, pub/sub)
- MinIO/S3 (object storage)

### DevOps
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- NGINX (reverse proxy, SSL, rate limiting)
- Prometheus + Grafana (monitoring)
- Let's Encrypt (SSL certificates)

## Features Principali

### PWA Android (Dispositivi a Bordo)
- ✅ Geolocation automatica ogni 2 minuti
- ✅ Background tracking con Foreground Service
- ✅ Coda offline con retry automatico
- ✅ Throttling intelligente (invio solo se movimento >50m)
- ✅ Battery optimization
- ✅ Anti-replay protection (nonce + timestamp)

### Console Admin
- ✅ Gestione flotta autobus (CRUD)
- ✅ Gestione linee e percorsi
- ✅ Creazione percorsi via drag-drop su Google Maps
- ✅ Gestione fermate con geocoding
- ✅ Associazione dispositivo ↔ autobus ↔ linea
- ✅ Audit log completo

### Monitoring Frontend
- ✅ Mappa live con marker autobus
- ✅ Aggiornamento real-time via WebSocket
- ✅ Fallback polling (120s) se WS disconnesso
- ✅ Filtri per linea e stato (online/offline)
- ✅ Info window dettagliata su marker
- ✅ Responsive (desktop + mobile)

### Backend
- ✅ RESTful API completa (OpenAPI spec)
- ✅ WebSocket server per real-time updates
- ✅ Background workers (offline detection, cleanup)
- ✅ Rate limiting per endpoint
- ✅ JWT authentication (device + user)
- ✅ Database geospaziale (PostGIS queries)

## Timeline Implementazione

- **Settimane 1-4**: Backend + Console Admin
- **Settimane 5-6**: Monitoring Frontend + WebSocket
- **Settimane 7-9**: PWA Android + Capacitor
- **Settimana 10**: Deploy Production + Rollout

**Go-Live stimato**: 10 settimane dall'inizio sviluppo

## Costi Stimati

### Setup Iniziale (One-Time)
- Sviluppo completo: €23,500
- Infra setup: incluso

### Operativi Mensili (100 bus)
- VPS Hosting: €70/mese
- Google Maps API: €50/mese
- Backup & Storage: €10/mese
- **Totale**: ~€130/mese

## Requisiti di Sistema

### Server Production
- CPU: 8 vCPU
- RAM: 16GB
- Storage: 200GB SSD
- OS: Ubuntu 22.04 LTS

### Dispositivi Android
- Android 8.0+ (API 26)
- GPS con accuratezza <20m
- 4G/LTE
- Batteria >3000 mAh (raccomandato collegato a corrente)

## Sicurezza

- TLS 1.3 (Let's Encrypt)
- JWT authentication con scadenza
- Rate limiting per API
- Anti-replay protection
- RBAC (Admin, Operator, Device)
- Audit logging completo
- GDPR compliant (data retention policies)

## Monitoraggio

- Prometheus + Grafana dashboards
- Health checks endpoint
- Uptime monitoring
- Alert system (Slack/PagerDuty integration)
- Metrics:
  - API latency (p95 target: <200ms)
  - Database query time (p95: <50ms)
  - WebSocket connections
  - Bus offline count

## Testing

### Unit & Integration Tests
```bash
cd backend
npm test
npm run test:coverage
```

### E2E Tests
```bash
cd monitor-frontend
npm run test:e2e
```

### Field Testing
- 10 dispositivi eterogenei
- 8 ore turno continuo
- Metriche: affidabilità invii, consumo batteria, accuratezza GPS

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style
- ESLint + Prettier per TypeScript
- Conventional Commits
- Test coverage >80%

## Deployment

### Staging
```bash
git push origin develop
# GitHub Actions auto-deploy to staging
```

### Production
```bash
git push origin main
# GitHub Actions deploy to production (requires approval)
```

Vedere [Deployment Plan](./docs/05-deployment-plan.md) per dettagli completi.

## Support

- **Documentazione**: [/docs](./docs/)
- **Issues**: GitHub Issues
- **Email**: support@bustracker.example.com

## License

[MIT License](LICENSE) - vedere file LICENSE per dettagli

## Team

Progetto progettato e specificato da:
- **Claude Sonnet 4.5** - Senior Full-Stack Engineer + Product Architect

## Changelog

### v1.0.0 (2026-02-03)
- Progettazione architetturale completa
- Documentazione tecnica prodotta
- Specifica API OpenAPI
- Database schema PostgreSQL+PostGIS
- UI flows e wireframe
- Deployment plan e CI/CD
- Analisi rischi PWA background location

---

**Status Progetto**: 📋 Design Phase Completed - Ready for Development

**Prossimo Step**: Kickoff meeting con stakeholder → Approvazione budget → Sprint 1 start
