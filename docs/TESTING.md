# Testing

All commands run from the repository root after `npm ci`.

| What | Command | Notes |
|---|---|---|
| Lint | `npm run lint` | ESLint 10 + typescript-eslint + React Hooks rules. Warnings are Fast-Refresh hints only. |
| Type check | `npm run typecheck` | `tsc -b` over app (strict) and tooling projects. |
| Unit + component tests | `npm test` | Vitest 5 + jsdom + Testing Library + fake-indexeddb. |
| Watch mode | `npm run test:watch` | |
| Production build | `npm run build` | Type-checks, then `vite build` (PWA + service worker). |
| End-to-end | `npm run test:e2e` | Playwright; builds a **demo-provider** production bundle into `dist-e2e/` and serves it with `vite preview`. First time: `npx playwright install chromium`. |
| Everything | `npm run check` | lint → typecheck → test → build. |
| Model config | `npm run verify:model` | Checks model ids/revisions/dtype files against the Hub (no weight download). |
| Real inference | `npm run verify:inference` | Downloads the default preset (≈350 MB) into `.model-cache/` and runs the real prompt sequence + parser on CPU. `VERIFY_PRESET=smolvlm-256m`, `VERIFY_IMAGE=…`, `VERIFY_CONTEXT=…` are supported. Not run in CI. |

## What is covered

**Unit tests**

- `src/app/config.test.ts` — env validation, defaults, demo-mode guard, map attribution rule.
- `src/db/repositories/repositories.test.ts` — CRUD, search/filter/sort/pagination, stats, plant/place unlinking, idempotent care completion, unique index.
- `src/db/migrations/migrations.test.ts` — real v1 → v2 upgrade with backfill.
- `src/features/care/services/streaks.test.ts` — streak rules, goals, missed days, month/year/leap boundaries, DST transitions, local-vs-UTC day keys.
- `src/services/image-processing/image-processing.test.ts` — MIME/size validation, magic-byte sniffing with real fixtures, resize math.
- `src/services/export-import/backup.test.ts` — JSON/ZIP round trip, validation failures, newer versions, ignored ZIP entries, merge/replace, transactional rollback.
- `src/ai/utils/parse-answers.test.ts` — answer parsing, real recorded model outputs, contradictions, echoes, truncation, not-a-plant, no dosage advice, markup as text.
- `src/ai/utils/run-analysis.test.ts` — question sequencing, follow-up logic, context sanitising, cancellation, error propagation.
- `src/ai/model-manager/model-manager.test.ts` — every model state transition, offline/unsupported/error/retry, eviction recovery, delete.
- `src/services/geolocation/geolocation.test.ts`, `src/services/maps/map-provider.test.ts`.

**Component tests** (real router + providers, IndexedDB via fake-indexeddb)

- Scanner: model unavailable, successful analysis + save, inference failure, invalid file, camera permission denied, camera unsupported.
- History: empty state, ordering, condition filter, search, no-results + clear filters.
- Observation detail: notes editing, delete confirmation (cancel and confirm).
- App shell: desktop + mobile navigation parity, "More" menu, offline indicator, onboarding redirect.
- Settings: clear history (model kept), cancel clear-all, delete model only after confirmation, export, import preview + merge, invalid backup.

Component tests replace the model provider with the explicitly simulated `DemoVisionProvider`
through `src/test/mock-model-manager.ts`; this is test-only and production builds use the real
Transformers.js provider unless demo mode is explicitly configured.

**End-to-end** (`tests/e2e`, Pixel 7 profile + desktop Chrome for navigation)

1. Onboarding → model "download" (demo provider, full UI flow with confirmation) → scan the fixture
   photo → structured result → save → history → create + complete care task → streak and
   today's count (and re-completing doesn't double count) → export JSON and validate its content
   → reload → data persists.
2. Simulated inference failure → error shown, nothing saved.
3. Non-image upload rejected.
4. Offline: service worker controls the page, context goes offline, reload → history, care task
   creation and explorer offline notice all work.
5. Every primary destination reachable on mobile and desktop; deep-route refresh (SPA fallback).
6. Explorer shows OSM attribution and makes **zero** geolocation calls without a user action.

## Manual verification of real AI in a browser (per release)

CI never downloads the model. Before a release, on at least one laptop and one Android phone:

1. `npm run build && npm run preview` (or the deployed HTTPS URL).
2. Settings → AI model: confirm the size shown, download, watch progress reach 100%, status
   "AI ready offline". Note whether it runs on GPU (WebGPU) or CPU.
3. Scan `tests/fixtures/tomato-early-blight.jpg` (or a real leaf). Expect a structured result with
   visible signs; the condition name may be wrong — that is documented behaviour.
4. DevTools → Network → Offline → reload → scan again: analysis must still work.
5. Settings → *Delete downloaded model* → status returns to "AI not downloaded"; your
   observations remain.
6. Try Settings → Acceleration → CPU only and repeat step 3.
7. Record device, browser, preset, device type (GPU/CPU) and total analysis time in the release notes.

## CI

`.github/workflows/ci.yml` runs `npm ci`, lint, typecheck, unit/component tests, production build,
`verify:model` (network check, no weights) and the Playwright suite (Chromium).
