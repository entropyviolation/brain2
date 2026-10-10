# Day score

Friday 9 Oct 2026 is one day. Points, Today's Progress, Harvest leftover, Latest award, Day lamp, Already flowing, and the pet's habit count each score it with a private formula. The faces disagree.

Widget day is the wall clock. Follow the clock is on, so `homeWidgetDate` in `lib/home-widgets.ts` gives `2026-10-09`. The Home cursor is pinned to `2026-09-24`. These tiles already receive that widget day from `components/Home/home-overview.tsx`, except Latest award, which ignores it.

Live reading for that Friday:

- Habits: **7 done**, **1 miss** (`wake up before 9`, `missedOpportunity`), **20 blank**, of **28** daily. None exempt.
- To-dos: **11/12**. The open title is `process inbox information`.
- Ledger sum (`getDayPoints`): **464** = **350** habit-day rows (7 × 50) + **55** bonuses (weekly grade lift 50 + prior-30-day beat 5) + **59** other rows (58 inbox handles + 1 other).
- Habit points still unpaid: **1,050** of a **1,400** ceiling. Each full daily habit is `DAILY_HABIT_COMPLETION_POINTS` (50) via `dailyHabitDayPoints`. The 21 short habits are at ratio 0. Habit `rewardValue` (10–40) is not this pool.

What the tiles say instead:

- Harvest (`HarvestTile` → `harvestFace(getDayPoints, getPossibleDayPoints)`): CRT `1`, footer `1 left of 465`. The `1` is one incomplete scheduled to-do's `rewardValue`. The 1,050 is never read.
- Points (`useHomePoints`): footer `+1 possible`. The today meter is 464 ÷ (464 + 1), about **99.8%**. `weeklyData` is loaded and then ignored.
- Today's Progress (`DailyProgressQuickview`): habit CRT `21 left · 25%`. The miss and the 20 blanks are one leftover. The footer `To do 11/12 · habits 7/28` is the true pair and is the smaller line.
- Latest award (`latestPointAward`): CRT `+1`, footer `Inbox handled: make it real with berggruen`. Same-day +50s sit earlier in the array, so the walk replaces them. The dialog's eight rows are all inbox handles. Desktop and hub copies of the same 823 rows already pick different faces, because a row has no write time.
- Day lamp (`dayLampWord`): **Warm** because the unweighted mean of 25% and 92% is **58.5**. Bright starts at 60. Finishing the last to-do would make the mean 62.5 and the word Bright, with the habit sheet still 7/28.
- Already flowing (`flowingCounts` on the whole task array): **Mixed**, footer `7 already · 11 new`. The 11 are six `habit-done-` mirrors from `syncHabitDoneLog` and five `pen-action-` rows from `penActionLogId`. No older to-do was closed. Dropping those generated rows leaves Flowing, `7 already · 0 new`.
- Screen pet habits well: `7/28`. The miss and the blanks are the same kind of not-done. Pose stays asleep at hour 23; the sprite is a different plan.

Harvest and Already flowing are in `hidden`. Fix their math. Leave them hidden.

## Do these, in order

1. **Add one today reading, and make the other steps call it.** This is the useful change: every later face is a view of these four facts, so a tile cannot invent a fifth remainder. Extend `homeDayStatsOf` / `useHomeDayStats` in `components/Home/home-day-stats.ts` (Progress, the pet, Day lamp, and Already flowing already share this hook) with the habit piles and the points facts below. Pure helpers may live beside it or next to the id builders in `lib/habit-points.ts`. `useHomePoints`, `HarvestTile`, and `AwardTile` must call the same helpers. `AwardTile` in `components/Home/home-overview.tsx` must take the same `currentDate` the other tiles already get.

   Habit piles, same filters as today (`filterHabitsByFrequency` daily, `isHabitPeriodExempt` dropped, `isHabitGoalMet` for done): a met cell is done; an unmet cell with `isMissedOpportunity` (`lib/habit-missed-opportunity.ts`) is a miss; every other unmet daily is a blank. To-dos stay the existing count: not `hiddenFromTodo`, `taskScheduledOnDay`.

   Points split for that date key, from `pointsHistory`: habit rows are `habitDayPointTaskId` (`habit-day:`); bonus rows are `gradeBonusTaskId`, `rawDayBonusTaskId`, `dayGradeLiftTaskId`, `weeklyGradeLiftTaskId`, `weeklyAverageBeatTaskId`, `monthlyAverageBeatTaskId`; everything else on that date is the other pile. The three sums must add to `getDayPoints`.

   Unpaid habit points: for each non-exempt daily, `DAILY_HABIT_COMPLETION_POINTS - dailyHabitDayPoints(...)`. Ceiling is 50 × the daily count. Do not read `rewardValue`. Do not add inbox rows or `getPossibleDayPoints` into the ceiling.

   Worked when a fixture for this Friday returns 7 / 1 / 20 of 28, to-dos 11/12, points 350 / 55 / 59 summing to 464, unpaid 1,050 of 1,400. The miss name is `wake up before 9`.

