# `components/Analytics/` — Analytics studio

The **heart of Brain2**. Capture, Lists, Tracking, Habits, Reviews, and Modules
write the vault. This tab is mass personal data and information-resource
**collection, presentation, and analysis** — and the place that turns that mass
into endless tools. A chart that cannot open its items, or a finding that
cannot become a next instrument, is unfinished.

The **Analytics** top-level tab is a light instrument studio over the vault
already captured: tasks, points, habits, tracking scopes, sleep, metrics,
reviews, operations, goals, and the item library. Charts use **recharts**
(themed, including **pies**) plus shared studio primitives (treemap, density,
mosaic, hour×day, ribbon, **phosphor traces**). Non-trivial math lives in pure
`lib/*` helpers plus `cross-section.ts`, `hour-day.ts`, `observatory-findings.ts`,
and `signal-stats.ts` here. No LLM. No new stores.

**Product law (this tab only):** keep the `.fm98` **title bar** and **status bar**
so Analytics still lives in Brain2 next to Lists. Range + left index chrome use the
house [milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia) (equal metal keys,
CRT active + power lamp, engraved nameplates); canvases stay a **light instrument
studio** (Win95 face `#c0c0c0`, ink `#000000`, Karla only, nested wells — phosphor
for traces, not a dark CRT theme). Do not restyle Lists, Habits, Plan, Tracking,
or Scheduler to match.

**Always create as many tooltips and provide as many clear instructions as
possible if applicable and needed.** Each view has `ANALYTICS_TAB_HELP` under the
nav, `?` help on titled canvases, and native `title` on controls.

One remembered date range is labeled once (`last 30 days`, 7 / 14 / 90, **or**
an inclusive custom window labeled as `2026-08-01 – 2026-09-21`). Interpretive
views show **n** and refuse to treat a thin window as a finding.
Empty charts keep the frame and put one sentence inside it. Clicking a series
opens the underlying items in Lists (`open-in-lists.ts`). Derived numbers stay
`~` / **est.** Interpretive sentences name the subset, the dates, and the share
left out (Wave 13, GS-2 in
[`docs/ScienceandSanityBrain2.md`](../../docs/ScienceandSanityBrain2.md)).
They describe events. The Regret view id stays; the prose does not call the
person regretful.

**Meaning group (planned, not built).** Wave 14 in
[`docs/JungBrain2.md`](../../docs/JungBrain2.md) adds a sixth studio group,
Meaning, with Coincidence, Symbols, and Exceptions. It defaults on and can be
hidden from Settings. Causal groups stay as they are. A series shows an
observed count and an expected-by-chance count. The app never marks a run
meaningful on its own.

**Item Types** is a first-class Analytics **Library** view. Settings still
**edits** types. Do not move the library out of Analytics.

## Files

