# UI / UX

## Visual direction

Botanical, calm and premium rather than an admin dashboard: deep forest green accents, warm
off-white surfaces, subtle borders and soft shadows, a serif display face (Fraunces) for headings
and Inter for text, and a faint radial "botanical grain" on the canvas.

## Design tokens

Defined once in `src/styles/index.css` and exposed to Tailwind via `@theme`:

| Token | Use |
|---|---|
| `canvas`, `surface`, `surface-muted`, `surface-raised` | Backgrounds |
| `line`, `line-strong` | Borders, dividers |
| `ink`, `ink-muted`, `ink-subtle` | Text hierarchy |
| `forest`, `forest-strong`, `forest-soft`, `on-forest` | Primary actions, "healthy/ready" |
| `clay`, `clay-soft` | Problems, destructive actions |
| `sun`, `sun-soft` | Warnings, "unclear", offline |
| `sky`, `sky-soft` | Information, saved places |
| `chart-mark` | Chart bars (validated for lightness band, chroma and ≥3:1 contrast in both themes) |
| `focus` | Focus outline |

Dark mode redefines the same tokens under `.dark` (system, light or dark — user setting, applied
before first paint to avoid flashes). Components never use raw colour values.

## Layout & navigation

- **Mobile:** sticky top bar with logo and status chips; bottom bar with Home, History, a raised
  central **Scan** button, Care, and *More* (Garden, Explorer, Settings) in a dialog.
- **Desktop (≥1024 px):** fixed sidebar with all destinations and a status panel; content max-width
  ~72 rem with generous gutters.
- Same routes and features in both layouts (covered by component and E2E tests).

## Components

`src/components/ui`: Button/ButtonLink, Card, Badge, Field (label + hint + error wiring), Input,
Textarea, Select, Switch, SegmentedControl, Dialog/ConfirmDialog (native `<dialog>`),
ProgressBar (determinate/indeterminate), Skeleton. `src/components/feedback`: Toaster, EmptyState,
StatusChips, UpdatePrompt, RouteError. `src/components/common`: HealthBadge, ObservationThumb,
React Bits adaptations.

## Motion

Used sparingly: route fade/slide, scanner phase transitions, onboarding step slides, dialog
entrance, toast enter/exit, dashboard CountUp numbers, the dashboard SpotlightCard glow, and a
leaf-fall milestone celebration. All Motion animations honour `prefers-reduced-motion`
(`MotionConfig reducedMotion="user"`, CSS media query, and explicit checks in the React Bits
adaptations). Animations never block controls or hide state from assistive technology.

## Accessibility checklist

- Landmarks (`header`, `nav` ×2 labelled "Main", `main`, `aside`), skip link.
- Every interactive element is a native button/link/input; keyboard reachable; visible 3 px focus ring.
- Dialogs use `showModal()` (focus trap, Escape, inert background) and restore focus on close.
- Form fields have labels, hints via `aria-describedby`, errors with `role="alert"` and `aria-invalid`.
- Status: toasts in a polite live region; analysis/model progress uses `aria-live` and `role="progressbar"` with values.
- Health and model states always combine icon **and** text; calendar days use a check icon and full `aria-label`s.
- The chart has a visually hidden data table.
- Touch targets ≥44 px; inputs use 16 px text on mobile to prevent iOS zoom.

## Empty, loading and error states

Each list has a skeleton while loading, an empty state with a next action, and a distinct
no-results state when filters are active. Errors are shown inline with a recovery action (retry,
choose photo, open settings) and never as a blank screen.
