# Architecture Overview

PlantGuard AI is structured as a modular client-server monorepo using npm workspaces.

```mermaid
graph TD
    Client["Client (React 19 + TypeScript + Vite + PWA)"] -->|IndexedDB (Dexie)| OfflineDB[("Local Storage")]
    Client -->|Axios REST /api/v1| Server["Server (Node.js 22 + Express)"]
    Server -->|Mongoose ODM| Mongo[("MongoDB (port 27017)")]
    Server -->|@google/genai SDK| Gemini["Google Gemini Vision API"]
    Server -->|Local FS Storage| Uploads["server/storage/uploads"]
```

## Workspaces Structure

```text
plantguard-ai/
├── client/                     # Frontend Progressive Web App
│   ├── src/
│   │   ├── app/                # App router, configuration, providers
│   │   ├── components/         # Reusable UI controls, layout, feedback
│   │   ├── features/           # Domain feature slices
│   │   │   ├── auth/           # Login, register, AuthContext, user profile
│   │   │   ├── scanner/        # Camera capture, image prep, AI scan
│   │   │   ├── history/        # Observations journal and detail view
│   │   │   ├── garden/         # Plants, care schedules, timelines
│   │   │   ├── care/           # Daily streaks, checklists, completions
│   │   │   ├── explorer/       # Leaflet maps and nature explorer
│   │   │   ├── connections/    # Social connections, requests, blocking
│   │   │   ├── sharing/        # Observation sharing feed and dialogs
│   │   │   └── notifications/  # Inbox alerts and notifications
│   │   ├── lib/api/            # Centralized Axios client with retry queue
│   │   ├── services/api/       # Typed domain API client services
│   │   ├── services/sync/      # Outbox synchronization engine
│   │   └── db/                 # Dexie IndexedDB local-first database
│   ├── public/                 # Static assets, web app manifest, icons
│   ├── vite.config.ts          # Vite build and /api proxy configuration
│   └── package.json            # Client workspace dependencies
│
├── server/                     # Backend API & AI Inference Service
│   ├── src/
│   │   ├── app.ts              # Express application setup and route mounting
│   │   ├── server.ts           # HTTP server bootstrapping and graceful shutdown
│   │   ├── config/             # Zod environment validation and settings
│   │   ├── database/           # MongoDB connection, migrations, indexes, seed
│   │   ├── lib/                # Pino logger, Argon2id crypto, JWT utilities
│   │   ├── middleware/         # Auth, validation, Multer upload, rate limiting, error handler
│   │   ├── models/             # Mongoose schemas and models
│   │   ├── modules/            # Domain route controllers
│   │   │   ├── auth/           # /api/v1/auth
│   │   │   ├── users/          # /api/v1/users
│   │   │   ├── plants/         # /api/v1/plants
│   │   │   ├── observations/   # /api/v1/observations
│   │   │   ├── ai/             # /api/v1/ai
│   │   │   ├── care/           # /api/v1/care
│   │   │   ├── maps/           # /api/v1/maps
│   │   │   ├── connections/    # /api/v1/connections
│   │   │   ├── sharing/        # /api/v1/sharing
│   │   │   ├── gardens/        # /api/v1/gardens
│   │   │   ├── notifications/  # /api/v1/notifications
│   │   │   ├── sync/           # /api/v1/sync
│   │   │   └── storage/        # /api/v1/storage
│   │   └── storage/            # Local filesystem file store
│   └── package.json            # Server workspace dependencies
│
├── docs/                       # Architecture, API, and deployment documentation
├── package.json                # Root orchestration scripts
└── .gitignore
```

## Key Architectural Principles

1. **Client-First Resilience**: All core journaling and offline reading functions run locally in IndexedDB using Dexie.js. The app functions without internet connectivity.
2. **Cloud AI Offloading**: Heavy vision AI computation is performed by Google Gemini via the Node.js backend. Client devices do not lag or drain battery running 2GB+ ONNX models.
3. **Multi-Tenant Data Isolation**: Every MongoDB query is strictly owner-scoped (`ownerId: req.userId`). Insecure Direct Object References (IDOR) are prevented by access control checks.
4. **Zero Prisma / Zero PostgreSQL**: The database layer is implemented entirely using MongoDB and Mongoose.
5. **Clean Monorepo Boundaries**: The frontend never directly imports backend files or accesses database secrets. All communication occurs over standard HTTP/REST.
