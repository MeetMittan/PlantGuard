# PlantGuard AI — API Specification

The PlantGuard AI Express backend exposes a comprehensive RESTful API under `/api/v1` designed for secure multi-tenant plant health journaling, Google Gemini AI image diagnostics, delta offline synchronization, social connections, and community sharing.

---

## 1. Global Conventions

### 1.1 Base URL & Content Negotiation
- **Base URL:** `/api/v1` (with legacy compatibility aliases for `/api/health` and `/api/ai/*`)
- **Format:** All request bodies and responses are `application/json; charset=utf-8` unless uploading multipart files to `/api/v1/storage/upload` or streaming files from `/api/v1/storage/files/:filename`.
- **Date/Time:** ISO 8601 strings (e.g., `2026-10-11T12:00:00.000Z`).

### 1.2 Authentication Headers
Authenticated endpoints require a valid JWT Access Token passed in the standard `Authorization` header:
```http
Authorization: Bearer <access_token>
```
For token refresh, the client provides the refresh token either as an HTTP-only secure cookie named `refreshToken` or in the request JSON body `{ "refreshToken": "<token>" }`.

### 1.3 Error Response Schema
All errors return consistent JSON payloads with structured error codes:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided.",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

#### Standard Error Codes:
| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body, query parameter, or file validation failed |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired access token |
| `FORBIDDEN` | 403 | Authenticated user lacks permission for this resource |
| `NOT_FOUND` | 404 | Target resource does not exist |
| `CONFLICT` | 409 | Duplicate unique key (e.g. email already registered) |
| `PAYLOAD_TOO_LARGE` | 413 | Image or payload exceeds allowed limit (10MB) |
| `RATE_LIMITED` | 429 | Exceeded IP or user tier request rate limit |
| `AI_PROVIDER_ERROR`| 502 / 503 | Gemini Vision API error or capacity limitation |
| `INTERNAL_ERROR` | 500 | Unhandled internal server error |

---

## 2. API Endpoints

### 2.1 Health Check (`/api/v1/health`)

#### `GET /api/v1/health`
Lightweight health probe (suitable for container orchestrators and load balancers).
- **Auth:** Public
- **Alias:** `/api/health`
- **Response 200:**
```json
{
  "status": "ok",
  "service": "plantguard-backend",
  "timestamp": "2026-10-11T12:00:00.000Z"
}
```

#### `GET /api/v1/health/detailed`
Detailed system health report including MongoDB connection status and uptime.
- **Auth:** Public
- **Response 200:**
```json
{
  "status": "ok",
  "service": "plantguard-backend",
  "timestamp": "2026-10-11T12:00:00.000Z",
  "uptime": 3600.25,
  "database": {
    "connected": true,
    "readyState": 1
  },
  "gemini": {
    "configured": true,
    "model": "gemini-3.8-flash"
  }
}
```

---

### 2.2 Authentication (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
Create a new user account with Argon2id password hashing and automatic session creation.
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "gardener@example.com",
  "password": "SecurePassword123!",
  "displayName": "Flora Smith"
}
```
- **Response 201:** Sets `refreshToken` HTTP-only cookie.
```json
{
  "user": {
    "id": "670900000000000000000001",
    "email": "gardener@example.com",
    "displayName": "Flora Smith",
    "role": "user",
    "isEmailVerified": false
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 900
}
```

#### `POST /api/v1/auth/login`
Authenticate user credentials and start an active session.
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "gardener@example.com",
  "password": "SecurePassword123!"
}
```
- **Response 200:** Sets `refreshToken` cookie.
```json
{
  "user": {
    "id": "670900000000000000000001",
    "email": "gardener@example.com",
    "displayName": "Flora Smith",
    "role": "user"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 900
}
```

#### `POST /api/v1/auth/refresh`
Rotate JWT refresh token and issue a fresh access token (15-minute validity).
- **Auth:** Public (requires refresh token in cookie or body)
- **Request Body (Optional if cookie set):**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```
- **Response 200:** Rotates `refreshToken` cookie.
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 900
}
```

#### `POST /api/v1/auth/logout`
Revoke the current refresh token session and clear the auth cookie.
- **Auth:** Requires Auth or valid Refresh Token
- **Response 200:** Clears `refreshToken` cookie.
```json
{
  "message": "Logged out successfully"
}
```

#### `POST /api/v1/auth/logout-all`
Revoke all active sessions for the authenticated user across all devices.
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "message": "All sessions revoked successfully"
}
```

#### `GET /api/v1/auth/me`
Retrieve currently authenticated user profile and active session context.
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "user": {
    "id": "670900000000000000000001",
    "email": "gardener@example.com",
    "displayName": "Flora Smith",
    "avatarUrl": null,
    "role": "user",
    "isEmailVerified": false,
    "createdAt": "2026-10-11T10:00:00.000Z"
  }
}
```

