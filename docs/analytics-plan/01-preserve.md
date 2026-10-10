# Build brief — preserve every Analytics view

Preservation inventory for a later redesign. Groups may move. Rooms may be added. A view id must not be deleted, and a working chart must not be thinned.

Source of the contract: `ANALYTICS_TAB_HELP` in `components/Analytics/analytics-tabs.ts`, the lazy map in `components/Analytics/analytics-views.tsx`, the file table and studio views table in `components/Analytics/README.md`, colocated `components/Analytics/*.test.ts` / `*.test.tsx`, and `07-analytics*` rows in `docs/screenshots/README.md`.

**Later owner:** a preserve agent. After any shell move, run the existing Analytics tests. Do not redesign charts.

Count of current view ids: **40**, including the seed `research-report` (Meta). Meaning is specified and is not one of those ids yet. The group redesign in this folder has not shipped.

---

## Behavior

### `habits` — Habits

- **Component:** `HabitsView.tsx`
- **Already good:** Daily completion for the shared window. Heatmap cells are percent of habits met that day. Bars sort by rate. Week/month grades use the same math as Home Habits (`calculateDayPercentageAV`); exempt periods drop out of the denominator. Horizon folds daily % into three bands. Slopegraph is weekday vs weekend rate per habit. Also Good days, climb, tracking-link split, habit-% lag trace.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics.png`

### `streaks` — Streaks

- **Component:** `StreaksWidget.tsx`
- **Already good:** Current and longest runs are all-time, not clipped to this window. Home glance and this tab stay separate. Optional week-habit streak.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-streaks.png`

### `points` — Points

- **Component:** `PointsView.tsx`
- **Already good:** Daily points stacked by source (habit / bonus / task), plus cumulative. Top earners open those items in Lists.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-points.png`

### `velocity` — Velocity

- **Component:** `VelocityView.tsx`
- **Already good:** Completions and points per day, plus median time from start (or create) to done, and a reward scatter. Display only — does not nag.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-velocity.png`

### `reflection` — Reflection

- **Component:** `ReflectionView.tsx` (plates in `CompletionReviewPlates.tsx`)
- **Already good:** Completion reviews. Legacy satisfaction / resistance / focus / distraction stay on the trajectory (a missing score is skipped, not a 5). New plates: review points (3 + 0.1 per word), exact vs estimated vs unknown time (unknown is a count, not zero), the same three marks for starts (an unknown start is a count, not a time), expected vs actual difficulty, optional feelings, and which goals or objectives held the hard or joyful work. Prompt history shows each task's `reflectNotes`.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-reflection.png`

### `todo-pulse` — To-do pulse

- **Component:** `TodoPulseView.tsx`
- **Already good:** Morning walkthrough fields on to-dos: tier, expected duration, points, day importance (0–10), resistance readings over time (0–10, many samples), and day excitement (0–10). Each number is labeled. Text-pipeline mornings stay tagged as from BIM.
- **Test:** no colocated test found
- **Screenshot:** no sidecar listed

### `reviews` — Reviews

- **Component:** `ReviewsView.tsx`
- **Already good:** Saved period + morning reviews. Morning cards show all-nighter, affirmations, to-dos, priorities, habit priorities, day plan, circumstances, best day, gratitude (BIM text-pipeline labeled). Expand a period card for evening text. Blocked-reason mosaic is counts, not a ranking (Other shows the typed words). Quarter cards use the season label. Below that, a dated list of why-it-didn't notes.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-reviews.png`

### `seasons` — Seasons

- **Component:** `SeasonsView.tsx`
- **Already good:** Calendar quarters named as seasons: Q1 Spring, Q2 Summer, Q3 Fall, Q4 Winter. This year and last year show completions, points, and season rituals, plus a climate rollup. Season goals are the Goals whose period is Season. This view is not clipped to the shared date window.
- **Test:** no colocated test found
- **Screenshot:** no sidecar listed

### `overcommit` — Overcommit

- **Component:** `OvercommitmentView.tsx`
- **Already good:** Reconstructed day-pushes and logged minutes, sentence + n, weeks/months pushed in the finding when present. This tab does not reschedule anything.
- **Test:** `OvercommitmentView.test.tsx`
- **Screenshot:** `07-analytics-overcommit.png`

