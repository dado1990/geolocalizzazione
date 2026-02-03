# Development Dockerfile
FROM node:20-alpine

WORKDIR /app

# Installa dependencies di sistema per PostgreSQL client
RUN apk add --no-cache postgresql-client

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm install --no-audit --no-fund

# Copia codice sorgente
COPY . .

# Esponi porte
EXPOSE 3000 3001

# Comando di sviluppo (con hot reload)
CMD ["npm", "run", "dev"]
