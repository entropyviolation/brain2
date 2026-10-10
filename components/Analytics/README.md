# `components/Analytics/` — Analytics studio

The **heart of Brain2**. Capture, Lists, Tracking, Habits, Reviews, and Modules
write the vault. This tab is mass personal data and information-resource
**collection, presentation, and analysis** — and the place that turns that mass
into endless tools. A chart that cannot open its items, or a finding that
cannot become a next instrument, is unfinished.

## Public door

Other rooms mount `EnhancedAnalytics` (`enhanced-analytics.tsx`). The shell
lazy-loads that export from `app/page.tsx`. Views are interior
(`analytics-views.tsx`). The shell also loads `analytics-chrome.css` from
`app/layout.tsx`.

Analytics reads the task, habit, and tracking stores. It is not the writer of
tasks, habits, or tracking.

The remembered window is `useAnalyticsRangeStore` in `analytics-range-store.ts`.
Other rooms do not write it.

The **Analytics** top-level tab is a light instrument studio over the vault
already captured: tasks, points, habits, tracking scopes, sleep, metrics,
cycle marks, reviews, operations, goals, and the item library. Charts use **recharts**
(themed, including **pies**) plus shared studio primitives (treemap, density,
mosaic, hour×day, ribbon, **phosphor traces**). Non-trivial math lives in pure
`lib/*` helpers plus `cross-section.ts`, `hour-day.ts`, `observatory-findings.ts`,
and `signal-stats.ts` here. No LLM in this studio today. No new stores. The intention to read task why, why an action was not taken, gratitude, day / week / month plan text, and the other stored prose with sentiment, machine learning, language models, and embeddings — beside the classical counts, and with a word cloud among the pictures — is [`docs/analytics-vision/06-language.md`](../../docs/analytics-vision/06-language.md). That reading is unbuilt. It does not add a store, and it does not write a model sentence back as if the person had typed it. The build that adds it, and that regroups this studio without dropping a view id or its math, is [`docs/analytics-plan/`](../../docs/analytics-plan/README.md). Those briefs are not a change to this tab.

**Product law (this tab only):** keep the `.fm98` **title bar** and **status bar**
so Analytics still lives in Brain2 next to Lists. Range + left index chrome use the
house [milled fascia](../../docs/DESIGN_STYLE.md#milled-fascia) (equal metal keys,
CRT active + power lamp, engraved nameplates); canvases stay a **light instrument
studio** (Win95 face `#c0c0c0` / `--an-paper`, ink `#000000`, Karla only, nested
milled wells, **white plot wells** `--an-hi` inside milled rims — phosphor
`#3dff8a` for line traces only, not a dark CRT theme and not cream paper).
Sections use `.an-plate` with 16px air between plates. Do not restyle Lists,
Habits, Plan, Tracking, or Scheduler to match.

**Always create as many tooltips and provide as many clear instructions as
possible if applicable and needed.** Each view has `ANALYTICS_TAB_HELP` under the
nav, `?` help on titled canvases, and native `title` on controls.

