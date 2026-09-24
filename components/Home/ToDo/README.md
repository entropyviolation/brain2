# `components/Home/ToDo/` — To-Do Panel

The Home **To Do** sub-tab in **Brain2**. Day / week / month scoped task lists under a milled fascia (CRT title, period nameplate, Day/Week/Month keys, Show / Sort / Pace bays) and a packed list well. Same tier sort, overdue labels, and push-to-next-period actions as before. Language: [`docs/DESIGN_STYLE.md`](../../../docs/DESIGN_STYLE.md#milled-fascia).

## Files

Split (orchestrator pattern) so the orchestrator stays small and the tier/Q-I/
build/filter logic is unit-testable.

| File | Purpose |
|------|---------|
| `todo-panel.tsx` | **Orchestrator** (`data-ui-name="To Do"`): milled fascia — CRT **To Do** + open count, period nameplate, **Add Task**, Day/Week/Month keys — then the list well, WIP warning, status bar, task detail popup. Under the window, on the desktop, the same title jewel (`orbFor("home-todo")`, the dove) sits at photograph size (`.todo-desk-plate`) so the bottom of the scroll is that picture on the field. Day tab shows **Morning priorities** (3–5 ids from today's morning review). Completing a row is Cmd/Ctrl-Z undoable via `completeTask` → `lib/action-history.ts`; the completion popup **Undo** also reopens the row. **Missed opportunity** (`markMissedOpportunity`) is the too-late twin: same undo stack, no points, no completion popup. |
| `todo-filters.tsx` | Always-visible **Show / Sort / Pace** bays: Available now, Show all, Status, Sort + direction, Formula, in-progress cap |
| `todo-prefs.ts` | Persisted To Do prefs (`cogs-todo-prefs`): `availableNow` (default off) + `wipLimit` (default 3) |
| `todo-chrome.css` | `.todo95` milled fascia (title CRT, period nameplate, view keys, Show/Sort/Pace bays) + packed list well, Done/Missed fieldsets, status bar, `.todo95-dialog`. `.todo-desk-plate` is the title jewel at photograph height on the desktop under the window (no frame). |
| `todo-utils.ts` | **Pure helpers**: `getTierFromTask`, `tierToUrgencyImportance`, `createScheduledTodoTask`, `getScheduleLabel`, `buildTodoItems` (drops done **and** missed), `buildDoneTodoItems` (`countsInDone`: Tasks **or** implied-action logs), `buildMissedTodoItems` (too-late rows by `missedAt`), `filterAndSortTodos`, `filterTodosByStatus`, `filterTodosAvailableNow` (`lib/available-tasks` unmet-dep predicate), `countInProgress` / `formatWipWarning`, plus the `priority` sort path (`computePriorityScore` from `lib/priority.ts`) and `TodoSortMode` (`"tier"` \| `"priority"`). Unit-tested in `todo-utils.test.ts` |
| `TodoTable.tsx` | Packed well of period rows: native status/tier selects and mill keys (complete, **missed opportunity**, just start, push, view, hide) |
| `AddTodoDialog.tsx` | "Add Task" form (description, tier) |
| `DoneTodoSection.tsx` | Collapsible Done list for the focused period, with the "Log done" shortcut and a count of rows still carrying an assumed time |
| `MissedTodoSection.tsx` | Collapsible Missed opportunities list for the focused period (too late, not done) |
| `AddDoneDialog.tsx` | "Log done" — retroactive capture of unplanned work |
| `CompletionTimeLine.tsx` | The per-row time line: clock window, duration, the **est.** chip that confirms or corrects an assumed time in place, and a read-only **usually ~N** glance from peer `actualDuration` / `timeLogs` (`usualDurationMinutes`; does not rewrite `estimatedDuration`) |

## Data

All tasks come from **`lib/task-store.ts`**. The panel derives display rows from scheduling fields:

| Tab | Filter |
|-----|--------|
| Day | `taskScheduledOnDay(task, today)` |
| Week | `taskScheduledInWeek(task, getWeekString(today))` |
| Month | `taskScheduledInMonth(task, YYYY-MM)` |

**Add Task** creates a real task via `createScheduledTodoTask()` + `addTask()`, scheduled to the active tab at the currently-focused date: day → `scheduledDate` (the focused day), week → `scheduledWeek`, month → `scheduledMonth`. Week/month tasks are assigned to that period's list only — no specific day is pinned. The chosen **tier** maps to `urgency`/`importance` via `tierToUrgencyImportance`. Plan's day sidebar uses the same factory, so items added there show up here unchanged.

The header **today's friend** does **not** only read this day's To Do slice. Species that lean To Do (puppy, foal, kitten, …) prefer it; others still can pick it when that pool is what is open. Hedgehogs lean daily habits; crows lean the whole **Next Actions** folder tree (`lib/friend-suggestion.ts`). Completed **and missed-opportunity** rows stay out. Click the friend again for a different suggestion; Escape, the bubble ×, or a click outside closes it. Plan: [`docs/FRIEND_COMPANION.md`](../../../docs/FRIEND_COMPANION.md).

**Done** (`buildDoneTodoItems`) lists completions that `countsInDone`: Tasks **or** implied-action / habit logs (`type: "action"` / `loggedAction`). Increasing a Book’s pages read can appear here without the book itself being a daily Task. Completing a daily (or weekly/monthly) habit in the Habits grid writes the same kind of Done row (`lib/habit-done-log.ts`) for that calendar day, so it shows under Done today / this week / this month. Stopping **Working on this now** on an Operation writes `worked on {name}` the same way (`lib/operation-work-session.ts`), with the observed clock window from the live session.

**Painting the Tracking grid can write Done rows too.** A pen carrying a **default action format** turns each painted block into a row here — paint 1:00–1:15 of *Walking* and "Went for a walk" appears under Done today, named from the pen's template and filled in from the block (duration, clock, location, project). The rows are ordinary completed logged actions with deterministic ids (`pen-action-<entry or span id>`), so `lib/pen-action-sync.ts` upserts rather than duplicates them: retime or delete the block and the row follows. **Renaming the row here is permanent** — the sync only rewrites a title it still recognises as its own, so an edited name survives every later change to the block. See [`docs/PEN_ACTION_FORMATS.md`](../../../docs/PEN_ACTION_FORMATS.md). A Tracking pen with a **default action format** logs a painted block the same way (`lib/pen-action-sync.ts`) — "Went for a walk" from a Walking block — and `todo-panel` mounts `usePenActionSync` so Done today stays in step even if Tracking is not open.

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
(`lib/estimated-values.ts` holds the flag; `CompletionTimeLine` renders it). Its
tooltip spells out the basis — "4 pages × 10 min each" — and clicking it opens an
inline editor for the finish time and duration. The check button next to it accepts
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

## Tier system & sorting

Tier (A+ through D) is computed from urgency + importance on each task. Two sort modes (`TodoSortMode`) are available:

- **`tier`** (default) — sorts by tier, then by push count for the active period.
- **`priority`** — re-orders by the transparent priority formula in `lib/priority.ts` (`computePriorityScore`).

## Completion status (Feature 9)

Each row has a **Status** select (active / partial / deferred / cancelled / missed opportunity / done) backed by `Task.status`. Changes persist through `useTaskStore.updateTask`, with the legacy `completed` flag kept in sync by `lib/completion-status.ts` (invariant: `status === "done"` ⇔ `completed === true`). **Missed opportunity** means too late: the row leaves this open list and the Next Actions to-do lists, and lands on the automatic **Missed Opportunities** list (and the collapsible below Done). The header **Status** filter (Show bay) narrows the lists by lens — `Open` (active+partial, the default), `Active & available` (open and dependency-unblocked), a single status, or `All`.

## Available now (#253)

**Show → Available now** (default **off**, persisted in `cogs-todo-prefs`) hides rows with unmet `dependencies`. The predicate is `lib/available-tasks.ts` — same as Scheduler: a dep blocks only when that task exists and is still open work (not done, not missed). Ghost ids do not hide the row. This is independent of the Status lens.

## WIP warning (#19)

**In progress** = `status === "partial"` (started, not done). Soft cap defaults to **3**, editable in the Pace bay. When the count exceeds the cap, a phosphor warning says `N in progress (cap M) — warning only, not a block`. No hard stop, no auto-reschedule.

## Overdue

For day-scoped items, overdue days/weeks/months are computed from `scheduledDate` vs. today.

## Actions per row

| Action | Effect |
|--------|--------|
| Complete | Marks task done in store; it leaves this list and appears under Done / Lists **Completed** |
| Missed opportunity | Marks the task too late; it leaves this list and appears under Missed opportunities / Lists **Missed Opportunities**. No points. |
| Push | `pushTaskOnePeriod()` — moves schedule forward one period |
| Hide | Sets `hiddenFromTodo` |
| Click row | Opens `TaskDetailPopup` |

Wave 13 (GS-9) keeps this click as goal-complete and adds a grade so partial
work is credited. The checkbox stays.
[`docs/ScienceandSanityBrain2.md`](../../../docs/ScienceandSanityBrain2.md).

## Options

- **Show / Sort / Pace** — always on the fascia: Available now, Show all tasks, Status, Sort + direction, Formula, in-progress cap.
- **Show all tasks** — includes unscheduled tasks when enabled.
- Collapse long lists after 8 rows with "Show more".

## Related

- Lists smart lists (Daily/Weekly/Monthly To Do) read the same `task-store` scheduling fields.
- Next Actions also auto-manages **Completed** and **Missed Opportunities** lists (`na-smart-completed` / `na-smart-missed`) as real lists in that folder (open them from the tree).
- Scheduler funnel assigns the underlying schedule; this panel is the execution view.
