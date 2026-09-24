# Brain2 screenshots

Full-page PNG captures of every major surface of this **living application**,
each paired with a matching `.txt` write-up (view path, source files, brief
inventory of every on-screen control and its purpose). Sidecars are generated
from `scripts/screenshot-manifest.mjs`. These shots are the visual truth of a
product meant to feel like a vintage machine that is also a painting — motif,
luminous contents, and room for one impossible motion. Rooms can keep arriving. The global header is a pinned full-width mill title bar:
navy **BRAIN2** caption, today’s-friend jewel (click for a Stardew Next Action bubble; Esc / × / outside to close), Friend / Review / System / optional **now** well / Capture groupboxes. The **now** well sits between System and Capture only while a Working session is live (name, elapsed, Stop, Pause↔Resume; idle → hidden). **Names** latches in place; tooltip **Stop naming** while on.

**Re-capture:** with `npm run dev` (or `electron:dev`) running on port 3000:

```bash
npm run capture-screenshots
```

Set `COGS_ONLY=…` / `COGS_FRESH=0` / `COGS_URL=…` (historical env names) to limit files, keep localStorage, or point at another origin.
A **loaded-store** recapture is Wave 0 of [`docs/PLAN_OF_ACTION.md`](../PLAN_OF_ACTION.md)
— do not judge density from default (cleared) shots. Docs (`12-docs*`) is the
missing top-level tab; add it in the capture scripts before treating Docs UI as
photographed truth.
Set `COGS_URL=http://localhost:3000` if the dev server uses a different port.

The capture browser seeds a fortnight of tracking data before the app boots
(`seedTracking` in the script) — an untouched tracker makes every Tracking shot an
empty state, and the variant drill-down has nothing to show. It also blocks
`POST /api/persist`, so a capture run can never publish its throwaway demo data to
the dev persist hub that Electron seeds missing keys from.

Implementation: `scripts/capture-screenshots.mjs` (Playwright) +
`scripts/screenshot-manifest.mjs` (metadata).

---

## Global chrome (every screen)

Rendered by `app/page.tsx`:

| Control | Component | Purpose |
|---------|-----------|---------|
| Today's friend | `components/baby-animal-nest.tsx` | Photograph in a chrome + black-mirror jewel on the pin bar. Persists until Monday or a manual change (`cogs-friend-worn`). Returning friends may say Hi again. Click the photograph for details. The chat button above Gallery asks for a Stardew line (daily habit / today's To Do / Next Action, species bias). Click the **line** (no bevel) for the mission sheet: the task opens item detail on top; Accept until the end of the day; Decline asks for smaller tasks, then a first step, then a reason. **Escape**, ×, or a click outside closes the bubble. **Gallery** holds the preapproved `animalsrcs/` pack (unnamed until you name them) — the only picture sources are that pack and your own uploads. Name field, equal cards, confirm-before-delete (dismissed stay gone); **navy** text-field focus (never orange). Pictures in `cogs-friend-pic:*` or `/friend-pack/`. Plan: [`docs/FRIEND_COMPANION.md`](../FRIEND_COMPANION.md). |
| Names | `components/AppHeader.tsx` | System-group latch. Caption stays **Names**; sunken + `aria-pressed` while on (tooltip **Stop naming**). |
| now | `components/header-now-box.tsx` | Optional groupbox between System and Capture. Live Operations / pen-color Working sessions (name, tabular elapsed, Stop, Pause↔Resume); absent when idle. |
| Review (badge) | `components/Reviews/reviews.tsx` | Period-review dropdown (day/week/month/quarter/year) |
| Morning | `components/Reviews/MorningReview.tsx` | Start-of-day review (wake, dream, intentions, affirmations, postpone) |
| Settings | `components/Settings/SettingsDialog.tsx` | Home city, assumed finish time, backup, sync, **message ingest** (grocery pin, always-on hub, shortcuts, iPhone Notes / Screen Time / Call / Text Shortcut AirDrop), **Screen Time** (ActivityWatch), item types, Second Brain |
| Tracking | `components/cognitive-state.tsx` | Compact Time Grid dialog |
| Inbox | `components/inbox.tsx` | Unclarified captures |
| Ingest | `components/ingest-log-dialog.tsx` | Phone-message ingest log |
| Metrics | `components/Tracking/MetricLogger.tsx` | Wellbeing datapoint logger |
| Bulk Add | `components/enhanced-bulk-add.tsx` | Multi-line capture; `list:` / `folder: list:` headers; optional Inbox |
| From Notes | `components/notes-ingest.tsx` | Apple Notes ingest (this Mac: Electron or localhost `/api/notes`; iCloud / iPhone + On My Mac); bulk-add takes `list:` / `folder: list:` headers |
| Phone Notes | `components/iphone-notes-store.tsx` | On My iPhone notes dumped via Telegram Shortcut → iPhone Notes Store / Parked; same bulk-add headers |
| Quick Add | `components/quick-add.tsx` | Colon paths, live chips, optional skip Inbox |

