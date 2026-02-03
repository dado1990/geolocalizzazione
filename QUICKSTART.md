# Quick Start - Bus Tracker Development

## Setup Iniziale (5 minuti)

### 1. Prerequisiti

Assicurati di avere installato:
- **Docker** e **Docker Compose**
- **Node.js 20+** (per development locale senza Docker)
- **Git**

### 2. Clone e Setup

```bash
# Il repository è già clonato, vai nella directory
cd geolocalizzazione

# Copia il file .env di esempio (già fatto)
# cp .env.example .env

# Modifica .env se necessario (opzionale per dev)
nano .env
```

### 3. Installa Dipendenze Backend

```bash
cd backend
npm install
cd ..
```

### 4. Avvia con Docker Compose

```bash
# Avvia tutti i servizi
docker-compose up

# Oppure in background
docker-compose up -d

# Vedi i logs
docker-compose logs -f
```

## Servizi Disponibili

Dopo l'avvio, i servizi saranno disponibili su:

- **Backend API**: http://localhost:3000
- **API Docs (Swagger)**: http://localhost:3000/docs
- **Console Admin**: http://localhost:5173 (non ancora implementata)
- **Monitoring Frontend**: http://localhost:5174 (non ancora implementata)
- **PWA**: http://localhost:5175 (non ancora implementata)
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Test Rapido

### Health Check

```bash
curl http://localhost:3000/health
```

Risposta attesa:
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T...",
  "uptime": 123.45
}
```

### WebSocket Test

```bash
# Con wscat (installa con: npm install -g wscat)
wscat -c ws://localhost:3000/ws

# Invia un messaggio
> hello
< Echo: hello
```

## Sviluppo Locale (senza Docker)

Se preferisci sviluppare senza Docker:

### Backend

```bash
cd backend
npm install
npm run dev
```

### Database e Redis

Devi comunque avviare PostgreSQL e Redis (puoi usare Docker solo per questi):

```bash
docker-compose up postgres redis -d
```

## Comandi Utili

```bash
# Stop tutti i servizi
docker-compose down

# Stop e rimuovi volumi (reset completo database)
docker-compose down -v

# Rebuild e riavvia
docker-compose up --build

# Vedi logs specifico servizio
docker-compose logs -f api
docker-compose logs -f postgres

# Accedi al container
docker exec -it bustracker_api sh
docker exec -it bustracker_postgres psql -U postgres -d bustracker

# Accedi a Redis CLI
docker exec -it bustracker_redis redis-cli -a redis123
```

## Prossimi Step

1. ✅ Setup base completato
2. 📝 Implementare schema database (migrations)
3. 📝 Creare API routes (device, telemetry, fleet)
4. 📝 Setup frontend React (console, monitor, PWA)
5. 📝 Implementare autenticazione JWT
6. 📝 WebSocket real-time per monitoring

## Struttura Progetto

```
geolocalizzazione/
├── backend/              # API Node.js + Fastify
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── models/      # Database models
│   │   ├── config/      # Configurazioni
│   │   └── index.ts     # Entry point
│   ├── Dockerfile
│   └── package.json
├── console-frontend/     # Console Admin (React)
├── monitor-frontend/     # Monitoring (React + Leaflet)
├── pwa/                  # PWA Android (React + Capacitor)
├── docs/                 # Documentazione completa
├── docker-compose.yml
├── .env
└── package.json
```

## Troubleshooting

### Porta già in uso

Se vedi errore "port already in use":

```bash
# Trova processo sulla porta
lsof -i :3000
lsof -i :5432

# Killa il processo
kill -9 <PID>

# Oppure cambia porta in .env
PORT=3001
```

### Docker build fallisce

```bash
# Pulisci tutto e riprova
docker-compose down -v
docker system prune -a
docker-compose up --build
```

### Database non inizializzato

```bash
# Reset completo database
docker-compose down postgres
docker volume rm geolocalizzazione_postgres_data
docker-compose up -d postgres

# Aspetta che sia pronto
docker-compose logs -f postgres
```

## Documentazione

Tutta la documentazione tecnica è in [docs/](./docs/):

- **[docs/00-executive-summary.md](docs/00-executive-summary.md)** - Panoramica progetto
- **[docs/01-architecture.md](docs/01-architecture.md)** - Architettura e stack
- **[docs/02-api-specification.md](docs/02-api-specification.md)** - API OpenAPI
- **[docs/03-database-schema.md](docs/03-database-schema.md)** - Schema DB
- **[docs/07-sizing-10-bus.md](docs/07-sizing-10-bus.md)** - Sizing per 10 bus
- **[docs/08-openstreetmap-vs-google-maps.md](docs/08-openstreetmap-vs-google-maps.md)** - Maps comparison

## Help

Problemi? Apri un issue o contatta il team.

---

**Status**: ✅ Setup base completato
**Next**: Implementare database schema e API endpoints
