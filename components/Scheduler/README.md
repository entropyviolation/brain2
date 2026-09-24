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
| `scheduler-utils.ts` | **Pure logic**: available/scheduleable filtering + sort, per-period queries, schedule/unschedule field updates, calendar grid builders, navigation, overview-box assignment. Unmet-dep check is `lib/available-tasks.ts`. Unit-tested in `scheduler-utils.test.ts` |
| `project-network.ts` | **Pure glue**: `buildProjectNetwork()` selects "project" tasks (any in a dependency relation, or scheduleable with a duration), derives precedence edges, and runs the CPM solver (`lib/critical-path`); `toLayoutEdges()` adapts edges for `lib/graph-layout`. Shared by the Gantt + Graph views |
| `GanttView.tsx` | **Gantt document** (plain SVG): one row per task (orb + label), bars positioned by CPM earliest-start and sized by duration, dependency arrows, slack tracks, critical path. Click a row to open the task. Not editable |
| `DependencyGraph.tsx` | **Dependency document** (plain SVG): tasks as nodes with orbs, `dependencies` precedence as directed edges, layered left→right layout (`lib/graph-layout`), critical path. Click a node to select/open |
| `SchedulerTaskItem.tsx` | Draggable task row: photographed orb, title, duration/urgency/importance. Used across funnel tabs |
| `PeriodCell.tsx` | Droppable bucket. Empty = reserved one-line furniture; occupied rows open to show work |
| `PeriodFunnelTab.tsx` | Generic Year/Month/Week tab (sidebar list + reserved child-period rows) |
| `AlwaysTab.tsx` | Always tab: available list + filters + reserved overview rows (This Year … Tomorrow) |
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

## Visibility rules

A task appears in the Scheduler only if it belongs to at least one **scheduleable** list (`TaskCategory.scheduleable !== false`).

The **Always** overview shows tasks at their stored schedule level only (`taskBelongsInOverviewBox` in `lib/item-utils.ts`).

## UI structure

1. **CRT title** — human caption (`Scheduler — Funnel` / Gantt / Dependencies) plus a title orb on black glass.
2. **Toolbar** — equal **Funnel / Gantt / Dependencies** keys (active = CRT + power lamp). Period metal chevrons + nameplate date when the funnel is not on Always.
3. **Address** — engraved nameplate + path well (`Funnel \ Always`, or Year/Month/Week/Day + the current period label).
4. **Period keys** — Always, Year, Month, Week, Day in one equal-fill bay. Only on Funnel. Not a second view-mode row.
5. **Available Tasks** — inbox of unscheduled / current-period work; drag into buckets.
6. **Reserved buckets** — one-line furniture when empty; expand to orb rows when they hold work. Not seven `0 · Empty` cards.
7. **Status** — available / scheduled counts.

## Drag behavior

Dragging a task from a coarser bucket to a finer one sets the appropriate scheduling field and clears coarser fields (e.g. week → day clears `scheduledWeek`, sets `scheduledDate`).

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

## Not implemented

- Auto-scheduling with constraint solving (§7.6).
- Automatic carry-over (partially handled via Reviews).
- Event-linked checklists on calendar events.
- Editable Gantt / commitment budget (later haunted mechanics).
