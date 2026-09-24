# Operations — a little graphic tool for a project

A **Brain2** top-level tab. An **Operation** is a small graphic tool for any kind of
project: the work, the ideas, the data, and the progress. A trip, a paid job, a
magazine, cleaning the house. It is deliberately **not** trip-shaped, and nothing
about a new operation is assumed. What an individual operation *is* comes from
configuration stored on the item itself:

| Configuration | Attribute | Effect |
|---------------|-----------|--------|
| **Categories** | `OPERATION_ATTR.categories` (`multistring`) | Free-form labels — `trip`, `paid`, `foxtide job`, `computer work`, … An operation can hold **several**, and appears under each on the home board. New categories exist simply because an operation uses one; there is no registry to maintain. |
| **Panels** | `OPERATION_ATTR.panels` (`multistring`) | Which prebuilt panels the workspace shows. A computer-work op can be Home + To do + Phases + Parts + Log; a trip adds Timeline, Locations, and a Plan doc. Edited in the operation's **Settings** dialog. |
| **Tracking tags** | `OPERATION_ATTR.trackingTagIds` | Ids from the Home → Tracking tag library. **Working on this now** paints the Activity grid with a pen that carries them, so any Goal / Yes-No habit linked to those tags auto-fills from the minutes (daily that day; weekly/monthly across the period). |

Structurally an Operation is still just a `Task` carrying `type: "operation"`, so
it inherits the entire item model (attributes, links, lists, tags, time logs).
Its phases, parts, and resources are *other* tasks linked through the typed
relations in `lib/links.ts`:

| Relation (operation → child) | Inverse (child → operation) | Meaning |
|------------------------------|-----------------------------|---------|
| `has-phase`                  | `phase-of`                  | a phase of the operation |
| `has-part`                   | `part-of`                   | a to-do, a phase step, or a part-formula task |
| `has-resource`               | `resource-of`               | a reference/asset/contact |

**Parts** (the tab) are a different layer from those `has-part` links. A part
kind and its instances, including ideas, are JSON on the operation
(`partFormulas`, `partInstances`). The stages and finish steps of a kind are
real tasks. Ideas are not. See below.

Resolution reads **both** link directions (`getRelatedChildren` in
`lib/operations.ts`), so a child linked either way is discovered.

## Panels

`OPERATION_PANELS` (in `lib/operation-types.ts`) is the prebuilt registry. Each
entry declares a label, a description shown in Settings, its surface (`tab` or
`rail`), and whether it is locked, on by default, or full-width.

| Panel | Default | Surface | What it is |
|-------|---------|---------|------------|
| `home` | on (locked) | tab | Mission, stage, progress, notes pad, work/neglect heatmap |
| `tasks` | on | tab | **To do** — a real Lists panel, plus phase steps and part tasks (see below) |
| `phases` | on | tab | Ordered phases with checklists of steps |
| `parts` | on | tab | Kinds (formulas), part pages, ideas, glance metrics |
| `timeline` | off | tab (wide) | Day-by-day grid for anything date-shaped |
| `locations` | off | tab (wide) | Map + place lists (formerly "Activities") |
| `plan` | off | tab (wide) | Long-form plan document |
| `resources` | off | tab | Attached references, assets, contacts, gear |
| `log` | on | tab | Time-log feed + quick punch-in |
| `queue` | on | rail | Ranked next actions docked beside the panels |

Wide panels hide the Queue rail while open. `Home` can never be switched off.

**Renames.** `activities` → `locations` and `itinerary` → `timeline`.
`OPERATION_PANEL_ALIASES` + `canonicalOperationPanelId()` migrate ids that are
already persisted, so an operation saved with the old names simply shows the new
tabs.

**Presets** (`OPERATION_PRESETS`) are one-click panel sets — Standard, Blank,
Trip, Project, Paid job — offered in the create row on the home board (the
"Shape" select) and in Settings. A preset's suggested categories are *added*,
never removed.

## Home board — archived operations

Completed and inactive operations stay off the board until **Show archived**.

| Mark | Stage (or flag) | On the board by default |
|------|-----------------|-------------------------|
| In progress | `planning`, `active` | shown |
| Inactive | `paused`, `abandoned` | hidden |
| Completed | `done`, or `completed: true` | hidden |

**Hide archived** puts them away again. The status line counts how many are hidden.

## Delete

**Settings → Delete operation** opens an **Are you sure?** dialog. Confirming
removes the operation, its to-do list, its phases and steps, and its part
tasks. Attached resources are left in place. The workspace returns to the board.

## Parts