2. **Stop using the unpaid to-do reward as the day's remainder.** Points and Harvest both treat `getPossibleDayPoints` (sum of `rewardValue` on incomplete tasks with `scheduledDate` today — **1**) as what is left. That is why the day looks finished. Keep `getPossibleDayPoints` only as a labeled side figure.

   Points: in `useHomePoints` (`components/Home/points-stats.tsx`), the today footer names the split (350 habits, 55 bonuses, 59 other). The today meter fill is habit points paid over the habit ceiling, 350/1,400 = 25%, matching the sheet. It must not be ~99.8%, and the footer must not be `+1 possible`. Leave the CRT at 464. The one weekly-lift 50 inside the 55 stays; it is a real row on this date (`habit-weekly-grade-lift:2026-10-05_2026-10-11` plus `habit-monthly-avg-beat:2026-10-09`).

   Harvest: `HarvestTile` (`components/Home/home-glance-tiles.tsx`) passes habit paid and habit unpaid into `harvestFace` (`lib/home-glances.ts`), not the mixed 464 and the task `1`. CRT `1050`, footer `1050 left of 1400`. Detail wells are paid 350 and unpaid 1,050. A third well may show the to-do reward **1**, labeled as a to-do reward. `lib/home-glances.test.ts` already expects `harvestFace(48, 42)` → `42 left of 90`; add `harvestFace(350, 1050)`.

3. **Show the habit piles on Progress and on the pet's habit count.** `DailyProgressQuickview` (`components/Home/daily-progress-quickview.tsx`) paints `21 left · 25%` from `habit.remaining`. The instrument habit line should be 7 done, 1 miss, 20 blank. Keep the to-do line (1 left, 11/12) and the footer `To do 11/12 · habits 7/28`. `ProgressDetail` in `components/Home/home-overview.tsx` splits `remainingHabits` the same way: the miss `wake up before 9` is its own row, the 20 blanks stay a separate fold, and the nixie `21` goes away. A sheet with no miss and no blank may keep a zero-left line so `daily-progress-quickview.test.tsx` (1 of 1 habits done) still holds.

   Pet, habit count only: the Habits well in `components/Home/home-screen-pet.tsx` is `stats.habit.completed/stats.habit.total`. Show 7 done, 1 miss, 20 blank beside 7/28, from the same piles. Do not change `petPose`, the sprite, the clock, or the asleep footer.

4. **Let Latest award show this day's +50s.** `latestPointAward` (`lib/habit-points.ts`) keeps the newest date, then replaces the pick on every later same-day row. On the desktop that last row is the inbox +1. `recentPointAwards(..., 8)` then lists eight inbox lines, so the grade lift, the +5, and the seven habit completions never appear. `AwardTile` (`components/Home/home-award-tile.tsx`) does not take a day.

   Pass `currentDate`. On that day, prefer a bonus row or a `habit-day:` row over a later inbox handle (`inboxHandleLabel` / `Inbox handled:`). Among those, prefer the larger points, and break ties by task id so array order cannot change the face. For this Friday the CRT is `+50` and the footer is the weekly grade lift (`Higher habit grades than last week`, id `habit-weekly-grade-lift:2026-10-05_2026-10-11`). The dialog leads with the shared split: 350 habit, 50 grade lift, 5 prior-30-day beat, 59 other, sum 464. The eight-row inbox window may remain under that. It cannot be the only view.

   The existing `latestPointAward` test (a later `habit-day:` +50 beats an earlier +4 on the same day) still holds. Add the 9 Oct case: an inbox +1 written after the grade-lift +50 still yields the +50. Hub order and desktop order agree.

