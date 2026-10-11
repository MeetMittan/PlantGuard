# PlantGuard AI — Security Architecture & Production Hardening

PlantGuard AI implements an end-to-end defense-in-depth security model protecting user identity, plant health records, and cloud AI infrastructure.

---

## 1. Network & Transport Security

### 1.1 HTTP Security Headers (Helmet)
Configured in `server/src/app.ts` using `helmet`:
- **Cross-Origin-Resource-Policy:** Configured to `cross-origin` to allow safe image and PWA asset sharing while isolating origins.
- **X-Content-Type-Options:** `nosniff` prevents MIME-type sniffing exploits.
- **X-Frame-Options:** `DENY` prevents clickjacking attacks.
- **Strict-Transport-Security (HSTS):** Enforces HTTPS connections in production.

### 1.2 CORS Policy
Configured in `server/src/middleware/cors.ts`:
- **Origin Whitelist:** Strictly respects `CLIENT_ORIGIN` environment variable.
- **Credentials:** Supports secure cookie exchange (`credentials: true`).
- **Disallowed Origins:** Unauthorized cross-origin requests receive an immediate `403 Forbidden` response.

---

## 2. Rate Limiting Tiers

Configured in `server/src/middleware/rate-limiter.ts` using `express-rate-limit`:

| Tier | Endpoints | Window | Max Requests | Purpose |
|---|---|---|---|---|
| **General API** | `/api/v1/*` | 15 minutes | 300 | Prevents denial of service and API scrapers |
| **Authentication** | `/api/v1/auth/login`, `/register` | 15 minutes | 15 | Defends against brute-force password attacks |
| **AI Vision Diagnostic** | `/api/v1/ai/analyze` | 1 minute | 30 | Protects Google Gemini API quota and operational costs |

Rate limit headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) are sent with all responses.

---

## 3. Data Integrity & Input Validation

### 3.1 Strict Zod Schemas
Every endpoint validates incoming payloads against strongly-typed Zod schemas (`server/src/middleware/validate.ts`). Unrecognized fields are stripped or rejected.
- **Emails:** Normalized and validated against RFC-compliant formats.
- **Passwords:** Minimum 8 characters, checked for length and entropy.
- **UUIDs and ObjectIds:** Validated against 24-character hex formats before query execution.

### 3.2 Multi-Tenant Data Isolation (IDOR Defense)
- **Zero Cross-Tenant Leakage:** User data queries include `{ ownerId: req.userId }`.
- **Authorization Verification:** Social shares and collaborative gardens check membership records before returning entity documents.

---

## 4. Secure File Uploads & Storage Protection

File uploads are managed in `server/src/storage/index.ts` and `server/src/modules/storage`:
1. **MIME Sniffing Prevention:** Uploaded files must match allowed MIME types (`image/jpeg`, `image/png`, `image/webp`).
2. **Payload Size Limits:** Express and Multer enforce a maximum file size of 10MB.
3. **Randomized File Names:** Files are stored with cryptographically random UUID identifiers (`${crypto.randomUUID()}.${ext}`). Original user filenames are never used on disk.
4. **Directory Traversal Defense:** File serving endpoints resolve canonical absolute paths and verify that the target file resides strictly within the configured storage directory before streaming.

---

## 5. Zero-Secret Logging with Pino

Server-side logging uses **Pino** (`server/src/lib/logger.ts`) with automatic redaction:
- **Redaction Rules:**
  - `req.headers.authorization`
  - `req.headers.cookie`
  - `*.password`
  - `*.passwordHash`
  - `*.token`
  - `*.refreshToken`
  - `*.image` (large base64 image strings)
- Development mode uses **Pino-Pretty** for readable console streams.
- Production mode outputs structured JSON for ingestion by Datadog, CloudWatch, or Google Cloud Logging.

