# Habits plates — build brief

One later owner: a habits-plates agent. Touch only `components/Analytics/HabitsView.tsx`, `StreaksWidget.tsx`, `PointsView.tsx`, and new habit plate files beside them. Leave Tracking and Plan alone. Do not rewrite `docs/analytics-vision/02-habits.md`.

Home-matching grade math stays the source of the numbers. Analytics draws those numbers; it does not invent a second grade. Reader A is the grade (`calculateDayPercentageAV` and the week, output, and period grades). Reader B is met (`isHabitGoalMet`). Label which reader a plate used. Round to a whole percent only for a lift or a points-still-needed gap.

## Plates already drawn

Keep these. Add beside them.

| Plate | Where | What it already is |
| --- | --- | --- |
| Week grade, month grade, good days | `HabitsView` readouts | Shown grade, with a raw note and days included. Good days: streak, last-30 count, threshold. |
| Tracking-linked | `HabitsView` readout | Count of habits with a tracking link versus manual. Extend this; do not remove it. |
| Climb | `HabitsView` | Bars of climb values. |
| Density calendar | `HabitsView` | “Daily habit completion heatmap.” |
| Sorted bars | `HabitsView` | “Habit completion ({range}).” |
| Habit % lag | `HabitsView` | Trace of daily habit completion percent, plus r(1) and r(7). |
| Horizon | `HabitsView` | “Horizon · daily %,” three folded bands. |
| Slopegraph | `HabitsView` | “Weekday vs weekend.” |
| Current and longest | `StreaksWidget` | All-time, not clipped to the Analytics window. Optional week-habit streak. Daily review streak stays. |
| Points stack | `PointsView` | Daily stacked habit / bonus / task, cumulative line, source split, top earners. Stays here. Do not fold it into the grade ribbon. |

## Additions

### 1. Three layers, kept apart

**Question.** What was the raw day, what did the curve do to it, and what did the 50% priority blend add?

**Chart.** A grade ribbon on `HabitsView`, beside the week and month readouts. Three marks, never one blended number: raw day percent, curved grade (`curveDayPercentage`: 0 when raw ≤ 0, otherwise raw + (100 − tolerance); it does not cap at 100), and the blend tick when `gradeUsePriority` is on (`displayed = 0.50 × prioritized + 0.50 × overall`). Vacant days are gaps. A future day is not in the week mean. Caption the tolerance and the curve bonus (`100 − tolerance`). Good-day marks sit on the raw band. The threshold (`accomplishmentThreshold`, default 80) is raw, or the blended day score only when `goodDaysUsePriority` is on. The curve is not consulted. Say that on the plate.

**File.** `HabitsView.tsx` (ribbon can live in a new habit plate file imported from there).

**Keep working.** The existing week-grade and month-grade readouts, including their raw notes. Home-matching grade math. Good-days readout and its threshold.

### 2. Streak survival and recovery lag

**Question.** Of streaks that reached k, how many reached k+1? After a miss, how many required days until the next met day, and was the miss blank or named?

**Chart.** On `StreaksWidget`, under the current/longest list: a survival curve (share that reached k+1 among streaks that reached k; pool inside one type; mark the one-day grace; a second curve for 4+ week streaks). Beside it, a recovery curve: cumulative share met by lag 1…14, split blank miss versus named miss (`missedOpportunity`). A miss is a started, non-exempt day that Reader B calls unmet. Both kinds are misses to the math; the second count is the named ones. Censor a gap that still contains today. Do not call an exempt day a miss or a recovery. Return rates within 1, 3, and 7 required days can sit as captions on that curve.

**File.** `StreaksWidget.tsx`.

**Keep working.** Current and longest all-time, not clipped to the window. Week-habit streak line. Daily review streak. Today unfinished does not break a habit streak. Exempt days neither count nor break (`streakSkippingExemptDays`).

### 3. Priority waterfall

**Question.** Who actually votes in the day average, and did a pin change the shown grade or only the weight?

**Chart.** On `HabitsView`, for the selected week: each habit’s `(cell percent / n)` vote. Color pin, neglect (auto weight from consecutive empty periods, cap 52), both, and neither. Mute forces the auto term to 0; a pin still counts. Any progress (ratio > 0) breaks the neglect run. The blend is a separate bridge from overall to shown, drawn only when the toggle is on, so a pin does not look like it already moved the grade. Show the prioritized-subset score even when the blend is off.

**File.** `HabitsView.tsx`, new plate file.

**Keep working.** Sorted completion bars. Grade ribbon in addition 1. Star half-life (100, then −10 per day, 0 on day 10, held by `priorityPermanent` or the ritual) is not this waterfall.

### 4. Source attribution and echo habits

**Question.** Which trust source won the cell, and which habits are echoes of other habits?

