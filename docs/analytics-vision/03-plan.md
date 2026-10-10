# Plan — analytics vision

What an Analytics view of **Plan** should be able to say, using the records Plan actually keeps.

Plan is a calendar of intentions at several grains, plus a written log for the day, week, month, and season. It is not a record of what was lived. The hour grid can outline tracked time, and a header “followed / skipped” path can stamp a task, but those outcomes are not fields on a calendar event or a planned-action block. This document stays inside Plan’s own entities, names the formulas in plain language, and marks every place a true “what happened” number would need a later join.

Four writings make up the domain:

| Writing | Store | What one row is |
|---|---|---|
| Calendar event | `lib/event-store.ts` → `brain2-event-storage` | One titled span on the calendar. Opalescent chip. Add Event, hour click, or Paste Events. |
| Planned action | `lib/planned-action-store.ts` → `brain2-planned-actions` | One timed intention on one local day. Dashed linen chip. Add Plan, empty-agenda drag, or a rail drop. |
| Period plan text | `lib/plan-text.ts` + `lib/append-log.ts` | Immutable stamped paragraphs for a day, week, month, or season, plus one unsubmitted draft. |
| Scheduled item | `lib/task-store.ts` | The live period assignment (`scheduledDate` / `scheduledTime` / `scheduledWeek` / `scheduledMonth` / `scheduledYear`) and the history of periods left unfinished (`schedulePlacements`). The Scheduler funnel and the Plan rail read the same fields. |

Habits, sleep, reviews, and modules are neighbors. They show up below only where a Plan record points at them, or where Plan’s own screen already treats them as part of the plan (the rail, the capacity line).

---

## 1. Data inventory

### 1.1 Grains

A grain is the thing you can count without inventing a row.

| Grain | Identity | Clock |
|---|---|---|
| Event | `CalendarEvent.id` | Local calendar `date`, optional inclusive `endDate`, `startTime` / `endTime` as `"HH:mm"` with no offset |
| Event-day | Derived: event × each local day in `[date, endDate]` | All-day and multi-day events occupy every day in the span. Timed single-day events occupy one day. |
| Planned action | `PlannedAction.id` | Exactly one local `YYYY-MM-DD` plus a start and end on that clock |
| Source placement | Derived uniqueness: `(date, source, sourceId)` for `todo` and `habit` | A second drop of the same to-do or habit **on the same day** moves the existing block. A drop on a **different** day can create another block. Free blocks never collapse. |
| Plan entry | `AppendLogEntry.id` inside one period key | `createdAt` is when the paragraph was submitted, not when the period happens |
| Plan draft | One string on that same key | Unsubmitted. No id, no stamp. |
| Live schedule | One task, one finest stored grain | Day beats week beats month beats year. Writing a finer grain clears the coarser fields. |
| Historical placement | `schedulePlacements[]` entry: `period` + `value` | A period the task sat on and did not finish. The row stays after the live fields move. |
| Rail intention | Not stored. Computed for the open day, week, or month | Untimed to-dos, undone habits, and workable next actions that have not been given a finer slot |
| Season | `YYYY-Qn` (Q1 Jan–Mar Spring through Q4 Oct–Dec Winter) | A written log and a three-month calendar lens. Not a `scheduled*` field. |

Local keys, everywhere:

- Day: `YYYY-MM-DD` from the local calendar (`formatLocalDateKey` / `toLocalCalendarDate`). Not UTC.
- Week: Monday–Sunday `YYYY-MM-DD_YYYY-MM-DD` (`getWeekString`). An older ISO `YYYY-Www` spelling is accepted on **read** of plan text and copied onto the Monday range. Week identity is Monday-start. The month grid’s column headers are Sunday-first. Those are different axes.
- Month: `YYYY-MM`. A legacy unpadded `YYYY-M` migrates on read.
- Season / quarter: `YYYY-Qn`.

### 1.2 Calendar event

`CalendarEvent` (`lib/types.ts`). Persisted as a flat list. Dates revive from ISO strings. `startTime` and `endTime` stay strings so they are not mistaken for timestamps.

| Field | Type | Meaning for analysis |
|---|---|---|
| `id` | string | Primary key. Add Event uses `Date.now()` as a decimal string. One Paste Events import uses one `Date.now()` base plus `-${index}` (`1710000000000-0`, `-1`, …). That shared prefix is the only batch trace, and it is an id convention, not a field. |
| `title` | string | Label. Paste may leave a prefix (`SHOW`, `MEETING`, `GOAL`, `RECORDING`, `HOLD`, `DRIVE`, `OFF`) which also picks a color. The prefix is not stored separately. |
| `date` | Date | Start day, normalized to local midnight. |
| `endDate` | Date, optional | Inclusive end day. Absent, or equal to `date`, means a single day. |
| `startTime`, `endTime` | `"HH:mm"` | Clock on the start day. All-day drafts are stored as `00:00`–`23:59`. |
| `isAllDay` | boolean, optional | Banner, not an hour-grid block. Capacity ignores it. |
| `type` | `"event" \| "task" \| "hardcoded"` | The Plan writers always save `"event"`. The other two values exist on the type and are not produced by Add Event, paste, or the hour grid. Do not build a series on them until a writer appears. |
| `taskId` | string, optional | Optional pointer from an event onto a task. The checklist feature does **not** use this field. It stores the link on the task. |
| `color` | string, optional | Hex wash. Default mint `#8cd4a5`. Presets: mint, sage, teal, moss, lilac, violet. A legacy peach `#e89b6c` displays as teal. Paste colors: SHOW teal, MEETING lilac, GOAL violet, RECORDING mint, HOLD sage, DRIVE moss, OFF gray, everything else mint. |
| `isScheduled` | boolean | Writers set `true` on create and on edit. Dropping an event back on the rail does **not** clear this flag. It sets `isAllDay: true` instead. Treat `isScheduled` as unused for “is this on the clock.” |
| `estimatedDuration` | number, optional minutes | On the type. The calendar does not fill it. Duration on screen is `endTime − startTime`. |
| `rewardValue` | number, optional | On the type. Plan does not award it when an event is created. |
| `location` | string, optional | Free text. Paste of `SHOW - City @ Venue` puts the venue here and keeps the title as `SHOW - City`. |
| `description` | string, optional | Free text. A pasted clock with a zone token (`@ 2PM PST`) stores `Timezone: PST` (or whichever 2–5 letter token was present) in the description and does **not** shift the clock. |

There is no `createdAt`, `updatedAt`, `movedFrom`, recurrence rule, exception date, timezone id, batch id, or tombstone. `deleteEvent` removes the row. A cleared event store is an empty list.

**Derived geometry**

- Multi-day: `endDate` present and its local day differs from `date`. The span is inclusive.
- Banner day: all-day, or multi-day, and the day lies inside the span (`eventCoversDay`).
- Timed minutes: if all-day **or** multi-day, **0**. Otherwise `end − start` in minutes, floored at 0. A clock that wraps past midnight (end earlier than start) contributes nothing. A block that is only multi-day because `endDate` is set also contributes nothing, even if it has a clock.
- Deadline for a checklist: all-day events resolve to local midnight on `date`. Timed events combine `date` with `startTime`.

**Questions an event can answer**

- How many distinct spans exist, and how many event-days do they paint?
- Where do timed events sit on the clock, by weekday and by color or title prefix?
- How long are multi-day banners (trip-shaped holds versus one-hour meetings)?
- Which locations and titles repeat, as a **derived** pattern in the titles, not as a recurrence rule?
- Which events still have an open prerequisite checklist (via the task link below)?

**Questions an event cannot answer**

- When it was added, how many times it was dragged, or what time it used to occupy.
- Whether the person attended. The event has no done flag.
- Whether a pasted “2PM PST” was meant in Pacific time or was simply labeled.

### 1.3 Planned action

`PlannedAction` (`lib/planned-actions.ts`). One array, persist version 1. Bad rows are dropped on rehydrate (missing id, or a `date` that is not `YYYY-MM-DD`).

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `plan-${Date.now()}-${random}` unless the caller passed one. Header plans use their own id prefix and then this factory. |
| `date` | `YYYY-MM-DD` | The only day this block belongs to. It does not span midnight as a first-class range. |
| `startTime`, `endTime` | `"HH:mm"` | Snapped to 15 minutes. |
| `title` | string | Defaults: “Planned action”, “To Do”, or “Habit” when the title is blank. |
| `notes` | string | Time-block notes. May be empty. |
| `source` | `"free" \| "todo" \| "habit"` | Why the block exists. |
| `sourceId` | string, optional | Task id when `source` is `todo`. Habit id (`WeeklyTask.id`) when `source` is `habit`. Absent for `free`. |

**How a block is born**

