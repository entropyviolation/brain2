# Points

Widget id: `home-widget-points`

Runtime id is `points` (`data-widget="points"` on the Home strip). The square is `PointsBoard` in `components/Home/points-stats.tsx`, opened through `HomeWidgetDialog`. It is second in the strip and showing. Follow the clock is off, so the four lines follow the selected day.

Data: live Electron localStorage, unprefixed `points-store`, origin `http://localhost:3000`, read from the LevelDB log in `~/Library/Application Support/cogs/Local Storage/leveldb` (823 rows). The hub file `data/shared-persist.json` (`updatedAt` 2026-10-10T06:12:56.381Z, source `electron`) has the same 823 rows and the same totals; only array order differs. Figures below are that ledger for Friday 9 Oct 2026, the last day with rows. Hues and layout are `brain2-habits-store` and `brain2-home-widgets` (the `cogs-*` twins match). The bare `habits-store` / `task-storage` blobs are an older, smaller copy and were not used. No demo profile.

Snapshot: all time **15,137.5** across 69 days (8 Jun–9 Oct 2026), today **464**, this week (Mon 5–Sun 11 Oct) **3,472.5**, this month **4,359.2**.

## a. Biggest problems right now

The square adds unlike things into one integer-looking score, then annotates a different scale.

Today’s 464 is 350 from 7 full daily-habit rows (50 each), 58 from inbox handling (1 each), 50 from the week-grade lift, 5 from beating the prior 30-day average, and 1 from a scheduled task. The footer does not say that. It says **+1 possible**, because “possible” is only `rewardValue` on incomplete tasks that have a `scheduledDate`. Eight such tasks exist in the whole task vault. Today’s remainder is 1, the week’s is 3, the month’s is 4. The detail meters are earned ÷ (earned + that remainder), so they sit at **99.8% / 99.9% / 99.9%**. Twenty-eight daily habits are on the sheet. Seven have paid. That is 25%, under the stored accomplishment line of 30, so today’s +50 raw-day bonus is absent. The bar still reads as a finished day.

The same week-scoped bonus is in the week total four times. `habit-weekly-grade-lift:2026-10-05_2026-10-11` is 50 points on 5 Oct, 6 Oct, 7 Oct, and 9 Oct (200 altogether). `upsertPoints` replaces a row only when task id and date match, and the sync dates the row as “today,” so each new day keeps yesterday’s copy. Oct 8 has no copy. This week’s 3,472.5 includes all 200. Today’s 464 includes one of them, with no label. Older weeks in this ledger have that id once.

The line chart hides what the spikes are. In the last 14 days the floor is 100 (28 Sep and 1 Oct) and the ceiling is 1,095.7 (6 Oct). In the last 30 days the ceiling is 1,307.2 (23 Sep) and the only zeros are 10–11 Sep. Those peaks are not the same kind of day:

| Day | Total | What dominates |
| --- | ---: | --- |
| 23 Sep | 1,307.2 | 16 habit-day rows (745.2), one 300 “both grades 75%+” bonus, 153 inbox rows (153) |
| 21 Sep | 1,148 | 14 habit-day rows (700) and a 300 grade bonus |
| 6 Oct | 1,095.7 | 15 habit-day rows (676.7) and a 300 grade bonus |
| 5 Oct | 1,079.8 | 18 habit-day rows (803.3) and a 100 “either grade 75%+” bonus |

All time, habit-day rows are 10,284.3 (68% of 15,137.5). Grade, raw-day, lift, and average-beat bonuses are another 4,055 (27%). Inbox is 238 rows and 238 points (29% of the rows, 1.6% of the points). A day that is an inbox sweep and a day that is a 300 grade bonus draw the same kind of peak.

The ledger also has 55 days with no rows inside 8 Jun–9 Oct, including 23 Jul–16 Aug. Neither sparkline reaches that gap. Twenty duplicate task-id-and-date pairs add 17.5 points. Twenty-eight rows are fractional (partial habits, a few 0.5 objective bonuses), which is why all time, week, and month render with a tenth: `15,137.5`, `3,472.5`, `4,359.2`.

