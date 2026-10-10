# Plan of action

Every wave is **done**, **open**, or **do not start**. Wave numbers are names, not a queue. No wave waits on an earlier one. Design lives in [`DESIGN_STYLE.md`](DESIGN_STYLE.md). This file does not add a visual manifesto.

Brain2 keeps a record once and uses it in every room that record can honestly serve. Analytics is where the record is read back. The header mark is **BRAIN2**. Persist keys are **`brain2-*`** (`lib/storage-keys.ts`). Leftover **`cogs-*`** keys dual-write only at or under 8192 characters. A matching twin is removed. A drifted twin is kept because it may hold the newer value. A record stays dated, incomplete, and at its own order of abstraction. Description stays distinct from inference. The next period starts where the last one stopped. A miss between an order and its report is the next input. A coincidence is shown and is never called a cause. How those ideas join is [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md). The essays that explore them are source material and are not assigned (below).

Home → Habits and Lists are examples of rooms that turned out well. Their CSS is not a skin for every other room.

---

## Protect

Frame, contents, and cabinet law live in [`DESIGN_STYLE.md`](DESIGN_STYLE.md). House motifs — brain, light bulb, graph-node connections — stay in use. The frame stays a vintage machine. Contents stay specific. The cabinet stays photographed objects and orbs. The frame is not frozen as a Windows dialog.

- **`~` + dashed amber est.** Basis in the tooltip, click to correct (`lib/estimated-values.ts`, `components/Home/ToDo/CompletionTimeLine.tsx`). The same chip covers every derived number that still presents itself as observed. Wave 4 names the surfaces that already have it and the ones that do not.
- **Feral module interiors** — Tidy, Film DNA, Trip map. Unique look, shared Items. They stay out of `components/ui/`.
- **Lists and Habits** — examples of rooms that turned out well (Lists orbs, velvet, Explorer furniture; Habits console, analog furniture, Willpower gems, CRT phosphor). Refine packing on those rooms. Leave the Habits console a console. Leave the Lists title bar an Explorer title bar. Do not clone `.hab95` or Lists chrome onto other rooms.
- **Tracking** — paint, scissors, occupancy at most 24h, ghosts to confirm, sleep that agrees with the grid. The pen well stays plain steel. Paint math, the counts-as model, and pen nesting stay ([`COUNTS_AS.md`](COUNTS_AS.md), [`PEN_ACTION_FORMATS.md`](PEN_ACTION_FORMATS.md)).
- **Working Now** — one gesture writes the Done row, `timeLogs`, the Tracking block, and habits. Stop stays one click. On an operation it outranks Settings and stays a Win95 control (Wave 6).
- **Cmd-K** over the current screen, colon-path capture, and undo of real writes (`lib/action-history.ts`, wired in `app/page.tsx`).
- **Win95 safety** — confirmation plus undo. Grade destructiveness from the running app. Delete stays quieter than the primary action, and smaller than a same-row ⚙.

---

## Do not

These are closed. [`UI_CRITIQUE.md`](UI_CRITIQUE.md) is an unranked observation dump; do not execute it in order. After a populated recapture, delete critique items that were only zeros.

