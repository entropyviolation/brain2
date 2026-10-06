# `components/Home/ToDo/` — To-Do Panel

The Home **To Do** sub-tab in **Brain2**. Day / week / month scoped task lists, plus a **Season** lens, under a milled fascia (CRT title, period nameplate, Day/Week/Month/Season keys, **Open list** on day/week/month, Show / Sort / Pace bays — Habits brushed metal, CRT glass, milled keys with room to breathe) and a readable instrument strip.

The **day** lens is Home’s selected day (`currentDate` / `setCurrentDate` from the dashboard). Previous day, next day, and Today on that nameplate call `setCurrentDate`, so the overview, Plan, and Tracking move with it. Week, month, and season nameplates keep a local date inside To Do. Previous, next, and Today on those nameplates do not call `setCurrentDate` and do not move Plan or Tracking. Until a coarse nameplate is used, that lens shows the period that contains the shared day. Leaving To Do forgets a paged week, month, or season; the shared day stays with Home.

**Open list** opens that period's To do list in Lists (`To do 8/31`, `To do 8/31-9/6`, `To do September 2026`). Season lists open tasks (active or partial) whose day, week, or month already falls in the quarter (`lib/seasons.ts`); missed, cancelled, deferred, and done stay off that list. Adding a task there schedules the first month of the quarter. There is no quarter placement on the period ledger. The same folder also holds **Done** and, once the period has ended, **Undone** — the same rows as this panel. Default sort is **priority**; prioritized Assigned rows always lead. Language: [`docs/DESIGN_STYLE.md`](../../../docs/DESIGN_STYLE.md#milled-fascia).

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

This room writes items on **`lib/task-store.ts`** (`addTask`, `updateTask`, `deleteTask`, `updatePriorityWeights`). Done and missed go through `completeTask` and `markMissedOpportunity`. Push goes through `pushTask`. Confirming an assumed Done time goes through `confirmTaskTimes`. **Log done** also calls `usePointsStore.addPoints`. A day **Prioritized** mark, when that day’s morning review already exists, saves `priorityTaskIds` with `useReviewsStore.saveMorningReview`. Show, pace, and lid prefs stay in `todo-prefs.ts`. The live persist key is `brain2-todo-prefs` (`persistKey("todo-prefs")`). `cogs-todo-prefs` is the legacy alias.

These stay inside the room. Nothing outside this folder imports them: `TodoTable`, `TodoBreakdown` (`TodoLidSection`, `TodoDeleteButton`), `TodoLoadPanel`, `TodoPeriodNav`, `todo-filters`, `DoneTodoSection`, `MissedTodoSection`, `UndoneTodoSection`, `AddTodoDialog`, `AddDoneDialog`, `CompletionTimeLine`, `todo-prefs.ts`, `todo-chrome.css`, and every other export of `todo-utils.ts`.

## Files

Split (orchestrator pattern) so the orchestrator stays small and the tier/Q-I/
build/filter logic is unit-testable.

