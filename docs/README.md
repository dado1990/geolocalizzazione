# Bus Tracker System - Documentazione Tecnica

Questa cartella contiene tutta la documentazione tecnica completa del progetto Bus Tracker.

## Indice Documenti

### 📊 [00. Executive Summary](./00-executive-summary.md)
**Cosa contiene**:
- Panoramica completa del progetto
- Decisioni architetturali chiave (PWA vs Nativa, Database, Real-time)
- Timeline implementazione (10 settimane)
- Costi stimati (setup + ricorrenti)
- Rischi e mitigazioni
- Criteri di accettazione
- Team raccomandato

**Per chi**: Stakeholder, Project Manager, Decision Maker

---

### 🏗️ [01. Architettura e Stack Tecnologico](./01-architecture.md)
**Cosa contiene**:
- Component diagram dettagliato
- Stack tecnologico completo (Frontend, Backend, Data, Infra)
- Scelte architetturali motivate (Node.js, PostgreSQL+PostGIS, Redis, Capacitor)
- Data flow (invio posizione, visualizzazione mappa, creazione percorso)
- Sicurezza (auth, transport, API, GDPR)
- Scalabilità (vertical → horizontal, partitioning, read replicas)
- Resilienza e disaster recovery
- Performance targets
- Costi infrastrutturali stimati

**Per chi**: System Architect, Tech Lead, DevOps Engineer

---

### 🔌 [02. API Specification (OpenAPI 3.0)](./02-api-specification.md)
**Cosa contiene**:
- Specifica OpenAPI 3.0 completa
- Endpoints:
  - Auth (login, refresh token)
  - Device (registration)
  - Telemetry (location invio/storico)
  - Fleet (live positions)
  - CRUD: Buses, Lines, Routes, Stops, Users
- Schemas completi (Device, Location, Bus, Line, Route, Stop, User)
- Esempi payload request/response dettagliati
- WebSocket events (connection, subscribe, location_update, bus_status)
- Rate limiting headers
- Error codes completi

**Per chi**: Backend Developer, Frontend Developer, QA Tester

---

### 🗄️ [03. Database Schema e Migrations](./03-database-schema.md)
**Cosa contiene**:
- DDL completo PostgreSQL + PostGIS
- Custom types (ENUM per role, status, direction, provider)
- Tabelle:
  - users, devices, buses, lines, routes, stops
  - route_stops (junction table)
  - locations (partitioned by month)
  - last_positions (cache)
  - audit_logs, nonces
- Indexes ottimizzati (geospatial GIST, composite)
- Views (v_fleet_status, v_route_details)
- Functions (detect_offline_buses, calculate_distance, find_nearest_stop)
- Triggers (auto-update timestamp, audit log, geom point)
- Partitioning strategy (locations per mese)
- Sample data
- Maintenance scripts (partition creation, cleanup, vacuum)
- Migration scripts (TypeScript examples)
- Backup strategy

**Per chi**: Database Administrator, Backend Developer

---

### 🎨 [04. UI Flows e Wireframe Testuali](./04-ui-flows-wireframes.md)
**Cosa contiene**:
- **PWA Android**:
  - Primo avvio e registrazione
  - Dashboard principale (stato, ultima posizione, statistiche)
  - Impostazioni (tracking config, notifiche)
  - Gestione offline (queue sync)
  - Notifica foreground service
- **Console Admin**:
  - Layout principale (sidebar navigation)
  - Gestione flotta (tabella bus, filtri, CRUD)
  - Modal creazione/modifica autobus
  - Creazione percorso (mappa interattiva, fermate)
  - Flow associazione dispositivo → autobus
- **Monitoring Frontend**:
  - Layout desktop (mappa + lista)
  - Layout mobile responsive
  - Info window marker
  - Flow filtraggio per linea
  - Stato connessione WebSocket
- Interazioni chiave (background geolocation, bulk operations, alert offline)
- Responsive breakpoints
- Accessibility (WCAG 2.1 AA)
- Performance optimizations
- Error states

**Per chi**: UI/UX Designer, Frontend Developer, Product Owner

---