| Gesture | `source` | Also writes |
|---|---|---|
| Drag on empty day-agenda minutes, or toolbar Add Plan | `free` | Nothing else. Cancel in the dialog **keeps** a drag-created block. Remove deletes it. |
| Drop a To Do or a Next Action on an hour | `todo` | Sets the task’s `scheduledDate` and `scheduledTime`, and clears `scheduledWeek` / `scheduledMonth` / `scheduledYear`. Duration defaults to `estimatedDuration`, else 30. |
| Drop a habit | `habit` | Does **not** complete the habit. Duration is the habit’s flat `timeEstimate.minutes` when that number is positive. If the habit has no estimate, 30. If `timeEstimateNA` is set, the drop is refused and no block is written. Per-unit rates (`minutesPerUnit`) are not the block length. |
| Month-grid habit drop | `habit` | Same block, forced to 09:00. |
| Header “plan for now” | `todo` | Also creates a task (`stage: "scheduled"`, `attributes.headerTracking = "plan"`) and appends a day-plan line `Title (Nm)`. |

**Moves and deletes**

- Editing the dialog rewrites title, notes, start, and end **in place**. Same id. No previous version.
- Day-agenda drag keeps duration and, for a `todo` source, also rewrites that task’s `scheduledTime`.
- Week-grid drag of a block changes the action’s `date` and start hour (`:00`) and does **not** rewrite the linked task. The dashed chip and the task’s `scheduledDate` can disagree.
- Unschedule on the **day** rail: a to-do loses `scheduledTime` only (the date stays) and the matching placement is deleted. A free or habit block is deleted. An event becomes all-day.
- Unschedule on the **week** rail: the task loses `scheduledDate` and `scheduledTime` and gains `scheduledWeek` for the week on screen. The planned-action row is **not** deleted.
- Unschedule on the **month** rail: the task loses date, time, and week, and gains `scheduledMonth` for the month on screen. The planned-action row is **not** deleted.
- `deleteAction` and Remove are hard deletes. There is no tombstone list for planned actions.

**Duration rule.** Minutes are `end − start`, and the stored helper never returns less than 15. A clock that wraps (end at `00:00` after a late start, which is what a 24:00 clamp becomes) is stored as a 15-minute block, not an overnight span. Default length when a gesture does not specify one: 30 minutes.

**Questions a planned action can answer**

- How many timed intentions exist per day, split into free / to-do / habit?
- How long each block is, and where it sits.
- Which task or habit it claims, when `sourceId` is present.
- Which days have a habit block for a given habit id (the placement history **is** the series; the habit itself is not copied onto the row).

**Questions it cannot answer**

- When the block was created or how many times it moved.
- Whether a free block was done.
- Whether a habit block was performed. Dropping it does not write a habit completion.
- Whether two blocks were meant to overlap. Overlap is allowed and unrecorded.

### 1.4 Period plan text

An append-only log, version envelope `{ v: 1, entries, draft? }`.

| Period | Storage key | Period key |
|---|---|---|
| Day | `dayPlan-${YYYY-MM-DD}` | That day |
| Week | `weekPlan-${monday_sunday}` | Monday–Sunday range. ISO week keys alias onto it. |
| Month | `monthPlan-${YYYY-MM}` | Local month. Unpadded legacy keys alias. An empty string on the key is a tombstone meaning “no plan,” not a blank plan, so a later real log is not wiped. |
| Season | `quarterPlan-${YYYY-Qn}` | The calendar quarter. |

`brain2-` / `cogs-` prefixes are healed. Hub merges **union entries by id**, so a phone or Telegram stamp is not dropped just because the desktop copy never saw it.

Each entry:

| Field | Type | Meaning |
|---|---|---|
| `id` | string | `al_${uuid}` or a time-based fallback. Legacy plaintext becomes one row id `legacy`. |
| `createdAt` | ISO string, or null | Writing time. Null displays as “earlier” and sorts oldest. |
| `text` | string | The paragraph. Immutable after submit. |
| `stampSuffix` | string, optional | Extra words after the stamp. Telegram `plan for rn` writes `from text`. Ordinary Submit plan omits it. |

The draft is a string beside the entries. It is restored only when it is still unsent writing. A draft that merely repeats a stamped entry, or the stamped dump of the log, is treated as empty. Submitting clears the draft.

Module plan-sync (`lib/module-plan-sync.ts`) appends day-plan lines of the form `• {item title} [{module title}]` for items that pass a module’s `planSync` gate (source list, a datetime attribute, optional status). The link to the item is the sentence, not an id. Re-sync skips a line that is already in the body. `scheduleSync.toEvents` on a module is a stored flag with no Plan writer behind it; do not expect mirrored events from that flag.

Plan settings export walks `dayPlan-` / `weekPlan-` / `monthPlan-` only. It does not export `quarterPlan-*` and it does not export planned actions. A backup taken from that dialog is a partial plan.

**Questions the log can answer**

- How many times a period was rewritten (entry count).
- How far ahead the writing happened (`createdAt` versus the period’s start).
- Whether the latest writing was a person at the desk or a text (`stampSuffix`).
- How often a draft is sitting unsubmitted (present, and not already in the log).
- Rough themes, as text. There is no tag, checklist, or structured intention inside the paragraph.

**Questions it cannot answer**

- Which sentence was edited. Past entries cannot be edited; a “change” is a new entry, and nothing records that entry B replaces entry A.
- Whether the prose was followed.

### 1.5 The scheduled task (shared with Scheduler and To Do)

Plan does not own a second task table. A chip, a rail row, and a funnel card are views of one `Task`. Fields that change what Plan shows or what a Plan metric can compute:

**Live assignment.** Finest grain wins (`getStoredScheduleLevel`).

| Field | Shape | Plan’s use |
|---|---|---|
| `scheduledDate` | Date | Day membership. Inbox (`stage === "inbox"`) is **not** a Plan schedule, even when capture copied a date out of the prose. |
| `scheduledTime` | `"HH:mm"` | Puts the task on the hour grid. Absent means the day rail (untimed) if the date matches. |
| `scheduledWeek` | Monday–Sunday range | Week-only rail, when no day is set. |
| `scheduledMonth` | `YYYY-MM` | Month-only rail, when no week and no day are set. |
| `scheduledYear` | `YYYY` | Scheduler year card. Plan’s month/week/day rails do not list year-only tasks as period to-dos. |
| `deadline` | Date | If no schedule field is set, a deadline on that day, week, or month still puts the task on that rail. It does not by itself put a timed chip on the hour grid. |

**History of periods left unfinished.** `schedulePlacements[]`:

| Field | Values |
|---|---|
| `period` | `day` \| `week` \| `month` \| `year` |
| `value` | Day `YYYY-MM-DD`, week range, month `YYYY-MM`, or year `YYYY` |
| `resolved` | Omitted, or `assimilated` \| `pushed` \| `discarded` \| `clarified` |

What the resolution means:

| `resolved` | How it gets there | Still “this was a plan”? |
|---|---|---|
| omitted | Automatic roll-up when the period ended and the task was still open, or persist backfill of a live assignment whose period has already ended | Yes. The Scheduler can still triage it. |
| `pushed` | Explicit push or auto-push onto the next period | Yes, as a plan that was deferred. Push counters increment. Roll-up does not. |
| `clarified` | Dismiss or Unschedule on a past Scheduler card | The period was closed without finishing. Undone list can still show it. |
| `discarded` | To Do Discard | Dropped from the working lists. The row remains. |
| `assimilated` | Named on the type as a resolution | Roll-up itself leaves `resolved` unset. Do not assume every coarser landing is marked assimilated. |

Roll-up, when auto-push is off (the default): day → that week, week → that month, month → that year, year → no live schedule. Each step appends the period being left. Auto-push (`autoPush === true`) instead copies the same grain forward (this week → next week) and increments `daysPushed` / `weeksPushed` / `monthsPushed`. Those counters are lifetime totals, not per-period lists. A year-only schedule still rolls off.

Done and missed tasks are not rolled. Marking done on a past card stamps `completedDate` inside the period. That is what takes the row off that period’s Undone list.

**Completion fields that live on the same task** (Plan-native for adherence of *tasks*, not of events):

| Field | Use |
|---|---|
| `completed`, `completedDate` | Finished, and when. Cleared if reopened. |
| `status` | `active` / `partial` / `deferred` / `cancelled` / `missed` / `done`. `done` matches `completed`. `missed` leaves the working lists and is not done. |
| `missedAt` | When it was marked too late. |
| `startedAt`, `startCertainty` | Wall start of the completion window, and whether that start is exact, estimated, or unknown. |
| `actualDuration`, `durationCertainty`, `timeRough` | Length after the fact, and how firm it is. Unknown is the absence of a number, not 0. |
| `estimates[]` | Why an autogenerated clock was filled in (`tracked`, `logged`, `rate`, `flat`, `now`, `anchor`) and whether the person confirmed it. |
| `timeLogs[]` | Segments: `date` (`YYYY-MM-DD` string), optional `startTime` / `endTime`, `durationMinutes`, notes. Header “followed” appends one. |
| `completedChunks[]` | Partial work: date, duration, optional notes. |
| `stage` | Lifecycle bucket. Plan treats only non-inbox as a schedule. Completion paths may set `completed` or `list`. |

