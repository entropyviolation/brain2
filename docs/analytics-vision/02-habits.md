# Habits analytics — what the tab should be

This is a product vision for an Analytics surface that reads **Habits only**. It is grounded in the live data model (`WeeklyTask`, `TaskCompletion`, the four completion maps, and the grade functions in `lib/calculations.ts`). It describes what the tab should compute and show. It does not describe any Analytics screen that already exists.

Habits already score themselves. Analytics should not invent a second grade. It should keep the app’s percents, curves, floors, and point rules, then ask the questions those numbers were never given room to answer: which habits carry the week, where a miss actually breaks a streak, whether a bad week was visible on Tuesday, and whether “doing the hard thing” is the same as “filling the cell.”

The store is `brain2-habits-store` (`useHabitsStore`, persist version 26). Completions are not rows in the task database. A habit is a `WeeklyTask`. A day, week, month, or season is one `TaskCompletion` inside a date-keyed map.

---

## 1. Data inventory

### 1.1 The four grains

Everything numeric in Habits hangs off one of four maps. Mixing them is the first way an analytic goes wrong.

| Map | Habits it holds | Key | Example | What one cell means |
|---|---|---|---|---|
| `weeklyData` | `frequency` missing or `"daily"` | local `YYYY-MM-DD` | `2026-10-09` | That calendar day for that daily habit |
| `weeklyHabitData` | `"weekly"` | `getWeekString`: Monday `YYYY-MM-DD` + `_` + Sunday `YYYY-MM-DD` | `2026-10-05_2026-10-11` | The whole Monday–Sunday week |
| `monthlyHabitData` | `"monthly"` | `YYYY-MM` | `2026-10` | The civil month |
| `quarterlyHabitData` | `"quarterly"` (the Season tab) | `YYYY-Qn` | `2026-Q4` | An **app quarter**, not an astronomical season: Q1 Spring Jan–Mar, Q2 Summer Apr–Jun, Q3 Fall Jul–Sep, Q4 Winter Oct–Dec |

Weeks start **Monday** (`getWeekStartDate`). Sunday is day 0 in JavaScript and is folded back so Monday is the start.

`HabitFrequency` is `"daily" | "weekly" | "monthly" | "quarterly"`. Frequency chooses the tab and the map. It is independent of climb cadence (`incrementalData.cadence`), which only exists on daily `INCREMENTAL` habits.

There is no archived flag. `deleteTask` removes the habit from `tasks` and strips its cells from all four maps and from `habitExemptions`. History of a deleted habit is gone from this store. `categoryId` on `WeeklyTask` is deprecated and kept only so old blobs still parse. The `categories` array (Health, Work, Learning, Personal in the seed) is not how live habits are grouped.

### 1.2 The habit (`WeeklyTask`)

Identity and scoring configuration. One row per habit, all time. Goal changes are **not** versioned: the current `goal` is what historical percents divide by.

| Field | Type | What an analyst should treat it as |
|---|---|---|
| `id` | string | Stable key. `task-{unix ms}` is also a creation instant. Seed ids like `task-1` are not dates. |
| `name` | string | Label. Also the switch for a few name presets (all-nighter lifts, sleep clocks) while the matching field is still `undefined`. |
| `type` | `TaskType` | How a cell becomes a percent. See §1.4. |
| `frequency` | `HabitFrequency?` | Missing means daily. |
| `goal` | number? | Fixed target for GOAL (and legacy TIME/COUNT). Also the line a `dailyCompletionAverage` or `listSent` habit must clear. |
| `unit` | string? | Display unit (`pages`, `minutes`, …). If the unit is minutes or hours, the logged number **is** a duration. |
| `incrementalData` | climb config | `cadence`, `startValue`, `increment`, `unit?`, `startedOn?` (`YYYY-MM-DD`). Legacy maps `currentValues` / `weeklyIncrement` still migrate. |
| `rewardValue` | number? | One-shot points when the habit **newly** becomes met (`isHabitGoalMet`). Separate from the 50-point daily ratio. |
| `createdAt` | ISO string? | Stamped on add (persist v10). Wins over the id when deciding “before this habit existed.” |
| `gem` | catalog path or data URL | The row jewel and each willpower stone. Assigned once; not a type default. |
| `priorityPinned` | boolean? | +1 effective weight until turned off. |
| `priorityMuted` | boolean? | Drops the missed-period auto weight. A pin still counts. |
| `priorityLog` | string[]? | Append-only lines, oldest first. The only real event log on the habit (“Priority set Oct 9.”, “Selected from day ritual …”, “Permanent priority removed …”). |
| `priorityRefreshedOn` | `YYYY-MM-DD?` | Day the star was last set or refreshed. |
| `priorityPermanent` | boolean? | Star and green wash stay at 100 until turned off. |
| `timeEstimate` | `{ minutesPerUnit?, minutes?, precision?: "estimated" \| "definite" }` | Assumed clock length for the Done row. |
| `timeEstimateNA` | boolean? | No meaningful duration. Not stored as 0 minutes. |
| `doneTaskPhrase` | string? | Next Done line. `{value}` is the number logged. Already-written Done rows stay as they were. |
| `doneTaskUseText` | boolean? | Text habits: the Done line is the cell text. |
| `showGoalBar` | boolean? | Draws a tube in the cell. Does not change math. |
| `taggedTaskTag` | string? | Each Done task (and each tagged tracking block’s Done line) in the period counts as 1. Not the minute-tag link. |
| `textTriggers` | `{ id, keyword, mode: "done" \| "quantity" \| "score", unitWords?, connector? }[]` | Whole-message phone lines. |
| `trackingLink` | see §1.6 | Tag minutes into a Goal or Yes/No cell. |
| `coverageLink` | `{ threshold? = 75, enabled? } \| null` | Period paint %. `undefined` may still mean a name preset; `null` is off. |
| `habitValueLink` | `{ habitId, enabled? } \| null` | Sum one daily habit’s amount into this weekly/monthly/season cell. |
| `dailyFloorLink` | `{ floorPercent? = 0, allowAtZero? = 0, enabled? } \| null` | Weekly yes/no: daily habits must clear a floor. |
| `sleepLink` | `{ end: "bed" \| "wake", beforeMinutes } \| null` | Daily yes/no from the sleep log. |
| `listLink` | `{ listName, count } \| null` | Daily yes/no from N done next actions on a named list. |
| `listSentLink` | `{ listId, grace? = 100, enabled?, mode?, measure?, target? }` | List ratio for this period. |
| `logExemptions` | `{ when: "all-nighter", day: "evening-before" \| "morning-of" }[]` | `undefined` = name preset. `[]` = preset cleared. Daily only. |
| `completionSources` | ordered `HabitCompletionSourceId[]` | Trust list. First source that has something to say wins. Absent on old rows: derived from the links. `[]` trusts nothing. |
| `completionPipelines` | rows | The form of that list. `name` is display-only. `stats` can require “better than last period.” |

`HabitCompletionSourceId`:

`manual` · `tags` · `taggedTasks` · `coverage` · `sleep` · `list` · `dailyFloor` · `habitValue` · `dailyCompletionAverage` · `listSent` · `keywords`

Pipeline kinds (`HabitPipelineKind`): `manual`, `tags`, `trackingTags`, `trackingStats`, `habitsStats`, `lists`, `keywords`.

Habits-stats points a pipeline may read (`HabitStatPointKind`):

- On the daily set: `weekGrade`, `perfectOutput`, `dayPercent`, `dayPercents`, `habitWeekPercent`, `habitWeekPercents`, `dailyFloor`, `habitValue`, `dailyCompletionAverage`
- On the weekly or monthly set: `periodGrade`, `periodOutput`, `habitCompletion`, `habitCompletions`

A “better than last week” preset compares three daily points — raw daily-completion average, week grade, and perfect output — and is met when at least **2 of 3** are strictly higher than the previous period. A tie is not higher.

### 1.3 The cell (`TaskCompletion`)

