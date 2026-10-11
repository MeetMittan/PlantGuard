# Environment configuration

Copy `.env.example` to `.env` (git-ignored). All variables are **optional** and validated at
startup by `src/app/config.ts` (the only module that reads `import.meta.env`). Invalid values
stop the app with an explicit "PlantGuard could not start" message listing the problem.

> **Every `VITE_*` value is public.** Vite inlines them into JavaScript that anyone can read.
> Never put API secrets, tokens, database credentials, service-role keys or private keys in
> these variables. The MVP needs no secrets at all.

**When changes take effect:** all variables are read at **build time** (`npm run build` or when
`npm run dev` starts). Changing them on a hosting dashboard requires a new deployment. Runtime
choices made by users (model preset, CPU/GPU, theme, daily goal, photo/location defaults) are in
the Settings screen and stored in IndexedDB.

### Frontend Client Variables (`.env`)

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `VITE_APP_NAME` | `PlantGuard AI` | No | Name in the UI and PWA manifest. |
| `VITE_DEFAULT_LOCALE` | `en-IN` | No | BCP 47 locale for dates/numbers. Validated with `Intl`. |
| `VITE_BASE_PATH` | `/` | No | Sub-path the app is served from (e.g. `/plantguard-ai/` for GitHub Pages). Used for asset URLs, router basename, manifest `start_url`/`scope`. |
| `VITE_AI_PROVIDER` | `gemini` | No | `gemini` = server-backed Google Gemini API (recommended). `demo` = mock provider. `transformersjs` = legacy on-device model. |
| `VITE_API_BASE_URL` | *(empty → `/api` proxy)* | No | Base URL for the Express API. In production, set to your backend origin (e.g. `https://api.plantguard.example.com`). Leave empty in local dev to use Vite proxy. |
| `VITE_ENABLE_DEMO_MODE` | `false` | Only with `demo` | Must be `true` for `VITE_AI_PROVIDER=demo`; a persistent banner marks demo builds. |
| `VITE_AI_MAX_IMAGE_DIMENSION` | `768` | No | Longest edge (px, 256–2048) for client-side preprocessed/uploaded photos. |
| `VITE_AI_MAX_NEW_TOKENS` | `160` | No | Cap on generated tokens per answer (used for local models). |
| `VITE_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No | Raster tile URL template. |
| `VITE_MAP_ATTRIBUTION` | OSM attribution (default URL only) | **Yes** if `VITE_MAP_TILE_URL` is changed | Visible map attribution (HTML links allowed). |
| `VITE_MAP_MAX_ZOOM` | `19` | No | Max zoom (capped at 19 for the OSM service). |
| `VITE_ENABLE_GEOLOCATION` | `true` | No | `false` hides all location features. |

### Backend Server Variables (`server/.env`)

These variables are **private server secrets** loaded by the Express backend. Never expose these to Vite or the browser!

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `PORT` | `3001` | No | Port on which the Express backend server listens. |
| `GEMINI_API_KEY` | *(none)* | **Yes** for online scans | Google Gemini API key from [Google AI Studio](https://aistudio.google.dev/). |
| `GEMINI_MODEL` | `gemini-3.8-flash` | No | Gemini multimodal model identifier (e.g. `gemini-3.8-flash`, `gemini-2.0-flash`). |
| `CLIENT_ORIGIN` | `http://localhost:5173` | No | Allowed CORS origin(s), comma-separated. Set to your production frontend domain. |
| `RATE_LIMIT_MAX` | `30` | No | Maximum requests per IP window. |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15m) | No | Time window in milliseconds for rate limiting. |
| `MAX_UPLOAD_MB` | `10` | No | Maximum uploaded image size limit in MB (enforced by Multer). |
| `REQUEST_TIMEOUT_MS` | `30000` (30s) | No | Request timeout for outbound Gemini API calls. |

`npm run verify:model` checks the effective model configuration against the Hugging Face Hub
(repo exists, not gated, Idefics3/SmolVLM architecture, every ONNX file for the dtype map exists,
total size) without downloading weights.

## Variables deliberately not used

The original brief listed `VITE_APP_VERSION`, `VITE_ENABLE_NEARBY_DISCOVERY`, `VITE_ENABLE_ANALYTICS`,
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They are **not** part of this MVP:

- App version comes from `package.json` (`__APP_VERSION__` define) — one source of truth.
- Nearby discovery, analytics and cloud sync are not implemented, so flags for them would be
  dead configuration (see [ROADMAP.md](ROADMAP.md)).

## Examples

GitHub Pages project site:

```env
VITE_BASE_PATH=/plantguard-ai/
```

Demo build for screenshots/E2E (never deploy as a real AI app):

```env
VITE_AI_PROVIDER=demo
VITE_ENABLE_DEMO_MODE=true
```

Custom tile provider:

```env
VITE_MAP_TILE_URL=https://tiles.example.com/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=© Example Maps © OpenStreetMap contributors
```
