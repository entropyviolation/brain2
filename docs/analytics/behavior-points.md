# Behavior → Points

_Last mapped: 2026-10-23_

View id `points`. File `components/Analytics/PointsView.tsx`. Styles in `components/Analytics/behavior-views.css`.

## Data in

- `usePointsStore().pointsHistory`: `{ date, taskId, taskDescription, points }`.
- Source from `taskId`: `habit-grade-bonus:` and `habit-raw-day-bonus:` are bonuses, `habit-day:` is a habit, anything else is a task.
- The ledger also reads `useHabitsStore` and `useGoalsStore` to name the award kind.

## Plates

1. Daily points, stacked by source. Now has a legend and a dashed **day target** line.
2. **Day target and rate** (new). A slider sets the target (defaults to a typical day) and counts the days that reach it. Readouts: per day, per scoring day, per week (mean × 7), and per waking hour (`~`, assumes 16 hours awake).
3. Cumulative points.
4. Source split bars.
5. **Sized squares** (new). An area-true slice-and-dice treemap: column width is a source, tile height is an item, top 40 positive items. A dashed square in the corner is a typical day at the same scale. Task tiles open the item in Lists. Negative awards are totalled in the key.
6. Top point earners, now rounded to 2 decimals.
7. Points ledger: search, range or whole ledger, rows open the award breakdown. Unchanged.

## Math

- Typical day = median of days with points (`quantile(…, 0.5)`).
- Anchor square side = √(typical ÷ shown total ÷ 3) of the width, because the box is 3:1.

## Research notes

- Shneiderman 1992 introduced slice-and-dice treemaps. Two levels keep it readable without a squarify step.
- IIB moves used: **Sized squares** (Billion Dollar-o-Gram) and **Rate clock**. See `docs/analytics/viz-inspiration.md` → Points.

## Planned

- A real waking-hours figure from Sleep instead of the fixed 16.
