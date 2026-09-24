# `components/Scheduler/` — Scheduler (Period Funnel)

The **Scheduler** top-level tab in **Brain2**. Progressive refinement: bucket tasks into Always → Year → Month → Week → Day before assigning specific dates/times.

The surface is a **milled fascia** window (`.sch95` in `scheduler-chrome.css`, kin to Plan): CRT title (`#070c0a` glass, phosphor `#7dffc4`), Funnel / Gantt / Dependencies as equal view keys (active = CRT + round power lamp), Always → Day as equal period keys in one bay, engraved Address / View / Period nameplates, raised metal toolbar keys. Funnel buckets, Gantt, and Dependencies documents keep their content chrome and meaning colors — looks only on the frame.

## Files

The funnel was split (orchestrator pattern) so the orchestrator stays small and
the period/filter logic is independently testable.

| File | Purpose |
|------|---------|
| `enhanced-scheduler.tsx` | **Orchestrator**: window chrome, store wiring, task-item renderer; toolbar **Funnel / Gantt / Dependencies** (`schedulerView`) and period keys. View mode + calendar cursor persist across refresh / tab switch. |
| `scheduler-chrome.css` | Milled fascia: CRT title, view/period key bays, Address nameplate, metal keys — scoped under `.sch95`. Funnel / Gantt / graph contents untouched. Also imported from `app/layout.tsx` so Fast Refresh cannot drop it. |
| `scheduler-utils.ts` | **Pure logic**: available/scheduleable filtering + sort (`isTaskScheduleable`, `nextTaskScheduleableFlag`), per-period queries, schedule/unschedule field updates, calendar grid builders, navigation, overview-box assignment, `taskIdsForDragSchedule` (multi-drag selection payload). Unmet-dep check is `lib/available-tasks.ts`. Unit-tested in `scheduler-utils.test.ts` |
| `project-network.ts` | **Pure glue**: `buildProjectNetwork()` selects "project" tasks (any in a dependency relation, or scheduleable with a duration), derives precedence edges, and runs the CPM solver (`lib/critical-path`); `toLayoutEdges()` adapts edges for `lib/graph-layout`. Shared by the Gantt + Graph views |
| `GanttView.tsx` | **Gantt document** (plain SVG): one row per task (orb + label), bars positioned by CPM earliest-start and sized by duration, dependency arrows, slack tracks, critical path. Click a row to open the task. Not editable |
| `DependencyGraph.tsx` | **Dependency document** (plain SVG): tasks as nodes with orbs, `dependencies` precedence as directed edges, layered left→right layout (`lib/graph-layout`), critical path. Click a node to select/open |
| `SchedulerTaskItem.tsx` | Draggable task row: photographed orb, title, duration/urgency/importance. Used across funnel tabs |
| `PeriodCell.tsx` | Droppable bucket. Funnel grids: empty = reserved one-line furniture. Always: `variant="card"` drop cards |
| `PeriodFunnelTab.tsx` | Generic Year/Month/Week tab (sidebar list + reserved child-period rows; Deselect / Delete / Mark complete when the shared selection is non-empty) |
| `AlwaysTab.tsx` | Always tab: available list + two columns of drop cards (This Year … Tomorrow, Eventually / Later). Selection tools: Deselect all, Remove from Scheduler, Delete, Mark complete |
| `DayTab.tsx` | Day tab: day task sidebar + `DayAgenda` |
| `DayAgenda.tsx` | 24-hour agenda; empty hours stay reserved; occupied hours hold orb rows |
| `SchedulerFilters.tsx` | Collapsible "Filters & Sort" for the Always inbox |

### Scheduler views

A **toolbar** (not a second instrument) switches the main area between three views:

| View | Component | Shows |
|------|-----------|-------|
| **Funnel** (default) | period keys | Always / Year / Month / Week / Day buckets |
| **Gantt** | `GanttView` | Timeline document with bars + critical path |
| **Dependencies** | `DependencyGraph` | Task precedence network + critical path |

The Gantt and Graph views are driven by **`project-network.ts`**, which runs the
**Critical Path Method** solver in `lib/critical-path.ts` (forward/backward pass,
slack, zero-slack critical chain; duration from a task's PERT estimate when
present, else `estimatedDuration`). Node positions for the graph come from the
layered layout in `lib/graph-layout.ts`.

## Data

Reads/writes **`lib/task-store.ts`** scheduling fields:

| Field | Period |
|-------|--------|
| `scheduledYear` | Year |
| `scheduledMonth` | Month (`YYYY-MM`) |
| `scheduledWeek` | Week (`getWeekString` range) |
| `scheduledDate` + `scheduledTime` | Day |
| `schedulePlacements` | Prior placements after automatic roll-up (gray past cells) |

## Visibility rules

