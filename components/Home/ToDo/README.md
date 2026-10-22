# `components/Home/ToDo/` — To-Do Panel

The Home **To Do** sub-tab in **Brain2**. Day / week / month scoped task lists, plus a **Season** lens, under a milled fascia (CRT title, period nameplate, Day/Week/Month/Season keys, **Open list** on day/week/month, Show / Sort bays — Habits brushed metal, CRT glass, milled keys with room to breathe) and a readable instrument strip.

The **day** lens is Home’s selected day (`currentDate` / `setCurrentDate` from the dashboard). Previous day, next day, and Today on that nameplate call `setCurrentDate`, so the overview, Plan, and Tracking move with it. Week, month, and season nameplates keep a **lens offset** inside To Do — local state that pages the sheet, not a second shell day. Previous, next, and Today on those nameplates do not call `setCurrentDate` and do not move Plan or Tracking. Until a coarse nameplate is used, that lens shows the period that contains the shared Home day (`lib/use-current-date.ts`). Leaving To Do forgets a paged week, month, or season; the shared day stays with Home.

**Open list** opens that period's To do list in Lists (`To do 8/31`, `To do 8/31-9/6`, `To do September 2026`). Season lists open tasks (active or partial) whose day, week, or month already falls in the quarter (`lib/seasons.ts`); missed, cancelled, deferred, and done stay off that list. Adding a task there schedules this month while the season is current, else the season's first month (`seasonMonthDate` in `todo-panel.tsx`). There is no quarter placement on the period ledger. The same folder also holds **Done** and, once the period has ended, **Undone** — the same rows as this panel. **To do** here is the period ledger’s narrow **prospective** set (`tasksProspectiveForPeriod` — open scheduled work); **Done** is retrospective completion during the period ([`docs/TEMPORAL_POLARITY.md`](../../../docs/TEMPORAL_POLARITY.md)). Default sort is **priority**; prioritized Assigned rows always lead. Language: [`docs/DESIGN_STYLE.md`](../../../docs/DESIGN_STYLE.md#milled-fascia).

**Planned (2026-10-15):** [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md) covers a one-grid ledger with Pushes pinned right, marks that survive a push, a readability fix, a new Just Start picker, Now working, step prerequisites, session plans, and pens on items. Phase 0 shipped 2026-10-15:
- **One grid.** The head and every closed row share one column set: Task · Tier · State · Done · Time · Steps · Actions · Pushes. Rows are CSS subgrids of `.todo-table`, with fixed widths where subgrid is missing. Every cell always renders (a `–` when empty, a dim `0` push tube), so no column moves. Pushes is the last column. Under 720px, Done, Time and Steps fold away and Pushes stays last.
- **Marks carry on push** (`carryTodoMarksPatch`, below).
- **Readable glass field.** The input now has dark ink on its light field. The lone via pad under an empty Steps fold is gone.
- **Start** opens the rebuilt Just Start (Phase 1): the smallest ready step at any depth, its estimate on the clock, and Skip / Blocked by… / Too big. See [`components/Focus/README.md`](../../Focus/README.md).
- **▶ Working on this now** (Phase 2): a transport key in Actions, before Start, puts the task on the Tracking pen clock, and every open step in the lid has its own ▶. A task with no pen asks once (`TaskClockStarter`). The row on the clock gets a phosphor rule down its left edge, and the live step a tint. ■ stops. The docked focus bar, the header and Tracking show the same clock. See [`components/Focus/README.md`](../../Focus/README.md#the-task-on-the-clock-phase-2-2026-10-15).
- **Prerequisites** (Phase 3, 2026-10-15). Every open step in the lid has a quiet **Needs…** key (it shows on hover). It starts **link mode**: a violet banner names the step that is choosing, and every other step becomes a **needed?** / **✓ needed** toggle, written to `Subtask.dependsOn`. A toggle is disabled where it would loop, where the step is family (an ancestor or descendant), or where the step is done. **Done** or Esc ends link mode. A step still waiting shows a violet **⊘ needs …** chip (click it to change) and a dimmed name. A step waits on its ancestors' prerequisites too.
- At task level, the lid's Flags row has **Needs…**, which opens `TaskPrereqDialog`: the Plan checklist search (`EventPrereqPicker`) over open tasks, writing `Task.dependencies`, with **Create** for a new unscheduled task. A loop is refused and spelled out (`findCyclePath`). A blocked row shows **⊘ needs …** beside its name. Just Start and Available now read the same fields. Helpers: `lib/prereqs.ts`.

**Planned (2026-10-16), same plan doc.** _Last mapped: 2026-10-16._ Decisions are in the plan doc; only 9 (drag across tasks) is still open. Session plans (Phase 4) are being built in `SessionPlanner.tsx` and `lib/session-plan.ts`, not committed yet; their third tier reads **Exceptional**, and since slice Q (2026-10-16) the stored id is `exceptional` too. New phases, all optional fields and toggles so nothing current changes:
- **Phase 4, keep, park and resume.** Built 2026-10-16 (slice H), not committed. See [Sessions: park, resume, shelves](#sessions-park-resume-shelves). Park in the focus bar, templates, Just 25, breaks, the flat list and the other ways in followed in slice H2 (see [Sessions: ways in, templates, timebox](#sessions-ways-in-templates-timebox-slice-h2)). Padded for you (FN-2) is wired too.
- **Phase 6.** Every task and step shows `est · parts · spent`; spent adds up across sittings until done.
- **Phase 8.** Morning and Night rite rows follow the sun on today's day lens: Night hides until sunset, Morning hides from sunset while not done. Header → Rituals is unchanged. Show-bay toggle `ritesFollowSun`.
- **Phase 9.** _Last mapped: 2026-10-16._ **Built (slice K), not committed.** One `StepTree` (`components/steps/`) shared with item detail → Subtasks: clear hierarchy, no empty stylus lines, ▶ kept, drag and Shift/Cmd-click multi-move, **Hide locked** and **Show next only**, and the calm line. See [Steps](#steps). Not built: cross-task drag (Decision 9 open), Paste as log (waits for slice I).
- **Phase 10.** Bare minimum / Goal / Exceptional on steps (`Subtask.tier`, unset top level = Goal), inherited down the tree. Percent done becomes **weighted by the tree** (each child an equal share of its parent), and each task and step shows B / G / E percent and the level it is completed to.
- **Phase 11.** Steps become items when needed (`Subtask.itemId`, `Task.parentTaskId` + `stepOf`). Clicking a step's star or dot opens its item detail on top of whatever is open, with Back.
- **Phase 12.** _Last mapped: 2026-10-16._ **Built (slice O), not committed.** The **To Do task card**. See [Task card](#task-card).
- **Phase 13.** Drag whole branches into session tiers, split one tree across tiers, and session-only tasks that **Persist** on request.
- **Phase 14.** Only prerequisites (`dependencies`, `dependsOn`) **lock**; open steps leave a task **incomplete**, never locked. New `lib/unlock-value.ts` adds an `unlocks` signal to the Priority formula, so a prerequisite of valuable work rises. A blocker sorts above its locked row, and a prerequisite inherits the earliest deadline of what waits on it. A task with nothing waiting on it ranks as today. Later, a prerequisite can be met at a level (Decision 11).
- **Phase 15.** Less pressure: Just Start offers two or three choices, a time-box ring, an end-of-sitting strip; neutral words (no "should", warm red only for overruns); a quiet attention-given line on Done; a notice dot on rows pushed 3+ times; a **Waiting** shelf after 5 pushes (`waitingShelfAfter`, 0 = off); step points hidden behind **Points visible**. Also added to earlier phases: a future-self note and **Just 25** sessions (4), your own pace ghost (6), **Show next only** and the "waiting, not forgotten" line (9), spark marks (10).

## Three ways to edit a task stay separate

_Last mapped: 2026-10-21_

**Do not merge the three ways to edit a task.** Item detail → Subtasks, the To do tab's drawer, and the task card each edit the same task on purpose. They have different jobs, so they have different UI and components.

- **Item detail → Subtasks** is the item's whole record, across all time: every field, notes, resources and links.
- **The To do drawer** (the lid in `TodoTable.tsx`) is for quick changes inside the list for this period: verbs, marks, estimate and steps, without leaving the list.
- **The task card** (`TaskCard.tsx`) is for planning this period's work on one task: the full step tree, mass edit, needs and order, points, and this-period figures.

They share store functions (`updateTask`, `lib/todo-steps.ts`, `lib/prereqs.ts`) so they always agree. They do not share UI. A change that merges them, or makes one mirror another, needs allie's yes first. Recorded as Decision 15 in [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md#decisions).

## Public door

Home mounts **`TodoPanel`** from `todo-panel.tsx` (`components/Home/home-dashboard.tsx`).

Other rooms already import these helpers from `todo-utils.ts`:

| Export | Already imported by |
|--------|---------------------|
| `createScheduledTodoTask` | Plan day sidebar (`planned-tasks-sidebar.tsx`), morning review, ingest (`lib/ingest/apply-todos.ts`, `lib/ingest/apply-morning-gm.ts`) |
| `getTierFromTask` | Morning review, `lib/morning-todo-walk.ts`, Analytics `TodoPulseView` |
| `tierToUrgencyImportance` | `lib/morning-todo-walk.ts`, day-review tomorrow |
| `buildTodoItems`, `filterAndSortTodos` | `lib/friend-suggestion.ts`, day-review tomorrow |
| `getTierColor` | Day-review tomorrow |
| `taskCompletedOnDay`, `taskCompletedInWeek`, `taskCompletedInMonth` | Assumed-times review |
| `buildDoneTodoItems` | Tracking activity log |

Outside tests import those same helpers, and Home’s dashboard test mocks `TodoPanel`. They do not add further exports.

This room writes items on **`lib/task-store.ts`** (`addTask`, `updateTask`, `deleteTask`, `updatePriorityWeights`). Done and missed go through `completeTask` and `markMissedOpportunity`. Push goes through `pushTask` in `lib/services/scheduling-service.ts` (not `task-store`), which calls `pushTaskOnePeriod` (`lib/item-utils.ts`). Undone Push uses `pushUndoneFields`, and auto-push uses `autoPushOneStep` (both in `lib/scheduling.ts`). _Last mapped: 2026-10-15._ Confirming an assumed Done time goes through `confirmTaskTimes`. **Log done** also calls `usePointsStore.addPoints`. A day **Prioritized** mark, when that day’s morning review already exists, saves `priorityTaskIds` with `useReviewsStore.saveMorningReview`. Show, pace, and lid prefs stay in `todo-prefs.ts`. The live persist key is `brain2-todo-prefs` (`persistKey("todo-prefs")`). `cogs-todo-prefs` is the legacy alias.

These stay inside the room. Nothing outside this folder imports them: `TodoTable`, `TodoBreakdown` (`TodoLidSection`, `TodoDeleteButton`), `TodoLoadPanel`, `TodoPeriodNav`, `todo-filters`, `DoneTodoSection`, `MissedTodoSection`, `UndoneTodoSection`, `AddTodoDialog`, `AddDoneDialog`, `CompletionTimeLine`, `todo-prefs.ts`, `todo-chrome.css`, and every other export of `todo-utils.ts`.

## Files

Split (orchestrator pattern) so the orchestrator stays small and the tier/Q-I/
build/filter logic is unit-testable.

| File | Purpose |
|------|---------|
| `todo-panel.tsx` | **Orchestrator** (`data-ui-name="To Do"`). Names mode also stamps the inner desks: **To Do fascia**, **Period nameplate** (season nav here; day/week/month on `TodoPeriodNav.tsx`), **Period keys**, **Period sheet**, **Season list**, **Morning priorities**, **Required**, **Assigned**, **Assigned composer**, **WIP warning**, **Priority formula**, **Status bar**, **To Do plate**. Milled fascia — CRT **To Do** + open count, period nameplate, **Open list**, **Add Task**, Day/Week/Month/Season keys, Show / Sort — then the list stage (full width), WIP lace warning, status bar, task detail popup. **Open list** opens Lists on that period's To do list. Under the window, on the page scroll, the title jewel (`orbFor("home-todo")`, the dove) sits centered, at most 40rem wide (`.todo-desk-plate`) so the bottom of the desktop is that picture. Day tab shows **Morning priorities** (3–5 ids from today's morning review). Open rows share **one ledger**: Required (gunmetal/pearl band) then Assigned. Completing a row is Cmd/Ctrl-Z undoable via `completeTask` → `lib/action-history.ts`; the completion popup **Undo** also reopens the row. **Missed opportunity** (`markMissedOpportunity`) is the too-late twin: same undo stack, no points, no completion popup. Period tab change uses a short fold (skipped under `prefers-reduced-motion`). |
| `todo-filters.tsx` | **Show / Sort** strip on fascia row 3 (_Last mapped: 2026-10-20_): LED chips (Available now, All tasks, Hide locked, Show next only), Tier, Status, Sort + direction, Formula. Sun rites, the in-progress cap, default estimate and pace moved to the gear. |
| `TodoSettingsDialog.tsx` | The gear: global To Do settings (title, sun rites, tiers, pace, priority formula). |
| `PriorityFormulaPanel.tsx` | Weights, saved formulas, and the optional math view. |
| `todo-ranges.ts` / `TodoRangeSheet.tsx` | Other view: custom done-before ranges backed by Lists, and the live title. |
| `todo-prefs.ts` | Persisted To Do prefs (live key `brain2-todo-prefs`, legacy alias `cogs-todo-prefs`): `availableNow` (default off), `wipLimit` (default 3), `lidCollapsed` (flags / time / steps, default all open), `ritesFollowSun` (default on), `defaultEstimateMin` (default 30, 0–600, 0 = none; _Last mapped: 2026-10-16_), `hideLocked` and `showNextOnly` (both default off; Phase 9). The default is never written to a task. A row with no estimate and no steps shows it as a dim `~30` in the Time cell; the load strip still counts that row as unestimated, and Open unestimated still finds it. Plan's drop and capacity count it. `paceOverrides` (by `paceKey`, clamped 0.5–4) and `paceGhosts` (default on) feed your pace. |
| `use-todo-time.ts` | `useTodoTime(tasks)`: one hook for spent and pace. `spentOf` (task total, cached until tasks or blocks change), `timeOf` (what the lid shows), `settle` (on a tick, `actualDuration` takes spent when larger), `pace` (overall, overrides applied). Used by `todo-panel.tsx` and `SessionPlanner.tsx` |
| `todo-pace.tsx` | `PaceSettings` in the Pace bay: **Your pace** and each pen with three or more samples, each with an override field (placeholder is your own median, `n/3` while short), and the **Pace ghosts** switch. Writes prefs only |
| `use-rites-sun.ts` | `useRitesSun(enabled)`: today's sunset minutes at the Home weather pin (else home city, else San Diego; 6:00 PM if the sun cannot be computed), and a `now` that re-renders once at sunset and once at midnight |
| `SessionPlanner.tsx` | Session plans (Phase 4): draft, run, parked and review in one popup, the Sessions shelves, the flat **Pick list**, and the fascia **Session**, **Sessions** and **Pick list** keys. Logic is `lib/session-plan.ts`; the blob is `lib/session-plan-store.ts` |
| `SessionDock.tsx` | The planner for ways in outside To Do (focus bar, Plan, header). Loaded by the header Now box when `lib/session-open-store.ts` holds a request |
| `todo-chrome.css` | `.todo95` cool silver fascia (a whisper of grain), wrapping load strip (Casio / comfort needle / scope lamps / POWER lamp / via channel), one cool ledger well, short rounded task cards, padded names, clamshell lids, rounded step cards, Done/Missed/Undone aftermath wells, `.todo-desk-plate`, status bar, `.todo95-dialog` |
| `todo-utils.ts` | **Pure helpers**: `getTierFromTask`, `tierToUrgencyImportance`, `createScheduledTodoTask`, `getScheduleLabel`, `buildTodoItems` (drops done **and** missed), `buildDoneTodoItems` (`countsInDone`: Tasks **or** implied-action logs), `buildMissedTodoItems` (too-late rows by `missedAt`), `buildUndoneTodoItems` (past periods: each missed period on its own, including after a later push), `filterAndSortTodos`, `filterTodosByStatus`, `filterTodosAvailableNow` (`lib/available-tasks` unmet-dep predicate), `toggleTodoActiveLamp` (active ↔ partial; both stay on Open), `countInProgress` / `formatWipWarning`, overdue from `priorityDateOf`, `pinPrioritizedFirst`, plus the `priority` sort path (`computePriorityScore` from `lib/priority.ts`) and `TodoSortMode` (`"tier"` \| `"priority"`). Unit-tested in `todo-utils.test.ts` |
| `TodoTable.tsx` | _Last mapped: 2026-10-21._ Table-head legend for **Pushes** (what a push is + which period the tube counts). Closed rows: padded name, nixie tier **menu** (A+…D, not a cycle) in a fixed-width column, active lamp (toggles active ↔ partial), completion percent (`todoCompletionPercent`, 0 when nothing is finished), step chip, and two keys: **Card** (pop-out icon, "Open task card") and the CD transport ▶ (`DvdTransportKey`). The push count is the dark square tube. Click / Enter opens one clamshell lid. The header name is the only edit field. The lid's **Actions** line (`Drawer actions` toolbar) holds Done (primary), Done at B/G, Start, Just 25, Push, Missed, then Needs…, View, Delete. **Flags** (Required / Prioritized as willpower gems from `public/gems-removebackground/`), **Time**, and **Steps** each fold; the choice persists in `lidCollapsed`. Keyboard: arrows, D/M/P/R, Enter, Esc (ignored while focus is in an input or select), so Done stays one key away on a closed row. |
| `TodoBreakdown.tsx` | _Last mapped: 2026-10-16_ Inside the open lid (`data-ui-name="Steps"`): **Time** is one segmented control (+15, −5, 5, 15, 30, 60) with the minutes field beside it; **counts** and **0/n · n%** sit on their own readout row. **Steps** is the shared `StepTree` (`components/steps/`) with the lid's columns (`LidStepColumns`: Needs…, ▶, minutes, spent, counts, progress, delete). Hide locked and Show next only come from `todo-prefs`; each move calls `rememberWorld` first (one undo). Optional "Ask the glass" first-step prompt under **Add the first step** (no network). `TodoLidSection` is the shared fold. |
| `TodoLoadPanel.tsx` | Period load strip (`data-ui-name="Period load"`): Casio LCDs (days left on week / month / season only, working hours, **Est hours of work remaining**), Hofstadter comfort needle, scope latch lamps, in-progress POWER lamp, Habits `PercentLedBar` for estimate vs working hours. Unestimated count scrolls the first bare task open. |
| `TaskPrereqDialog.tsx` | **Needs…** for a whole task (`data-ui-name="Needs"`): `EventPrereqPicker` over open tasks, writing `Task.dependencies`, with loops refused through `addTaskPrereq` / `findCyclePath` |
| `AddTodoDialog.tsx` | "Add Task" dialog (`data-ui-name="Add Task"`; description, tier) — kept; Assigned also has a foot composer that uses the same `createScheduledTodoTask` factory |
| `DoneTodoSection.tsx` | Collapsible Done list (`data-ui-name="Done"`) for the focused period (Tek green well); header pairs with Missed (same height) and carries a milled **Log done** key plus the assumed-time chip |
| `MissedTodoSection.tsx` | Collapsible Missed opportunities list (`data-ui-name="Missed"`, Sony-editor red well) for the focused period |
| `UndoneTodoSection.tsx` | Collapsible **Undone** list (`data-ui-name="Undone"`) on a past day / week / month: cool lace well, push plasma tube, Assimilate / Push / Discard |
| `AddDoneDialog.tsx` | "Log done" (`data-ui-name="Log done"`) — retroactive capture of unplanned work |
| `CompletionTimeLine.tsx` | The per-row time line: clock window, duration, the **est.** chip that confirms or corrects an assumed time in place, a quiet **Est.** when the person marked `timeRough` (including an estimated finish, which also wears `~` on the clock), and a read-only **usually ~N** glance from peer `actualDuration` / `timeLogs` (`usualDurationMinutes`; does not rewrite `estimatedDuration`) |

## Instrument layout

_Last mapped: 2026-10-21_

Redesign 2026-10-21: the header is a held machine, a screen above and a key field below. Mockup: `docs/mockups/todo-redesign.html` (published at https://claude.ai/artifact/AhZ7M3tfBx1ahrGzTG4xH6). Styles are the "Redesign 2026-10-21" blocks at the end of `todo-chrome.css`.

- **Screen** (`is-screen`): one dark CRT glass (`.todo-screen`) with a faint green dot-matrix and a green hairline. Left: the live title from `todoTitle()` and the open count as an LED digit. Right, in the same glass: the one-line load readout (`working hours left · estimate · fits`), a needle, a violet lamp when in progress passes the cap, and ▾. The ▾ toggles `loadOpen` in `todo-prefs.ts` (default closed) and shows the load instrument (`TodoLoadPanel.tsx`) at the top of the sheet. Outside the glass: the settings key, which is the globe photo `public/todo/settings-globe.jpg` with no key face (`TodoSettingsDialog.tsx`).
- **Key field** (`is-keys`): the period nameplate (‹ date › Today), or the range picker on Other. The span keys: Day, Week, Month, Season and Other as Tek time-base keys under a SPAN legend, each with a lamp and the span it covers (`spanSubLabel` in `todo-panel.tsx`). Then **+ Add task ▾** (the one primary key), Session · Sessions, **Show** (lamp and a count of active filters) and the sort key (`TodoSortKeys` in `todo-filters.tsx`). Show and sort hide on Season and Other.
- **Show tray** (`.todo-fascia-tray`): `TodoFilters` (Available now, All tasks, Tier, Hide locked, Show next only, Status, Formula) and **Open list**. Open or closed is `showTrayOpen` in `todo-prefs.ts`. The tray stays in the DOM while closed (`hidden`).
- **Add task** (`AddTodoDialog.tsx`): the name and tier as before, plus **From lists**, a search over open tasks that are not on this period (Next Actions items included). Picking one schedules that task here (`pickExistingTask`, `scheduleTaskForPeriod`). **Pick list…** opens the Session planner's flat list, which used to be its own fascia key.
- **Keycaps.** Word keys use the house keycap (`.todo-cap`, `--todo-cap-*` tokens): pale silver word caps, darker grey modifier caps, a navy legend and lamp on the primary keys. See [`docs/DESIGN_STYLE.md` → Keycaps](../../../docs/DESIGN_STYLE.md#keycaps).
- **Phone** (under 720px): the header stacks (screen and globe, nameplate, five equal span keys, three action keys, Show and sort), every key at least 44px. Rows take two lines (name with Card and ▶, then tier · state · time · steps · pushes). The drawer's verbs sit in a grid of three. The load wells stack. The Show tray is a bottom sheet. See [`docs/DESIGN_STYLE.md` → Phone layout](../../../docs/DESIGN_STYLE.md#phone-layout).

### Load instrument

_Last mapped: 2026-10-21_

`TodoLoadPanel.tsx`, opened from the ▾ in the header glass. One milled bezel, three wells:

- **Time:** an engraved scale. On Day it runs 8 to 23 with past hours hatched, a violet now tick, hours left in green and the estimate in blue; a warm red tail marks an estimate that runs past the day. On longer lenses it counts working days left. Under it an LCD row: working hours left, estimate (and task count), and time already spent on these open tasks. Days left shows on week, month and season. The unestimated count still opens the first bare task.
- **Comfort:** a black CRT dial in a chrome bezel with a silver shoulder. Pixel LED segments light up to the ratio (green to 1.0, ice blue to 10, violet past it), a pearl marks it, and the ratio sits in the middle (`comfortDialT`). Beside it, a `fits · Xh spare` or `needs Xh more` LCD and the band legend.
- **Scope:** three pearl toggles for what counts toward load, pixel pips for in progress against the cap (violet past it), and Required / Assigned hours in two small LCDs.

### Empty bands

_Last mapped: 2026-10-21_

A band with nothing in it is not drawn: Required (day, week, month and season), Done, Missed and Undone. Required appears the moment a row's Required gem is lit. **Log done** also sits on the Assigned composer, so it stays reachable while Done is hidden.

### Global settings (the gear)

_Last mapped: 2026-10-20_

`TodoSettingsDialog.tsx` holds what applies to every view. All of it writes `todo-prefs.ts`.

- **Title**: the title word (`titleBase`, default "To do") and an optional full title per view (`titleByView`).
- **Sun rites** (`ritesFollowSun`). This left the strip.
- **Pace**: in-progress cap, default estimate, your pace and pace ghosts (`todo-pace.tsx`).
- **Tiers** (`bgeTiers`, default off): "Enable B/G/E tier sorting". See [B/G/E tiers](#bge-tiers).
- **Priority formula**: the same `PriorityFormulaPanel` the strip's Formula key opens, and "Show the math by default" (`showMath`).

### B/G/E tiers

_Last mapped: 2026-10-22_

Off by default (`bgeTiers` in `todo-prefs.ts`, switched in the gear → Tiers). Not the same as the A+…D nixie (urgency × importance) or the step tiers inside a task (`Subtask.tier`).

- **Per list.** A task's tier lives on its mark for that list: `TodoPeriodMark.tier` (`min` / `goal` / `exceptional`, `lib/types.ts`), next to Required and Prioritized. The same task can be Bare minimum on the week and Goal on one day. No mark, or a mark with no tier, reads **Goal** (`todoMarkTier`, `lib/todo-commitment.ts`). A push carries the tier with the other marks (`carryTodoMarksPatch`).
- **Meaning.** Bare minimum is what you assign yourself as the least that day (or week, or month) must hold. Goal is what you aim for. Exceptional is above and beyond.
- **Sections.** With the mode on, the Assigned band holds three sub-bands (Bare minimum, Goal, Exceptional) in place of one table (`splitByTier`). The separate Required band is not drawn in this mode; those rows sit in their tier and keep the Required gem. Order inside a tier is the usual sort, Prioritized first. Move a row with the **B · G · E** keys on the lid's Flags line (`bgeTierOf` / `onBgeTierChange` on `TodoTable`). Derived rite rows have no task and always sit in Goal.
- **Score** (`lib/bge-score.ts`, strip above the ledger, `data-ui-name="B/G/E score"`). Bare minimum is worth 70, Goal 30. Each is the share of that tier finished. Every finished Exceptional adds one Goal task's worth (30 ÷ Goal count) on top, so the score can pass 100: 5 Goal tasks, 2 done, 2 Exceptional done = 12 + 12 = 24 of the 30. A tier with nothing in it counts as met. With no Goal tasks, Exceptional adds nothing (no rate to pay it at). It counts every real task on the list: open, done and missed. Plain done / total sits beside it; the other completion figures are unchanged.
- **Planned:** a Sort mode and a tier key on the closed row; the same score on the Home day lamp (`home-day-lamp.tsx`) and Analytics; Season lens sections.

### Other: custom ranges

_Last mapped: 2026-10-20_

The Other view lists work due before a named day, like "before Elijah gets back". Code: `todo-ranges.ts` and `TodoRangeSheet.tsx`.

- Each range is a real List in Lists, in the folder "To do ranges" (`todo-ranges`, under Next Actions). List ids start `todo-range-`. The name lives on the List, so a rename in Lists shows here.
- `todo-prefs.ranges` keeps `{ id, end, start? }`. `end` is the done-before day. `activeRangeId` is the loaded range. A range whose List is gone is skipped.
- Membership is `task.lists`. A task added on either side shows on both.
- A task on the list with no deadline gets the end day as `deadline` (`syncRangeDeadlines`, run by the sheet). Moving the end moves deadlines that still match the old end. An earlier deadline is kept and shown as "by …".
- Range settings: name, start, done before, delete. Delete removes the List; tasks and deadlines stay.

### Priority formula and the math

_Last mapped: 2026-10-20_

`PriorityFormulaPanel.tsx`. The weights stay in the task store (`priorityWeights`), which the sort reads.

- **Saved formulas** (`todo-prefs.formulas`): name and save the current weights, click a chip to switch, × to delete. "Default" is always there. Saving an existing name overwrites it.
- Each weight has a slider and a number, plus its share of Σw.
- **The math** (optional, off by default): the score typeset as S(t) = Σ wⱼφⱼ(t) with live weights, and each φ defined. Also the weight simplex (ŵⱼ = wⱼ/Σw), the top tasks as stacks of wⱼφⱼ, the spread of each φ over open tasks, the unlock curve 1 − 1/(1+k) with your tasks on it, and Spearman ρ against the default order. All plain SVG.

**Design intent.** Write this tab for someone with a mathematician's eye. Show the real math and draw it: formulas typeset, quantities plotted, data dense, in the spirit of 3Blue1Brown. Keep it optional. It opens from global settings or from the list's own Formula key, and never crowds the daily view. Use graph-paper ground and diagram grammar, not decoration (`docs/DESIGN_STYLE.md`). **Planned**: the same treatment for the load panel (comfort ratio, hours left) and pace (the ratio distribution behind ×1.0).

The page scrolls. Fascia, load strip, ledger, Done/Missed/Undone, and the dove desk plate are one document under the fixed app shell — there is no sticky `100dvh` trap and no right-hand dove well. The ledger is a cool silver well (`#c8ccd0`). Each task is a short rounded card (`#e6e8eb`, 8px) with a small gap; the open card lightens to `#eef0f3`. Task names sit inset from the row start. Accents are ice, violet, and rose — tier nixie, in-progress lamp, over-cap lamp, missed verb — on the same cool metal. The load strip wraps equal-height cells when the full-word lamps will not fit one line (scope faces read **All assigned** / **Required** / **Required + prioritized**). The day lens omits **Days left**; week, month, and season keep it. Clock hours stay in the working-hours tooltip. Closed rows pad the task name and keep the verb keys **Done / Start / Just 25 / Push / Delete** (_Last mapped: 2026-10-16_, Just 25 from slice H2). The open lid has one name (the header field), then Flags / Time / Steps, each collapsible. One clamshell lid open at a time (season too). The dove (`.todo-desk-plate`) is centered under the list and capped at 40rem wide (2026-10-21; it was near window width). Still `object-fit: contain`, still on the page scroll.

## Sessions: park, resume, shelves

_Last mapped: 2026-10-16._ Slice H of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md) (Phase 4, Keep, park and resume). Built, not committed.

- **Store.** `lib/session-plan-store.ts` holds `open` (every draft and parked session, plus at most one running or in review), `focusId` (the one the popup shows), `history` (closed, append-only) and `kept`. `put` goes through `admitSession`, so a session going live parks the one that was. `focus` drops an empty draft it leaves behind. Persist `version: 2`; `migrateSessionBlob` moves a v0 or v1 `current` into `open` and renames `excellent` → `exceptional`. Backups carry the same key. `lib/vault-guard.js` counts `open` and `history` (slice H2); only `history` must keep growing on the hub (`logArrays`).
- **End of sitting.** _Last mapped: 2026-10-16._ **End** in the run view first pauses the session and shows `SittingEnd` (`components/Focus/`): "Sat 52m. Left it here:" with the next leaf of the current line's task. Keep saves it as that step's `context`; Keep or Skip then ends into the review (Phase 15 A).
- **Park.** The run view has **Park** next to +15. Closing the popup (× or Esc) while a session runs shows a strip: **Park** or **Keep running**. Parking stops the clock and remembers `activeLineId`; a painting session also stops the Tracking pen clock (`stopTaskClock`, time so far written as on Stop). This is `putSession` in `SessionPlanner.tsx`, which also covers sessions parked to make room.
- **Parked view.** Time left, the line it was on, and the lines as they are now. A line whose task or step was deleted reads **Deleted task**, struck through, with **Remove**. **Resume** restarts the clock where it stopped; the time away is not counted. Parked over a day (`parkedLong`) asks **Resume as was** or **Fresh clock, same lines**. If the remembered line got done meanwhile, the next open line is current.
- **Shelves.** **Sessions** in the popup caption, or the fascia **Sessions** key (`startOn="shelves"`), opens three shelves, newest first and searchable by title, note or line: **Drafts** (Open, Delete), **Parked** (Open; the running one shows here too), **Done** (Open read-only with its review, **Run again**). Run again is a new draft with the same lines and tiers (`runAgain`).
- **Fascia key.** The **Session** key carries the running clock, and a dim `⏸n` when sessions are parked.
- **Analytics.** The fit gauge reads your own pace (`useTodoTime` → `paceFor`, `lib/estimate-pace.ts`): finished steps plus closed lines from `history`, or your override. Drafts and parked sessions never skew it. The note reads "You usually run ×N your estimates". Finishing a line or step in a session settles spent like the ledger does.
- **Park in the focus bar** and **Save as template**: built in slice H2, below.

## Sessions: ways in, templates, timebox (slice H2)

_Last mapped: 2026-10-16._ Slice H2 of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md) (Phase 4, "Not built yet" and "Additions"). Built, not committed.

- **Ways in.** Outside To Do, a way in sets a request on `lib/session-open-store.ts` (tiny, not persisted). `SessionDock.tsx` reads it and shows the planner over today's open tasks. The header Now box (`components/header-now-box.tsx`) hosts the dock and loads it only once a request is set. The ways in:
  - **Focus bar:** **Session** and **Just 25** on the task on the clock, or **Park session** while one runs.
  - **Plan day view:** a free block made by dragging across empty time offers **Session in this time**. The block is removed, and a draft of that length (and title, if typed) opens. The session writes its own block when saved.
  - **Header Now box:** a **Session** chip while one runs or is in review, **Sessions ⏸n** when some are parked.
  - The task card has **Session with this** and **Session with these** (Phase 12). Each open row also has **Just 25** after **Start** (`TodoTable.tsx`), as do the flat list and the focus bar.
- **Flat list.** The fascia **Pick list** key (`PickListKey`, `startOn="list"`), or **Pick list** in the popup caption, shows every open lowest-level step and step-less task in one flat list, with minutes and `waits`. Nothing is made until **Session** (new draft, line in Bare minimum) or **Just 25** is pressed.
- **Break down in place.** Clicking a tier line's name (or ✎) opens that task's steps editor in the draft.
- **Fit gauge.** Each tier's gauge has a thin Hofstadter mark at minutes × 2 ÷ time (`TierFit.padded`, `HOFSTADTER_PADDING` from `lib/todo-commitment.ts`), with a line "With Hofstadter ×2: N% of the time". The bar and band use the pace from **Padded for you** (1 when off). Break minutes are set aside before the ratio.
- **Breaks.** **Breaks** in the draft: none, or 5m every 25 / 50 / 90 minutes (`breakEvery`, `breakMin`). None falls at the very end. In the run, a strip says **Break · 5m**: **Take it** lets go of the current line while the clock keeps going (**Back to work** picks the next line), **Skip** counts it (`settleBreak`, `breaksTaken`).
- **Templates.** **Template** in the draft starts from a built-in (`BUILT_IN_TEMPLATES`: Just 25, Morning 90m, Evening 3h) or a saved one. **Save as template** keeps the length, shape, breaks and lines as pointers (`templateFromSession`). A saved title replaces one with the same name. Lines whose task is gone or done are dropped on use (`sessionFromTemplate`). Saved ones are `templates` in the store; old blobs load with none.
- **Just 25 (FN-3).** `shape: "timebox"` (absent means `"lines"`). The draft has a **Timebox** check and lengths 10 / 25 / 50. Start needs only a length. Bare minimum is reached when the clock runs out with you on it, whatever got done (`tierReached(plan, tasks, now)`); ending early reaches none. Seed lines go in Goal; every Bare-minimum and Goal line done reaches Goal, then Exceptional.
- **Note to tomorrow-you (FN-1).** Park (the run's Park key, the close strip, the focus bar) and the review ask for one optional line, stored as `futureNote: { text, at }`. It is shown first in the parked view, in a draft, and in a done session. **Run again** carries it with its date ("From Fri, Oct 16: …"). A blank line clears it.
- **Floor (FN-4).** A draft with no Bare-minimum lines shows "Smallest step that counts: *…*" in the empty well, with **Add**. It is Just Start's pick (`pickStartStep`) across the draft's tasks, or the lens when the draft is empty, smallest first (`floorSuggestion`). Locked steps and waiting tasks are never offered. Nothing is added unasked. `rankStartSteps` does not exist yet.
- **Padded for you (FN-2).** A **Padded for you** check under the gauges, remembered as the To Do pref `sessionPadded` (default on). On, the pace is `sessionPaceFactor` (`lib/estimate-pace.ts`: each line at its own task's pen or list pace, weighted by minutes) and the check reads `paddedLabel` ("padded for you ×1.6"). Off, the pace is 1 and it reads "raw estimates".

## Data

All tasks come from **`lib/task-store.ts`**. The panel derives display rows from scheduling fields:

| Tab | Filter |
|-----|--------|
| Day | `taskScheduledOnDay` on Home’s selected day, plus that day's rites (`lib/ritual-todo.ts`) |
| Week | `taskScheduledInWeek` for the local week, or the week that contains the selected day until that nameplate is used |
| Month | `taskScheduledInMonth` for the local month, or the month that contains the selected day until that nameplate is used |
| Season | Open tasks (active or partial) whose day, week, or month falls in the quarter (`taskTouchesQuarter`). Missed, cancelled, deferred, and done stay off the list and out of the season estimate. |

## Rituals on this day

The day lens lists each calendar-anchored rite on the day it belongs to. The rows are derived (`lib/ritual-todo.ts`). They are not stored tasks, so they stay off the week, month, and season lenses, off **Open list**, and off Push, Delete, and Missed. **Open** (or the name) opens the same walk as Header → Rituals (`RitualWalkDialog`). Submitting the rite moves the row to **Done** for that day. A draft stays on the open list.

They sit at the top of **Assigned**, after any prioritized tasks, in this order: Morning, Night, then the period anchors, then Star Lord. The week is Monday–Sunday, the same week `getWeekString` already uses.

| Rite | Day |
|------|-----|
| Morning ritual | Every calendar day |
| Night ritual | Every calendar day |
| Start of week ritual | Monday |
| End of week ritual | Sunday |
| Start of month ritual | The 1st |
| End of month ritual | The last civil day (28, 29, 30, or 31) |
| Start of season ritual | 1 Jan, 1 Apr, 1 Jul, 1 Oct |
| End of season ritual | 31 Mar, 30 Jun, 30 Sep, 31 Dec |
| Start of year ritual | 1 January |
| End of year ritual | 31 December |
| Star Lord ritual · New moon | The local day that contains the new moon |
| Star Lord ritual · Full moon | The local day that contains the full moon (the mid-month rite; not the civil 15th) |
| Star Lord ritual · Birthday | The birthday in Settings. A Feb 29 birthday falls on 1 March in a common year |

### Rites follow the sun

_Last mapped: 2026-10-16._ With **Rites follow the sun** on (Show bay, day lens; default on), today's open list hides **Night ritual** until sunset and an unstarted **Morning ritual** from sunset on. A started (`partial`) or done rite is never hidden, nor is any rite on another day. The rule is `ritualHiddenAt` in `lib/ritual-todo.ts`; `ritualBoardFollowingSun` drops those rows from the open list only, so Done, lookups and walks keep the whole board (`openRitualBoard` in `todo-panel.tsx` ~250). Header → Rituals and the Rituals menu never hide a rite. Off restores the old list exactly. Tests: `lib/ritual-todo-sun.test.ts`.

A day can carry more than one. 1 January is morning, night, start of month, start of season, and start of year. A birthday on a moon day is two Star Lord rows. There is no separate weekday schedule beyond Monday and Sunday, and no civil mid-month rite.

The Rituals menu is a different list. It keeps the current period's start available all period, the just-ended review after the period closes, and one extra day for yesterday's night and an undone Star Lord report. To Do does not repeat a rite on those later days.

## Inbox over 100

When the revisit Inbox holds more than 100 open ideas (Monkey brain does not count), the app adds one To Do for today named **process inbox information** (`lib/inbox-process-todo.ts`, mounted from `app/page.tsx` after the day rollover). Auto-push is on, so an unfinished copy moves to the next day instead of rolling up to the week. One open copy is enough, including a renamed system row or a task you already named that. Marking it done keeps the next copy off until the next local day, and only if the pile is still over 100. Deleting it, or marking it missed, puts a copy back on today while the pile is still over 100. At 100 or fewer, a copy already on the list stays.

## Required, prioritized, assigned

Every open row on a period is **assigned** — that is the schedule. Two extra marks live on `Task.todoMarks` (`lib/todo-commitment.ts`), one period at a time:

| Mark | List |
|------|------|
| Required | First band of the shared ledger (same gunmetal/pearl metal as Assigned — hairline only). Absolutely must be done. |
| Prioritized | Stays on **Assigned**, with the Prioritized jewel lit (same jewel morning-review priorities use). Always pinned to the top of Assigned, ahead of the selected sort. |
| Neither | **Assigned**, unmarked metal. |

A row can be both. Marks are per period: required this week is not required today. Day priorities from the morning ritual (`priorityTaskIds`) also read as prioritized for that day. Set the marks from the lid jewels (**Required** / **Prioritized**), keyboard **R**, item detail **Required and prioritized** (Scheduling), the morning ritual, or the start ritual. Done and Missed stay the lists they already were.

**Marks follow a push** (2026-10-15). Every same-grain push copies the leaving period's Required / Prioritized onto the destination period, merged with any mark already there. The old mark stays as history. The helper is `carryTodoMarksPatch` (`lib/todo-commitment.ts`), called from:
- `pushTaskOnePeriod` (manual Push, and review push);
- `pushUndoneFields` (Undone Push, Scheduler card, ritual push);
- `autoPushOneStep` (auto-push, hop by hop);
- `pushYearUndoneFields`.

A morning-ritual priority (`priorityTaskIds`) pushed off its day becomes a real Prioritized mark on the new day. Roll-up to a coarser grain (day → week) does not carry. Tests: `lib/todo-marks-carry.test.ts`.

## Period load

Under the period title, a strip (`TodoLoadPanel`) shows equal-height cells:

| Cell | Meaning |
|------|---------|
| Days left | Hidden on the **day** lens. On week, month, and season: calendar days from today through the end of the period, including today. Week and month read `2 days left in week`. A season reads `N days left in season`. |
| Working hours left | Future days × 10 hours, plus hours left today before 11pm. Clock hours (24h days) sit as a Casio sub-read and in the comfort tooltip — comfort still uses working hours. |
| Est hours of work remaining | Sum of the minutes that count on each open row, filtered by scope latch lamps (**All assigned** / **Required** / **Required + prioritized**). Via-channel shows estimate hours against working hours. Tasks with no estimate are named; the count opens those lids. |
| Comfort | Analog needle: estimated hours × 2 (Hofstadter) ÷ **working** hours. Under 1 is green **manageable**. From 1 through 10 is violet **overfilled**. Above 10 is red **behind**. Hub shows the ratio in CRT green `#7dffc4`. |
| Scope | Latching lamps that re-aim the same estimate data (not pastel pills). |
| In progress | Tek POWER lamp dim under the soft cap, rose when over. Sentence stays `N in progress (cap M)`. |

**Assigned** has a Casio search on the ~24px title bar. It matches the task name and any step name, including steps inside steps. Required stays listed in full.

## Steps

_Last mapped: 2026-10-16._ Steps live in the open lid's **Steps** fold (default open), drawn by the shared `StepTree` (`components/steps/README.md`). One row per step: fold chevron and count, tick, dot, name, then Needs…, ▶ (every open step), minutes, spent, counts and delete. Hairline guides show depth. No blank line waits: an empty tree shows **Add the first step**, each open branch ends in one quiet **+ step**, and each row has a hover **+** for a child. In the composer, Enter commits and goes a level deeper, empty Enter steps out, Shift+Enter stays, and a multi-line paste makes several steps. Folds are remembered per step.

Move steps like files: click selects (click again to rename), Shift-click a range, Cmd/Ctrl-click toggles. Drag the dot to move the selection: a row's edge drops before or after it, its middle nests. With focus on a step row, Alt+↑/↓ reorders, Tab nests, Shift+Tab lifts, ↑/↓ move focus. Keys pressed in the tree stay there, so D / M / P / R act only once focus leaves it. **Esc** clears a step selection first, and the next Esc closes the lid. A move is one undo.

**Time** is one segmented control: +15, −5, and 5/15/30/60 write the typed estimate; the minutes field sits beside that control. **counts Nm** and the step readout (`0/2` and the weighted bar, or the level gauge) sit beside it. The nested sum still wins when heavier. Checking a step does not check its parent. `hiddenFromTodo` is unchanged for tasks already hidden; the row no longer offers Hide.

**Hide locked** (Show bay, default off) hides steps waiting on an open prerequisite (with inherited waits) and, on the ledger, rows with unmet `dependencies` (the rows Available now hides). Only prerequisites lock (`lib/prereqs.ts`); an unfinished step or task is never hidden. **Show next only** (Show bay, default off) shows a branch's next step and a dim **+ N more**; one click opens it. Whenever Hide locked, Show next only or the sun rule hides anything, one calm line closes the lid or the Assigned list: "Everything else is waiting, not forgotten. · 3 hidden". The count peeks at them without turning the switch off (`peekHidden` in `todo-panel.tsx`). The Tier filter's hidden steps join the lid's count.

### Step tiers and weighted progress

_Last mapped: 2026-10-16._ Phase 10 (slice N) of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md#phase-10-tiers-inside-a-task-and-weighted-progress).
- Each lid step has a `B · G · E` tag (click cycles B → G → E → inherit) and a spark mark (`StepTierMarks`, `components/steps/`). No tier inherits; a top-level step with none is Goal.
- **Step tier** in the Show bay (`todo-filters.tsx` `TierKeys`; All / B / G / E; `todo-prefs` `tierView`, default All) filters every lid to that level's view, containers greyed. The readout then says "counts 45m for Goal" (`tierMinutes`).
- The percent is weighted everywhere (`todoCompletionPercent` → `lib/step-progress.ts`); counts stay counts. On a task with step tiers the closed row's Done cell and the lid readout show the level gauge (`LevelGauge`); without tiers the row keeps its LED bar and the lid one weighted bar.
- **Done at a level.** _Last mapped: 2026-10-16._ The row shows **Done at B** / **Done at G** beside **Done** once that level is reached and it is not the top level (`TodoTable.tsx`). It calls `completeTask(id, { level })`. Plain Done on a tiered task stamps the top non-empty level (`updateTask` in `lib/task-store.ts`); reopening clears `Task.tierReached`. With no list Points rule (and no override), the level pays the house tier amount (`resolveCompletionPoints`). Done rows show the level as lit `B G E`; unreached levels read `—` (`DoneTodoSection.tsx`). Tests: `lib/done-at-level.test.ts`, `todo-panel.test.tsx`.

**Flags**, **Time**, and **Steps** each collapse. The choice is shared across rows and stored in `lidCollapsed` (`todo-prefs`). Default is all open. The header already shows the name, and when the lid is open that header is the edit field — the body does not repeat it.

**Undone** appears only when the focused day, week, or month is already over. Today, this week, and this month stay the open To Do list. A task can be Undone for any number of periods at once, and those periods do not cancel each other. Miss Monday, push it to Tuesday, miss Tuesday: Monday's Undone list and Tuesday's Undone list both still contain it. Finishing it on Wednesday puts it on Done for Wednesday and leaves Monday and Tuesday as Undone (`Finished later`, no action keys). Finishing it on the same day it was scheduled puts it on Done for that day, not Undone.

**Scheduled** here means the To Do period fields: `scheduledDate`, `scheduledWeek`, `scheduledMonth`, `scheduledYear`. That is the open list for that day, week, or month. A trip itinerary with dates is scheduled in that same sense and has nothing to do with the Scheduler tab. The **Scheduler** is the funnel that sorts to-do lists into periods, and it only includes an item when **Send to Scheduler** (`scheduleable`) is on. Undone and Auto-push do not turn that on.

Each open row says where the task lives now (`Now on this week`, a later date, or `Unscheduled`).

| Action | Effect |
|--------|--------|
| Assimilate | If it is still sitting on this past period, roll it onto the coarser To Do list (day → that week → that month → that year). The period stays Undone. |
| Push | Schedule it on the next day / week / month that is still open (a stale next step lands on today / this week / this month) and increment that period's push count once. The period you pushed from stays Undone. |
| Discard | Cancel it (`status: "cancelled"`) and clear the live schedule. That placement is `resolved: "discarded"` and leaves Undone. Other periods' history stays. |

A push from anywhere else records the period being left the same way, so it shows up here:

| Push | What it writes |
|------|----------------|
| Open-list **Push** | `pushTaskOnePeriod` — next day, week, or month from the live period, plus that period on `schedulePlacements`. An optional why can sit on that placement as `missReason`. Skip still pushes |
| Undone **Push** | Next period of that grain that is still open. Same optional why. Assimilate and Discard do not ask |
| Review carry-over / review **Push** | `pushFieldsForReviewPeriod` (day / week / month go through `pushTaskOnePeriod`) |
| Message ingest ritual push | `pushTaskOnePeriod` |
| **Auto-push** | When the period ends, if item detail **Auto-push** is on (default off). Same grain: week 1 unfinished becomes Undone for week 1 and scheduled (`scheduledWeek`) for week 2. Each missed day or week on the way is recorded, and the push counter increments. Off: the unfinished period rolls to the coarser list instead, still Undone for the period that ended, and the push counter does not increment. |

Missed, cancelled, hidden, and discarded placements stay out of Undone. The status bar adds `N undone` on a past period. Those rows are not repeated in that period's open table.

**Add Task** creates a real task via `createScheduledTodoTask()` + `addTask()`. The id is `todo-<time>-<counter>` so several lines in one turn each land. It is scheduled to the active tab at the currently-focused date: day → `scheduledDate` (the focused day), week → `scheduledWeek`, month → `scheduledMonth` (local `YYYY-MM` via `getMonthKey`, the same key the month filter uses). Week/month tasks are assigned to that period's list only — no specific day is pinned. The chosen **tier** maps to `urgency`/`importance` via `tierToUrgencyImportance`. Plan's day sidebar uses the same factory, so items added there show up here unchanged. The Assigned foot composer writes the same path; matching an existing name offers that row instead of a duplicate.

The header **today's friend** does **not** only read this day's To Do slice. Species that lean To Do (puppy, foal, kitten, …) prefer it; others still can pick it when that pool is what is open. Hedgehogs lean daily habits; crows lean the whole **Next Actions** folder tree (`lib/friend-suggestion.ts`). Completed **and missed-opportunity** rows stay out. Click the friend again for a different suggestion; Escape, the bubble ×, or a click outside closes it. Plan: [`docs/FRIEND_COMPANION.md`](../../../docs/FRIEND_COMPANION.md).

**Done** (`buildDoneTodoItems`) lists completions that `countsInDone`: Tasks **or** implied-action / habit logs (`type: "action"` / `loggedAction`). Increasing a Book’s pages read can appear here without the book itself being a daily Task. Completing a daily (or weekly/monthly) habit in the Habits grid writes the same kind of Done row (`lib/habit-done-log.ts`) for that calendar day, so it shows under Done today / this week / this month. Stopping **Working on this now** on an Operation writes `worked on {name}` the same way (`lib/operation-work-session.ts`), with the observed clock window from the live session.

**Painting the Tracking grid can write Done rows too.** A pen carrying a **default action format** turns each painted block into a row here — paint 1:00–1:15 of *Walking* and "Went for a walk" appears under Done today, named from the pen's template and filled in from the block (duration, clock, location, project). The rows are ordinary completed logged actions with deterministic ids (`pen-action-<entry or span id>`), so `lib/pen-action-sync.ts` upserts rather than duplicates them: retime or delete the block and the row follows. **Renaming the row here is permanent** — the sync only rewrites a title it still recognises as its own, so an edited name survives every later change to the block. See [`docs/PEN_ACTION_FORMATS.md`](../../../docs/PEN_ACTION_FORMATS.md). A Tracking pen with a **default action format** logs a painted block the same way (`lib/pen-action-sync.ts`) — "Went for a walk" from a Walking block — and `todo-panel` mounts `usePenActionSync` so Done today stays in step even if Tracking is not open.

## Time spent and your pace

_Last mapped: 2026-10-16._ Phase 6 slice L of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md).

- **Row Time cell.** `spent/counts`, e.g. `25/60m` or `1h40/~30`. Spent is `trackedMinutesForItem` (pen blocks, ▶ blocks, `timeLogs`, each minute once). Spent past the count turns rust. A row with nothing spent reads as before.
- **Lid Time readout.** Beside **counts**: `3h 10m · est 120 · parts 145 · pen ● CD` (`timeTrio` in `TodoBreakdown.tsx`; the pen is the first `penLinks` pen). Only shows once something is spent or a pen is linked.
- **Steps.** An open step with time on it shows `52m spent`; a finished one shows `52m · est 30 · parts 45` (`stepSpentMap`, subtree included).
- **On finish.** Ticking a step in the lid or a session runs `settleSpentOnFinish`: `actualDuration` takes spent when spent is larger. Just Start and the pen clock still pass their own minutes.
- **Your pace.** `lib/estimate-pace.ts`. Median actual ÷ estimate from finished steps and closed session lines, overall or per pen; under three samples reads ×1. Overrides live in the Pace bay.
- **Ghost.** While you type an estimate, and on an open step or task whose spent has passed its estimate, a dim italic "usually ×2.4 for you" sits beside the field when the pace is 1.2 or more. It never writes the estimate. **Pace ghosts** off hides it.
- **Item detail → Time.** Items with steps show `2h · est 120 · parts 145` under the total (`ItemTrackedTime`, `ItemPenTime.tsx`).
- **Shared helpers.** _Last mapped: 2026-10-16._ `timeTrio` and `partsMinutes` live in `lib/tracked-time.ts`; `TodoBreakdown.tsx` imports them (its local copies are gone). Spent per step is `stepSpentMap`, the ghost is `paceGhostLabel(paceForTask(...))` behind the `paceGhosts` pref, and ticks settle through `settleSpentOnFinish` (all via `use-todo-time.ts`).
- **Padded for you (built in lib, not wired).** Pref `sessionPadded` (default on) in `todo-prefs.ts`. `sessionPaceFactor(plan, tasks, samples, overrides)` in `lib/estimate-pace.ts` weights each line's minutes by its own task's pace; `paddedLabel` gives "padded for you ×1.6". `SessionPlanner.tsx` still passes the overall `todoTime.pace` and has no toggle yet.
- **Planned:** a default estimate per tier (one `defaultEstimateMin` today); the task card header (Phase 12); spent and the ghost on every step of `StepTree` (Phase 9).

## Done rows carry a real time, and say when it was assumed

A Done row is a record of work, so it holds **when the work happened and how long it
took** — `7:50 – 8:30 PM · 40m`, not a bare date. Most of that the app works out
itself, and the philosophy is that autogenerated data is *labeled*, never passed off
as observed:

| Where the row came from | Duration | Clock window |
|------------------------|----------|--------------|
| Habit met its goal, habit has painted Tracking time | the painted minutes (**observed**) | read off the last painted run (**observed**) |
| Habit measured in minutes/hours | the logged value (**observed**) | assumed |
| Habit with a per-unit rate (10 min/page) | logged amount × rate — 4 pages written on a 3-page habit is 40m, **crediting what was logged** | assumed |
| Habit ticked off today, no Tracking data | — | assumed finished **just now**, started a duration earlier |
| Habit ticked off for a day already over | — | assumed half an hour before that night's bedtime — stated, painted on the grid, or your median over the last month (`lib/sleep-sync.ts`) — and only without any of those, the day anchor (default **9:00 PM**, `lib/user-settings-store.ts`) |
| "Log done" retroactive capture | 30m assumed | same rules as above |
| Operation **Working on this now** stopped | the live session length (**observed**) | start/stop clock (**observed**) |

Assumed values are marked with a leading `~` and an **est.** chip
(`lib/estimated-values.ts` holds the flag; `CompletionTimeLine` renders it). The
chip's tooltip spells out the basis — "4 pages × 10 min each" — and clicking it opens an
inline editor for the finish time and duration. A separate **Est.** mark
(`Task.timeRough`, set in the ritual's assumed-times row or the completion
reflection's **Done at → Est.**) means the person treats the duration, the
start, or the finish as a rough estimate even after the app's guess is
confirmed. A finish marked estimated wears `~` on the clock. The check button next to the chip accepts
the derived values as-is. Either way the fields are stamped confirmed, which stops
the habit sync from re-deriving over the user's number
(`lib/services/completion-time-service.ts`). When two or more observed sessions
share this row's title (or a named item type), a second dashed-amber **usually ~N**
chip shows the median — display-only, never written onto `estimatedDuration`.

While a duration is still unconfirmed it stays live: logging a 4th page after the
3rd lifts the recorded duration from 30m to 40m and slides the start back, without
moving the finish time. The section title shows how many rows are still waiting
(`3 est.`), and the same queue is offered in bulk in the period review
(`components/Reviews/`).

When more than one of Done / Missed / Undone has rows, they share one row of equal-width wells (tops aligned). Opening one does not stretch the other. A single section stays full width.

## Tier system & sorting

Tier (A+ through D) is computed from urgency + importance on each task. The closed-row nixie is a select menu of those tiers (`tierToUrgencyImportance`); the Assigned composer uses the same menu. Sort modes (`TodoSortMode`):

- **`priority`** (default) — re-orders by the transparent priority formula in `lib/priority.ts` (`computePriorityScore`).
- **`tier`** — sorts by tier, then by push count for the active period.
- Also **name**, **created**, **added**, **pushed**.

On **Assigned**, `pinPrioritizedFirst` always puts prioritized rows first; the chosen sort still orders within each partition.

### What waits on a row (Phase 14, task half)

_Last mapped: 2026-10-21._ Slice S of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md), task half. Built, not committed.

- **Priority sort only.** `sortTodosByPriority` (`todo-utils.ts`) reads `unlockContextFor` from `lib/unlock-value.ts` over the whole task list, so a waiting task counts even when it is not on this list. It adds the fifth `unlocks` signal and an urgency floor from the inherited due date. A row with nothing waiting scores exactly as before.
- **Blocker goes first.** `blockersFirst` then moves an open prerequisite on the list to just above the first row waiting on it. Required / Assigned split and `pinPrioritizedFirst` run after, so this holds within each partition and Prioritized stays pinned.
- `sortTodos` takes optional `now` and `markedIds`. The panel passes Required + Prioritized ids for the period; those count as full value. `filterAndSortTodos` is unchanged: the priority path already had the whole task list, so it needed no all-tasks argument.
- **Row.** `TodoTable` takes `unlockOf`: an **unlocks N** chip (plain ink, no padlock, hover = `unlockBreakdown` label) and a neutral "due Thu for *X*" when something waiting has a deadline. Styles: `.todo-row-unlocks`, `.todo-row-inherited-due` in `todo-chrome.css`.
- **Formula.** The field list in `PriorityFormulaPanel.tsx` (~28) has a fifth **Unlocks** field.
- **Planned.** "needs *X* · not scheduled" with **Schedule *X* today**; (the task card shows the inherited due since slice O); step unlock rank in `lib/next-step.ts` and Phase 14 D (slice N); E (met at a level).

## Task card

_Last mapped: 2026-10-16._ Slice O of [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md#phase-12-the-to-do-task-card) (Phase 12). Built, not committed.

- **Header + pens (2026-10-20).** _Last mapped: 2026-10-20._ The task name is the big title (26px, at least half the row), **↗ Item** sits right after it, and × is pinned to the card's top-right corner (`.task-card-close`). The est · parts · spent line has a tooltip saying where each number comes from (`trioHelp`). **Hide math** swaps `TreeMath` for one raw line (`RawMath`; localStorage `brain2-task-card-math`). The pen moved from the header to the right bar: **Pen** on the whole task edits `Task.penLinks`; on a step it shows the inherited pen (`stepPenLinks` in `lib/task-clock.ts`: own, else nearest parent step, else task) with **change**, **none** (`[]`) and **Inherit**. `Subtask.penLinks` is new; ▶ and Just Start paint with the step's pen (`clockPenFor(task, stepId)`). Double-click a pen chip opens pen settings; the picker can make a **New pen** and opens its settings. On a step, a new pen counts as the pen the step would inherit (`parentId`, same view); change it in pen settings. Esc (`guardEscape`) does nothing while a `[data-item-layer]` (Just Start, item detail) is up, and asks before dropping typed text in a `[data-draft]` field. Just Start's root is a `data-item-layer` with `pointer-events: auto`, so working in it no longer closes the card. **Planned:** logging a step done does not yet paint with the step's pen.
- **Files.** `TaskCard.tsx` + `task-card.css`, mounted once in `todo-panel.tsx` (`<TaskCard host={taskCardHost} />`). Which task is open lives in `lib/task-card.ts` (`openTaskCard`). The panel lends its handlers (`TaskCardHost`): Required / Prioritized for the lens, `handleSteps`, Just Start, Needs…, `todoTime.timeOf`, the pen clock. So the lid, the card and item detail always agree.
- **Ways in.** **Card** in the open lid's Flags row (`TodoTable.tsx`, beside View). **Card** in item detail's key row while a To Do panel is mounted and the task is on today / this week / this month; on a step item it opens the parent's card, selected and scrolled to the step (`ItemDetailPopup.tsx`).
- **Linked both ways.** **↗ Item** pushes item detail on top (`pushItemLayer`). Item detail's **Card** closes item detail (or clears the step layers) and opens the card. The card ignores clicks in a layer or dialog above it.
- **Header.** Name, lens nameplate, Required / Prioritized, state lamp, `pushed ×N` this grain, pen, level gauge, `est · parts · spent`, points, ▶, **Just Start**, **Just 25**, **Session with this**, **↗ Item**. Points read `task 10 · level +10`; with **Points visible** on, `task 10 · steps 6 · level +10`. `level +N` is the house tier amount for the level reached (`activeTierPoints`), a readout only.
- **Body.** The shared `StepTree` with `tierTags`, `onOpenStep` (↗), and a **Columns** picker (tier · spark, B / G / E %, est, parts, spent, points, needs count, lock, unlocks, ▶; kept in localStorage `brain2-task-card-cols`). The Points column exists only with Points visible on. Above it: level filter (All / B / G / E), Hide locked, Show next only (card-local), **List mode** (_2026-10-20_: was **B | G | E**; three columns, drag a step to another column sets its own tier), **Select all open**, **Select leaves**, **Deselect all**. Every key has a tooltip. Rows no longer carry a Needs… dropdown; a quiet **needs N** shows instead and needs are edited in the right bar. A thin **order lane** draws open steps with prerequisites by chain depth, node size by what waits on them; a click selects. `StepTree` gained controlled `selected` / `onSelectedChange` and `onVisibleIds`.
- **Mass edit.** With a selection a bar shows: set estimate, ±5, ±15; B / G / E / inherit; points (Points visible only); Spark / Clear spark; **Needs…** (all need one step), **Chain** (visible order), **Clear needs**; Done / Not done; **Move under…**; Delete; **Session with these**. Each is one `runAsAction`, so one undo.
- **Right bar = node detail** _Last mapped: 2026-10-20_ (`TaskCardSide.tsx`). **Planned:** a redesign; four studies live in the lab at `/lab/node-detail/` ([`components/Lab/NodeDetailLab/README.md`](../../Lab/NodeDetailLab/README.md)). It follows the selection. **One step**: path, name, state lamp (open / locked / done), tier, est, spent, ends; **Points** (`Subtask.points` **On done** dial, placeholder the inherited value, **↺ Inherit N** to clear; a step with children also has an **Each step** dial for `Subtask.stepPoints`, or **By level**: `Subtask.tierPoints` B / G / E rungs, paid as each level inside is reached, keys `step:{taskId}:{stepId}:{tier}`, `tierPointChanges` in `lib/step-points.ts`; a level with no step inside is disabled); **Needs** in three kinds (`lib/node-needs.ts`): *Tasks first* (steps in the tree via `dependsOn`, or any task via `needsTaskIds`), *Resources* (`resourceIds`: any item or `list:{id}`; never locks), *Awaiting* (`awaitIds`: `event` items; locked until **log** ticks it, without the completion popup, or its date passes); each searches and creates on Enter; **Unlocks** (steps that wait on it, addable); **↗ Step item**. Outside locks reach the tree through `StepTree` `extraLock`. **Several steps**: Σ selection with the level mix, ρ / σ mosaics over the topmost picked branches, done, estimate, left, points, locked, needs, spans. **None**: the task, as below, with the same Needs editor over `Task.dependencies` / `resourceIds` / `awaitIds` and Unlocks over other tasks.
- **Side panel (no selection).** _Last mapped: 2026-10-20._ The whole task. Clicking the card title clears the selection and brings it back. A head names the task (`{period} · whole task`, state, est, spent, steps done). **Points** is two equal `PointsDial`s on one borderless Dash glass panel (− N + glyphs, `SegDigits` over a transparent input; see `docs/DESIGN_STYLE.md` → Dash readouts outside the dashboard): **On done** edits `Task.pointsOverride`, its placeholder is the rule, and **↺ Back to the rule** clears it. **Each step** is optional `Task.stepPoints`, what any step pays when it sets none of its own. Needs and Unlocks (below) and the inherited due date (`inheritedDue`). This period: marks, pushes in / out (`schedulePlacements`), spent this period (`attentionGiven`) vs all time, minutes left for the chosen level vs working minutes left today, level reached and B / G / E %, sessions in history that held it with tier reached.
- **Needs, add by kind.** _Last mapped: 2026-10-20._ Only kinds in use show (Tasks first, Resources, Awaiting); none reads "Needs nothing yet." **+ Add need** shows three kind chips, then that kind's search (focused; Enter picks or creates; Esc or an empty blur closes). Unlocks shows only when something waits; **+ Make a task/step wait on this** opens its search.
- **Notes** (all modes). _Last mapped: 2026-10-20._ Was **Notice**. A fold with a count (open state in localStorage `brain2-task-card-notes-open`, default open) and a dot while the notice dot is due. A rounded composer with **Log ⌘↩** inside it, then a dated rail, newest first. Entries are still `noteLog` with `tag: "notice"` (`withNoticeAnswer`).
- **Step points.** `Subtask.points`, else the nearest `Subtask.stepPoints` above it, else `Task.stepPoints` (`effectiveStepPoints` in `lib/task-card.ts`), pays `step:{taskId}:{stepId}` on tick and takes it back on untick, through `handleSteps` (lid and card). Ticks from item detail → Subtasks do not pay yet.
- **Ways in, more.** _Last mapped: 2026-10-16._ **Card** in the row's closed Actions (`TodoTable.tsx`). A task name in the session draft's pick list opens its card (`SessionPlanner.tsx`).
- **Planned.** **More…** on a session's **Add new** line (that line does not exist yet); **Move to task…** (Decision 9); node size by Phase 14 unlock value instead of the count; step points from item detail ticks.
- **Completion math** _Last mapped: 2026-10-20_. The header figure is `TreeMath` (`components/steps/TreeMath.tsx`, numbers in `lib/tree-math.ts`). End nodes are leaves; a ticked parent counts all its leaves done. ρ = Σdᵢ/ΣLᵢ (every end weighs the same). σ = (1/n)Σdᵢ/Lᵢ (every top-level part weighs the same). Δ = σ − ρ. Two mosaic bars draw both. B / G / E use the same rule over only the children whose effective tier is exactly that level, at any root: the header (task) and each row (`SplitGauge`). Leaves show no gauge. The sidebar Level line reads σ. `levelReached` and `LevelGauge` elsewhere still use the cumulative views in `lib/step-progress.ts`.
- **Order lane**: the chips under the switches are open steps linked by Needs…, columns in the order they can run, ⇢N = how many they unlock. Click selects. Only shows when some step has Needs.
- Tests: `TaskCard.test.tsx`, `lib/task-card.test.ts`, `lib/tree-math.test.ts`.

## Completion status (Feature 9)

Each row has an **active lamp** (`toggleTodoActiveLamp`). It toggles **active** ↔ **partial**. Both stay on the default **Open** list, so turning the lamp off and on again does not hide the row. Deferred, cancelled, missed, and done are not on that click — a row already in one of those statuses returns to active. Set the rest from item detail. **Done** and **Missed** stay engraved verb keys (and keyboard D / M). The header **Status** filter (Show bay) narrows the lists by lens — `Open` (active+partial, the default), `Active & available` (open and dependency-unblocked), a single status, or `All`.

The closed-row percent is step completion (`todoCompletionPercent` in `lib/todo-steps.ts`). No steps, or none finished, reads **0%**. It is not the estimate as a fraction of an 8-hour day (30 minutes used to read 6%). Minutes stay a separate `Nm` label.

## Available now (#253)

**Show → Available now** (default **off**, persisted in `brain2-todo-prefs`, legacy alias `cogs-todo-prefs`) hides rows with unmet `dependencies`. The predicate is `lib/available-tasks.ts` — same as Scheduler: a dep blocks only when that task exists and is still open work (not done, not missed). Ghost ids do not hide the row. This is independent of the Status lens.

## WIP warning (#19)

**In progress** = `status === "partial"` (started, not done). Soft cap defaults to **3**, editable in the Pace bay. When the count exceeds the cap, a lace phosphor warning says `N in progress (cap M) — warning only, not a block`, and the load-strip POWER lamp warms. No hard stop, no auto-reschedule.

## Neutral words, the notice dot, attention given (Phase 15 B)

_Last mapped: 2026-10-16._ Built, not committed. House rule: [No "should"](../../../docs/DESIGN_STYLE.md#no-should). Plan: [`docs/TODO_REDESIGN.md`](../../../docs/TODO_REDESIGN.md) Phase 15 B.
- **Words.** The lid reads "Waiting since Tue" (a date past a week), from `waitingSinceLabel` in `TodoTable.tsx`. The push tube's title reads "Pushed ×3". Required reads "you marked this one", not "must be done". The comfort band `behind` reads "more than fits" (the key stays). Missed keeps its word, key and record; its tooltip reads "the window for it passed".
- **Ink.** The Missed key, the Missed well and its lamp, and the comfort `behind` arc are neutral ink, not red (`todo-chrome.css`). Warm red stays on estimate overruns only (`.is-over`).
- **Notice dot.** A row pushed 3+ times across day, week and month (`needsNotice`, `lib/notice-dot.ts`) shows a small ink dot after its name. Clicking it opens one line: "I'd like to understand what's going on with this one…". Enter saves a dated `noteLog` entry with `tag: "notice"` and `pushCount` (`withNoticeAnswer`). The dot stays quiet until the next push. It shows in item detail → Notes with the other entries, and on the task card (Phase 12).
- **Attention given.** The Done well has a quieter second line, "3 sittings · 2h10 of attention given" (`attention-given.ts`). It reads the Done tasks' `timeLogs` and Tracking blocks dated inside the period, deduped by `trackedTimeForItems`. A sitting is one counted block, or one log that names no counted block. A timed log with no `entryIds` over a painted block counts its minutes once but its sitting twice. **Planned:** tier lamps on Done rows (needs Phase 10).

## Overdue and the priority date

An open row shows "Waiting since Tue" (formerly `waiting Nd`) from the **priority date**: the earlier of the live scheduled day and the start of the earliest Undone period (`priorityDateOf` in `lib/scheduling.ts`), or an earlier deadline when one exists. Pushing the task onto a later day does not wipe how long it has already been waiting. The same date fills the row’s week and month overdue counts. Regret uses a deadline or `mustBeDoneBefore` first; with neither, it uses this priority date. The Priority sort itself is the urgency / importance / quick-win / entropy formula, plus `unlocks` when something waits on the row (below).

## Actions per row

| Action | Effect |
|--------|--------|
| Required | Toggles `todoMarks` for this period (lid jewel / keyboard R). On: the row moves to **Required**. Lives in the open lid, not on the closed row. |
| Prioritized | Toggles the prioritized mark (lid jewel). The row stays on **Assigned** unless it is also required. On a day that already has a morning review, this also updates `priorityTaskIds`. Lives in the open lid. |
| Done | Marks task done in store (same `complete` path as before; label **Done**); short flock then it leaves this list and appears under Done / Lists **Completed**. On the closed row. |
| Missed opportunity | Marks the task too late; it leaves this list and appears under Missed opportunities / Lists **Missed Opportunities**. No points. In the lid (with View). |
| Push | `pushTaskOnePeriod()` — next period on the To Do list, and the period being left stays Undone. On the closed row. |
| Start | Opens Just Start for the task. On the closed row. |
| View | Opens `TaskDetailPopup`. In the lid. |
| Delete | Deletes the task (confirms first). On the closed row. |
| Click name / Enter | Opens the clamshell lid (one at a time) |

Wave 13 (GS-9) keeps goal-complete and grade so partial work is credited.
[`docs/ScienceandSanityBrain2.md`](../../../docs/ScienceandSanityBrain2.md).

## Deliberately skipped (this redesign)

| Idea | Reason |
|------|--------|
| Drag row onto Required / Assigned nameplates | Skip until accessible; jewels + **R** ship |
| Lift / Tuck promote-demote | No promote/demote step API without data loss |
| Side pad Note / Place / After / Goal | No existing fields; would need schema |
| Week/month day glasses | Would fork period cursor / filter state; period nameplate already moves the period |
| Sony day tape under comfort | Correctness risk on estimate writes / display order; meter ships without the tape |
| Extra fascia CRTs for Open / In progress / Still to confirm | Duplicate of load instruments |

## Options

- **Show / Sort** — _Last mapped: 2026-10-21._ On the fascia: Available now, Show all tasks, Status, Sort + direction, Formula. Rites follow the sun, the in-progress cap and Pace are in the gear. All tasks, Status, Sort and direction persist in `todo-prefs.ts` like Available now. Changing lens clears the Assigned search and closes Formula.
- **Show all tasks** — includes unscheduled tasks when enabled.
- Collapse long lists after 8 rows with "Show more".

## Panel fixes (2026-10-21)

_Last mapped: 2026-10-21._
- The ledger rows are a `useMemo` over the task store, not a copy in state, so the first paint is not empty.
- The task card's Required and Prioritized follow the lens. On Season they flip season marks, the same as the season lid, and the card plate reads **This season**. Push counts still read the month.
- Morning priorities skip tasks that no longer exist and dim done ones.
- The Other lens counts open the same way as the others (`isOpen`, not cleared from work).
- Done ignores a second click during the 380ms flock; flock and fold timers clear on unmount.
- Split and polish are planned in the project research note, not built.

## Related

- Lists smart lists (Daily/Weekly/Monthly To Do) read the same `task-store` scheduling fields.
- Next Actions also auto-manages **Completed** and **Missed Opportunities** lists (`na-smart-completed` / `na-smart-missed`) as real lists in that folder (open them from the tree).
- Scheduler funnel assigns the underlying schedule; this panel is the execution view.

## Task card: estimates, sub-cards, pen time

_Last mapped: 2026-10-20_

- **Type.** Names and figures use Fraunces (`--font-fraunces`), labels DM Mono (`--font-dmmono`), both loaded in `app/layout.tsx`. Styles are at the foot of `task-card.css`.
- **Points.** `PointsDial` is a Dash readout (`SegDigits` under a transparent input, equal-width pods in one glass panel); the rules at the end of `task-card.css` out-rank global input styles. _Last mapped: 2026-10-20_
- **Estimates.** `EstimateCell.tsx` is a click-to-edit time (Enter saves and opens the next one). Every change goes through `setEstimate` / `withEstimate` in `lib/task-card.ts` and appends to `Subtask.estimateLog` (`{ at, minutes }`), so the history can be learned from. The side panel's `EstimatePanel` adds quick values and the last six estimates. **Planned:** feed `estimateLog` into `lib/estimate-pace.ts`.
- **Steps inside.** `SubstepPreview` in `TaskCardSide.tsx` lists the first level under the selected step, each with its estimate.
- **Sub-card.** **⧉ Open as card** calls `openSubCard(taskId, stepId)` (`lib/task-card.ts`, `rootStepId` in the card store). Same task, narrower view: the tree, totals and lane read `view` (the root's children); edits write the whole tree through `replaceKids`. Crumbs above the title climb back up. A typed-but-unentered step (`StepTree` composer) and an unlogged note (`LogNotes`) are saved when the card is left.
- **Pen time.** A linked pen only colors a task. `trackedTimeForItem(..., { penScope: "tagged" })` counts blocks carrying the task's `taskId` plus `timeLogs`; the pen's other minutes come back as `penPoolMinutes` and show as "pen overall". Operations still use the default `"all"` scope.

### Task card: sections, Order toggle, stat cards, Open item

_Last mapped: 2026-10-20_

- **Zones.** Header band (title, state, stat cards, actions); left column = **Order** (collapsible) then **Steps** (toolbar, tree, mass-edit bar); right = detail panel with a sticky title. Both use `CardSection.tsx` (title bar, count, hairline). Detail order: Estimate → Inside → Points → Pen → Needs → This period → Notes.
- **Order toggle.** The whole title row toggles (`aria-expanded`). Saved in localStorage `brain2-task-card-order-open`, default open, guarded. Collapsed shows "N steps · M in sequence" (M = steps that wait). No lane, no section.
- **Stat cards** (`TaskCardStats.tsx`, under the title): Estimate, Parts, Spent, Points, Progress. Each opens one popover (Esc or outside click closes it; focus returns). Progress holds the completion math (`TreeMath`); the old **Show math** key is gone. In a sub-card they describe the root step. `guardEscape` lets Esc close the popover first, not the card.
- **Spent blocks.** _Last mapped: 2026-10-22._ The Spent popover lists the blocks behind the number (`SpentBlocks.tsx`): date, start and end, minutes, step. Start and end are `H:MM` fields (Enter or blur saves, Esc backs out) that call `updateEntry`; × then `delete?` calls `removeEntry`. A sub-card shows only blocks on its root step and what is inside it. Typed `timeLogs` with no block are listed read-only under them. **Planned:** edit typed logs; jump to the block in the time grid.
- **Points dial, inherited value.** _Last mapped: 2026-10-22._ The input's placeholder must stay transparent: the win95 `.is-fallback` placeholder rule out-ranked the tube rule and drew the inherited number a second time over the segment digits. The tube rule now matches its specificity.
- **Inside (substep preview) font.** _Last mapped: 2026-10-22._ Step names use Karla 14px/500 (`.tcs-kid-name`), no longer Fraunces.
- **Orb selects, key opens.** The tree orb selects the step (⌘/Shift add); it no longer opens the item. **Open item** (window-arrow key, `OpenItemKey` in `TaskCardSide.tsx`) sits by the node name in the detail header and, for the whole task, calls `pushItemLayer`. The old bottom "↗ Step item" button is removed; the row hover ↗ stays.

### Task card is its own UI (not item detail's)

_Last mapped: 2026-10-20_

- The card has its own code and docs; do not mirror the lid or item detail. Row checkboxes **select** (multi), never tick done (`StepTree` `checkboxSelects`); done is the mass-edit bar's **Done**.
- **Required** is a circle-! icon key (on until turned off for the period). **Prioritized** is a star (`PriorityStar.tsx`) that works like Prioritize habit: a press asks for a plain-text reason, the star fades 10 points a day from `Task.priorityRefreshedOn` (`priorityStarFade`), **Reaffirm** refreshes it, and every press is kept on `Task.priorityLog`. The mark itself still goes through the host.
- Stat-card popovers (`TaskCardStats.tsx`) show the formula (est = max(own, Σ parts)), the estimate log with deltas, per-part shares (click selects the step), pace, and points sum.

## Detail-panel pass: Dash stats, This day, node notes

_Last mapped: 2026-10-20_

- **Stat cards** (`TaskCardStats.tsx`) draw each figure with `DashReading` on one Dash glass panel. Tests read the figure from the `aria-label`, not `textContent`.
- **This day** is `TaskCardPeriod.tsx`: two Dash pods (spent, left for the chosen level; violet when it will not fit today), flip-able Required / Prioritized marks, three tappable level meters (tap sets the card's level filter), pushes in plain words, session chips.
- **Notes** (`LogNotes`) are per node. A note written with one step selected carries `ItemNoteEntry.nodeId`; with none selected it is a task note (the notice-dot answer, as before). A scope toggle shows **This step / This task** or **All** (each tagged with its node). **Planned:** a true "global" note kind apart from the task's own.
- **Link pen** (`ItemPenTime.tsx`) now always offers **Create a new pen** (or `New pen "query"`), which opens pen settings.