**Chart.** Extend the tracking-linked readout into a source stack on `HabitsView`: met cells by trust winner (`manual`, `tags`, `taggedTasks`, `coverage`, `sleep`, `list`, `dailyFloor`, `habitValue`, `dailyCompletionAverage`, `listSent`, `keywords`), per week. Paired bar for unmet cells that still have an auto observation. Caption echo parents — daily floor, habit-value sum, daily-completion average — and keep them out of “top habits.” Hand versus tag (`manualValue`, `trackedValue`, mode `add` / `max` / `replace`) stays visible because the tracking-link split is already there.

**File.** `HabitsView.tsx`.

**Keep working.** The “Tracking-linked … vs manual” readout. TEXT and climb are not tag-link targets. Grades still divide by `WeeklyTask.goal`, not by a `goal` snapshot on the cell.

### 5. Consistency versus capped intensity

**Question.** How often is the habit present, and how far past the goal did the log go on days the grade called 100%?

**Chart.** Beside the sorted bars on `HabitsView`: consistency (1 − zero inflation among required days since `createdAt`) against capped row percent (the grade’s `min(100, value / goal × 100)`). A second mark, uncapped intensity `value / goal`, allowed to exceed 1, and the weekly form the grade refuses: uncapped weekly sum / (goal × days). Overshoot mass is the part above 1. Yes/No has no intensity; leave it off this plate. Text length is not a substitute.

**File.** `HabitsView.tsx`, new plate file.

**Keep working.** The capped bars and the heatmap, which stay on the capped percent. Climb bars.

### 6. Week-grade forecast

**Question.** If the rest of the week looks like the past we already have, where does Sunday land, and what does each remaining day still need?

**Chart.** On `HabitsView`, next to the week-grade readout. Three honest paths only: frozen (remaining days score this week’s elapsed mean), baseline (they score the prior-7 mean), and points still needed (minimum raw score the remaining days must average so the week clears the threshold; also the unrounded disagreement when a raw 79.6 against 80 is not a good day while the rounded gap says 0). Empty weeks in the baseline are skipped, not scored 0. If the sample cannot support a path — no elapsed day, no prior week with data, no remaining required day — draw an empty frame with that sentence. Do not print a fake number. Do not forecast an exempt future day as required, or a habit before its creation day.

**File.** `HabitsView.tsx`, new plate file.

**Keep working.** The live week-grade readout, which is still the grade of days that have happened, not the forecast.

### 7. Exemptions drop both sides

**Question.** Which periods left the fraction, and which named misses the grade still ignores?

**Chart.** A thin exemption calendar on `HabitsView` (or marks on the density calendar): waived periods are absent from both numerator and denominator, not zeros. `required` does not waive. `auto` waives a period that ended before the habit existed; the creation day stays required. `waved` is the wand. `logged` is daily only. `missedOpportunity` may be a mark on a zero. It is stored. Grades, percents, streaks, gems, and points do not read it. Do not start counting it as a grade input. Say that on the plate.

**File.** `HabitsView.tsx`. The density calendar stays; this is a mark or a companion, not a replacement.

**Keep working.** Day percent and rates already drop exempt periods from the denominator. A fully exempt day stays vacant and out of the week mean.

### 8. Retarget timeline — empty on purpose

**Question.** Someone will ask when the goal changed.

**Chart.** An empty frame, only if that question is surfaced. Sentence: goal edits are not stored, so a retarget timeline cannot be dated. There is no archive flag, no goal-edit history, and no Goals-to-`WeeklyTask` link. Do not invent those charts. `updatedAt` is the last cell edit, not proof the target moved. Historical percents divide by the current `WeeklyTask.goal`.

**File.** `HabitsView.tsx`, only as that empty frame. No new store fields.

**Keep working.** Every plate that divides by the current goal.

### 9. Points stay a stack

**Question.** Which ledger paid, on which day?

**Chart.** None new. `PointsView` remains the points stack: 50×ratio (`habit-day`), grade bonus, raw-day bonus, day lift, week lift (on the week, not on every day), 7-day beat, 30-day beat, and one-shot `rewardValue` on the not-met → met edge (Reader B). Do not fold this stack into the grade ribbon.

**File.** `PointsView.tsx` — leave its four plates (daily stack, cumulative, source split, top earners).

**Keep working.** Those four plates and their window.

## Do not build

- A second grade that disagrees with Home.
- Counting `missedOpportunity` inside a percent, a streak, or a point.
- Archive, category, or goal-history charts. `categoryId` is deprecated.
- A Goals or objectives join. A habit does not carry an objective id.
- Willpower as a stored score. Stones are a function of completions if a later plate wants them; they are not an input to these additions.
- Tracking or Plan plates. Tag-minute agreement with the cell is a Habits × Tracking question and stays out of this owner’s files.