### 🚀 [05. Deployment Plan e Checklist Operativa](./05-deployment-plan.md)
**Cosa contiene**:
- Deployment strategy (Dev, Staging, Production)
- Infrastruttura target (VPS self-hosted vs Cloud managed)
- Dockerfiles (API, Frontend)
- Docker Compose completo (PostgreSQL, Redis, API, WebSocket, Worker, Frontends, NGINX)
- NGINX configuration (reverse proxy, load balancing, SSL, rate limiting, per-endpoint routing)
- CI/CD pipeline GitHub Actions (lint, test, build, deploy staging/production)
- Database migrations strategy
- Secrets management (Docker secrets, Vault, environment variables)
- SSL/TLS certificates (Let's Encrypt + auto-renewal)
- Monitoring stack (Prometheus + Grafana + Alertmanager)
- Backup & disaster recovery (automated backups, RTO/RPO, restore procedure)
- Operational checklists:
  - Pre-deployment
  - Post-deployment
  - Daily operations
  - Weekly/monthly maintenance
- Scaling plan (Phase 1→2→3)
- Troubleshooting guide (common issues + solutions)
- Runbook (start/stop services, logs, console, migrations)
- Contacts & escalation

**Per chi**: DevOps Engineer, Site Reliability Engineer, Operations Team

---

### ⚠️ [06. PWA Background Location: Rischi e Mitigazioni](./06-pwa-background-location-risks.md)
**Cosa contiene**:
- Analisi dettagliata limitazioni PWA Android (schermo spento, Doze Mode, browser throttling)
- Stima affidabilità:
  - PWA pura: 25% ❌
  - PWA + Wake Lock: 90% ⚠️
  - Capacitor TWA: 96% ✅
  - App Nativa: 98% ✅
- **Opzione 1**: PWA + Workarounds (Wake Lock, Notification hack)
- **Opzione 2**: Capacitor + Trusted Web Activity (RACCOMANDATO)
  - Architettura ibrida
  - Implementazione step-by-step (install, config, TypeScript code, AndroidManifest)
  - Build APK
  - Deployment (Play Store, MDM, direct download)
  - Pro e contro
- **Opzione 3**: App Nativa Kotlin (quando considerarla)
- Matrice decisionale comparativa
- Piano implementazione graduale (Fase 1→2→3→4)
- Testing plan (test cases, field testing)
- Contingency plan (fallback mode, dispositivi dedicati, hardware GPS esterno)
- Checklist pre-produzione
- Conclusioni e raccomandazioni finali
- Riferimenti tecnici (plugin, docs, case studies)

**Per chi**: Mobile Developer, Tech Lead, Product Owner

---

## Come Navigare la Documentazione

### Se sei un Decision Maker / Stakeholder
1. Inizia da: **[00. Executive Summary](./00-executive-summary.md)**
2. Approfondisci rischi critici: **[06. PWA Background Location](./06-pwa-background-location-risks.md)**
3. Review costi e timeline: **[00. Executive Summary - Sezione Costi](./00-executive-summary.md#costi-stimati)**

### Se sei un Backend Developer
1. **[02. API Specification](./02-api-specification.md)** - contratto API
2. **[03. Database Schema](./03-database-schema.md)** - data model
3. **[01. Architettura](./01-architecture.md)** - data flow e scelte tecniche
4. **[05. Deployment Plan](./05-deployment-plan.md)** - Docker setup

### Se sei un Frontend Developer
1. **[04. UI Flows](./04-ui-flows-wireframes.md)** - wireframe e flussi
2. **[02. API Specification](./02-api-specification.md)** - endpoint e payload
3. **[06. PWA Background Location](./06-pwa-background-location-risks.md)** (se lavori su PWA)

### Se sei un DevOps / SRE
1. **[05. Deployment Plan](./05-deployment-plan.md)** - infra, CI/CD, monitoring
2. **[01. Architettura](./01-architecture.md)** - component diagram, scaling
3. **[03. Database Schema](./03-database-schema.md)** - backup, maintenance

### Se sei un QA Tester
1. **[04. UI Flows](./04-ui-flows-wireframes.md)** - scenari test
2. **[02. API Specification](./02-api-specification.md)** - test API
3. **[00. Executive Summary - Criteri Accettazione](./00-executive-summary.md#criteri-di-accettazione)**

---

## Stato Documentazione

- ✅ **Completo**: Tutti i deliverable richiesti prodotti
- ✅ **Revisionato**: Coerenza cross-document verificata
- ✅ **Pronto per Review**: Stakeholder approval ready
- 📅 **Versione**: 1.0 (2026-02-03)
- 👤 **Autore**: Claude Sonnet 4.5 (Senior Full-Stack Engineer + Product Architect)

---

## Prossimi Step Suggeriti

1. **Kickoff Meeting**: Presentare Executive Summary agli stakeholder
2. **Decision**: Approvare budget e stack tecnologico
3. **Setup Repository**: Inizializzare monorepo con struttura definita
4. **Sprint Planning**: Definire Sprint 1 tasks da Timeline (Settimane 1-2)
5. **Team Assembly**: Reclutare core team (3.5 FTE)
6. **Environment Setup**: Provisioning VPS staging + Google Maps API key

---

## Domande Frequenti

**Q: Posso usare solo PWA senza Capacitor?**
A: No. L'affidabilità sarebbe solo 25% (vedi doc 06). Capacitor TWA è mandatorio per >90% affidabilità.

**Q: Quanto costa Google Maps API?**
A: ~€50/mese per 100 bus (vedi doc 00, sezione Costi). Budget alerts configurabili.

**Q: Serve PostgreSQL o basta MongoDB?**
A: PostgreSQL+PostGIS è critico per query geospaziali efficienti (ST_Distance, ST_Within). MongoDB sarebbe meno performante.

**Q: Posso scalare oltre 500 bus?**
A: Sì. L'architettura supporta scaling orizzontale (vedi doc 01, sezione Scalabilità).

**Q: Il sistema è GDPR compliant?**
A: Sì. Retention policies (90 giorni), audit log, right to access implementati (vedi doc 01, sezione Privacy).

---

## Contribuire alla Documentazione

Se trovi errori o vuoi suggerire miglioramenti:
1. Apri Issue su GitHub
2. Oppure: Pull Request con modifiche proposte
3. Mantieni consistenza formato Markdown e struttura esistente

---

## Licenza Documentazione

[MIT License](../LICENSE) - stessa licenza del codice progetto
