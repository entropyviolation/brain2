# Spec → Code Mapping (COGS v2)

This document maps every section of `Cognitive_Management_System_Spec.docx`
("Personal Cognitive Management System / COGS v2") to the current codebase.

Legend:
- ✅ **Implemented** — present and broadly matches the spec.
- 🟡 **Partial** — exists but diverges from or under-delivers the spec.
- ⛔ **Missing** — not implemented yet.
- 🕓 **Deferred** — explicitly out of scope for v1 per the spec.

> Direction chosen for this rebuild: **incremental evolution** of the existing
> localStorage/Zustand + Electron app toward the spec (not a from-scratch
> rewrite). **Storage model:** the local store stays **offline-first** (the
> working source of truth on every client); **MongoDB** (Atlas, replacing the
> spec's original SQLite recommendation) becomes a *cloud sync target* behind an
> opportunistic `SyncingDataSource` — for a flexible document model,
> semantic/fuzzy/advanced search, and aggregation-based routing as the dataset
> grows relational. This file is the running checklist for that work; the full
> architectural plan (offline-first + opportunistic Atlas sync + external
> connectors + shared `@cogs/core` + future mobile) lives in
> [`ROADMAP.md`](ROADMAP.md).

Screenshots and per-screen write-ups: [`docs/screenshots/`](screenshots/).

---

## §1 Overview & Design Philosophy
Design intent only; no code. Guiding principles to honor going forward:
capture-first, one underlying "item" concept, progressive scheduling,
local-first/sync-ready, AI-ready-not-AI-dependent, everything reviewable.

## §2 System Architecture
- **Shape chosen by this repo:** Option B (Electron) + localStorage via Zustand
  `persist`, kept **offline-first**. Future direction (see [`ROADMAP.md`](ROADMAP.md)):
  each client (web/desktop renderer + a future **mobile** app) keeps a complete
  local store; a `SyncingDataSource` opportunistically reconciles with **MongoDB
  Atlas** (cloud) in the background. Electron main reverts to a **thin shell**
  (optionally a connector/cache host), not the data host; its IPC + Mongo
  scaffolding is repurposed as one transport on the remote/sync side. A separate
  read-only **external connectors** layer (starting with weather) feeds widgets,
  cached with a TTL and degrading offline. Shared logic lives in a future
  `@cogs/core` package. See `electron/`, `README.md`.
- Module list (§2.2) maps to top-level tabs in `app/page.tsx` and
  `components/<Module>/` folders:
  **Home** | **Lists** | **Scheduler** | **Modules** | **Analytics**, plus
  global header widgets (**Review**, **Tracking**, Inbox, Bulk Add, Quick Add).

## §3 Data Storage & Sync — 🟡/⛔
- **Current:** a dozen-plus Zustand stores → localStorage:
  `task-store` (`cogs-task-storage`), `event-store` (`cogs-event-storage`),
  `habits-store` (`cogs-habits-store`), `goals-store` (`cogs-goals-store`),
  `points-store` (`points-store`), `time-tracking-store` (`cogs-timegrid-store`),
  `reviews-store` (`cogs-reviews-store`), `modules-store` (`cogs-modules-store`),
  `module-definitions` (`cogs-module-definitions`), `workflows-store`
  (`cogs-workflows-store`), `item-type-store` (`cogs-item-types-store`),
  `lists-ui-store` (`cogs-lists-ui`), `theme-store` (`cogs-theme-store`).
- **Also persisted outside stores:** plan free-text (`lib/plan-text.ts` keys
  `dayPlan-*`, `weekPlan-*`, `monthPlan-*`); one-time import of legacy
  `weekly-habits-*` keys into `habits-store`.
- **Done:** one-click **JSON export/import** of all data — `lib/data/backup.ts`
  (`createBackup`/`restoreBackup` over every persisted store, incl. the new
  workflows + module-definitions stores; per-category and per-module-definition
  exports too), surfaced in the header **Settings** dialog. A nascent
  `DataSource`/repository seam (`lib/data/`) abstracts local/IPC/mongo sources.
- **Gap:** no cloud **MongoDB Atlas** sync target yet (`cogs` database —
  collections for items, plans, habits, reviews, etc.) or a numbered **schema
  migration** runner wired to the live stores. MongoDB was chosen over the spec's
  SQLite recommendation for:
  schemaless/flexible documents (unified `Item` + custom attributes), text indexes
  and Atlas Search for **fuzzy search**, vector indexes for future **semantic
  search**, aggregation pipelines for **advanced search and routing**, and native
  BSON/JSON interchange.
- **Revised direction (offline-first + opportunistic sync):** the local store is
  **not** being replaced — it stays the working source of truth on every client.
  Atlas becomes a background **sync target** behind a future `SyncingDataSource`
  (per-field last-write-wins to start; upgradeable to RxDB / PowerSync / Atlas
  Device Sync). The `DataSource`/repository seam (below) is what makes this — and a
  future mobile client — possible. Full plan: [`ROADMAP.md`](ROADMAP.md).
- **Multi-device sync is now planned, not deferred.** It is opportunistic and
  best-effort (never blocks offline use); a future **mobile** app (Expo / React
  Native) is an explicit target consumer.

## §4 Inbox / Capture
- §4.2 Quick Add — ✅ `components/quick-add.tsx`.
- §4.3 Bulk Add — ✅ `components/enhanced-bulk-add.tsx` (colon-category syntax,
  auto-creates categories, routes to inbox).
- §4.4 Clarification — 🟡 `components/inbox.tsx` (`TaskClarificationDialog`).
  Works, but still task-only (no type switching among task/note/event/log).
- §4.5 Inbox vs. review queue — 🟡 Inbox exists; Review header surfaces pending
  period reviews but a separate "needs attention" queue is not built.

## §5 Item Data Model — 🟡 (most important refactor target)
- Current model: `lib/types.ts` `Task` (rich, but carries **duplicate fields**
  the spec wants merged: `category` vs `categories`, `entropy` vs
  `cognitiveLoad`, `context` vs tags). Separate interfaces for habits
  (`WeeklyTask`), events (`CalendarEvent`), time-grid intervals, reviews
  (`PeriodReview`), modules (`ModuleInstance`).
- **Gap vs §5.1–5.3:** no unified `Item` core (`id/type/title/body/status/
  categories/tags/links/rewardValue`). No generic `links` field; no `tags`
  distinct from `categories`; no `note`/`objective`/`review` item types.
- §5.4 Task fields — ✅ mostly present on `Task`.
- §5.5 Detail view — 🟡 `components/task-detail-popup.tsx` +
  `components/enhanced-task-detail.tsx` (consolidation pending).
- §5.6 Recurrence — 🟡 `Task.repeatSettings` exists in types; habit bridge
  is conceptual.

## §6 Next Actions / Lists — ✅/🟡
- Renamed **Lists** tab; Win98 file-manager UI — ✅
  `components/Lists/enhanced-category-view.tsx` (orchestrator) + subfolders
  (`hooks/`, `views/`, `list-content/`, `dialogs/`, `toolbar/`) + `filemanager98.css`.
  Grid entry builder: `lib/lists-grid-entries.ts`; open-target reducer: `open-target.ts`.
- Folders, drag-and-drop, smart Home lists (Daily/Weekly/Monthly To-Do + Habits),
  four folder views (Icons/List/Details/Cards), four list display modes — ✅.
- Custom attributes per list (reorderable), CSV import, orb icons + gallery — ✅
  (`attribute-editor.tsx`, `lib/csv.ts`, `lib/orbs-manifest.ts`,
  `lib/lists-ui-store.ts`).
- Per-folder **All Items** uncategorized pool — ✅ `lib/folder-all-items.ts`.
- Category shape — ✅ `TaskCategory`; **nested categories / sublists** — ✅
  `parentCategoryId` + `lib/category-tree.ts` (ancestor/descendant/move-cycle
  helpers), nesting rendered in `FolderTree.tsx`/`BreadcrumbNav.tsx`, per-category
  JSON export/import in `settings-dialog.tsx` (`lib/data/backup.ts`) (§6.2).
- Completed view, settings, search — ✅.
- Points on complete — ✅ `resolveCompletionPoints()` in `lib/item-utils.ts`
  (default 1, or numeric **Points** list attribute).
- §6.5 "to schedule" as a **tag** (not category) — ⛔ tags don't exist yet.

## §7 Scheduler & Calendar — ✅/🟡
- Period funnel Always→Year→Month→Week→Day — ✅
  `components/Scheduler/enhanced-scheduler.tsx`.
- Calendar Month/Week/Day views — ✅ `components/Home/Plan/*`.
- §7.3 single source of truth — 🟡 scheduling fields shared via task-store;
  panels compute filtered lists independently (`lib/item-utils.ts` helpers).
- Persisted plan text — 🟡 saved via `lib/plan-text.ts` to localStorage (immediate
  save on edit in day/week/month views); target is MongoDB-backed plan documents
  (`plans` collection keyed by period).
  Plan text + `planReflection` shown in Reviews — ✅.
- §7.5 Events with linked checklist — ✅ `lib/event-links.ts` derives each linked
  task's `mustBeDoneBefore` from the event date; attach/detach a prerequisite
  checklist in `Home/Plan/event-dialog.tsx`; `agenda-grid.tsx` renders the
  "must be done before <date>" badge + multi-day/all-day banner rows.
- §7.6 Auto-scheduling — 🕓 deferred (constraint fields retained on `Task`).
- §7.7 Carry-over logic — 🟡 partial: Review dialog offers push-forward per task;
  no automatic end-of-period carry-over batch.

## §8 Home Dashboard — ✅/🟡
- Tabbed dashboard (Habits/Plan/To-Do/Goals/**Tracking**) + top bar — ✅
  `components/Home/home-dashboard.tsx`, `app/page.tsx`.
- **Today's Progress** quickview (to-do + habit completion) — ✅
  `daily-progress-quickview.tsx` (replaces old Quick Actions card).
- Points stats — ✅ `components/Home/points-stats.tsx`.
- §8.4 To-Do tiers + overdue — ✅ `components/Home/ToDo/todo-panel.tsx`.
- §8.7 Review entry points — 🟡 Review button in global header with pending badge;
  no dashboard banners yet.

## §9 Habit Tracker — ✅/🟡
- Five habit types, week/day grid, daily/weekly/monthly frequency tabs,
  per-day/per-week % — ✅ `components/Home/Habits/*`, `lib/calculations.ts`.
- Shared store — ✅ `lib/habits-store.ts` (Home + Lists Daily Habits read/write
  the same data).
- §9.4 completion records keyed by ISO/local date — ✅ (`WeeklyData` keyed by
  date string). **Gap:** not a DB record; habits are `WeeklyTask`, not a unified
  `Habit` item.
- §9.5 Streaks — ⛔ not computed/shown (Analytics heatmap shows daily % only).

## §10 Goals & Objectives — ✅
- **Objectives** — ✅ all-time aspirational directions (`Objective` entity, 26 seeded)
  that can be **prioritized per period** (day/week/month/year) with custom point
  multipliers (caps: 3/day-week-month, 5/year) and written period **reviews**.
  `Home/Goals/ObjectivesPanel.tsx` + `ObjectiveDetailDialog.tsx`.
- **Goals** — ✅ quantifiable metrics (`count|boolean|numerical`, period kinds incl.
  custom ranges) that each serve ≥1 objective. `Home/Goals/GoalsContainer.tsx`.
- **Contributions & multipliers** — ✅ tasks carry `contributesTo{Objective,Goal}Ids`;
  the global completion popup (`components/Completion/`) advances goals and awards a
  **stacking** objective multiplier (1.5× default, or a prioritized objective's custom
  value) via `lib/goals-store.ts` (`taskObjectiveMultiplier`).
- **Direction in life** — ✅ `lib/objectives.ts` coverage (neglected goals, drift days)
  + `Home/Goals/DirectionReport.tsx`. Persisted in `lib/goals-store.ts` (persist v3).

## §11 Modules — ✅ (spec §8 extension)
- User-composed dashboard **widgets** — ✅ `components/Modules/modules-panel.tsx`,
  `lib/modules-store.ts` (list-explorer, writing-prompt, random-task,
  list-summary, analytics-stat, rules).
- User-composed **workspaces** (full-screen mini-apps) — ✅ a workspace is a
  `ModuleInstance` with `kind: "workspace"` + bound `views[]`. Each view binds a
  source **list** to a presentation: editable **spreadsheet** (`SheetGrid`),
  **agenda**, **summary** (group-by + sum rollups), **randomizer** (pick-N +
  timer), **timer**, **checklist**, **gallery**, **stat**, **notes**,
  **decision-matrix**, **kanban**, **timeline**, **matcher** (link one list to
  another via `lib/book-match.ts`), **quiz**, and **dashboard** (optional-inclusion
  rollup cards). Built/edited with `workspace/ModuleViewEditor.tsx`; the per-kind
  dispatch is `workspace/module-view-bodies.tsx`; rendered by
  `workspace/ModuleWorkspace.tsx` and **drag-reorderable**.
- **Templates** (`lib/module-templates.ts`) scaffold lists + attribute schemas +
  seed data + views + seeded workflows in one click: **Itinerary Creator** (cost /
  booked / theoretical-vs-finalized; cost rollup; print/export; on-Finalized
  workflow → **Sync to Plan** (`lib/module-plan-sync.ts`) + schedule
  (`lib/module-schedule-sync.ts`)), **Cleaning System** (randomizer + timer +
  per-room progress + notes), **Budget Tracker** (optional-inclusion rollup
  **dashboard**: liquid / net worth / expected spend / payments), and **Book
  Tasting** (PDF→book **matcher** + **quiz** over `file` attributes with extracted
  text). This realizes the "custom-module platform" ambition on the unified Item
  model.
- **Build-from-scratch + definitions** — ✅ `ModuleBuilderDialog` offers build
  from scratch, saved **definitions**, or templates; `ModuleSettingsDialog` /
  `ModuleListsPanel` author a serializable `ModuleDefinition` stored in
  `lib/module-definitions.ts`; definitions instantiate into runnable workspaces and
  export/import via `lib/data/backup.ts`.
- **Workflow engine ("rules ACT")** — ✅ authored `WorkflowDefinition`s
  (`WorkflowBuilder`/`WorkflowStepEditor` → `lib/workflows-store.ts`) run on real
  item mutations via `lib/workflow-engine.ts`, wired through the
  `lib/workflow-hooks.ts` seam by `lib/services/item-mutation-service.ts`
  (`initWorkflowEngine` installed once on client mount in `app/page.tsx`, idempotent
  + SSR/static-export safe). Triggers (create/update/complete, attribute change,
  manual, schedule), conditions, and ordered actions.
- **Pop-out windows** — ✅ a workspace opens standalone at `#popout/module/<id>`
  (`ModulePopoutView`); Electron uses a real `BrowserWindow` via
  `cogs:window:openModulePopout`, the browser falls back to `window.open`.
- **File / PDF attributes** — ✅ `file`/`multifile` (`FileValue`) attribute types
  (`components/Lists/attributes/**`) with PDF text extraction (`lib/file-extract.ts`
  + Electron `cogs:file:extractPdfText` / `pdf-parse`), plus built-in **Book** /
  **Flight** item types and a read-only **connector** seam (`lib/connectors.ts`).
- **Module platform foundation (Phase 0)** — ✅ shared serializable contract in
  `lib/types.ts`: `ModuleDefinition`, `WorkflowDefinition`/`WorkflowTrigger`/
  `WorkflowAction`, and `FileValue` + `file`/`multifile` types; the dependency-free
  mutation seam in `lib/workflow-hooks.ts`.
- **Gap:** richer per-view filtering UI and a visual workflow graph are still thin.

## §12 Tracking / Activity Log — 🟡
- TimeGrid minute painter — ✅ `lib/time-tracking-store.ts` +
  `components/Home/Tracking/time-grid.tsx`; header **Tracking** button opens the
  same grid in a dialog (`cognitive-state.tsx`).
- Scopes (Activity/Location/Mood) with configurable pens — ✅.
- **Gap vs §12.2/12.4:** interval shape differs from spec's `LogEntry`
  (no `nextPlanned`, no structured geo, no `source` field). Not a unified
  `log` Item. Old `tracking-store.ts` / slider form removed.

## §13 Reviews — 🟡
- Period reviews — 🟡 `components/Reviews/reviews.tsx` + `lib/reviews-store.ts`.
  Supports day/week/month/quarter/year with carry-over prompts, gratitude,
  reflection questions, saved plan text, and `planReflection`.
- **Morning review ritual** — ✅ `components/Reviews/MorningReview.tsx`
  (`PeriodReview.morning`: wake time, dream, intentions, affirmations, postponed
  tasks); surfaced from the Review header.
- **Structured "why blocked/skipped" reasons** — ✅ `BlockedReason` +
  `PeriodReview.blockedReasons` captured in the carry-over step.
- **Gap:** no scheduled prompting beyond header badge; task post-mortems (§13.7)
  exist for Operations (`addOperationReview`) but not generic tasks.

## §14 Points, Rewards & Regret — 🟡
- Points ledger — ✅ `lib/points-store.ts` (task/habit/goal completions,
  day/week/month totals + possible).
- List completion points — ✅ `resolveCompletionPoints()` (default 1 or **Points**
  attribute).
- Objective point sources + configurable multipliers — ✅ contributing to an
  objective applies a stacking multiplier (1.5× default, or a prioritized objective's
  user-set value) via `lib/goals-store.ts` + `components/Completion/`.
- **Gap:** other configurable multipliers (urgency/consistency); retroactive adjustment.
- §14.4 Regret accrual — ✅ `lib/regret-store.ts` (accrues the cost of not-done
  important/overdue items; day/week/month totals) + `Analytics/RegretView.tsx`.

## §15 Analytics — 🟡
- Real charts — 🟡 `components/Analytics/enhanced-analytics.tsx` now uses
  recharts: habit heatmap + completion bars, points trends, TimeGrid
  distribution, saved reviews browser.
- **Self-tracking metrics & analytics** — ✅ `lib/metrics-store.ts` + `lib/metrics.ts`
  (classical trend/slope, Pearson correlation, change-point, context-switch counts;
  no LLM). Logger: `components/Tracking/MetricLogger.tsx` (header **Metrics** button).
  Views mounted in the Analytics shell: `MetricsTrends`, `CorrelationExplorer`,
  `ContextSwitchHeatmap`, plus `RegretView` (§14.4).
- **Gap vs spec's eight v1 views:** cognitive-state trends, category performance,
  and several others not yet built as dedicated views.
- §15.3 predictive analytics — 🕓 deferred.

## §16 AI-Readiness — 🕓
No AI features required for v1. Keep timestamps/structured types/free-text fields
and a generic `links` mechanism so an AI layer can be added later.

## §17 V1 Scope & Build Order
The spec's suggested build order remains a good sequence. Export/import (§3.2)
should land first.

## Long-term vision (beyond v2 spec) — 🕓
The spec describes the foundation; the project's eventual ambition is larger. See
the "The eventual vision" section in [`../README.md`](../README.md). Tracked here
so it stays connected to the code:
- **User-defined item types/subtypes as a primary workflow.** Seam exists
  (`ItemTypeDefinition`, `Item.type` in `lib/types.ts`), but built-in **task**
  behavior still dominates; type creation/management UI is not built.
- **Dense relational network.** Richer composition of
  type ↔ category ↔ tag ↔ attribute ↔ link than today's mostly
  category-driven model. Primitives (`tags`, `links`, `attributes`) exist; the
  graph-style modeling/visualization does not.
- **Document-type items.** Notion / Google Docs–style rich-text editor as an item
  `body`/type. ✅ `Item.body` + built-in `note` type (`lib/note-types.ts`),
  dependency-light editor `components/Editor/RichTextEditor.tsx`, and the `"body"`
  detail panel `components/ItemDetail/BodyPanel.tsx` (shown for `note` items and any
  list whose `detailPanels` include `"body"`).
- **Spreadsheet-style grid displays.** Google Sheets–style editable grids over
  list/attribute data. ✅ `components/spreadsheet/SheetGrid.tsx` — inline cell
  editing, sticky header, frozen name column, numeric/currency column totals,
  add-row, and add-column (extends the list's schema). Available as the Lists
  **Spreadsheet** display mode and as the Module **spreadsheet** view. Rollups
  (group-by + sum) power Module **summary** views via `lib/spreadsheet-utils.ts`.
  **Computed / formula attributes** — ✅ `lib/formula.ts` (safe expression
  evaluator: cell refs by attribute id, `+ - * / ( )`, `SUM/AVG/MIN/MAX`, no
  `eval`) drive the `"formula"` attribute type in grids + formula-aware rollups.
  (Remaining: multi-column sort/freeze, range selection.)
- **Self-tracking + analytics depth.** Track arbitrary user-defined metrics and
  analyze them (extends §12 Tracking and §15 Analytics).

## §18 Resolved Contradictions
Reference notes; no code.

---

## Highest-leverage next steps (incremental path)
1. **§3** Storage abstraction + one-click JSON export/import over all stores,
   then add opportunistic cloud sync to **MongoDB Atlas** via a `SyncingDataSource`
   (the local store stays the offline source of truth; text/vector indexes for the
   search roadmap). See [`ROADMAP.md`](ROADMAP.md).
2. **§5** Add `tags`, generic `links`, and `parentCategoryId` (additive) before
   consolidating duplicate fields.
3. **§14/§7.7** Regret accrual + automatic carry-over (small, high value).
4. **§15** Remaining Analytics views (plan-vs-reality, category performance, …).
5. **§10/§13** Flesh out Objectives and full Reviews cadence (spawned items,
   post-mortems, scheduled prompts).
