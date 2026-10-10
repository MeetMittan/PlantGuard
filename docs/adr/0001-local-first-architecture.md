# ADR 0001 — Local-first, static architecture

- **Status:** Accepted (2026-10-10)

## Context

Users scan plants on trails, farms and parks — often with poor or no connectivity. Photos of
private gardens and locations are personal. The brief requires zero mandatory paid services and no
mandatory backend for the MVP.

## Decision

Build a static PWA with all user data in the browser (IndexedDB), on-device AI inference, and no
application server. Repositories (`src/db/repositories`) isolate persistence so a future opt-in
sync layer can be added without rewriting screens.

## Consequences

- ✅ Works offline after setup; strong privacy by default; free static hosting; simple operations.
- ✅ No accounts, secrets or server costs.
- ⚠ Data lives on one device/browser: users must export backups; browser eviction is possible
  (mitigated by persistent-storage requests and verified readiness checks).
- ⚠ No cross-device sync or server-side analytics (by design for the MVP).