| File | Purpose |
|------|---------|
| `enhanced-analytics.tsx` | Window: title + studio range/nav/canvas + status. Persists the active view and canvas scroll. `data-ui-name="Analytics"` (docs path this file). Mounts `useScreenTimeSync` while Analytics is open. |
| `AnalyticsNav.tsx` | Left studio index (`data-ui-name="Analytics index"`, one-line `data-ui-help`, `#studio-views`). Groups then views; `role="tab"`; last view per group (persisted). Names attrs are the help — do not add a second `?` button. |
| `analytics-tabs.ts` | Five groups (behavior, time, accuracy, meta, library), views, `groupForTab` / `tabLabel` / `ANALYTICS_TAB_HELP`. A sixth group, Meaning, is specified in [`docs/JungBrain2.md`](../../docs/JungBrain2.md) and is not in this file yet. |
| `analytics-range.ts` | Presets, custom inclusive from–to, named week/month, labels, `SAMPLE_FLOORS`, thin-window copy, date-key helpers. |
| `analytics-range-store.ts` | Remembered rolling or custom window (`cogs-analytics-range` / `brain2-analytics-range`). |
| `chart-frame.tsx` | Empty / thin furniture + **Open in Lists** (`an-open-lists`). |
| `open-in-lists.ts` | Chart → Lists jump. |
| `analytics-chrome.css` | Milled range/index chrome + light instrument interior (nested **gray** wells, pie, treemap, density, mosaic, hour×day, phosphor scope, horizon/violin/alluvial). Title/status stay Lists. |
| `studio-kit.tsx` | FindingBlock, StudioReadout, StudioHelp, StudioCheck, CanvasTitle, SlicePie, SliceTreemap, SliceMosaic, SplitBar, HourDayHeatmap, DensityCalendar, StudioBars, PhosphorTrace. |
| `studio-plots.tsx` / `studio-plot-stats.ts` | Horizon, ridgeline, violin+histogram, alluvial, beeswarm, slopegraph, UpSet, hour×pen small multiples, Cleveland cycle, sparkline. |
| `hour-day.ts` | Hour × day occupancy. Instants off the heat; missing hours stay 0. Hour×pen small multiples + weekday cycle. |
| `observatory-findings.ts` | Pearson-r findings for Observatory. Named apart from `Observatory.tsx` (macOS case-fold). |
| `signal-stats.ts` | Shannon entropy of pens/day, Gini, list HHI, Markov transitions, weekday/weekend cut, open-item ages. |
| `HabitsView.tsx` | Density calendar, sorted bars, week/month grade, Good days, climb, tracking-link split, habit-% lag trace, horizon of daily %, weekday/weekend slopegraph. Day % and rates drop exempt periods from the denominator. |
| `PointsView.tsx` | Daily stacked source split (habit / bonus / task) + cumulative + top earners. |
| `StreaksWidget.tsx` | Current + longest (not clipped). Optional week-habit streak. Not merged with Home. |
| `ReflectionView.tsx` | Four score trajectories + queue. |
| `TodoPulseView.tsx` | Morning to-do walkthrough: labeled tier / duration / points / day importance / resistance series / day excitement; BIM mornings tagged. |
| `ReviewsView.tsx` | Morning review reader (all-nighter, affirmations, to-dos, priorities, habit priorities, day plan, circumstances, best day, gratitude — labeled when from BIM text pipeline) + blocked-reason mosaic + expandable period reviews. |
| `OvercommitmentView.tsx` | Sentence + n; weeks/months pushed in the finding when present. Does not reschedule. |
| `VelocityView.tsx` | Completions, points, median cycle time, reward scatter. |
| `TrackingAnalytics.tsx` | Occupancy, **pie** + mosaic, hour×day, weekday/weekend, instants, scope, depth, assumed, pen + tag drill (lists blocks; click opens `entry-dialog.tsx`), block-length violin, hour×pen small multiples, daily sparkline. |
| `SleepAnalytics.tsx` | Nightly strip on 6pm→noon; `~` estimated, **est.** read off the grid; duration CV + lag-1; weekday ridgelines; **against the sun**; **all-nighters** (count, frequency, time, desktop vs text-pipeline/BIM source). |
| `ScreenTimeView.tsx` | ActivityWatch-painted Screen Time: active vs untracked, top apps / categories, last-sync, alignment vs Activity occupancy. Empty sentence notes AW only records from when watchers run. `data-testid="screentime-view"`. |
| `CircadianView.tsx` | Hour × day atlas (Activity default, Mood) + Cleveland weekday cycle plot. |
| `PlacesView.tsx` | Location time-at-pen mosaic. Not a geo map. |
| `MoodFieldView.tsx` | Spec §15 cognitive-state: Mood pens + metric overlays. |
| `DiversityView.tsx` | Shannon entropy of pens/day + Gini of allocation + weekday vs weekend. |
| `TransitionsView.tsx` | Markov matrix of Tracking pen changes + alluvial of switch counts. |
| `ContextSwitchHeatmap.tsx` | Density calendar + hour-of-day; per-scope; Open in Lists for items with time logs. |
| `TextPipelineView.tsx` | **Text events** (text-pipeline instants) and **Text spans** (currently/stopped/switched intervals); always labeled from text pipeline. |
| `OperationsAnalytics.tsx` | Stage/category mosaic + work/neglect heat. Does not restyle the Operations module. |
| `PlanVsReality.tsx` | Window ribbon + paired bars; calendar events as planned minutes; capacity vs waking window (`~` when inferred). |
| `CalibrationView.tsx` | Sentence + n + caveat; scatter; type/list breakdown when n clears the floor; PERT bands when present. |
| `CycleView.tsx` | `daysPushed` distribution, open important items, estimate confirmation, empirical survival of open stock, age beeswarm. |
| `RegretView.tsx` | Accrued cost of important items sitting undone. |
| `GoalsAnalytics.tsx` | Objective contribution, neglected goals, progress. |
| `Observatory.tsx` | Classical findings + linked Cross-section (`data-ui-name="Observatory"`, `#studio-views`). Thin overlap watermarked. |
| `CrossSection.tsx` | Linked density (habits, tracking, sleep, completions, points, operations, regret, mood, joy, switches, places, goals, Screen Time occupancy). `data-ui-name="Cross-section"`, `#studio-views`. |
| `cross-section.ts` | Pure series builders: missing stays missing. |
| `MetricsTrends.tsx` | Small-multiples of all five wellbeing metrics + phosphor detail chart + **Log {name}**. |
| `CorrelationExplorer.tsx` | Pairwise Pearson matrix (metrics + habit % / tracking / sleep / points). Click a cell → scatter. |
| `SpectrumView.tsx` | Habit-% autocorr + periodogram, sleep CV and lag-1. |
| `ItemTypesLibrary.tsx` | Type mosaic, sort, drill, Open in Lists. |
| `ListsAreasView.tsx` | Size-by-items treemap (area ∝ count) + HHI + completion-rate toggle. |
| `AttributesView.tsx` | Typed attribute histograms from schemas that exist. Not a chart builder. |
| `LibraryCuts.tsx` | Tags (treemap + UpSet combinations), Stages, Weight — fields already on items. |

