# Brain2 screenshots

PNG captures of app surfaces, usually with a matching `.txt` write-up (view
path, source files, and the on-screen controls). Sidecars are generated from
`scripts/screenshot-manifest.mjs`. Freshness, file dates, and gaps are the
status table below — this folder is an inventory, not a finished set. The
product is meant to feel like a vintage machine that is also a painting —
motif (brain, light bulb, and graph-node connections used as much as
possible), luminous contents, and room for one impossible motion. Rooms can
keep arriving. The global header is a pinned full-width mill title bar:
navy **BRAIN2** caption, today’s-friend jewel (click for a Stardew Next Action bubble; Esc / × / outside to close), Friend / Review / System / optional **now** well / Capture groupboxes. The **now** well sits between System and Capture only while a Working session is live (name, elapsed, Stop, Pause↔Resume; idle → hidden). **Names** latches in place; tooltip **Stop naming** while on.

**Re-capture:** with `npm run dev` (or `electron:dev`) running on port 3000:

```bash
npm run capture-screenshots
```

Set `COGS_ONLY=…` / `COGS_FRESH=0` / `COGS_URL=…` (historical env names) to limit files, keep localStorage, or point at another origin.
Set `COGS_URL=http://localhost:3000` if the dev server uses a different port.

The capture browser is a fresh headless Chrome context. It does not read the
Electron vault. Before the app boots, init scripts write throwaway Zustand
blobs: a fortnight of tracking (`seedTracking`, including the zoo and Ian’s
examples), sleep, and a vault seed (`brain2-task-storage`,
`brain2-modules-store`, `brain2-goals-store`, `brain2-habits-store`, plus
day/week/season plan logs). That seed is what fills Operations, Docs, Lists,
Scheduler, Goals, and Habits. `POST /api/persist` stays blocked, so a capture
run never publishes that data to the dev persist hub.

Implementation: `scripts/capture-screenshots.mjs` (Playwright) +
`scripts/screenshot-manifest.mjs` (metadata). Older frames are kept by
`scripts/screenshot-archive.mjs` — see Evolution reel.

## Evolution reel

Before a capture overwrites a PNG, `archiveShot` copies that file to
`history/<basename>/<YYYY-MM-DDTHH-mm-ss>.png` (local time; colons in the
clock written as hyphens). The live PNG stays where it is and is the newest
frame. If that archive name already exists, the copy uses `-2`, `-3`, and so
on. History can be empty until the next capture; the current PNG is still a
frame. Dated frames of one screen share one feature record.

```bash
npm run screenshot-reel
```

That refreshes `reel.js`, fills any missing fields in `feature-notes.json`,
and serves this folder. Open the printed URL. A `file://` page can still show
the pictures, but it cannot save notes.

Pick a screen. `<` / `>` and the left and right arrow keys step through older
and newer pictures of that view. Home and End jump to the ends. The page does
not play by itself. The sidecar `.txt` sits under the picture when the browser
can read it.

The right side is that screen’s record: feature name, feature description,
style notes, and a documentation path (`docPath`). **Preview documentation**
renders that markdown under the fields. Save, or leave a field, and the edit
is written to `docs/screenshots/feature-notes.json`. Switching frames does not
clear the record. A saved field is not replaced the next time the index is
built.

---

## Status

Inventory written **Tuesday 6 October 2026**. This table is the only freshness
record for the folder. A row count is not a finished product: rooms can keep
arriving, and the surfaces listed at the bottom still have no file.

**Dates.** The date column is the PNG’s file modification time (local calendar
day). No sidecar records a capture date, so modification time is the date this
table uses.

**How a row was marked.**

- **fresh** — written by `npm run capture-screenshots` on 6 October 2026 against the throwaway seed (headless Chrome, not a personal vault). The Operations board, Docs home, and Scheduler Always frames were looked at after that run.
- **unknown** — `habits-noble-gas-rail.png` is a Habits control-panel crop from 20 September 2026. It has no sidecar and was not part of this capture.
- **stale** — none in this inventory.
- **missing** — none. Screen Time and Docs both have PNGs.