5. **Make the Day lamp follow the lower bar.** `dayLampWord` (`lib/home-widgets.ts`) averages whichever of habit percent and to-do percent exist, then bands at 20 and 60. `DayLampTile` (`components/Home/home-day-lamp.tsx`) explains Warm as that average. Tonight the average is 58.5, so one open to-do is all that keeps Friday out of Bright.

   When both bars exist, the word uses the lower percent. The bands stay. Full stays "every present bar is 100." Quiet stays "both totals are 0." A single bar still uses that bar. Update `LAMP_WHY` so Warm is the lower bar, not "the average is between 20% and 60%." The detail already prints both fractions; add the piles (7 done, 1 miss, 20 blank) so the word has the same body as Progress.

   Worked when 25 and 92 stay Warm, and 25 and 100 stay Warm (not Bright). The check in `lib/home-widgets.test.ts` that expects Bright for habit 80 and to-do 50 becomes Warm, because 50 is the lower bar. Habit 40 with no to-dos stays Warm. Both at 100 stay Full.

6. **Stop counting generated Done rows as new work.** `AlreadyFlowingTile` (`components/Home/home-reading-tiles.tsx`) passes every task into `flowingCounts` (`lib/home-glances.ts`). A completed row whose `createdAt` and `completedDate` share the local day increments "new." `syncHabitDoneLog` (`lib/habit-done-log.ts`, id from `habitDoneLogId`) and pen-action sync (`penActionLogId` in `lib/pen-action-format.ts`) create rows that way on purpose.

   Inside `flowingCounts`, skip ids prefixed `habit-done-` and `pen-action-`. Leave real same-day to-dos in "new." Do not change the writers. For this Friday the word is **Flowing** and the footer is `7 already · 0 new`. The habit well matches Already (7). The Mixed sentence must not show. The current unit example (an older completion plus one real same-day completion, plus 2 habits → flowing 3, pushed 1) stays; add the two generated prefixes and show they do not increment pushed.

## One shared seam

One object for the widget day, built in `homeDayStatsOf` and read through `useHomeDayStats`. Points, Harvest, and Award call the same pure split and unpaid helpers so they cannot keep a second remainder.

| Field | 9 Oct |
| --- | --- |
| `dayKey` | `2026-10-09` |
| Habits | 7 done, 1 miss, 20 blank, total 28 (25%) |
| To-dos | 11 done, 1 open, total 12 (92%) |
| Points | 350 habit, 55 bonus, 59 other, sum 464 |
| Habit pool | 350 paid, 1,050 unpaid, ceiling 1,400 |

`getDayPoints` remains the ledger sum. `getPossibleDayPoints` remains the scheduled to-do `rewardValue` still open (1). Neither number is the habit pool.

Dialogs that say "today" while the Home cursor is `2026-09-24` name `Fri 9 Oct` in the existing note or lead. That day is also 7/28 habits, with a different seven and with to-dos 9/9. The strip caption type stays as it is.

## Leave for later

These are real, and they are not what makes Friday's faces agree.

- The weekly grade lift is written again each day. `syncWeeklyGradeLifts` in `lib/habits-store.ts` dates `weeklyGradeLiftTaskId` as today inside the open week, and `upsertPoints` only replaces the same task id on the same date. That id is on 5, 6, 7, and 9 Oct (200 in the week). Today's 55 correctly includes one 50. A write-once, or a "50 × 4" mark on the week well, can wait.
- Ledger rows have no clock, so two copies of the same 823 rows disagree about "latest." Step 4 does not need a timestamp. Persist one later if a true last-write face is wanted.
- Points charts, the tenth on fractional rows, and a repeat mark in the week well.
- Harvest's list of 21 unpaid names, and a status line that raw completion is 25% under the stored accomplishment threshold (30) so the +50 raw-day bonus was not written. `rawDayBonusPoints` already knows that. It does not change the 1,050.
- Why `complete 1 to-do list item` is still blank beside to-dos 11/12, and a key to complete `process inbox information`.
- Climb targets in the blank list (chess, last score 355, derived target 365).
- Day lamp color, the header pip, and the weekly 3/17 and monthly 0/5 wells. The word change in step 5 is the part that stops a cleared to-do list from calling a quarter-done habit sheet Bright.
- Flow tints, a "Logged" list of the six mirrors and five computer blocks (516 minutes, the work habit), and spelling out the twice-the-other rule.
- Pet pose, meridiem, and a night sprite for an underway sheet. Step 3 only changes the habit count.

## Do not

- Do not remove `harvest` or `flow` from `hidden`. Hidden is why they are off the strip. The math should be true when Widgets turns them on.
- Do not restyle overview type. Caption size, CRT size, and the overview font change are already underway.
- Do not add a feature this Friday's data cannot fill: no grade-bonus remainder, no write time, no Jul–Aug sparkline, no inbox rows inside the 1,400 ceiling.
- Do not score the habit pool from `rewardValue`.
- Do not change `petPose`.
- Do not edit the research reports or `docs/widget-improvement/README.md` as part of this work.
