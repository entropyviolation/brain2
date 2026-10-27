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
_Last mapped: 2026-10-27._ **Computer Project** (`computer-project`,
`lib/computer-project-types.ts`) is a subtype: `parentTypeId` is `operation`,
and `isOperation` is true for both ids, so a computer project stays on this
board and in the workspace. Item Types → Operations lists both (a subtype is
in the parent list). Item Types → Computer Projects lists only that type.
Existing operations are already items; a record that is still typed `item`
but carries operation panels, a task list, parts, or a tracking pen is stamped
`operation` once on vault load (`lib/operation-item-stamp.ts`). That pass does
not insert a second item.
Its phases, parts, and resources are *other* tasks linked through the typed
relations in `lib/links.ts`:

| Relation (operation → child) | Inverse (child → operation) | Meaning |
|------------------------------|-----------------------------|---------|
| `has-phase`                  | `phase-of`                  | a phase of the operation |
| `has-part`                   | `part-of`                   | a to-do, a phase step, or a part-formula task |
| `has-resource`               | `resource-of`               | a reference/asset/contact |

**Parts** (the tab) are a different layer from those `has-part` links. A part
kind and its instances are JSON on the operation (`partFormulas`,
`partInstances`). The current stage, finish checks, status report, and notes
live on the part. Notes are stored as `ideas`. Stages do not create tasks.
See below.

Resolution reads **both** link directions (`getRelatedChildren` in
`lib/operations.ts`), so a child linked either way is discovered.

## Public door

Other rooms may import:

- `useWorkSessionClock` from `WorkingNowControl.tsx` — the shared live clock. Tracking's `WorkingNowStrip` (`components/Home/Tracking/working-now-strip.tsx`) uses it, and so do the header now rows (`components/header-now-rows.tsx`) once a session is live. The idle header shell (`components/header-now-box.tsx`) reads only the session flag in `lib/work-session-store.ts`, so a refresh does not import the timegrid. The hook reads `lib/work-session-store.ts` and calls `tickWorkSession`, which writes that store (`setSession`) and grows the live block on `lib/time-tracking-store.ts`.
- `OperationsView` from `OperationsView.tsx` — the shell lazy-loads the tab (`app/page.tsx`).
- `upgradeTaskToOperation` and `OPERATION_TYPE_ID` from the barrel (`index.ts`) — item detail's menu (`components/ItemDetail/ItemDetailPage.tsx`).
- `operations-chrome.css` — the shell (`app/layout.tsx`) and Tracking's working-now and pen-color strips.

Mutations in `operation-actions.ts` write **`lib/task-store.ts`** (`useTaskStore`). Start and stop go through `lib/operation-work-session.ts`, which writes **`lib/work-session-store.ts`** and, on stop, tasks through `taskRepository`.

Stay in this room: the `WorkingNowControl` button, `OperationWorkspace`, and the panels — `OperationHome`, `OperationTasksPanel`, `PhasesPanel`, `PartsPanel`, `OperationFieldPlanPanels`, `ToDoNextRail`, `ResourcesPanel`, `OperationLogFeed`, `OperationSettingsDialog`, `OperationPostMortemDialog`, `OperationMissReasonDialog`. Nothing outside imports them.

## Panels

`OPERATION_PANELS` (in `lib/operation-types.ts`) is the prebuilt registry. Each
entry declares a label, a description shown in Settings, its surface (`tab` or
`rail`), and whether it is locked, on by default, or full-width.

| Panel | Default | Surface | What it is |
|-------|---------|---------|------------|
| `home` | on (locked) | tab | Mission, stage, progress (phases and to-dos), item note log, work/neglect heatmap |
| `tasks` | on | tab | **To do** — a real Lists panel, plus phase steps and part tasks (see below) |
| `phases` | on | tab | Ordered phases with checklists of steps |
| `parts` | on | tab | Kinds (formulas), part pages (stage, status, to-dos, notes), glance metrics |
| `timeline` | off | tab (wide) | Day-by-day grid for anything date-shaped |
| `locations` | off | tab (wide) | Map + place lists (formerly "Activities") |
| `plan` | off | tab (wide) | Long-form plan document |
| `resources` | off | tab | Same `Task.resources` as item detail: links, copied files, file references, and a use note |
| `log` | on | tab | Chronological feed: **created** from `createdAt`, time punches, pen colors (`penLinks`) |
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

