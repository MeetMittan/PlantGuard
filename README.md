# PlantGuard AI 🌿

**An offline-first plant & leaf health journal with secure Google Gemini AI analysis.**
Photograph a leaf, get high-accuracy plant health assessments powered by **Google Gemini API** via a lightweight **Node.js Express backend**, review cautious observations with actionable care guidance, and manage your daily plant-care streak — with full offline journal capabilities when away from signal.

- 🔒 **Private & Secure:** `GEMINI_API_KEY` stays strictly on the server and is never exposed to the client or browser bundles. Photos are only transmitted when you explicitly tap "Analyse with Gemini AI". No GPS coordinates or unrelated journal data are sent to AI.
- ⚡ **Lightweight & Battery-Friendly:** Eliminates heavy client-side ONNX/SmolVLM models (0 MB download on user devices in default Gemini mode), preventing mobile browser hangs, RAM saturation, and thermal throttling.
- 📴 **Offline-First Journal:** Observations, plants, garden timelines, care tasks, streaks, and map spots are stored locally in IndexedDB. Save photos instantly while offline; analyse them whenever you return online.
- 🤝 **Honest AI:** Results are framed cautiously with visible symptoms, possible causes, limitations, and practical low-risk care steps — never fabricated certainty or guaranteed cures.
- 🔄 **Modular Provider Architecture:** Supports `gemini` (production default via Express), `demo` (deterministic mock for CI/E2E), and `transformersjs` (legacy on-device SmolVLM).

## Features

- **Dashboard** — greeting, model/service status, scan shortcut, observation & streak stats, weekly activity chart, today's checklist, recent scans. All numbers come from stored data.
- **Scanner** — live camera (`getUserMedia`) or photo picker, preview & retake, client-side resizing & compression, optional observation note, secure Gemini analysis with multi-step progress and cancel, structured result, save (photo and location optional) or save without analysis.
- **History** — list/grid, search, condition and date filters, sorting, incremental loading, detail view with notes editing, delete with confirmation.
- **My Garden** — plants with species, cover photo, care preferences, linked observations, in-app watering/check-up reminders, archive/delete.
- **Care & streaks** — daily goal, typed tasks, idempotent completion, current/best streak, calendar, weekly summary, milestone celebrations.
- **Nature Explorer** — Leaflet map with saved places and observation points, user-initiated location, list + detail panel, works as a list offline, visible OSM attribution.
- **Settings** — theme, AI backend readiness, storage usage, permissions guidance, validated ZIP/JSON backup & import, clear history / all data, privacy disclosures.
- **PWA** — installable, precached app shell, update prompt, offline navigation.

## Getting started

### 1. Configure Backend (.env)
```bash
cd server
cp .env.example .env
# Edit server/.env and provide your GEMINI_API_KEY from Google AI Studio
# Default model: gemini-3.8-flash (or gemini-2.0-flash)
npm install
npm run dev      # Starts Express backend on http://localhost:3001
```

### 2. Configure & Start Frontend
In a separate terminal from project root:
```bash
npm install
cp .env.example .env    # Optional (defaults connect to http://localhost:3001/api)
npm run dev             # Starts Vite frontend on http://localhost:5173
```

Open http://localhost:5173, complete onboarding, and start journaling or scanning leaves!

> The service worker is only active in production builds. To test PWA/offline behaviour:
> `npm run build && npm run preview` → http://localhost:4173

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development Vite frontend server (`http://localhost:5173`) |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checking for frontend |
| `npm test` | Unit + component tests (Vitest) |
| `npm run check` | Run full lint + typecheck + test + build pipeline |
| `npm run server:dev` | Start Express backend in watch mode (`http://localhost:3001`) |
| `npm run server:build` | Compile Express backend TypeScript to `server/dist/` |
| `npm run server:start` | Run compiled Express backend in production mode |
| `npm run server:typecheck` | Type-check server code (`tsc --noEmit`) |
| `npm run server:test` | Run server unit & API route tests (Vitest) |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run icons` | Regenerate PWA icons |

Details: [docs/TESTING.md](docs/TESTING.md).

## Configuration

- **Frontend configuration:** Optional, public and build-time (`VITE_*`). Stored in root `.env`. Never put API keys here.
- **Backend configuration:** Server secrets stored in `server/.env` (git-ignored). Contains `GEMINI_API_KEY`, `GEMINI_MODEL`, `PORT`, and `CLIENT_ORIGIN`.
See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## The AI Architecture

- **Primary Provider (`gemini`):** Routes requests to Google Gemini multimodal vision models (`gemini-3.8-flash`, `gemini-2.0-flash`) via the Express backend. Delivers fast, accurate plant health analysis with structured schema extraction while protecting device battery and RAM.
- **Demo Provider (`demo`):** Deterministic mock provider for automated tests, offline development, and CI environments without network dependencies.
- **Legacy Provider (`transformersjs`):** On-device SmolVLM-500M / SmolVLM-256M running via Transformers.js and ONNX Web Worker (available as an optional fallback).

Read [docs/AI_MODEL.md](docs/AI_MODEL.md) and [docs/AI_PROMPTS.md](docs/AI_PROMPTS.md).

## Installing the app

- **Android / desktop Chrome & Edge:** menu → *Install app*.
- **iPhone / iPad (Safari):** Share → *Add to Home Screen*.

## Offline behaviour

Works offline after the first visit: every screen, your data, care tracking, export/import, and
AI analysis **if the model download finished**. Needs internet: first visit, model download, map
tiles, app updates. Browsers can evict storage under pressure; the app re-checks and tells you.
See [docs/OFFLINE_PWA.md](docs/OFFLINE_PWA.md).

## Maps

OpenStreetMap tiles by default (attribution always shown; subject to the
[OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). Location is only
requested when you press a location button. No offline basemap. See
[docs/MAPS_AND_GEOLOCATION.md](docs/MAPS_AND_GEOLOCATION.md).

## Deployment

Static hosting — Cloudflare Pages recommended (build `npm run build`, output `dist`); GitHub Pages
supported with `VITE_BASE_PATH`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Documentation

[docs/README.md](docs/README.md) indexes everything: requirements, architecture (with diagram),
AI model and prompts, database schema, offline/PWA, maps, environment, security & privacy, UI/UX,
testing, deployment, troubleshooting, roadmap and ADRs.

## Licence

MIT (see [LICENSE](LICENSE)); third-party models, components and fixtures keep their own licences.

## Final verification and production hosting

See [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) for measured results and incomplete requirements. The shared data model is documented in [ASSESSMENT_SCHEMA.md](docs/ASSESSMENT_SCHEMA.md) and [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md). Plant timelines retain assessment history and compare deterministic symptom sets.

Netlify is supported: root netlify.toml builds with npm run build and publishes dist with an SPA rewrite. All environment values are optional public build-time settings, listed in .env.example. No secrets or AI keys are needed. [Production guide](docs/PRODUCTION.md) includes every supported variable, Netlify steps, Cloudflare Pages fallback and post-deploy checks.