---

### 2.3 Users (`/api/v1/users`)

#### `GET /api/v1/users/me`
Retrieve full account details and settings for the authenticated user.
- **Auth:** Required (`Bearer`)

#### `PATCH /api/v1/users/me`
Update profile information (display name, bio, preferences).
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "displayName": "Flora S.",
  "bio": "Urban balcony gardener in Berlin",
  "avatarUrl": "/api/v1/storage/files/avatar-123.jpg"
}
```

#### `GET /api/v1/users/search?q=:query`
Search public user profiles by display name or email prefix to send connection requests.
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "users": [
    {
      "id": "670900000000000000000002",
      "displayName": "Botanical Bob",
      "avatarUrl": null
    }
  ]
}
```

---

### 2.4 Plants (`/api/v1/plants`)

#### `GET /api/v1/plants`
List all plants owned by the authenticated user with optional filters.
- **Auth:** Required (`Bearer`)
- **Query Params:**
  - `species`: filter by botanical or common name substring
  - `tag`: filter by assigned tag
  - `isArchived`: boolean (`true` / `false`, default `false`)
  - `limit`: number (default 50)
  - `page`: number (default 1)
- **Response 200:**
```json
{
  "plants": [
    {
      "id": "670900000000000000000010",
      "ownerId": "670900000000000000000001",
      "name": "Monstera Deliciosa",
      "species": "Monstera deliciosa",
      "room": "Living Room",
      "acquiredDate": "2025-06-01T00:00:00.000Z",
      "photoUrl": "/api/v1/storage/files/plant-1.jpg",
      "tags": ["indoor", "foliage"],
      "isArchived": false,
      "createdAt": "2026-10-11T10:00:00.000Z",
      "updatedAt": "2026-10-11T10:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}
```

#### `POST /api/v1/plants`
Create a new plant profile in the user's garden.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "name": "Fiddle Leaf Fig",
  "species": "Ficus lyrata",
  "room": "Office",
  "notes": "Prefers bright indirect light",
  "tags": ["indoor", "tree"]
}
```

#### `GET /api/v1/plants/:id`
Get plant details by ID (enforces owner isolation).
- **Auth:** Required (`Bearer`)

#### `PATCH /api/v1/plants/:id`
Update plant details.
- **Auth:** Required (`Bearer`)

#### `DELETE /api/v1/plants/:id`
Soft or hard delete a plant and detach associated care tasks.
- **Auth:** Required (`Bearer`)

---

### 2.5 Observations (`/api/v1/observations`)

#### `GET /api/v1/observations`
Query historical leaf observations and diagnosis records.
- **Auth:** Required (`Bearer`)
- **Query Params:** `plantId`, `condition` (`healthy` | `attention` | `critical`), `startDate`, `endDate`, `limit`, `page`.

#### `POST /api/v1/observations`
Save a new plant diagnostic observation with AI findings.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "plantId": "670900000000000000000010",
  "imageUrl": "/api/v1/storage/files/leaf-obs-1.jpg",
  "condition": "attention",
  "summary": "Early signs of powdery mildew on upper leaves.",
  "symptoms": ["White powdery spots", "Slight leaf curl"],
  "recommendations": ["Improve air circulation", "Apply organic neem oil solution"],
  "notes": "Spotted after 3 humid rainy days.",
  "confidenceScore": 0.88,
  "capturedAt": "2026-10-11T11:00:00.000Z"
}
```