**Commitment intensity and shape**

| Field | Use |
|---|---|
| `estimatedDuration` | Minutes. New next actions and rail-added to-dos default to 30. Capacity uses this for a day-dated task that is **not** already covered by a `todo` placement that day. |
| `pertEstimate` | `{ optimistic, likely, pessimistic }` minutes. Expected duration is `(optimistic + 4·likely + pessimistic) / 6`. Spread is `(pessimistic − optimistic) / 6`. |
| `todoMarks[]` | Extra commitment on a period the task is already in: `required` and/or `prioritized`, keyed like To Do (`day`, `week`, `month`, `quarter`, `year`). |
| `urgency`, `importance` (1–5), `cognitiveLoad` (1–3), `entropy` (0–1), `rewardValue`, `context` | Priority and GTD context (`@home`, `@work`, …). Context is not tags. |
| `deadline` | Hard date, separate from the scheduled slot. |
| `dependencies[]` | Task ids that must finish first. The rail hides a next action while any dependency is still open (`missed` counts as clear). |
| `schedulingConstraints` | See below. |
| `isRepeated`, `repeatSettings` | See recurrence. |
| `autoPush` | Same-grain carry versus roll-up. |
| `scheduleable` | Send to Scheduler. Dates do not turn this on. Plan’s calendar does not consult it. A task can be on the calendar and off the Scheduler, or the reverse. |
| `hiddenFromTodo` | Hidden from To Do. Plan’s “is this scheduled today” helpers used by Home counts respect it; the month chip rule (`taskOnPlanCalendarDay`) does not. |
| `minimumChunkSize`, `allowPartialCompletion` | Partial-completion policy. |
| `dayRatings` | Per local day, morning `importance` / `excitement` on a 1–10 scale. Distinct from the 1–5 priority `importance`. |
| `resistanceReadings[]` | Append-only `{ at, value, source }`. A series of “how hard to start,” not a schedule. |
| `why`, `consequences`, `notes`, `definitionOfDone` | Text. `definitionOfDone` is a placeholder with no Plan writer. |
| `lists`, `links` | List membership and typed edges. Next Actions are “in a list inside a Next Actions folder,” not a separate table. |
| `attributes.headerTracking` | `"plan"` for a header-created plan row. `"unplanned"` for something inserted as lived-but-not-planned (that row is completed and **not** scheduled). |
| `createdAt` | When the item was created. Rail “add a to-do” sets this to **local midnight of the period**, so lead time for those rows is zero by construction. Header plans stamp the real clock. |

**Month chip rule** (`taskOnPlanCalendarDay`). A task chip is on a day when it is scheduled that day (and not inbox), **or** the day is already past and `completed` with `completedDate` on that day. A future day does not show a task merely because it will be completed then. Reminders and other lists do not place a chip. Inbox prose dates do not either. A past inbox item can still appear on the day it was finished.

**Deleted tasks.** `deleteTask` can record `removedTaskIds` so a merge does not resurrect the row. Events and planned actions have no equivalent list.

### 1.6 Scheduler as the coarse plan

The Scheduler is the same scheduling fields, seen as a funnel: Always → Year → Season (lens only) → Month → Week → Day, plus Gantt and a dependency graph.

- Placing a task in a bucket **replaces** the live grain. Week clears year/month/day. Day clears week/month/year. Time of day is not set by a funnel day drop; Plan’s hour grid sets `scheduledTime`.
- Eventually / Later files the task on a Next Actions list named `eventually` and does not set a period.
- Changing to a different real period awards 1 point (`lib/schedule-credit.ts`). Same bucket, Eventually, and unschedule do not. The point is a ledger row keyed by task id, not a field on the task.
- Gantt and the dependency graph run critical path on tasks that are in a dependency or are scheduleable with a duration. Duration is the PERT expected value when `pertEstimate` is present, otherwise `estimatedDuration`, otherwise 0. Slack and the zero-slack chain are computed, not stored.
- Season in the funnel is the quarter’s three months. It does not write a quarter placement.
- Past cards show the unfinished queue for that period, including a coarser month or year that still contains a past week. Handling the week settles that coarser placement too.

**Questions the funnel adds beyond the calendar**

- How much open work sits at each grain right now?
- How many periods a task has already failed to finish (`schedulePlacements` length)?
- Which chains are critical, and how wide the PERT band is?
- Whether unfinished work was rolled up (coarser, no push) or pushed (same grain, counter incremented).

### 1.7 Habits on the plan

Habits are `WeeklyTask` rows in the habits store. Plan does not copy them. The rail **lists** them, and a drop **may** write a planned action.

| Rail | Who appears |
|---|---|
| Day | Daily habits that are not done for that `YYYY-MM-DD` and not exempt for that day. |
| Week | `frequency === "weekly"`, not done for that week key, not exempt. |
| Month | `frequency === "monthly"`, not done for `YYYY-MM`, not exempt. |

Quarterly habits are not a Plan rail. Exempt means the period does not count (before the habit existed, a logged rest, or an explicit wave). Completed habits leave the rail. They do not leave a planned action that was already written.

Gem mode (month, past days only, off by default) draws completed daily habits and completed list items as icons. That is a lens over habit logs and `completedDate`. It does not write a Plan record.

### 1.8 Constraints, recurrence, and “when it may be done”

`schedulingConstraints` on the task (auto-scheduling that would **use** them is not built; the fields are real):

| Field | Shape |
|---|---|
| `canOnlyBeDoneAt` | Clock strings, e.g. `"09:00"` |
| `canOnlyBeDoneOnDays` | Weekday names |
| `canOnlyBeDoneOnDates` | Specific dates |
| `mustBeDoneAfter`, `mustBeDoneBefore` | Dates. Checklist attach sets `mustBeDoneBefore` from the event’s start. |
| `timeOfDayPreference` | `morning` \| `afternoon` \| `evening` \| `night` — words only, no stored clock bounds |
| `dayConstraints` | Free text |

Recurrence on a **task**:

| Field | Meaning |
|---|---|
| `isRepeated` | Toggle, edited on the item, not on the calendar. |
| `repeatSettings.type` | `"count"` (do it N times total) or `"frequency"` (N times per day, week, or month). |
| `totalCount`, `completedCount` | Count mode. Completion increments `completedCount` and stays open until the total is reached. |
| `frequency.times`, `frequency.period` | Frequency mode. Stored as an intention. Completion does not generate the next instance, and it does not tick a per-period counter. |

Recurrence on a **habit**: `frequency` of `daily` \| `weekly` \| `monthly` \| `quarterly` on the habit, not on the planned action. The planned action is one dated block. There is no exception date and no “this instance vs the series” on either side.

Calendar events do not recur. A run of identical all-day titles in a paste collapses into **one** multi-day event (`endDate`), not a series. Timed events in that paste stay separate. A repeated show next month is a second event if someone pastes it again.

### 1.9 Links that are actually stored

| From | To | How |
|---|---|---|
| Planned action | Task | `source: "todo"` + `sourceId` |
| Planned action | Habit | `source: "habit"` + `sourceId` |
| Task | Event | `links[]` relation `checklist-of`, `targetId` = event id. The task also gets `mustBeDoneBefore` = event start. Detach removes both. |
| Event | Task | Optional `taskId`. Not the checklist. |
| Task | Task | `dependencies[]` (and separately `parentTaskId` / `subtasks`). Not the same graph as `links`. |
| Day plan line | Module item | Text only: `• title [module title]` |
| Header plan task | The gesture | `attributes.headerTracking = "plan"` plus a matching planned action |
| Plan entry | Inbound text | `stampSuffix: "from text"` |

Checklist rollup, derived: total, completed, remaining, and `allComplete` when every linked task is `completed` and there is at least one.

Reviews sit beside the plan and are **not** on the plan record: `PeriodReview.planReflection`, `nextPlans`, and `PeriodStartRitual` (`priorities`, `mustDo`, `nextPlans`, `pulledTaskIds`, `undoneNotes`). Same period keys. Correlating “what the ritual said” with “what the calendar held” is an outside join.

### 1.10 What the capacity line already computes

For the **selected day** only (`plannedMinutesForDay`):

1. Every non-inbox task with `scheduledDate` on that day adds `estimatedDuration` (missing duration adds 0), **unless** a `todo` placement that day already covers that task id.
2. Every event that occupies the day adds its timed minutes (all-day and multi-day add 0).
3. Every planned action that day adds its duration (minimum 15).

The denominator is the waking window: wake minute of the morning that ended that day, bedtime of the evening that started that night, bedtime shifted forward by 24 hours so it can pass midnight. Each end may fall back to the person’s own median over the last 30 nights. If either end is missing, or the span is not positive, the window is unknown. The sentence is then `{planned} planned · waking window unknown`, and the 10 pips stay empty. When the window exists, pips are `round(10 × planned / window)`, capped at 10. Overfill stays at 10 pips and bolds the sentence. It does not change color.

