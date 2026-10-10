# ADR 0003 — IndexedDB via Dexie for user data

- **Status:** Accepted (2026-10-10)

## Context

The app stores structured records (observations, plants, tasks, completions, places) and binary
photos, needs indexed queries (by date, plant, status), transactions and schema evolution, and must
work offline.

## Decision

Use IndexedDB through Dexie 4 with a versioned schema (`src/db/migrations`), typed repositories,
`dexie-react-hooks` live queries, Blob storage for resized photos and thumbnails, and a unique
`[taskId+dayKey]` index that makes care completions idempotent. Model weights stay in the Cache API
managed by Transformers.js. `localStorage` is not used for user data.

## Consequences

- ✅ Large binary storage, indexes, transactions, reactive UI updates, migrations with rollback.
- ✅ Validated JSON/ZIP backups provide portability.
- ⚠ Subject to browser quotas and eviction; private windows may be limited.