_Last mapped: 2026-10-27._ A **kind** is the formula for one sort of part. A **part** is one instance, and it has its own page. The page order is name, status, to-do, notes. Nested parts, when the kind has them, sit under that.

| Example | Kinds | What the pages hold |
|---------|-------|---------------------|
| Fashion magazine | **Issue** (finish: ordered → printed) containing **Article** (drafted → written → formatted) | Each issue and each article is a page. A note can sit on the issue or on an article inside it. |
| Clean the house | **Room**, no stages | Living room, Bedroom — pages for notes, a status report, and whatever you nest later. |

- **Current stage** is the kind's stage list (drafted → written → formatted, or whatever that kind defines). It is a progression on the part: `currentStage` is the furthest label reached, and earlier stages count as reached. `""` means none. Finish steps are `completedFinish` on the same part. Checking a stage or a finish step does not create or complete a to-do. `evaluatePhase` never read part stages; a phase still completes from its own step tasks.
- Parts saved before this field have no `currentStage`. The page still shows each older stage task and finish task as its own check, until you change one. Changing one writes the part. Those older tasks stay on the operation. They are not deleted, and new stages do not add more of them.
- **Latest status report** is one short line, `statusReport` on the part. It is the current word on this part, separate from the note list.
- **To do** on the page is tasks filed on the operation list with `partInstanceId` and no stage/finish role (`addPartTodo`). Stage mirrors are not listed there.
- **Notes** are the part's `ideas` array. The section used to say Ideas. The stored records are the same. They are not tasks and do not join To do.
- The parts board shows kind counts and completion meters (`3/7 drafted`, `finished`). A meter reads the part's stage or finish checks, and falls back to those older tasks only when the part has not stored its own. **Metrics** chooses which labels stay in view (`partsGlance`; absent means all of them, including **finished** when that word is not already a step).
- Nested kinds are added from inside the parent part, not from the board.
- **Add kind** / **Save kind** on the board, and **Add task** / **Add note** on the part page, are primary keycaps (`.ops-keycap.is-primary`).

## Operations ↔ Lists / the item model

The **To do** panel (panel id `tasks`) is not a bespoke list: it mounts
`components/Lists/list-content/ListContentPanel` — the same component the Lists
tab uses — over a real `List` created by `lib/operation-lists.ts`:

- one list per operation (`op-list-{operationId}`), filed in an **Operations**
  folder, named after the operation and renamed with it;
- items added there are ordinary tasks with `lists: [thatList]`, so they carry
  item types, attributes, detail panels, search, and All Items. The list is
  not schedulable until someone turns that on;
- each item is *also* linked `has-part` to the operation, so it feeds the
  progress bar and the Queue rail;
- phase checklist steps, to-dos filed on a part, and any stage/finish tasks
  left from before stages moved onto the part are filed onto the same list
  (`fileLooseOperationTodos` catches ones that were created earlier), so the
  big To do list is the operation's work. A new stage check does not add a row;
- display mode (default / checklist / table / spreadsheet) is remembered per list
  in `lib/lists-ui-store.ts`, exactly like the Lists tab;
- the panel hosts that list inside `.fm98` (the Lists skin). Reading rows, the
  16px orb, and the add-task keys are that skin. Without the host class the
  orb image paints at its file size. _Last mapped: 2026-10-27_

## Opening an item

_Last mapped: 2026-10-27._ Clicking an item in the operation opens `TaskDetailPopup` (`components/ItemDetail/ItemDetailPopup.tsx`) over the workspace. The operation stays mounted, on the same tab. Closing the popup returns to that tab. This is the same popup Home's **Open item detail** keycap already hosts for the operation itself. The To do drawer and the To do task card stay separate editors.

