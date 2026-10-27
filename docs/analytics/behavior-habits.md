# Behavior → Habits

_Last mapped: 2026-10-23_

View id `habits`. File `components/Analytics/HabitsView.tsx`. Math in `components/Analytics/behavior-stats.ts`. Styles in `components/Analytics/behavior-views.css`.

## Data in

- `useHabitsStore`: `tasks` (habits), `weeklyData[dateKey][habitId]` (a log), `habitExemptions`, `gradeTolerance`, `accomplishmentThreshold`.
- `useExemptionContext()` from `lib/sleep-store` (sleep-driven exemptions).
- `useTaskStore` and `usePointsStore` for the headline row only.
- A day mark per habit is one of: **done** (`isHabitGoalMet`), **partial** (logged but short of the goal), **missed** (no log), **exempt** (`isHabitPeriodExempt`, with the context).

## Plates, top to bottom

1. Daily habit completion: density calendar of `calculateDayPercentageAV`.
2. Headline readouts: points, tasks completed, completion rate, active habits.
3. Grades: week grade, **Good-day streak** (was labelled "Good days", but the value is the streak), month grade, tracking-linked.
4. Climb: score habits. Each name now carries its own unit, so mixed units no longer share the first habit's unit.
5. Habit completion bars. Top 8, with **Show all n**.
6. **Truth barcode** (new). One strip per habit, one cell per window day. Filter by name, sort by rate, latest slip or name, and a **Count partial as done** toggle that changes both colour and rate. Top 8, then Show all.
7. **If I keep this up** (new). Sliders for rate (defaults to the last 7 days), days ahead, and target. Shows now, the projected window rate, and the 100% days needed to reach the target.
8. Habit % lag trace with r(1) and r(7). Under it, the **biggest moves** (new): the three largest day-over-day rises and falls in percentage points, with the habits that flipped that day.
9. Horizon of daily %.
10. Weekday vs weekend slopegraph. Top 8 by gap, then Show all.

## Math

- Window rate = done ÷ required, where exempt days are left out of required. Partial counts as done only when the toggle is on (barcode only; the projection is strict).
- Projection: `projectRate` in `behavior-stats.ts`. New rate = (done + r·s·N) ÷ (required + s·N), where s is habit slots a day. Perfect days to target T = ⌈(T·required − done) ÷ (s·(1 − T))⌉.
- Moves: `biggestMoves` over the daily % series.

## Fixes in this pass

- The slopegraph (`Slopegraph` in `studio-plots.tsx`) drew flat lines. It now plots both ends on one 0–100% scale, dodges labels, shows full names up to 24 characters, and no longer hard-codes Karla.
- Long lists (rates, barcode, slopes) fold to 8.

## Research notes

- Lally et al. 2010 (*European Journal of Social Psychology*): automaticity took a median of about 66 days, and one missed day did not change the curve much. That is why the barcode shows partial and exempt days and does not treat a miss as a reset.
- IIB moves used: **Truth barcode** (Based on a True True Story) and **Annotated year line** (Peak Break-Up Times). See `docs/analytics/viz-inspiration.md` → Habits.

## Planned

- Label the moves on the trace itself, not only in the list under it.
