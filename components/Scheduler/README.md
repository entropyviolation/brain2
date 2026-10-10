# `components/Scheduler/` — Scheduler (Period Funnel)

The **Scheduler** top-level tab in **Brain2**. It sorts to-do lists into Always → Year → Month → Week → Day. A list that already has dates — a trip itinerary — is scheduled on its own and is not this tool unless **Send to Scheduler** is on.

## Public door

Other rooms import:

| Export | File | Used by |
|--------|------|---------|
| `EnhancedScheduler` | `enhanced-scheduler.tsx` | `app/page.tsx` (Scheduler tab) |
| `getScheduleableCategoryIds` | `scheduler-utils.ts` | Item detail page and popup |
| `isTaskScheduleable`, `nextTaskScheduleableFlag`, `taskInheritsScheduleableFromLists` | `scheduler-utils.ts` | `components/ItemDetail/ItemScheduleFlags.tsx` |
| `navigateDate` | `scheduler-utils.ts` | `components/Home/ToDo/TodoPeriodNav.tsx` |
| `pushCardWorkingQueue` | `schedule-card-detail.ts` | `lib/ritual-push.ts` |

Writes **task-store** (`updateTask`, `deleteTask`, and the scheduling, completion, and eventually-list services that persist on that store).

**Interiors** stay in this folder: the funnel (`AlwaysTab`, `PeriodFunnelTab`, `DayTab`, `DayAgenda`, `PeriodCell`), `SchedulerTaskItem`, `SchedulerFilters`, `ScheduleCardDetail`, `GanttView`, `DependencyGraph`, and `project-network.ts`. The other helpers in `scheduler-utils.ts` and `schedule-card-detail.ts` stay here too.

The surface is a **milled fascia** window (`.sch95` in `scheduler-chrome.css`, kin to Plan): CRT title (`#070c0a` glass, phosphor `#7dffc4`), Funnel / Gantt / Dependencies as equal view keys (active = CRT + round power lamp), Always → Day as equal period keys in one bay, engraved Address / View / Period nameplates, raised metal toolbar keys. Funnel buckets, Gantt, and Dependencies documents keep their content chrome and meaning colors — looks only on the frame.

## Files

The funnel was split (orchestrator pattern) so the orchestrator stays small and
the period/filter logic is independently testable.