One cell is one habit × one period key. Absence of a cell is not a stored zero. That distinction matters for some readers and not others (see §1.5).

| Field | Meaning |
|---|---|
| `completed` | Yes/No lamp, and the flag many auto-links also set when they consider the cell met. |
| `value` | Numeric log. GOAL and climb both use this. Grades read this number. |
| `goal` | Sometimes a snapshot written beside `value` by an auto source. **Row and day grades divide by `WeeklyTask.goal`, not this snapshot.** |
| `text` | Text habit. Any non-empty string is a full hit. No partial credit. |
| `incrementalValues` | Legacy climb map. Read if `value` is missing. New writes omit it. |
| `manualValue` | What the person typed, kept so tracking can recompute `value`. |
| `trackedValue` | Part of `value` from the tag link. |
| `trackedCompleted` | Yes/No was checked by the tag link. |
| `handCompleted` | `true` / `false` is the person’s opinion, kept apart from auto flags. Absent means they have not touched the cell. |
| `sleepCompleted` | Sleep clock met. |
| `listCompleted` | Enough next actions on the linked list were done. |
| `coverageCompleted` | Paint % cleared the threshold. |
| `dailyFloorCompleted` | Daily-habit floor cleared. |
| `habitSumValue` | Sum of the linked daily habit. Kept even when a hand-typed `value` owns the cell. |
| `dailyCompletionAverage` | Raw mean of daily-habit row percents. Kept even when a hand number owns `value`. |
| `listSentPercent` | Grace-adjusted sent ratio. Same “kept beside a hand number” rule. |
| `taggedTaskCount` | Count of tagged Done tasks on days of this period that have already happened. **0 is a reading, not a typed zero.** |
| `keywordLogged` | A phone keyword line wrote this cell. |
| `keywordValue` | Quantity lines add; score lines set. |
| `missedOpportunity` | The person marked this period as definitely not done. **Grades, percents, streaks, gems, and points do not read it.** |
| `updatedAt` | Wall-clock ms of the last edit. A newer write wins over a stale snapshot. Not a history of previous values. |

### 1.4 How a period is marked — by type

`TaskType`: `BOOLEAN`, `GOAL`, `TEXT`, `INCREMENTAL`. Legacy `TIME` and `COUNT` normalize to `GOAL`.

**Yes/No (`BOOLEAN`).** Met when `completed` is true. There is no partial. An explicit false and a missing cell are the same input to the day average: neither adds 100, and neither increments the “tasks with data” counter. Points ratio is 1 or 0. Trust can still call the cell met from sleep, a list, coverage, tags, or a keyword while `completed` is what the grade actually reads — auto writers are supposed to set `completed` when they win, but the grade function itself does not call `isHabitGoalMet`.

**Goal (`GOAL`).** Cell percent is `min(100, value / task.goal × 100)` when `value` is present and `goal` is set. No goal → 0. Overshoot is stored (`value` may be 40 on a goal of 10) and then **thrown away by the cap**. A logged `0` counts as data. A missing cell does not increment “with data,” but once any sibling habit has data the missing habit still sits in the denominator of the day average, so both pull the day down the same way. Met (`isHabitGoalMet`) is `value >= goal`, unless an ordered `completionSources` list says otherwise.

**Text (`TEXT`).** A truthy `text` is 100 in the grade (`calculateDayPercentageAV`). Blank is not data. No partial, no intensity. Reader B (`isHabitGoalMet`) requires a trimmed string, so whitespace alone can count on the ribbon and still be unmet for streaks and stones.

**Climb (`INCREMENTAL`).** Two cadences.

| Cadence | What the person logs | That day’s target | That day’s percent | When the target moves |
|---|---|---|---|---|
| `weekly` | An amount, like a goal | `weeklyGoalOn`: starts at `startValue` | `min(100, value / goal × 100)`. Goal ≤ 0 and value > 0 → 100 | Next Monday, `goal += increment` only if the previous week had **≥ 4** days at or above that week’s target (`WEEKLY_INCREMENT_MIN_DAYS`). How far over the target a day went does not matter. |
| `daily` | A running score (chess rating) | Last logged score before today + `increment`. A day with no log does not move the base. A lower log **does** move it. | If value ≤ committed base → 0. Else `min(100, (value − committed) / increment × 100)`. Increment ≤ 0 and value above the base → 100 | Every log, including a drop. |

Week percent for a daily-cadence climb is **not** the mean of the seven day percents. It is the week’s gain (`score at next Monday’s base − score at this Monday’s base`, floored at 0) divided by `increment × number of days`, capped at 100. A waived day uses a different path: sum of day percents over the days that remain.

`startedOn` fixes week-0 Monday for the weekly cadence. If it is missing, week 0 is the Monday of the first logged value.

### 1.5 Two readers, and they disagree on purpose

Analytics must label which reader it used.

**Reader A — the grade.** `calculateDayPercentageAV`, `calculateTaskPercentage`, `calculateWeekToDateGrade`, `calculateWeekToDateOutputGrade`, and the period analogs. They read `completed`, `value`, `text`, and the climb log. They do not read `missedOpportunity`, `handCompleted`, or the trust list.

Day average (the number inside Week grade), called AV:

- Drop exempt habits for that day.
- If the day bucket is missing, or no remaining habit has a scored cell, the day is **0**.
- Otherwise: sum of cell percents ÷ **count of non-exempt habits**, not ÷ habits that happened to have a cell.
- A habit with no cell contributes 0 and still counts in the denominator once any habit has data.
- A fully exempt day is marked `vacant` and left out of the week mean. It is not a 0 inside the average.

There is a second day function, `calculateDayPercentage`, that divides only by habits that have data. **Week grade does not use it.** Offer it only as a labeled sensitivity (“among habits that were touched”).

**Reader B — met.** `isHabitGoalMet`. Used by willpower stones, 4-day week streaks, the one-shot `rewardValue`, and “is this cell complete.” If `completionSources` is an array and the type is not climb, the first source with a `met` or `unmet` reading wins. Empty readings are skipped. All empty → unmet. Climb ignores that list and uses the derived target.

`missedOpportunity` is a third mark. Eligible only when the period is not exempt and not met. It does not clear `completed`. It does not enter Reader A or Reader B. It is a human verdict sitting beside the score: “this was a miss I am willing to name,” not “the math already called it a miss.”

### 1.6 Where a number comes from

Trust order, labels the app already uses:

| Id | Label | What it observes | How it combines |
|---|---|---|---|
| `manual` | By hand | `handCompleted`, typed `manualValue` / `value`, non-empty text | The person’s opinion. A source with nothing to say is skipped, so an untouched cell falls through. |
| `tags` | Tracking tags | Minutes on pens carrying any of `trackingLink.tagIds`, unioned across scopes so the same minute is not double-counted | `add` (default): manual + tracked. `max`: the larger. `replace`: tracked only. Hours are minutes/60, rounded to 2 decimals. Yes/No checks when tracked ≥ `threshold`; missing or ≤ 0 threshold means any positive time. |
| `taggedTasks` | Tagged tasks | Done tasks whose tag matches `taggedTaskTag`, on days of the period that have already happened. A tracking block with the tag files one Done line, not a pile of minutes. | Count vs `goal`. |
| `coverage` | Activity occupancy | Percent of the period painted in Tracking | Met at `threshold` (default 75). The sheet prints `min(actual, threshold)` so a complete day reads 75/75, not 100/75. **Stored percent and grades stay on the real percent, uncapped by the threshold.** On the current period only, pace = occupancy ÷ fraction of the period already elapsed. |
| `sleep` | Sleep clock | Bedtime is the evening into the next morning (`sleptMin`). Wake is that morning (`wokeMin`). | Met when the logged end is at or before `beforeMinutes`. |
| `list` | Next actions | Done next actions on `listLink.listName` that day | Met at `count`. |
| `dailyFloor` | Daily habits floor | Each daily habit’s row % over the week | Above `floorPercent` (default 0). Up to `allowAtZero` habits may sit at 0. A vacant percent counts as 0. No daily habits → not met. |
| `habitValue` | Daily habit total | Sum of one daily habit’s `value` on days so far (today included; the whole period once it is over). A bare check with no number counts as 1. A logged 0 adds 0. | Sum vs this habit’s `goal`. A hand-owned cell keeps the typed total and still stores `habitSumValue`. |
| `dailyCompletionAverage` | Daily completion average | Uncurved mean of each active daily habit’s row % (`calculateTaskPercentage`). A habit exempt every day of the span is left out. An active empty habit counts as 0. | The habit’s own `goal` is the line (goal 50 is met at 50). This is **not** the curved week grade and **not** Perfect output. A week uses all seven dates, so a future day counts as not met and the number matches the week-% column. A month or season uses only days that have happened. |
| `listSent` | List sent | `sent / (unsent + sent) × 100` for the period. Sent means `sentAt` inside `[start, end)`. An item sent outside the range is in neither bucket. A send inside the range still counts after it leaves the list. | Reported = `min(100, raw / grace × 100)`. Grace defaults to 100. Grace 80 turns raw 80 into 100 and raw 40 into 50. |
| `keywords` | BIM keywords | Whole message equals the keyword. `done` marks complete. `quantity` adds a number. `score` sets a number. | Stored as `keywordLogged` / `keywordValue`. |

