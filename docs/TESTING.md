# PlantGuard AI — Testing & Verification Guide

PlantGuard AI uses a unified testing strategy across both workspaces using **Vitest**, **Testing Library**, **Supertest**, and **fake-indexeddb**.

---

## 1. Test Command Matrix

All commands can be executed from the repository root:

| Command | Workspace | Target | Framework |
|---|---|---|---|
| `npm run test` | Monorepo | All tests across client & server | Vitest |
| `npm run client:test` | `client` | Client components, stores, hooks, sync | Vitest + Testing Library + jsdom |
| `npm run server:test` | `server` | Server endpoints, auth, security, storage | Vitest + Supertest |
| `npm run typecheck` | Monorepo | Full TypeScript verification | TypeScript (`tsc`) |
| `npm run check` | Monorepo | Typecheck + test + build pipeline | Concurrently |
| `npm run db:check` | `server` | MongoDB connectivity check | Mongoose ping |

---

## 2. Server Test Suite (`server/src/test/`)

Server tests use **Supertest** to test Express routes without binding to physical network ports:

### 2.1 Covered Scenarios
- **Health Probes:** Verifies `/api/v1/health` and `/api/health` return HTTP 200 with service status.
- **AI Diagnostics:**
  - `GET /api/v1/ai/status` returns availability without exposing API keys.
  - `POST /api/v1/ai/analyze` validates image payload, rejects non-image inputs with 400, and returns structured diagnosis.
  - Simulated provider failures return proper 502/503 status codes.
- **Authentication Flows:**
  - Registration with Argon2id hashing.
  - Login with valid credentials and rejection of invalid passwords.
  - Refresh token rotation (verifying old tokens become invalidated).
  - Logout and session clearance.
- **Authorization & IDOR Scoping:**
  - Verifies that requests without `Authorization: Bearer` are rejected with 401.
  - Verifies that User A cannot read or modify User B's plants or observations (404/403).
- **Security & Storage:**
  - File upload MIME validation (rejects `.exe`, `.html`, accepts `.webp`, `.jpg`).
  - Directory traversal prevention in `/api/v1/storage/files/:filename`.
  - Rate limiter enforcement.

### Running Server Tests:
```bash
npm --prefix server run test
```

---

## 3. Client Test Suite (`client/src/`)

Client tests execute in a simulated browser environment powered by **jsdom** and **fake-indexeddb**:

### 3.1 Covered Scenarios
- **Scanner & AI:**
  - Model status detection and switching.
  - Image capture, preview, and structured diagnostic rendering.
  - Camera permission denial and fallback to file upload.
  - Offline diagnosis queueing.
- **Garden & Observations:**
  - Adding, editing, and archiving plants.
  - Observation timeline filtering by condition (`healthy`, `attention`, `critical`).
  - Editing notes and confirming deletions.
- **Care Tasks & Streaks:**
  - Daily watering checklist rendering.
  - Idempotent task completion (preventing duplicate counts for the same day).
  - Streak calculation and calendar edge-case handling.
- **Nature Explorer:**
  - Leaflet map rendering with OpenStreetMap attribution.
  - Ensuring zero geolocation API calls occur without user button click.
- **Social Features:**
  - Sending and accepting connection requests.
  - Sharing observations with friends via `ShareModal`.
  - Notifications inbox badge count and read status toggling.

### Running Client Tests:
```bash
npm --prefix client run test
```

---

## 4. Pre-Commit / Pre-Deployment Full Check

Before pushing code or deploying releases, execute the full check pipeline:

```bash
npm run check
```
This runs:
1. `npm --prefix client run typecheck`
2. `npm --prefix server run typecheck`
3. `npm --prefix server run test`
4. `npm --prefix client run test`
5. `npm --prefix client run build`
6. `npm --prefix server run build`

All steps must succeed with exit code `0`.