That sum is **commitment**, not occupancy. Overlapping blocks are added twice.

Inbox dates add no minutes. Untimed habits on the rail add no minutes until they are dropped. All-day banners add no minutes.

### 1.11 Question index

| Question | Grain that answers it | Honest limit |
|---|---|---|
| What is on Thursday’s clock? | Events that day + planned actions that day + tasks with that `scheduledDate` and a `scheduledTime` | Inbox excluded. All-day is a banner, not a clock. |
| What was intended for Thursday but never given an hour? | Day rail rule: untimed day to-dos, deadline-only that day, undone daily habits, next actions not locked to a later period | Computed, not a stored list. |
| What did I write for this week? | Week plan entries | Prose, not items. |
| How many times did this week’s plan get restated? | Entry count on that week key | Not a diff. |
| Did this to-do survive its day? | `completedDate` on that day, or a day placement left behind, or `status` | Only after the period ends, or if completion was stamped. A drag to Friday before Thursday ends leaves no Thursday row. |
| Did this event happen? | It does not say | Outside join, or the checklist as a proxy. |
| How far ahead is the open work? | Live `scheduled*` versus today | Events have no birth date, so “planned how early” is unknowable for them. |
| Where is the critical chain? | `dependencies` + duration / PERT | Computed. Cycles are flagged and only partly solved. |

---

## 2. Metric catalog

Formulas are in words. “Native” means the inputs sit on events, planned actions, plan text, or the task’s own schedule and completion fields. **Outside join** means the number is not on those records; a later synthesis would have to bring it in. This section does not design that join.

Dayparts are an analytics convention. The product stores `morning` / `afternoon` / `evening` / `night` as words with no bounds. Use these bins when a chart needs clocks, and keep the stored word as its own column:

| Bin | Local clock |
|---|---|
| Morning | 05:00–11:59 |
| Afternoon | 12:00–16:59 |
| Evening | 17:00–20:59 |
| Night | 21:00–04:59 |

Weekday for a date is the local calendar weekday. Week buckets are Monday–Sunday.

### 2.1 Plan adherence

**Task, day.** A task was committed to a local day if either the live `scheduledDate` is that day (and the task is not inbox) or a `schedulePlacements` row says `period: day` for that date. It adhered if `completed` is true and `completedDate` falls on that same local day. It was missed if `status` is `missed` (use `missedAt` when present). It was deferred if that placement is `resolved: "pushed"`. It was cancelled as a plan if `resolved: "discarded"` or `status` is `cancelled`. It was set aside if `resolved: "clarified"`. It is unfinished residue if the placement exists, `resolved` is omitted, and the task is not completed on that day.

Day adherence = adhered ÷ (committed − discarded). Report pushed, clarified, missed, and unfinished beside the rate so a high “adherence” cannot hide a pile of discards that were removed from the denominator.

**Task, coarser period.** Same pattern with week range, `YYYY-MM`, or year. “Adhered” means `completedDate` falls inside the period. Auto-push and explicit push are deferrals. Roll-up is unfinished residue that moved coarser, and it must not be counted as a push (`daysPushed` does not move on roll-up).

**Partial adherence.** `status === "partial"`, or `completedChunks` whose date falls in the period, with chunk minutes ÷ `estimatedDuration` when a duration exists. Cap the ratio at 1 for the rate, and still show the raw minutes.

**Count-type repeated task.** Adherence of the series = `completedCount ÷ totalCount`. A series can adhere across many days. Do not also require each completion to match a `scheduledDate`; the repeater may not have one slot per occurrence.

**Planned action, to-do source.** Use the linked task’s adherence for that action’s `date`. If the task’s live date has since moved, still score the action’s own date against `completedDate` and against any day placement. Native.

**Planned action, free.** No done flag. The block can only support “it was planned.” Whether it was done is **outside join**, unless a header follow-up wrote `timeLogs` onto a task that shares the id — free blocks do not have that task.

**Planned action, habit.** The block is the intention. Whether the habit was met that day is **outside join** (habit log). Native signal: the block exists, its minutes, and its habit id.

**Event.** No adherence field. Native proxy: checklist `completed ÷ total` as of the event’s deadline (tasks done, and `completedDate` at or before `eventDeadline` when both exist). An event with no checklist has no proxy. Attendance is **outside join**. The time grid can remember which event ids were confirmed into tracked blocks; that list is not on the event.

**Written plan.** No adherence. Native: the log exists, how long it is, how many stamps it has. “Did the prose happen” is **outside join**.

### 2.2 Slip (planned clock versus when it actually sat)

Slip is a difference of clocks, in minutes, on the same local day. Positive means it sat later than planned.

**Native, when the task itself carries both clocks.** Planned start = `scheduledTime`, or the planned action’s `startTime` when that action’s `sourceId` is the task. Actual start = the earliest `timeLogs[]` row on that `date` that has a `startTime`, else `startedAt` if its local day matches. Slip = actual − planned. If `startCertainty` is `estimated` or `unknown`, or `timeRough` is set, or an unconfirmed `estimates` row covers `startedAt`, label the slip estimated. Do not treat an estimated start as a precise residual.

**Duration slip, native.** `actualDuration − estimatedDuration` when both exist. Same certainty flags. Header “followed” with a blank length copies the plan into `actualDuration` and marks it estimated (“filled from the planned length”). That residual is zero by construction and must be excluded from a calibration average, or shown in an “assumed the plan” bin.

**Internal clock divergence, native, and not slip.** The planned action’s `startTime` minus the task’s `scheduledTime` on the same id. Week-grid drags update only the action. This measures disagreement inside the plan. It is not evidence of what was lived.

**Events.** The planned clock is native. The actual clock is **outside join**. Do not invent slip from the checklist.

**Habits.** Planned start is the action. Actual performance clock is **outside join**.

**All-day and untimed.** Slip is undefined. Report them as “no clock,” not as zero slip.

### 2.3 Overcommitment

Two different numbers. Publish both.

**Commitment minutes** for a day = the capacity sum in §1.10 (tasks’ estimates, timed events, planned-action durations, without double-counting a to-do that already has a placement).

**Occupancy minutes** = the length of the union of timed intervals that day. Include timed events that are single-day, planned actions, and tasks that have `scheduledTime` plus a duration (`estimatedDuration`, else 30 if they are on the hour grid). Exclude all-day and multi-day events. When two blocks overlap, occupancy counts the covered minutes once.

**Stacked minutes** = commitment − occupancy. That is time promised twice.

**Waking window** = bedtime minute − wake minute, when both exist and the span is positive. Otherwise unknown. The window’s evidence is sleep state and, failing that, painted nights and a 30-day median. Those inputs are **outside join**. The commitment and occupancy numerators are native.

**Overcommit ratio** = commitment ÷ window. **Occupancy ratio** = occupancy ÷ window. A day is overcommitted when the ratio is above 1. When the window is unknown, do not divide. Report commitment alone and say the window is unknown. Do not substitute a 16-hour factory day. The rail already refuses that fiction.

**Headroom** = window − occupancy, when the window is known. Negative headroom is hours with no awake minute left. It can coexist with a modest commitment ratio if the blocks were stacked, or with a severe commitment ratio if they were laid end to end.

**Coarser overcommit.** For a week, sum daily commitment, and also sum week-only tasks’ `estimatedDuration` that never received a day. Those week-only minutes are load with no weekday. Show them as an unplaced pile, not as a fake Wednesday.

### 2.4 Empty time

**Clock empty** = 1440 − occupancy, ignoring sleep. This is native. It counts sleep, meals, and unplanned hours as empty, so it is a ceiling, not a moral score.

**Awake empty** = window − occupancy, floored at 0, only when the window is known. The window is **outside join**. When it is unknown, awake empty is unknown.

**Unplaced intentions** are not empty minutes. Count, for that day: untimed day to-dos, deadline-only rows, undone non-exempt daily habits, and next actions the rail would show. Their `estimatedDuration` sum is latent load. A day can be empty on the clock and heavy on the rail.

**Written emptiness.** A period with no entries and no draft is an unwritten period. A period with only a draft is unfinished writing. Distinct from an empty calendar.

### 2.5 Recurrence reliability

**Count-type tasks.** `completedCount ÷ totalCount`. Also the open remainder `totalCount − completedCount`. Native. This is the only task recurrence the completion path actually advances.

**Frequency-type tasks.** The rule (`times` per `day` \| `week` \| `month`) is native. The instances are not. There is no generated row per occurrence and no per-period tally. Reliability of “three times a week” cannot be computed from Plan. Say the rule is stored and the score is unavailable, rather than dividing by an imagined calendar.

**Habit placement reliability.** Numerator, native: distinct local days on which a `habit` planned action exists for that `sourceId`. Denominator, **outside join**: days the habit was daily, already created, and not exempt. Without that denominator the honest native number is “days this habit was given a block,” not a rate.

