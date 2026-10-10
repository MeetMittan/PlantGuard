# CLAUDE.md — working on PlantGuard AI

Offline-first React PWA with on-device AI (Transformers.js + SmolVLM in a Web Worker) and
IndexedDB (Dexie). No backend. Read `docs/ARCHITECTURE.md` first.

## Commands

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run check` (lint + typecheck + unit/component tests + build) — run before finishing work
- `npm run test:e2e` (Playwright, demo-provider build) · `npm run verify:model` · `npm run verify:inference` (downloads ≈350 MB)

## Rules

- `src/app/config.ts` is the only place that reads `import.meta.env`. New env vars: add to the
  Zod schema, `vite-env.d.ts`, `.env.example` and `docs/ENVIRONMENT.md`.
- Components never touch Dexie tables directly — use `src/db/repositories/*`.
- Schema changes: add a new entry to `src/db/migrations/index.ts` (never edit released versions) + test.
- Never fabricate AI output. The demo provider is only for tests/demos behind
  `VITE_AI_PROVIDER=demo` + `VITE_ENABLE_DEMO_MODE=true`.
- Model output is untrusted text: parse + validate (`src/ai/utils/parse-answers.ts`), render as
  text, never `dangerouslySetInnerHTML`. Guidance text is curated (`src/ai/utils/guidance.ts`);
  never add dosages or pesticide instructions.
- Don't add service-worker runtime caching for model files or map tiles.
- Dates for streaks use local day keys from `src/lib/dates.ts` — never `toISOString().slice(0, 10)`.
- Use design tokens (`bg-surface`, `text-ink`, `border-line`, `bg-forest` …), not raw colours.
- Respect reduced motion; give every status icon + text.
- TypeScript is pinned to `~6.0` until typescript-eslint supports 7.
