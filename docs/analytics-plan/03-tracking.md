# Build brief — Tracking plates

One owner: the tracking-plates agent.

Source of the ideas: `docs/analytics-vision/01-tracking.md` and the Tracking section of `docs/analytics-vision/ANALYTICS_VISION.md`. This brief does not replace those documents. It says which existing Analytics plate already draws the closest picture, and what to add beside it.

Every addition is a new plate. Leave the plate that is already there.

## What already draws

| File | Already on screen |
| --- | --- |
| `components/Analytics/TrackingAnalytics.tsx` | One scope at a time. Header bay: scope, percent basis, untracked, **Include assumed**, depth, Find blocks. Plates: How much, Composition (donut + ranked rows + period filmstrip + day/week color strips above average-day All/Mon–Sun ribbons + tag bars), Up/down, Hour × day, Rhythm, Duration (violin). Pen drill: Split/Reach. Occupancy inside a scope already unions overlapping minutes (`hour-day.ts`: an hour stays ≤ 60). |
| `components/Analytics/hour-day.ts` | Hour × day occupancy. Instants off the heat. Missing hours stay 0. Overlaps on one minute count once. |
| `components/Analytics/CircadianView.tsx` | Hour × day atlas for one chosen scope (Activity default, Mood) plus a Cleveland weekday cycle plot. |
| `components/Analytics/DiversityView.tsx` | Shannon entropy of pen shares per day, Gini of the window’s pen totals, weekday vs weekend occupancy. |
| `components/Analytics/TransitionsView.tsx` | Markov matrix of paint changes (`P(to \| from)`, same-pen continuation skipped) and an alluvial of switch counts. |
| `components/Analytics/ContextSwitchHeatmap.tsx` | When switches happen: density calendar and hour bars of pen changes. A sparse window is not a trend. |
| `components/Analytics/SleepAnalytics.tsx` | Nightly strip on 6pm→noon, estimated ends, duration CV, lag-1, weekday ridgelines, **against the sun** (`sleepSunSummary` + `DaySunTimes` for the home-city pin), all-nighters. |
| `components/Analytics/ScreenTimeView.tsx` | Mac ActivityWatch Screen Time: active vs untracked, top apps and categories, last sync, alignment vs Activity occupancy. |
| `components/Analytics/PlacesView.tsx` | Location time-at-pen mosaic at the Location depth rungs. The kicker already says there are no coordinates and this is not a map. |
| `components/Analytics/MoodFieldView.tsx` | Painted mood mosaic, hour × day, Same word, The water, Marks (with n, grasping with and without `about`). Logged 0–100 wellbeing stays a separate plate. |
| `components/Analytics/LogEventsView.tsx` | Day bars, kind counts, clock scatter of exact and estimated times, unknown clocks as a count (not a plotted minute), phase strip from `phaseForDate`. |
| `components/Analytics/CyclePhaseView.tsx` | Phase mix from `assessCycleDay`. Marked and estimated counted apart. Means and medians on marked days, with n. Estimated split stays labeled and is not a finding. `basisNote`. Unknown is its own bucket. Spotting is not a phase. The shell already hides this canvas when cycle tracking is on and `cycleDetailsOpen` is false (`cycle-phase-concealed.tsx`). |

## Counting rules the new plates must obey

Occupancy is the size of a set of `date#minute`. Two intervals on the same minute in the same scope count once. Summing `endMin − startMin` can invent a 30-hour day. Instants do not occupy. Tag minutes are unioned across scopes; within one tag, minutes are a set. Scopes are parallel paintings. Never add Activity + Location + Mood into one “hours lived.”

`spanId` is one logical event. Midnight slices are day-slices of that event.

Unknown clocks (`clockCertainty: "unknown"`) stay out of every hour chart. Their stored minute is often `0` and was not observed.

Estimated rows stay in by default. **Include assumed** on `TrackingAnalytics` already exists. Do not drop it. **Observed only**, where a plate offers it, drops `precision: "estimated"` and says how many minutes that hid. Every Mac Screen Time row is estimated; observed-only will blank that scope — say so.

## Additions

### 1. Minute cube

**Question.** At this minute, what was true in parallel: activity, location, mood, company, screen, calls, texts?

**Chart.** A ribbon stack from the existing kit: one horizontal ribbon per seeded scope that has rows (`activity`, `location`, `mood`, `company`, `screentime`, `iphone-screentime`, `iphone-calls`, `iphone-texts`), plus any person-added scope that has paint. Color is the pen at the analytics depth (do not write `displayDepth`). Instants are ticks on the ribbon, not slabs. Estimated minutes hatch. Unknown-clock instants sit in a side list, not at 00:00. Sleep (`generatedBy.kind === "sleep"`), GPS (`notes === "gps"`), and Screen Time get a thin provenance stripe.

Occupancy of the cube is a **union inside each scope**. Overlaps are marked on the minute and are not summed. A missing scope stays missing.

**File.** A new plate imported by `TrackingAnalytics.tsx`. Today that view is one scope at a time (the header scope select, the donut, the filmstrip, the average-day ribbons). The cube is an added plate. The donut, ranked rows, filmstrip, and average-day ribbons stay, still one scope.