TEXT and climb habits are not tag-link targets. Tracking sync will not open an empty cell for a day the tracker has nothing to say, because a stray 0 would become a scored cell.

### 1.7 Exemptions

A waived period leaves **both** sides of the fraction. Three daily habits with one waived divide by two. A week with one waived day divides by six. The waived day is not a completion and does not earn the 50-point ratio.

| `ExemptionKind` | Counts as exempt? | Rule |
|---|---|---|
| `required` | no | Explicit “require,” or the default |
| `auto` | yes | The period **ended** before the habit existed. The creation day, the week that contains it, and the month that contains it stay required. Creation day is `createdAt`, else a `task-{ms}` id. Seed ids do not auto-waive. |
| `waved` | yes | Wand override `true` |
| `logged` | yes | Daily only. An all-nighter keyed by the **morning** date. `evening-before` lifts the day that led into the night. `morning-of` lifts that morning. Name presets exist for bedtime-and-11, wake-and-9, and document-and-dream while `logExemptions` is unset. An explicit require beats a log block. |

Overrides live in `habitExemptions`: frequency → period key → habit id → boolean. Matching the automatic rule again deletes the override. Weekly and monthly ignore log blocks.

### 1.8 Grades, curves, and the points those grades pay

Store knobs (all canonical, all independent of each other):

| Knob | Default | Range | What it curves or pays |
|---|---|---|---|
| `gradeTolerance` | 100 | 1–100 | Week / span grade |
| `outputGradeTolerance` | 100 | 1–100 | Perfect output |
| `accomplishmentThreshold` | 80 | 1–100 | Good day / good week / good month / good season. **Not** a curve. |
| `accomplishmentBonus` | 50 | ≥ 0 | Points on a good day |
| `dayGradeLiftBonus` | 25 | ≥ 0 | Once, when today’s raw daily completion (whole percent) is strictly above yesterday |
| `weeklyGradeLiftBonus` | 25 | ≥ 0 | Once per rail (week grade, perfect output) that beats the prior full week |
| `weeklyAverageBeatBonus` | 5 | ≥ 0 | Once, when today’s raw completion is strictly above the prior 7-day mean |
| `monthlyAverageBeatBonus` | 5 | ≥ 0 | Once, when today’s raw completion is strictly above the prior 30-day mean. Independent of the 7-day rule. |
| `gradeUsePriority` | off | bool | 50% floor blend on the grade rail |
| `outputUsePriority` | off | bool | Same blend on perfect output |
| `goodDaysUsePriority` | off | bool | Same blend when deciding a good day |
| `morningRitualPointMultiplier` | 5 | 0–99 | The **× drawn** on a habit that is in today’s morning ritual. 0 hides it. It is not a factor inside `dailyHabitDayPoints`. |

**Curve.** `curveDayPercentage(raw, tolerance) = 0` when raw ≤ 0, otherwise `raw + (100 − tolerance)`. Tolerance 80 means a raw 80 displays as 100, and a raw 70 displays as 90. **Zero is never lifted.** The function does not cap at 100, so a raw 90 at tolerance 80 is 110. The week grade is the mean of those curved day scores over elapsed, non-vacant days. A future day is not in the mean. A past week is graded through Sunday. The week that contains “as of” is graded through that day.

**Week grade** = that mean, then the optional priority blend.

**Perfect output** = mean of each daily habit’s **elapsed** row percent (same curve, its own tolerance), then the optional priority blend. A habit that logged nothing is 0 and still in the mean, unless every one of its elapsed days is exempt, in which case the habit is dropped. The on-grid week-% column is still over the full 7 (minus exemptions), so early in the week a row’s week % and its contribution to perfect output are different questions: “how full is the week so far, paced to days lived” versus “what fraction of a full seven-day bar is filled.”

**Span grade** on the weekly and monthly sheets is the same mean, over the columns of the chosen window, not over “all time.”

Weekly window (`habitWeekWindow`, default `sevenWeeks`): `sevenWeeks`, `thisMonth` (civil month; keeps every Monday that falls in it), `thisSeason` (app quarter), `fourWeeks`, `thisMoon` (new moon to next new moon).

Monthly window (`habitMonthWindow`, default `yearToDate`): `yearToDate`, `trailing12`, `sinceBirthday`. Birthday is `{ month, day }`, default **5 May**.

`habitWeekView` / `habitMonthView` / `habitSeasonView` collapse the sheet to the current period. They do not change the window used when the view is off.

**Priority blend.** `PRIORITY_GRADE_FLOOR` is 50.

`displayed = 0.50 × prioritized + 0.50 × overall`

when the toggle is on and at least one habit has effective weight > 0. Otherwise the ordinary score stands. Completing every prioritized habit and nothing else floors the grade at 50. Completing everything is still 100. A day that is 0 on both sides stays 0. The blend never lifts a zero day by itself.

**Effective priority weight** = consecutive fully empty periods immediately before the current one (the auto term) + 1 if pinned. Mute forces the auto term to 0. Cap on the auto term is 52.

| Frequency | What “empty” means | Unit counted |
|---|---|---|
| daily | A Monday–Sunday week with no cell ratio > 0 | weeks |
| weekly | The prior week cell ratio is 0 | weeks |
| monthly | The prior month cell ratio is 0 | months |
| quarterly | The prior season cell ratio is 0 | seasons |

Any progress (ratio > 0, not merely “met”) breaks the run. The star is a different number: day 0 after `priorityRefreshedOn` is 100, then −10 per calendar day, and day 10 is 0. `priorityPermanent` or “in the ritual today” holds it at 100. Neglect wash uses the empty-period count and does not fade.

**Good day.** Raw day percent (or the blended day score, if `goodDaysUsePriority`) is ≥ the threshold **and** > 0. Default 80. The curve is not consulted. A good week, month, or season is the mean of raw day percents across that span — elapsed days while the period is open, all days once it is finished, empty days as 0 — at or above the same line.

**Points written into the points ledger** (ids are stable, so Analytics can join them without re-deriving, but re-deriving is the check):

| Ledger id | Amount | When |
|---|---|---|
| `habit-day:{taskId}:{dateKey}` | `round(ratio × 50, 1)` | Every daily habit, every day. Exempt → 0. Ratio is the same cap-at-1 cell ratio. Max 50 per habit per day. |
| `habit-grade-bonus:{dateKey}` | 300 if **both** shown week grade and perfect output are ≥ 75; 100 if either is; else 0 | Elapsed days. Uses the **shown** grades (after curve and priority blend). |
| `habit-raw-day-bonus:{dateKey}` | `accomplishmentBonus` or 0 | Shown day score meets the threshold. |
| `habit-day-grade-lift:{dateKey}` | `dayGradeLiftBonus` or 0 | Today’s rounded raw completion > yesterday’s. |
| `habit-weekly-grade-lift:{weekKey}` | 0, 1×, or 2× `weeklyGradeLiftBonus` | This week’s rounded rails vs last week’s. 74.6 and 75.4 are not a lift; both round to 75. |
| `habit-weekly-avg-beat:{dateKey}` | `weeklyAverageBeatBonus` or 0 | Raw today > mean of the prior 7 calendar days. Those days count as 0 when empty. Today is not in the mean. |
| `habit-monthly-avg-beat:{dateKey}` | `monthlyAverageBeatBonus` or 0 | Same, prior 30 days. |
| task id itself | `rewardValue` (0 if missing) | Once, on the transition from not-met to met. Uses Reader B. |

