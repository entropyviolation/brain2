# Analytics section map

_Last mapped: 2026-10-23_

One line per view so a section can be worked on alone. Read this, then the
view's file and its row in [`components/Analytics/README.md`](../../components/Analytics/README.md).
Do not re-map the whole room.

- Groups and view ids: `components/Analytics/analytics-tabs.ts`. Help copy per view is `ANALYTICS_TAB_HELP` in the same file.
- View id → component: `components/Analytics/analytics-views.tsx` (one lazy chunk each).
- Shell: `enhanced-analytics.tsx`, `AnalyticsNav.tsx`, range in `analytics-range.ts` / `analytics-range-store.ts`.
- Shared chart kit: `studio-kit.tsx`, `studio-plots.tsx`, `chart-frame.tsx`, `open-in-lists.ts`.
- Skin: `analytics-chrome.css` (base), `analytics-atlas.css` (look), `analytics-boards.css` (Tracking boards).
- Type: Bricolage Grotesque (`--font-an-display`, titles and values) and Instrument Sans (`--font-an-text`, everything else). Loaded in `app/layout.tsx`.
- Plans that already exist: [`docs/analytics-plan/`](../analytics-plan/README.md) and [`docs/analytics-vision/`](../analytics-vision/README.md). Read the one brief for your area only.

**Out of scope for now:** Texts (`texts-report`) and Instagram (`instagram`). Do not change them. They still inherit the shared shell font and header.

Per-section docs go in this folder as `docs/analytics/<group>-<view>.md` (for example `time-tracking.md`). Link each one from its row below.

## Behavior

| View id | File | Stores read | Data shown |
|---|---|---|---|
| `habits` | `HabitsView.tsx` | habits, points, tasks | Daily habit completion %, per-habit rates, week/month grades, good days, climb (score habits), tracking-linked habits, weekday vs weekend, horizon of daily %. |
| `streaks` | `StreaksWidget.tsx` | habits, reviews | Current and longest streaks, all-time. Optional week-habit streak. |
| `points` | `PointsView.tsx` | points, habits, goals | Daily points by source (habit / bonus / task), cumulative, top earners, points ledger. |
| `velocity` | `VelocityView.tsx` | tasks, points | Completions and points per day, median cycle time, reward scatter. |
| `reflection` | `ReflectionView.tsx` + `CompletionReviewPlates.tsx` | tasks, goals | Completion reviews: satisfaction, resistance, focus, distraction, review points, time certainty, expected vs actual difficulty, feelings, reflect notes. |
| `todo-pulse` | `TodoPulseView.tsx` | tasks, reviews | Morning walkthrough: tier, expected duration, points, day importance, resistance readings, day excitement. |
| `reviews` | `ReviewsView.tsx`, `PeriodArcReading.tsx` | reviews, habits, tasks | Morning and period reviews, gratitude, plans, blocked-reason mosaic, why-it-didn't notes. |
| `seasons` | `SeasonsView.tsx` | tasks, points, reviews, goals | Calendar quarters this year and last: completions, points, rituals, season goals. |
| `overcommit` | `OvercommitmentView.tsx` | tasks | Day-pushes and logged minutes. |

## Time

| View id | File | Stores read | Data shown |
|---|---|---|---|
| `tracking` | `TrackingAnalytics.tsx` + boards (`AverageDayBoard`, `PeriodFilmstrip`, `GrainStrips`, `TagTrendBoard`, `PeriodDeltaTable`, `BlockSearch`, `TrackingContextPlates`) | tracking, tasks | Pen minutes by scope and depth, composition donut, filmstrip, day/week strips, average day, tags, up/down vs previous window, hour × day, block-length violin, by level, company headcount, sized squares, pace, before \| now mirror, day edges, block-length cut. Biggest section. Docs: [`time-tracking.md`](time-tracking.md). |
| `sleep` | `SleepAnalytics.tsx` | sleep, tracking, sun times, settings | Nightly duration and bedtime, estimated vs logged, CV, ridgelines, against the sun, all-nighters. |
| `screentime` | `ScreenTimeView.tsx` | tracking | ActivityWatch Screen Time scope: active vs AFK, alignment with Activity, last sync. |
| `circadian` | `CircadianView.tsx` | tracking | Hour × day occupancy, weekday cycle plot. |
| `places` | `PlacesView.tsx` | tracking | Location pens as time-at-place, named GPS pins. |
| `people` | `PeopleView.tsx` | tracking | Time with each person, change vs previous window, rhythm, drifting, headcount. |
| `mood-field` | `MoodFieldView.tsx` | tracking, metrics | Painted mood names, mood readings, joy / suffering / alignment beside them. |
| `diversity` | `DiversityView.tsx` | tracking | Shannon entropy of pens per day, Gini, weekday vs weekend. |
| `transitions` | `TransitionsView.tsx` | tracking | Markov matrix of pen switches, alluvial of switch counts. |
| `context-switch` | `ContextSwitchHeatmap.tsx` | tracking, tasks | Pen switches by hour of day. |
| `text-events` | `TextPipelineView.tsx` (`TextEventsView`) | tracking | Phone text-pipeline instants (log:, triggers, switch markers) by day. Not the Texts report. |
| `text-spans` | `TextPipelineView.tsx` (`TextSpansView`) | tracking | Text-pipeline currently / stopped / switched intervals. Not the Texts report. |
| `log` | `LogEventsView.tsx` | tracking | Logged instants: food, drink, drug, intake, event phrases; by day and kind; clock certainty. |
| `cycle-phase` | `CyclePhaseView.tsx`, `cycle-phase-concealed.tsx` | cycle marks, habits, metrics, points, regret, sleep, tasks, tracking | Menstrual phase labels from bleed and ovulation marks, every joined series by phase. Hidden until Show cycle. |
| `operations` | `OperationsAnalytics.tsx` | tasks, reviews | Operation items: stage/category mosaic, work vs neglect from time logs. |