The shell's full-page item detail is not used. `OperationsView` does not pass `app/page.tsx`'s `onTaskSelect` into the workspace. `OperationWorkspace` accepts an `onOpenItem` callback and does not call it.

These clicks open the popup:

- a **To do next** row and its Open arrow (`ToDoNextRail`)
- a **To do** list row (`OperationTasksPanel`)
- a phase name, a step name, and their Open arrows (`PhasesPanel`)
- a to-do on a part page (`PartsPanel`)
- an item in **Timeline** or **Locations** (`OperationFieldPlanPanels`)

Choosing a part on the parts board still opens that part's page in the tab (name, status, to-dos, notes). That selection does not leave the operation.

A resource web link still opens in a new browser tab. A log punch still opens the Tracking block editor on double-click.

## Home progress

_Last mapped: 2026-10-27._ The Progress nameplate reads `{done}/{total} phases · {done}/{total} to-dos · {percent}%`.

Phases are `operationProgress` when the operation has at least one phase (a phase counts done when `evaluatePhase` says it is complete). With no phases that side is `0/0`. The parts fallback inside `operationProgress` is not shown as phases, because those parts are to-dos.

To-dos are `collectOperationTodoTasks`: the operation's backing list, phase steps, direct parts, part to-dos, and any older stage/finish tasks still tagged to the operation. A part's current stage is not one of those tasks. Done means `task.completed`.

The percent is the mean of those two fractions. A side whose total is 0 is left out, so an empty list does not pull the other side to 0%. Both empty is 0%. `1/2` phases and `2/4` to-dos is 50%. The bar uses that percent. This is the same two readings the workspace already keeps — not a third progress model.

## Home notes

_Last mapped: 2026-10-27._ Home notes are the operation's item note log
(`Task.noteLog`, plus the standing `Task.notes`). The same log item detail
shows. Entries are dated, newest first, with an optional clock. There is no
author field on a note. **Open item detail** is a pale silver keycap
(`.ops-keycap`) on the Home head. It opens `TaskDetailPopup`
(`components/ItemDetail/ItemDetailPopup.tsx`) over the operation page.
Closing it returns to the same Home. The operations window stays mounted.
This is the item-detail popup. The To do drawer and the To do task card stay
separate editors.

A leftover `attributes.homeNotes` string is folded into one log entry
(`foldOperationHomeNotes`), dated with the operation's created day, then the
attribute is removed. The id is `note_legacy_{operationId}_homenotes`, so the
fold does not add the same words twice. The Computer Project desk edits this
log too, not a second pad.

The **Settings** dialog is modeled on `components/ItemTypes/ItemTypeEditor.tsx`:
checkbox lists over a serializable definition, presets for a fast start, and
everything persisted on the item. **Tracking & habits** is the tag picker that
joins Operations to the Home dashboard's Tracking pens and linked habits.

## Working on this now

The workspace menubar (and Home → Tracking, and the header Now dialog)
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

   If objectives for right now are still open, Stop asks whether to save them.
   Yes closes and parks them for the next time this operation (or an attached
   task or subtask) is tracked. No closes without parking. Cancel leaves the
   clock running. After the clock stops, the optional end-of-session reflection opens. The operation stays open. **Stop {task}**
   on a named task asks the same question for that pen clock, then the same review.

Tag the operation in Settings with Tracking tags so linked habits count
those minutes. One session at a time; starting another stops the current one.