- **Empty rails stay.** Queue, Plan sidebar, funnel buckets, and KPI frames keep their reserved space when the last item is gone. That space is furniture. A chart axis that performs precision with no series is a lie: keep the frame, put one sentence inside it.
- **Doors stay on the bar.** Tracking pens, To Do sort and filter, and header capture stay visible. Do not add a File menu. Do not hide them behind one popover or a `File / Capture / Review` menu.
- **Streaks stay split.** Home glance and Analytics → Streaks may show the same number. They stay two surfaces.
- **Lists keeps both counts.** The left count is sidebar scope. The right count is the open location. Labels are the fix. Deleting one count is not.
- **One write door.** Implementation is `task-store`. UI and ingest call `useTaskStore` directly. `taskRepository` is the validating seam for services and sync (completion, scheduling, habit-done, sleep, pen actions, work sessions, implied actions). It is not what most screens call. New code writes an existing item through `commitItemEdit` (`lib/commit-item-edit.ts`). Existing `useTaskStore` calls stay. Workflows and implied actions listen through `dispatchItemMutation`. `lib/services/item-mutation-service.ts` is workflow wiring. Writes do not go through it.
- **Do not wire Just-Start → Tracking.** Do not add capture tokens (`tomorrow` and `30m` already parse). Do not add an inline Done **est.** confirm; `CompletionTimeLine` already does that.
- **Do not add** reusable list-rule packs, attribute-schema inheritance, synced operation-panel presets, a custom Metrics chart builder, or a user-extensible Telegram grammar. Creating an operation from a preset already exists; that stays.
- **Do not extract `PeriodNavigator`.** Period is data (Wave 3). Chevrons stay on each surface. Habits’ milled `habit-chrome-btn` keys stay on Habits.
- **Goals keeps two controls.** “Priority this period” and “goals of this kind” stay separate. Label them. Do not merge them (Wave 3).
- **Do not sand** installed module interiors into `components/ui/`.
- **Do not restart collapsing `Task` into `Item`.** `Item.title` is the field of record (persist v11–v12, `itemTitle()`, `lib/item-title-reads.test.ts`). `Task` remains the persisted document (`ItemRecord = Task`). Task-kind fields stay on `Task`.
- **Do not start a shared S/M/L dialog ladder.** Three widths would freeze every room. A dialog’s buttons state whether it saves or is live. Cancel is present wherever Save exists. That is the rule; a width ladder is not.
- **Do not extract shared calendar chrome** between Plan and Scheduler. Plan opalescence stays on the chips. Cells stay as they are.
- **Editable Gantt, commitment versus hours, and auto carry-over** are mechanics, not chrome. They are not started, and they do not reopen Wave 2.
- **Out of Analytics:** CSV export, predictive or ML analytics, a custom Metrics chart builder. Sleep in Analytics does not switch the Home night; that would require `app/page.tsx`, and it stays out.
- **Out of the idea-bank ten** (Wave 11 is done; these stay out): velocity chart, PERT capture UI, ghost row, named weeks, definition-of-done field UI, Bayesian estimator, review-history charts, capacity score, idea flags, priority override log, procedure chains, summary auto-complete, Kanban back on Lists, auto-picking 52:17 from cognitive load, and a nanny that reschedules the day.
- **“Usually ~N”** does not rewrite `estimatedDuration` and does not grow `beatTheClockMultiplier`.
- **Whole-store IndexedDB, WAL, `PersistStatusBanner` as a verified write, and an append-only per-field log** wait until parked-note naming in Wave 10 is closed. They are not screen work.

---

## Judging a change

- Judge the open screen. A README or [`DESIGN_STYLE.md`](DESIGN_STYLE.md) alone is not a UI fix.
- Habits and Lists are examples of rooms that turned out well. A new room follows [`DESIGN_STYLE.md`](DESIGN_STYLE.md). It does not wear another room’s stylesheet.
- Recapture the `docs/screenshots/*.png` + `.txt` pair you changed, in the same step. The house set is a seeded-store capture (Wave 0). A personal-vault `COGS_FRESH=0` pass is still open.
- Empty and populated both matter. A chart that looks finished at zero is a bug. Default `npm run capture-screenshots` clears localStorage (`COGS_FRESH`) and then writes a throwaway vault (tracking, sleep, tasks, operations, modules, goals, habit completions, plan logs). That harness is not the product, and it never posts to `/api/persist`.
- Count what you name. View kinds equal the real `MODULE_VIEW_KINDS` length.
- Two controls that can disagree are two sources of truth. Two surfaces glancing at one fact are fine.
- A new room has Win95 furniture and photographed objects, unless the interior is a document (a spreadsheet) or an allowed feral module.

---

## Waves

| Wave | Name | Status |
|------|------|--------|
| 0 | Screenshots | **open** |
| 1 | Analytics correctness | **done** |
| 2 | Plan and Scheduler chrome | **done** |
| 3 | Period as data | **open** |
| 4 | Est. marks | **open** |
| 5 | Lists | **done** |
| 6 | Tracking diet and Working Now | **open** |
| 7 | House chrome | **open** |
| 8 | Operations, Docs, Modules | **open** |
| 9 | History, restore, workflows | **open** |
| 10 | Ontology | **open** |
| 11 | Idea-bank top 10 | **done** |
| 12 | Wiki links, PDF provenance, doc versions | **open** |
| 13 | Map essay (GS) | **do not start** |
| 14 | Meaning essay (JG) | **do not start** |
| 15 | Loop essay (CY) | **do not start** |

### Wave 0 — Screenshots — **open**

Files: `scripts/screenshot-manifest.mjs`, `scripts/capture-screenshots.mjs`, `docs/screenshots/`.