**Must keep working.** Scope select, percent basis, untracked, Include assumed, depth, Find blocks, composition donut, filmstrip click-through (block → entry dialog, gap → log activity), hour × day, rhythm, duration violin, Split/Reach drill.

### 2. Tag co-occurrence

**Question.** Which labels travel on the same minutes?

**Chart.** A matrix (heatmap geometry already used for hour × day and for the Markov grid). Cell is lift. Support under 30 minutes is blank. Diagonal is total minutes, not lift. Universe for lift is painted minutes, not 1440. A second, smaller matrix is block-only tags (`TimeEntry.tagIds` only) versus always-on pen tags. Pen co-assignment from `secondaryPenIds` is a separate matrix, not mixed into tag lift.

Tag bars already exist on the composition plate. The matrix sits beside them.

**File.** New plate imported by `TrackingAnalytics.tsx`, next to the existing tag bars (`tagRows`, week and month tag trends).

**Must keep working.** The tag bars and the tag drill. Tag minutes stay a union across scopes.

### 3. Switch matrix

**Question.** What follows what — as paint, and as a declared switch?

**Chart.** Extend the matrix and the alluvial that `TransitionsView` already draws. Add a toggle: paint changes versus declared `switchFrom` / `switchTo` (string join, case-folded, original kept on screen). Rows and columns ordered by minutes, with an **untracked** column for leaving into a gap. Diagonal labeled: empty for paint changes, self-loop for declared switches. Click a cell lists the instants (from, to, clock, `clockCertainty`, title). The alluvial stays the count flow; do not replace it with a new chart type. Day-type alluvial (morning cluster → afternoon → evening) is addition 6, after clustering exists — it is a second alluvial plate, not a rewrite of the switch alluvial.

`ContextSwitchHeatmap` already answers when. Leave that heatmap. Do not fold the matrix into it.

**File.** `TransitionsView.tsx`.

**Must keep working.** Scope select, Markov `P(to \| from)` with same-pen continuation skipped, alluvial of switch counts, thin-sample frame (`SAMPLE_FLOORS.transitions`).

### 4. Sun as a second axis

**Question.** Is the rhythm clock time or daylight?

**Chart.** The same hour profile twice: clock hours (the hour × day / weekday cycle already drawn), and hours relative to that date’s `sunriseMinutes`. If the peak locks to sunrise, say daylight. If it locks to a clock hour, say schedule. Days with null sun stay on clock time and are flagged.

Reuse Sleep’s sun. `SleepAnalytics` already computes against-the-sun from the home-city pin and `DaySunTimes` (first write wins; default pin is the astronomy helper’s). A tracking sun toggle calls that same helper. Do not invent a second sun model or a second pin.

**File.** New plate imported by `TrackingAnalytics.tsx` (the Rhythm plate already has weekday/weekend and hour × pen). `CircadianView.tsx` may gain the same toggle on its existing hour × day and weekday cycle, because that is where the clock atlas lives. Sleep’s against-the-sun plate is the source of the computation; do not restyle Sleep to host the tracking toggle.

**Must keep working.** Tracking Rhythm plate. Circadian hour × day, scope select, Cleveland cycle plot, instants kept off the heat. Sleep’s 6pm→noon strip, ridgelines, and against-the-sun readout.

### 5. Cycle phase

**Question.** Does the day look different by marked phase, and what is only a guess?

**Chart.** `CyclePhaseView` already draws the phase mix, marked versus estimated, with n. Add beside it, only when the latch is open: phase small multiples of the day shape — four ribbons or four hour × pen heatmaps (menstrual, follicular, ovulatory, luteal), plus unknown as its own frame. Marked days only by default. Estimated days are a hatched series with `basisNote`. Spotting stays a dot inside the phase the day already has. Fewer than three marked days in a phase: show the dates, no effect sentence. Do not forecast bleeding. Do not forecast phase over a marked ovulation. Luteal length is this body’s only when `lutealSource === "marks"`; a 14-day prior stays labeled prior.

**File.** `CyclePhaseView.tsx`.

**Must keep working.** Marked versus estimated counts, means and medians on marked days with n, unknown bucket, spotting not a phase, empty until a bleed or ovulation mark, not a diagnosis. Concealment: when cycle tracking is on and `cycleDetailsOpen` is false, the shell still shows `cycle-phase-concealed.tsx` and does not mount this canvas. Do not join phase into the cube, the tag matrix, or Circadian while that latch is closed. `LogEventsView`’s phase strip already reads stored marks; leave it.

### 6. Day clustering of ribbon shape

**Question.** Which shapes does this life actually repeat?

**Chart.** A cluster strip: each day colored by its cluster, named by the median ribbon (not a slogan). Then an alluvial — morning cluster → afternoon cluster → evening cluster — using `AlluvialChart`. Vector: 24 bins of Activity at Category depth, coverage, sleep duration as a missing flag rather than 0. Phase one-hot only when the cycle latch is open; unknown stays its own bit. k from 2 to 5, kept only when the same days group after dropping a random week. With too little data, an empty frame that says the clusters are not stable. Do not cluster on raw pen ids.

