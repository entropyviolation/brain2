# Plan plates — build brief

One later owner: the plan-plates agent.

Source of truth for the formulas is `docs/analytics-vision/03-plan.md` and the Plan section of `docs/analytics-vision/ANALYTICS_VISION.md`. This brief does not restate that vision. It says which plates to add on the views that already exist.

## Files

Touch only:

- `components/Analytics/PlanVsReality.tsx`
- `components/Analytics/OvercommitmentView.tsx`
- `components/Analytics/CycleView.tsx` — one caption, below
- new plate files under `components/Analytics/` named `plan-*.tsx` (pure helpers beside them if a formula should be tested)
- `components/Analytics/README.md` for those files

Do not edit Tracking or Habits files. Do not rewrite `CalibrationView.tsx`. Do not rewrite `CycleView.tsx` beyond the caption. Do not edit any other file in `docs/analytics-plan/`.

## What must keep working

- **Window ribbon** in `PlanVsReality` (`an-pvr-ribbon`): one cell per period in the shared range, height from alignment, click selects the period. The paired planned-vs-actual bars stay. That view already compares planned minutes to actual minutes. The slip plate is an addition, not a replacement.
- **Capacity line** on a selected day: `plannedMinutesForDay` and `formatCapacityLine`, with `~` and `est.` when the waking window is inferred. Leave that sentence on the view.
- **Calibration scatter** in `CalibrationView`: estimated minutes (x) versus actual minutes (y), the ratio bars, type and list breakdowns only when `n` clears `SAMPLE_FLOORS.calibration`, and PERT bands only for points whose task has `pertEstimate` (optimistic, likely, pessimistic). Events do not appear. Do not add a plate that scores events here.

`OvercommitmentView` stays a reading. It must not reschedule, push, or write schedule fields. The existing caveat (“This does not move your day”) stays.

`CycleView` is stall and pushes (`daysPushed` distribution, open important items, estimate confirmation, age of open stock). It is not cycle phase. Add one caption under the `daysPushed` title: these counters are lifetime totals from pushes, and a drag that only overwrites a future date is not in this chart. Leave the distribution, beeswarm, and survival trace as they are.

## Additions

Each plate states its grain in the title, shows `n`, and names the store the numbers came from (events, planned actions, plan text, tasks). A refused tile uses a specific sentence. Use `ChartFrame` for an empty frame.

### 1. Task adherence

- **Question.** For periods that have ended, did the task finish on the period it was committed to?
- **Chart.** A rate readout plus a small stack beside it: adhered, pushed, clarified, missed, unfinished residue, discarded. Day adherence = adhered ÷ (committed − discarded). Committed means live `scheduledDate` that day and not inbox, or a `schedulePlacements` row with `period: day` for that date. Adhered means `completed` is still true and `completedDate` falls on that local day. Coarser grains use the same rule with the period’s range. Roll-up (`resolved` omitted) is unfinished residue, not a push. Partial: `status === "partial"` or chunk minutes ÷ `estimatedDuration` when a duration exists, ratio capped at 1, raw minutes still shown. A `source: "todo"` planned action scores the linked task against the action’s own date. Count-type series use `completedCount ÷ totalCount` and do not also require one `scheduledDate` per occurrence.
- **File.** New `plan-adherence-plate.tsx`, mounted from `PlanVsReality`.
- **Keep working.** The ribbon, the paired bars, and the capacity line.

### 2. Slip histogram

- **Question.** On the same local day, how many minutes later did the task start than the clock that was planned?
- **Chart.** Histogram of clock slip in 15-minute bins. Positive means later. Include a row only when the task has a planned start (`scheduledTime`, or the linked planned action’s `startTime`) and an actual start: the earliest `timeLogs[]` row on that date that has a `startTime`, else `startedAt` when its local day matches. Subtitle is the count excluded. All-day, multi-day, and untimed rows are “no clock.” Do not store them as 0 slip. If `startCertainty` is estimated or unknown, or `timeRough` is set, or an unconfirmed `estimates` row covers the start, mark the bar estimated. Header rows that copied the plan into `actualDuration` (“filled from the planned length”) stay out of any average; they may sit in an “assumed the plan” bin. A second, smaller histogram may show duration slip (`actualDuration − estimatedDuration`) under the same rule. Internal divergence (action `startTime` minus task `scheduledTime`) is its own histogram labeled disagreement inside the plan, not lateness. Event attendance is not on the event. Do not invent event slip.
- **File.** New `plan-slip-plate.tsx`, mounted from `PlanVsReality` under the existing planned-vs-actual bars.
- **Keep working.** The existing comparison of planned minutes to actual minutes. The scatter in `CalibrationView`.

