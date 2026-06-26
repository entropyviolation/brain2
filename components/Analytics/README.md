# `components/Analytics/` — Analytics

The **Analytics** top-level tab. Visualizations and insight surfaces over data
collected by the rest of the app (tasks, points, habits, time tracking, metrics,
reviews). Charts use **recharts**; all the non-trivial math lives in pure,
unit-tested `lib/*` helpers so the views stay deterministic and SSR-safe.

## Files

| File | Purpose |
|------|---------|
| `enhanced-analytics.tsx` | The tabbed analytics dashboard (`EnhancedAnalytics`). Headline metric cards + a tabbed view; hosts the heatmap/points/tracking charts inline and mounts the sub-views below. Persists the active tab via `lib/app-navigation.ts`. |
| `PlanVsReality.tsx` | Plan-vs-reality dashboard — planned vs actual per period (day/week/month) + a single intention→outcome variance score (`lib/plan-vs-reality.ts`). |
| `CalibrationView.tsx` | Estimate-vs-actual calibration — scatter (est vs actual minutes), ratio-distribution histogram, weekly trend, and a headline insight (`lib/calibration.ts`). |
| `StreaksWidget.tsx` | Current + longest streaks for each habit and the daily-review ritual (`lib/streaks.ts`, reads habits/reviews stores). |
| `ContextSwitchHeatmap.tsx` | GitHub-style calendar heatmap of daily context switches in the TimeGrid tracker, per scope, plus avg/busiest/trend stats (`lib/metrics.ts` `contextSwitchSeries`). |
| `CorrelationExplorer.tsx` | Pairwise metric correlation — pick two metrics, see a Pearson-`r` scatter + plain-language insight, plus a ranked list of the strongest links across all metrics (`lib/metrics.ts`, `lib/metrics-store.ts`). |
| `MetricsTrends.tsx` | Trend view for a self-tracking metric — value series, least-squares trend line, rolling slope (momentum), detected change-points, and headline stats (`lib/metrics.ts`, `lib/metrics-store.ts`). |
| `RegretView.tsx` | Regret accrual ledger — the mirror of points: day/week/month regret totals, a 14-day trend, outstanding (projected) regret, heaviest offenders, and a breakdown by blocked reason (`lib/regret-store.ts`). |

## Dashboard tabs (`EnhancedAnalytics`)

The dashboard renders four headline metric cards (total points, tasks completed,
completion rate, active habits) above a tab strip:

| Tab | Data source | Contents |
|-----|-------------|----------|
| **Habits** | `habits-store` | GitHub-style daily completion heatmap (~17 weeks) + per-habit completion rate bar chart (last 30 days). |
| **Points** | `points-store` | Daily points bar chart (14 days), cumulative line, top point earners. |
| **Tracking** | `time-tracking-store` | Time-distribution pie chart for a selected scope (last 30 days). |
| **Plan vs Reality** | tasks, points, `plan-text` | `<PlanVsReality />`. |
| **Calibration** | tasks | `<CalibrationView />`. |
| **Streaks** | habits, reviews | `<StreaksWidget />`. |
| **Reflection** | tasks | Post-mortem summary (avg satisfaction/resistance/focus/distraction) + "Reflect" on completed tasks via `PostMortemDialog`. |
| **Reviews** | `reviews-store` | Browse saved period reviews (expandable cards: summary, gratitude, next plans, resolved/pushed counts). |

> **Note:** `ContextSwitchHeatmap`, `CorrelationExplorer`, `MetricsTrends`, and
> `RegretView` are self-contained, default-exported views that read their own
> stores. They are not currently mounted as tabs inside `EnhancedAnalytics` —
> mount any of them with no props wherever an analytics surface is wanted
> (`<RegretView />`, `<MetricsTrends />`, etc.).

## Pure libraries

- `lib/plan-vs-reality.ts` — `computePlanVsReality` (variance/alignment scoring
  across tasks/time/points dimensions), `recentPeriodKeys`, `parsePlanIntentions`.
- `lib/calibration.ts` — `getCalibrationPoints`, `summarizeCalibration`,
  `ratioDistribution`, `calibrationTrend` (estimate accuracy, ±10% accurate band).
- `lib/streaks.ts` — store-agnostic `computeStreak` (current/longest run over
  date-keyed completions; day/week/month granularity).
- `lib/metrics.ts` — classical stats over value series: `trend`/`linearRegression`,
  `rollingSlope`, `correlate`/`pearson`/`alignSeries`, `detectChangePoints`, and
  context-switch counting (`countContextSwitches`, `contextSwitchSeries`).
- `lib/regret-store.ts` — persisted regret ledger + pure accrual helpers
  (`regretCost`, `dailyRegretIncrement`, `projectedRegret`, `daysOverdue`).
- Habit heatmap day percentages come from `calculateDayPercentageAV`
  (`lib/calculations.ts`); post-mortems persist via `saveCompletionReview`
  (`lib/services/completion-service.ts`).

## Libraries

- **recharts** — bar, line, pie, scatter, and composed charts.
- Custom SVG/div calendar heatmaps (habit completion, context switches).
