# Security and privacy

PlantGuard has no application backend, accounts, analytics, server database, automatic photo uploads or remote inference endpoint. Production defaults to Transformers.js; demos require two explicit public settings and are labeled. GPU fallback uses local CPU/WASM, with no cloud fallback.

Photos are validated by size, MIME and signature, decoded and re-encoded as resized JPEGs without source EXIF. Supporting browsers prepare images in a worker; model work uses a separate worker. Photos are not sent to model hosts.

Network requests include app assets, user-requested model/runtime assets, online map tiles and user-opened references. Hosts can see IP/browser information; tiles reveal viewed areas. Camera/location requests require explicit actions. Custom hosts must be trusted and allow CORS.

All VITE_* values are PUBLIC build-time configuration. Never add secrets, keys or tokens. .env* is ignored except .env.example. HTTPS/localhost is required for secure APIs. public/_headers adds nosniff, referrer and camera/geolocation/microphone policies.

Model text is bounded, parsed, Zod-validated and React-escaped. No model HTML/action execution. References and conservative recommendations are curated. Context can influence an unreliable model; sanitizing is not proof of prompt-injection resistance.

IndexedDB/Cache API are not application-encrypted. Browser-profile access or a same-origin exploit may expose photos/notes/coordinates. Backups include personal data; store privately. Imports validate paths, counts, dates/enums and signatures, then transact atomically.

Clear history/all require confirmation. Clear-all includes assessments/care events but retains model files and their readiness metadata. Delete downloaded model removes the selected revision's model assets, preserving shared runtime and user records. Browser Clear site data deletes everything.

This is a code description, not an independent penetration test or a guarantee of diagnosis safety. See [AI_MODEL.md](AI_MODEL.md).