**Counts (6 October 2026).** 97 PNG files. 96 `.txt` sidecars. 96 PNGs have a sidecar. 1 PNG has no sidecar (`habits-noble-gas-rail.png`). 0 sidecars without a PNG. Rows: 96 fresh, 0 stale, 1 unknown, 0 missing.

**Reading note.** These frames show the throwaway seed, not a personal vault. Tracking still includes the zoo and Ian’s examples. Screen Time shows ActivityWatch only when a watcher is already running on the capture machine; the script does not invent that data.

| File | Date | Status | View |
|------|------|--------|------|
| `01-home-daily-habits.png` | 2026-10-06 | fresh | Home → Habits → Daily |
| `01-home-habits-monthly.png` | 2026-10-06 | fresh | Home → Habits → Monthly |
| `01-home-habits-weekly.png` | 2026-10-06 | fresh | Home → Habits → Weekly |
| `02-home-plan-day.png` | 2026-10-06 | fresh | Home → Plan → Day |
| `02-home-plan-season.png` | 2026-10-06 | fresh | Home → Plan → Season |
| `02-home-plan-week.png` | 2026-10-06 | fresh | Home → Plan → Week |
| `02-home-plan.png` | 2026-10-06 | fresh | Home → Plan → Month |
| `03-home-todo-just-start.png` | 2026-10-06 | fresh | To Do → Start (Just Start) |
| `03-home-todo-month.png` | 2026-10-06 | fresh | Home → To Do → Month |
| `03-home-todo-week.png` | 2026-10-06 | fresh | Home → To Do → Week |
| `03-home-todo.png` | 2026-10-06 | fresh | Home → To Do → Day |
| `04-home-goals.png` | 2026-10-06 | fresh | Home → Goals |
| `05-lists-cards.png` | 2026-10-06 | fresh | Lists → Home folder → Cards |
| `05-lists-content-checklist.png` | 2026-10-06 | fresh | Lists → Example List → Checklist |
| `05-lists-content-default.png` | 2026-10-06 | fresh | Lists → Example List → Default |
| `05-lists-content-spreadsheet.png` | 2026-10-06 | fresh | Lists → Example List → Spreadsheet |
| `05-lists-details.png` | 2026-10-06 | fresh | Lists → Home folder → Details |
| `05-lists-list.png` | 2026-10-06 | fresh | Lists → Home folder → List |
| `05-lists.png` | 2026-10-06 | fresh | Lists → Home folder → Icons |
| `06-scheduler-day.png` | 2026-10-06 | fresh | Scheduler → Funnel → Day |
| `06-scheduler-dependencies.png` | 2026-10-06 | fresh | Scheduler → Dependencies |
| `06-scheduler-gantt.png` | 2026-10-06 | fresh | Scheduler → Gantt |
| `06-scheduler.png` | 2026-10-06 | fresh | Scheduler → Funnel → Always |
| `07-analytics-attributes.png` | 2026-10-06 | fresh | Analytics → Attributes |
| `07-analytics-calibration.png` | 2026-10-06 | fresh | Analytics → Calibration |
| `07-analytics-circadian.png` | 2026-10-06 | fresh | Analytics → Circadian |
| `07-analytics-context-switch.png` | 2026-10-06 | fresh | Analytics → Context switch |
| `07-analytics-correlation.png` | 2026-10-06 | fresh | Analytics → Correlation |
| `07-analytics-cross-section.png` | 2026-10-06 | fresh | Analytics → Cross-section |
| `07-analytics-cycle.png` | 2026-10-06 | fresh | Analytics → Cycle |
| `07-analytics-diversity.png` | 2026-10-06 | fresh | Analytics → Diversity |
| `07-analytics-goals.png` | 2026-10-06 | fresh | Analytics → Goals |
| `07-analytics-item-types.png` | 2026-10-06 | fresh | Analytics → Item Types |
| `07-analytics-lists-areas.png` | 2026-10-06 | fresh | Analytics → Lists & areas |
| `07-analytics-metrics.png` | 2026-10-06 | fresh | Analytics → Metrics |
| `07-analytics-mood-field.png` | 2026-10-06 | fresh | Analytics → Mood field |
| `07-analytics-observatory.png` | 2026-10-06 | fresh | Analytics → Observatory |
| `07-analytics-operations.png` | 2026-10-06 | fresh | Analytics → Operations |
| `07-analytics-overcommit.png` | 2026-10-06 | fresh | Analytics → Overcommit |
| `07-analytics-places.png` | 2026-10-06 | fresh | Analytics → Places |
| `07-analytics-plan-vs-reality.png` | 2026-10-06 | fresh | Analytics → Plan vs Reality |
| `07-analytics-points.png` | 2026-10-06 | fresh | Analytics → Points |
| `07-analytics-reflection.png` | 2026-10-06 | fresh | Analytics → Reflection |
| `07-analytics-regret.png` | 2026-10-06 | fresh | Analytics → Regret |
| `07-analytics-reviews.png` | 2026-10-06 | fresh | Analytics → Reviews |
| `07-analytics-screentime.png` | 2026-10-06 | fresh | Analytics → Screen Time |
| `07-analytics-sleep.png` | 2026-10-06 | fresh | Analytics → Sleep |
| `07-analytics-spectrum.png` | 2026-10-06 | fresh | Analytics → Spectrum |
| `07-analytics-stages.png` | 2026-10-06 | fresh | Analytics → Stages |
| `07-analytics-streaks.png` | 2026-10-06 | fresh | Analytics → Streaks |
| `07-analytics-tags.png` | 2026-10-06 | fresh | Analytics → Tags |
| `07-analytics-tracking-breakdown.png` | 2026-10-06 | fresh | Analytics → Tracking pen drill-down |
| `07-analytics-tracking-tag.png` | 2026-10-06 | fresh | Analytics → Tracking tag drill-down |
| `07-analytics-tracking.png` | 2026-10-06 | fresh | Analytics → Tracking |
| `07-analytics-transitions.png` | 2026-10-06 | fresh | Analytics → Transitions |
| `07-analytics-velocity.png` | 2026-10-06 | fresh | Analytics → Velocity |
| `07-analytics-weight.png` | 2026-10-06 | fresh | Analytics → Weight |
| `07-analytics.png` | 2026-10-06 | fresh | Analytics → Habits |
| `08-home-tracking-activity.png` | 2026-10-06 | fresh | Home → Tracking → Activity Log |
| `08-home-tracking-block.png` | 2026-10-06 | fresh | Home → Tracking → block editor |
| `08-home-tracking-daylog.png` | 2026-10-06 | fresh | Home → Tracking → Day Log |
| `08-home-tracking-week.png` | 2026-10-06 | fresh | Home → Tracking → week span |
| `08-home-tracking.png` | 2026-10-06 | fresh | Home → Tracking → Time Grid |
| `09-modules-workspace.png` | 2026-10-06 | fresh | Modules → Itinerary Creator workspace |
| `09-modules.png` | 2026-10-06 | fresh | Modules → dashboard |
| `10-operations-locations.png` | 2026-10-06 | fresh | Operations → Locations |
| `10-operations-log.png` | 2026-10-06 | fresh | Operations → Log |
| `10-operations-parts.png` | 2026-10-06 | fresh | Operations → Parts |
| `10-operations-phases.png` | 2026-10-06 | fresh | Operations → Phases |
| `10-operations-plan.png` | 2026-10-06 | fresh | Operations → Plan |
| `10-operations-postmortem.png` | 2026-10-06 | fresh | Operations → After-action report |
| `10-operations-resources.png` | 2026-10-06 | fresh | Operations → Resources |
| `10-operations-settings.png` | 2026-10-06 | fresh | Operations → Settings |
| `10-operations-timeline.png` | 2026-10-06 | fresh | Operations → Timeline |
| `10-operations-todo.png` | 2026-10-06 | fresh | Operations → To do |
| `10-operations-workspace.png` | 2026-10-06 | fresh | Operations → Home panel |
| `10-operations.png` | 2026-10-06 | fresh | Operations → home board |
| `12-docs-reading.png` | 2026-10-06 | fresh | Docs → open document |
| `12-docs.png` | 2026-10-06 | fresh | Docs → folder homepage |
| `20-dialog-bulk-add.png` | 2026-10-06 | fresh | Bulk Add dialog |
| `20-dialog-completion.png` | 2026-10-06 | fresh | Completion dialog |
| `20-dialog-global-search.png` | 2026-10-06 | fresh | Global search dialog |
| `20-dialog-inbox.png` | 2026-10-06 | fresh | Inbox dialog |
| `20-dialog-metrics.png` | 2026-10-06 | fresh | Metrics dialog |
| `20-dialog-morning-review.png` | 2026-10-06 | fresh | Morning review dialog |
| `20-dialog-quick-add.png` | 2026-10-06 | fresh | Quick Add dialog |
| `20-dialog-reviews.png` | 2026-10-06 | fresh | Day review dialog |
| `20-dialog-settings.png` | 2026-10-06 | fresh | Settings dialog |
| `20-dialog-time-tracking.png` | 2026-10-06 | fresh | Header Tracking dialog |
| `21-item-detail-analysis.png` | 2026-10-06 | fresh | Item detail → Analysis |
| `21-item-detail-body.png` | 2026-10-06 | fresh | Item detail → Body |
| `21-item-detail-dependencies.png` | 2026-10-06 | fresh | Item detail → Dependencies |
| `21-item-detail-popup.png` | 2026-10-06 | fresh | Item detail → Details |
| `21-item-detail-scheduling.png` | 2026-10-06 | fresh | Item detail → Scheduling |
| `21-item-detail-subtasks.png` | 2026-10-06 | fresh | Item detail → Subtasks |
| `21-item-detail-time.png` | 2026-10-06 | fresh | Item detail → Time |
| `habits-noble-gas-rail.png` | 2026-09-20 | unknown | Habits control-panel crop; no sidecar |

