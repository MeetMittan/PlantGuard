# Offline and PWA behavior

Setup requires an online app visit and an explicit model download. Each browser profile/origin has separate storage. PWA installation is optional.

| Available offline after setup | Needs a connection |
|---|---|
| Screens, plants, history, timeline, comparisons | First visit, updates, missing-asset repair |
| Capture/upload and local analysis with all model/runtime assets cached | Model/runtime download |
| Saving notes/care/tasks, statistics, backups | Map backgrounds, external references |
| Bundled reference text and diagnostic sample photo | Setup on a new origin/profile |

## Actual readiness

The build emits offline-assets.json. Settings checks its HTML, JS (lazy screens and both workers), CSS and fonts in Workbox precache, plus an active service worker. An active worker alone is insufficient. Re-check offline readiness detects missing chunks. The database indicator checks an IndexedDB read. Persistence protection is reported from the browser Storage API.

The model manager checks a saved manifest in transformers-cache. Required metadata, selected weights and exact runtime assets must all be present. A running model with incomplete cache writes is labeled **AI ready for this session**, with Repair download. Initialization and successful inference are distinct; verify an offline scan on the target device.

## Cache ownership

Workbox precaches app assets and the bundled JPEG sample, with index.html navigation fallback. Transformers.js caches model/runtime files; no service-worker rule duplicates them. Map tiles have no offline caching rule.

Transformers.js 4.3.1 probes tokenizer metadata without forwarding the chosen revision. The worker pins remotePathTemplate as well as load options so probes share the pinned cache keys. Readiness checks are network-free.

## Recovery and persistence

Cancel download terminates its worker and waits for state to settle; completed files remain for retry. Quota failures require freeing space or selecting lite. Repair download disposes an in-memory instance to retry incomplete cache writes.

Database quota failures retain the unsaved photo/result. Turn off Keep the full photo and retry, or free space; nothing is automatically deleted. Transactions prevent partial saves. Settings write failures show a message.

Export regularly: eviction, site-data clearing, private-profile closure or changing domains can remove/isolate records. Persistent storage is a browser-controlled request, not a promise. Reloading during a scan loses unsaved images/results; text drafts survive in sessionStorage where available.

## Updates and testing

Service workers exist only in production. Apply Update after saving work. Model assets are versioned independently. HTML/manifest/sw.js revalidate; hashed assets are immutable (public/_headers and netlify.toml).

npm run test:e2e verifies offline screens/data with simulated inference. npm run test:real-browser, after npm run verify:inference, uses actual weights and a real worker to test cold offline initialization/inference, persistence and eviction. Physical-device verification remains necessary; see [TESTING.md](TESTING.md).
