# PlantGuard AI — Offline-First Architecture & Delta Sync

PlantGuard AI is built from the ground up as a **local-first, offline-capable Progressive Web Application (PWA)**. Gardeners often work in backyards, remote greenhouses, or basements with poor cellular reception. PlantGuard AI ensures full app usability offline, followed by seamless background synchronization when connectivity returns.

---

## 1. High-Level Sync Architecture

```
+-------------------------------------------------------------+
|                      Client Browser / PWA                   |
|                                                             |
|  [ React UI Components ]                                    |
|          |                                                  |
|          v                                                  |
|  [ Dexie.js (IndexedDB) ] <---> [ Local Outbox / Sync Engine ]
|  (Instant Local Reads/Writes)             |                 |
+-------------------------------------------|-----------------+
                                            | HTTPS /api/v1/sync
                                            v (when online)
+-------------------------------------------------------------+
|                       Express Backend                       |
|                                                             |
|  [ Delta Sync Controller ] <---> [ MongoDB Collections ]    |
|  - Validates user ownership     - Plants                    |
|  - Resolves conflicts (LWW)     - Observations              |
|  - Idempotent task completion   - CareTasks / Completions   |
+-------------------------------------------------------------+
```

---

## 2. Client-Side Local Storage (Dexie.js)

The client uses **Dexie.js** as an abstraction over browser IndexedDB (`client/src/services/db/database.ts`):

- **Plants Store:** Cached list of user plants for offline browsing and search.
- **Observations Store:** Diagnostic history, including offline-captured photos and notes.
- **Care Tasks & Completions Store:** Daily checklist and care routine tracking.
- **Places Store:** Saved nature spots and GPS locations.
- **Outbox Store:** Queue of offline mutations waiting to be synced to the server.

---

## 3. The Delta Sync Engine (`syncEngine.ts`)

The sync engine handles bidirectional synchronization:

### 3.1 Push: Flushes Local Outbox to Server
1. The engine checks `navigator.onLine` and initiates sync on startup or when the `online` window event fires.
2. It aggregates all un-synced operations from the local outbox:
   ```typescript
   interface SyncDeltaRequest {
     lastSyncedAt: string | null;
     changes: Array<{
       entity: 'plants' | 'observations' | 'careTasks' | 'careCompletions';
       action: 'create' | 'update' | 'delete';
       data: any;
     }>;
   }
   ```
3. Sends the payload to `POST /api/v1/sync`.

### 3.2 Pull: Retrieves Server Updates Since `lastSyncedAt`
1. The server queries all records modified after `lastSyncedAt` where `ownerId === req.userId`.
2. The server responds with changes:
   ```json
   {
     "syncedAt": "2026-10-11T12:00:00.000Z",
     "acceptedCount": 3,
     "serverChanges": {
       "plants": [...],
       "observations": [...],
       "careTasks": [...]
     }
   }
   ```
3. The client applies incoming server updates to IndexedDB and clears the synced outbox records.

---

## 4. Schema Mapping Between Client & Server

Because Dexie and MongoDB models originated in different environments, the sync engine transparently maps field nomenclature:

| Entity | Client (Dexie IndexedDB) | Server (MongoDB / Mongoose) |
|---|---|---|
| **Location** | `lat`, `lng` | `latitude`, `longitude` |
| **Care Task Type** | `kind` | `type` |
| **Identifier** | `localId` (UUID string) | `_id` (ObjectId string) |

The sync engine handles bidirectional transformation in `client/src/services/sync/syncEngine.ts`.

---

## 5. Conflict Resolution Strategy

1. **Last-Write-Wins (LWW):** For editable fields (e.g. plant notes or nickname), the mutation with the highest timestamp prevails.
2. **Idempotent Care Completions:** Care tasks marked complete on the same calendar day use a unique compound index on the server (`{ taskId: 1, completedAt: 1 }`). Repeated sync flushes will never create duplicate streak completions.
3. **Optimistic Local UI:** All UI interactions update IndexedDB immediately, ensuring zero-latency user feedback. If the network is unavailable, an offline badge indicates changes are queued.

---

## 6. PWA Service Worker & Asset Caching

Configured via `vite-plugin-pwa` and Workbox (`client/vite.config.ts`):
- **Pre-cached:** All HTML, JS, CSS, and SVG application bundles.
- **Runtime Caching:** OpenStreetMap tiles cached using a `CacheFirst` strategy with a 30-day expiration window.
- **Network-Only:** All `/api/*` requests bypass the service worker to prevent stale data in API communications.

