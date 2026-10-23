# Meta → Metrics

_Last mapped: 2026-10-23_

`components/Analytics/MetricsTrends.tsx`. Reads `metrics-store` only. Logging uses `MetricLogger` in a dialog.

## Information
Five wellbeing metrics, 0–100: joy, suffering, alignment, self satisfaction, situational satisfaction. Each reading has a local timestamp (`at`), so one day can hold several.

## Layout
1. Header: metric select, **Log {name}**.
2. Readouts: latest value per metric with n. Click to select.
3. **All five, same scale** (new): small multiples of the daily mean on 0–100 with a dotted 50 line, plus μ, σ and day count. Click a row to open it.
4. Detail: stats line (mean ± σ, median, range, recent rolling slope), **Smooth** slider (1–14 reading rolling mean, dashed), the phosphor chart with a mean line and labelled high and low points, change points as red diamonds.
5. Trend sentence and change-point list.

## Fixes (2026-10-23)
- "Latest" readout now sorts by `at`. Before, it took the last array item, which is insertion order and breaks on back-logged readings.
- The selected readout shows as pressed.

## Research notes
- Small multiples on a shared scale make comparison by eye honest (Tufte, *Envisioning Information*). Keep the shared 0–100 axis.
- IIB **Annotated year line**: name the peaks. Today the labels are the value and time. **Planned**: add what was logged that day (mood pen, top tracked scope).
