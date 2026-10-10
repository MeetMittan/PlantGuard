# Contributing

Thanks for helping PlantGuard grow! 🌱

1. Fork and create a branch from `main`.
2. `npm ci`, then `npm run dev`.
3. Make focused changes that follow `CLAUDE.md` (architecture rules) and `docs/UI_UX.md`.
4. Add or update tests next to the code (`*.test.ts(x)`), and E2E specs in `tests/e2e` for new flows.
5. Run `npm run check` and, for UI flows, `npm run test:e2e`.
6. If you change prompts, presets or parsing, run `npm run verify:inference` and update
   `docs/AI_PROMPTS.md` / `docs/AI_MODEL.md` with what you observed.
7. Update docs for any behaviour or configuration change. Never document planned work as implemented.
8. Open a pull request describing what changed, why, and how you tested it.

## Ground rules

- No secrets in `VITE_*` variables or source.
- No uploading of user photos or data, no analytics, no silent remote inference.
- No new paid-service dependencies for core features.
- Keep the app usable offline and accessible (keyboard, screen readers, reduced motion).

Please report security issues privately to the maintainers instead of opening a public issue.