_Last mapped 2026-10-16:_ hour totals (`OperationHome`, `OperationLogFeed`, and `hoursLogged` on an after-action in `operation-actions.ts`) read `trackedTimeForItems([operation, ...tree], entries)` (`lib/tracked-time.ts`): `timeLogs` plus Tracking blocks on any linked pen (`Task.penLinks`) or carrying a tree task's id, each minute once per day. A clock log and the block it painted count once. The heatmap still reads `timeLogs` only. Log rows are the chronological feed in **Log** below. **Naming a task** (_Last mapped 2026-10-24_, [`docs/TODO_REDESIGN.md`](../../docs/TODO_REDESIGN.md) Phase 6): beside **Working on this now**, **…or a task** opens `ItemPicker` (search, one row per open tree task — `OperationWorkspace` passes `tasks`). It is not a `<select>` of those names. Picking one puts it on the pen clock exactly like ▶ on its To Do row (`useTaskClockStarter`, so it can ask for a pen), and shows **Stop {task}** while it runs. If this operation's own session is live it is stopped first, so time is not painted twice. The two session stores stay separate. The task's blocks carry its `taskId`, so they roll up into the hour totals above.

## Log

_Last mapped: 2026-10-27._ The Log tab (`OperationLogFeed`) is one list, oldest first. **created** is the operation's own `createdAt` — local date in the date column, the word `created` where a punch shows minutes, and the local clock (`HH:mm`) in the note column. That stamp already lives on the item. The feed does not invent a second one, and it does not count as logged time (the hour total stays `trackedTimeForItems`). Time punches stay `TimeLogEntry` rows from the operation and its task tree, in the same list. A punch with only a day and no `startTime` sorts at the end of that local day, so it follows a **created** line from earlier the same day. A backdated punch from before `createdAt` sorts above **created**. With no punches, the tab still shows **created** and **No time logged yet.**

Pen colors are the Tracking pens already on the item (`Task.penLinks`: `{ scopeId, penId }[]`). **Choose pens** (`.ops-keycap`) opens a searchable multiselect on the deck (`#ops-log-pen-menu`). The field filters by pen name, and by the row label (`Activity · Work`). Selected pens stay as chips above the field and as checked rows in the list. A search that hits nothing says **No pens match.** Click a row, or press Enter on the highlighted row while the field is focused (arrow keys move that highlight; the same arrows move through the rows when one of them is focused). Each toggle writes `Task.penLinks` at once. The first link stays the clock pen, same as on any task. **Done** (that same keycap) and Escape only close the menu. **Log time** is a primary keycap (`.ops-keycap.is-primary`). No second palette, and `trackingPenId` (the pen **Working on this now** paints with) is not copied in unless you choose it. Hour totals already count blocks on those pens. A punch row shows a swatch when it belongs to a real block: that block's pen color, so the row and the block are the same color.

Double-click a punch that has a block and the Tracking block editor opens (`EntryDialog`, the same one the Time Grid and Activity Log use). A single click stays on the log. **created** does nothing on double-click. A day-only punch, with no id and no clock, is not a block. The match is `TimeLogEntry.entryIds` (or the log id itself) first, otherwise the same local date and the same start and end — `00:00` written for the end of the day counts as minute 1440 when the duration says so. The note text is not used. If several blocks share that window, the punch's task wins, then `trackingPenId`, then a pen in `penLinks`.

## Resources

_Last mapped: 2026-10-27._ The Resources tab (`ResourcesPanel`) edits the operation's `Task.resources` — the same records as Item Detail → Resources. It does not create `has-resource` child tasks (`getResources` still lists those for the computer-project desk). **Add link** (primary `.ops-keycap`) stores a web address (`ItemResource.url`, `uri` `url:<id>`). **Add file** copies a file from this computer into the attachments store. **Reference file** uses the desktop file-link picker (`bridge.pick({ folders: false })`) so the file stays on disk. Each row has **What this is for here** (`ItemResource.useNote`). Item detail shows that same note under the caption.

## Files