**Event “recurrence.”** None stored. A derived repeat is: same normalized title and location on more than one `date`. Report it as a title pattern. Do not call it a series, and do not forecast it as a rule.

**Multi-day collapse.** Paste of consecutive identical all-day titles becomes one span. Reliability of “a hold from the 3rd to the 7th” is one event, not five. Count spans and event-days separately so a week-long hold is not five successes.

### 2.6 Lead time

**Task lead** = local calendar days from `createdAt` to `scheduledDate` (or to the start of `scheduledWeek` / `scheduledMonth` / `scheduledYear` when that is the finest grain). Negative means it was scheduled in the past relative to creation (backfill, or a completion stamped onto an old day). Rail-added to-dos set `createdAt` to local midnight of the chosen period, so their lead is 0 or 1 depending on the clock inside that midnight. Break the histogram into “created by the rail or the funnel” versus “created earlier and later placed,” using whether `createdAt`’s local day equals the scheduled day and the id prefix `todo-` when present. Header rows use a real `createdAt`; their lead is meaningful.

**Placement lead for events and free actions.** Not stored. No birth timestamp. Do not use the id’s `Date.now()` prefix as a lead time except as a labeled heuristic for paste batches (see §7). It breaks as soon as the clock is skewed or two events are created a millisecond apart for other reasons.

**Writing lead** = local days from the entry’s `createdAt` to the start of the period key. A day plan submitted the evening before has lead 1. A season plan submitted in the last week of the quarter has a small or negative lead. Entries with `createdAt` null are “earlier” and drop out of the average. Drafts have no lead until submit.

**Checklist lead** = event start minus the prerequisite task’s `createdAt`, and separately event start minus `completedDate` when the prerequisite is done. Native. Negative completion lead means the checklist item was finished after the event began.

### 2.7 Reschedule rate

Most moves are invisible. A drag onto a future day overwrites `scheduledDate` and does not append `schedulePlacements`. The rate below is the rate of **recorded** departures, not of every drag.

**Recorded departures per task** = number of `schedulePlacements` rows. Stratify by `period` and by `resolved`.

**Push rate** = (`daysPushed` + `weeksPushed` + `monthsPushed`) ÷ tasks that have ever had a live schedule or a placement. Because the counters are lifetime totals, also report the share of placements with `resolved: "pushed"` so one task pushed ten times is visible as a distribution, not only as a mean.

**Roll-up share** = placements with `resolved` omitted ÷ all placements. High roll-up and low push means unfinished work is being absorbed into coarser lists rather than explicitly postponed.

**Same-grain survival** = among tasks that completed, the share whose `completedDate` period equals the live grain they still have (they finished where they sat). Among tasks that did not, the share that grew at least one placement.

**Event reschedule rate.** Not stored. Current `date` / `startTime` is the only time. A move and a birth look the same.

**Action reschedule rate.** Not stored. In-place edits look like the block was always there.

**Unschedule is not one operation.** See §7. A day unschedule, a week unschedule, a month unschedule, and an event “unschedule” write different residues. A single “reschedule rate” that treats them as one click will lie.

### 2.8 Horizon

Horizon is how far ahead the open plan reaches, measured from a chosen “today.”

**Item horizon** = days from today to the start of the live period. Day grain: `scheduledDate − today`. Week: Monday of that week − today (can be negative if today is Wednesday and the task is “this week”). Month: the first of `scheduledMonth`. Year: January 1 of `scheduledYear`. Open tasks only (`completed` false and not `missed`).

**Horizon mix** = share of open scheduled tasks at each grain, plus the count of next actions with no `scheduled*` at all (they are workable whenever `canWorkDuringPlanPeriod` says the stored schedule, if any, is not strictly after the period).

**Event horizon** = `date − today` for events whose end is still today or later. Multi-day events count once at their start, and their span length is a separate “how long does this hold run” metric.

**Writing horizon** = among entries in the last N submitted plans, the distribution of writing lead (§2.6). A person who only writes day plans the same morning has a short writing horizon even if the Scheduler holds a year of work.

**Deepest native horizon on the calendar UI** is the season log (a quarter) plus, on the task, a year assignment. There is no five-year plan object.

### 2.9 Load by daypart

**Start load** = count of timed blocks whose start falls in the bin. Count events, planned actions, and tasks with `scheduledTime` as three series. They can triple-count one intention (a to-do with both a `scheduledTime` and a placement). Prefer placements over the task clock when both exist, and keep events separate because they are not placements.

**Minute load** = minutes of each block that fall inside the bin, splitting a block that crosses 12:00 or 17:00. This is the fairer “afternoon load.” Overnight wrap is not representable (§7); those blocks will look like 15 minutes in the evening.

**Preference fit** = among tasks that have `timeOfDayPreference` and a `scheduledTime`, the share whose start bin matches the word, using the table at the top of this section. Report the unmatched ones. The match is only as good as the convention.

**Constraint violations, native.** A timed task whose `scheduledTime` is outside `canOnlyBeDoneAt`, or whose weekday is outside `canOnlyBeDoneOnDays`, or whose date is outside `canOnlyBeDoneOnDates`, or which sits before `mustBeDoneAfter` or after `mustBeDoneBefore`. Count violations. The product does not prevent them.

**Weekday profile** = minute load by local weekday. Month columns start on Sunday and week keys start on Monday; compute the weekday from the date, not from the column index.

### 2.10 Supporting native metrics

| Metric | Formula |
|---|---|
| Checklist readiness | For each event with at least one `checklist-of` task: completed ÷ total. “Ready before start” further requires each done task’s `completedDate` ≤ event deadline. |
| Dependency readiness | Share of day-scheduled tasks whose `dependencies` are all completed or missed. The rail already hides blocked next actions; the calendar can still show a blocked to-do if it was scheduled. |
| Critical-chain load | Sum of PERT expected durations along the zero-slack chain. Sum of PERT variances along that chain is the uncertainty. Tasks with no duration contribute 0 and should be listed as unsized, not as free. |
| Grain leak | Tasks that have both a planned action and a coarser live field (week or month) because a week/month unschedule did not delete the block. Count them. |
| Orphan placement | `todo` action whose `sourceId` is missing from the task list (deleted task, tombstoned). `habit` action whose habit id is gone. |
| Duplicate placements | More than one `todo` action with the same `sourceId` on different dates. The live `scheduledDate` can match only one. |
| Push inflation | Max and median of `daysPushed` among open tasks. A handful of chronic tasks will dominate the mean. |
| Required load | Minutes of tasks with `todoMarks.required` for that period, separate from ordinary assigned minutes. |
| Context load | Commitment minutes grouped by `context`. Blank context is its own bucket. |
| Reward promised | Sum of `rewardValue` on open tasks scheduled in the period. This is points promised by the item, not points awarded. Schedule-placement points (+1 per changed bucket) live in the points ledger: **outside join** if you want “points for planning.” |
| Paste density | Events whose ids match `${base}-${i}` for a shared base and consecutive `i`. A batch. Fragile; see §7. |
| Writing volume | Characters or entries per period key, and the gap in days between consecutive `createdAt` values. |
| Unwritten periods | Share of days in a month with no `dayPlan` entries and no draft. Same for weeks and for the quarter key. |
| Banner share | Event-days that are all-day or multi-day ÷ all event-days. High banner share means the month looks full while capacity minutes stay low. |
| Default-duration share | Planned actions of exactly 30 minutes, and tasks whose `estimatedDuration` is 30. A planning habit of accepting the default, not a measured estimate. |

---

## 3. Visualizations

Each view should state its grain in the title (“minutes promised,” “minutes occupied,” “tasks,” “event-days”) so a stacked day and an empty-looking capacity line are not mistaken for a bug.

### 3.1 Planned-load calendar

A month of cells. Two layers, switchable:

- **Commitment heat.** Color by commitment minutes that day. A second small mark when the waking window is known and the ratio exceeds 1. Cells with an unknown window stay a neutral ink and show the minute total as text, not a fake ratio.
- **Occupancy heat.** Color by the union. A hatch where stacked minutes are above zero, so overlap is visible inside a cell that is not actually full.

Corner of the cell: count of banner event-days (they add no minutes and will otherwise vanish from a heat map). Optional ticks for “has a submitted day plan” and “has an unsubmitted draft.”

Week strip above the month: the same two numbers summed, plus the unplaced week-only estimate pile as a separate bar that is not painted onto a weekday.

Season board: three months, same heat, and the season log’s entry count on the quarter — not blended into the heat.

Do not draw inbox dates. Do not draw a task on a future day merely because `completedDate` might someday match. Past days may show a completion that was never scheduled; give those cells a different mark (“finished here”) so they are not read as “was planned here.”

### 3.2 Gantt-like ribbons

Three ribbons, because the domain has three clocks.

