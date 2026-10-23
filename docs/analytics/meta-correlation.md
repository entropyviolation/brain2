# Meta → Correlation

_Last mapped: 2026-10-23_

`components/Analytics/CorrelationExplorer.tsx`, helpers in `meta-math.ts`, fills in `meta-plots.tsx`.

## Information
Series: the five metrics (daily mean), habit %, tracked minutes, sleep minutes, points. Matrix of Pearson r for every pair, floor `SAMPLE_FLOORS.correlation`.

## Fixes (2026-10-23)
- **Metrics never joined other series.** Metric points used the raw timestamp as their date, while habit, sleep and points use `YYYY-MM-DD`. `alignSeries` joins on the exact string, so every metric × non-metric cell was empty. Metrics are now folded to one mean per local day (`dailyMeans`).
- Habit % is left out when there are no habits, instead of a row of zeros.
- Matrix fill moved to a light diverging ramp with readable ink. The diagonal shows `—`. Column heads carry the full name on hover.

## New
- Finding line adds the 95% Fisher-z interval and the fitted slope. The scatter draws the least-squares line.
- **Does it carry over?** Lag slider 0–7 days: r of A today against B k days later, plus quick chips for lag 0, 1, 2, 3, 7.
- **Strongest links** filter: all, move together, move apart.

## Research notes
- Lagged cross-correlation is the classical lead/lag check. Autocorrelated series inflate r and its apparent significance (Box & Jenkins; Granger & Newbold 1974, "spurious regressions"). The copy says so.
- **Planned**: prewhiten (difference) before lagging, and an IIB **Quadrant scatter** with named corners at each series' median.