---

## Global chrome (every screen)

Rendered by `app/page.tsx`:

| Control | Component | Purpose |
|---------|-----------|---------|
| Nav | `components/header-nav-buttons.tsx` | Back / Forward through in-app screens (tabs, Lists folders, full-page item detail). Disabled at stack edges. |
| Today's friend | `components/baby-animal-nest.tsx` | Photograph in a chrome + black-mirror jewel on the pin bar. Persists until Monday or a manual change (`cogs-friend-worn`). Returning friends may say Hi again. Click the photograph for details. The chat button above Gallery asks for a Stardew line (daily habit / today's To Do / Next Action, species bias). Click the **line** (no bevel) for the mission sheet: the task opens item detail on top; Accept until the end of the day; Decline asks for smaller tasks, then a first step, then a reason. **Escape**, ×, or a click outside closes the bubble. **Gallery** holds the preapproved `animalsrcs/` pack (unnamed until you name them) — the only picture sources are that pack and your own uploads. Name field, equal cards, confirm-before-delete (dismissed stay gone); **navy** text-field focus (never orange). Pictures in `cogs-friend-pic:*` or `/friend-pack/`. Plan: [`docs/FRIEND_COMPANION.md`](../FRIEND_COMPANION.md). |
| Names | `components/AppHeader.tsx` | System-group latch. Caption stays **Names**; sunken + `aria-pressed` while on (tooltip **Stop naming**). |
| now | `components/header-now-box.tsx` | Optional groupbox between System and Capture. Live Operations / pen-color Working sessions (name, tabular elapsed, Stop, Pause↔Resume); absent when idle. |
| Review (badge) | `components/Reviews/reviews.tsx` | Rituals menu (day sun/moon; week–year Start / Review) |
| Morning | `components/Reviews/MorningReview.tsx` | Day morning ritual (wake, dream, intentions, affirmations, postpone) |
| Settings | `components/Settings/SettingsDialog.tsx` | Home city, assumed finish time, backup, sync, **message ingest** (grocery pin, always-on hub, shortcuts, iPhone Notes / Screen Time / Call / Text Shortcut AirDrop), **Screen Time** (ActivityWatch), item types, Second Brain |
| Tracking | `components/cognitive-state.tsx` | Compact Time Grid dialog |
| Inbox | `components/inbox.tsx` | Unclarified captures |
| Ingest | `components/ingest-log-dialog.tsx` | Phone-message ingest log. GPS tracking points hidden unless **Show GPS** |
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
| `01-home-habits-monthly.png` | Habits → Monthly sheet (year so far through this month) + span grade |
| `02-home-plan.png` | Plan → Month |
| `02-home-plan-week.png` | Plan → Week |
| `02-home-plan-day.png` | Plan → Day |
| `02-home-plan-season.png` | Plan → Season (quarter) |
| `03-home-todo.png` | To Do → Day |
| `03-home-todo-week.png` | To Do → Week |
| `03-home-todo-month.png` | To Do → Month |
| `03-home-todo-just-start.png` | To Do row → Start (Just Start focus mode) |
| `04-home-goals.png` | Goals → objectives & direction report |
| `08-home-tracking.png` | Tracking → Time Grid in a Win95 window (plain steel pen well, Sort Recent / A–Z / Tree / Expand↔Conceal, + New pen under the beads, occupancy) |
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
| `10-operations.png` | Operations home board — seeded operation cards (Coast weekend, October class handout), plus name, Shape preset, New Operation |
| `10-operations-workspace.png` | Operation Home panel — mission, stage, notes, logged time |
| `10-operations-todo.png` | To do |
| `10-operations-phases.png` | Phases |
| `10-operations-parts.png` | Parts |
| `10-operations-timeline.png` | Timeline |
| `10-operations-locations.png` | Locations |
| `10-operations-plan.png` | Plan |
| `10-operations-resources.png` | Resources |
| `10-operations-log.png` | Log |
| `10-operations-settings.png` | Settings dialog |
| `10-operations-postmortem.png` | After-action report dialog |

