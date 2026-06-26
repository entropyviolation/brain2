# `components/Scheduler/` — Scheduler (Period Funnel)

The **Scheduler** top-level tab. Progressive refinement: bucket tasks into Always → Year → Month → Week → Day before assigning specific dates/times.

## Files

The funnel was split (orchestrator pattern) so the orchestrator stays small and
the period/filter logic is independently testable.

| File | Purpose |
|------|---------|
| `enhanced-scheduler.tsx` | **Orchestrator**: state, store wiring, task-item renderer; switches between the **Funnel / Gantt / Graph** views (`schedulerView`) and composes the funnel tabs below |
| `scheduler-utils.ts` | **Pure logic**: available/scheduleable filtering + sort, per-period queries, schedule/unschedule field updates, calendar grid builders, navigation, overview-box assignment. Unit-tested in `scheduler-utils.test.ts` |
| `project-network.ts` | **Pure glue**: `buildProjectNetwork()` selects "project" tasks (any in a dependency relation, or scheduleable with a duration), derives precedence edges, and runs the CPM solver (`lib/critical-path`); `toLayoutEdges()` adapts edges for `lib/graph-layout`. Shared by the Gantt + Graph views |
| `GanttView.tsx` | **Gantt timeline** (plain SVG): one row per task, bars positioned by CPM earliest-start and sized by duration, dependency arrows, slack tracks, and a red-highlighted critical path. Click a row to open the task |
| `DependencyGraph.tsx` | **Dependency node-graph** (plain SVG): tasks as nodes, `dependencies` precedence as directed edges, layered left→right layout (`lib/graph-layout`), critical path in red, cycle detection. Click a node to select/open |
| `SchedulerTaskItem.tsx` | Draggable task card used across all tabs |
| `PeriodCell.tsx` | Droppable bucket cell (month/week/day cell or Always overview box) |
| `PeriodFunnelTab.tsx` | Generic Year/Month/Week tab (sidebar list + grid of child-period cells) |
| `AlwaysTab.tsx` | Always tab: available list + filters + overview boxes |
| `DayTab.tsx` | Day tab: day task sidebar + `DayAgenda` |
| `DayAgenda.tsx` | 24-hour agenda with drop-to-hour scheduling |
| `SchedulerFilters.tsx` | Collapsible "Filters & Sort" controls for the Always tab |

### Scheduler views

A toolbar toggle switches the main area between three views:

| View | Component | Shows |
|------|-----------|-------|
| **Funnel** (default) | tabs below | Always / Year / Month / Week / Day period buckets |
| **Gantt** | `GanttView` | Timeline with bars + critical path |
| **Graph** | `DependencyGraph` | Task precedence network + critical path |

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

1. **Scheduler Inbox** — tasks with no schedule assignment.
2. **Period tabs** — Always, Year, Month, Week, Day with date navigation where applicable.
3. **Task cards** — drag to refine period; click to open `TaskDetailPopup`.
4. **Filters** — by list/category; sort by importance, duration, deadline, reward, category.

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
