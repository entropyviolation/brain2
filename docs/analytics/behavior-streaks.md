# Behavior → Streaks

_Last mapped: 2026-10-23_

View id `streaks`. File `components/Analytics/StreaksWidget.tsx`. Math in `components/Analytics/behavior-stats.ts`. Not clipped to the Analytics range.

## Data in

- `useHabitsStore`: `tasks`, `weeklyData`, `habitExemptions`. `useExemptionContext()`.
- `useReviewsStore`: day reviews, for the daily review streak.
- Current and longest come from `streakSkippingExemptDays` (`lib/habit-exemption.ts`). Week streak from `lib/habit-week-streaks.ts`.

## Plates

1. Readouts: best active habit streak, daily review streak with best.
2. Habit streaks list. Top 8, then **Show all n**.
3. **Now against best** (new). Ghost bars: the current run solid over the all-time longest, dashed. The right column says "n to go" or "record".
4. **Era bars** (new). Every run on the calendar, one row per habit, sorted by record. Height is run length against the longest run of any habit. The record is black, a run still going has an amber edge. A slider sets the span (14–365 days). Hover gives start, end and length.
5. **Odds a run goes on** (new). For runs that reached k days, the share that reached k + 1, pooled over all habits. The hint names the weakest day (at least 3 runs at risk).

## Math

- `runsOver(days, markOf)`: runs of done days; exempt days bridge a run and add nothing, like `streakSkippingExemptDays`.
- `runContinuation(runs)`: discrete survival. At risk at k = runs with length ≥ k. Broke at k = closed runs of length k. Runs still going are right-censored, so they are at risk but never broken (Kaplan and Meier 1958).

## Fixes in this pass

- Habit streaks now pass the exemption context to `isHabitPeriodExempt`. Before, sleep-driven exemptions were in the memo deps but not used, so those days broke a streak.
- `weekStart` is keyed on today's date, so the memos do not rerun on every render.
- Removed the kicker that repeated the view help.

## Research notes

- IIB moves used: **Era bars** and **Anchored bars** (ghost of the best). See `docs/analytics/viz-inspiration.md` → Streaks.