### Capture mechanics

Sidecars are rewritten from `scripts/screenshot-manifest.mjs` on every run
(`COGS_ONLY` limits that to listed files). A rewritten sidecar is not a new
PNG — file dates and freshness stay in the status table. Plan capture clicks
`.plan95` **Month / Week / Day** tabs (not the old “Month View” labels).

The capture script opens **Goals** before the header Settings dialog so it does
not collide with Tracking’s selected-pen Settings or Habits Settings.

### Modules (`components/Modules/`)

| File | View |
|------|------|
| `09-modules.png` | Modules dashboard |
| `09-modules-workspace.png` | Itinerary Creator workspace |

### Docs (`components/Docs/`)

| File | View |
|------|------|
| `12-docs.png` | Docs homepage — folders and recent documents |
| `12-docs-reading.png` | An open document (Coast weekend plan) |

### Analytics (`components/Analytics/`)

**Heart of the app** — collection, presentation, and analysis of the vault.
Light instrument studio with Lists title bar + status bar. Groups on a left
index (Behavior / Time / Accuracy / Meta / Library); views of the selected
group beneath (`role="tab"`). One shared date range. The capture seed fills
Tracking and Habits; Screen Time still depends on a local ActivityWatch watcher.

| File | View |
|------|------|
| `07-analytics.png` | Habits density calendar, grades, Good days, climb |
| `07-analytics-points.png` | Points source split + cumulative |
| `07-analytics-velocity.png` | Velocity / cycle time |
| `07-analytics-tracking.png` | Tracking mosaic + hour × day |
| `07-analytics-tracking-breakdown.png` | Pen drill-down |
| `07-analytics-tracking-tag.png` | Tag drill-down |
| `07-analytics-sleep.png` | Sleep — 6pm→noon strip (`~` / **est.**) |
| `07-analytics-screentime.png` | Screen Time — ActivityWatch active vs untracked, when a watcher is already running |
| `07-analytics-circadian.png` | Circadian hour × day |
| `07-analytics-places.png` | Places (Location mosaic) |
| `07-analytics-mood-field.png` | Mood field: any painted name, How to read this, Same word / The water / Marks |
| `07-analytics-diversity.png` | Diversity |
| `07-analytics-transitions.png` | Transitions |
| `07-analytics-spectrum.png` | Spectrum |
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
| `07-analytics-tags.png` | Tags |
| `07-analytics-stages.png` | Stages |
| `07-analytics-weight.png` | Weight |

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
| `20-dialog-completion.png` | Completion dialog (Undo reopens the task so the run can continue) |
| `21-item-detail-popup.png` | Item detail → Details |
| `21-item-detail-scheduling.png` | Item detail → Scheduling |
| `21-item-detail-dependencies.png` | Item detail → Dependencies |
| `21-item-detail-subtasks.png` | Item detail → Subtasks |
| `21-item-detail-analysis.png` | Item detail → Analysis |
| `21-item-detail-time.png` | Item detail → Time |
| `21-item-detail-body.png` | Item detail → Body |