## Accuracy

| View id | File | Stores read | Data shown |
|---|---|---|---|
| `plan` | `PlanVsReality.tsx` | tasks, events, points | Planned minutes (tasks + calendar) vs actual, capacity vs waking window. |
| `calibration` | `CalibrationView.tsx` | tasks | Estimate vs actual duration, PERT bands. |
| `cycle` | `CycleView.tsx` | tasks | Push counts, open-item age survival and beeswarm, estimate confirmation. |
| `regret` | `RegretView.tsx` | regret, tasks | Accrued cost of important items past due. |
| `goals` | `GoalsAnalytics.tsx` + `CompletionReviewPlates.tsx` | goals, tasks | Objective contribution, neglected goals, where hard or joyful work went. |

## Meta

| View id | File | Stores read | Data shown |
|---|---|---|---|
| `observatory` | `Observatory.tsx`, `observatory-findings.ts` | habits, metrics, points, sleep, tasks, tracking | Pearson r findings on joined days. |
| `cross-section` | `CrossSection.tsx`, `cross-section.ts` | goals, habits, metrics, points, regret, sleep, tasks, tracking | Linked day-by-day density strips for every series. |
| `metrics` | `MetricsTrends.tsx` | metrics | Five wellbeing series: joy, suffering, alignment, self satisfaction, situational satisfaction. |
| `correlation` | `CorrelationExplorer.tsx` | habits, metrics, points, sleep, tracking | Pairwise Pearson matrix, scatter per cell. |
| `spectrum` | `SpectrumView.tsx` | habits, sleep, tracking | Autocorrelation, DFT periodogram, sleep CV. |
| `research-report` | `ResearchReportView.tsx`, `research-report.ts` | events, habits, metrics, reviews, sleep, tasks, tracking | Plain-language rundown of the window, sections gated by floors. |

## Library

| View id | File | Stores read | Data shown |
|---|---|---|---|
| `item-types` | `ItemTypesLibrary.tsx`, `relations/` | item types, tasks | Item types by count, type detail, relations library and rules. |
| `lists-areas` | `ListsAreasView.tsx` | tasks | Lists sized by item count, or by completion rate. |
| `attributes` | `AttributesView.tsx` | item types, tasks | Histograms of schema attributes. |
| `tags` | `LibraryCuts.tsx` (`TagsView`) | tasks | Tag areas and UpSet combinations. |
| `stages` | `LibraryCuts.tsx` (`StagesView`) | tasks | Task stage buckets (inbox / clarified / scheduled / completed / list). |
| `weight` | `LibraryCuts.tsx` (`WeightView`) | tasks | Importance, cognitive load, entropy. |

## Out of scope

| View id | Group | File |
|---|---|---|
| `texts-report` | Texts | `TextsReportView.tsx` |
| `instagram` | Sources | `InstagramView.tsx`, `instagram-view.css` |

## Every data type that flows into Analytics

Tasks and items: status, stage, list, area, item type, tags, importance, cognitive load, entropy, tier, due and scheduled dates, day-pushes, estimates (single and three-point), actual duration, time logs, start and completion stamps, cycle time, completion reviews (satisfaction, resistance, focus, distraction, expected vs actual difficulty, feelings, reflect notes, review points, time certainty), morning walkthrough fields (expected duration, day importance, resistance readings, day excitement), why-not and blocked reasons, operations (stage, category, neglect), goal and objective links.

Habits: daily completion, per-habit rate, exempt periods, week and month grades, good days, score habits (climb), tracking links, streaks.

Points: awards by source (habit, bonus, task), ledger, cumulative totals.

Goals: goals and objectives by period (including season), contribution, neglect.

Time tracking: blocks by scope (Activity, Company, Social, Location, Mood, Screen Time and others), pens and pen hierarchy depth, secondary pens, counts-as chains, action formats, notes, projects, tags, assumed vs logged, untracked gaps, instants (intake food / drink / drug, event phrases), clock certainty, people and headcount, places and GPS pins, mood names and readings, text-pipeline events and spans, ActivityWatch screen time.

Sleep: nights, bedtime, wake, duration, estimated vs logged, all-nighters, sunrise and sunset.

Wellbeing metrics: joy, suffering, alignment, self satisfaction, situational satisfaction.

Cycle: bleed days, spotting, ovulation marks, derived phases.

Regret: accrued cost of important overdue items.

Reviews and rituals: morning reviews (affirmations, priorities, plan, circumstances, best day, gratitude), week / month / season / year reflections, inspiration photos.

Calendar: planned events and planned minutes, waking window.

Library: item types and schemas, attributes, relations and rules, lists and areas.

Derived math already in place: Shannon entropy, Gini, HHI, Markov transitions, Pearson r, autocorrelation, DFT periodogram, coefficient of variation, Gaussian KDE ridgelines, survival of open items, period deltas.

Out of scope sources: iMessage and SMS (Texts report), Instagram export.