| File | Purpose |
|------|---------|
| `todo-panel.tsx` | **Orchestrator** (`data-ui-name="To Do"`). Names mode also stamps the inner desks: **To Do fascia**, **Period nameplate** (season nav here; day/week/month on `TodoPeriodNav.tsx`), **Period keys**, **Period sheet**, **Season list**, **Morning priorities**, **Required**, **Assigned**, **Assigned composer**, **WIP warning**, **Priority formula**, **Status bar**, **To Do plate**. Milled fascia — CRT **To Do** + open count, period nameplate, **Open list**, **Add Task**, Day/Week/Month/Season keys, Show / Sort / Pace — then the list stage (full width), WIP lace warning, status bar, task detail popup. **Open list** opens Lists on that period's To do list. Under the window, on the page scroll, the title jewel (`orbFor("home-todo")`, the dove) sits at photograph size (`.todo-desk-plate`) so the bottom of the desktop is that picture. Day tab shows **Morning priorities** (3–5 ids from today's morning review). Open rows share **one ledger**: Required (gunmetal/pearl band) then Assigned. Completing a row is Cmd/Ctrl-Z undoable via `completeTask` → `lib/action-history.ts`; the completion popup **Undo** also reopens the row. **Missed opportunity** (`markMissedOpportunity`) is the too-late twin: same undo stack, no points, no completion popup. Period tab change uses a short fold (skipped under `prefers-reduced-motion`). |
| `todo-filters.tsx` | Always-visible **Show / Sort / Pace** bays (`data-ui-name="Show / Sort / Pace"`, inline on the fascia): Available now, Show all, Status, Sort + direction, Formula, in-progress cap |
| `todo-prefs.ts` | Persisted To Do prefs (live key `brain2-todo-prefs`, legacy alias `cogs-todo-prefs`): `availableNow` (default off), `wipLimit` (default 3), `lidCollapsed` (flags / time / steps, default all open) |
| `todo-chrome.css` | `.todo95` cool silver fascia (a whisper of grain), wrapping load strip (Casio / comfort needle / scope lamps / POWER lamp / via channel), one cool ledger well, short rounded task cards, padded names, clamshell lids, rounded step cards, Done/Missed/Undone aftermath wells, `.todo-desk-plate`, status bar, `.todo95-dialog` |
| `todo-utils.ts` | **Pure helpers**: `getTierFromTask`, `tierToUrgencyImportance`, `createScheduledTodoTask`, `getScheduleLabel`, `buildTodoItems` (drops done **and** missed), `buildDoneTodoItems` (`countsInDone`: Tasks **or** implied-action logs), `buildMissedTodoItems` (too-late rows by `missedAt`), `buildUndoneTodoItems` (past periods: each missed period on its own, including after a later push), `filterAndSortTodos`, `filterTodosByStatus`, `filterTodosAvailableNow` (`lib/available-tasks` unmet-dep predicate), `toggleTodoActiveLamp` (active ↔ partial; both stay on Open), `countInProgress` / `formatWipWarning`, overdue from `priorityDateOf`, `pinPrioritizedFirst`, plus the `priority` sort path (`computePriorityScore` from `lib/priority.ts`) and `TodoSortMode` (`"tier"` \| `"priority"`). Unit-tested in `todo-utils.test.ts` |
| `TodoTable.tsx` | Closed rows: padded name, nixie tier **menu** (A+…D, not a cycle), active lamp (toggles active ↔ partial), completion percent (`todoCompletionPercent`, 0 when nothing is finished), step chip, engraved **Done / Start / Push / Delete**. Click / Enter opens one clamshell lid. The header name is the only edit field. **Flags** (Required / Prioritized / Missed / View, right-aligned), **Time**, and **Steps** each fold; the choice persists in `lidCollapsed`. Keyboard: arrows, D/M/P/R, Enter, Esc (ignored while focus is in an input or select). |
| `TodoBreakdown.tsx` | Inside the open lid (`data-ui-name="Steps"`): **Time** is one segmented control (+15, −5, 5, 15, 30, 60) with the minutes field beside it; **counts** and **0/n · n%** sit on their own readout row. **Steps** are a separate fold of rounded cards (via pad still marks parent / leaf). A step with children has a chevron that hides those cards and its nested stylus; the fold is local and starts open. Minutes that count = greater of typed estimate and nested sum. Empty Enter / Shift+Enter / paste-lines for sibling depth. Optional "Ask the glass" local first-step prompt (no network). `TodoLidSection` is the shared fold. |
| `TodoLoadPanel.tsx` | Period load strip (`data-ui-name="Period load"`): Casio LCDs (days left on week / month / season only, working hours, **Est hours of work remaining**), Hofstadter comfort needle, scope latch lamps, in-progress POWER lamp, Habits `PercentLedBar` for estimate vs working hours. Unestimated count scrolls the first bare task open. |
| `AddTodoDialog.tsx` | "Add Task" dialog (`data-ui-name="Add Task"`; description, tier) — kept; Assigned also has a foot composer that uses the same `createScheduledTodoTask` factory |
| `DoneTodoSection.tsx` | Collapsible Done list (`data-ui-name="Done"`) for the focused period (Tek green well); header pairs with Missed (same height) and carries a milled **Log done** key plus the assumed-time chip |
| `MissedTodoSection.tsx` | Collapsible Missed opportunities list (`data-ui-name="Missed"`, Sony-editor red well) for the focused period |
| `UndoneTodoSection.tsx` | Collapsible **Undone** list (`data-ui-name="Undone"`) on a past day / week / month: cool lace well, push plasma tube, Assimilate / Push / Discard |
| `AddDoneDialog.tsx` | "Log done" (`data-ui-name="Log done"`) — retroactive capture of unplanned work |
| `CompletionTimeLine.tsx` | The per-row time line: clock window, duration, the **est.** chip that confirms or corrects an assumed time in place, a quiet **Est.** when the person marked `timeRough`, and a read-only **usually ~N** glance from peer `actualDuration` / `timeLogs` (`usualDurationMinutes`; does not rewrite `estimatedDuration`) |