**Landed.** The capture browser seeds a throwaway vault before boot (two operations, phases, parts, a linked to-do, a time log, timeline days, a place, a plan note, a resource, lists with several items, one objective, one goal, habit completions, plan logs, tracking, sleep). Docs is `12-docs.png` and `12-docs-reading.png`. Operations has one shot per panel that is not only Home, plus Settings and the after-action report. Item detail tabs, the completion dialog, Just Start, and Plan → Season are in the set. Older frames are copied to `docs/screenshots/history/` before overwrite.

**Open.** One Modules workspace that is not a trip (`09-modules-workspace.png` is still Itinerary Creator). A personal-vault pass (`COGS_FRESH=0`) when local data should be the picture. Surfaces that still have no file stay listed in [`screenshots/README.md`](screenshots/README.md).

### Wave 1 — Analytics correctness — **done**

Lane: `components/Analytics/**`. Shared date state is `analytics-range-store.ts`.

Shipped: sample size and a caveat on thin interpretive tabs; one remembered date range across Analytics tabs; a jump from a chart to the underlying items in Lists; one honest sentence inside an empty chart frame; tab groups on a bar (Behavior / Time / Accuracy / Meta / Library) with a view changer beneath; habit bars by completion; Tracking breakdown and tag in one drill; Plan vs Reality as a window ribbon; Context Switch, Regret, Metrics, and Reflection honesty; cross-section density and the Item Types library. Item Types stays in Analytics. Settings still edits types. The title bar and status bar stay an instrument frame. Streaks stayed split on purpose.

### Wave 2 — Plan and Scheduler chrome — **done**

Plan (`components/Home/Plan/**`) is a Win95 window (`.plan95`): gray calendar, events with a time range, wrapped title, `+N more`, and a tooltip; a reserved empty rail; a capacity line of planned minutes against the waking window. Plan stays on `useCurrentDate`.

Scheduler (`components/Scheduler/**`) is the same family (`.sch95`): a human title-bar caption; Funnel / Gantt / Dependencies as view modes; Always→Day as periods; empty buckets as one-line furniture; orbs on task cards. Drag into buckets stays the mechanic.

### Wave 3 — Period as data — **open**

Period is one fact. Chevrons stay local. There is no shared `PeriodNavigator`.

**Landed.** To Do’s day lens uses the Home header date. The dashboard passes `currentDate` / `setCurrentDate` into `todo-panel.tsx`. Week, month, and season nameplates stay local.

**Open.** Habits has its own cursor (`components/Home/Habits/habits-period-cursor.ts`). That cursor is the same fact as the header date. The milled Habits keys stay Habits’.

**Open.** Goals’ two controls are still unlabeled, and they stay two controls. Label one “priority this period” (objectives: Day / Week / Month / Year / All) and the other “goals of this kind” (the period-kind filter).

### Wave 4 — Est. marks — **open**

One chip: `~`, dashed amber, **est.**, basis in the tooltip, click to correct (`lib/estimated-values.ts`). Audit, then mark. A second chip language is a bug.

**Already marked.** To Do Done, Analytics sleep, and Reviews assumed times.

**Open.** Morning Review, Day Log, Goals, Settings sleep copy, and Scheduler durations. Settings copy that *is* the estimate belongs in the chip tooltip.

### Wave 5 — Lists — **done**

Lane: `components/Lists/**`, `filemanager98.css`.

Shipped: Explorer toolbar separators; labels on the two status counts (both kept); a wider default icon grid; orbs as the default display, with a checkbox when the list is a checklist; an inspector whose Delete is gray, separated, and confirmed; one title bar, with the inner caption as the display mode. Lists remains an example of a room that turned out well. Other rooms do not wear its stylesheet, and Lists does not wear the Habits cockpit.

### Wave 6 — Tracking diet and Working Now — **open**

**Landed (Tracking).** The sleep-this-day form is off Tracking (paint, the block editor, and Morning Review hold sleep). The grid opens on the first unpainted waking hour. Cell size, From/To defaults, and view options live in View settings. **+ New pen** sits under the beads when the well is expanded. The pen well is plain steel. **est.** stays on the sleep clocks that already have it (Wave 4 lists the clocks that do not).

**Landed (global Working Now).** `components/header-now-box.tsx` is mounted from `AppHeader`. Stop is one click from any room, including Lists, Docs, and Scheduler. Home Tracking’s write path stays.

**Open.** On an operation, Working Now sits after Settings (`components/Operations/OperationWorkspace.tsx` menubar). It comes before Settings, and it stays a Win95 control.

### Wave 7 — House chrome — **open**