**File.** New plate imported by `TrackingAnalytics.tsx`, beside the existing average-day ribbons. Those ribbons stay the “typical day” picture. The cluster strip is the “which days are which shape” picture. Diversity’s entropy sparkline can be cited as a companion number; do not replace Diversity’s entropy, Gini, or weekday cut.

**Must keep working.** Average-day All/Mon–Sun ribbons, period filmstrip, Diversity’s three readouts.

### 7. Tomorrow-shape forecast

**Question.** Is this life regular enough to have a tomorrow?

**Chart.** A horizon or a second hour ribbon of the same-weekday template: median Activity hour profile among past same-weekdays with coverage ≥ 25%, plus yesterday’s last pen. Optional hypothesis: if last night’s midpoint is known, shift that template by the difference from the median midpoint, capped at 90 minutes, labeled a hypothesis.

Show a **prediction** caption only when the baseline has a measured error: mean absolute minutes per hour on the last four same-weekdays. Otherwise an empty frame, and the template may still show without the word prediction. Do not forecast cycle phase or bleeding.

**File.** New plate imported by `TrackingAnalytics.tsx`, after the cluster strip. It reads the weekday template; it does not replace Rhythm or Circadian.

**Must keep working.** Rhythm and Circadian hour profiles, which are descriptions of the past.

### 8. Quality strip

**Question.** How much of this picture was observed?

**Chart.** A thin stacked bar for the period, on Tracking: certain intervals, estimated intervals, unknown-clock instants (a count, not minutes), open-until-midnight tails (block ends at 1440 and the next day does not continue the same pen and `spanId` — asserted through the end of the day), overlapping minutes inside a scope, dangling untracked notes. Open-until-midnight paint must not dominate entropy or a “you were in transit for 9 hours” sentence.

**Include assumed** already exists on `TrackingAnalytics` and must stay. The strip makes that choice visible. It does not replace the checkbox.

**File.** New plate imported by `TrackingAnalytics.tsx`, under the header bay so every other Tracking plate can be read against it.

**Must keep working.** Include assumed, untracked toggle, Find blocks, and Log’s existing treatment of unknown clocks as a count.

### 9. What Tracking does not store

**Question.** What must the pictures refuse to invent?

**Chart.** No new chart. A constraint on the plates above.

- No latitude or longitude on `TimeEntry`. GPS is a pen plus `notes === "gps"`, a sample stretched so the grid can show it. Repeated fixes (80 m) and their names live in `gps-places.ts`, not on the entry. `PlacesView` stays a time-at-pen mosaic plus that name list. Do not add a map.
- No `updatedAt` on `TimeEntry`. Do not claim “edited on” for a block. Sleep `updatedAt`, pen `editedAt`, and day-note `createdAt` versus the day key are the honesty stamps that exist.
- Do not fold plan events, task `timeLogs`, or habit grades into Tracking occupancy. Tags are the bridge; this owner does not recompute a habit grade.
- Do not draw `estimateOf.kind === "import"` as a cohort. Nothing writes it.
- Window titles stay off unless `storeWindowTitles` is on. Do not show an empty top-windows chart.
- Mac and iPhone Screen Time stay two trees (different pen ids). `ScreenTimeView` today is the Mac scope. An icicle (category → app → domain) may be added there later as its own plate; do not replace the top-apps list, the category list, last-sync, or the Activity alignment readout. AFK stays “not at keyboard.”

**File.** `PlacesView.tsx` only to keep the not-a-map sentence true if copy nearby changes. Do not add coordinates. `ScreenTimeView.tsx` only if an icicle plate is added beside the lists that already exist.

**Must keep working.** Places mosaic and depth control. Screen Time active vs untracked, top apps, categories, last sync, alignment.

## Out of this owner’s first pass

These are in the vision and are not an addition in this brief: seasonality decomposition, changepoints, sequence mining, day-level association rules, the anomaly split (bad data versus unusual life), bout survival curves, Lorenz (Diversity already has Gini), mood-mark dots beyond what Mood field already draws, count-tick join, day-note writing delay. A later brief can name them. Do not start them while building the nine additions above.

## Files this owner may edit

- New plate files imported by `TrackingAnalytics.tsx`.
- `TrackingAnalytics.tsx`, only to mount those plates. Do not remove a plate that is already there.
- `TransitionsView.tsx` for the switch-matrix extension.
- `CircadianView.tsx` for the sun toggle on the atlas that already exists.
- `CyclePhaseView.tsx` for phase small multiples. Do not weaken concealment.
- `PlacesView.tsx` and `ScreenTimeView.tsx` only for the constraints in addition 9.

It must not edit Habits files, Plan files, or any other `docs/analytics-plan` file.

## Done when

Each addition above is a plate whose question, chart, and counting rule match this brief. The donut, tag bars, Markov matrix, alluvial, against-the-sun sleep plate, cycle concealment, Include assumed, Places-not-a-map, and unknown-clocks-as-a-count still work. The tomorrow plate is an empty frame whenever the same-weekday baseline has no measured error.