A **kind** is the formula for one sort of part. A **part** is one instance, and
it has its own page.

| Example | Kinds | What the pages hold |
|---------|-------|---------------------|
| Fashion magazine | **Issue** (finish: ordered → printed) containing **Article** (drafted → written → formatted) | Each issue and each article is a page. An idea can sit on the issue or on an article inside it. |
| Clean the house | **Room**, no stages | Living room, Bedroom — pages for ideas and whatever you nest later. |

- Stages and finish steps become tasks named `{part} — {step}`. They show on the part page and in **To do**.
- **Ideas** are notes on that part. They are not tasks and do not join To do.
- The parts board shows kind counts and completion meters (`3/7 drafted`, `finished`). **Metrics** chooses which labels stay in view (`partsGlance`; absent means all of them, including **finished** when that word is not already a step).
- Nested kinds are added from inside the parent part, not from the board.

## Operations ↔ Lists / the item model

The **To do** panel (panel id `tasks`) is not a bespoke list: it mounts
`components/Lists/list-content/ListContentPanel` — the same component the Lists
tab uses — over a real `List` created by `lib/operation-lists.ts`:

- one list per operation (`op-list-{operationId}`), filed in an **Operations**
  folder, named after the operation and renamed with it;
- items added there are ordinary tasks with `lists: [thatList]`, so they carry
  item types, attributes, detail panels, scheduling, search, and All Items;
- each item is *also* linked `has-part` to the operation, so it feeds the
  progress bar and the Queue rail;
- phase checklist steps and part stage/finish tasks are filed onto the same
  list (`fileLooseOperationTodos` catches ones that were created earlier), so
  the big To do list is the whole operation's work;
- display mode (default / checklist / table / spreadsheet) is remembered per list
  in `lib/lists-ui-store.ts`, exactly like the Lists tab.

The **Settings** dialog is modeled on `components/ItemTypes/ItemTypeEditor.tsx`:
checkbox lists over a serializable definition, presets for a fast start, and
everything persisted on the item. **Tracking & habits** is the tag picker that
joins Operations to the Home dashboard's Tracking pens and linked habits.

## Working on this now

The workspace menubar (and Home → Tracking, and the header Tracking dialog)
share one live clock (`lib/operation-work-session.ts` + `lib/work-session-store.ts`):

1. **Working on this now** starts a session. A phosphor lamp and elapsed clock
   replace the button with **Stop working on {name}**.
2. While it runs, the Activity Time Grid grows a minute-accurate block for this
   operation (same data as the Activity Log; still editable like any other block).
3. **Stop** writes the elapsed span as:
   - a To Do **Done** row titled `worked on {name}` (day / week / month, with the
     observed clock window — not an **est.** guess);
   - `timeLogs` on the operation (Operations **Log** + Tracking **Day Log**);
   - the Tracking block, finalized to the real start/end minutes.

Tag the operation in Settings with Tracking tags so linked habits count
those minutes. One session at a time; starting another stops the current one.

## Files

| File | Role |
|------|------|
| `lib/operation-types.ts` *(lib)* | `operation` `ItemTypeDefinition`, panel registry (including Parts; To do keeps the `tasks` id), presets, category/panel/tracking-tag normalizers, `withOperationType()` |
| `lib/operations.ts` *(lib)* | pure helpers (hours rollup, phase completion, heatmap, to-do-next, relation resolution, category grouping/sorting, `isArchivedOperation`) |
| `lib/operation-parts.ts` *(lib)* | part kinds, instances, ideas, glance meters, `collectOperationTodoTasks` |
| `lib/operation-lists.ts` *(lib)* | the backing `List` for the To do panel (Operations ↔ Lists bridge) |
| `lib/operation-itinerary.ts` *(lib)* | backing module for the Timeline / Locations / Plan panels, created only when one is enabled |
| `lib/operation-work-session.ts` *(lib)* | live "working on this now" clock: day slices, Tracking paint, Done row, timeLogs, habit sync |
| `lib/work-session-store.ts` *(lib)* | persisted pointer to the open session (`cogs-work-session`) |
| `operations-chrome.css` | Milled fascia (CRT title, engraved nameplates, raised metal keys, equal-fill view keys, stage power lamps, CRT heatmap well, working-now lamp) |
| `OperationsView.tsx` | home board: category groups, category filter, sort, **Show archived**, preset-aware inline create. Last open operation survives refresh / tab switch. |
| `OperationWorkspace.tsx` | full-screen mini-app; tab strip built from the operation's enabled panels. Last panel per operation is restored, plus that panel's scroll. |
| `WorkingNowControl.tsx` | menubar **Working on this now** / **Stop working on {name}** toggle |
| `OperationSettingsDialog.tsx` | per-operation settings: identity, categories, tracking tags, panels, presets, **Delete operation** |
| `OperationHome.tsx` | Home: mission, stage, progress, notes, work/neglect heatmap |
| `OperationTasksPanel.tsx` | To do: embeds the Lists content panel, including phase steps and part tasks |
| `PhasesPanel.tsx` | phases + their steps, inline add/complete/detach |
| `PartsPanel.tsx` | kinds, part pages, ideas, glance metrics |
| `OperationFieldPlanPanels.tsx` | Timeline / Locations / Plan panels over the backing module |
| `ToDoNextRail.tsx` | Queue rail — ranked next-actionable tasks across the tree |
| `ResourcesPanel.tsx` | attached resource items |
| `OperationLogFeed.tsx` | time-log feed + quick "log time" form |
| `OperationPostMortemDialog.tsx` | Win95 after-action report → `addOperationReview` |
| `operation-actions.ts` | imperative store mutations (categories, panels, presets, phases, part kinds/instances/ideas, list items, delete, time) |
| `index.ts` | integration barrel |

