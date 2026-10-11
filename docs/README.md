# PlantGuard AI Documentation

PlantGuard AI is an offline-first plant health journal and diagnostic companion. It combines client-side progressive web app (PWA) resilience with a high-performance Express backend powered by Google's Gemini Vision AI and MongoDB.

## Documentation Index

1. [Architecture Overview](file:///d:/PlantGuard/docs/ARCHITECTURE.md) - High-level monorepo design, data flow, client-server separation.
2. [API Reference](file:///d:/PlantGuard/docs/API.md) - Complete REST API specification (`/api/v1/*`), request/response schemas, error formats.
3. [Authentication & Authorization](file:///d:/PlantGuard/docs/AUTHENTICATION.md) - Argon2id password hashing, JWT access/refresh token rotation, session management, multi-tenant owner scoping.
4. [Database & Mongoose](file:///d:/PlantGuard/docs/DATABASE.md) - MongoDB schema models, indexes, migrations, and seed scripts.
5. [AI Vision Model & Inference](file:///d:/PlantGuard/docs/AI_MODEL.md) - Google Gemini Vision integration, prompt engineering, structured validation, rate limits, error fallbacks.
6. [Offline & Delta Sync](file:///d:/PlantGuard/docs/OFFLINE_SYNC.md) - Local-first IndexedDB (Dexie) storage, outbox change tracking, bidirectional delta synchronization.
7. [Maps & Privacy](file:///d:/PlantGuard/docs/MAPS_AND_PRIVACY.md) - Nature Explorer OpenStreetMap/Leaflet integration, location obfuscation, privacy controls.
8. [Security & Production Hardening](file:///d:/PlantGuard/docs/SECURITY.md) - Helmet, CORS policies, rate limiters, input sanitization, zero-secret logging with Pino.
9. [Deployment Guide](file:///d:/PlantGuard/docs/DEPLOYMENT.md) - Docker, Node.js production service, reverse proxies, environment variables.
10. [Testing & Verification](file:///d:/PlantGuard/docs/TESTING.md) - Unit tests, integration tests, E2E verification, database connectivity tests.
11. [Migration Guide](file:///d:/PlantGuard/docs/MIGRATION.md) - Step-by-step migration from on-device SmolVLM to Gemini cloud backend and monorepo structure.

## Quick Start

```bash
# Install dependencies across all workspaces
npm install

# Start both frontend and backend concurrently
npm run dev

# Run comprehensive checks across both workspaces
npm run check
```
