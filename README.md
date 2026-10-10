# PlantGuard AI 🌿

**An offline-first plant & leaf health journal with on-device AI.** Photograph a leaf, run an
open-weight vision-language model **locally in your browser**, review a cautious assessment, save
the observation and keep a daily plant-care streak — on a trail with no signal, too.

- 🔒 **Private:** photos never leave the device. No account, no backend, no analytics.
- 📴 **Offline-first:** after verified app/model/runtime caching, the app and saved data work offline. Verify a local offline scan on your device.
- 🤝 **Honest AI:** results are framed as estimates with visible signs, possible causes and
  limitations — never fabricated diagnoses or confidence scores.
- 💸 **Free to run:** static hosting; no paid AI, database, map or notification service required.

> ⚠️ The bundled models (SmolVLM 500M/256M) are **general-purpose** vision-language models, not
> trained on plant diseases. They describe visible symptoms reasonably well but often get plant and
> disease names wrong. See [docs/AI_MODEL.md](docs/AI_MODEL.md#measured-behaviour-honest-results).

## Screenshots

Captured from the demo build (`VITE_AI_PROVIDER=demo`), which simulates AI results for screenshots and tests:

| Dashboard (desktop) | Scan result (mobile) | Care & streaks (mobile, dark) |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard-desktop.png) | ![Scan result](docs/screenshots/scan-result-mobile.png) | ![Care](docs/screenshots/care-mobile-dark.png) |

## Features

- **Dashboard** — greeting, model/offline status, scan shortcut, observation & streak stats,
  weekly activity chart, today's checklist, recent scans. All numbers come from stored data.
- **Scanner** — live camera (getUserMedia) or photo picker, preview & retake, quality hints,
  optional name/context, on-device analysis with step progress and cancel, structured result,
  save (photo and location optional) or save without analysis.
- **History** — list/grid, search, condition and date filters, sorting, incremental loading,
  detail view with notes editing, delete with confirmation.
- **My Garden** — plants with species, cover photo, care preferences, linked observations,
  in-app watering/check-up reminders, archive/delete.
- **Care & streaks** — daily goal, typed tasks, idempotent completion, current/best streak,
  calendar, weekly summary, milestone celebrations. Rules: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md#care-streaks).
- **Nature Explorer** — Leaflet map with saved places and observation points, user-initiated
  location, list + detail panel, works as a list offline, visible OSM attribution.
- **Settings** — theme, model choice (500M / 256M lite), GPU/CPU, model download/delete,
  verified offline readiness, storage usage, permissions guidance, validated ZIP/JSON
  backup & import, clear history / all data, privacy and licences.
- **PWA** — installable, precached app shell, update prompt, offline navigation.

## Requirements

- Node.js **≥ 20.19** (22 or 24 recommended; `npm run verify:model` needs ≥ 22.18) and npm.
- A recent browser with Workers, WebAssembly, Cache API and IndexedDB. Chromium desktop is the automated verification target; physical phones, Firefox and Safari still require device checks. HTTPS (or `localhost`) for camera, storage and
  the service worker. WebGPU is optional.
- For AI: ≈200–350 MB free storage and ~1–1.5 GB free memory (default model).

## Getting started

```bash
git clone <your-fork-url> plantguard-ai
cd plantguard-ai
npm ci                      # npm install also works
cp .env.example .env        # optional — every variable has a safe default
npm run dev                 # http://localhost:5173
```

Open the app, complete onboarding, then **Settings → AI model → Download AI model**. The model is
never downloaded automatically.

> The service worker is only active in production builds. To test PWA/offline behaviour:
> `npm run build && npm run preview` → http://localhost:4173

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + component tests (Vitest) |
| `npm run test:e2e` | Playwright E2E (first run: `npx playwright install chromium`) |
| `npm run check` | lint + typecheck + test + build |
| `npm run verify:model` | Check model ids, revisions and ONNX files on the Hub (no download) |
| `npm run verify:inference` | Real model inference in Node on the test fixture (downloads ≈350 MB once) |
| `npm run test:real-browser` | Real Chromium worker inference, cold offline reload and cache eviction (run verify:inference first) |
| `npm run icons` | Regenerate PWA icons |

Details: [docs/TESTING.md](docs/TESTING.md).

## Configuration

All configuration is optional, public and build-time (`VITE_*`). Never put secrets in it.
See [`.env.example`](.env.example) and [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## The AI model

- Default **SmolVLM-500M-Instruct** (≈346 MB, Apache-2.0); lite **SmolVLM-256M-Instruct**
  (≈182 MB). Pinned revisions, q8/q4 ONNX weights, run with Transformers.js 4 in a Web Worker
  (WebGPU when available, otherwise WebAssembly).
- PaliGemma 2 was evaluated first and rejected for this use (≥2.3 GB, not instruction-tuned).
- Readiness is verified file-by-file in the browser cache before "offline ready" is shown.

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
