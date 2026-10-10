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

| Variable | Default | Required | Purpose |
|---|---|---|---|
| `VITE_APP_NAME` | `PlantGuard AI` | No | Name in the UI and PWA manifest. |
| `VITE_DEFAULT_LOCALE` | `en-IN` | No | BCP 47 locale for dates/numbers. Validated with `Intl`. |
| `VITE_BASE_PATH` | `/` | No | Sub-path the app is served from (e.g. `/plantguard-ai/` for GitHub Pages). Used for asset URLs, router basename, manifest `start_url`/`scope`. |
| `VITE_AI_PROVIDER` | `transformersjs` | No | `transformersjs` = real on-device inference. `demo` = simulated results (tests/demos only). |
| `VITE_ENABLE_DEMO_MODE` | `false` | Only with `demo` | Must be `true` for `VITE_AI_PROVIDER=demo`; a persistent banner marks demo builds. |
| `VITE_AI_MODEL_ID` | *(empty → presets)* | No | Force a custom SmolVLM/Idefics3-compatible ONNX repo. Hides the preset picker. |
| `VITE_AI_MODEL_REVISION` | preset's pinned commit, or `main` for custom ids | No | Git revision of the model repo. Pin to a commit hash for reproducible caching. |
| `VITE_AI_MODEL_DTYPE` | `embed_tokens=q8,vision_encoder=q4,decoder_model_merged=q4` | No | Quantization per ONNX component, or one dtype for all (`fp32 fp16 q8 int8 uint8 q4 bnb4 q4f16`). |
| `VITE_AI_MAX_IMAGE_DIMENSION` | `768` | No | Longest edge (px, 256–2048) for stored/analysed photos. |
| `VITE_AI_MAX_NEW_TOKENS` | `160` | No | Global cap on generated tokens per answer (32–512). Per-question limits are smaller. |
| `VITE_AI_REMOTE_HOST` | `https://huggingface.co/` | No | Host serving model files with the Hub URL layout (e.g. a self-hosted mirror). |
| `VITE_AI_WASM_BASE_URL` | *(empty → jsDelivr, version-pinned)* | No | Folder hosting `ort-wasm-simd-threaded.asyncify.{mjs,wasm}` from `node_modules/onnxruntime-web/dist`. Needs a host allowing ~26 MB files. |
| `VITE_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | No | Raster tile URL template. |
| `VITE_MAP_ATTRIBUTION` | OSM attribution (default URL only) | **Yes** if `VITE_MAP_TILE_URL` is changed | Visible map attribution (HTML links allowed). |
| `VITE_MAP_MAX_ZOOM` | `19` | No | Max zoom (capped at 19 for the OSM service). |
| `VITE_ENABLE_GEOLOCATION` | `true` | No | `false` hides all location features. |

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