---

## Time

### `tracking` — Tracking

- **Component:** `TrackingAnalytics.tsx` (boards: `PeriodFilmstrip.tsx`, `GrainStrips.tsx`, `AverageDayBoard.tsx`, `BlockSearch.tsx`, `PeriodDeltaTable.tsx`, `TagTrendBoard.tsx`)
- **Already good:** Same minutes as Home → Tracking. Donut and ranked rows are the same slices — click either to drill. Period filmstrip is chronological paint. Days and Weeks color each cell by the pen that took the most minutes at the selected depth. Average-day ribbons (All + Mon–Sun) show when pens typically sit on the clock in 15-minute slots. Find blocks matches names, pens, secondary pens, counts-as chains, and action formats — jump highlights the block; Show matches redraws this view on that set only (other paint is hidden, not called untracked). Click Untracked for the gap list, then Log activity; click a painted block to edit via the Home Tracking entry dialog. % of tracked vs % of day are both meant. Include assumed for estimated blocks. Up/down compares each pen to the equal-length period before this window. Tag bars are weekly and monthly minutes, a minute tagged in two scopes counted once. Block-length violin is duration of painted spans; hour × pen small multiples share Circadian's 24 columns.
- **Test:** `period-filmstrip.test.ts`, `grain-strips.test.ts`, `average-day.test.ts`, `block-search.test.ts`, `period-delta.test.ts`, `tag-trends.test.ts`, `hour-day.test.ts`
- **Screenshot:** `07-analytics-tracking.png` (also `07-analytics-tracking-breakdown.png`, `07-analytics-tracking-tag.png`)

### `sleep` — Sleep

- **Component:** `SleepAnalytics.tsx`
- **Already good:** Nights from the sleep log and Sleep-painted grid, same stretch as Tracking. Nightly strip is 6pm→noon. `~` means an end was estimated; **est.** means the night was read off paint. Blank nights are excluded from averages, not counted as zero. Ridgelines are Gaussian KDEs of duration and bedtime by weekday. Against the sun uses each day's stored sunrise/sunset. Duration CV + lag-1. All-nighters: count, frequency, time, desktop vs text-pipeline/BIM source.
- **Test:** `SleepAnalytics.test.tsx`
- **Screenshot:** `07-analytics-sleep.png`

### `screentime` — Screen Time

- **Component:** `ScreenTimeView.tsx`
- **Already good:** Active vs untracked from ActivityWatch-painted Screen Time scope; AFK is untracked; alignment vs human Activity occupancy; last-sync from prefs. Empty sentence notes AW only records from when watchers run.
- **Test:** `ScreenTimeView.test.tsx`
- **Screenshot:** `07-analytics-screentime.png`

### `circadian` — Circadian

- **Component:** `CircadianView.tsx`
- **Already good:** Hour × day occupancy. Empty cells are missing hours, not zero work. Instants have no duration and stay off the heat. The weekday cycle plot is Cleveland's mean occupancy by hour, one row per weekday. Activity default, Mood available.
- **Test:** `hour-day.test.ts`
- **Screenshot:** `07-analytics-circadian.png`

### `places` — Places

- **Component:** `PlacesView.tsx`
- **Already good:** Location pens as time-at-pen. Repeated GPS fixes can be named (80 m, `gps-places.ts`); the mosaic is still not a map. Depth uses the same rungs as Tracking.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-places.png`

### `mood-field` — Mood field

- **Component:** `MoodFieldView.tsx`
- **Already good:** Any painted mood name, plus the stretches you opened: same word, the water, and marks (each with n; blanks left out). A color with no card stays out of the averages. Logged joy / suffering / alignment still sit beside that when n allows. How to read this sits under the title.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-mood-field.png`

### `diversity` — Diversity