#### `GET /api/v1/observations/:id`
Retrieve detailed assessment and image references.
- **Auth:** Required (`Bearer`)

#### `PATCH /api/v1/observations/:id`
Update gardener notes, verified diagnosis, or resolved status.
- **Auth:** Required (`Bearer`)

#### `DELETE /api/v1/observations/:id`
Delete an observation record.
- **Auth:** Required (`Bearer`)

---

### 2.6 AI Vision Diagnostic (`/api/v1/ai`)

#### `GET /api/v1/ai/status`
Check Gemini AI configuration status and active model.
- **Auth:** Public
- **Alias:** `/api/ai/status`
- **Response 200:**
```json
{
  "available": true,
  "model": "gemini-3.8-flash",
  "provider": "google-gemini",
  "rateLimit": {
    "windowMinutes": 1,
    "maxRequests": 30
  }
}
```

#### `POST /api/v1/ai/analyze`
Analyze a leaf or plant photograph using Google Gemini Vision AI.
- **Auth:** Optional / Authenticated (Higher rate limit for authenticated users)
- **Alias:** `/api/ai/analyze`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "context": {
    "plantSpecies": "Monstera deliciosa",
    "indoor": true,
    "wateringFrequencyDays": 7,
    "userNotes": "Leaves showing brown crispy edges"
  }
}
```
- **Response 200:**
```json
{
  "result": {
    "plantName": "Swiss Cheese Plant (Monstera deliciosa)",
    "identifiedSpecies": "Monstera deliciosa",
    "condition": "attention",
    "confidenceScore": 0.92,
    "summary": "Mild leaf scorch and low ambient humidity symptoms.",
    "symptoms": [
      "Crispy brown leaf margins",
      "Slight chlorosis on lower mature foliage"
    ],
    "possibleCauses": [
      "Low relative humidity (<40%)",
      "Direct scorching midday sunlight",
      "Mineral buildup from tap water"
    ],
    "recommendations": [
      "Move 1-2 meters back from direct southern window exposure",
      "Use distilled or rainwater if tap water is heavily chlorinated",
      "Maintain ambient humidity above 50%"
    ],
    "urgency": "medium"
  },
  "metadata": {
    "model": "gemini-3.8-flash",
    "latencyMs": 1420,
    "timestamp": "2026-10-11T12:05:00.000Z"
  }
}
```

---

### 2.7 Care & Reminders (`/api/v1/care`)

#### `GET /api/v1/care/tasks`
List recurring plant care tasks (watering, fertilizing, misting, repotting, pruning).
- **Auth:** Required (`Bearer`)
- **Query Params:** `plantId`, `type`, `activeOnly`

#### `POST /api/v1/care/tasks`
Schedule a new recurring care routine.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "plantId": "670900000000000000000010",
  "type": "water",
  "title": "Water Monstera",
  "frequencyDays": 7,
  "nextDueDate": "2026-10-18T09:00:00.000Z"
}
```

#### `POST /api/v1/care/completions`
Mark a care task as completed for a specific calendar date (idempotent).
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "taskId": "670900000000000000000050",
  "plantId": "670900000000000000000010",
  "completedAt": "2026-10-11T09:30:00.000Z",
  "notes": "Added half-strength organic fertilizer"
}
```

#### `GET /api/v1/care/streaks`
Calculate current gardening activity streak, longest streak, and completion statistics.
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "currentStreak": 14,
  "longestStreak": 32,
  "totalCompletions": 86,
  "lastCompletedDate": "2026-10-11"
}
```

---

### 2.8 Nature Explorer & Maps (`/api/v1/maps`)

#### `GET /api/v1/maps/places`
Retrieve saved foraging locations, community gardens, or wild plant spots.
- **Auth:** Required (`Bearer`)
- **Query Params:** `isPublic` (boolean), `bounds` (`minLat,minLng,maxLat,maxLng`)

