# Database schema

IndexedDB database: **plantguard**, Dexie schema **3**. Types: src/db/schema.ts; migrations: src/db/migrations/index.ts; access: src/db/repositories/.
Weights belong to Cache API transformers-cache, not IndexedDB.

| Table | Key | Indexes and contents |
|---|---|---|
| observations | id | createdAt, observedAt, dayKey, plantId, healthStatus, placeId, latestAssessmentId, [plantId+observedAt]. Optional JPEG, thumbnail, notes/context, source, chronology and location. |
| assessments | id | observationId, createdAt, [observationId+createdAt]. Immutable assessment v2 records and model/prompt provenance. |
| plants | id | name, createdAt, archived. Persistent identity, identification status, cover link, preferences/reminders. |
| careEvents | id | plantId, occurredAt, dayKey, [plantId+occurredAt]. Plant-specific care actions/notes. |
| careTasks | id | kind, plantId, archived, createdAt. Daily checklist definitions. |
| careCompletions | id | Unique [taskId+dayKey], taskId, dayKey. One completion per task per local day. |
| savedPlaces | id | name, kind, createdAt. User-saved locations. |
| settings | key | Device preferences; no credentials. |
| appMetadata | key | Model manifests/initialization timestamps and bookkeeping. |

Dates are ISO strings; streak day keys use local yyyy-MM-dd. Timeline uses observedAt/occurredAt with deterministic tie breakers. Save time remains unchanged when an observation is backdated. Indexed booleans use 0/1.

## Migrations and transactions

v1 introduced local tables with embedded assessments. v2 backfilled search text. v3 separates assessments/care events and adds chronology and plant identity. Upgrades run transactionally; never edit released versions.

saveScan creates a requested plant, observation and assessment atomically. Preassigned observation IDs make repeated saving idempotent. Rescans append assessments. Plant deletion unlinks observations/tasks and deletes that plant's care events. Observation deletion removes its assessments and clears cover links.

Clear history removes observations/assessments and clears cover links. Clear-all removes user tables including care events/assessments, retaining only model manifest/verification metadata because downloaded weights are kept. No automatic deletion to recover quota.

## Backup format

backup-schema.ts defines **version 2**. JSON excludes photos; ZIP contains manifest.json and images/, thumbnails/, covers/. Data includes observations, assessments, plants, care events, tasks/completions, places and validated portable settings. Legacy v1 backups are converted; newer versions rejected.

Imports are bounded (300 MB input, 50,000 records per table), Zod-validated and transactional. Only permitted image paths are read; signatures checked. Merge retains existing IDs and associated assessments; replace clears user records within the transaction. Failure rolls back. Model weights/secrets are not exported.