- **Component:** `DiversityView.tsx`
- **Already good:** Shannon entropy of Tracking pens per day (H = −Σ p log₂ p of that day's minute shares) plus Gini of the window's pen totals and weekday vs weekend occupancy. 0 bits = one pen took the day.
- **Test:** `signal-stats.test.ts`
- **Screenshot:** `07-analytics-diversity.png`

### `transitions` — Transitions

- **Component:** `TransitionsView.tsx`
- **Already good:** Markov matrix of Tracking pen changes: P(to | from) among switches only. Same-pen continuation is not a transition. Rows sum to 1. The alluvial below uses raw switch counts (not p, not duration).
- **Test:** `signal-stats.test.ts`
- **Screenshot:** `07-analytics-transitions.png`

### `context-switch` — Context Switch

- **Component:** `ContextSwitchHeatmap.tsx`
- **Already good:** A switch is a pen change: one block ending and another beginning. Density calendar plus hour-of-day showing when fragmentation clusters. Per-scope. Open in Lists for items with time logs.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-context-switch.png`

### `text-events` — Text events

- **Component:** `TextPipelineView.tsx` (`TextEventsView`)
- **Already good:** Activity instants from the phone text pipeline (log:, discrete triggers, switch markers). Always labeled from text pipeline. Counts by day in the shared Analytics range.
- **Test:** no colocated test found
- **Screenshot:** no sidecar listed

### `text-spans` — Text spans

- **Component:** `TextPipelineView.tsx` (`TextSpansView`)
- **Already good:** currently / stopped / switched Activity intervals stamped by the text pipeline. Shows painted durations and switch-instant counts. Always labeled from text pipeline.
- **Test:** no colocated test found
- **Screenshot:** no sidecar listed

### `log` — Log

- **Component:** `LogEventsView.tsx` (math in `log-event-stats.ts`)
- **Already good:** Activity instants from Tracking log: food, drink, drug, bare intake, and any event phrase (left room). Counts by day and by kind (`intake.food`, `intake.drink`, `intake.drug`, `intake`, or a slug such as left room). Money spent is its own shelf on the Tracking log (`spendAmount` in cents, `spendOn`, `spendSource`) and is not folded into these event kinds. Exact and estimated clocks scatter; unknown clocks are a count, not a point on the stored minute. The phase strip is labeled from bleed days and ovulation marks over this window — not a medical prediction. Spotting is recorded and does not change the phase. Filter by that kind string; there is no preset list of events.
- **Test:** `log-event-stats.test.ts`
- **Screenshot:** no sidecar listed

### `cycle-phase` — Cycle phase

- **Component:** `CyclePhaseView.tsx` (math in `cycle-phase-stats.ts`; concealed stand-in `cycle-phase-concealed.tsx`)
- **Already good:** Days in this window labeled menstrual, follicular, ovulatory, luteal, or unknown from bleed days and ovulation marks. Marked days and estimated days are counted apart. Means and medians are on marked days, with n. A missing reading stays out; a log count treats a silent day as 0 logs. Unknown days stay in their own bucket. Spotting is not a phase. An estimated split stays labeled, keeps n, and is not a finding. This describes logs. It is not a diagnosis. Accuracy → Cycle stays stall and pushes.
- **Test:** `CyclePhaseView.test.tsx`, `cycle-phase-stats.test.ts`, `cycle-phase-concealed.test.tsx`
- **Screenshot:** no sidecar listed

### `operations` — Operations

- **Component:** `OperationsAnalytics.tsx` (debrief math in `operation-debrief.ts`)
- **Already good:** Operation items: stage/category mosaic and work vs neglect from timeLogs, plus an after-action debrief for reports in the shared window (mean execution, planning, and morale on integer 1–10; sum and mean of stored `hoursLogged`; summary, what worked, what failed, lessons). Does not restyle the Operations module.
- **Test:** `operation-debrief.test.tsx`
- **Screenshot:** `07-analytics-operations.png`

---

## Accuracy

### `plan` — Plan vs Reality

- **Component:** `PlanVsReality.tsx`
- **Already good:** Planned minutes (tasks + calendar events) vs actual. Window ribbon and paired bars. Capacity vs the waking window is labeled `~` when sleep is inferred. Grain includes Season (`YYYY-Qn`).
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-plan-vs-reality.png`

### `calibration` — Calibration

- **Component:** `CalibrationView.tsx`
- **Already good:** Estimate vs actual. Findings print only when n clears the floor. Type/list breakdown when the floor clears. PERT bands appear only on items that have a three-point estimate.
- **Test:** `CalibrationView.test.tsx`
- **Screenshot:** `07-analytics-calibration.png`

### `cycle` — Cycle

- **Component:** `CycleView.tsx`
- **Already good:** How often items were pushed, how old open important items are (survival of the current stock plus a beeswarm of ages), and how often estimates were confirmed. This is stall and pushes, distinct from Time → Cycle phase.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-cycle.png`

### `regret` — Regret

- **Component:** `RegretView.tsx`
- **Already good:** Accrued cost of important items sitting undone past due. Not a to-do list. Rows are local `YYYY-MM-DD`. The view id stays; the prose does not call the person regretful.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-regret.png`

### `goals` — Goals

- **Component:** `GoalsAnalytics.tsx`
- **Already good:** Objective contribution and neglected goals in this window, plus which linked goals held the harder or more enjoyable work. Open those items in Lists.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-goals.png`

---

## Meta

### `observatory` — Observatory

- **Component:** `Observatory.tsx` (findings in `observatory-findings.ts`)
- **Already good:** Classical Pearson r on inner-joined calendar days. Correlation is not causation. Thin overlap is watermarked, not a finding (n below 7). Linked Cross-section includes Activity vs Screen Time occupancy.
- **Test:** `observatory.test.ts`
- **Screenshot:** `07-analytics-observatory.png`

### `cross-section` — Cross-section

- **Component:** `CrossSection.tsx` (series in `cross-section.ts`)
- **Already good:** Linked density: hover or pin a day to highlight the same column in every series (habits, tracking, sleep, completions, points, operations, regret, mood, joy, switches, places, goals, Screen Time occupancy). Missing nights stay blank. Empty rows say so.
- **Test:** `cross-section.test.ts`
- **Screenshot:** `07-analytics-cross-section.png`

### `metrics` — Metrics

- **Component:** `MetricsTrends.tsx`
- **Already good:** All five wellbeing series as small multiples. Pick one for the detail chart. Log {name} writes into the same store as the Metrics key on Current moment.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-metrics.png`

### `correlation` — Correlation

- **Component:** `CorrelationExplorer.tsx`
- **Already good:** Pairwise Pearson matrix (metrics + habit % / tracking / sleep / points). Click a cell for the scatter and sentence. Not a chart builder.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-correlation.png`

### `spectrum` — Spectrum

- **Component:** `SpectrumView.tsx`
- **Already good:** Lag-1 / lag-7 autocorrelation of daily habit % and of sleep duration, a naive DFT periodogram of habit %, and coefficient of variation of sleep. Classical only — not a forecast.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-spectrum.png`

### `research-report` — Produce research report

- **Component:** `ResearchReportView.tsx` (`research-report.ts` chooses the sections)
- **Already good:** Seed only. Live stores, shared window. A plate when a series has a shape; an empty series is a left-out sentence. Copy rundown is plain text. No sentiment score.
- **Test:** `research-report.test.ts`
- **Screenshot:** none yet

---

## Library

Library stays inside Analytics. Item Types is not moved to Settings. Settings still edits type schemas.

### `item-types` — Item Types

- **Component:** `ItemTypesLibrary.tsx`
- **Already good:** Every item type by count. Browse, sort, drill. Settings still edits schemas. Open in Lists jumps to those items.
- **Test:** `ItemTypesLibrary.test.tsx`
- **Screenshot:** `07-analytics-item-types.png`

### `lists-areas` — Lists & areas

- **Component:** `ListsAreasView.tsx`
- **Already good:** Lists sized by item count (area ∝ n). Switch to Rate for completion %. Click a tile to open that list. HHI of item counts.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-lists-areas.png`

### `attributes` — Attributes

- **Component:** `AttributesView.tsx`
- **Already good:** Histograms from type and list schemas that already exist. Not a custom formula builder.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-attributes.png`

### `tags` — Tags

- **Component:** `LibraryCuts.tsx` (`TagsView`)
- **Already good:** Free-form item tags. Area follows how many items carry the tag. The UpSet matrix counts exact tag combinations. Click to open those items.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-tags.png`

### `stages` — Stages

- **Component:** `LibraryCuts.tsx` (`StagesView`)
- **Already good:** Lifecycle bucket (inbox / clarified / scheduled / completed / list). This is `Task.stage`, not a list name.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-stages.png`

### `weight` — Weight

- **Component:** `LibraryCuts.tsx` (`WeightView`)
- **Already good:** Importance, cognitive load, and entropy already stored on items. Missing values stay missing.
- **Test:** no colocated test found
- **Screenshot:** `07-analytics-weight.png`

---

## Do not regress

Each item names the file that owns it.

- **Tracking filmstrip, day/week strips, average-day ribbons, Find blocks / Show matches** — `TrackingAnalytics.tsx`, `PeriodFilmstrip.tsx` / `period-filmstrip.ts`, `GrainStrips.tsx` / `grain-strips.ts`, `AverageDayBoard.tsx` / `average-day.ts`, `BlockSearch.tsx` / `block-search.ts`. Chronological paint; one owner per minute; Days/Weeks color the pen with the most minutes at the selected depth; All + Mon–Sun 15-minute ribbons; jump highlights a block; Show matches redraws measures on that set only and does not call omitted paint untracked.
- **Sleep 6pm-to-noon strip, `~` and est., blank nights excluded** — `SleepAnalytics.tsx`. `~` is an estimated end; **est.** is read off paint; blank nights stay out of averages.
- **Habit grades using the same math as Home Habits; exempt periods out of the denominator** — `HabitsView.tsx` with `calculateDayPercentageAV` in `lib/calculations.ts`.
- **Plan vs Reality ribbon and waking-window capacity labeled `~` when sleep is inferred** — `PlanVsReality.tsx` and `components/Home/Plan/plan-capacity.ts`.
- **Correlation click-through to scatter** — `CorrelationExplorer.tsx`. A cell opens the scatter and the sentence.
- **Cycle phase concealment when tracking is on and `cycleDetailsOpen` is false** — `enhanced-analytics.tsx` plus `cycle-phase-concealed.tsx`. Show cycle and a concealed line; the phase canvas does not mount. The gate is off when cycle tracking itself is off.
- **Range stepper (Prev/Next, custom window, week/month/season)** — `analytics-range.ts` (`stepAnalyticsWindow` / `previousAnalyticsWindow` / `nextAnalyticsWindow`) and `analytics-range-store.ts`.
- **Open in Lists** — `open-in-lists.ts` and `chart-frame.tsx` (`an-open-lists`).
- **One lazy view at a time** — `analytics-views.tsx`. Switching unmounts the previous view; the loaded chunk stays cached. The shell does not import every chart.
- **Sample floors / thin-window watermark** — `analytics-range.ts` (`SAMPLE_FLOORS`). Observatory withholds findings with n below 7 (`observatory-findings.ts`). Interpretive views watermark a thin window; they do not print it as a finding.
- **Library stays inside Analytics** — `analytics-tabs.ts` group `library` and `ItemTypesLibrary.tsx`. Item Types is not moved to Settings.

Shell tests that guard the studio, not a single chart: `analytics-tabs.test.ts`, `analytics-range.test.ts`, `enhanced-analytics.test.tsx`, `studio-views.test.tsx`, `open-in-lists.test.ts`.

---

## Views the vision inventories do not replace

These already have a home and must keep one. A language, tracking, or plan inventory does not stand in for them.

- `points`, `velocity`, `reflection`, `todo-pulse`, `seasons`, `goals`, `operations`, `regret`
- The six library views: `item-types`, `lists-areas`, `attributes`, `tags`, `stages`, `weight`

**Meaning (unbuilt).** Specified in `docs/JungBrain2.md` (Wave 14) and named in `components/Analytics/README.md`. Not in `analytics-tabs.ts` yet. Sixth studio group: Coincidence, Symbols, and Exceptions. Defaults on; can be hidden from Settings. A series shows an observed count and an expected-by-chance count. The app never marks a run meaningful on its own. Causal groups stay as they are.