**Day ribbon.** One horizontal day, 0:00–24:00. Lanes, not a single stack: events, planned actions (free / todo / habit as dash patterns), timed tasks that have no placement. Overlap is two bars in the same minutes, not a taller bar. All-day and multi-day banners sit in a band above the clock. A vertical line at wake and bed only when the window is known.

**Horizon ribbon.** Open tasks as bars from today to the end of their live period. Color by grain. A task with only `scheduledYear` is a long faint bar. Required marks get a heavier end cap. This is the “how far ahead is the plan” picture. It is not the critical path.

**Critical-path ribbon.** The Scheduler’s Gantt, reused as an analytic: bars sized by PERT expected duration, a band from optimistic to pessimistic, zero-slack chain in one ink, slack in another. Dependencies as arrows. This ribbon’s axis is **work order**, not the calendar, unless a task also has `scheduledDate`, in which case a second tick can show the calendar date under the bar. Cycles get an explicit “this chain is broken” state rather than a silent order.

### 3.3 Slippage histograms

Only rows that have both clocks. The histogram’s subtitle is the count excluded.

- Clock slip in minutes, bins of 15 to match the snap. A spike at 0 is real for header rows that copied the plan; split those out (§2.2).
- Duration slip, same bins.
- Internal divergence (action versus task) as its own histogram, labeled disagreement, not lateness.
- Checklist lateness: `completedDate − event deadline`, one bar per prerequisite. Events with an empty checklist are a count, not a bar at zero.

A scatter of planned duration (x) against actual duration (y), with the diagonal drawn, is the calibration picture for tasks that have `actualDuration`. Points flagged estimated use a different mark. Events do not appear.

### 3.4 Commitment versus capacity

For a chosen range of days, a column per day:

- Occupancy as a solid column up to the window.
- Stacked extra (commitment − occupancy) as a second segment.
- Window as a horizontal tick. Missing window: the column still shows commitment, and the tick is absent, with the words “window unknown.”
- A thin marker for unplaced rail minutes, off to the side, so latent to-dos are not drawn as if they occupied 9:00.

The 10-pip summary can sit on the period: share of days at 10/10, share unknown, median ratio among known days. Overfill must not be collapsed into “full.” A day at ratio 1.4 and a day at ratio 1.0 both light every pip on the rail; the chart should keep the ratio.

### 3.5 Recurrence reliability curves

**Count-type tasks.** For each repeater, a step from 0 to `totalCount` against `completedCount`. A survival curve across repeaters: share whose ratio has reached 1, by age since `createdAt`.

**Habit blocks.** Per habit, a calendar of days with a `habit` placement (native dots). The rate needs the exempt/active denominator from outside; until that join exists, the curve is a cumulative count of placements, not a percentage. Label it that way.

**Frequency-type tasks.** Do not draw a reliability curve. Draw the stored rule as a sentence (“3 times a week”) and an empty chart frame that says the instances are not recorded.

**Title-pattern events.** A small multiples of dates for titles that collide, so a touring paste is visible as dates on a line. One multi-day span is one segment, not a dotted series.

### 3.6 Histograms and strips that earn their place

- Horizon: days ahead, log-scaled, stacked by grain.
- Writing lead: same axis, one series per period type (day, week, month, season).
- Daypart: weekday × bin heatmap of minute load.
- Placement resolution: stacked bar of omitted / pushed / clarified / discarded per week the placement’s period ended.
- Default-duration spike at 30 minutes, beside the real duration distribution, so the default is obvious.

---

## 4. Statistical and learning analyses

These are questions the records can support. They are not a promise that a model is already fit. Where the outcome is “did it happen,” tasks can be labeled from their own completion fields. Events and free blocks cannot, without an outside join. Say so on the chart.

### 4.1 Which kinds of plans survive

Unit: a task-period commitment (a live schedule that has ended, or a `schedulePlacements` row). Outcome: adhered, as in §2.1. Censor open periods that have not ended.

Features that are on the record, and worth a first model or even a stratified table before any model:

| Feature | Why it might matter |
|---|---|
| Grain (day / week / month / year) | Coarser plans have more ways to “succeed” inside a long window and more ways to be rolled. |
| `estimatedDuration` bucket, and whether it is the 30-minute default | Long estimates and untouched defaults fail differently. |
| Daypart of `scheduledTime`, or “untimed” | A time may be a stronger commitment than a day with no clock. |
| `timeOfDayPreference` match | A plan against its own constraint. |
| `urgency`, `importance`, `cognitiveLoad`, `entropy` | The priority inputs. Keep them separate. Do not collapse them into one score before looking. |
| `todoMarks.required` vs `prioritized` vs neither | Required is a different speech act from assigned. |
| `autoPush` | Explicit deferral policy versus roll-up. |
| `context` | Place. Sparse contexts need to be pooled only after a count is shown. |
| Dependency blocked at the start of the period | Unmeasurable perfectly (no snapshot). Proxy: dependencies still open now, which biases toward “still blocked.” Label the proxy. |
| PERT spread | Wide `(pessimistic − optimistic)` is an uncertain plan. |
| `deadline` slack | `deadline − scheduledDate`. Negative slack is a plan already late to its deadline. |
| Has a planned-action placement | A clock block versus a date-only assignment. |
| `isRepeated` and type | Count-type has a real score. Frequency-type should be its own stratum with no outcome. |
| Checklist item vs ordinary task | Prerequisites of an event may be kept or dropped differently. |
| `rewardValue` | Promised points, not received points. |
| Age at scheduling (lead) | With the rail-created caveat. |
| Prior `schedulePlacements` count | A task that has already slipped. |

Report survival as a curve: share not yet completed, by days since the period started, stratified by one feature at a time. A logistic model is optional and should stay interpretable (grain, timed vs untimed, required, duration bucket, prior placements). Do not train on events. Their outcome label does not exist here.

Small samples are the normal case. Show the count in each stratum. A stratum of three required evening tasks is a list, not a rate.

### 4.2 Time-of-day planning bias

The plan’s own clocks, no lived data required.

- Histogram of start minute for events, for planned actions, and for `scheduledTime`. Expect spikes at `:00` (week-grid drops land on the hour) and at 15-minute snaps (day grid and the dialog). A spike at 09:00 includes month habit drops, which are forced to 09:00, and new planned actions, which default to 09:00 in the dialog. Split “default 09:00, duration 30, untouched notes” from “a start someone typed.”
- Weekday × hour heatmap. Compare Monday morning to Sunday evening.
- Preference versus placement, using the bin table. A person who marks `morning` and then schedules 21:00 is a bias worth showing as a count of mismatches, not as a scold.
- All-day share by weekday. Paste-heavy weeks will look all-day because undated itinerary lines become all-day.
- Banner versus clock. If most “plans” are banners, daypart charts of timed minutes describe a minority. Print that minority’s size.

Lived-versus-planned daypart bias (plans at 9:00, life at midnight) is **outside join**.

### 4.3 Clustering of overcommitted days

Define an overcommitted day only when the window is known and commitment ÷ window > 1. Unknown-window days are a third state, not “fine.”

- Runs: lengths of consecutive overcommitted days. A long run is a different phenomenon from a single stacked Tuesday.
- Weekday odds: overcommitted rate by weekday, with counts.
- Coupling with banners: overcommitted days that also have a multi-day event covering them (a trip week that is also packed with timed blocks).
- Coupling with the rail: overcommitted days whose unplaced intention minutes are also high. The day is full and the list is full.
- Month position: first week versus last week. Deadlines (`deadline` in the last three days of the month) may cluster without any overcommit on the clock, because a deadline does not add minutes unless the task is also day-scheduled with a duration.
- Autocorrelation of daily commitment at lag 1 and lag 7. Lag 7 is “this weekday looks like last weekday.” Lag 1 is a run. With a short history, show the correlogram and the number of days, and skip a claim.

Do not cluster on the 10-pip value. It saturates.

### 4.4 Forecasting next week’s planned load

The forecast that is honest today is mostly “what is already written,” plus a small habitual term from planned-action history.

**Already placed (native, not a forecast).** For each day of next week: commitment minutes from events, planned actions, and day-scheduled tasks already dated there. Plus the week-only `estimatedDuration` pile for that `scheduledWeek`, shown as unplaced, not spread across the seven days. This is the floor. It should be drawn as a solid bar.

**Habit-block expectation (native history, soft).** For each daily habit, the share of past days (choose a trailing window, and say its length) that have a `habit` placement for that id, times `habitScheduleMinutes`. Add that as a dashed expectation. It will overstate habits the person has stopped dropping, and understate habits they do on the rail without ever dropping. It does not know exemptions (**outside join** for a fair denominator).

**Repeating events.** Do not project them forward from a rule. Optional dashed marks only where a title+location pattern has several past dates and a stable gap. Label them “title has repeated,” not “this show is scheduled.”

**Count-type remainder.** Open repeaters with `completedCount < totalCount` contribute their `estimatedDuration` once to the week if their live schedule lands in the week, not `totalCount` times.