| File | Purpose |
|------|---------|
| `enhanced-scheduler.tsx` | **Orchestrator**: window chrome, store wiring, task-item renderer; toolbar **Funnel / Gantt / Dependencies** (`schedulerView`) and period keys. View mode + calendar cursor persist across refresh / tab switch. |
| `scheduler-chrome.css` | Milled fascia: CRT title, view/period key bays, Address nameplate, metal keys — scoped under `.sch95`. Funnel / Gantt / graph contents untouched. Also imported from `app/layout.tsx` so Fast Refresh cannot drop it. |
| `scheduler-utils.ts` | **Pure logic**: available/scheduleable filtering + sort (`isTaskScheduleable`, `nextTaskScheduleableFlag`), per-period queries, schedule/unschedule field updates, calendar grid builders, navigation (`navigateDate` clamps month and year onto the last real day, so the 31st and 29 Feb do not skip a period), overview-box assignment, `taskIdsForDragSchedule` (multi-drag selection payload). Unmet-dep check is `lib/available-tasks.ts`. Unit-tested in `scheduler-utils.test.ts`. To Do month Previous / Next uses the same stepper. |
| `project-network.ts` | **Pure glue**: `buildProjectNetwork()` selects "project" tasks (any in a dependency relation, or scheduleable with a duration), derives precedence edges, and runs the CPM solver (`lib/critical-path`); `toLayoutEdges()` adapts edges for `lib/graph-layout`. Shared by the Gantt + Graph views |
| `GanttView.tsx` | **Gantt document** (plain SVG): one row per task (orb + label), bars positioned by CPM earliest-start and sized by duration, dependency arrows, slack tracks, critical path. Click a row to open the task. Not editable |
| `DependencyGraph.tsx` | **Dependency document** (plain SVG): tasks as nodes with orbs, `dependencies` precedence as directed edges, layered left→right layout (`lib/graph-layout`), critical path. Click a node to select/open |
| `SchedulerTaskItem.tsx` | Draggable task row: photographed orb, title, duration/urgency/importance. Checkbox is outside other controls; × is a sibling (no button-inside-button). Used across funnel tabs |
| `PeriodCell.tsx` | Droppable bucket. Funnel grids: empty = reserved one-line furniture. Always: `variant="card"` drop cards. The title opens Schedule Card Detail; the body still schedules a selection |
| `schedule-card-detail.ts` | Pure rows for one card: at this grain, finer period, open Undone. A past card uses the same queue as the funnel cell. `pushCardWorkingQueue` / `dismissCardWorkingQueue` / `unscheduleCardWorkingQueue` / `finishCardInPeriod` keep the placement. Push may stamp optional `missReason` on the card placement. Dismiss does not. Unit-tested in `schedule-card-detail.test.ts` |
| `ScheduleCardDetail.tsx` | That card, full width, with × to close. **Open list** jumps to Lists on `To do 8/31-9/6` (the period's full list). A past card offers Push to this period, Mark done, Dismiss, and Unschedule |
| `PeriodFunnelTab.tsx` | Generic Year/Month/Week tab (sidebar list + reserved child-period rows; Deselect / Delete / Mark complete when the shared selection is non-empty). Title opens the card; drop on the sidebar returns the task to the parent period |
| `AlwaysTab.tsx` | Always tab: available list + two columns of drop cards (This Year … Tomorrow, Eventually / Later). Selection tools: Deselect all, Remove from Scheduler, Delete, Mark complete. Drop on Available Tasks clears the period |
| `DayTab.tsx` | Day tab: day task sidebar + `DayAgenda`. The agenda title opens that day |
| `DayAgenda.tsx` | 24-hour agenda; empty hours stay reserved; occupied hours hold orb rows |
| `SchedulerFilters.tsx` | Collapsible "Filters & Sort" for the Always inbox |

### Scheduler views

A **toolbar** (not a second instrument) switches the main area between three views:

| View | Component | Shows |
|------|-----------|-------|
| **Funnel** (default) | period keys | Always / Year / **Season** / Month / Week / Day buckets. Season is a lens of the quarter's three months (`lib/seasons.ts`); it is not a `SchedulePeriod` and does not write a quarter placement. |
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
| `scheduledWeek` | Week (Monday–Sunday `getWeekString`). Month-grid cells use that same key. An older Sunday-start range still matches it (`sameWeekKey`). |
| `scheduledDate` + `scheduledTime` | Day |
| `schedulePlacements` | Prior placements after automatic roll-up (gray past cells) |

## Visibility rules

A task appears in the Scheduler's available inbox when `isTaskScheduleable`
says so. The switch is labeled **Send to Scheduler**. The stored field is still
`scheduleable`. A list includes its items only when that flag is `true`. Omitted
and `false` stay out, so a new list — including a list of tasks, the Next
Actions to-do lists, and a trip itinerary — is not in the Scheduler until
someone turns **Send to Scheduler** on. Dates, deadlines, and must-be-done-before
do not do this. Item-type **Scheduling fields** (`capabilities.scheduleable`)
only shows the Scheduling tab. `scheduleable: true` on the item forces it in
even when its lists are off. `false` hides it. `undefined` inherits from lists.
Item detail's **Send to Scheduler** switch on the Scheduling tab writes that
override (off → `false`; on → inherit when a list is already sent, else `true`).
The `eventually` list is created with the flag on on purpose: it is the holding
list for Eventually / Later. Persist v15 turns the flag off on lists a module
created (`createdByModuleId`). Lists a person already sent stay sent.

The **Always** overview shows tasks at their stored schedule level only (`taskBelongsInOverviewBox` in `lib/item-utils.ts`).

**Today** and **Tomorrow** store the local calendar date that was true when the task was dropped (`formatLocalDateKey`, not UTC). The next day, yesterday's Tomorrow is Today, because that date is now today. An unfinished period that has ended is settled by `rollUpExpiredSchedules` (`useDayScheduleRollover` on `app/page.tsx`). **Auto-push off** (the default): roll up one level on the funnel — day → that week, week → that month, month → that year, year → fully unscheduled — without incrementing push counters. **Auto-push on** (`autoPush` in item detail): push the same grain onto the next To Do period (week 1 → week 2) and increment that push counter. A year-only schedule still rolls off. Either way the ended period stays on `schedulePlacements`. A past funnel cell is that period's Undone queue: unfinished work still assigned there, including a month assignment that surfaces in each past week of that month. Handling a week also settles that coarser placement, so the same row leaves the other weeks of the month. Handled rows leave the cell. Home → To Do **Undone** still lists a period unless it was discarded. An explicit push and auto-push mark that placement `resolved: "pushed"`, which drops it from the Scheduler queue and leaves it on the Undone list. Push from a past card assigns the current period of that same size (a past week goes to this week) and increments the push counter. **Mark done** stamps completion at noon on the period's last day, so the work counts as Done in that period and leaves its Undone list. **Dismiss** and **Unschedule** mark `resolved: "clarified"`: the Scheduler queue for that period is finished, the Undone list still has the row, and the live fields stay on Dismiss. Unschedule clears the live period so the task returns to Always. Roll-up leaves `resolved` unset, so the card can still triage it. A push that already wrote a current or future period is not moved again. Done and missed rows stay out of the queue. Discard on Home → To Do sets `resolved: "discarded"` and drops that period from the Undone list. Persist v16 records an unresolved placement for each live assignment whose period has already ended, without clearing those fields.

Past days (Week tab), past weeks (Month tab), and past months (Year tab) render as gray furniture (`.sch-bucket.is-past`): muted type, darker fill, still readable and still droppable. Today / the current week / current month are never past. Rows that appear only because of `schedulePlacements` (or a live assignment that never rolled) can still be **×**-dismissed or **dragged** onto a current/future bucket: × removes that cell's placement (and rolls a still-live past assignment up one level without re-pinning the cell); drag sets the live period and drops only the placement for the cell you left. Other history placements stay for analytics. Removing history alone does not award a schedule point; moving onto a new live bucket awards the normal +1 when the period actually changes.

**Eventually / Later** does not set a period. The first drop creates a Next Actions list named `eventually` (`lib/eventually-list.ts`) and files the task there. Those tasks leave the available inbox until you schedule them (which removes the list) or send them back with the row's ×.

## UI structure

1. **CRT title** — human caption (`Scheduler — Funnel` / Gantt / Dependencies) plus a title orb on black glass.
2. **Toolbar** — equal **Funnel / Gantt / Dependencies** keys (active = CRT + power lamp). Period metal chevrons + nameplate date when the funnel is not on Always.
3. **Address** — engraved nameplate + path well (`Funnel \ Always`, or Year/Month/Week/Day + the current period label). An open card appends its title.
4. **Period keys** — Always, Year, Month, Week, Day in one equal-fill bay. Only on Funnel. Not a second view-mode row.
5. **Available Tasks** — inbox of unscheduled work (not on the eventually list); drag into cards. With a selection: **N selected**, **Deselect all** (clears checks only), **Remove from Scheduler** (`scheduleable: false`), **Delete** (confirm + tombstone), **Mark complete** (quiet batch via completion service; no popup stack).
6. **Always cards** — two columns (This Year, This Month, Next Month, This Week, Next Week, Today, Tomorrow, Eventually / Later). Empty cards say Empty. Today and Tomorrow show the real date under the title. Year / Month / Week grids stay one-line furniture. Dragging a selected task onto a card schedules the whole selection. Clicking the card body does the same. Each task that **changes** period bucket awards **1 point** (`lib/schedule-credit.ts`); Eventually / Later and same-bucket re-drops do not.
7. **Schedule Card Detail** — the card title (and the Day agenda title) replaces the board to the right of the broader list. **Open list** opens Lists on that period's To do list (`To do 8/31-9/6` for the week of those dates; day is `To do 8/31`, month is `To do September 2026`). The file manager is on List view and the list opens in the full default item list. Eventually / Later has no list. × closes the card. A current card lists **At this period**, **Finer period**, and **Undone** (past work inside the span that is not completed, pushed, or dismissed). A past card is only that Undone queue: **Push to this week/month/day** (assigns the current period of that size, marks the placement pushed, and can store an optional why on that placement; Skip still pushes), **Mark done** (completes it inside the period; this is the action that leaves the Undone list), **Dismiss**, and **Unschedule** (clears the live period back to Always). Dismiss and Unschedule mark `resolved: "clarified"`. Drag from the detail onto the left list returns the task to the broader period (Always returns it to the unscheduled inbox) and does not delete the history. Drag onto the detail assigns the card's period. Changing period tab or the period date closes the card.
8. **Status** — available / scheduled counts, or the open card's title.

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
| Lists period lists | `To do 8/31-9/6`, plus `Done` and (after the period ends) `Undone` for that span. Open list on a card, or Open list on Home → To Do, opens the To do list |

## Related libs

| File | Purpose |
|------|---------|
| `lib/critical-path.ts` | Pure CPM + PERT solver (`computeCriticalPath`, `taskDuration`); unit-tested |
| `lib/graph-layout.ts` | Layered (topological) node layout + `boundingBox` for the dependency graph |
| `lib/scheduling.ts` | Scheduling field helpers shared across panels |
| `lib/schedule-credit.ts` | +1 point per changed period placement (not Eventually / same-bucket / unschedule) |

## Not implemented

- Auto-scheduling with constraint solving (§7.6).
- Event-linked checklists on calendar events.
- Editable Gantt / commitment budget (later haunted mechanics).