One remembered date range is labeled once (`last 30 days`, 7 / 14 / 90, **or**
an inclusive custom window labeled as `2026-08-01 – 2026-09-21`). **Prev** /
**Next** milled keys shift that same window back or forward by its own length
(calendar week / month / season when those chips set it; otherwise inclusive
day count), with Next clamped so the end never passes today. Interpretive
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
| `enhanced-analytics.tsx` | Window: title + studio range/nav/canvas + status. Persists the active view and canvas scroll. `data-ui-name="Analytics"` (docs path this file). Mounts `useScreenTimeSync` while Analytics is open. The open view is a lazy chunk (`analytics-views.tsx`); the shell does not import every chart. Time → Cycle phase stays that chunk when cycle tracking is off. When it is on and `cycleDetailsOpen` is false, the shell shows **Show cycle** and a concealed line (`cycle-phase-concealed.tsx`) and does not mount the phase canvas. |
| `analytics-views.tsx` | One `React.lazy` chunk per Analytics view. |
| `AnalyticsNav.tsx` | Left studio index (`data-ui-name="Analytics index"`, one-line `data-ui-help`, `#studio-views`). Groups then views; `role="tab"`; last view per group (persisted). Names attrs are the help — do not add a second `?` button. |
| `analytics-tabs.ts` | Five groups (behavior, time, accuracy, meta, library), views, `groupForTab` / `tabLabel` / `ANALYTICS_TAB_HELP`. A sixth group, Meaning, is specified in [`docs/JungBrain2.md`](../../docs/JungBrain2.md) and is not in this file yet. |
| `analytics-range.ts` | Presets, custom inclusive from–to, named week/month/season, prev/next (`stepAnalyticsWindow` / `previousAnalyticsWindow` / `nextAnalyticsWindow`), labels, `SAMPLE_FLOORS`, thin-window copy, date-key helpers. |
| `analytics-range-store.ts` | Remembered rolling or custom window (`cogs-analytics-range` / `brain2-analytics-range`); `stepPeriod` for Prev/Next. |
| `chart-frame.tsx` | Empty / thin furniture + **Open in Lists** (`an-open-lists`). |
| `CompletionReviewPlates.tsx` | Plates shared by Reflection and Goals, reading the completion popup and the later Reflect save (not period rituals): exact / est. / unknown time, and the same three marks for starts (an unknown start is a count, not a time), expected vs actual difficulty, optional feelings (satisfaction and distraction included), later `reflectNotes`, where hard or joyful work went, and quick-review points. |
| `open-in-lists.ts` | Chart → Lists jump. |
| `analytics-chrome.css` | Milled range/index chrome + light instrument interior (`.an-plate`, white `.an-plot-well`, pie, treemap, density, mosaic, hour×day, phosphor `.an-scope`, horizon/violin/alluvial). Plate hover dims rows/mosaic at 0.35; pie dims per `.recharts-sector` at 0.72 (not the pie `<g>` wrapper). One body scroll on `.an-content`. Title/status stay Lists. Drill / popup titles (`.an-drill`, `.an-popup`) are crisp Karla ink-green — opted out of the global CRT glow caption in `app/win95.css`. |
| `studio-kit.tsx` | FindingBlock, StudioReadout, StudioHelp, StudioCheck, CanvasTitle, SlicePie (no Recharts Legend; white 2px slice gaps; hole label; pen fills stay opaque — hover/active dims other sectors to 0.72 and strokes the active path 2px ink; never opacity on the whole pie SVG), SliceTreemap, SliceMosaic (full chroma; luminance text), SplitBar (one segment row: name · duration · percent; clickable; narrow segments keep full text in title/aria), HourDayHeatmap (opaque empty cells; first/month/last day labels), DensityCalendar, StudioBars, PhosphorTrace. |
| `studio-plots.tsx` / `studio-plot-stats.ts` | Horizon, ridgeline, violin+histogram, alluvial, beeswarm, slopegraph, UpSet, hour×pen small multiples (shared white frame), Cleveland cycle, StudioSpark (phosphor on `.an-scope`). |
| `hour-day.ts` | Hour × day occupancy. Instants off the heat; missing hours stay 0. Overlapping blocks on one minute count once, so an hour stays ≤ 60. Hour×pen small multiples + weekday cycle. |
| `observatory-findings.ts` | Pearson-r findings for Observatory. Named apart from `Observatory.tsx` (macOS case-fold). |
| `research-report.ts` / `ResearchReportView.tsx` | Meta view `research-report`: a plain-language rundown of the shared window. Sections appear only when a live series clears a floor (habit-day gap, streak, grade gap, tracking coverage, sleep, one wellbeing move, plan vs tracked minutes, text-pipeline stamps, gratitude, why / blocked-reason counts). Copy rundown is plain text. No model. |
| `signal-stats.ts` | Shannon entropy of pens/day, Gini, list HHI, Markov transitions, weekday/weekend cut, open-item ages. |
| `HabitsView.tsx` | Density calendar, sorted bars, week/month grade, Good days, climb, tracking-link split, habit-% lag trace, horizon of daily %, weekday/weekend slopegraph. Day % and rates drop exempt periods from the denominator. |
| `PointsView.tsx` | Daily stacked source split (habit / bonus / task) + cumulative + top earners. |
| `StreaksWidget.tsx` | Current + longest (not clipped). Optional week-habit streak. Not merged with Home. |
| `ReflectionView.tsx` | Legacy score trajectory + queue, plus completion-review plates (`CompletionReviewPlates.tsx`): points, clock certainty, expected vs actual difficulty, feelings (satisfaction and distraction included), later Reflect notes, goal/objective texture. Prompt history shows each task's `reflectNotes`. |
| `TodoPulseView.tsx` | Morning to-do walkthrough: labeled tier / duration / points / day importance / resistance series / day excitement; BIM mornings tagged. |
| `ReviewsView.tsx` | Rituals reader: morning (sun), start slices, end/night body, blocked-reason mosaic (Other shows the typed words). Quarter cards show the season label. Below that, a dated list of why-it-didn't notes (push, missed task, habit, missed op, and the same ritual tokens) with counts by preset and by source. The mosaic stays the ritual chart. |
| `PeriodArcReading.tsx` | Week, month, season, and year reflections in the analytics range, grouped by the ritual headings. Inspiration photos use the attachment store. |
| `SeasonsView.tsx` | Calendar-quarter comparison (this year + last year): completions, points, quarter rituals, climate rollup, season goals. |
| `OvercommitmentView.tsx` | Sentence + n; weeks/months pushed in the finding when present. Does not reschedule. |
| `VelocityView.tsx` | Completions, points, median cycle time, reward scatter. |
| `TrackingAnalytics.tsx` | Centered header bay (scope, % basis, untracked, assumed, depth, **Find blocks**) under the range bar; full help behind `?`. Plates: **How much** (metal readouts + phosphor spark), **Composition** (large donut + ranked rows as legend + **period filmstrip** + **day/week color strips** above average-day All/Mon–Sun ribbons + tags + tag bars), **Up / down** (compact white-well table vs `previousAnalyticsWindow`), **Hour × day**, **Rhythm** (weekday/weekend + hour×pen), **Duration** (violin + instants + Open in Lists). Linked `activeId` highlight lives on the composition plate — hovering a pen does not rebuild the filmstrip or the hour×day grid. Pen drill: Split/Reach, donut, **one** SplitBar with name · duration · percent (no duplicate percent row), block list → `entry-dialog` / gap → `LogActivityDialog` with `an-popup` crisp titles. Mosaic rectangles removed from Tracking only (`SliceMosaic` stays for other views). |
| `average-day.ts` / `AverageDayBoard.tsx` | Pure 15-minute slot averages → All days + Mon–Sun ribbons. Stable pen order from ranked rows; empty occupancy is white well. Sits **under** the period filmstrip in Composition. |
| `period-filmstrip.ts` / `PeriodFilmstrip.tsx` | Chronological pen bar for the whole window (Home Tracking ribbon language), **above** average-day ribbons. One owner per minute (same as the time grid); painted minutes plus gaps equal days × 1440. Gaps respect Show untracked; click block → EntryDialog, click gap → Log activity. A search jump adds `is-hit` and scrolls that block into the strip. The daily sparkline uses `uniqueMinutesByDate`. |
| `grain-strips.ts` / `GrainStrips.tsx` | One equal cell per day, and per week when the window spans two Mondays. Color is the pen at the current display depth that owned the most minutes (`minuteMap`, so overlap votes once). Empty days stay white. A tie keeps the earlier pen in the palette. |
| `tag-trends.ts` / `TagTrendBoard.tsx` | Monthly tag bars beside the weekly series from `tagWeekTrend`. Same union as `tagTotals`: a minute tagged in two scopes counts once. Zero buckets stay in the row. |
| `block-search.ts` / `BlockSearch.tsx` | Find blocks on this surface. Matcher is `searchTracking` in `lib/tracking-search.ts` (display name, notes, project, primary pen, secondary pens, counts-as chains, action formats, and a mood reading’s word, body, vibe, shorthand, reframe, and about-that). A row jumps: switch scope, highlight the filmstrip segment, open `entry-dialog`. A date outside the shared window opens the block and says so — the window does not move. **Show matches in this view** reruns the Tracking measures on that set (`SEARCH_FILTER_LIMIT`). Other paint is omitted, not called untracked, and Show untracked is paused until Clear. |
| `period-delta.ts` / `PeriodDeltaTable.tsx` | Pen minutes vs previous equal window from `previousAnalyticsWindow` (same stepper as the range bar). Ink ± deltas; "new" / "same". Renders as a tight four-column table in a scrollable white plot well (max ~320px). |
| `analytics-boards.css` | Tracking header, composition band, average-day, filmstrip, compact delta-table styles. Imported by the board components. |
| `SleepAnalytics.tsx` | Nightly strip on 6pm→noon; `~` estimated, **est.** read off the grid; duration CV + lag-1; weekday ridgelines; **against the sun**; **all-nighters** (count, frequency, time, desktop vs text-pipeline/BIM source). |
| `ScreenTimeView.tsx` | ActivityWatch-painted Screen Time: active vs untracked, top apps / categories, last-sync, alignment vs Activity occupancy. Empty sentence notes AW only records from when watchers run. `data-testid="screentime-view"`. |
| `CircadianView.tsx` | Hour × day atlas (Activity default, Mood) + Cleveland weekday cycle plot. |
| `PlacesView.tsx` | Location time-at-pen mosaic, plus repeated GPS pins (80 m) that can be named. Naming writes the Location pen. Not a geo map. |
| `MoodFieldView.tsx` | Any painted mood name (mosaic), then **Same word**, **The water**, and **Marks**. **How to read this** sits under the title. A color with no card stays out of the averages. Logged wellbeing metrics stay a separate plate. |
| `DiversityView.tsx` | Shannon entropy of pens/day + Gini of allocation + weekday vs weekend. |
| `TransitionsView.tsx` | Markov matrix of Tracking pen changes + alluvial of switch counts. |
| `ContextSwitchHeatmap.tsx` | Density calendar + hour-of-day; per-scope; Open in Lists for items with time logs. |
| `TextPipelineView.tsx` | **Text events** (text-pipeline instants) and **Text spans** (currently/stopped/switched intervals); always labeled from text pipeline. A habit duration span (`generatedBy.id` starting `kw:`) is an ordinary tracking block, not a text-pipeline row. |
| `LogEventsView.tsx` | **Log** (Time group): day bars, kind counts, clock scatter of exact and estimated times, unknown clocks as a count, phase strip from `phaseForDate` (stored marks; the Tracking log cycle well stays hidden until Enable cycle tracking is on). Filter matches the kind string (`intake.food`, `intake.drink`, `intake.drug`, `intake`, or a slug such as left room). |
| `log-event-stats.ts` | Pure counts by day and by kind, clock scatter (unknown excluded), phase strip. Tested in `log-event-stats.test.ts`. |
| `CyclePhaseView.tsx` | **Cycle phase** (Time group): phase mix of the shared window from `assessCycleDay` (batched as `assessCycleRange`). Marked days and estimated days are counted apart. Means and medians are on marked days, with n. An estimated split stays labeled, keeps n, and is not a finding. `summarizeCycleEstimates().basisNote` is a quiet line. Unknown is its own bucket. Spotting is not a phase. Empty until a bleed or ovulation mark exists. Not a diagnosis. Accuracy → **Cycle** stays stall and pushes. The shell hides this canvas while Enable cycle tracking is on and `cycleDetailsOpen` is false. |
| `cycle-phase-concealed.tsx` | Concealed stand-in for Time → Cycle phase. One line and **Show cycle**. Does not import `CyclePhaseView`. The gate is off when cycle tracking itself is off. |
| `cycle-phase-stats.ts` | Pure phase counts split by marked and estimated, daily means, zero-fill, and phase comparisons on marked days. Tested in `cycle-phase-stats.test.ts`. |
| `operation-debrief.ts` | Pure after-action summary for the shared window: mean execution, planning, and morale (integer 1–10 only), sum and mean of stored `hoursLogged`, and the written summary / what worked / what failed / lessons. Tested in `operation-debrief.test.tsx`. |
| `OperationsAnalytics.tsx` | Stage/category mosaic + work/neglect heat, plus an after-action debrief for reports in the shared window (mean execution, planning, morale; sum and mean of stored `hoursLogged`; summary, what worked, what failed, lessons). Does not restyle the Operations module. |
| `PlanVsReality.tsx` | Window ribbon + paired bars; calendar events as planned minutes; capacity vs waking window (`~` when inferred). |
| `CalibrationView.tsx` | Sentence + n + caveat; scatter; type/list breakdown when n clears the floor; PERT bands when present. |
| `CycleView.tsx` | `daysPushed` distribution, open important items, estimate confirmation, empirical survival of open stock, age beeswarm. |
| `RegretView.tsx` | Accrued cost of important items sitting undone. |
| `GoalsAnalytics.tsx` | Objective contribution, neglected goals, progress, and which linked goals held the harder or more enjoyable work. |
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

