# Tech stack

Versions are those installed when the project was created (October 2026); see `package.json`.

| Concern | Choice | Why |
|---|---|---|
| UI | React 19.3, TypeScript 6.0 (strict), Vite 8 | Required stack. TypeScript is pinned to `~6.0` because `typescript-eslint` 8.71 supports `<6.1` (TypeScript 7 was not yet supported by the linter). |
| Routing | React Router 8 (`createBrowserRouter`, lazy routes, route error boundaries) | |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) with semantic design tokens in `src/styles/index.css` | |
| Fonts | Fraunces Variable (display), Inter Variable (text) via Fontsource — self-hosted, no Google Fonts requests | Privacy, offline |
| Motion | Motion for React 14 (`MotionConfig reducedMotion="user"`) | |
| Effects | React Bits *CountUp* and *SpotlightCard*, adapted locally (`src/components/common/reactbits`) | Copy-in components (MIT + Commons Clause); attribution in file headers |
| Icons | Lucide React | |
| Forms | React Hook Form 7 + Zod 4 (`@hookform/resolvers`) | |
| Dates | date-fns 4 (local-day keys, DST-safe arithmetic) | |
| Charts | Recharts 3 (lazy-loaded) | |
| Persistence | IndexedDB via Dexie 4 + `dexie-react-hooks` live queries | |
| AI runtime | `@huggingface/transformers` 4.3 (ONNX Runtime Web 1.31 dev build bundled by it), WebGPU or WASM, Web Worker | Only one AI runtime is installed |
| Model | SmolVLM-500M-Instruct (default) / SmolVLM-256M-Instruct, Apache-2.0 | See [AI_MODEL.md](AI_MODEL.md) |
| PWA | `vite-plugin-pwa` 2 (Workbox 7, generateSW, prompt updates) | |
| Maps | Leaflet 1.9 + React Leaflet 5, OSM raster tiles (configurable) | |
| Backup | fflate (ZIP) | Small, fast, no native deps |
| Unit/component tests | Vitest 5, jsdom, Testing Library, user-event, fake-indexeddb | |
| E2E | Playwright 1.64 (Chromium) | |
| Lint | ESLint 10, typescript-eslint, react-hooks, react-refresh | |
| Hosting | Cloudflare Pages (primary), GitHub Pages (alternative) | Static, free tiers |

Not used (on purpose): no backend server, Express, Supabase, Redis, Docker, analytics SDK, paid
map/AI APIs, `localStorage` for user data, or a second AI runtime. The optional Ollama provider
from the brief was not built: it needs a separately running desktop service and would not help the
mobile PWA (see [ROADMAP.md](ROADMAP.md)).