**Landed.** Header groups: Friend, Rituals, System, and Capture, with the now well inside Capture while a session is live. Quick Add stays in Capture. Doors stay on the bar. The Home strip — date, Review, points, Today’s Progress — is one instrument on Habits, Plan, To Do, Goals, and Tracking. The Habits console landed, including the WILLPOWER rail. Those are examples of rooms that turned out well. Detail is in [`DESIGN_STYLE.md`](DESIGN_STYLE.md) and [`DESIGN_REFS.md`](DESIGN_REFS.md). Do not clone that CSS onto other rooms, and do not restyle the console or the rail from this file.

**Open.** The review ritual “not now, ask tomorrow,” so Dismiss is not the only way past a real deadline. Peek stays the full-width `HomeReviewBanner`.

**Do not start.** A shared S/M/L dialog ladder. It would freeze every room to three widths.

### Wave 8 — Operations, Docs, Modules — **open**

**Landed.** Creating an operation from a preset. The empty Queue stays docked; empty is information.

**Open (Docs).** No saved-time status (the status bar should read `Saved 12:07`, not paste tips). The `12-docs` capture is Wave 0 and is on disk.

**Open (Modules board).** Orb identity, and an explanation of workspace versus widget. Chrome only: `components/Modules/` board, not Tidy, Film DNA, or Trip. The title bar is a caption, not a bordered input. Installing a room should feel like putting a cabinet in the house.

### Wave 9 — History, restore, workflows — **open**

**Landed.** Per-item history: `lib/item-activity.ts` and the Item Detail History tab. Last-write undo stays `lib/action-history.ts`. Selective restore: `previewBackup` and `restoreBackup(backup, { storeKeys, mode })`, Settings checkboxes, merge or replace, Win95 confirm. `data/recovery-backups/` is a read-only source through GET `/api/recovery-backups` when that folder exists.

**Open.** Workflow dry-run (the engine can omit the adapter) and a run log in the UI, inspectable before the run is trusted. Files: `lib/workflow-engine.ts` and the workflow UI.

**Do not start** beside this wave: whole-store IndexedDB, WAL, `PersistStatusBanner` as a verified write, and an append-only per-field log. They wait until Wave 10’s parked-note naming is closed.

### Wave 10 — Ontology — **open**

Not started. Files: `lib/types.ts`, `lib/task-store.ts`, `lib/migrations.ts`, `lib/item-utils.ts`, `lib/search.ts`, [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md).

`Item.title` is already the field of record. Do not restart collapsing `Task` into `Item`.

1. Parked-note body still lives in `description`, because search indexes `description` and not `body`. Index `body`, move the note text there, then make `description` a title mirror. Write the migration. Keep a read shim for a release.
2. UI and ingest call `useTaskStore` directly. `taskRepository` is the validating seam for services and sync. New code uses `commitItemEdit`. Existing `useTaskStore` calls stay. Name the cross-store transaction that habit-tracking-sync, sleep-sync, work-session, points, and action-history already form.
3. `module.config.houseCleaning` and `module.config.tripItinerary` are still private records. Port them onto Items. Leave stylesheets untouched. Tidy subareas and trip stops then show up in Cmd-K, Scheduler, ingest, and Analytics.
4. Habits, sleep, minutes, and plan prose stay fast projections of Items.
5. Module rungs 2–4, as [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md): manifest and grants the user approves once, visibly; an install wizard with a dry-run; LLM mapping assist at install time only.
6. Every `habit-tracking-sync.ts` auto-fill carries a `FieldEstimate` and **est.**, with a derived-versus-ticked glyph. Same chip as Wave 4.

### Wave 11 — Idea-bank top 10 — **done**

The ten gaps from the realistic slice of [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md) shipped. Do not rebuild them, and do not rebuild the older slice that was already in the product (Gantt/CPM, Plan banners, backup JSON, nested lists, formulas, Docs, operations phases / next-rail / post-mortem, Direction report, carry-over, event checklists, smart-parse, capture hotkey, priority weights, Metrics change-points, Kanban-in-Modules).

1. Item history and selective restore (also Wave 9).
2. Needs Attention: neglect and zombies.
3. Available-now filter (default off, `cogs-todo-prefs`).
4. Block dependency cycles on edit. Gantt may still draw a cycle that already exists.
5. “Usually takes you N min” (`usualDurationMinutes`), dashed amber **usually ~N**, without rewriting `estimatedDuration`.
6. Past days dimmed on Plan month/week; clicking a month day opens that Day.
7. Inbox walk and batch, with undo.
8. Focus timer appends a `timeLogs` slice. Stop stays one click.
9. WIP warning, soft cap, default 3 in progress, no hard block.
10. Overcommitment early-warning on the shared Analytics range (Behavior → Overcommit): one sentence plus n.

