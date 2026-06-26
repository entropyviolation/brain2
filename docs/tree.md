# COGS Repository Tree

A clickable, annotated index of the repository. Pairs with the plain-text
[`tree.txt`](tree.txt) (raw `tree` output) and the spec checklist
[`SPEC_MAPPING.md`](SPEC_MAPPING.md).

> Where to start: root [`README.md`](../README.md) → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)
> → the nearest folder `README.md`. Nearly every source file also opens with a
> `/** ... */` header describing its purpose and spec section.

---

## Jump to

|                         |                          |                            |
| ----------------------- | ------------------------ | -------------------------- |
| [README.md](#readmemd)  | [app/](#app)             | [components/](#components)  |
| [lib/](#lib)            | [electron/](#electron)   | [hooks/](#hooks)           |
| [docs/](#docs)          | [public/](#public)       | [scripts/](#scripts)       |
| [e2e/ · tests/](#tests) | [config](#config--lockfiles) | [App map](#app-map)    |
| [Spec gaps](#spec-gaps-highest-impact) |           |                            |

**Components sub-views:** [top-level](#top-level-files) · [Home](#home) · [Lists](#lists) · [Scheduler](#scheduler) · [Modules](#modules) · [Analytics](#analytics) · [Reviews](#reviews) · [spreadsheet](#spreadsheet) · [ui/](#ui)

---

## README.md

**What:** COGS — *Cognitive Offloading and Getting Stuff Done.* A personal cognitive
management system: Inbox, Lists, Scheduler, Goals, Habits, Tracking, Modules,
Reviews, Analytics.

**Stack:** Next.js 15 static export, React 19, TypeScript, Tailwind + shadcn/ui,
recharts, Zustand + `persist` → localStorage (→ MongoDB), Electron, Win95/Win98 skin.

**Vision seam:** unified `Item` + user-definable `ItemTypeDefinition`, free-form
`tags`, typed `links`, flexible attributes (`lib/types.ts`) — most behavior still
flows through the built-in `task` type today.

→ [`README.md`](../README.md)

---

## app/

Next.js App Router entry — one static client page, global CSS, retro shell. No API
routes or server components.

| File          | Purpose                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| `layout.tsx`  | Root layout — Karla font, `globals.css`, `win95.css`, `body.win95-app`, metadata, global `CompletionPopupHost` |
| `page.tsx`    | Global header + 5 lazy tabs; full-screen `EnhancedTaskDetail` when a task is selected |
| `globals.css` | Tailwind base/components/utilities + theme CSS variables                       |
| `win95.css`   | Global Win95 bevels, tabs, scrollbars, pixel font (`:where()` lets Lists `.fm98` win) |
| `loading.tsx` | Route loading boundary (renders `null`; panels use Suspense)                   |

**Header:** Review · Tracking · Inbox · Bulk Add · Quick Add.

→ [`app/README.md`](../app/README.md)

---

## components/

All React UI. Top-level files = cross-cutting widgets; subfolders = tab modules.
Most components have a co-located `*.test.tsx`.

### Top-level files

| File                       | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `quick-add.tsx`            | Single-field capture → inbox                  |
| `enhanced-bulk-add.tsx`    | Multi-line capture; `Category:` syntax        |
| `inbox.tsx`                | Inbox + clarification flow                    |
| `cognitive-state.tsx`      | Header **Tracking** → TimeGrid dialog         |
| `task-detail-popup.tsx`    | Barrel → `ItemDetail/ItemDetailPopup.tsx` (`TaskDetailPopup`) |
| `enhanced-task-detail.tsx` | Barrel → `ItemDetail/ItemDetailPage.tsx` (`EnhancedTaskDetail`) |

The two detail views are consolidated under
[`ItemDetail/`](../components/ItemDetail/README.md): both share load/draft state
and the category/dependency/tag/link mutators via `useItemDetailDraft`; the old
paths remain as re-export barrels (spec §5.5). Tags & typed links surface through
`TagInput.tsx`, `LinkPicker.tsx`, and `RelatedItemsPanel.tsx` (presentational;
pure logic in `lib/links.ts`).

→ [`components/README.md`](../components/README.md)

---

### Home

Default tab — date, points, today's progress, review banner + **Habits · Plan · To Do · Goals · Tracking**.

| Area                        | Key files                                                                                      | Store(s)                       |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------ |
| Root                        | `home-dashboard.tsx`, `points-stats.tsx`, `daily-progress-quickview.tsx`, `home-review-banner.tsx` | points, task, reviews     |
| [Goals/](#homegoals)        | `goals-tracker.tsx`                                                                            | `goals-store`                  |
| [Habits/](#homehabits)      | `habit-tracker.tsx`, `task-grid.tsx`, `period-habit-list.tsx`, `week-navigation.tsx`, `daily-task-form*.tsx`, `settings-dialog.tsx` | `habits-store` |
| [Plan/](#homeplan)          | `plan-panel.tsx`, `month/week/day-view.tsx`, `agenda-grid.tsx`, `planned-tasks-sidebar.tsx`, `event-dialog.tsx`, `settings-dialog.tsx` | task, event, plan-text |
| [ToDo/](#hometodo)          | `todo-panel.tsx`, `TodoTable.tsx`, `AddTodoDialog.tsx`, `todo-utils.ts`                        | `task-store`                   |
| [Tracking/](#hometracking)  | `time-grid.tsx`, `actual-day-view.tsx`                                                         | time-tracking, task, event     |

Shared **selected day** via `lib/use-current-date.ts` (advances at local midnight).

→ [`components/Home/README.md`](../components/Home/README.md)

#### Home/Goals/
All-time **Objectives** (prioritizable per period with custom point multipliers)
+ quantifiable **Goals** (`count | boolean | numerical`, period kinds incl. custom
ranges) that each serve ≥1 objective, plus the **Direction** report. Files:
`goals-tracker.tsx` (composition), `ObjectivesPanel.tsx`, `ObjectiveDetailDialog.tsx`,
`GoalsContainer.tsx`, `DirectionReport.tsx`. 26 default objectives + example goals
seeded on first load. Multiplier/priority math in `lib/goals-store.ts` +
`lib/objectives.ts`.
**Could add:** auto-linked progress, penalty amounts on missed objectives (§10).

#### Home/Habits/
Five habit types (boolean, goal/time, count, text, incremental) × daily/weekly/monthly.
Shared `habits-store` with Lists Daily Habits. 14 default daily habits.
**Could add:** Streak display, habit trend charts (§9.5).

#### Home/Plan/
Month/week/day calendar, drag-drop scheduling, events, plan free-text (localStorage
via `plan-text.ts`). `agenda-grid.tsx` shared with Tracking Day Log.
**Could add:** Auto carry-over (§7.7), MongoDB plan documents.

#### Home/ToDo/
Day/week/month execution lists — tier sort (A+…D), overdue, push forward.
Orchestrator (`todo-panel.tsx`) + pure `todo-utils.ts` + `TodoTable`/`AddTodoDialog`.

#### Home/Tracking/
TimeGrid (`time-grid.tsx`, 15-min paint pens, 96 slots/day, Activity/Location/Mood
scopes) + Day Log (`actual-day-view.tsx`, plan vs. actual `timeLogs`).
**Could add:** Analytics plan-vs-reality view.

---

### Completion (global)

`Completion/CompletionPopupHost.tsx` + `CompletionDialog.tsx` — mounted once in
`app/layout.tsx`. Subscribes to the completion event bus (`lib/completion-events.ts`,
emitted by `task-store.updateTask`) so a popup appears on **every** task completion.
Captures objective/goal contributions, advances goals, and awards the stacking
objective point multipliers (1.5× default; prioritized objectives use a custom
multiplier). → [`components/Completion/README.md`](../components/Completion/README.md)

---

### Lists

Win98 file manager — folders, lists, items via `task-store`. Smart lists, custom
attributes, orb gallery, CSV import, spreadsheet display.

**Entry:** `enhanced-category-view.tsx` (orchestrator) composing subfolders:

| Subfolder       | Contents                                                                 |
| --------------- | ------------------------------------------------------------------------ |
| `hooks/`        | `useListsNavigation`, `useListsSearch`, `useListsDragDrop`, `useListsSelection`, `useListsTaskActions` |
| `navigation/`   | `FolderTree.tsx`, `BreadcrumbNav.tsx`                                     |
| `views/`        | `FolderViewIcons/List/Details/Cards.tsx`, `SearchResultsView.tsx`        |
| `list-content/` | `ListContentPanel/Default/Checklist/Icons/Details/Spreadsheet.tsx`       |
| `dialogs/`      | `New/Edit List & Folder`, `CsvImportDialog`, `OrbPickerDialog`, `CompletedTasksDialog` |
| `attributes/`   | `AttributeSchemaEditor`, `AttributeValueField`, `AttributeValuesEditor`, `helpers.ts` |
| `toolbar/`      | `ListsToolbar.tsx`, `ViewModeControls.tsx`                                |
| `lib/`          | `icon-utils.tsx` (orb/icon/folder glyphs)                                 |

**Top-level:** `attribute-editor.tsx` (barrel), `settings-dialog.tsx`, `list-picker.tsx`,
`daily-habits-list.tsx`, `open-target.ts`, `constants.ts`, `types.ts`, `filemanager98.css`.

**Helpers:** `lib/lists-grid-entries.ts`, `lib/string-utils.ts`, `lib/folder-all-items.ts`, `lib/scheduled-lists-sync.ts`

**Stores:** `task-store`, `lists-ui-store`, `habits-store`

**Tests:** `__tests__/`, `hooks/__tests__/`, `navigation/__tests__/`, `dialogs/__tests__/`, `e2e/lists.spec.ts`

**Could add:** Bulk attribute editing, richer attribute types, nested categories (`parentCategoryId`, §6.2).

→ [`components/Lists/README.md`](../components/Lists/README.md)

---

### Scheduler

Period funnel: **Always → Year → Month → Week → Day**. Split into orchestrator + tabs.

| File                    | Purpose                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `enhanced-scheduler.tsx` | Orchestrator — state, store wiring, task renderer         |
| `scheduler-utils.ts`    | Pure logic — filtering, sort, period queries, grid builders |
| `SchedulerTaskItem.tsx` | Draggable task card                                        |
| `PeriodCell.tsx`        | Droppable bucket cell                                      |
| `PeriodFunnelTab.tsx`   | Generic Year/Month/Week tab                               |
| `AlwaysTab.tsx`         | Always list + filters + overview boxes                    |
| `DayTab.tsx` / `DayAgenda.tsx` | Day sidebar + 24-hour drop-to-hour agenda          |
| `SchedulerFilters.tsx`  | Collapsible Filters & Sort                                 |

Tasks appear only if in a **scheduleable** list (`TaskCategory.scheduleable !== false`).
**Could add:** Auto-scheduling (§7.6), event-linked checklists.

→ [`components/Scheduler/README.md`](../components/Scheduler/README.md)

---

### Modules

Composable widget dashboard + a full user-buildable **workspace** "mini-app"
platform: bind lists, compose views, author **workflows** (Zapier-style rules),
and **pop out** a module into its own window.

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `modules-panel.tsx`        | Orchestrator — widget grid + workspace launcher + add/configure/remove |
| `module-helpers.ts`        | Pure helpers + `MODULE_META`, `MODULE_VIEW_KINDS` registry, rule/stat options |
| `module-bodies.tsx`        | `ModuleCard` + per-type widget bodies (analytics, list summary, writing prompt, list explorer, random task, rules) |
| `ModuleConfigDialog.tsx`   | Add/configure widget form                                     |
| `workspace/ModuleBuilderDialog.tsx` | New-module chooser: build from scratch, saved definitions, or one-click templates |
| `workspace/ModuleWorkspace.tsx` | Full-screen mini-app — tabbed views, drag-reorder, Settings/Workflows/Pop-out, plan-sync |
| `workspace/ModulePopoutView.tsx` | Standalone module render for the `#popout/module/<id>` window |
| `workspace/ModuleSettingsDialog.tsx` / `ModuleListsPanel.tsx` | Edit a `ModuleDefinition` (name, bound lists, views, plan-sync) |
| `workspace/ModuleViewEditor.tsx` | Compose one bound view (spreadsheet/checklist/agenda/summary/randomizer/timer/stat/gallery/notes/decision-matrix/kanban/timeline/matcher/quiz/dashboard) |
| `workspace/module-view-bodies.tsx` | `ModuleViewBody` switch + per-kind render bodies |
| `workspace/WorkflowBuilder.tsx` / `WorkflowStepEditor.tsx` | Author per-module workflows (trigger → conditions → actions) |

**Templates:** `lib/module-templates.ts` builds one-click mini-apps — **Itinerary**
(spreadsheet + timeline + plan/schedule-sync workflow), **Cleaning** (gamified
randomizer + timer), **Budget** (optional-inclusion rollup dashboard), and
**Book Tasting** (PDF→book `matcher` + `quiz`) — each scaffolding lists +
attribute schemas + seed items + bound views + seeded workflows. `lib/module-plan-sync.ts`
pushes finalized dated module items into the Plan; `lib/module-schedule-sync.ts`
turns them into scheduled events; `lib/book-match.ts` scores PDF→book matches.

**Workflows:** authored rules live in `lib/workflows-store.ts` and run via the
engine (`lib/workflow-engine.ts`) wired to task mutations by
`lib/services/item-mutation-service.ts` (`initWorkflowEngine` on client mount).
Specialized view kinds added: **`matcher`**, **`quiz`**, **`dashboard`**,
**`timeline`** (alongside **`decision-matrix`** / **`kanban`**).

**Stores:** `modules-store` (instances; persist v2), `module-definitions`
(reusable blueprints), `workflows-store`. **Could add:** Map/location module.

→ [`components/Modules/README.md`](../components/Modules/README.md)

---

### Graph (top-level tab)

`Graph/KnowledgeGraph.tsx` — force-directed/spatial visualization over all items
and their typed `links` (relations labelled, edges optionally colored by stance).
Reuses `lib/graph-layout.ts`. Mounted as the **Graph** top-level tab in `app/page.tsx`.

---

### Analytics

Tabs: Overview, Habits heatmap, Points, Tracking pie, Reviews, plus Brain2 views —
**Plan vs Reality** (`lib/plan-vs-reality.ts`), **Calibration** (estimate-vs-actual,
`lib/calibration.ts`), **Streaks** (`lib/streaks.ts`), and **Reflection** (post-mortem
summary).

→ [`components/Analytics/README.md`](../components/Analytics/README.md)

---

### Reviews

Header Review dropdown (not a tab) — day/week/month/quarter/year ritual: unfinished
items, summary, gratitude, plan reflection, reflection questions, next plans. Due
badge when a period is unreviewed; saved reviews browse in Analytics.
Helpers: `lib/pending-reviews.ts`. **Post-mortems:** `PostMortemDialog.tsx` +
`lib/services/completion-service.ts` capture per-task satisfaction/resistance/focus.
**Spoken affirmations:** `MorningReview.tsx`'s Affirmations button opens
`AffirmationsDialog.tsx` (stacks above), which picks 5 random lines from the Lists
"Affirmations" list and gates "Next" on a *confident vocal delivery* — mic streamed
via `hooks/useVocalConfidence.ts` and scored by the research-grounded analyzer in
`lib/vocal-confidence.ts` (loudness · steadiness · conviction · full delivery; list
helpers in `lib/affirmations.ts`).
**Could add:** Full §13 cadence, spawned items.

→ [`components/Reviews/README.md`](../components/Reviews/README.md)

---

### Settings / Focus

- `Settings/SettingsDialog.tsx` (header) — full app **backup/restore**
  (`Settings/BackupRestore.tsx` → `lib/data/backup.ts`) + **Set up Second Brain**
  (seeds Source/Belief item types via `item-type-store.seedSecondBrainTypes`) +
  **Manage Item Types** (`components/ItemTypes/`).
- `ItemTypes/ItemTypeList.tsx` + `ItemTypeEditor.tsx` — create/edit/delete user
  **item types**: attribute schema (reuses `AttributeSchemaEditor`), capability
  flags, and declarative `ItemRule*` rules. Built-ins open read-only.
- `Focus/JustStartMode.tsx` — ADHD anti-paralysis overlay: one smallest molecular
  step + 2-minute timer; launched from the To-Do panel.
- `Search/GlobalSearch.tsx` — Cmd/Ctrl-K command palette over `lib/search.ts`.

---

### spreadsheet

`SheetGrid.tsx` (v3) — Google-Sheets-style inline-editable grid over items
(columns = attribute schema). Beyond per-column sort/filter/aggregate, frozen
columns, and add-row/add-column, v3 adds **A1 column-letter headers + a
row-number gutter**, **drag + shift-click range selection** with a selection
summary (Sum/Avg/Min/Max/Count), **per-cell `=A1` formulas** (`=B2+C2`, stored
verbatim, shown computed), a **fill handle** for relative copy-down, **row
resize** (+ column resize), and **Delete** to clear a range. Used by Lists
"Spreadsheet" display and Module workspace spreadsheet views.

The serializable view shape (`SheetViewConfig` — sort/filter/freeze/widths/row
heights) lives in `lib/spreadsheet-contract.ts`; the spreadsheet engine is three
pure modules: `lib/sheet-a1.ts` (A1 ref math + `shiftFormula` for fill-drag),
`lib/sheet-eval.ts` (per-cell `=A1` evaluation over the grid, cycle-safe), and
`lib/spreadsheet-keys.ts` (navigation/range math + selection stats). Column math
(`aggregateColumn`/`sumIncluded`/`isIncluded`/`rollup`) stays in
`lib/spreadsheet-utils.ts`.

---

### ui

shadcn/ui primitives (18 kept): alert, badge, button, card, checkbox, collapsible,
dialog, dropdown-menu, input, label, progress, select, separator, switch, table,
tabs, textarea, tooltip. Unused defaults removed; Analytics uses recharts directly.

→ [`components/ui/README.md`](../components/ui/README.md)

---

## lib/

Data model, Zustand stores (localStorage today → MongoDB), pure helpers. Not React UI.

### Stores

| File                     | Key                       | Purpose                    |
| ------------------------ | ------------------------- | -------------------------- |
| `task-store.ts`          | `cogs-task-storage`       | Tasks, categories, folders |
| `event-store.ts`         | `cogs-event-storage`      | Calendar events            |
| `habits-store.ts`        | `cogs-habits-store`       | Habits + completions       |
| `goals-store.ts`         | `cogs-goals-store`        | Objectives (prioritized + multipliers) + Goals |
| `points-store.ts`        | `points-store`            | Points ledger              |
| `time-tracking-store.ts` | `cogs-timegrid-store`     | TimeGrid scopes/pens/intervals |
| `reviews-store.ts`       | `cogs-reviews-store`      | Period reviews             |
| `modules-store.ts`       | `cogs-modules-store`      | Module widgets + workspace views (persist v2) |
| `module-definitions.ts`  | `cogs-module-definitions` | Reusable module blueprints (`ModuleDefinition`) |
| `workflows-store.ts`     | `cogs-workflows-store`    | Authored per-module workflows (rules) |
| `item-type-store.ts`     | `cogs-item-types-store`   | Item type registry (built-in `task`/`book`/`flight` + user types) |
| `lists-ui-store.ts`      | `cogs-lists-ui`           | Lists UI prefs, orb gallery |
| `theme-store.ts`         | `cogs-theme-store`        | Theme colors               |

### Pure helpers

| File | Purpose |
| ---- | ------- |
| `types.ts` | Shared interfaces — `Task`, `Item`, `ItemTypeDefinition`, events, habits, reviews, attributes |
| `calculations.ts` | Habit completion math (5 types) |
| `date-utils.ts` | Date keys, week strings, `isToday`, safe date guards |
| `item-utils.ts` | Schedule predicates, `createListItem`, `resolveCompletionPoints`, push-forward |
| `objectives.ts` | Objectives/Goals helpers — period keys, prioritization + caps, goal progress, direction-in-life coverage |
| `completion-events.ts` | Completion event bus (`onTaskCompleted`/`emitTaskCompleted`) powering the global completion popup |
| `item-types.ts` | Item-type helpers, schema composition, serializable rule evaluation; registers built-in `book`/`flight` types |
| `book-types.ts` | Built-in **Book** item type (author/ISBN/status + `multifile` PDF attachments) + `withBookType` |
| `flight-types.ts` | Built-in **Flight** item type (airline, airports, times, layovers, cost, booked) + `withFlightType` |
| `file-extract.ts` | Best-effort `extractText(FileValue\|File)` — text inline, PDF via Electron `window.desktop.extractPdfText`, graceful browser fallback |
| `connectors.ts` | Read-only external-data **connector** seam: `Connector`/registry + sample weather stub mapping API data onto attributes |
| `migrations.ts` | Versioned Item-model migrations (backfill `type`/`title`/`tags`/`links`) |
| `habit-utils.ts` | Habit type normalization, completion helpers |
| `attribute-utils.ts` | Legacy attribute normalization/coercion |
| `plan-text.ts` | `dayPlan/weekPlan/monthPlan` localStorage |
| `folder-all-items.ts` | Per-folder All Items sync |
| `scheduled-lists-sync.ts` | Smart lists ↔ scheduled folders |
| `lists-grid-entries.ts` | `buildGridEntries()` for Lists navigation |
| `string-utils.ts` | `hashString`, `hashIconSlot` for orb/icon placement |
| `spreadsheet-contract.ts` | Serializable `SheetViewConfig` (sort/filter/freeze/widths/row-heights) + column shapes shared by SheetGrid + module spreadsheet views |
| `spreadsheet-utils.ts` | Numeric column detect, aggregation, optional-inclusion rollups for SheetGrid + summaries |
| `spreadsheet-keys.ts` | Pure grid interaction model: cell navigation, range math, clipboard TSV, and selection stats (Sum/Avg/Min/Max/Count) |
| `sheet-a1.ts` | A1-notation math: column letters ↔ index, `parseA1`/`formatA1`, `isCellFormula`, `extractA1Refs`, and `shiftFormula` (relative-ref rewriting for fill-drag, `$`-absolute aware) |
| `sheet-eval.ts` | Evaluates per-cell `=A1` formulas against a grid accessor (reuses `lib/formula`, resolves cross-cell refs recursively with cycle detection) |
| `module-templates.ts` | Pre-built workspace mini-app templates (Itinerary/Cleaning/Budget/Book-Tasting/Blank) |
| `module-plan-sync.ts` | Push finalized module items into Plan text |
| `module-schedule-sync.ts` | Turn finalized dated module items into scheduled events |
| `module-definitions.ts` | `ModuleDefinition` store + pure (de)serialize / instantiate helpers |
| `book-match.ts` | Score/`findBookMatch` PDF extracted-text → book candidate (matcher + quiz) |
| `workflow-hooks.ts` | Dependency-free mutation seam (`registerItemMutationDispatcher`/`dispatchItemMutation`) called by task-store |
| `workflow-engine.ts` | `dispatchWorkflows` — trigger/condition/action evaluation with re-entrancy cap |
| `services/item-mutation-service.ts` | Wires the hook seam to the engine: `initWorkflowEngine`, `runWorkflowManually`, `createTaskRepositoryAdapter` |
| `data/task-repository.ts` · `data/data-source.ts` | Repository + pluggable data source (local/IPC/mongo) behind the workflow adapter |
| `pending-reviews.ts` | Which end-of-period reviews are still due |
| `affirmations.ts` | Morning affirmations ritual: find/seed Lists "Affirmations", read lines, `pickRandom` session subset |
| `vocal-confidence.ts` | Pure vocal-confidence DSP + scoring (McLeod-Pitch-Method `detectPitch`, jitter/shimmer, uptalk/trailing-off, `ConfidenceTracker`) for the affirmations ritual |
| `app-navigation.ts` | Persist last active tab/location to localStorage |
| `use-current-date.ts` | Shared "today" hook with midnight rollover |
| `csv.ts` | Lists CSV import parser |
| `remove-background.ts` | Orb upload background removal |
| `orbs-manifest.ts` | Auto-generated orb PNG list |
| `utils.ts` | `cn()` — clsx + tailwind-merge |

**Could add:** MongoDB + schema migrations + JSON export/import (§3). Unified `Item` field de-dup in `types.ts` (§5).

→ [`lib/README.md`](../lib/README.md)

---

## electron/

Desktop shell — dev: `localhost:3000`; prod: `app://` → `out/`.

| File         | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `main.js`    | Main process, `app://` scheme, BrowserWindow, static serving, optional PDF→text IPC handler (lazy `pdf-parse`) |
| `preload.js` | Context-isolated `window.desktop` API (incl. `extractPdfText`) |
| `ipc/channels.js` | IPC channel-name constants (incl. `extractPdfText`) |

**Could add:** MongoDB connection lifecycle + IPC (§3).

→ [`electron/README.md`](../electron/README.md)

---

## hooks/

App-wide shared React hooks. Module-specific hooks live next to their UI (e.g.
`components/Lists/hooks/`).

| File | Purpose |
| ---- | ------- |
| `useQuickCaptureHotkey.ts` | Quick-capture open/close state + in-app capture chord; bridges the Electron global accelerator |
| `useVocalConfidence.ts` | Mic → `AnalyserNode` → `ConfidenceTracker` live `ConfidenceScore` for the Morning affirmations ritual |
| `use-toast.ts` | Toast queue (`useToast()` + `toast()`) |
| `use-mobile.tsx` | `useIsMobile()` viewport hook |

> Note: `useQuickCaptureHotkey.ts` and `useVocalConfidence.ts` are committed here;
> `use-toast.ts`/`use-mobile.tsx` are the canonical app copies (shadcn-style).

→ [`hooks/README.md`](../hooks/README.md)

---

## docs/

| File              | Purpose                               |
| ----------------- | ------------------------------------- |
| `SPEC_MAPPING.md` | Spec → code checklist (✅ 🟡 ⛔ 🕓)     |
| `CANONICAL_FIELDS.md` | Canonical `Item`/data-model field reference |
| `BRAIN2_FEATURE_IDEAS.md` | 280 idea-bank buildouts (160 from `Brain2Ideas` + 120 Expansion II from Brain2/COGS/to-do-theory docs), mapped to the data model |
| `brain2_features_roadmap.md` | Phased Brain2 build roadmap (wave 1) |
| `brain2_features_roadmap_wave2.md` | Roadmap wave 2 |
| `tree.txt`        | Plain `tree` command output           |
| `tree.md`         | This file — annotated clickable index |
| `screenshots/`    | 9 PNG + `.txt` write-ups per view     |

Re-capture screenshots: `npm run capture-screenshots` (with `npm run dev` running).

→ [`docs/README.md`](README.md)

---

## public/

| Path                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| `fonts/`                 | W95FA, MS Sans Serif (`converted/`) |
| `icons/`                 | folder, list, briefcase, parentfolder, minimize |
| `linkconnectors/`        | Lists tree connector SVGs          |
| `orbs-removebackground/` | 1000+ orb PNGs (manifest in `lib/orbs-manifest.ts`) |
| `velvetscrolltile.png`   | Lists scroll texture               |

---

## scripts/

| File                      | Purpose                       |
| ------------------------- | ----------------------------- |
| `update-tree.sh`          | Regenerate [`tree.txt`](tree.txt) (`npm run tree`) |
| `capture-screenshots.mjs` | Automated docs screenshots    |
| `background-remover.py`   | Orb background removal helper |

---

## Tests

| Path | Purpose |
| ---- | ------- |
| `e2e/lists.spec.ts` | Playwright critical Lists flows (`npm run test:e2e`) |
| `tests/test-utils.tsx` | Shared Vitest render helpers |
| `vitest.config.ts` / `vitest.setup.ts` | Unit/integration test config |
| `playwright.config.ts` | E2E config (starts dev server) |

Co-located `*.test.ts(x)` files live next to most components and helpers.

---

## Config & lockfiles

`components.json` · `next.config.mjs` · `package.json` · `tailwind.config.ts` ·
`tsconfig.json` · `postcss.config.mjs` · `vitest.config.ts` · `playwright.config.ts` ·
`next-env.d.ts` · `package-lock.json` · `pnpm-lock.yaml`

---

## App map

```
app/page.tsx
├── Header: Review (+ Morning Review) | Metrics | Tracking | Inbox | Bulk Add | Quick Add
│            (Quick Add is controlled by the global capture hotkey — useQuickCaptureHotkey)
└── Tabs
    ├── Home ────── Habits | Plan | To Do | Goals (Objectives + Goals + Direction) | Tracking
    ├── Lists ───── Win98 file manager (folders, lists, items, orbs, spreadsheet, kanban)
    ├── Scheduler ─ Always → Year → Month → Week → Day
    ├── Operations ─ directed enterprises (OperationsView → OperationWorkspace)
    ├── Modules ─── composable widgets + workspace mini-apps
    ├── Graph ───── knowledge / link graph
    └── Analytics ─ charts + Metrics, Correlation, Context Switch, Regret
```

Item detail ("⋯" menu) → **Upgrade to Operation**. `note`-type items + lists
whose `detailPanels` include `"body"` show the rich-text **Body** panel.
Completing any task (anywhere) opens the global **completion popup**
(`components/Completion/`) to capture objective/goal contributions + multipliers.

Lists task select → `enhanced-task-detail.tsx` (full screen).

---

## Spec gaps (highest impact)

| Area       | Status          | Next step                                      |
| ---------- | --------------- | ---------------------------------------------- |
| Storage    | 🟡 localStorage | MongoDB + schema migrations + JSON export (§3) |
| Item model | 🟡 split types  | De-dup fields into unified `Item` (§5)         |
| Goals      | ✅ Objectives   | All-time Objectives (prioritized + multipliers) + Goals that serve them; auto-progress / penalties remain (§10) |
| Analytics  | ✅ 12 tabs      | + Metrics/Correlation/Context-switch/Regret; remaining spec views (§15) |
| Carry-over | 🟡 via Reviews  | Automatic period carry-over (§7.7)             |
| Regret     | ✅ ledger       | `lib/regret-store.ts` + `Analytics/RegretView.tsx`; auto-accrual tuning (§14) |

Full detail → [`SPEC_MAPPING.md`](SPEC_MAPPING.md)

---

## Regenerate plain tree

```bash
npm run tree          # or: bash scripts/update-tree.sh
```

This runs [`scripts/update-tree.sh`](../scripts/update-tree.sh), which excludes
deps/build output and collapses the huge `public/orbs-removebackground` asset
folder into a single line, so regeneration is cheap and the output stays small.
Run it after any large structural change, then update this annotated `tree.md` by
hand if needed.
</contents>
