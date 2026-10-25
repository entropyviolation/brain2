# Accuracy → Calibration

_Last mapped: 2026-10-23_

File: `components/Analytics/CalibrationView.tsx`. Math: `lib/calibration.ts` (points, summary, ±10% band, ratio buckets, weekly trend) and `components/Analytics/accuracy-stats.ts` (barcode, bias stats, size bins, PERT). Test: `CalibrationView.test.tsx`, `accuracy-stats.test.ts`.

## Information
- Completed tasks with an estimate (`estimatedDuration`) and an exact actual (`exactDurationMinutes`; estimated or rough actuals are left out). Ratio = actual ÷ estimate.
- Item type, first list, three-point PERT estimates, completion date. Thin floor: `SAMPLE_FLOORS.calibration`.

## Plates
- Sentence, n, caveat, Open in Lists.
- Estimated vs actual scatter. **Fixed:** the hint named a diagonal that was not drawn. y = x is now dashed, the ±band dotted. Points are ink blue, not pale sky.
- Ratio distribution, median ratio by type and by list, weekly trend (now with a 1.0× reference line).
- PERT bands: **new** hit count (inside / past pessimistic / before optimistic) and PERT mean. The list folds when it has more than 8 rows.
- **New, estimate barcode** (IIB *Based on a True True Story*): one row per type or list, one cell per task in time order, colored early / on / over. A slider sets what counts as on (±5–50%).
- **New, plan a task with your track record** (IIB *Your-number input*): type an estimate, get P50 / P80 / P90 minutes from your own ratio quantiles, plus the geometric-mean multiplier and log spread.
- **New, bias by task size:** median ratio for ≤15m, 16–60m, 1–3h, >3h.

## Math
- On band: |ratio − 1| ≤ band.
- Typical multiplier = exp(mean ln ratio). Spread = SD of ln ratio. Robust to one huge overrun.
- Forecast = estimate × quantile of past ratios (reference class forecasting).
- PERT mean = (o + 4m + p) ÷ 6.

## Research notes
- Planning fallacy and the inside view: Kahneman & Tversky 1979; Buehler, Griffin & Ross 1994.
- Reference class forecasting: use the distribution of past outcomes, not the plan (Flyvbjerg 2006). That is the forecaster plate.
- Size effect: short tasks tend to be underestimated and long ones overestimated (Roy, Christenfeld & McKenzie 2005; Halkjelsvik & Jørgensen 2012 review). The size plate tests this on your data.
- Interval estimates are too narrow: "90%" ranges often hold 60–70% of outcomes (Jørgensen, Teigen & Moløkken 2004). The PERT hit count checks this.

## Ideas not built
- Calibration by hour of day or by focus score from completion reviews.
- Rolling geometric mean as a second trend line.
