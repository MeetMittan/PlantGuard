# Requirements

PlantGuard AI is an offline-first PWA for people exploring gardens, parks, farms and trails. It
lets them photograph a leaf, run an open-weight vision-language model on their own device, review
a cautious assessment, save the observation and keep a plant-care streak.

## Product principles

1. Local AI inference and privacy (no image upload, no account).
2. Reliable offline use after initial setup — claimed only when verified.
3. Responsive, accessible, mobile-first UI.
4. Honest AI results with explicit uncertainty; never fabricated diagnoses or scores.
5. No required paid service, backend or secret.

## Core journey (implemented)

Onboarding → explicit model download (size disclosed) → install PWA → capture or choose a photo
→ local analysis with step progress → structured result (visible signs, possible cause, curated
next steps, limitations) → save (photo optional, location optional) → history/streak → later,
offline: open app, view observations, analyse new photos with the cached model.

## Functional requirements and status

| Area | Requirement | Status |
|---|---|---|
| Dashboard | Greeting, encouragement, model/offline status, scan CTA, totals, plants identified, current/best streak, weekly chart, recent scans, today's checklist, first-use empty state — all computed from stored data | ✅ |
| Scanner | Camera (getUserMedia) + gallery upload, preview, retake/replace, quality hints, name/context, readiness check, step progress, cancel, structured result, save, rescan, save-without-analysis, error states | ✅ |
| History | List/grid, thumbnails, date, summary, search, condition + date filters, sort, incremental loading, detail view, edit notes/name/plant link, delete with confirmation, open image, empty/no-results states | ✅ |
| My Garden | Plants with name, species, cover, notes, light/watering preferences, linked observations, in-app reminders, archive/restore, delete | ✅ (reminders shown in-app only; no background notifications) |
| Care & streaks | Daily goal, typed tasks (watering, health check, observation, custom), idempotent completion, current/best streak, calendar, weekly summary, milestones, reduced motion | ✅ |
| Explorer | Leaflet map, user-initiated location, observation + place markers, list view, detail panel, add place (location/map tap/manual), type filters, offline/no-location/no-results states, attribution | ✅ (nearby discovery deferred) |
| Settings | Theme, model status/selection/acceleration/delete, offline readiness, permissions guidance, storage usage + persistence, export/import, clear history, clear all data, privacy, credits/licenses, version | ✅ |
| Data | Versioned Dexie schema + migration, repositories, transactions, validated ZIP/JSON backup with preview, merge/replace, rollback | ✅ |
| AI | Real Transformers.js provider in a Web Worker, WebGPU + WASM fallback, verified cache status, progress, cancel, retry, classified errors, validated output, unknown/insufficient outcomes, demo provider only behind explicit flags | ✅ |
| PWA | Manifest, icons, precached shell incl. lazy chunks, update prompt, offline navigation | ✅ |

## Care streaks

Implemented in `src/features/care/services/streaks.ts` (unit-tested):

1. A day's **care actions** = distinct care tasks completed that local day + observations saved
   that local day. Completing the same task twice in one day counts once (unique
   `[taskId+dayKey]` index); un-ticking removes it.
2. A day **qualifies** when its care actions ≥ the daily goal (1–5, default 1).
3. The **current streak** is the run of consecutive qualifying days ending today. If today hasn't
   qualified yet, the run ending yesterday is still shown ("at risk") until midnight.
4. Any missed day resets the streak. **No grace days.**
5. Days are the device's **local calendar days** (`yyyy-MM-dd` from local time, never UTC),
   so late-evening actions count for the right day and DST changes don't skip or duplicate days.
6. The **best streak** is the longest qualifying run up to today (future-dated data ignored).
7. Milestones: 3, 7, 14, 30, 60, 100, 180, 365 days — celebrated once each.

Deleting a task keeps its past completions, so historical streaks don't change retroactively.
Clearing scan history removes observations and can lower the streak (the dialog says so).

## Non-functional requirements

- **Privacy:** see [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).
- **Accessibility:** semantic landmarks, skip link, keyboard-operable controls, visible focus,
  native modal dialogs with focus return, labelled form fields with announced errors, live regions
  for status/toasts, icon + text for every status, reduced motion, ≥44 px touch targets.
- **Performance:** route and component code splitting, worker inference, image resize before
  analysis, thumbnails in lists, incremental history loading, no model download on page load.
- **Compatibility:** current Chrome, Edge, Firefox and Safari. AI acceleration and performance vary
  by device; see [AI_MODEL.md](AI_MODEL.md#browser-and-device-constraints).