### 3. No-outcome shelf

- **Question.** Which intentions on this period have no done flag on the plan record?
- **Chart.** A shelf, not a score. Caption: events and free blocks have no outcome here. List events and planned actions with `source: "free"`. Do not mark them done or not done. Checklist readiness may sit on the shelf as the only event-shaped native proxy: for an event with at least one `checklist-of` task, completed ÷ total, and “ready before start” only when each done task’s `completedDate` is at or before the event deadline. An event with no checklist is a count, not a zero bar. Habit blocks (`source: "habit"`) are intentions only: show the block, its minutes, and its habit id. Do not read the habit log.
- **File.** New `plan-outcome-shelf.tsx`, mounted from `PlanVsReality`.
- **Keep working.** Task adherence still scores tasks. The shelf does not feed the alignment score.

### 4. Commitment versus occupancy

- **Question.** How many minutes were promised that day, and how many distinct minutes did the timed intervals cover?
- **Chart.** Per day in the shared range: commitment (the capacity sum: task estimates, timed single-day events, planned-action durations, without counting a to-do twice when a `todo` placement already covers it) and occupancy (the union of those timed intervals; overlap counts once). Stacked minutes = commitment − occupancy. All-day and multi-day events add 0. When the waking window is known and positive, draw it as a tick and show commitment ÷ window. When it is unknown, the words are “window unknown” plus the commitment minutes. No 16-hour stand-in. Do not color by the 10-pip value; pips saturate. Week-only estimates that never received a day are an unplaced pile, not painted onto a weekday.
- **File.** New `plan-load-plate.tsx`, mounted from `OvercommitmentView` above the existing day-push chart.
- **Keep working.** The push and logged-minute lines. No control on this view writes a schedule.

### 5. Recorded reschedule

- **Question.** How many periods ended unfinished, and how many of those were pushes rather than roll-ups?
- **Chart.** Stacked bar of `schedulePlacements` by `resolved` (omitted, pushed, clarified, discarded). Push rate from `daysPushed` + `weeksPushed` + `monthsPushed`, and separately the share of placements with `resolved: "pushed"`, so one chronic task is a distribution. A future drag that overwrites `scheduledDate` is not a history row. Empty frame, caption: how many times this chip was dragged is not stored. Events and planned actions have no move log; say that in the frame, do not infer it from ids.
- **File.** New `plan-reschedule-plate.tsx`, mounted from `PlanVsReality` or beside the Cycle caption. `CycleView` gets only the caption in “What must keep working.”
- **Keep working.** `CycleView`’s `daysPushed` bars, open-important readout, and age beeswarm.

### 6. Lead time

- **Question.** How many local days before the period did the task or the paragraph come into existence?
- **Chart.** Histogram of task lead: local calendar days from `createdAt` to the start of the finest `scheduled*` grain. Split “created by the rail or the funnel” ( `createdAt` at local midnight of the scheduled day, often id prefix `todo-`) from “created earlier and later placed.” Header plans use a real `createdAt`. Second series: writing lead from a plan entry’s `createdAt` to the start of the day, week, month, or season key. Null `createdAt` drops out of the average. Drafts have no lead. Events have no birth time. Do not use an id’s `Date.now()` as lead. Empty frame for event lead, sentence: no birth time is stored on events, so lead time is only for tasks and written plans.
- **File.** New `plan-lead-plate.tsx`, mounted from `PlanVsReality`.
- **Keep working.** Period plan text stays prose. This plate does not score whether the paragraph was followed.

### 7. Recurrence

- **Question.** For count-type repeaters, how far is `completedCount` toward `totalCount`? For frequency rules, what was stored?
- **Chart.** One step per count-type task, 0 to `totalCount` against `completedCount`. Frequency-type tasks (`times` per day, week, or month) render as the rule in a sentence and an empty frame: instances are not recorded, so reliability is unavailable. Do not divide by a generated calendar. Habit blocks, if shown, are a count of distinct days with a `source: "habit"` action for that `sourceId`, labeled placements, not a rate. Title repeats on events are a pattern of title and location, not a series.
- **File.** New `plan-recurrence-plate.tsx`, mounted from `PlanVsReality`.
- **Keep working.** Habit completion charts elsewhere are untouched. A habit drop is not a completion.

## Out of this pass

Do not build the month heat, the three ribbons, the survival model, the forecast, or the data-quality list. Those stay in the vision. This pass is the seven plates above, on the files named here.