The prior-7 and prior-30 bonuses can both pay on the same day. Equal rounded percents pay nothing.

### 1.9 Willpower

Willpower gems are not a second score. `weekWillpowerStones` emits one stone per daily habit per day in the visible week where Reader B says met, skipping exempt days. Seven met days → seven copies of that habit’s `gem`. Uncomplete the day and the stone leaves. Nothing is stored; the plate is a function of completions. The row jewel inverts if **any** day this week is met.

The physics knobs (`willpowerPhysics`, stir, drag, restitution) move pixels. They are not behavioral data. `willpowerImage` is the crystal photograph.

### 1.10 What a met day also writes outside the habits store

Meeting a habit upserts a `loggedAction` task (`habitDoneLogId`) so Done-today can show it, with a derived duration (`lib/habit-time-estimate.ts`):

1. If the habit’s own unit is minutes or hours, the logged number is observed duration.
2. Else painted tag minutes, plus a rate top-up for hand-logged amount beyond that.
3. Else `amount × minutesPerUnit`.
4. Else the flat `minutes`.
5. Else no duration. `timeEstimateNA` skips the assumed paths. A real minutes log or painted time is still observed.

`precision: "definite"` means the assumed length does not need confirmation. Anything else is estimated.

Morning review stores `priorityHabitIds` for the day. Choosing a habit there refreshes `priorityRefreshedOn` and appends a ritual line to `priorityLog`. That is the join between the ritual and the star. It does not multiply the 50-point ratio.

### 1.11 Goals do not feed this store

Objectives and goals live in `lib/goals-store.ts`. That store does not reference `WeeklyTask`. A habit does not carry an objective id. The analytic join from “life goal” to “habit cell” is not in the data. Habits **do** join to Tracking tags, Tracking occupancy, sleep, Lists (next actions and sent ratios), Done-task tags, other daily habits (sum and floor and average), and phone keywords. Those are the real cross-links.

### 1.12 Questions each field can answer

| If you have… | You can ask… |
|---|---|
| Cell ratio over dates | Did this habit happen, how fully, on which weekdays? |
| `value` before the 100 cap | How intense was a goal day, including overshoot the grade hid? |
| `manualValue` vs `trackedValue` | Was the cell a hand log, a painted hour, or both? |
| Source flags | Which pipe actually filled the cell, and how often did pipes disagree? |
| `handCompleted` vs auto flags | When did the person override the machine? |
| `missedOpportunity` | Which misses were named, as opposed to left blank? |
| `createdAt` + exemptions | Is a zero week “before the habit” or “after the habit started”? |
| `priorityLog` + weights | When was attention put on this habit, and did the next period move? |
| `goal` / `increment` / `threshold` / `grace` | How hard was the line, and what happened to follow-through when it moved? (Only if you snapshot the line yourself; the store does not.) |
| Ledger ids | How many points did the day pay, and which rule paid them? |
| `timeEstimate` + tracked minutes | What did the habit cost in clock time versus what it was assumed to cost? |
| `updatedAt` | Which cells were touched late? You cannot see the previous number. |

---

## 2. Metric catalog

Name every metric in the app’s own words, then say the formula in one sentence. Prefer recomputing from cells over trusting a display string. Round the way the tubes round (nearest whole percent) only when the comparison is a lift or a “points still needed” gap. Keep the unrounded number for means and trends.

### 2.1 Adherence

**Cell ratio** — Reader A’s 0–1 for one habit-period. Yes/No and text are 0 or 1. Goal and weekly-climb are `min(1, value / target)`. Daily-climb is the gain toward `increment`, floored at 0 and capped at 1.

**Met** — Reader B. Use this for streaks and stones. Say so on the chart.

**Day adherence (raw day %)** — `rawDayCompletionPercent` / `calculateDayPercentageAV`. Mean of cell percents over non-exempt daily habits. This is the number the good-day line compares to the threshold.

**Week grade (shown)** — mean of curved elapsed day scores, then `blendPriorityScore` if `gradeUsePriority`. Report raw grade, curved grade, tolerance, curve bonus (`100 − tolerance`), days included, and vacant days as separate series. Never plot only the blended number.

**Perfect output (shown)** — mean of curved elapsed row percents, own tolerance, own blend toggle.

**Span grade** — `calculatePeriodGrade` over the active week or month window.

**Row percent** — `calculateTaskPercentage` over the window (7 days, or the sheet’s periods). This is the rightmost column of the grid.

**Paced row percent** — the same formulas over elapsed days only (`calculateElapsedTaskPercentage`). This is what perfect output averages.

**Period column percent** — AV rule on a weekly, monthly, or season column.

**Good-day indicator** — shown day score ≥ `accomplishmentThreshold` and > 0.

**Good period** — mean raw day % of that week, month, or season ≥ the same threshold.

**Points still needed** — round the percent, round the threshold, subtract. This is the sheet’s phrase (“10 needed to be a good day”). `isAccomplishedDay` itself uses the unrounded `≥`, so a raw 79.6 against a line of 80 is not a good day, while the rounded gap says 0 needed. Show both when they disagree.

### 2.2 Streaks

Use `computeStreak` unless exemptions must be skipped.

| Streak | A hit is | Unit | Grace |
|---|---|---|---|
| Habit day streak | Reader B met, and the day is not exempt | day | Today unfinished does not break it: the run may end yesterday. `streakSkippingExemptDays` neither counts nor breaks on an exempt day. |
| 4+ week streak | ≥ 4 non-exempt met days in the Monday week | week | Same one-period grace. The 4 is `WEEKLY_INCREMENT_MIN_DAYS`. It does **not** by itself raise a climb target; the climb uses the same 4 only as its bump rule. |
| Good-day streak | Accomplished date keys | day | Ordinary `computeStreak`. A fully exempt day scores 0 and **can** break this streak, because the good-day collector does not skip vacant days. |
| Good week / month / season | Period raw mean ≥ threshold | week, or the period’s own unit | Lookbacks: 30 days, 12 weeks, 12 months, 4 seasons. |

Also report `longest`, `lastDate`, and `totalActivePeriods`. A current streak of 0 with a long longest is the recovery question, not a failure of the metric.

### 2.3 Recovery after a miss

Define a **miss day** for a habit as: the day has started, the habit is not exempt, and Reader B is unmet. A blank and a `missedOpportunity` are both misses to the math. Keep a second count of **named misses** (`missedOpportunity === true`).

**Recovery lag** — for each miss, the number of later required days until the next met day. Censor the lag if the habit ends (deleted — you will not see it) or if “today” is still inside the gap.

**Return rate** — share of misses that are followed by a met day within 1, 3, and 7 required days.

**Bounce** — the cell ratio on the day after a miss, minus the habit’s own trailing 28-day mean. A bounce above 0 is overshoot after a hole. A bounce below 0 is a slide.

**Week repair** — after a week that failed the 4-day bar, did the next week hit it? This is the climb-relevant recovery, because a failed week does not raise `weeklyGoalOn`.

Do not call an exempt day a recovery or a miss.

### 2.4 Grade trajectories

Plot, per day, the unblended raw day %, the curved day %, and the shown week-to-date grade. The week-to-date grade is a **mean of days so far**, so it moves more slowly than the day and it resets in spirit every Monday (a new week’s grade does not include last week).

