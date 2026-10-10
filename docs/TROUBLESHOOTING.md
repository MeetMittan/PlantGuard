# Troubleshooting

| Symptom | Recovery |
|---|---|
| Settings or another page says Something went wrong | Read the displayed error; reload online to get current chunks. Export before changing site storage. |
| Deep-route host 404 | Deploy dist with netlify.toml SPA rewrite; on Pages omit a top-level 404.html. |
| Model absent/offline unavailable | Connect and explicitly download. Different origins/profiles have separate caches. |
| Download failure | Check Hugging Face/CDN access, captive portals and custom-host CORS. Cancel stops the worker; retry reuses completed files. |
| AI ready for this session | Free device space and use Repair download before going offline. In-memory success is not complete caching. |
| Storage full / saving fails | Keep the page open; result retained. Turn off Keep the full photo and retry, or free space. Existing observations are never automatically deleted. |
| Unsupported/GPU failure | Try CPU only or lite. HTTPS, Workers, WebAssembly and Cache API required; low-memory devices may still fail. |
| Initialization slow | Cancel/retry or switch CPU/lite. Inspect Settings → Model diagnostics. There is no cloud fallback. |
| Offline model fails after release | Re-check model/runtime assets, repair online. Keep the pinned tokenizer-probe workaround in vision.worker.ts. |
| Camera denied/unavailable | Enable site permission, use HTTPS or Choose photo. HEIC decode varies; convert to JPEG if rejected. |
| Wrong plant/condition | Expected with general-purpose SmolVLM. Compare observations and consult an expert; guesses are not confirmed diagnoses. |
| Missing images | Photo-free saves/exports retain less image data; thumbnails/placeholders keep history usable. |
| Data gone after host change | Export from the old origin and import on the new one. Browser storage is origin/profile-specific. |
| Offline map blank | Tiles need internet; saved location lists still work. |
| Backup rejected | Valid PlantGuard JSON/ZIP within 300 MB required. Failed imports roll back. |
| Env changes have no effect | VITE_* values are build-time. Trigger a redeploy and apply Update. |

Run npm ci, npm run check and npm run test:e2e. For real model checks: npm run verify:model, npm run verify:inference, npm run test:real-browser. The browser check streams pinned fixture assets into production download URLs, then tests cold offline reload. It is not a live-CDN or physical-phone benchmark.

Export backups before clearing site data; that action removes observations and models. See [TESTING.md](TESTING.md) and [DEPLOYMENT.md](DEPLOYMENT.md).