## b. Layout, UI, design, and style

The strip tile is one milled bay, 156px, caption, one CRT, one footer. That matches the Home instrument in `docs/DESIGN_STYLE.md`: one glass, equal-height siblings, phosphor on the value (`#7dffc4` on `#040a08`), not four white cards. `PointsStats` still knows how to draw those cards, and `ScoreWell` still knows the old four-gem wells. The strip does not use either. Keep it that way.

### Overview

Four periods share one CRT at 11px, labels at 9px uppercase. Every other showing square puts one value in that glass at about 20px. All time (`15,137.5`) and today (`464`) get the same weight, so the number that changed today is not the readout. The footer can hold one line and currently spends it on `+1 possible`, because any positive task remainder hides “Total earned.” Week and month remainders never appear on the square.

The open target is a button with `cursor: default`. The today flash toggles `is-flash` on the line, and the only flash rule is `.hab-score-readout.is-flash`, so the stacked CRT never blinks.

The caption lamp is hardcoded `#7e14ff`. The live Percent LED is `#1f7a74`, the week-grade tube `#508b51`, the perfect-output tube `#25366a`. The tile does not use them. “Week” does not say Monday–Sunday, and it does not say Saturday and Sunday are still ahead (both are 0).

### Detail view

The dialog is the shared silver handheld (`min(34rem, …)`, radius token 18px, power lamp, close key). Inside, four wells sit in a 2×2 grid, then two sparklines. All-time has no meter, so that well is shorter than the other three even with the 52px minimum. The meter fill does use the live three hues, passed in as CSS variables. The digits do not. They are `--friend-nixie` (`#4a7fd4`), and the spark stroke is the same navy. The style sheet’s CRT rule is one green. The catalog calls these “navy wells,” and the dialog comment agrees with the catalog. Opening the tile therefore changes the material: phosphor lines become navy LCD digits. The empty spark copy (“No points in this window yet”) does not apply to this ledger. Both charts have signal, and neither chart has a max, a date, or a mark on 23 Sep or 6 Oct. The 14-day chart is the right-hand half of the 30-day chart, drawn again, still with a zero baseline (`Math.min(…, 0)`), so a 100-point day sits on the floor under a 1,096-point day and the picture has no scale.

There is no list. The neighboring Latest award square already shows eight recent positive rows. This dialog, which owns the totals, shows none of the 68 rows that make up today.

## c. New features for the detail view

1. **Source stack for the selected day, week, and month.** Three rows are enough: habit days, bonuses, and one-point handling (inbox and other task credits). For today that is 350 / 55 / 59. For 23 Sep it is what separates a 300 grade bonus and a 153-row inbox pass from a habit day. Group the +1 rows. Do not list them one by one.

2. **One week strip instead of two unlabeled sparklines.** Monday 5 Oct through Sunday 11 Oct, with the amount on each day (1,079.8, 1,095.7, 398, 435, 464, and 0, 0). Mark a day that contains a 300 grade bonus. Name the max on the longer chart (1,307.2 on 23 Sep) and the two zero days at the start of the 30-day window (10–11 Sep). Leave the Jul–Aug hole out of this chart. It is real, and it is outside the window.

3. **Habit remainder, not task-reward remainder.** The meter should be daily habits paid against the 28 on the sheet, and it should say when the day is under the stored 30% accomplishment line (today is 7, so the +50 raw-day bonus has not been written). The +1 / +3 / +4 task rewards can sit in the source stack as a one-point line. They should not fill the bar.

4. **A repeat mark on a week-scoped id.** When `habit-weekly-grade-lift:2026-10-05_2026-10-11` is present on four dates, the week well should show 200 as 50 × 4 days, and today’s well should show its 50 as that bonus, not as part of an unmarked 464.

5. **The tenth, on purpose.** All time, week, and month are not whole numbers (28 fractional rows, 505.5 points). Either keep one decimal on every well, including today when it is whole, or show the tenth only in the source stack so the CRT can stay a whole phosphor figure.