**Monday residual** — shown week grade minus the mean of the previous four finished weeks’ Sunday grades (only weeks that have a recorded cell; `averageWeekGradeAcrossWeeksWithData` already skips empty weeks rather than scoring them as 0).

**Rail gap** — perfect output minus week grade, same day, both unblended. A large positive gap means a few habits are full while other days are empty (intensity concentrated). A large negative gap means the days look fine in aggregate while some habits are permanently empty (the row mean is harsher than the day mean). That is the structural difference between the two grades: week grade averages **days**, perfect output averages **habits**.

**Curve distortion** — shown curved grade minus raw grade, which equals the tolerance bonus on every positive day, diluted by zeros (because zeros do not receive the bonus). If tolerance is 80, a week of all 50s curves to all 70s (delta +20). A week of three 0s and four 50s curves the 50s to 70 and leaves the 0s, so the mean rises by less than 20. Publish this delta so a “better week” is not just a looser tolerance.

**Lift** — the exact bonuses: raw today vs yesterday; each rail vs last Sunday’s rails; raw today vs prior-7 mean; raw today vs prior-30 mean. Use rounded percents, matching `gradeLiftDelta`.

### 2.5 Priority-weighted performance

**Weight** — `effectivePriorityWeight` as of that day (it changes as empty weeks accumulate).

**Prioritized subset score** — week grade and perfect output recomputed on habits with weight > 0 only. This is the `priority` term in the blend, even when the toggle is off. Always show it beside the overall score so the floor is inspectable.

**Blend contribution** — `shown − overall` when the toggle is on. Positive means the prioritized subset outran the field and the floor lifted the grade.

**Attention yield** — over the 14 days after a `priorityLog` line, the habit’s met rate minus its met rate in the 14 days before. Split lines by kind (set, refreshed, ritual, permanent on, permanent off) because they are different acts.

**Neglect load** — sum of auto weights across habits, and the count of habits with auto weight ≥ 2. This is the compounding the mute button exists to stop.

**Star half-life** — days since `priorityRefreshedOn` until the fade hits 0 (always 10 unless permanent). Cross with met rate during the fade. The hypothesis worth testing: follow-through drops as the star drops, or it does not and the star is ceremonial.

Pin and neglect are not the same population. A pinned habit that is done every week has weight 1 and auto weight 0. A muted neglected habit has weight 0. Color them differently.

### 2.6 Willpower

**Stones this week** — count of Reader B hits among non-exempt daily cells in the Monday week. That is the plate’s population.

**Stone share** — stones from habit *i* ÷ all stones. A plate of 40 stones that is 30 copies of one gem is not a broad week.

**Jewel-on, stone-off** — the row jewel inverts on any hit, so a 1-of-7 week still “looks on.” Report stones per habit (0–7), not the boolean invert.

Do not correlate physics energy with behavior.

### 2.7 Source attribution

For each cell, recompute `trustedOutcome`. Store the winner next to the flags that were present.

| Metric | Formula in words |
|---|---|
| Source coverage | Share of met cells whose winner is each source. |
| Hand override | `handCompleted === false` while some auto reading is `met`, or the reverse. |
| Dual contribution | `manualValue > 0` and `trackedValue > 0` on the same goal cell. Mode `add` vs `max` vs `replace` changes what `value` became; show the mode. |
| Silent machine | Met, winner ≠ `manual`, and `handCompleted` absent. The person never touched it. |
| Disagreement | Printed goal reached (`value` capped for display ≥ goal) while trust says unmet. The sheet already hatches this case. Count it. |
| Keyword share | Met cells with `keywordLogged`. |
| Occupancy vs threshold | Stored coverage percent minus `threshold`, and pace (`loggedShareOfElapsed`) on the open period. Pace > 100 means the lived fraction is painted more densely than the full-period bar. |
| List grace lift | `listSentPercent` (reported) minus the raw sent ratio. Grace below 100 manufactures completion. |
| Floor slack | How many daily habits were at 0 when a floor habit was met, versus `allowAtZero`. |
| Sum vs hand | `habitSumValue − value` when both exist. Non-zero means the person replaced the sum. |

### 2.8 Habit versus task

In this app a **habit** is a `WeeklyTask`. A **task** is a `Task` in the task store. They meet in four places only:

| Join | Grain | Analytic |
|---|---|---|
| Done row written when a habit becomes met | one logged action per habit per period | Did the Done line’s duration match `timeEstimate`? How often was it `estimated` vs observed? |
| `taggedTaskTag` | each tagged Done task = 1 toward `goal` | Count vs minutes. A cooking habit of 2 is two events, not two hours. |
| `listLink` | N next actions completed that day | The habit is a quota on a list, not a behavior of its own. |
| `rewardValue` | one shot on the met edge | Separate from the 50 × ratio, which pays partial credit every day even when the goal is not met. |

**Partial-credit points** = 50 × cell ratio, including a 40% day. **Met bonus** = `rewardValue` only on the crossing. A goal habit can earn 20 points on a half day and then 50 + `rewardValue` on the day it clears. Analytics should stack those ledgers instead of calling either one “the habit score.”

Text habits have no partial points: empty is 0, any text is 50. Climb daily can earn a fraction of 50 on a small gain and 0 on a flat or falling log, even though the log still moves tomorrow’s target.

### 2.9 Day-of-week and period effects

Weekday is the local date’s Monday-first index.

**Weekday profile** — mean cell ratio by weekday, per habit and for the day grade. Exempt cells out. Future days out.

**Weekend delta** — mean(Sat, Sun) − mean(Mon–Fri), in percentage points.

**Period effect** — for weekly habits, the column percent by week-of-month or by the sheet window. For monthly habits, by month. For season habits, by quarter. Do not compare a daily cell to a season cell without aggregating the daily cells up to that season (mean of raw days, or sum of `value`, stated explicitly).

**Moon window** — when the weekly sheet is `thisMoon`, the span is synodic, not civil. A moon effect on daily habits is an optional cut of daily cells by days since the app’s new moon (`habitWeekMoonSpan`). Label it as the app’s lunar instant, not an observed sky.

**Birthday year** — monthly `sinceBirthday` starts the month of the latest birthday on or before today (default 5 May). A “year” in that window is not 1 January.

### 2.10 Volatility

**Day volatility** — standard deviation of raw day % over the last 28 elapsed days. Empty days count as 0, matching the prior-7 and prior-30 means. Also report the standard deviation **conditional on the day having any cell**, so a vacation of blanks does not look like a wild habit system.

**Habit volatility** — standard deviation of that habit’s cell ratio over required days in 28 days.

**Grade volatility** — standard deviation of finished-week Sunday grades (curved, unblended) over the last 12 weeks that have data.

**Zero inflation** — share of required days whose ratio is 0. A habit with mean 0.5 can be “every day half” (low zero inflation, low volatility) or “every other day full” (zero inflation 0.5, high volatility). Those are different lives. The grade cap hides the second kind’s overshoot, so pair zero inflation with **uncapped intensity** (`value / goal`, allowed to exceed 1).

### 2.11 Consistency versus intensity

| | Consistency | Intensity |
|---|---|---|
| Yes/No | Met rate | Not available. Do not invent one. |
| Text | Non-empty rate | Length of `text` is a weak proxy and should be labeled as such. |
| Goal | Share of days with ratio ≥ 1, and share with ratio > 0 | Mean of `value / goal` **before** the cap, on days with a value. Median value. Overshoot mass: sum of `max(0, value − goal)`. |
| Weekly climb | Share of days at or above that week’s target (the hit count that decides Monday’s bump) | Mean `value / weeklyGoal` before the cap. |
| Daily climb | Share of days with percent > 0 (any gain) | Mean gain versus `increment`. A drop is intensity in the other direction: size of `(committed − value)` when value is lower. |

**Consistency index** — 1 − (zero inflation), among required days since `createdAt`.

**Intensity index** — median uncapped ratio on days that are not zero. Missing for Yes/No.