**Frequency-type.** Omit from the forecast. The next instances are not on the calendar.

**Uncertainty.** If the already-placed tasks carry `pertEstimate`, show a band of optimistic to pessimistic on those minutes only. Events have no PERT. The band is not a confidence interval from a model. Say that.

**What would make the forecast wrong, listed beside it.** Future drags overwrite the floor. Roll-up on the morning the week starts will move unfinished last-week tasks onto this week if auto-push is off, or onto next week’s same grain if auto-push is on. A forecast run on Sunday night will not match Monday after roll-up. Note the clock.

A seasonal naive “same weekday last week” is a baseline to beat, computed from stored commitment. If it wins, the plan is habitual. If the already-placed bar wins, the plan is literal. Both numbers fit on one chart.

### 4.5 Other analyses that stay inside the records

- **Checklist completion before the bell.** Distribution of readiness at event start. Events that begin with `remaining > 0`.
- **Critical chain versus calendar.** Tasks on the zero-slack chain that have no `scheduledDate`. The plan has an order and no days.
- **Writing versus scheduling.** Periods with a long plan log and almost no timed minutes, and the reverse. Two intentions, prose and clock. No claim that one causes the other.
- **Deferral style.** Per task, the sequence of placement resolutions. A path “day omitted → week omitted → month pushed” is a story the array can tell if the values are read in period order. The array does not store the time the resolution was written, so the sequence of `resolved` is known and the sequence of *when the person clicked* is not.
- **Default gravity.** Share of new timed blocks at 09:00 for 30 minutes, by month. A rising share means the dialog defaults are doing the planning.

---

## 5. Within-Plan combinations

The interesting tables are crosses among the four writings. Each cell should be a count and a minute total.

### 5.1 Events × planned actions × tasks on one day

|  | No planned action | Free action | Todo action | Habit action |
|---|---|---|---|---|
| Timed event overlapping that interval | Collision of an appointment and an intention | | | |
| Banner covering the day | The day is “full” in the month and still has clock room | | | |
| Task with `scheduledTime` and a matching placement | The consistent case | — | One intention, one block | — |
| Task with `scheduledTime` and no placement | Hour-grid task that capacity counts via `estimatedDuration` | | | |
| Placement whose task date differs | — | — | Divergence after a week drag or a week/month unschedule | — |

Overlap of an event and an action is a first-class combination. The product allows it and the capacity sum charges both.

### 5.2 Recurrence × placement

| Source of repetition | What Plan stores | Analytic cross |
|---|---|---|
| Count-type task | `completedCount` | Cross with whether each completion’s `completedDate` had a planned action. Some repeats are timed, some are only counted. |
| Frequency-type task | The rule only | Cross with nothing dated. Leave the cell blank. |
| Daily habit | Zero or more `habit` actions | Cross with the habit’s frequency. A weekly habit dropped on a day still produces a day block; the rail would not have listed it on the day rail. Those blocks are “planned off-rail.” |
| Pasted multi-day title | One event, many event-days | Cross with planned actions inside the span: intentions made during a hold. |
| No recurrence | Ordinary event or free block | The majority class. Do not force it into a series chart. |

### 5.3 Settings, horizons, and the written log

“Settings” here are the plan’s own policies and horizons, not the dark-chrome latch.

| Combination | What to show |
|---|---|
| `autoPush` × grain × adherence | Tasks that push themselves forward versus tasks that roll up. Same outcome family, different next slot. |
| `todoMarks.required` × grain | Required day tasks versus required month tasks. A required month is a different promise from a required morning. |
| Writing lead × scheduling horizon | A season essay written the week it ends, while tasks are scheduled months out. Or a careful day log and an empty year. |
| Draft present × period in the past | Unsubmitted writing about a period that already ended. |
| `stampSuffix = from text` × hour of `createdAt` | Plans that arrived as messages, by time of day. |
| Module line in the day log × events that day | `• title [module]` beside calendar spans. The line does not cite an event id, so the cross is by day, not by item. |
| `scheduleable` × on the calendar | Sent to the Scheduler, on the calendar, both, or neither. Four populations. |
| PERT spread × scheduled horizon | Uncertain tasks placed far out versus uncertain tasks placed tomorrow. |
| Constraint violation × adherence | Among ended day commitments, violated constraints versus respected ones. Small, and worth a table. |
| Checklist remaining × event horizon | Events this week that are not ready, versus events months away that are not ready. |

### 5.4 Resolution × completion

A single task can carry several placements. The combination that explains “what happened to this plan” is the placement’s `resolved` against the task’s current `status`:

|  | done | missed | active / partial | cancelled / deferred |
|---|---|---|---|---|
| `pushed` | Finished later | Gave up after deferring | Still open after a push | Closed another way |
| omitted (roll-up) | Finished on a coarser grain or on a later day | Missed after rolling | Still sitting in the coarser list | |
| `clarified` | Done even though the queue was dismissed | | Still on Undone, off the Scheduler queue | |
| `discarded` | Unusual (discarded and also done) | | Dropped from the lists | |

“Done and discarded” can happen because discard does not delete the task. Count it. Do not hide it as an error.

---

## 6. Information architecture for a Plan analytics section

One section, eight views. The subject is always Plan. Ranges default to the season that contains today, with a day / week / month / season / year switch that uses the same keys as the plan logs. Every view shows the sample size and the count of rows excluded for missing clocks or missing windows.

1. **This period.** The open grain in one sentence: commitment versus window (or “window unknown”), occupancy, stacked minutes, unplaced rail count, banner count, and whether a plan log or a draft exists. A list of the actual items, because a number without the names is not this product. Required marks and blocked dependencies called out.

2. **Load calendar.** The month heat of §3.1, and the week strip. Toggle commitment / occupancy. This is the home chart.

3. **Day ribbons.** Pick a day from the calendar. Lanes of §3.2. Empty hours stay empty. Overlaps stay overlapping. All-day band on top.

4. **Adherence and slip.** Tasks only, for periods that have ended. The survival curve and the slip histogram. A clear shelf for “events and free blocks have no outcome on the plan.” Checklist readiness can sit on that shelf as the one event-shaped native proxy.

5. **Horizon and deferral.** Horizon mix, the long ribbon of open work, and the placement-resolution stack. Push counters as a distribution. Roll-up versus push as the deferral style.

6. **Recurrence.** Count-type progress. Habit placement dots, labeled as placements. Frequency-type rules as sentences with an empty frame. Title patterns for events, labeled as patterns.

7. **Writing.** Lead and volume for day, week, month, and season logs. Drafts. `from text` versus desk submits. Module lines as their own mark. No sentiment score unless it is clearly a guess about prose.

8. **Forecast and data quality.** Next week’s already-placed bar, the soft habit expectation, and the list of ways Monday’s roll-up will change it. Beside it, the quality list: orphan placements, duplicate `sourceId`s, action/task clock divergence, events unscheduled into all-day, 09:00×30 defaults, paste-batch groups, season logs missing from the settings export, unknown waking windows.

A status line on every view: which store the numbers came from (events, planned actions, plan text, tasks). When a tile is refused, the sentence is specific (“No birth time is stored on events, so lead time is only for tasks and written plans”).

---

## 7. Edge cases

### All-day items

All-day events store `00:00`–`23:59` and then the duration function returns 0 because `isAllDay` is set. They paint every day from `date` through `endDate` inclusive. They do not enter commitment minutes. Turning all-day off clears `endDate` in the dialog but does not by itself rewrite the clock. A toggle off without editing times can leave a ~24-hour timed event. Treat `isAllDay` as the capacity switch, and if it is false, trust the clock — including a suspicious 00:00–23:59.

Dropping a timed event on the day rail sets `isAllDay: true` and leaves `isScheduled: true`. That is “taken off the hour grid,” not “deleted,” and not “unscheduled” in the task sense. Analytics should call it **demoted to banner**.

There is no all-day planned action. A habit or to-do is either untimed on the rail or a timed block.

### Overlapping plans

Nothing prevents overlap. Two events, a task, and three free blocks may share an hour. Commitment adds them. Occupancy unions them. Charts must not average those into one “busy” number.

A `todo` placement suppresses the task’s `estimatedDuration` in the capacity sum for that day, so the same to-do is not counted twice. A task and an **event** that happen to describe the same appointment are not linked unless someone set `taskId` or a checklist, and both will count. A free block and a task with the same title are not linked at all.

Week drag of a placement does not move the task. Both can occupy different hours and both can count.

### Pasted batches

Paste parses itinerary text into drafts, lets the person edit, then creates events. Undated continuation lines inherit the last date. A line with no date context is skipped (the skip list is not stored). `SHOW - city @ venue` becomes an all-day event with a location. `@ 2PM PST` becomes a one-hour timed event (end = start + 1 hour) with `Timezone: PST` in the description and the clock left as 14:00 local. Consecutive all-day rows with the same title and location collapse into one span.

