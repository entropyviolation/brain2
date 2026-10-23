# Behavior → Velocity

_Last mapped: 2026-10-23_

View id `velocity`. File `components/Analytics/VelocityView.tsx`. Math in `components/Analytics/behavior-stats.ts`.

## Data in

- `useTaskStore().tasks`: completed items whose `completedDate` (or `createdAt`) is in the window. `startedAt`, `createdAt`, `completedDate`, `actualDuration`, `rewardValue`.
- `usePointsStore().pointsHistory`: points per day, and points earned per `taskId`.
- Cycle time = `completedDate` − (`startedAt` or `createdAt`), in hours.

## Plates

1. Readouts: completions, median cycle, **85th and 95th percentile** (new), **Little's Law WIP** (new). Times under an hour show minutes.
2. Completions and points per day. Points now have their own right axis, since they run far larger than counts. A 7-day mean line of completions is added, with a legend.
3. **Finish within** (new). A slider (1–60 days) gives the share of timed items that finished within it (empirical CDF).
4. **Throughput by weekday** (new). Mean completions per weekday.
5. **Quick wins and slow rewards** (new). Quadrant scatter: x = cycle time on a log scale with hour/day ticks, y = points earned (ledger, else `rewardValue`). Dashed lines are the medians. Corners: quick wins, slow rewards, slow and small, fast and small, with counts. Click a dot to open the item.
6. Reward vs actual minutes. Unchanged.

## Math

- Percentiles: linear-interpolated `quantile`.
- Little's Law: average items in flight ≈ throughput (per day) × mean cycle time (days). It assumes a steady state, so it is a rough read.
- Quadrants: `quadrantOf`. Fast is ≤ median x. Big is > median y, so ties at the median go small. Many items share one reward value, and the old tie rule put them all in "big".

## Research notes

- Little 1961 (*Operations Research*) for L = λW.
- Vacanti, *Actionable Agile Metrics for Predictability* (2015): use cycle-time percentiles (50th, 85th, 95th) rather than the mean for "how long does an item take".
- IIB move used: **Quadrant scatter** (Best in Show). See `docs/analytics/viz-inspiration.md` → Velocity.
