# PlantGuard AI — Database Architecture & Mongoose Schema Reference

PlantGuard AI uses **MongoDB exclusively with Mongoose ODM**. There is **zero Prisma and zero PostgreSQL** in the architecture. This provides flexible document storage for plant diagnosis metadata while maintaining strict schema validation, compound indexing, and transactional integrity.

---

## 1. Connection & Lifecycle Management

Database connection logic is managed in `server/src/db/connection.ts`.

- **Default URI:** `mongodb://127.0.0.1:27017/plantguard_ai` (configured via `MONGODB_URI` environment variable).
- **Pool Size:** Configured with a default pool size of 10 connections.
- **Graceful Shutdown:** Subscribed to `SIGINT` and `SIGTERM` signals to cleanly drain active queries and close connections.
- **Verification Script:** `npm run db:check` performs a quick diagnostic ping without launching the HTTP server.

---

## 2. Model Reference

### 2.1 Core Identity & Sessions

#### `User` (`server/src/models/User.ts`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key | User identifier |
| `email` | String | Required, Unique, Lowercase | User email address |
| `passwordHash` | String | Required | Argon2id password hash |
| `displayName` | String | Required | Public display name |
| `avatarUrl` | String | Optional | URL to profile picture |
| `bio` | String | Optional | Bio text (max 500 chars) |
| `role` | String | Default: `'user'` | Role (`user` or `admin`) |
| `isEmailVerified` | Boolean | Default: `false` | Email verification flag |
| `preferences` | Object | Optional | UI preferences (theme, units) |

#### `AuthSession` (`server/src/models/AuthSession.ts`)
Tracks active device logins and refresh token lifecycle.
- **Indexes:** `{ userId: 1, expiresAt: 1 }`, TTL index on `expiresAt`.

---

### 2.2 Plant Journaling & Diagnostics

#### `Plant` (`server/src/models/Plant.ts`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key | Plant identifier |
| `ownerId` | ObjectId | Required, Index | Owning user (`User` reference) |
| `name` | String | Required | Plant nickname (e.g. "Monty") |
| `species` | String | Optional, Index | Botanical or common species |
| `room` | String | Optional | Location in home/garden |
| `acquiredDate`| Date | Optional | Date acquired |
| `photoUrl` | String | Optional | Primary showcase photo |
| `notes` | String | Optional | General care notes |
| `tags` | [String] | Index | Custom taxonomy tags |
| `isArchived` | Boolean | Default: `false` | Archive flag for deceased/gifted plants |

**Compound Indexes:**
- `{ ownerId: 1, isArchived: 1, createdAt: -1 }`
- `{ ownerId: 1, species: 1 }`

#### `Observation` (`server/src/models/Observation.ts`)
Stores AI and manual health diagnostic logs.
| Field | Type | Attributes | Description |
|---|---|---|---|
| `_id` | ObjectId | Primary Key | Observation identifier |
| `ownerId` | ObjectId | Required, Index | Owning user ID |
| `plantId` | ObjectId | Optional, Index | Linked `Plant` ID |
| `imageUrl` | String | Required | Path to captured leaf image |
| `condition` | String | Enum: `healthy`, `attention`, `critical` | Overall health rating |
| `summary` | String | Required | Diagnostic summary |
| `symptoms` | [String] | Default: `[]` | List of observed symptoms |
| `possibleCauses` | [String] | Default: `[]` | AI-detected potential issues |
| `recommendations` | [String] | Default: `[]` | Suggested treatments |
| `confidenceScore`| Number | Min 0, Max 1 | AI confidence metric |
| `capturedAt` | Date | Default: `Date.now` | Capture timestamp |
| `notes` | String | Optional | User follow-up notes |

**Compound Index:**
- `{ ownerId: 1, plantId: 1, capturedAt: -1 }`

---

### 2.3 Care Routines & Streaks

#### `CareTask` (`server/src/models/CareTask.ts`)
Recurring task definitions.
- **Fields:** `ownerId`, `plantId`, `type` (`water`, `fertilize`, `mist`, `repot`, `prune`, `clean`, `rotate`, `check`), `title`, `frequencyDays`, `nextDueDate`, `isActive`.
- **Compound Index:** `{ ownerId: 1, isActive: 1, nextDueDate: 1 }`.

#### `CareCompletion` (`server/src/models/CareCompletion.ts`)
Idempotent daily task completion events.
- **Unique Compound Index:** `{ taskId: 1, completedAt: 1 }` ensures double-clicking or re-submitting on the same day never duplicates completion entries.

---

### 2.4 Nature Explorer & Mapping

#### `SavedPlace` (`server/src/models/SavedPlace.ts`)
Geo-tagged botanical locations.
- **Fields:** `ownerId`, `title`, `description`, `latitude`, `longitude`, `isPublic`, `tags`.
- **Compound Index:** `{ latitude: 1, longitude: 1 }`, `{ ownerId: 1, isPublic: 1 }`.

---

### 2.5 Social, Sharing & Notifications

#### `ConnectionRequest` & `UserConnection`
- Manages bi-directional friend connections with mutual acceptance.
- Unique compound indexes prevent duplicate pending requests.

#### `ObservationShare`
- Grants explicit read access to specific observations between connected users.

#### `Notification`
- Real-time and asynchronous alerts for connection requests, observation shares, and care reminders.
- Compound Index: `{ recipientId: 1, isRead: 1, createdAt: -1 }`.

#### `SyncChange`
- Outbox delta tracking for offline synchronization between client IndexedDB and server.

---

## 3. Database Management Scripts

All database tasks are accessible via root and server workspace scripts:

### Check Database Connectivity
```bash
npm run db:check
# or: npm --prefix server run db:check
```
Pings MongoDB to ensure the server can connect and authenticate.

### Ensure Indexes
```bash
npm run db:indexes
# or: npm --prefix server run db:indexes
```
Creates all defined compound and unique indexes across all 15 Mongoose models.

### Seed Database
```bash
npm run db:seed
# or: npm --prefix server run db:seed
```
Seeds demo users (`demo@plantguard.internal`, `flora@plantguard.internal`), sample plants (Monstera, Fiddle Leaf Fig, Snake Plant), observations with AI diagnoses, and care tasks with completions.

### Run Migrations
```bash
npm run db:migrate
# or: npm --prefix server run db:migrate
```
Applies versioned migrations tracked in the `_migrations` MongoDB collection.