**Top-level tabs (7):** milled fascia — brushed bay, raised silver keys, the active key a CRT with a round power lamp ([`DESIGN_STYLE.md`](../DESIGN_STYLE.md#milled-fascia)). Home · Lists · Docs · Scheduler · Operations · Modules · Analytics. The Home date plate uses the same language: weekday in a CRT, calendar date on a nameplate, Widgets as a raised key.

**Shortcuts:** Cmd/Ctrl+K → global search · quick-capture hotkey → Quick Add

---

## Screenshot index

### Home dashboard (`components/Home/`)

| File | View |
|------|------|
| `01-home-daily-habits.png` | Habits → Daily week grid |
| `01-home-habits-weekly.png` | Habits → Weekly 7-week grid + scores |
| `01-home-habits-monthly.png` | Habits → Monthly 7-month grid + scores |
| `02-home-plan.png` | Plan → Month |
| `02-home-plan-week.png` | Plan → Week |
| `02-home-plan-day.png` | Plan → Day |
| `03-home-todo.png` | To Do → Day |
| `03-home-todo-week.png` | To Do → Week |
| `03-home-todo-month.png` | To Do → Month |
| `04-home-goals.png` | Goals → objectives & direction report |
| `08-home-tracking.png` | Tracking → Time Grid in a Win95 window (photographed pen tray, Sort Recent / A–Z / Tree / Expand↔Conceal / New pen, occupancy) |
| `08-home-tracking-week.png` | Tracking → Time Grid, week span |
| `08-home-tracking-activity.png` | Tracking → Activity Log (Log activity with search-or-create pen, gaps, Done this day) |
| `08-home-tracking-block.png` | Block editor with **Also happening** — what the other scopes say about the same minutes, the usual-pairing suggestion, one-click attach, and "Make it always" |
| `08-home-tracking-daylog.png` | Tracking → Day Log (Day \| Week plan vs painted Tracking time; day notes under the agenda) |

Also visible on Home shots: `NeedsAttention`, review banner, points stats, today's progress.

### Lists (`components/Lists/`)

Gold-standard cabinet (velvet + orbs; the frame is a quoted file-manager motif): see
[`docs/DESIGN_STYLE.md`](../DESIGN_STYLE.md). `05-lists.png` is the reference
folder Icons / velvet capture.

| File | View |
|------|------|
| `05-lists.png` | Home folder → Icons |
| `05-lists-list.png` | Home folder → List |
| `05-lists-details.png` | Home folder → Details |
| `05-lists-cards.png` | Home folder → Cards |
| `05-lists-content-default.png` | Example List → Default display |
| `05-lists-content-checklist.png` | Example List → Checklist |
| `05-lists-content-spreadsheet.png` | Example List → Spreadsheet |

### Scheduler (`components/Scheduler/`)

| File | View |
|------|------|
| `06-scheduler.png` | Funnel → Always |
| `06-scheduler-day.png` | Funnel → Day |
| `06-scheduler-gantt.png` | Gantt timeline |
| `06-scheduler-dependencies.png` | Dependency graph |

### Operations (`components/Operations/`)

| File | View |
|------|------|
| `10-operations.png` | Operations home board — name, Shape preset, New Operation; sort / group / Show archived / category filter when ops exist |
| `10-operations-workspace.png` | Operation workspace (Home / To do / Phases / Parts / Log from Settings; **Working on this now** in the menubar) |

### Pending re-captures

The full Home dashboard set was recaptured 2026-09-23: Habits Daily / Weekly /
Monthly (`01-home-*`), Plan Month / Week / Day (`02-home-plan*`), To Do Day /
Week / Month (`03-home-todo*`), Goals (`04-home-goals.png`), and Tracking Time
Grid / week / Activity Log / block editor / Day Log (`08-home-tracking*`).
Sidecars are rewritten from `scripts/screenshot-manifest.mjs` on every run
(`COGS_ONLY` limits that to listed files). Plan capture clicks `.plan95`
**Month / Week / Day** tabs (not the old “Month View” labels).

The capture script opens **Goals** before the header Settings dialog so it does
not collide with Tracking’s selected-pen Settings or Habits Settings.

### Modules (`components/Modules/`)

| File | View |
|------|------|
| `09-modules.png` | Modules dashboard |
| `09-modules-workspace.png` | Itinerary Creator workspace |

### Docs

Not yet in the capture set — open the **Docs** tab manually (`components/Docs/DocsPanel.tsx`). Add a `12-docs*.png` entry here after the next `npm run capture-screenshots` pass once the manifest includes it.

### Analytics (`components/Analytics/`)

**Heart of the app** — collection, presentation, and analysis of the vault.
Light instrument studio with Lists title bar + status bar. Groups on a left
index (Behavior / Time / Accuracy / Meta / Library); views of the selected
group beneath (`role="tab"`). One shared date range. Recapture with `COGS_FRESH=0`
on a loaded vault.

| File | View |
|------|------|
| `07-analytics.png` | Habits density calendar, grades, Good days, climb |
| `07-analytics-points.png` | Points source split + cumulative |
| `07-analytics-velocity.png` | Velocity / cycle time |
| `07-analytics-tracking.png` | Tracking mosaic + hour × day |
| `07-analytics-tracking-breakdown.png` | Pen drill-down |
| `07-analytics-tracking-tag.png` | Tag drill-down |
| `07-analytics-sleep.png` | Sleep — 6pm→noon strip (`~` / **est.**) |
| `07-analytics-screentime.png` | Screen Time — ActivityWatch active vs untracked |
| `07-analytics-circadian.png` | Circadian hour × day |
| `07-analytics-places.png` | Places (Location mosaic) |
| `07-analytics-mood-field.png` | Mood field (cognitive-state) |
| `07-analytics-plan-vs-reality.png` | Plan vs Reality ribbon + capacity |
| `07-analytics-calibration.png` | Duration calibration |
| `07-analytics-cycle.png` | Cycle / stall |
| `07-analytics-streaks.png` | Streaks |
| `07-analytics-reflection.png` | Reflection trajectories |
| `07-analytics-reviews.png` | Reviews + blocked-reason mosaic |
| `07-analytics-overcommit.png` | Overcommit |
| `07-analytics-observatory.png` | Observatory findings + Cross-section |
| `07-analytics-metrics.png` | Metrics small-multiples |
| `07-analytics-correlation.png` | Correlation matrix |
| `07-analytics-context-switch.png` | Context-switch density |
| `07-analytics-regret.png` | Regret ledger |
| `07-analytics-goals.png` | Goals |
| `07-analytics-operations.png` | Operations mosaic |
| `07-analytics-cross-section.png` | Cross-section density |
| `07-analytics-item-types.png` | Item Types library |
| `07-analytics-lists-areas.png` | Lists & areas |
| `07-analytics-attributes.png` | Attributes |

### Global dialogs & detail

| File | View |
|------|------|
| `20-dialog-reviews.png` | Day review dialog |
| `20-dialog-morning-review.png` | Morning review dialog |
| `20-dialog-settings.png` | Settings |
| `20-dialog-inbox.png` | Inbox |
| `20-dialog-bulk-add.png` | Bulk Add |
| `20-dialog-quick-add.png` | Quick Add |
| `20-dialog-global-search.png` | Cmd/Ctrl+K search |
| `20-dialog-time-tracking.png` | Header Tracking dialog |
| `20-dialog-metrics.png` | Metrics logger |
| `21-item-detail-popup.png` | Item detail popup |

---

## Coverage checklist

| App area | Screenshot(s) | Status |
|----------|---------------|--------|
| App shell + 7 top tabs | Visible in all full-page shots | ✅ |
| Global header actions | `20-dialog-*.png` | ✅ |
| Global search (Cmd+K) | `20-dialog-global-search.png` | ✅ |
| Home → Habits (Daily/Weekly/Monthly) | `01-home-*.png` | ✅ |
| Home → Plan (Month/Week/Day) | `02-home-plan*.png` | ✅ |
| Home → To Do (Day/Week/Month) | `03-home-todo*.png` | ✅ |
| Home → Goals | `04-home-goals.png` | ✅ |
| Home → Tracking (Grid/Activity Log/Day Log) | `08-home-tracking*.png` | ✅ |
| Home → Needs Attention banner | Visible in Home shots | ✅ |
| Lists folder views (Icons/List/Details/Cards) | `05-lists*.png` (first four) | ✅ |
| Lists content displays (Default/Checklist/Spreadsheet) | `05-lists-content-*.png` | ✅ |
| Lists: habits/objectives smart entries | Opened via Home + sidebar (same components) | ✅ |
| Scheduler funnel (Always/Day) | `06-scheduler.png`, `06-scheduler-day.png` | ✅ |
| Scheduler Gantt + Dependencies | `06-scheduler-gantt.png`, `06-scheduler-dependencies.png` | ✅ |
| Operations list + workspace | `10-operations*.png` | ✅ |
| Modules dashboard + workspace | `09-modules*.png` | ✅ |
| Docs tab | — | ⏳ not in capture set yet |
| Analytics studio (~26 views) | `07-analytics*.png` | Recapture with `COGS_FRESH=0` |
| Item detail popup | `21-item-detail-popup.png` | ✅ |
| End-of-period reviews | `20-dialog-reviews.png` | ✅ |
| Morning review | `20-dialog-morning-review.png` | ✅ |

### Not separately screenshotted (see notes)

| Area | Why / how to reach |
|------|-------------------|
| Full-screen item detail (`ItemDetailPage`) | Same editor as popup; opened via Operations `onOpenItem` or legacy full-screen route |
| Completion dialog (`CompletionDialog`) | Appears automatically on task completion (`CompletionPopupHost` in layout). Footer: **Undo** (reopen as still to-do), **Skip**, **Save**. |
| Just Start focus mode | Launch from To Do row action (`components/Focus/JustStartMode.tsx`) |
| List/folder dialogs (New List, Settings, CSV import, Orb picker) | Open from Lists toolbar — same chrome as `05-lists.png`. Completed / Missed Opportunities are lists under Next Actions, not toolbar dialogs. |
| Module builder chooser | Momentary step before `09-modules-workspace.png` |
| Module/widget config dialogs | Open from Modules dashboard |
| Docs tab (`DocsPanel`) | Top-level Docs — capture pending |
| Plan Paste Events dialog | Open from Home → Plan → Paste Events |
| Sheet pop-out (`/popout/?sheet=…`) | Separate Electron/window route |
| Module pop-out (`/popout/?module=…`) | Separate Electron/window route |
| Affirmations sub-dialog | Inside Morning review |
| Operation post-mortem dialog | Button in operation workspace header |
| Operation settings dialog | **Settings** on the operation workspace menubar — panels, categories, presets |
| Item Types editor (full) | Settings → Manage Item Types, or Analytics → Library → Item Types → Edit type. Catalog types persist; system Task/Item/Note/Operation are locked. |
| From Notes dialog | Header **From Notes** — this Mac + Notes.app (Electron or localhost `/api/notes`); Playwright on CI without macOS Notes will not list live notes |
| Phone Notes dialog | Header **Phone Notes** — queue of Telegram Shortcut dumps and unmatched texts on **iPhone Notes Store** / **Parked**; empty state is AirDrop `Dump iPhone Notes to Brain2.shortcut` |

---

## Naming convention

`NN-area-feature.png` — numeric prefix groups related views; `.txt` sidecar
matches the PNG basename. Legacy names (`01-home-daily-habits`, `02-home-plan`,
`03-home-todo`, `05-lists`, `06-scheduler`, `07-analytics`, `08-home-tracking`,
`09-modules`) are preserved for existing doc links.