## Studio views

The range chips sit under the title (7 / 14 / 30 / 90 plus **Custom** from–to
or this week / this month). The **studio index** holds groups; views of
the selected group sit beneath (`role="tab"`). Default view remains **Habits**.
**Tasks completed** includes habit Done logs (`loggedAction` from
`lib/habit-done-log.ts`) as well as Tasks, counted inside the window.

| Group | View | Data source | Contents |
|-------|------|-------------|----------|
| **Behavior** | **Habits** | `habits-store` | Density calendar, sorted bars, week/month grade, Good days, climb, tracking-linked vs manual, horizon of daily %, weekday/weekend slope. |
| | **Streaks** | habits, reviews | Current + longest; not clipped. Not merged with Home. |
| | **Points** | `points-store` | Stacked source split + cumulative; top earners jump to Lists. |
| | **Velocity** | tasks, points | Completions, median cycle time, reward vs minutes. |
| | **Reflection** | completion reviews | Four 1–10 trajectories + queue. |
| | **Reviews** | `reviews-store` | Blocked-reason mosaic + expandable text. |
| | **Overcommit** | `daysPushed` + `timeLogs` | Sentence + n; week/month pushes noted. Not a nanny. |
| **Time** | **Tracking** | `time-tracking-store` | **Pie** + mosaic + hour×day + weekday/weekend + block-length violin + hour×pen small multiples. Drill lists every block; click a slice to filter, click a block to edit via Home Tracking `entry-dialog.tsx`. |
| | **Sleep** | `sleep-store` + tracking | Duration, timing, 6pm→noon strip; `~` / **est.**; duration CV + lag-1; weekday ridgelines. |
| | **Screen Time** | Screen Time scope + ActivityWatch prefs | Active vs untracked; top apps/categories; last-sync; alignment vs Activity occupancy. Empty: AW only records from when watchers run. |
| | **Circadian** | tracking | Hour × day occupancy + Cleveland weekday cycle. Missing hours are 0, not occupancy. |
| | **Places** | Location scope | Time-at-pen mosaic. No lat/lng — not a map. |
| | **Mood field** | Mood + metrics | Cognitive-state trends (§15). |
| | **Diversity** | tracking | Shannon entropy of pens/day, Gini of allocation, weekday vs weekend. |
| | **Transitions** | tracking | Markov P(to \| from) among pen switches + alluvial of counts. |
| | **Context Switch** | tracking | Switch density + hour-of-day; Open in Lists for time-logged items. |
| | **Text events** | tracking (`generatedBy.text` instants) | Discrete phone events + switch markers; counts by day; always from text pipeline. |
| | **Text spans** | tracking (`generatedBy.text` intervals) | currently / stopped / switched durations + switch count; always from text pipeline. |
| | **Operations** | operation items | Stage/category mosaic + work vs neglect. |
| **Accuracy** | **Plan vs Reality** | plan, events, capacity, sleep | Ribbon + events as planned minutes + waking capacity. |
| | **Calibration** | tasks | Sentence + n; type/list when floor clears; PERT when present. |
| | **Cycle** | pushes, estimates | Stall distribution + confirmation rate + survival + age beeswarm of open important items. |
| | **Regret** | `regret-store` | Accrued / outstanding. |
| | **Goals** | `goals-store` | Progress, neglected, contributing completions. |
| **Meta** | **Observatory** | aligned series | Pearson findings + Cross-section (includes Activity vs Screen Time occupancy). Thin overlap withheld. |
| | **Cross-section** | many stores | Linked density; extra series: mood, joy, switches, places, goals, Screen Time. |
| | **Metrics** | `metrics-store` | All five small-multiples + **Log {name}**. |
| | **Correlation** | metrics + aligned series | Pairwise matrix; click → scatter. Not a chart builder. |
| | **Spectrum** | habits + sleep | Autocorr, naive DFT periodogram, sleep CV. |
| **Library** | **Item Types** | `item-type-store` | Browse / sort / count / drill. |
| | **Lists & areas** | lists | **Size by items** (area ∝ n) or completion rate. HHI of item counts. |
| | **Attributes** | type/list schemas | Fixed histograms. |
| | **Tags** | `Task.tags` | Treemap of free-form tags + UpSet of exact combinations. |
| | **Stages** | `Task.stage` | Inbox / clarified / scheduled / completed / list. |
| | **Weight** | importance, load, entropy | Distributions; missing stays missing. |