## Instrument layout

The page scrolls. Fascia, load strip, ledger, Done/Missed/Undone, and the huge dove desk plate are one document under the fixed app shell — there is no sticky `100dvh` trap and no right-hand dove well. The ledger is a cool silver well (`#c8ccd0`). Each task is a short rounded card (`#e6e8eb`, 8px) with a small gap; the open card lightens to `#eef0f3`. Task names sit inset from the row start. Accents are ice, violet, and rose — tier nixie, in-progress lamp, over-cap lamp, missed verb — on the same cool metal. The load strip wraps equal-height cells when the full-word lamps will not fit one line (scope faces read **All assigned** / **Required** / **Required + prioritized**). The day lens omits **Days left**; week, month, and season keep it. Clock hours stay in the working-hours tooltip. Closed rows pad the task name and keep the verb keys **Done / Start / Push / Delete**. The open lid has one name (the header field), then Flags / Time / Steps, each collapsible. One clamshell lid open at a time (season too). The dove (`.todo-desk-plate`) is near window width under the list — still `object-fit: contain`, still on the page scroll.

## Data

All tasks come from **`lib/task-store.ts`**. The panel derives display rows from scheduling fields:

| Tab | Filter |
|-----|--------|
| Day | `taskScheduledOnDay` on Home’s selected day |
| Week | `taskScheduledInWeek` for the local week, or the week that contains the selected day until that nameplate is used |
| Month | `taskScheduledInMonth` for the local month, or the month that contains the selected day until that nameplate is used |
| Season | Open tasks (active or partial) whose day, week, or month falls in the quarter (`taskTouchesQuarter`). Missed, cancelled, deferred, and done stay off the list and out of the season estimate. |

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

Steps live in the open lid’s **Steps** fold (default open). Each step is a rounded card. A via pad still marks a parent (snowflake) or a leaf. A step that has children shows a chevron and a count; folding it hides those cards and the stylus under that step. The fold starts open and stays on that card only. While a card is open, the next empty stylus line is waiting: Enter commits and focuses a deeper line; empty Enter steps back; Shift+Enter stays at this depth; paste of several lines creates that many steps. **Time** is one segmented control: +15, −5, and 5/15/30/60 write the typed estimate; the minutes field sits beside that control. **counts Nm** and the step readout (`0/2 · 0%`) sit in a CRT chip beside that control, with a gap, not inside the keys. The nested sum still wins when heavier. Checking a step does not check its parent. `hiddenFromTodo` is unchanged for tasks already hidden; the row no longer offers Hide.

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
| Open-list **Push** | `pushTaskOnePeriod` — next day, week, or month from the live period, plus that period on `schedulePlacements` |
| Undone **Push** | Next period of that grain that is still open |
| Review carry-over / review **Push** | `pushFieldsForReviewPeriod` (day / week / month go through `pushTaskOnePeriod`) |
| Message ingest ritual push | `pushTaskOnePeriod` |
| **Auto-push** | When the period ends, if item detail **Auto-push** is on (default off). Same grain: week 1 unfinished becomes Undone for week 1 and scheduled (`scheduledWeek`) for week 2. Each missed day or week on the way is recorded, and the push counter increments. Off: the unfinished period rolls to the coarser list instead, still Undone for the period that ended, and the push counter does not increment. |