#### `POST /api/v1/maps/places`
Save a new geo-tagged point of botanical interest.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "title": "Wild Blackberry Bush",
  "description": "Thriving bramble along the canal trail",
  "latitude": 52.520008,
  "longitude": 13.404954,
  "isPublic": false,
  "tags": ["wild", "foraging", "berries"]
}
```

---

### 2.9 Social Connections (`/api/v1/connections`)

#### `GET /api/v1/connections`
Retrieve mutual friends, pending incoming requests, and outgoing sent requests.
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "connections": [
    {
      "id": "670900000000000000000002",
      "displayName": "Flora Smith",
      "email": "flora@plantguard.internal",
      "connectedSince": "2026-10-10T12:00:00.000Z"
    }
  ],
  "incomingRequests": [],
  "outgoingRequests": []
}
```

#### `POST /api/v1/connections/request`
Send a connection invite to another user by ID or email.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "targetUserId": "670900000000000000000002",
  "message": "Let's share plant propagation tips!"
}
```

#### `POST /api/v1/connections/respond`
Accept or decline an incoming connection request.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "requestId": "670900000000000000000070",
  "action": "accept"
}
```

#### `DELETE /api/v1/connections/:userId`
Remove a mutual connection.
- **Auth:** Required (`Bearer`)

---

### 2.10 Observation Sharing (`/api/v1/sharing`)

#### `POST /api/v1/sharing/observations`
Share a diagnostic observation with a connected gardening friend.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "observationId": "670900000000000000000030",
  "recipientUserId": "670900000000000000000002",
  "message": "Check out this strange variegation pattern on my pothos!"
}
```

#### `GET /api/v1/sharing/observations/shared-with-me`
View observations shared with the authenticated user by their connections.
- **Auth:** Required (`Bearer`)

---

### 2.11 Notifications (`/api/v1/notifications`)

#### `GET /api/v1/notifications`
Retrieve unread and recent activity alerts (connection invites, shares, care reminders).
- **Auth:** Required (`Bearer`)
- **Response 200:**
```json
{
  "notifications": [
    {
      "id": "670900000000000000000080",
      "type": "connection_accepted",
      "title": "New Connection",
      "message": "Flora Smith accepted your connection request.",
      "isRead": false,
      "createdAt": "2026-10-11T10:15:00.000Z"
    }
  ],
  "unreadCount": 1
}
```

#### `PATCH /api/v1/notifications/:id/read`
Mark an individual notification as read.
- **Auth:** Required (`Bearer`)

#### `POST /api/v1/notifications/mark-all-read`
Mark all pending notifications as read.
- **Auth:** Required (`Bearer`)

---

### 2.12 Delta Sync Engine (`/api/v1/sync`)

#### `POST /api/v1/sync`
Bidirectional delta sync endpoint between client IndexedDB outbox and MongoDB.
- **Auth:** Required (`Bearer`)
- **Request Body:**
```json
{
  "lastSyncedAt": "2026-10-11T09:00:00.000Z",
  "changes": [
    {
      "entity": "observations",
      "action": "create",
      "data": {
        "localId": "dexie-obs-99",
        "plantId": "670900000000000000000010",
        "condition": "healthy",
        "summary": "New leaf unfurled cleanly",
        "capturedAt": "2026-10-11T10:30:00.000Z"
      }
    }
  ]
}
```
- **Response 200:**
```json
{
  "syncedAt": "2026-10-11T12:00:00.000Z",
  "acceptedCount": 1,
  "serverChanges": {
    "plants": [],
    "observations": [],
    "careTasks": []
  }
}
```

---

### 2.13 Storage & File Uploads (`/api/v1/storage`)

#### `POST /api/v1/storage/upload`
Upload an image file (JPEG, PNG, WebP) with strict MIME validation, filename hashing, and directory traversal defense.
- **Auth:** Required (`Bearer`)
- **Content-Type:** `multipart/form-data`
- **Form Field:** `file` (Max 10MB)
- **Response 201:**
```json
{
  "file": {
    "filename": "f3d993db-c82b-48e8.webp",
    "url": "/api/v1/storage/files/f3d993db-c82b-48e8.webp",
    "mimeType": "image/webp",
    "size": 348210
  }
}
```

#### `GET /api/v1/storage/files/:filename`
Stream a stored image file with secure path resolution preventing path traversal.
- **Auth:** Public
- **Response:** Binary image stream with accurate `Content-Type` header and aggressive caching headers (`Cache-Control: public, max-age=31536000, immutable`).