Interpretive views hide or watermark the finding when n is below `SAMPLE_FLOORS`.
Observatory findings with n below 7 are watermarked. Cross-section is a display:
missing nights stay blank; empty rows say so.

## Pure libraries

- `lib/tracking-summary.ts` — occupancy (`uniqueMinutes`: overlapping blocks count
  once, so coverage cannot exceed 100%), pen totals at a display depth, child
  drill, variant split/reach, tag totals, `withPrecision`.
- `lib/plan-vs-reality.ts` — variance/alignment scoring; `recentPeriodKeys`.
- `components/Home/Plan/plan-capacity.ts` — planned vs waking window (labeled `~`
  when sleep is inferred).
- `lib/calibration.ts` — estimate accuracy, ±10% accurate band.
- `lib/streaks.ts` / `lib/habit-week-streaks.ts` — current/longest runs.
- `lib/sleep-log.ts` / `lib/sleep-inference.ts` — nightly model + `resolveNights`.
- `lib/metrics.ts` — classical stats (Pearson r, trend, change-points, Shannon
  entropy, Gini, HHI, autocorrelation, periodogram, CV, survival).
- `components/Analytics/studio-plot-stats.ts` — KDE, histogram, horizon bands,
  beeswarm, alluvial layout, UpSet intersections, weekday ridges.
- `lib/overcommitment.ts` — day-push reconstruction + logged minutes.
- `lib/regret-store.ts` — accrued cost of important overdue items.
- `lib/operations.ts` — `buildHeatmap` for operations minutes.
- `lib/habit-accomplishment.ts` — Good days.
- `lib/incremental-habits.ts` — climb targets (not re-derived here).
- Habit % from `calculateDayPercentageAV` (`lib/calculations.ts`).

## Screenshots

`scripts/capture-screenshots.mjs` (`captureAnalytics`) clicks the **group** tab
then the **view** tab (`role="tab"`). Manifest chrome is `ANALYTICS_CHROME` in
`scripts/screenshot-manifest.mjs`. Recapture `docs/screenshots/07-analytics*` with
`COGS_FRESH=0` on a loaded vault so empty theater is not product truth. Do not run
a full-repo screenshot pass while other tabs are in flight.
