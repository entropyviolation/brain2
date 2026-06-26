# `components/Modules/` — Modules platform

The **Modules** top-level tab. A user-composed platform for building tools on top
of the same `Item` / `ItemType` / attribute foundation (spec §5). Two kinds of
module live here:

- **Workspaces** — full-screen **mini-apps** the user builds from their own lists
  and a layout of bound **views** (editable spreadsheet, agenda, rollup summary,
  gamified randomizer, focus timer, checklist, gallery, stat, notes). One-click
  **templates** scaffold the supporting lists, attribute schemas, seed data, and
  views. This is the platform behind user-built tools like an **Itinerary
  Creator**, **Cleaning System**, and **Budget Tracker**.
- **Widgets** — single dashboard cards (list explorer, writing prompt, random
  task, analytics stat, cause→effect rules) shown in a grid.

## Files

| File | Purpose |
|------|---------|
| `modules-panel.tsx` | **Orchestrator**: lists workspaces + widgets, opens a workspace full-screen, hosts the build/config dialogs |
| `module-helpers.ts` | **Pure helpers + constants**: random pickers, writing word banks, `MODULE_META`, `WIDGET_MODULE_TYPES`, `ruleMatches`, `tasksInList`, stat/rule-operator options. Unit-tested in `module-helpers.test.ts` |
| `module-bodies.tsx` | `ModuleCard` + per-widget render bodies (analytics stat, list summary, writing prompt, list explorer, random task, rules). Exports `AnalyticsStat` (reused by workspace `stat` views) |
| `module-helpers.test.ts` | Unit tests for the pure helpers (`ruleMatches`, `tasksInList`, `randN`) |
| `ModuleConfigDialog.tsx` | Add/configure a **widget** |
| `workspace/ModuleWorkspace.tsx` | Full-screen workspace renderer: header (back / rename / add view / **Print–Export** / **Sync to Plan**) + a tab per view |
| `workspace/module-view-bodies.tsx` | The per-kind view bodies + `ModuleViewBody` switch + shared countdown `Timer` |
| `workspace/ModuleViewEditor.tsx` | Add/edit one bound view (kind, title, source list, group/sum/date attrs, pick count, timer, stat) |
| `workspace/ModuleBuilderDialog.tsx` | "Build a module" chooser: **build from scratch** (definition-first), saved definitions, workspace templates, or a classic widget |
| `workspace/ModuleSettingsDialog.tsx` | **Module definition / settings editor**: name, icon, description, bound lists (+ roles + attribute extensions), views (add/edit/remove/**reorder**), plan-sync + print toggles, attach workflows. Edits a controlled `ModuleDefinition` and reports via `onSave` |
| `workspace/ModuleListsPanel.tsx` | In-workspace **bound-list editor**: each binding's `role`, list (category), optional item type, and per-binding attribute extensions (reuses Lists' `AttributeSchemaEditor`) |
| `workspace/WorkflowBuilder.tsx` | **Visual workflow manager** ("Zapier for personal ideas"): list / add / edit / enable / delete / run a module's authored workflows. Persists to `lib/workflows-store.ts` |
| `workspace/WorkflowStepEditor.tsx` | Composes a single serializable `WorkflowDefinition`: trigger → conditions → drag-reorderable action steps. No DSL — the JSON shape is the source of truth |
| `workspace/ModulePopoutView.tsx` | Renders one module workspace **standalone** (no app shell) for the pop-out window; mounted by `app/page.tsx` on the pop-out hash route |

## Data

Module instances persist in **`lib/modules-store.ts`** (`cogs-modules-store`).

A module is `{ id, type, title, config }` plus optional **workspace** fields:
`kind: "workspace"`, `icon`, `description`, `templateId`, `views: ModuleView[]`,
`enablePrint`, and `planSync`.

A **view** is `{ id, title, kind, config }` where `config` binds it to a source
list (`categoryId`) and kind-specific options (`groupAttrId`/`valueAttrId`,
`dateAttrId`/`timeAttrId`, `pickCount`, `timerMinutes`, `stat`, `statusAttrId`
(kanban), `criteria` (decision matrix), `notesKey`, `matchTargetCategoryId`/
`matchTextAttrId`/`linkRelation` (matcher), `quizSourceCategoryId`/`fileAttrId`/
`quizChoiceCount` (quiz), `cards` (dashboard)). Workspace instances may also carry
`scheduleSync` (turn finalized dated items into events).

The lists, items, and attributes a workspace operates on are **ordinary COGS
data** in `task-store` — so they also show up in Lists, Scheduler, Analytics, etc.
Templates and the grid live in `lib/module-templates.ts` and
`components/spreadsheet/SheetGrid.tsx`.

## Workspace view kinds

| Kind | Behavior |
|------|----------|
| `spreadsheet` | Google-Sheets-style editable grid (rows = items, columns = attributes); inline edit, A1 range selection + summary bar, per-cell `=A1` formulas + fill handle, row/column resize, column totals, add-row, add-column. Reuses `SheetGrid` |
| `checklist` | Check/complete + quick-add; attribute chips |
| `agenda` | Items grouped by a date attribute, sorted, with time + cost badges (the Itinerary view) |
| `summary` | Rollups: group by an attribute, optionally sum a numeric/currency attribute (cost by booked/unbooked, spend by category, items per room) |
| `randomizer` | Gamified "pick N" from open items with an optional countdown ("pick up 20 things", "clean for 20 min") |
| `timer` | A focus countdown |
| `stat` | A single analytics headline number |
| `gallery` | Image cards for items with an image attribute |
| `notes` | Free text (persisted to localStorage) — e.g. "my cleaning systems" |
| `kanban` | Board grouped into columns by a selection/text attribute (`config.statusAttrId`); columns derived via `isKanbanGroupable`. Reuses the Lists kanban utilities (`components/Lists/list-content/kanban-utils.ts`) |
| `decision-matrix` | Weighted multi-criteria ranking (MCDA): rows = options (items), columns = criteria (numeric attributes, each with a weight + direction). Computes a normalized weighted score per option, ranks highest-first, and highlights the winner. Scoring core is `lib/decision-matrix.ts` |
| `timeline` | Day-by-day timeline of dated items (`config.dateAttrId`/`timeAttrId`) with time, cost, and booked/finalized badges — the confirmed-trip companion to `agenda`. Reflects `lib/module-schedule-sync.ts` |
| `matcher` | Batch-links each source-list item to its best candidate in another list (`config.matchTargetCategoryId`, `matchTextAttrId`, `linkRelation`) via `lib/book-match.ts`, showing confidence and flagging unmatched items |
| `quiz` | "Taste it" guessing game: shows a random snippet from a source item's extracted text and asks you to pick the matching title from N choices (`config.quizSourceCategoryId`, `fileAttrId`, `quizChoiceCount`) |
| `dashboard` | Grid of headline rollup cards (`config.cards: DashboardCard[]`), each a sum/avg/min/max over a list's numeric attribute with an optional **include** boolean gate and optional subtract (Budget: liquid total, net worth, expected spend) |

### Decision matrix (`decision-matrix`)

Criteria are modeled as `config.criteria: DecisionCriterion[]` (in `lib/modules-store.ts`),
where each `{ attrId, weight, benefit }` binds a **numeric list attribute** to a
relative `weight` (0–10) and a direction (`benefit: true` ⇒ higher-is-better,
`false` ⇒ a cost where lower-is-better). This reuses the existing
attribute-id-reference pattern (like `groupAttrId`/`valueAttrId`) rather than
storing ad-hoc criterion data, so the criteria stay in sync with the list schema.

Scoring (`scoreDecisionMatrix` in `lib/decision-matrix.ts`): each criterion's raw
values are **min–max normalized** to [0,1] across the options (cost criteria are
inverted); weights are renormalized to sum to 1; the final score is the weighted
sum (0–1, shown as 0–100). Missing/non-numeric values count as worst-case (0) and
are excluded from the range; criteria with all-equal values normalize to 1; zero
total weight ⇒ all-zero scores. Editing a weight slider updates the ranking live
and persists onto the view. Pure + unit-tested in `lib/decision-matrix.test.ts`.

## Templates (`lib/module-templates.ts`)

| Template | Lists created | Highlights |
|----------|---------------|-----------|
| **Itinerary Creator** | Trip Plan, Flights, Activities & Stays, Packing, To Do Before Trip | Spreadsheet + **timeline**; cost / booked / theoretical-vs-finalized; cost rollup; **Print/Export**; a seeded workflow that on **Finalized** runs **Sync to Plan** + schedules the event (`module-schedule-sync`) |
| **Cleaning System** | Rooms, Systems, Cleaning Tasks | Gamified randomizer + focus timer; per-room summary; room/system inventory spreadsheets; notes for your systems; "session complete → tag cleaned" workflow |
| **Budget Tracker** | Accounts, Monthly Payments, Debts, Expected Spend | **Dashboard** of optional-inclusion rollups (liquid total, net worth = accounts − debts, expected spend, monthly payments); per-list spreadsheets; payments-by-status summary |
| **Book Tasting** | Reading List, PDF Shelf | A **matcher** that links each PDF (`file` attribute, extracted text) to its book with confidence + unmatched flags, plus a **quiz** that shows a random snippet and asks you to guess the title; "PDF added with no match → throw" workflow |
| **Blank Workspace** | New List | Empty starting point — add your own lists and views |

## Building modules from scratch (definitions)

A **`ModuleDefinition`** (`lib/types.ts`) is the serializable *blueprint* of a
module — bound lists (`ModuleListBinding[]` with a `role`, optional item type, and
attribute extensions), presentation `views`, attached `workflows`, optional
`planSync`, and a print toggle. Definitions are authored in `ModuleSettingsDialog`
and stored in **`lib/module-definitions.ts`** (`cogs-module-definitions`).

- `createEmptyDefinition(name)` — a blank, ready-to-edit definition.
- `definitionToInstance(def, id?)` — pure map onto a runnable `ModuleInstance`.
- `instantiateDefinition(id)` — layers each binding's attribute extensions onto its
  list, adds a workspace `ModuleInstance` (`lib/modules-store`), and registers
  fresh copies of the definition's workflows in `lib/workflows-store` scoped to the
  new instance. Returns the new instance id.
- `serializeModuleDefinition` / `parseModuleDefinition` — round-trippable JSON
  (no functions). Portable export/import lives in `lib/data/backup.ts`
  (`exportModuleDefinition` / `importModuleDefinition` / `downloadModuleDefinition`).

## Workflows (the "rules ACT" layer)

`WorkflowBuilder` + `WorkflowStepEditor` author `WorkflowDefinition`s into
`lib/workflows-store.ts`. The engine (`lib/workflow-engine.ts`) runs them on real
item mutations once `initWorkflowEngine(...)` is installed — `app/page.tsx` calls
it once on client mount with a `createTaskRepositoryAdapter()` (idempotent,
client-only, safe for static export). A workflow is a **trigger** (item
create/update/complete, attribute change, manual button, schedule), optional
**conditions** (`ItemRuleCondition`), and an ordered, drag-reorderable list of
**actions** (every `WorkflowAction` kind).

## Pop-out windows

A workspace can be **popped out** into its own window. The convention is a hash
route the root page recognizes: **`#popout/module/<moduleId>`** (helpers
`modulePopoutHash` / `parseModulePopoutModuleId` / `openModulePopout` in
`workspace/ModuleWorkspace.tsx`). In Electron, `openModulePopout` calls
`window.desktop.openModulePopout(hash)` → an IPC channel
(`cogs:window:openModulePopout`) that opens a real `BrowserWindow` at the pop-out
URL; in the browser it falls back to `window.open(...)`. `app/page.tsx` detects the
hash and renders `<ModulePopoutView moduleId>` with no global header/tabs.

## Plan sync

`lib/module-plan-sync.ts` (`syncModuleToPlan`) writes a workspace's finalized,
dated items into the day Plan text (`lib/plan-text.ts`) — keeping a finalized trip
in lockstep with the Scheduler/Plan without duplicating the data model.

## Props

`ModulesPanel` accepts `onTaskSelect(taskId)` — wired from `app/page.tsx` to open
the full-screen item detail when a module surfaces an item.
