# PlantGuard AI production hosting

**Yes: this repository can be hosted on Netlify.** It is a static Vite/React PWA with local IndexedDB and on-device inference. No server functions, inference endpoint, API keys or hosted database are required. Model downloads use Hugging Face and the version-pinned ONNX Runtime CDN; photos stay in the browser.

## Netlify deployment

1. Commit the source, package-lock.json, public/, docs/ and root netlify.toml to your Git repository. The current workspace has untracked source files: make sure they are added before pushing. Keep node_modules, dist*, .model-cache, .env secrets and test artifacts out of Git (root .gitignore covers these).
2. In Netlify, create/import a project from that repository and choose your production branch.
3. Base directory: repository root (leave empty). Build command: **npm run build**. Publish directory: **dist**. Node: **22** (set by netlify.toml). Package install uses package-lock.json. Do not set NODE_ENV=production for dependency installation: the build requires development tools.
4. No environment variables are required for the default working configuration. If desired, set the public values below in Netlify's build environment. Keep VITE_AI_PROVIDER=transformersjs and VITE_ENABLE_DEMO_MODE=false for real analysis. Use VITE_BASE_PATH=/ for a normal Netlify domain.
5. Deploy. The non-forced catch-all rewrite sends browser routes to index.html while real files take precedence. public/_headers supplies SW/HTML revalidation, immutable hashed assets and browser policies. Netlify supports this file too.
6. Open the HTTPS URL, complete onboarding, download a model explicitly and verify a scan. Wait for service-worker activation, reload, disconnect, scan/save/reload/history/compare. External tiles/reference pages need internet.

Do not upload the repository folder as a manual deploy. For a drag-and-drop deploy, first run npm ci and npm run build locally, then upload **dist**. Git deployment with netlify.toml is preferred so route/configuration behavior is reproducible. When changing VITE_* settings, rebuild/redeploy and apply the app's Update prompt. Existing browser data remains tied to that origin.

## Every supported environment value

These are ALL application variables supported by src/app/config.ts. They are optional and PUBLIC: Vite embeds VITE_* into JavaScript at build time. **Never put secrets or paid-AI credentials in them.** For blank values below, omit the variable from Netlify rather than inventing a value. Node version is hosting configuration, not an app variable.

```env
# PlantGuard AI — environment configuration
#
# Copy to `.env` (git-ignored) and adjust. Every value is OPTIONAL: the app runs
# with the defaults shown. All VITE_* values are PUBLIC — Vite inlines them into
# the browser bundle at BUILD time. Never put secrets, tokens or private keys here.
# Changing any value requires a new build (npm run build). Details: docs/ENVIRONMENT.md

# --- App -------------------------------------------------------------------
VITE_APP_NAME=PlantGuard AI
# BCP 47 locale for date/number formatting.
VITE_DEFAULT_LOCALE=en-IN
# Sub-path the app is served from, e.g. /plantguard-ai/ for GitHub Pages. Default: /
VITE_BASE_PATH=/

# --- On-device AI ------------------------------------------------------------
# transformersjs = real local inference (default).
# demo = SIMULATED results for demos/E2E tests; also requires VITE_ENABLE_DEMO_MODE=true.
VITE_AI_PROVIDER=transformersjs
VITE_ENABLE_DEMO_MODE=false
# Leave empty to use the built-in, verified presets (SmolVLM 500M default, 256M lite;
# users choose in Settings). Set only to force a different SmolVLM/Idefics3-compatible
# ONNX checkpoint — see docs/AI_MODEL.md#using-a-different-model.
VITE_AI_MODEL_ID=
# Git revision (commit hash or branch) for a custom VITE_AI_MODEL_ID. Default: main.
VITE_AI_MODEL_REVISION=
# Override per-component quantization: "q4" or "embed_tokens=q8,vision_encoder=q4,decoder_model_merged=q4".
VITE_AI_MODEL_DTYPE=
# Photos are resized to this longest edge (px) before analysis and storage. 256–2048.
VITE_AI_MAX_IMAGE_DIMENSION=768
# Upper bound for generated tokens per answer. 32–512.
VITE_AI_MAX_NEW_TOKENS=160
# Where model files are downloaded from (a Hugging Face–compatible host).
VITE_AI_REMOTE_HOST=https://huggingface.co/
# Optional: self-hosted folder containing ort-wasm-simd-threaded.asyncify.{mjs,wasm}
# from node_modules/onnxruntime-web/dist. Empty = version-pinned jsDelivr CDN.
VITE_AI_WASM_BASE_URL=

# --- Maps --------------------------------------------------------------------
# Raster tile URL template. The default public OSM service has a usage policy:
# https://operations.osmfoundation.org/policies/tiles/
VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
# Required when VITE_MAP_TILE_URL is not the default. HTML allowed (links).
VITE_MAP_ATTRIBUTION=
VITE_MAP_MAX_ZOOM=19

# --- Features ----------------------------------------------------------------
# Set to false to hide all location features (no geolocation requests at all).
VITE_ENABLE_GEOLOCATION=true
```

Recommended deployment leaves custom model ID/revision/dtype, map attribution and WASM URL unset. Built-in presets pin their own commits. A custom remote/runtime host requires CORS and real model validation. A custom map tile URL requires valid attribution. VITE_ENABLE_GEOLOCATION=false hides location features if desired.

Optional local setup (PowerShell): Copy-Item .env.example .env. Adjust only public preferences. Netlify does not need a committed .env file; use its build environment settings. A local .env file is not automatically sent to Netlify's Git build.

## Cloudflare Pages alternative

Netlify is supported; Pages is an alternative, not a requirement.

Connect the repository to Pages. Framework preset: Vite, build command npm run build, output dist, root repository directory, NODE_VERSION=22. Use the same optional public VITE_* variables. Pages provides SPA fallback when no top-level 404.html exists; this repository supplies no such file. public/_headers is included in dist.

Pages currently limits individual static assets to 25 MiB. The build deliberately drops Vite's unused bundled ORT WASM copy; runtime WASM and model files download externally and are browser-cached. Do not copy weights or the large runtime WASM into public/ for Pages. For self-hosted large model/runtime assets use an appropriate separate asset host (for example R2 with CORS), set the optional remote/WASM URLs, and test before release.

## Production checks and limitations

Run npm run check, npm run test:e2e, npm run verify:model, npm run verify:inference and npm run test:real-browser before deploying. Real browser fixtures validate worker/cache mechanics; they do not certify live CDN availability or physical mobile hardware. See docs/IMPLEMENTATION_REPORT.md.

On the deployed HTTPS site verify direct /settings and /garden refreshes, SW content type/revalidation, manifest/icons, model progress/cancel/retry, Settings theme/name persistence, local saving/reload and cold offline inference. Hosting was configured here; no external deployment was performed.

Small general-purpose models often misidentify diseases. No accuracy guarantee, confidence percentages or invented recovery scores. Browser storage may be evicted; export backups. Data is specific to the origin/profile: export/import when moving to another domain. Map tiles are online-only. HEIC decoding and GPU support vary. Physical phone/camera and screen-reader checks remain manual.

## Official hosting references

- [Netlify Vite deployment](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [Netlify SPA rewrites](https://docs.netlify.com/build/configure-builds/javascript-spas/)
- [Netlify environment variables](https://docs.netlify.com/build/environment-variables/get-started/)
- [Netlify file-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages serving behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