| File | Role |
|------|------|
| `lib/operation-types.ts` *(lib)* | `operation` `ItemTypeDefinition`, panel registry (including Parts; To do keeps the `tasks` id), presets, category/panel/tracking-tag normalizers, `withOperationType()` |
| `lib/operations.ts` *(lib)* | pure helpers (hours rollup, phase completion, heatmap, to-do-next, relation resolution, category grouping/sorting, `isArchivedOperation`) |
| `lib/operation-parts.ts` *(lib)* | part kinds, instances, stage, status report, notes, glance meters, `collectOperationTodoTasks` |
| `lib/operation-lists.ts` *(lib)* | the backing `List` for the To do panel (Operations ↔ Lists bridge) |
| `lib/operation-itinerary.ts` *(lib)* | backing module for the Timeline / Locations / Plan panels, created only when one is enabled |
| `lib/operation-work-session.ts` *(lib)* | live "working on this now" clock: day slices, Tracking paint, Done row, timeLogs, habit sync |
| `lib/work-session-store.ts` *(lib)* | persisted pointer to the open session (`cogs-work-session`) |
| `operations-chrome.css` | Milled fascia (CRT title, engraved nameplates, raised metal keys, latching keycap view keys, `.ops-keycap` word keys, stage power lamps, CRT heatmap well, working-now lamp). `.ops-scroll` pads the panel scrollport so deck rings are not clipped. _Last mapped: 2026-10-27_ |
| `OperationsView.tsx` | home board: category groups, category filter, sort, **Show archived**, preset-aware inline create. Empty board offers pickable preset objects (`.ops-empty-presets`). Last open operation survives refresh / tab switch. |
| `OperationWorkspace.tsx` | full-screen mini-app; tab strip clusters **Plan/Do** vs **Reference** (`.ops-view-clusters`). The ← keycap returns to the board. A gear keycap on the title row (`.ops-fascia-row`) opens settings. Last panel per operation is restored, plus that panel's scroll. Item clicks open `TaskDetailPopup` over this window; the shell's page navigator is not called. _Last mapped: 2026-10-27_ |
| `WorkingNowControl.tsx` | menubar **Working on this now** / **Stop working on {name}** toggle. Stop with open objectives asks **Yes** / **No** / **Cancel**. After the clock stops, the optional end-of-session reflection opens. The task stays open. **Stop {task}** asks the same for the pen clock. |
| `OperationSettingsDialog.tsx` | per-operation settings: identity, categories, tracking tags, panels, presets, **Delete operation**. **Add category**, preset cards, **Done**, and **Delete operation** are `.ops-keycap`. _Last mapped: 2026-10-27_ |
| `OperationHome.tsx` | Home: mission (`#op-mission`, one line that grows with the text) / progress (phases and to-dos) / item note log as a vertical instrument; **Open item detail** keycap hosts `TaskDetailPopup` over the page; stage chevron (`#op-stage`) sits at the field's right edge; work/neglect heatmap — cold (neglected) days read hotter (`.ops-heat-cell.is-cold`). _Last mapped: 2026-10-27_ |
| `OperationTasksPanel.tsx` | To do: embeds the Lists content panel inside `.fm98`, including phase steps and part tasks. A row opens the item-detail popup. _Last mapped: 2026-10-27_ |
| `PhasesPanel.tsx` | phases + their steps, inline add/complete/detach. The name and the Open arrow open the item-detail popup. _Last mapped: 2026-10-27_ |
| `PartsPanel.tsx` | kinds, part pages, glance metrics. A part page is name, status (current stage and latest status report), to-do, notes. **Add kind**, **Save kind**, **Add task**, and **Add note** are primary keycaps. Choosing a part stays on its page. A to-do on that page opens the item-detail popup. _Last mapped: 2026-10-27_ |
| `OperationFieldPlanPanels.tsx` | Timeline / Locations / Plan panels over the backing module. Timeline and Locations item clicks open the item-detail popup. _Last mapped: 2026-10-27_ |
| `ToDoNextRail.tsx` | Queue rail — ranked next-actionable tasks across the tree. The row and the Open arrow open the item-detail popup. _Last mapped: 2026-10-27_ |
| `ResourcesPanel.tsx` | `Task.resources`: web links, copied files, desktop file references, and `useNote`. **Add link** is a primary keycap. _Last mapped: 2026-10-27_ |
| `OperationLogFeed.tsx` | chronological log: **created** from `createdAt`, time punches, quick **Log time** primary keycap, searchable `penLinks` multiselect (**Choose pens** / **Done** keycaps), double-click opens the matching Tracking block. _Last mapped: 2026-10-27_ |
| `OperationPostMortemDialog.tsx` | Win95 after-action report → `addOperationReview`. Does not write `blockedReasons` |
| `OperationMissReasonDialog.tsx` | Slim why-missed prompt. It is `MissReasonDialog` (reason menu above the window, multiline note). Optional preset and note on `OperationReview.blockedReasons`. There is no menubar button. It opens when the stage becomes `abandoned`. Skip writes nothing. The after-action form is unchanged. _Last mapped: 2026-10-27_ |
| `operation-actions.ts` | imperative store mutations (categories, panels, presets, phases, part kinds/instances/stage/status/notes, list items, delete, time) |
| `index.ts` | integration barrel |