A habit can be consistent and weak (every day at 20% of goal) or inconsistent and strong (twice a week at 300%). Week grade treats both harshly in different ways: the first pulls every day down a little; the second leaves five zeros in the denominator’s world. Perfect output treats the first as a low row and the second as a low row too, because the week sum is still capped at 100% of `goal × days`. **Uncapped weekly sum / (goal × days)** is the intensity the grade refuses to show. Publish it beside the capped row %.

---

## 3. Visualizations

Each chart exists to make one comparison the grid cannot hold still.

### 3.1 Habit–day heatmap

Rows are daily habits, columns are local dates, color is cell ratio. Exempt cells are a third state (not white-as-zero). `missedOpportunity` is a mark on top of the zero, not a third color in the ratio scale, because the grade does not see it. Newest on the right, matching the Habits mosaic. Scroll into the past without a cutoff.

Why: adherence, weekday stripes, and the week a habit was born (`auto` exemption to the left of `createdAt`) are visible at once. A mean hides the stripe.

Small-multiple version: one heatmap per habit, same date axis, so a tall catalog does not turn into mud. Sort rows by current effective weight, then by zero inflation.

### 3.2 Grade ribbons

Two horizontal ribbons, one for week grade and one for perfect output, each a stack of daily segments: raw in a quiet band, curved as the main band, blended as a tick if the toggle is on. Monday is a seam. Vacant days are gaps, not zeros. Under the ribbon, a thin mark for good days (threshold line drawn through the raw band).

Why: the curve bonus, the Monday reset, and the rail gap are the three ways the headline number moves. A single sparkline of “the grade” conflates them.

### 3.3 Distribution of daily grades

Histogram of raw day % over the chosen span, with the accomplishment threshold and the grade-bonus line (75, applied to the **curved rails**, so do not draw 75 on the raw histogram without a caption). Overlay the curved histogram only if tolerance &lt; 100, shifted by the bonus and with a spike at 0 that did not move.

Why: a mean of 70 can be “most days are 70” or “half are 100 and half are 40.” Good-day rate is the mass at or above 80 (default), which a mean does not tell you. The 75 bonus is a cliff on the curved rails; show how many days sit just under it.

### 3.4 Streak survival

For each habit, a Kaplan-style step curve: among day-streaks that reached length *k*, the share that reached *k+1*. Pool habits only inside a type (Yes/No with Yes/No). Mark the one-day grace so “today” is not plotted as a death.

A second curve for 4+ week streaks, in weeks.

Why: longest-streak is a record. Survival is the hazard: do streaks die at day 2 or at day 10? That is the difference between a start problem and a fade problem.

### 3.5 Recovery curves

After each miss, the cumulative share that have a met day by lag 1, 2, …, 14. Split by named miss vs blank miss.

Why: `missedOpportunity` is the person’s theory of a miss. If named misses return faster, the mark is a recovery ritual. If they return slower, the mark is an honest grave. The data can say which.

### 3.6 Priority waterfall

For one week, a waterfall of the day grade: start from 0, add each habit’s contribution `(cell percent / n)`, end at the raw day %. Color bars by effective weight (pin, neglect, both, neither). A second waterfall for perfect output uses row percents.

Why: the AV denominator gives every non-exempt habit an equal vote. The waterfall shows who spent that vote. Priority weight does not change the vote unless the blend toggle is on — draw the blend as a separate bridge from overall to shown, so nobody thinks the pin already changed the grade.

### 3.7 Small multiples per habit

One panel: weekday dots (mean ratio), a 12-week capped row-% line, an uncapped intensity line, stone count per week (0–7), and a rug of source winners. Climb habits add the target step (`weeklyGoalOn` or the committed base).

Why: clustering and substitution (below) are unreadable in one combo chart. The unit of understanding is the habit.

### 3.8 Source stack

100% stacked bar per week: met cells by trust winner. A paired bar for unmet cells that nevertheless have an auto observation (the machine spoke and lost, or spoke `unmet`).

Why: attribution. A “perfect” week that is 90% `coverage` at a grace-like threshold is a different achievement from a week of `manual`.

### 3.9 Climb target staircase

Step line of `weeklyGoalOn` or daily committed base, with hit/miss ticks. The Monday bump is annotated when the prior week’s hit count crossed 4.

Why: the target is endogenous. A falling daily score lowers tomorrow’s bar, which can inflate later percents. Without the staircase, “percent up” can mean “the bar moved down.”

### 3.10 Points stack

Daily stacked bar of the ledger: 50×ratio (split by habit or summed), accomplishment bonus, grade bonus (100 vs 300), day lift, 7-day beat, 30-day beat, and `rewardValue` crossings. Week-lift sits on Sunday.

Why: the points system is a bundle of cliffs (75, threshold, strict inequality vs yesterday and vs means). The stack shows which cliff paid. A high-point day can be a modest ratio plus a 300 bonus.

---

## 4. Statistical and learning analyses

These are questions, with an estimator that respects the grain. They are not automatic insights. Each one should show its *n*, the exemption rule, and whether it used Reader A or Reader B.

### 4.1 Habit clustering

Represent each daily habit as a vector of cell ratios on a shared set of required dates (exempt → missing, not zero). Cluster on that vector (correlation distance, so a rare habit is not “far” from a daily one merely by scale).

Also cluster the **weekday profile** (7 means) separately from the **level**. Two habits can share a Saturday spike and differ in overall rate.

Report clusters in words the data supports: “these move together,” not personality types. Minimum cluster size: leave singletons listed, not forced into a group.

Text habits cluster on met/unmet only. Do not cluster them with goal intensity.

### 4.2 Substitution

**Same-day substitution** — among pairs of daily habits, the rate both are met, versus the product of their base rates (lift). A large negative lift, stable across weeks, is “A instead of B.” Require a minimum of overlapping required days (suggest 28) so a new habit does not fake a substitution.

**Time substitution** — on days when both have a duration (observed tag minutes or a definite estimate), the sum of minutes versus each habit’s met indicator. If total minutes stay flat while the met pair flips, the day had a budget. If minutes rise with both met, they are not competing for the same hour.

**Source substitution** — `manual` falls in the weeks `tags` becomes the winner. That is not behavioral substitution. It is a measurement change. Flag it before any “they stopped doing it by hand” sentence.

Climb drops are not substitution. A lower chess log is the same habit moving.

### 4.3 Leading indicators of a bad week

Define a **bad week** in the app’s own threshold: Sunday raw week mean &lt; `accomplishmentThreshold`, or the week failing to be a good week. Fit a simple logistic model, or just a table of lift, using only information available by Tuesday night (or by Wednesday — pick one cutoff and hold it):

- Monday and Tuesday raw day %
- Count of named misses so far
- Number of habits with auto weight ≥ 1 at Monday
- Whether yesterday failed the day-lift (raw not above the prior day)
- Prior-7 mean already above or below the forming week
- Share of Monday–Tuesday cells whose trust winner was `manual` (engagement) versus empty
- For climb: count of weekly-cadence habits already unable to reach 4 hits (too many misses already banked)

The prior-7 and prior-30 means are **already** the app’s leading context: the bonuses pay when today beats them. Analytics should show the gap in percentage points, the same gap the good-day sheet shows, for every past day — not only today. Then “a bad week was visible on Tuesday” is a measured hit rate, not a story.

Do not use Thursday’s data to “predict” a week that ended Sunday if the claim is about an early warning.

### 4.4 Changepoints

The store’s real events:

| Event | Where it is | What to align |
|---|---|---|
| Habit added | `createdAt` or `task-{ms}` | Cell ratios after the first required day. Days before are `auto` exempt, not failures. |
| Priority set, refreshed, ritual, permanent | `priorityLog` + `priorityRefreshedOn` | Met rate and ratio in the next 14 required days. |
| All-nighter | the sleep log’s morning key, joined through `logExemptions` | Which habits went `logged` exempt that day. The grade should rise because the denominator shrank, not because the habit was done. Show the counterfactual grade **with** those habits still required, so the exemption is visible as an effect. |
| Window change | `habitWeekWindow`, `habitMonthWindow`, birthday | These change span grade without any cell changing. A chart of “span grade over time” must freeze the window or it will jump when the person picks “4 weeks.” |
| Tolerance change | `gradeTolerance`, `outputGradeTolerance` | Same warning. Plot raw underneath, always. |