A task appears in the Scheduler when `isTaskScheduleable` says so: list
`scheduleable !== false` includes the list's tasks, unless the task sets
`scheduleable: false`. `scheduleable: true` forces the task in even when its
lists are off. `undefined` inherits from lists. Item detail's **Schedulable**
switch on the Scheduling tab writes that override (off → `false`; on → inherit
when a list already allows it, else `true`).

The **Always** overview shows tasks at their stored schedule level only (`taskBelongsInOverviewBox` in `lib/item-utils.ts`).

**Today** and **Tomorrow** store the local calendar date that was true when the task was dropped (`formatLocalDateKey`, not UTC). The next day, yesterday's Tomorrow is Today, because that date is now today. An unfinished period that has ended rolls up one level on the funnel (`rollUpExpiredSchedules` via `useDayScheduleRollover` on `app/page.tsx`): day → that week, week → that month, month → that year, year → fully unscheduled. Prior placements are kept on `schedulePlacements` so gray past cells still show what was planned. Automatic roll-up does **not** increment `daysPushed` / `weeksPushed` / `monthsPushed`. A push (`pushTask` / a review push) writes the next period and wins — that task is not rolled. Done and missed rows stay where they were.

Past days (Week tab), past weeks (Month tab), and past months (Year tab) render as gray furniture (`.sch-bucket.is-past`): muted type, darker fill, still readable and still droppable. Today / the current week / current month are never past.

**Eventually / Later** does not set a period. The first drop creates a Next Actions list named `eventually` (`lib/eventually-list.ts`) and files the task there. Those tasks leave the available inbox until you schedule them (which removes the list) or send them back with the row's ×.

## UI structure

1. **CRT title** — human caption (`Scheduler — Funnel` / Gantt / Dependencies) plus a title orb on black glass.
2. **Toolbar** — equal **Funnel / Gantt / Dependencies** keys (active = CRT + power lamp). Period metal chevrons + nameplate date when the funnel is not on Always.
3. **Address** — engraved nameplate + path well (`Funnel \ Always`, or Year/Month/Week/Day + the current period label).
4. **Period keys** — Always, Year, Month, Week, Day in one equal-fill bay. Only on Funnel. Not a second view-mode row.
5. **Available Tasks** — inbox of unscheduled work (not on the eventually list); drag into cards. With a selection: **N selected**, **Deselect all** (clears checks only), **Remove from Scheduler** (`scheduleable: false`), **Delete** (confirm + tombstone), **Mark complete** (quiet batch via completion service; no popup stack).
6. **Always cards** — two columns (This Year, This Month, Next Month, This Week, Next Week, Today, Tomorrow, Eventually / Later). Empty cards say Empty. Today and Tomorrow show the real date under the title. Year / Month / Week grids stay one-line furniture. Dragging a selected task onto a card schedules the whole selection. Each task that **changes** period bucket awards **1 point** (`lib/schedule-credit.ts`); Eventually / Later and same-bucket re-drops do not.
7. **Status** — available / scheduled counts.

## Drag behavior

Dragging a task from a coarser bucket to a finer one sets the appropriate scheduling field and clears coarser fields (e.g. week → day clears `scheduledWeek`, sets `scheduledDate`).

**Selection payload.** Funnel drops share one selection set across Always / Year / Month / Week. Rule (`taskIdsForDragSchedule` in `scheduler-utils.ts`):

- Selection empty → drop schedules only the dragged task (same look as before).
- Selection non-empty **and** the dragged task is in it → drop schedules every selected task (or files them all on Eventually / Later).
- Dragging a task **outside** the current selection → schedules only that dragged task; the other checks stay.

Click-to-schedule on a period card/cell already schedules the whole selection. **Deselect all** (beside **Remove from Scheduler** / **Delete** / **Mark complete** on Always, and beside **Delete** / **Mark complete** on Year/Month/Week sidebars when anything is checked) clears checks only — it does not unschedule, hide, delete, or complete tasks.

## Related panels

| Panel | Relationship |
|-------|----------------|
| Home Plan | Calendar placement of day/week scheduled tasks |
| Home To Do | Execution lists for scheduled tasks |
| Lists smart lists | Same schedule fields, different presentation |

## Related libs

| File | Purpose |
|------|---------|
| `lib/critical-path.ts` | Pure CPM + PERT solver (`computeCriticalPath`, `taskDuration`); unit-tested |
| `lib/graph-layout.ts` | Layered (topological) node layout + `boundingBox` for the dependency graph |
| `lib/scheduling.ts` | Scheduling field helpers shared across panels |
| `lib/schedule-credit.ts` | +1 point per changed period placement (not Eventually / same-bucket / unschedule) |

## Not implemented

- Auto-scheduling with constraint solving (§7.6).
- Automatic carry-over for week / month / year (day dates before today return to the inbox; Reviews and To Do can still push a day forward).
- Event-linked checklists on calendar events.
- Editable Gantt / commitment budget (later haunted mechanics).