## Chrome

Type sits two pixels above the old 10–15px scale (root 14px), with tracking pulled in and the bays packed a little tighter so the larger type still fits the fascia.

The Operations tab uses the house **milled fascia**
([`docs/DESIGN_STYLE.md` — Milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia)):
brushed silver bays, CRT black-glass titles (`#070c0a` + house phosphor
`#7dffc4`), engraved nameplates, raised metal keys, and latching keycap view
keys (silver skirt at rest; the selected key is a CRT with a round green
on-light; a press is the milled sink). A few word keys use the same pale
silver cap as To Do (`.ops-keycap`): the back arrow, the settings gear, **Open item detail**
on Home, **Add kind**, on the log deck **Choose pens**, **Done**, and **Log time**
(navy primary), and in Settings **Add category**, the preset cards, **Done** (navy primary),
and **Delete operation** (maroon). On a part page, **Add task** and **Add note**
are the same primary cap. _Last mapped: 2026-10-27._ Same verbs
as before — only the furniture changed.

The landing board groups operations under engraved category nameplates, each
card showing a round stage lamp, the mission snippet, category chips, and how
many panels it has on. Completed and inactive operations are omitted until
**Show archived**. A milled toolbar carries the sort select (name, stage,
target date, newest created, recently modified), a "Group by
category" checkbox, that archive toggle, and a checkbox strip to filter
categories (the same affordance as the Lists All view). _Last mapped: 2026-10-27._
Recently modified reads `Task.modifiedAt` (stamped when `updateTask` changes
the row), then a completion time, a note's `editedAt`, and `createdAt`. Opening an operation
keeps the fascia: CRT title (click the name to rename), a ← keycap back to the
board (there is no **Board** menubar key), a gear keycap on that same title
row (aria-label Settings; there is no SETTINGS wordmark on the menubar), and
**After-action report** metal key, with the operation's category chips, a
**Working on this now** toggle (phosphor lamp + CRT elapsed clock while live),
latching keycap panel keys clustered Plan/Do vs Reference (Home, To do, Phases,
Parts, Log, and whatever else Settings switched on), the Queue rail, and a CRT
phosphor heatmap on Home (neglect hotter on cold days). An empty board shows
pickable preset shapes instead of only a blank create field.
Settings and After-action dialogs share the same milled chrome. In Settings,
**Add category**, the preset cards (title and description, with keycap depth),
**Done**, and **Delete operation** are keycaps. The confirm **Cancel** and
**Delete** stay metal keys. Settings can delete the operation after **Are you sure?**.

## Pure helpers (`lib/operations.ts`)

- `loggedMinutes` / `rollupMinutes` / `rollupHours` — hours rollup over `Task.timeLogs` only. The Operations totals now use `trackedTimeForItems` instead; the heatmap still uses these.
- `getPhases` / `getParts` / `getResources` / `getOperationTaskTree` — relation resolution (both directions). `getResources` is the older `has-resource` child list. The Resources tab writes `Task.resources` instead. _Last mapped: 2026-10-27._
- `evaluatePhase` / `operationProgress` — phase-completion evaluation. Home uses `operationProgress` for the phase count when phases exist, and `collectOperationTodoTasks` for the to-do count. The bar is the mean of those two fractions (an empty side is left out). _Last mapped: 2026-10-27._
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