**Not in the store, and this is the hard gap:** edits to `goal`, `increment`, `startValue`, `threshold`, `grace`, `floorPercent`, `trackingLink.mode`, and `completionSources` overwrite the habit. Historical percents recompute under the new line. A retarget from 10 pages to 5 pages rewrites every past day from 50% to 100% if the value was 5. Analytics cannot see the old goal.

Until a snapshot exists, the honest changepoint for a retarget is: **you cannot date it.** What you can do:

- Treat `updatedAt` on cells as edit times, not as evidence the target moved.
- For climb, the staircase of `weeklyGoalOn` **is** reconstructable from logs and the **current** increment. If the user changed `increment` last month, the staircase for last year is already wrong. Footnote that.
- Offer a manual “target as of” only if a future log is added. Do not pretend `completion.goal` is that log; grades ignore it.

### 4.5 Forecasting the grade

By Wednesday, the week grade is a mean of days so far plus unknown days. A transparent forecast, not a neural net:

**Frozen forecast** — assume each remaining day scores the mean of this week’s elapsed days.  
**Baseline forecast** — assume each remaining day scores the prior-7 mean (the same average the +5 bonus uses).  
**Habit-paced forecast** — for each habit, remaining days score that habit’s elapsed ratio; then recompute AV.  
**Requirement forecast** — the minimum raw score each remaining day must average so the week’s raw mean clears `accomplishmentThreshold`. That is `pointsStillNeeded` scaled to the leftover days. Show it as “each remaining day needs at least X,” which is the sentence the sheet already wants for a single day.

Perfect output forecast: each habit’s paced row percent if the remaining days match the elapsed ratio, then the mean. Name the habits that would have to go from 0 to 100 to move the output grade by 5 points (equal vote: one habit’s swing is about `100 / n`).

Coverage pace (`loggedShareOfElapsed`) forecasts the open period’s occupancy if the current density holds. It does not forecast a Yes/No that is not a coverage habit.

Do not forecast exempt future days as required, and do not forecast a habit before its creation day.

### 4.6 Difficulty versus follow-through

Difficulty proxies that actually exist:

| Proxy | Follow-through to pair it with |
|---|---|
| `goal` (pages, minutes, count) | Met rate, and uncapped mean ratio |
| Climb `increment` | Share of days with a gain at least the increment; Monday bump rate (share of weeks with ≥ 4 hits) |
| Coverage `threshold` | Stored occupancy; share of periods met. A threshold of 75 with occupancy stuck at 60 is a hard line. A threshold of 75 with occupancy at 95 is an easy one. |
| `listSent` grace | Raw ratio vs reported. Low grace is an easier line. |
| `dailyFloor` `floorPercent` and `allowAtZero` | How often the floor fails, and how many habits caused the failure |
| `timeEstimate` flat minutes or minutes-per-unit × typical value | Met rate. A 90-minute habit and a 2-minute habit are not the same adherence. |
| `rewardValue` | Not difficulty. It is a prize. Test whether higher prizes have higher met rates **after** controlling for type and frequency. Often they will not. |
| Tag-link threshold | Minutes required vs minutes painted |

**Follow-through residual** — met rate minus the met rate predicted by goal size within the same unit (pages with pages). A high residual is a habit the person clears despite a high bar. A low residual is a bar that is theater.

Daily-climb difficulty moves. The right difficulty measure on day *t* is `increment` relative to recent volatility of the score, not `startValue`. A +5 on a rating that swings 20 is easy; a +5 on a rating that moves 1 is a wall. The percent formula already divides by `increment`, so the grade calls both a “full hit.” The residual lives in the log, not the percent.

### 4.7 Measurement-change audit

Before any trend, a one-screen audit:

- Habits whose `completionSources` do not include `manual` (the cell is only as true as its pipes).
- Weeks where the trust winner mix shifted by more than 20 points.
- Goals whose current `goal` is below the median historical `value` (possible silent retarget, not proof).
- Cells with `updatedAt` more than 2 days after the period key (retroactive edits).
- Tolerance below 100 (the ribbon is inflated; say by how much).

---

## 5. Within-Habits combinations

The interesting claims are crosses. Each row is a cut the tab should be able to make without leaving Habits.

### 5.1 Priority × grade

| Cut | What it answers |
|---|---|
| Overall raw vs prioritized-subset raw, toggle off | Is the starred set actually ahead? |
| Shown vs overall, toggle on | How many points did the 50% floor add? |
| Habits with auto weight ≥ 2, their row % | Neglect is supposed to mark avoidance. Is the row still empty? |
| Pinned habits, weekday profile | Does a pin change Saturday, or only the sort order? |
| Star fade bucket (100, 50, 0) × met rate | Does the fading star track behavior? |
| Ritual-selected today × stones this week | The ×5 mark versus whether the habit is actually on the plate. |

### 5.2 Priority × sources

A neglected habit whose winner is `coverage` failed a paint threshold. A neglected habit whose cells are empty failed to be touched. Those are different interventions. Cross auto-weight with “share of cells that have any source reading.”

### 5.3 Grades × willpower

Stones count met days. Week grade counts partial credit. A week can have a high grade and few stones (many habits at 60%, none met) or a low grade and many stones (a few habits fully met, the AV denominator full of zeros). Scatter stones (x) against raw week grade (y). The distance from the diagonal is the partial-credit gap.

### 5.4 Sources × willpower

Stones use Reader B, so a keyword-met day is a stone. Stack stone counts by trust winner. If most stones are `dailyFloor` or `dailyCompletionAverage`, the plate is reflecting other habits, not a direct behavior. Say that in the caption. Those sources are **echoes**.

### 5.5 Daily tasks × period habits

“Daily task” in the habit form is still a `WeeklyTask`. The period habits that **read** daily habits are the combination:

| Parent source | Child grain | Honest chart |
|---|---|---|
| `habitValue` | sum of one child’s `value` | Child daily bars and the parent cell on the same week. Show `habitSumValue` and `value` if they differ. |
| `dailyFloor` | every daily row % | A strip of daily habits sorted by who broke the floor. |
| `dailyCompletionAverage` | mean of row % | This parent **is** an analytic. Plot it against week grade. They diverge when tolerance &lt; 100, when the priority blend is on, and when the week is in progress (the average uses all 7 days; the grade uses elapsed days). |

Do not average a weekly habit’s cell with a daily habit’s cell. Roll the daily habit up to the week first.

### 5.6 Willpower × periods

The plate is defined on the visible **week** of **daily** habits. Weekly, monthly, and season habits do not emit stones. A season of perfect monthly habits can sit next to an empty plate. The tab should say that, and offer an analogous “period stones” count (met period cells) that is **not** the plate, clearly labeled so it is not confused with `weekWillpowerStones`.

### 5.7 Grades × exemptions × all-nighters

Counterfactual week grade if `logged` exemptions were required. The difference is the all-nighter’s effect on the denominator. Pair with which named habits lifted (`describeAllNighterLifts`: bedtime, wake, dream).

### 5.8 Points × thresholds

A day just under 80 raw pays the 50×ratio and not the accomplishment bonus. A day at 80 pays both. A curved rail at 75 pays +100 or +300 regardless of the good-day line. Table the four quadrants (good day or not) × (either rail ≥ 75 or not) and the mean points in each. That is the incentive the settings actually created.

### 5.9 Frequency × the same human week

One civil week contains seven daily cells, one weekly cell, and (if the month or season boundary falls inside it) a partial monthly or season cell. The cross is: daily raw mean for those seven days versus the weekly-habit column percent versus whether the monthly habit’s month is on pace. Three numbers, three maps, one caption.

---

## 6. Information architecture

A Habits analytics area with six rooms. The first screen is not a gallery of charts. It is the grades the person already knows, with the raw number standing next to the shown number.

