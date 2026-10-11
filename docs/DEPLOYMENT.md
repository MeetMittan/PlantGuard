# PlantGuard AI — Production Deployment Guide

PlantGuard AI is structured as an npm monorepo with two primary deployable workspaces:
1. **Frontend Client (`client/`):** React 19 + TypeScript + Vite Progressive Web Application (PWA).
2. **Backend Server (`server/`):** Node.js 22+ Express REST API with MongoDB and Google Gemini AI.

---

## 1. System Requirements & Prerequisites

- **Node.js:** v22.0.0 or higher.
- **npm:** v10.0.0 or higher (supports npm workspaces).
- **Database:** MongoDB v6.0+ (Community, Enterprise, or MongoDB Atlas replica set).
- **AI Credentials:** Google Gemini API Key with access to `gemini-3.8-flash`.

---

## 2. Environment Variables

### 2.1 Server Environment (`server/.env`)
Copy `server/.env.example` to `server/.env`:

```ini
# Server Networking
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://plantguard.example.com

# Database Connection (MongoDB)
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/plantguard_ai?retryWrites=true&w=majority

# Authentication Secrets (generate with `openssl rand -hex 64`)
JWT_SECRET=your_production_access_token_secret_here
JWT_REFRESH_SECRET=your_production_refresh_token_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google Gemini Vision AI
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash

# Logging
LOG_LEVEL=info
```

### 2.2 Client Environment (`client/.env`)
Copy `client/.env.example` to `client/.env`:

```ini
# Production API Base URL (leave blank if frontend is served behind reverse proxy /api route)
VITE_API_BASE_URL=https://api.plantguard.example.com
```

---

## 3. Build & Pre-Flight Verification

Run the unified monorepo verification pipeline from the repository root:

```bash
# 1. Install dependencies across all workspaces
npm install

# 2. Run typecheck, unit tests, and production builds
npm run check

# 3. Ensure MongoDB indexes and migrations are applied
npm --prefix server run db:indexes
npm --prefix server run db:migrate
```

---

## 4. Deployment Architectures

### Architecture A: Modern Cloud PaaS (Recommended)
- **Frontend PWA:** Host `client/dist/` on Vercel, Netlify, or Cloudflare Pages.
  - Set build command: `npm --prefix client run build`
  - Output directory: `client/dist`
  - Configure SPA fallback routing (`/*` -> `/index.html`).
- **Backend API:** Deploy `server/` to Render, Railway, Fly.io, or Google Cloud Run.
  - Set build command: `npm --prefix server run build`
  - Start command: `node server/dist/server.js`
  - Health check path: `/api/v1/health`
- **Database:** MongoDB Atlas (M0 Free tier or dedicated cluster).

---

### Architecture B: Docker & Docker Compose

A complete production `docker-compose.yml` configuration:

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    restart: always
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    restart: always
    environment:
      - PORT=3000
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/plantguard_ai
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GEMINI_MODEL=gemini-3.8-flash
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - CLIENT_ORIGIN=https://plantguard.example.com
    depends_on:
      - mongodb
    ports:
      - "3000:3000"

  client:
    build:
      context: .
      dockerfile: client/Dockerfile
    restart: always
    ports:
      - "80:80"
      - "443:443"

volumes:
  mongo_data:
```

---

## 5. Health Probes & Monitoring

Configure container orchestrators and load balancers to use these probe endpoints:

- **Liveness Probe:** `GET /api/v1/health`
  - Returns HTTP 200 `{ "status": "ok" }` when the Express process is responsive.
- **Readiness Probe:** `GET /api/v1/health/detailed`
  - Returns HTTP 200 only if MongoDB connection `readyState === 1` and critical subsystems are healthy.