---

## Surfaces without their own file

Whether a file is fresh, stale, unknown, or missing is only in the status
table above.

### Not separately screenshotted

| Area | Why / how to reach |
|------|-------------------|
| Full-screen item detail (`ItemDetailPage`) | Same editor as the popup tabs (`21-item-detail-*`); opened via Operations `onOpenItem` or the legacy full-screen route |
| List/folder dialogs (New List, Settings, CSV import, Orb picker) | Open from Lists toolbar — same chrome as `05-lists.png`. Completed / Missed Opportunities are lists under Next Actions, not toolbar dialogs. |
| Module builder chooser | Momentary step before `09-modules-workspace.png` |
| Module/widget config dialogs | Open from Modules dashboard |
| Plan Paste Events dialog | Open from Home → Plan → Paste Events |
| Sheet pop-out (`/popout/?sheet=…`) | Separate Electron/window route |
| Module pop-out (`/popout/?module=…`) | Separate Electron/window route |
| Affirmations sub-dialog | Inside Morning review |
| Item Types editor (full) | Settings → Manage Item Types, or Analytics → Library → Item Types → Edit type. Catalog types persist; system Task/Item/Note/Operation are locked. |
| From Notes dialog | Header **From Notes** — this Mac + Notes.app (Electron or localhost `/api/notes`); Playwright without macOS Notes will not list live notes |
| Phone Notes dialog | Header **Phone Notes** — queue of Telegram Shortcut dumps and unmatched texts on **iPhone Notes Store** / **Parked**; empty state is AirDrop `Dump iPhone Notes to Brain2.shortcut` |

---

## Naming convention

`NN-area-feature.png` — numeric prefix groups related views; `.txt` sidecar
matches the PNG basename. Legacy names (`01-home-daily-habits`, `02-home-plan`,
`03-home-todo`, `05-lists`, `06-scheduler`, `07-analytics`, `08-home-tracking`,
`09-modules`) are preserved for existing doc links. Older frames of that same
basename live in `history/<basename>/<YYYY-MM-DDTHH-mm-ss>.png`. They are not
new shots. See Evolution reel.