### Room A — This week

- Raw day % for each elapsed day, threshold line, vacant days marked.
- Week grade and perfect output: raw, curved, blended, tolerance, days included.
- Good-day flag for today, points still needed, prior-7 gap, prior-30 gap, yesterday gap.
- Stones: count and share.
- Points stack for the elapsed days.
- Forecast block: frozen, baseline, and “each remaining day needs X.”

As-of date is the same rule as the grid (`gradeAsOfForVisibleWindow`): the home date if it sits in the window, otherwise today, the window’s end, or “not started.”

### Room B — The habit

Pick one habit. Small multiple from §3.7. Streak survival for that habit alone if it has at least a handful of runs; otherwise current, longest, and last met date. Source stack. Exemption calendar. Priority log as a vertical list of dates, with the 14-day met rate after each line. Climb staircase if incremental. Uncapped intensity if it has a goal.

Empty state: created, no required period has a cell yet. See §7.

### Room C — The catalog

Heatmap (§3.1). Sort by the same modes the grid has (`default`, `alphabetical`, `created`, `priority`, `weeklyCompletion`) plus the analytic sorts: zero inflation, volatility, stone share. Filter by type and frequency. Priority waterfall for the selected week.

### Room D — Sources and echoes

Source stack. Echo warning for floor, sum, and daily-completion-average parents. Hand-override table. Coverage pace for open periods. List grace lift. Measurement-change audit (§4.7).

### Room E — Time structure

Weekday profiles. Weekend delta. Good week / month / season streaks beside the good-day streak, with the same threshold. Span grade for the frozen window the person has selected, plus the same grade under the other windows so a window change is not mistaken for a life change. Moon cut only when that window is selected, or behind an explicit control.

### Room F — Learning

Clustering (with *n*). Substitution pairs above a lift cutoff. Leading-indicator table for bad weeks, cutoff stated. Recovery curves, named vs blank. Difficulty residual within unit. Forecast error: last week’s Wednesday forecast versus the Sunday grade, so the forecast earns trust in public.

### Global controls

- Reader toggle: **Grade math** vs **Met** (default grade math on ribbons, met on streaks and stones — and the toggle is per chart, because a global toggle would lie).
- Exemption policy: drop (the app’s rule) vs count-as-zero (counterfactual).
- Curve: show raw always; curved and blended are layers.
- Span: the habits windows, plus a free last-28 / last-12-weeks that does not move when settings change.
- Priority blend: show the term even when the setting is off.
- As-of date, visible.

Do not put physics controls in this area.

---

## 7. Edge cases

**Skipped versus failed.** The grade cannot tell them apart. A missing cell and an explicit unmet Yes/No both contribute 0 once any habit has data. `missedOpportunity` is the only “this was a failure I name” bit, and scorers ignore it. Analytics should show three counts: blank, named miss, met. Never relabel a blank as failed.

**Partial credit.** Goal and climb percents and the 50-point ratio use it, capped at 100% / 50 points. Yes/No and text do not. Overshoot survives in `value` and nowhere in the grade. Week grade’s AV mean gives a 50% day half a vote, not a miss and not a hit. Good day uses the day mean against a threshold, so a day of partials can be “good” without any single habit being met, and a day of a few perfect habits can fail the threshold because empty siblings sit in the denominator.

**Zero stays zero.** No tolerance, blend, or bonus curve lifts a 0. A vacant (all-exempt) day is omitted, which is kinder than a zero. Do not draw those the same.

**Archived habits.** There is no archive. Delete strips cells and exemptions. Historical grades that included the habit cannot be reconstructed after delete. If Analytics caches a grade, it must recompute from the live store or it will disagree with the tubes. Orphan cells should not exist after `deleteTask`; if a backup still has cells whose id is gone from `tasks`, ignore them.

**Retroactive edits.** `updatedAt` is the last write. The previous `value` is gone. Undo may exist in the session (`rememberWorld` on habit writes) but it is not a queryable history. A cell edited on Friday for Monday counts fully in Monday’s grade. The measurement audit should list late `updatedAt`s. Text edits can be “quiet” and skip undo; they still change a text habit’s 0/1.

**No history yet.** No cells, or only auto-exempt periods: week grade has no open days or every day is vacant → grade 0 with `daysIncluded` 0. `averageWeekGradeAcrossWeeksWithData` returns null, not 0. Streaks are 0. Prior-7 mean of a brand-new store is 0 because empty days count as 0 — which will make the first real day “beat” the average and pay `weeklyAverageBeatBonus` if that day rounds above 0. Call that out; it is the formula, not a triumph. Auto priority does not accumulate for periods before the habit existed if those periods are exempt and therefore not “empty progress” in the same way — check ratio, which is 0 on an exempt day only if the scorer still reads the cell. Exemption removes the day from **grade** denominators. `autoPriorityWeight` uses `habitCellRatio` and does **not** skip exempt days. A waived day with no progress still looks empty to neglect. Analytics should compute neglect both ways and default to “required days only” when explaining a red wash, while noting the live wash counts empty exempt weeks too.

**Seed habits.** Ids `task-1` and friends have no `createdAt` parseable as a birthday from the id. They are never auto-exempt. Their history starts at the first cell, and the days before that are ordinary zeros if you average a calendar that predates the first log. Prefer “since first cell” as the default start for a habit that has no creation key.

**Retarget.** Current `goal` rewrites history. Say so on every goal chart. `completion.goal` is not the historical target for grades.

**Trust versus the tube.** A cell can be met by trust and still display a number the grade caps differently (coverage prints a capped label; the grade uses the stored value). A cell can show 30/30 and be unmet if a higher-trust source disagrees. Streaks follow met. Ribbons follow the tube. The habit page should show both when they differ.

**In-progress periods.** Week grade excludes future days. Weekly row % includes them as empty in the full-7 denominator (unless exempt). `dailyCompletionAverage` on a week matches that full-7 figure. A month average uses only days so far. Comparing “this week’s average” to “this month’s average” without saying which days are in the denominator is a false precision.

**Curve above 100.** Allowed. Do not clip the ribbon to 100 unless the label says “clipped for display.”

**Priority with no prioritized habits.** Blend is a no-op. Do not draw a floor.

**Mute and pin together.** Weight is the pin only. Neglect count is 0. The star can still be on.

**Good day at exactly 0.** Not good, even if the threshold were 0 (the threshold clamps to at least 1, and `rawPercent <= 0` fails).

**Multiple bonuses.** A single day can pay ratio points, accomplishment, 100 or 300, day lift, 7-day beat, and 30-day beat. Week lift pays on the week, not per day. Do not collapse these into one “bonus.”

**Echo habits.** Floor, sum, and daily-average habits move because other habits moved. Clustering them with their children double-counts. Default them out of clustering and out of “top habits,” and put them in Room D.

**Frequency quarterly.** Season keys `YYYY-Qn`. There is no fifth map. Do not invent a calendar-season key.

**Categories.** Do not group by `categories` or `categoryId`. They are not the live taxonomy.

**Goals and objectives.** No foreign key. Do not imply a habit serves an objective unless a later join is added.

**Willpower physics and gem photographs.** Not metrics.

**Deleted source links.** Turning a link to `null` means “preset off.” `undefined` means “preset may still apply” for coverage, floor, sleep, list, and log exemptions. An analyst reading only stored JSON must use the same `effective*` helpers or will mis-count presets.

---

## 8. What this vision refuses to do

- A second grade with a new formula.
- Treating blank as failed, or `missedOpportunity` as an input to the grade.
- Clipping overshoot out of the intensity view.
- Explaining a tolerance change, a window change, or an all-nighter exemption as a change in effort.
- Dating a goal retarget the store did not log.
- Reading Goals as if they were habits.
- Reading the willpower integrator as if it were a score.

The tab’s job is to hold the app’s own arithmetic still long enough to see structure: who voted in the average, which pipe filled the cell, which miss was named, which zero was a waiver, and whether the week was already gone by Tuesday.