### Shell loading

One `React.lazy` view at a time. Switching unmounts the previous view; the loaded chunk stays cached.

## Studio views

The range chips sit under the title (7 / 14 / 30 / 90 plus **Custom** from–to
or this week / this month / **This season**, plus **Prev** / **Next** period
keys). The **studio index** holds groups; views of
the selected group sit beneath (`role="tab"`). Default view remains **Habits**.
**Tasks completed** includes habit Done logs (`loggedAction` from
`lib/habit-done-log.ts`) as well as Tasks, counted inside the window.

| Group | View | Data source | Contents |
|-------|------|-------------|----------|
| **Behavior** | **Habits** | `habits-store` | Density calendar, sorted bars, week/month grade, Good days, climb, tracking-linked vs manual, horizon of daily %, weekday/weekend slope. |
| | **Streaks** | habits, reviews | Current + longest; not clipped. Not merged with Home. |
| | **Points** | `points-store` | Stacked source split + cumulative; top earners jump to Lists. |
| | **Velocity** | tasks, points | Completions, median cycle time, reward vs minutes. |
| | **Reflection** | completion reviews | Legacy 1–10 trajectory (missing scores skipped) + queue. Plates for review points (3 + 0.1 per word), exact vs estimated vs unknown time, and the same three counts for starts (unknown is not a time), expected vs actual difficulty, feelings (satisfaction and distraction included), later `reflectNotes`, and which goals or objectives held the hard or joyful work. Prompt history shows each note. |
| | **Reviews** | `reviews-store` | Blocked-reason mosaic + expandable text. Quarter cards use the season label. |
| | **Seasons** | tasks, points, reviews, goals | This year and last year by calendar quarter (Spring / Summer / Fall / Winter), plus a climate rollup and season goals. Not clipped to the shared window. |
| | **Overcommit** | `daysPushed` + `timeLogs` | Sentence + n; week/month pushes noted. Not a nanny. |
| **Time** | **Tracking** | `time-tracking-store` | Centered controls; **Find blocks** (jump or show matches); facts; composition (donut + ranked rows + period filmstrip + day/week color strips **above** average-day All/Mon–Sun + tags + week/month tag bars); up/down compact white-well table vs previous window (`previousAnalyticsWindow`, same match set when a search filter is on); hour×day; weekday/weekend + hour×pen; violin. Pen drill: one SplitBar (name · dur · %); crisp `an-drill` / `an-popup` titles. Untracked drills to gap list → Log activity; painted blocks → `entry-dialog.tsx`. |
| | **Sleep** | `sleep-store` + tracking | Duration, timing, 6pm→noon strip; `~` / **est.**; duration CV + lag-1; weekday ridgelines. |
| | **Screen Time** | Screen Time scope + ActivityWatch prefs | Active vs untracked; top apps/categories; last-sync; alignment vs Activity occupancy. Empty: AW only records from when watchers run. |
| | **Circadian** | tracking | Hour × day occupancy + Cleveland weekday cycle. Missing hours are 0, not occupancy. |
| | **Places** | Location scope | Time-at-pen mosaic. No lat/lng — not a map. |
| | **Mood field** | Mood pens + `moodReading` + metrics | Any name in the mosaic. Same word, the water, and marks (with n) read only opened stretches. Wellbeing metrics stay separate. |
| | **Diversity** | tracking | Shannon entropy of pens/day, Gini of allocation, weekday vs weekend. |
| | **Transitions** | tracking | Markov P(to \| from) among pen switches + alluvial of counts. |
| | **Context Switch** | tracking | Switch density + hour-of-day; Open in Lists for time-logged items. |
| | **Text events** | tracking (`generatedBy.text` instants) | Discrete phone events + switch markers; counts by day; always from text pipeline. |
| | **Text spans** | tracking (`generatedBy.text` intervals) | currently / stopped / switched durations + switch count; always from text pipeline. Habit duration spans (`kw:`) are not included. |
| | **Log** | Tracking log instants + cycle marks | Counts by day and by kind (`intake.food`, `intake.drink`, `intake.drug`, bare `intake`, or a slug such as left room). Exact and estimated clocks scatter; unknown clocks are a count, not a plotted minute. Phase strip uses `phaseForDate` over the window — labeled from bleed days and ovulation marks, not a medical prediction. Spotting does not change the phase. The strip reads stored marks; the Tracking log cycle well is the one that stays hidden until Enable cycle tracking is on. The kind filter matches that kind string. |
| | **Cycle phase** | cycle marks + dated series | Days in the shared window by the phase `assessCycleDay` shows. A bleed or ovulation mark stays marked. A day with no ovulation in that cycle may be estimated, and that count sits beside the marked count. Means and medians use marked days, with n, for sleep, the five wellbeing metrics, mood marks that were set (energy and the other 1–10 ranks), food / drink / drug / unclassed intake logs, Screen Time and iPhone Screen Time minutes, Activity minutes, tasks completed, habit % on days with a habit log, points, and regret. An estimated split, when the window has one, is labeled estimated and keeps n; a thin estimated sample is not a finding. `basisNote` states what the guess rests on and that it is not a diagnosis. A series with nothing in the window is omitted. Unknown days stay. A silent log day counts as 0 logs; a missing sleep night or metric reading stays out. Spotting does not set a phase. Marks before the window still label days inside it. Accuracy → **Cycle** stays stall and pushes. While Enable cycle tracking is on and `cycleDetailsOpen` is false, this view is a concealed line and **Show cycle**. |
| | **Operations** | operation items + operation reviews | Stage/category mosaic + work vs neglect, plus an after-action debrief for reports in the shared window: mean execution, planning, and morale; sum and mean of stored `hoursLogged`; summary, what worked, what failed, and lessons. |
| **Accuracy** | **Plan vs Reality** | plan, events, capacity, sleep | Ribbon + events as planned minutes + waking capacity. Grain includes Season (`YYYY-Qn`). |
| | **Calibration** | tasks | Sentence + n; type/list when floor clears; PERT when present. |
| | **Cycle** | pushes, estimates | Stall distribution + confirmation rate + survival + age beeswarm of open important items. |
| | **Regret** | `regret-store` | Accrued / outstanding. Rows are local `YYYY-MM-DD`, same as the Analytics window. An old evening UTC key can still sit on the next civil day. |
| | **Goals** | `goals-store` | Progress, neglected, contributing completions, and the hard / joyful texture of linked work. |
| **Meta** | **Observatory** | aligned series | Pearson findings + Cross-section (includes Activity vs Screen Time occupancy). Thin overlap withheld. |
| | **Cross-section** | many stores | Linked density; extra series: mood, joy, switches, places, goals, Screen Time. |
| | **Metrics** | `metrics-store` | All five small-multiples + **Log {name}**. |
| | **Correlation** | metrics + aligned series | Pairwise matrix; click → scatter. Not a chart builder. |
| | **Spectrum** | habits + sleep | Autocorr, naive DFT periodogram, sleep CV. |
| | **Produce research report** | habits, tracking, sleep, metrics, plan, reviews | Rundown of this window. A plate appears only when the live rows show a shape (habit day vs median, streak, raw vs week grade, tracking coverage, sleep, one wellbeing move, planned vs tracked minutes, a text-pipeline stamp, gratitude, why / blocked-reason counts). Empty series stay in “Left out because”. Copy rundown is plain text. |
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
  drill, variant split/reach, tag totals, `tagWeekTrend`, `withPrecision`.
  `tag-trends.ts` here adds the month buckets with the same union.
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
- `lib/regret-store.ts` — accrued cost of important overdue items. Rows are local `YYYY-MM-DD`, same as the Analytics window. An old evening UTC key can still sit on the next civil day.
- `lib/operations.ts` — `buildHeatmap` for operations minutes.
- `lib/habit-accomplishment.ts` — Good days.
- `lib/incremental-habits.ts` — climb targets (not re-derived here).
- Habit % from `calculateDayPercentageAV` (`lib/calculations.ts`).

## Time context (not built)

“Only time at home”, “alone vs with Elijah”, and the other life-context slices
are specified in [`docs/time-context-vision.md`](../../docs/time-context-vision.md).
They are not in the product. Find blocks is a word search over stored blocks.
It is not a context slice. A later slice should be a predicate over `TimeEntry`
and then the same measures (`totalsFor`, filmstrip, circadian, deltas) — not a
second clock.

## Screenshots

`scripts/capture-screenshots.mjs` (`captureAnalytics`) clicks the **group** tab
then the **view** tab (`role="tab"`). Manifest chrome is `ANALYTICS_CHROME` in
`scripts/screenshot-manifest.mjs`. Recapture `docs/screenshots/07-analytics*` with
`COGS_FRESH=0` on a loaded vault so empty theater is not product truth. Do not run
a full-repo screenshot pass while other tabs are in flight.