Ids are `${Date.now()}-${index}` for that click. The shared base is the only batch key, and only until something rewrites ids. `sourceLine` from the parser is not saved. A later edit keeps the id, so the batch heuristic still groups them. Two imports in the same millisecond would collide; that is rare and worth not “fixing” in the chart by merging unrelated events that merely share a prefix pattern. Require the suffix to be `0..n-1` with no gaps before calling it a batch.

Imported events are indistinguishable from hand-built events except by that id pattern and by title prefixes. Do not invent a `source: paste` field in the metric.

### Deleted versus moved

| Gesture | What remains |
|---|---|
| Drag event to another day | Same id, new `date`. Old day is gone. Multi-day `endDate` is not shifted by the month drop (the drop writes `date` only). A multi-day event can be inverted or stretched by accident. |
| Drag event to another hour | Same id, duration preserved, new start. Old clock is gone. All-day events are not hour-dragged. |
| Event to the day rail | Same id, `isAllDay: true`. Still in the store. Still on banners. |
| Delete event | Row gone. No tombstone. Checklist tasks may still hold `checklist-of` toward a missing id. Those tasks are dangling prerequisites. |
| Drag planned action (day) | Same id, new clock. Linked to-do’s `scheduledTime` updated. |
| Drag planned action (week) | Same id, new date and hour. Linked task **not** updated. |
| Day-rail unschedule of a to-do | `scheduledTime` cleared, date kept, placement deleted. |
| Week-rail unschedule | Date and time cleared, `scheduledWeek` set, placement **kept**. |
| Month-rail unschedule | Date, time, and week cleared, `scheduledMonth` set, placement **kept**. |
| Remove / `deleteAction` | Block gone. The task, if any, remains scheduled. |
| Delete task | Task gone, optional `removedTaskIds` tombstone. Placement may remain as an orphan. |
| Funnel move to a future period | Live fields replaced. No placement row, because the old period has not “ended unfinished” — it was edited while live. |
| Period ends unfinished | Placement appended. This is the first durable trace of the old slot. |
| Push / auto-push | Placement with `resolved: "pushed"`, counters increment, live fields move to the next same-size period. |
| Discard | Placement `resolved: "discarded"`. Task remains. |
| Reopen a completed task | `completed` and `completedDate` clear. Historical placements remain. Adherence for the old period can flip if the metric only trusts current `completed`. Prefer “completedDate fell in the period” only when `completed` is still true, and show reopen as its own rare state if you can see `status` return to `active` with placements still present. There is no reopen log. |

### Timezone

All plan clocks are local, zoneless `HH:mm` on a local calendar day. Week keys and month keys are local. `toLocalCalendarDate` forces midnight in the machine’s zone. There is no IANA zone on an event, an action, or a plan entry.

A pasted zone token lives in `description` as text. The hour is whatever `2PM` means as a number. Comparing “PST” events to “no token” events is a label study, not a conversion.

`createdAt` on tasks and plan entries is a real instant (ISO). Lead time mixes that instant with a local calendar day. Compute the calendar day of `createdAt` in local time before subtracting. Do not subtract UTC dates.

Sunrise and sunset on the day agenda come from the home city in Settings (default San Diego) and are not stored on the plan. A “daylight” daypart is **outside join**.

Changing the machine’s timezone under an existing vault reinterprets every floating clock. The data cannot tell you that this happened.

### Unscheduled intentions

These are plans with no hour, and some with no period.

| Population | How you know | Minutes? |
|---|---|---|
| Day rail to-dos | `scheduledDate` that day, no `scheduledTime`, not inbox, not done, or a deadline that day with no date | `estimatedDuration` if present, else none |
| Week-only / month-only | The matching field set, finer fields empty, or a deadline in that period with no schedule | Same |
| Year-only | `scheduledYear` | Not on the Plan rail. Still a plan. |
| Next actions with no schedule | Next Actions membership, open, dependencies met, not a logged action | On the rail for every period, because nothing locks them to the future |
| Next actions locked to a future slot | `canWorkDuringPlanPeriod` is false | Hidden from this period’s rail. Still scheduled later. |
| Eventually / Later | On the `eventually` list | No period. Scheduler, not the calendar. |
| Undone daily / weekly / monthly habits | Rail filters, including exemption | Not minutes, unless dropped. `timeEstimateNA` cannot be dropped. |
| Day / week / month / season prose | Entries | No items inside the sentence |
| Unsubmitted draft | `draft` on the key | Not a commitment until Submit |
| Inbox with a parsed date | `stage === "inbox"` | Not a plan, even if `scheduledDate` is filled |
| Header “unplanned” inserts | `attributes.headerTracking === "unplanned"`, completed, not scheduled | Lived residue. Do not count them as plans. |
| Free planned actions | Timed, no `sourceId` | Minutes yes, completion no |
| Constraints with no slot | `canOnlyBeDoneOnDays` set, `scheduledDate` empty | A window of permission, not a commitment |

### Other sharp edges

- **Midnight.** A block whose end snaps to 24:00 is stored as `00:00`, and duration collapses to 15. Late-night plans will be undercounted. Do not “repair” them by assuming they cross midnight; the record does not say that.
- **Negative event clocks.** End before start yields 0 minutes, not an overnight event.
- **Multi-day timed events.** Rare, but `endDate` makes capacity 0 and makes the month treat the span like a banner. The week hour grid only draws timed events on `date` when they are not all-day.
- **Month versus week axes.** Sunday-first month columns, Monday-first week keys. A “weekend load” definition must use the date’s weekday.
- **Padding days.** Season and month grids show neighboring days. Event chips are drawn by the month that owns the day, not repeated on the faded pad. Aggregates should key by the date, not by “cells painted in this grid,” or padding will double-count.
- **+N more.** The month shows three chips and the week all-day row shows two. The hidden ones still exist. Never compute load from visible chips.
- **Gem mode.** Past month days can replace task chips with completion icons. The scheduled task is still scheduled. Do not infer “no plan” from a gem cell.
- **Ghosts.** Past hours of the day agenda can outline tracked blocks. Those outlines are not plan rows. Ignore them for Plan metrics. They are **outside join** if a later view wants planned-versus-painted on one picture.
- **Capacity is one day.** The rail’s sentence is always the selected day, even on the month and week screens. A week analytic must sum days itself, not read that sentence seven times without saying so.
- **Points for planning.** +1 when the period bucket changes. Not on the task. **Outside join** to the points ledger.
- **Reviews.** `planReflection` and `nextPlans` use the same period keys and are not the plan log. **Outside join.**
- **Placeholders.** `isSummary`, `parallelGroup`, `riskFlag`, and `definitionOfDone` are on the type and unused. Leave them out of models.
- **`type: "task"` / `"hardcoded"` on events.** Unused by Plan’s writers. Leave them out.
- **`DayPlan`, `MonthlyItem`, `DayEvent`, `ScheduleBox`.** Types in `lib/types.ts`. The living plan text is the append log, not `DayPlan`. Do not look for a `plans` collection; that store is speculation.
- **Settings export.** Omits season logs and planned actions. A quality view should say so, because a person can believe they exported “the plan” and have neither their quarter writing nor their dashed blocks.
- **One placement per source per day, many across days.** Dropping the same to-do on Monday and Tuesday yields two actions and one live `scheduledDate` (the later drop). Both actions still add minutes on their days.
- **Habit drop is not completion.** A full calendar of habit blocks can coexist with an empty habit log. Placement reliability and habit reliability are different metrics. Only the first is native.
- **15-minute floor.** A typed duration below 15 is lifted to 15 on save (`plannedDurationMinutes` / the dialog snap). Very short intentions do not exist in the store.
- **Critical path cycles.** The solver flags `hasCycle` and still returns a best-effort order. A forecast that sums the critical chain should refuse a cyclic graph or mark it partial.
- **Deleted event, living checklist.** Prerequisites can outlive the event. Readiness is then “completed toward a missing span.” Show the dangling link. Do not drop the tasks from adherence; they are still tasks.

---

## 8. What this vision refuses to pretend

The calendar remembers the current shape of an intention and, for tasks only, the periods that ended unfinished. It does not remember the path of a drag, the birth of an event, or the life that followed a free block. Adherence, slip, and “which plans survive” are real for scheduled tasks because completion sits on the same record. They are proxies at best for events (the checklist) and for habit blocks (the placement itself). They are unavailable for frequency rules, for free blocks, and for prose.

Empty time inside a waking day, attendance, painted reality, habit completion, exemptions, review essays, and points awarded for scheduling are outside joins. The Plan-native substitutes are occupancy of the 24-hour clock, checklist readiness, days a habit was given a block, the written log’s own stamps, and the push counters on the task.

The chart that fits this data is a calendar of minutes promised, a ribbon of those minutes, a survival curve for tasks, a horizon of open grains, and a quiet list of the clocks that disagree. That is the plan, seen clearly.