### Wave 12 — Wiki links, PDF provenance, doc versions — **open**

Not started. The Wave 11 gate is satisfied. This wave does not wait on another wave.

Wiki `[[links]]` that resolve to Items, PDF page provenance, and version history on doc bodies. The work is the second-brain loop (sweep, paint, confirm, one write that becomes many records). More tabs, more cards, and a Lucide set are not this wave.

---

## Below — essays, not assigned

**Do not start.** Waves 13, 14, and 15 are below the plan. The essays are source material, not the build queue. Slice names live in the essays. They are not work, and nothing above waits on them. Product chrome does not name the books.

- **Wave 13 — do not start.** [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3. Slices GS-1 through GS-10.
- **Wave 14 — do not start.** [`JungBrain2.md`](JungBrain2.md). Slices JG-1 through JG-10. Calendar quarters in `lib/seasons.ts` (Spring / Summer / Fall / Winter) are a shipped period. They are not JG-9.
- **Wave 15 — do not start.** [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3. Slices CY-1 through CY-11.

---

## Lanes

When two people work at once, claim a lane and leave the other lane’s files alone. Lanes are file ownership. They are not an order. **AMAP** means as much as possible ([`.cursor/rules/amap.mdc`](../.cursor/rules/amap.mdc)): parallelize independent work when asked.

| Lane | Owns | Leaves alone |
|------|------|----------------|
| Capture | `scripts/capture-screenshots.mjs`, `scripts/screenshot-manifest.mjs`, `docs/screenshots/` | App behavior |
| Analytics | `components/Analytics/**` | Plan, Scheduler, Lists interiors |
| Plan | `components/Home/Plan/**` | Tracking paint, Scheduler |
| Scheduler | `components/Scheduler/**` | Home Plan |
| Period | `lib/use-current-date.ts`, To Do date ownership, Habits cursor *data* | Habits’ milled `habit-chrome-btn` keys |
| Estimates | `lib/estimated-values.ts` and audited call sites | A second chip design |
| Lists | `components/Lists/**` | Module interiors |
| Tracking | `components/Home/Tracking/**` | Pen math, the counts-as model |
| Working Now | `components/header-now-box.tsx`, `AppHeader`, cognitive-state, Operations control | Tracking grid internals |
| Shell | `app/page.tsx`, `app/win95.css`, header dialogs | Lists file-manager CSS |
| Home interiors | Habits, To Do, Goals components | Plan calendar, Tracking grid, the shipped WILLPOWER rail, the shipped Home strip |
| Operations | `components/Operations/**` | Modules board |
| Docs | `components/Docs/**` | Spreadsheet engine |
| Modules board | Board chrome and `ModuleWorkspace.tsx` | `TidyView`, Trip, Film DNA |
| History / Backup / Workflows | `lib/action-history.ts`, `lib/item-activity.ts`, `lib/data/backup.ts`, workflow UI | Collapsing `Task` into `Item` |
| Item | `lib/types.ts`, stores, migrations, search | UI restyles |

After each completed step, update the colocated README, this file’s wave status, [`SPEC_MAPPING.md`](SPEC_MAPPING.md) when a spec’d surface moved, and the screenshot pair you touched (`.cursor/rules/update-docs-after-each-step.mdc`).

---

## Where to read

| Concern | Start here |
|---------|------------|
| Design | [`DESIGN_STYLE.md`](DESIGN_STYLE.md) |
| Reference photographs | [`DESIGN_REFS.md`](DESIGN_REFS.md) |
| Ranked UI notes | [`UI_NEXT.md`](UI_NEXT.md) — decisions in this file win |
| Unranked observations | [`UI_CRITIQUE.md`](UI_CRITIQUE.md) — do not execute in order |
| Spec checklist | [`SPEC_MAPPING.md`](SPEC_MAPPING.md) |
| Item fields | [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) |
| Write door and period data | [`ARCHITECTURE_MODULARITY.md`](ARCHITECTURE_MODULARITY.md) |
| Module rungs | [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) |
| Idea bank (not a commitment) | [`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md) |
| How map, loop, and meaning join | [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md) |
| Essays, not assigned | [`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) Part 3, [`JungBrain2.md`](JungBrain2.md), [`cyberneticsbrain2.md`](cyberneticsbrain2.md) Part 3 |

---

## Standard

The frame stays a machine. The contents stay specific. The cabinet stays itself. A record is a map: dated, indexed, and honest about what it leaves out. One finished cut is the work. The living application is the cabinet in use.
