# `components/Home/ToDo/` — To-Do Panel

The Home **To Do** sub-tab. Day / week / month scoped task lists with tier-based sorting, quarterly/importance flags, overdue indicators, and push-to-next-period actions.

## Files

Split (orchestrator pattern) so the orchestrator stays small and the tier/Q-I/
build/filter logic is unit-testable.

| File | Purpose |
|------|---------|
| `todo-panel.tsx` | **Orchestrator** (~340 lines): Day/Week/Month tabs, sort/status/show-all controls, state + store handlers, task detail popup |
| `todo-utils.ts` | **Pure helpers**: `getTierFromTask`, `tierToUrgencyImportance`, `getScheduleLabel`, `buildTodoItems`, `filterAndSortTodos`, `filterTodosByStatus`, plus the `priority` sort path (`computePriorityScore` from `lib/priority.ts`) and `TodoSortMode` (`"tier"` \| `"priority"`). Unit-tested in `todo-utils.test.ts` |
| `TodoTable.tsx` | Per-period tier-sorted table with inline tier/status selects and row actions |
| `AddTodoDialog.tsx` | "Add Task" form (description, tier) |

## Data

All tasks come from **`lib/task-store.ts`**. The panel derives display rows from scheduling fields:

| Tab | Filter |
|-----|--------|
| Day | `taskScheduledOnDay(task, today)` |
| Week | `taskScheduledInWeek(task, getWeekString(today))` |
| Month | `taskScheduledInMonth(task, YYYY-MM)` |

**Add Task** creates a real task via `addTask()` scheduled to the active tab at the currently-focused date: day → `scheduledDate` (the focused day), week → `scheduledWeek`, month → `scheduledMonth`. Week/month tasks are assigned to that period's list only — no specific day is pinned. The chosen **tier** maps to `urgency`/`importance` via `tierToUrgencyImportance`.

## Tier system & sorting

Tier (A+ through D) is computed from urgency + importance on each task. Two sort modes (`TodoSortMode`) are available:

- **`tier`** (default) — sorts by tier, then by push count for the active period.
- **`priority`** — re-orders by the transparent priority formula in `lib/priority.ts` (`computePriorityScore`).

## Completion status (Feature 9)

Each row has a **Status** select (active / partial / deferred / cancelled / done) backed by `Task.status`. Changes persist through `useTaskStore.updateTask`, with the legacy `completed` flag kept in sync by `lib/completion-status.ts` (invariant: `status === "done"` ⇔ `completed === true`). The header **Status** filter narrows the lists by lens — `Open` (active+partial, the default), `Active & available` (open and dependency-unblocked), a single status, or `All`.

## Overdue

For day-scoped items, overdue days/weeks/months are computed from `scheduledDate` vs. today.

## Actions per row

| Action | Effect |
|--------|--------|
| Complete | Marks task done in store |
| Push | `pushTaskOnePeriod()` — moves schedule forward one period |
| Hide | Sets `hiddenFromTodo` |
| Click row | Opens `TaskDetailPopup` |

## Options

- **Show All Tasks** — includes unscheduled tasks when enabled.
- Collapse long lists after 8 rows with "Show more".

## Related

- Lists smart lists (Daily/Weekly/Monthly To Do) read the same `task-store` scheduling fields.
- Scheduler funnel assigns the underlying schedule; this panel is the execution view.