## Chrome

The Operations tab uses the house **milled fascia**
([`docs/DESIGN_STYLE.md` — Milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia)):
brushed silver bays, CRT black-glass titles (`#070c0a` + house phosphor
`#7dffc4`), engraved nameplates, raised metal keys, and equal-fill view keys
(active key is a CRT with a round power lamp). Same verbs as before — only the
furniture changed.

The landing board groups operations under engraved category nameplates, each
card showing a round stage lamp, the mission snippet, category chips, and how
many panels it has on. Completed and inactive operations are omitted until
**Show archived**. A milled toolbar carries the sort select, a "Group by
category" checkbox, that archive toggle, and a checkbox strip to filter
categories (the same affordance as the Lists All view). Opening an operation
keeps the fascia: CRT title (click the name to rename), **Board** / **Settings**
/ **After-action report** metal keys with the operation's category chips, a
**Working on this now** toggle (phosphor lamp + CRT elapsed clock while live),
equal-fill panel keys (Home, To do, Phases, Parts, Log, and whatever else
Settings switched on), the Queue rail, and a CRT phosphor heatmap on Home.
Settings and After-action dialogs share the same milled chrome. Settings can
delete the operation after **Are you sure?**.

## Pure helpers (`lib/operations.ts`)

- `loggedMinutes` / `rollupMinutes` / `rollupHours` — hours rollup over `Task.timeLogs`.
- `getPhases` / `getParts` / `getResources` / `getOperationTaskTree` — relation resolution (both directions).
- `evaluatePhase` / `operationProgress` — phase-completion evaluation.
- `buildHeatmap` / `heatLevel` / `neglectedDays` — work/neglect heatmap cells.
- `selectToDoNext` — next-actionable selector (incomplete, dependency-satisfied, ranked).
- `isArchivedOperation` — `paused`, `done`, `abandoned`, or `completed`.
- `selectOperations` / `collectOperationCategories` — the operations in a task array and every category in use.
- `groupOperationsByCategory` / `filterOperationsByCategory` / `sortOperations` — the home board's grouping, filtering (`visibleCategoryKeys`: omit for no filter, `[]` for "all deselected"), and ordering by name / stage / target date / recency.

Part formulas, glance meters, and the To do union are in `lib/operation-parts.ts`
(`readPartFormulas`, `glanceMeters`, `collectOperationTodoTasks`).

Tested in `lib/operations.test.ts`, `lib/operation-model.test.ts`, and
`lib/operation-parts.test.ts`; the UI in `OperationsView.test.tsx`,
`OperationWorkspace.test.tsx`, and `PartsPanel.test.tsx`. Run
`npm test -- lib/operations.test.ts lib/operation-model.test.ts lib/operation-parts.test.ts lib/operation-work-session.test.ts components/Operations`.

## Exports for integration

- `withOperationType(types)` — register the built-in `operation` type.
- `OperationsView` — the top-level tab surface.
- `OperationWorkspace` — mount for a single operation id.
- `upgradeTaskToOperation(taskId)` — promote an existing task (wired into the item-detail "⋯" menu).
- `createOperation(title, { presetId, categories, panels })` — create already shaped.
- `resolveOperationPanels(op)` / `getOperationCategories(op)` / `getOperationTrackingTagIds(op)` — read an operation's configuration anywhere.
