# PlantGuard AI — Authentication & Security Architecture

PlantGuard AI implements an enterprise-grade, multi-tenant authentication architecture designed for zero-trust API protection, progressive web application (PWA) resilience, and complete isolation between users.

---

## 1. Core Principles

1. **Defense in Depth:** Passwords are never stored in plaintext and are hashed using memory-hard Argon2id.
2. **Short-Lived Access Tokens:** Stateless JWT access tokens expire in 15 minutes, limiting the window of exposure if intercepted.
3. **Rotated Refresh Tokens:** Long-lived refresh tokens (7 days) are tracked in the database and rotated on every exchange.
4. **Multi-Tenant Isolation:** Every data entity belongs to an `ownerId`. Middleware injects `req.userId`, and database operations strictly enforce ownership to prevent Insecure Direct Object Reference (IDOR) vulnerabilities.
5. **Seamless Offline-First Transition:** Anonymous users can explore and scan plants in guest mode using local IndexedDB. Upon logging in, local entries can sync seamlessly to their account.

---

## 2. Password Hashing with Argon2id

Passwords are protected using **Argon2id**, the winner of the Password Hashing Competition (PHC) and the OWASP gold standard for resisting GPU/ASIC cracking attacks.

### Argon2id Configuration (`server/src/lib/crypto.ts`)
```typescript
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
    hashLength: 32,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

---

## 3. Token Strategy & Lifecycle

### 3.1 Token Pairs

| Token | Validity | Transport | Payload | Storage Location |
|---|---|---|---|---|
| **Access Token** | 15 Minutes | `Authorization: Bearer <token>` header | `{ sub: userId, role, email }` | In-memory client state |
| **Refresh Token** | 7 Days | `httpOnly`, `SameSite=Lax`, `Secure` Cookie or JSON | `{ sub: userId, sessionId }` | MongoDB `AuthSession` collection |

### 3.2 Token Rotation Workflow

```
Client                  Express API               MongoDB
  |                          |                       |
  |--- POST /auth/refresh -->|                       |
  |    (Cookie / Body)       |--- Verify JWT ------->|
  |                          |--- Lookup Session --->|
  |                          |    (Check revoked)    |
  |                          |<-- Valid Session -----|
  |                          |                       |
  |                          |--- Delete Old Session |
  |                          |--- Create New Session |
  |                          |                       |
  |<- 200 OK + New Pair -----|                       |
  |   (Rotated Cookie)       |                       |
```

- When a refresh token is used, the backend deletes the old session and creates a new one with a newly signed refresh token.
- If an old or revoked refresh token is presented, the server rejects the request immediately with `401 Unauthorized` and instructs the client to log in again.

---

## 4. Multi-Tenant Owner Isolation (IDOR Defense)

To prevent cross-tenant data leakage, the backend strictly scopes all CRUD operations by `ownerId: req.userId`:

```typescript
// Example: Safe Mongoose query preventing IDOR
export async function getPlantById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  
  // NEVER: Plant.findById(id)
  // ALWAYS scope by ownerId:
  const plant = await Plant.findOne({ _id: id, ownerId: req.userId });
  
  if (!plant) {
    throw new AppServerError('NOT_FOUND', 'Plant not found or access denied', 404);
  }
  
  res.json({ plant });
}
```

Shared resources (such as observations shared between connections) explicitly verify mutual connection acceptance in the `ObservationShare` and `UserConnection` collections before returning data.

---

## 5. Client-Side Axios 401 Retry Queue

The frontend maintains an in-memory access token in `client/src/lib/api/client.ts`. If an API request fails with `401 Unauthorized`:

1. The first failed request initiates a refresh call via `POST /api/v1/auth/refresh`.
2. Subsequent simultaneous requests are added to an internal promise queue without triggering multiple redundant refresh requests.
3. Once the refresh token request succeeds, the queue is drained and all queued requests are replayed with the new access token.
4. If the refresh request fails (e.g., session expired), the user is gracefully transitioned to unauthenticated state and prompted to log in.

```typescript
// client/src/lib/api/client.ts
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const { accessToken } = await refreshTokens();
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        authEvents.emit('logout');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 6. Pre-Seeded Development Accounts

For rapid testing and review, the database seeder (`npm run db:seed`) provides pre-configured testing accounts:

- **Primary Demo User:** `demo@plantguard.internal` / `PlantGuardDemo123!`
- **Connected Friend:** `flora@plantguard.internal` / `PlantGuardDemo123!`
- The frontend **Sign In modal** includes a **"Fill Demo Account"** button for instant one-click login.

