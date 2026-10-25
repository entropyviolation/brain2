# Accuracy → Plan vs Reality

_Last mapped: 2026-10-23_

File: `components/Analytics/PlanVsReality.tsx`. Math: `lib/plan-vs-reality.ts` (`computePlanVsReality`). New plates: `accuracy-views.css`, `quantile` from `accuracy-stats.ts`.

## Information
- Grain (day / week / month / season) and one period inside the shared window.
- Plan text lines (`getPlanBodies`), tasks scheduled in the period, planned points.
- Three rows: Tasks (done ÷ planned, capped), Time (min ÷ max of plan and actual), Points (earned ÷ planned, capped). Alignment = mean attainment of rows with a plan. Variance = 100 − alignment.
- Day grain only: capacity line, planned minutes (tasks + calendar events) vs waking window. `~ … est.` when the window is the typical one.

## Plates
- Grain and period pickers, window ribbon (one bar per period, height = alignment), capacity line.
- Planned vs actual bars. **Fixed:** actual used to cover the plan bar when it ran over. Actual is now a thin bar inside the wide plan bar. Legend swatches now match the real fills.
- **New, ribbon order:** By date or Best aligned first, plus median alignment, best and worst period, and the longest run at ≥ 70%. Shown when 2+ periods have a plan.
- **New, mirror split** (IIB *Left vs Right*): plan grows left, reality right, one row per measure, with the attainment math written out.
- **New, truth barcode** (IIB *Based on a True True Story*): one cell per planned item. Done, pushed at least once and still open, or open. Click a cell to open it.

## Research notes
- Planning fallacy: people plan for the best case and ignore past runs (Kahneman & Tversky 1979; Buehler, Griffin & Ross 1994). The ribbon and truth barcode put past periods in view.
- Time attainment is symmetric on purpose: running over costs as much as running short.

## Ideas not built
- Kept / moved / dropped per calendar block once blocks carry an outcome.
- Slider for the "aligned" run threshold (fixed at 70%).