Missed, cancelled, hidden, and discarded placements stay out of Undone. The status bar adds `N undone` on a past period. Those rows are not repeated in that period's open table.

**Add Task** creates a real task via `createScheduledTodoTask()` + `addTask()`, scheduled to the active tab at the currently-focused date: day → `scheduledDate` (the focused day), week → `scheduledWeek`, month → `scheduledMonth` (local `YYYY-MM` via `getMonthKey`, the same key the month filter uses). Week/month tasks are assigned to that period's list only — no specific day is pinned. The chosen **tier** maps to `urgency`/`importance` via `tierToUrgencyImportance`. Plan's day sidebar uses the same factory, so items added there show up here unchanged. The Assigned foot composer writes the same path; matching an existing name offers that row instead of a duplicate.

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
(`lib/estimated-values.ts` holds the flag; `CompletionTimeLine` renders it). The
chip's tooltip spells out the basis — "4 pages × 10 min each" — and clicking it opens an
inline editor for the finish time and duration. A separate **Est.** mark
(`Task.timeRough`, set in the ritual's assumed-times row) means the person treats
the duration or the start as a rough estimate even after the app's guess is
confirmed. The check button next to the chip accepts
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

## Completion status (Feature 9)

Each row has an **active lamp** (`toggleTodoActiveLamp`). It toggles **active** ↔ **partial**. Both stay on the default **Open** list, so turning the lamp off and on again does not hide the row. Deferred, cancelled, missed, and done are not on that click — a row already in one of those statuses returns to active. Set the rest from item detail. **Done** and **Missed** stay engraved verb keys (and keyboard D / M). The header **Status** filter (Show bay) narrows the lists by lens — `Open` (active+partial, the default), `Active & available` (open and dependency-unblocked), a single status, or `All`.

The closed-row percent is step completion (`todoCompletionPercent` in `lib/todo-steps.ts`). No steps, or none finished, reads **0%**. It is not the estimate as a fraction of an 8-hour day (30 minutes used to read 6%). Minutes stay a separate `Nm` label.

## Available now (#253)

**Show → Available now** (default **off**, persisted in `brain2-todo-prefs`, legacy alias `cogs-todo-prefs`) hides rows with unmet `dependencies`. The predicate is `lib/available-tasks.ts` — same as Scheduler: a dep blocks only when that task exists and is still open work (not done, not missed). Ghost ids do not hide the row. This is independent of the Status lens.

## WIP warning (#19)

**In progress** = `status === "partial"` (started, not done). Soft cap defaults to **3**, editable in the Pace bay. When the count exceeds the cap, a lace phosphor warning says `N in progress (cap M) — warning only, not a block`, and the load-strip POWER lamp warms. No hard stop, no auto-reschedule.

## Overdue and the priority date

An open row shows `waiting Nd` from the **priority date**: the earlier of the live scheduled day and the start of the earliest Undone period (`priorityDateOf` in `lib/scheduling.ts`), or an earlier deadline when one exists. Pushing the task onto a later day does not wipe how long it has already been waiting. The same date fills the row’s week and month overdue counts. Regret uses a deadline or `mustBeDoneBefore` first; with neither, it uses this priority date. The Priority sort itself stays the urgency / importance / quick-win / entropy formula.

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

- **Show / Sort / Pace** — always on the fascia: Available now, Show all tasks, Status, Sort + direction, Formula, in-progress cap.
- **Show all tasks** — includes unscheduled tasks when enabled.
- Collapse long lists after 8 rows with "Show more".

## Related

- Lists smart lists (Daily/Weekly/Monthly To Do) read the same `task-store` scheduling fields.
- Next Actions also auto-manages **Completed** and **Missed Opportunities** lists (`na-smart-completed` / `na-smart-missed`) as real lists in that folder (open them from the tree).
- Scheduler funnel assigns the underlying schedule; this panel is the execution view.
