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
and `signal-stats.ts` here. No LLM in this studio today. Tasks, habits, and tracking stay in their own stores. Sources → Browser keeps Chrome exports in IndexedDB (`brain2-browser-history`, `lib/browser-history.ts`) and paints Screen Time through `lib/chrome-sessions.ts`. The intention to read task why, why an action was not taken, gratitude, day / week / month plan text, and the other stored prose with sentiment, machine learning, language models, and embeddings — beside the classical counts, and with a word cloud among the pictures — is [`docs/analytics-vision/06-language.md`](../../docs/analytics-vision/06-language.md). That reading is unbuilt. It does not add a store, and it does not write a model sentence back as if the person had typed it. The build that adds it, and that regroups this studio without dropping a view id or its math, is [`docs/analytics-plan/`](../../docs/analytics-plan/README.md). Those briefs are not a change to this tab.

**Product law (this tab only):** keep the `.fm98` **title bar** and **status bar**
so Analytics still lives in Brain2 next to Lists. Inside them the room is an **esoteric data plate**
(`analytics-atlas.css`, drawn from designrefs 0001–0124; see
[`docs/DESIGN_REFS.md`](../../docs/DESIGN_REFS.md#analytics-atlas-0001-0124)):
_Last mapped: 2026-10-23_ the range bay is a plain paper header with one ink
rule under it (the cobalt plate, field rings and degree ruler were retired
2026-10-23 at the person's ask), holding chrome-rimmed typewriter keys with
steel ball-bearing lamps (the lit lamp is a cool pearl). Groups are steel catalog
drawers; views are index cards with staggered trapezoid tabs, the open one a black
guide tab with its number. Canvases and plot wells are plain cool white paper,
no graph rule. Each `.an-plate` has a double rule and crop marks, and each
`.an-canvas-title` is numbered `FIG. 01`, `FIG. 02`… by a CSS counter. Readouts
are one ruled card. `.an-scope` is a dark graphite well with a cobalt grid and a
white trace. Type (loaded in `app/layout.tsx` via `next/font`, 2026-10-23):
**Bricolage Grotesque** (`--font-an-display`) for titles and values,
**Instrument Sans** (`--font-an-text`) for keys, labels, ticks, prose and
portaled drills, with tabular numbers. This replaces the pixel faces in this
room only; Home and Lab keep theirs. Section map: [`docs/analytics/INDEX.md`](../../docs/analytics/INDEX.md). No italics. One accent,
cobalt. No yellow, no celestial or astrology motifs (star icons are fine). Data fills (heat hues, pens, item-type colors)
are data and are not re-tinted. The skin is CSS only: same DOM, same `role="tab"`
contract, same classes. Do not restyle Lists, Habits, Plan, Tracking, or
Scheduler to match.

**Always create as many tooltips and provide as many clear instructions as
possible if applicable and needed.** Each view has `ANALYTICS_TAB_HELP` under the
nav; instructional copy sits behind `StudioHelp` (`?`) on titled canvases, plus
native `title` on controls. KPI readouts use `formatCrtNumber` (`lib/crt-number.ts`)
so Points and siblings do not float-print. Groups in the left index are a short
segment control (Views keep their row height). Habits / Observatory lead with
heatmap or cross-section plates before denser tables.

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

_Last mapped: 2026-10-23_ **Sources → Instagram feeds the Instagram lists.** Each new report build is written onto the seven Instagram lists in Lists (followers, following, mutuals, no follow-back, fans, pending, blocked) by `lib/instagram-lists-sync.ts`. It runs on its own at start and after a build, and the **Update my lists** key in the bar (desktop) redoes it.

_Last mapped: 2026-10-23_ **Time active feeds iPhone Screen Time.** Each session in the last-month window (the 275 behind the sessions tile) is painted in Tracking → iPhone Screen Time as an estimated **Instagram** block with the note `derived from instagram data`, by `lib/instagram-sessions-sync.ts`. It runs at start, after a build, and from **Update my lists**. Older years are not painted (action-only floors; localStorage room). The session list comes from `analyze.py` (`time_active.sessions_recent`); a build made before that change has none until it is rebuilt.

**Meaning group (planned, not built).** Wave 14 in
[`docs/JungBrain2.md`](../../docs/JungBrain2.md) adds a sixth studio group,
Meaning, with Coincidence, Symbols, and Exceptions. It defaults on and can be
hidden from Settings. Causal groups stay as they are. A series shows an
observed count and an expected-by-chance count. The app never marks a run
meaningful on its own.

**Item Types** is a first-class Analytics **Library** view. Settings still
**edits** types. Do not move the library out of Analytics.

_Last mapped: 2026-10-23_ Visualization ideas from Information is Beautiful, per view, are in [`docs/analytics/viz-inspiration.md`](../../docs/analytics/viz-inspiration.md). It is a menu, not a spec.

## Files

| File | Purpose |
|------|---------|
| `enhanced-analytics.tsx` | Window: title + studio range/nav/canvas + status. Persists the active view and canvas scroll. `data-ui-name="Analytics"` (docs path this file). Mounts `useScreenTimeSync` while Analytics is open. The open view is a lazy chunk (`analytics-views.tsx`); the shell does not import every chart. Time → Cycle phase stays that chunk when cycle tracking is off. When it is on and `cycleDetailsOpen` is false, the shell shows **Show cycle** and a concealed line (`cycle-phase-concealed.tsx`) and does not mount the phase canvas. |
| `analytics-views.tsx` | One `React.lazy` chunk per Analytics view. |
| `AnalyticsNav.tsx` | Left studio index (`data-ui-name="Analytics index"`, one-line `data-ui-help`, `#studio-views`). Groups then views; `role="tab"`; last view per group (persisted). Names attrs are the help — do not add a second `?` button. |
| `analytics-tabs.ts` | Seven groups (behavior, time, accuracy, meta, texts, library, sources), views, `groupForTab` / `tabLabel` / `ANALYTICS_TAB_HELP`. A Meaning group is specified in [`docs/JungBrain2.md`](../../docs/JungBrain2.md) and is not in this file yet. |
| `analytics-range.ts` | Presets, custom inclusive from–to, named week/month/season, prev/next (`stepAnalyticsWindow` / `previousAnalyticsWindow` / `nextAnalyticsWindow`), labels, `SAMPLE_FLOORS`, thin-window copy, date-key helpers. |
| `analytics-range-store.ts` | Remembered rolling or custom window (`cogs-analytics-range` / `brain2-analytics-range`); `stepPeriod` for Prev/Next. |
| `chart-frame.tsx` | Empty / thin furniture + **Open in Lists** (`an-open-lists`). |
| `CompletionReviewPlates.tsx` | Plates shared by Reflection and Goals, reading the completion popup and the later Reflect save (not period rituals): exact / est. / unknown time, and the same three marks for starts (an unknown start is a count, not a time), expected vs actual difficulty, optional feelings (satisfaction and distraction included), later `reflectNotes`, where hard or joyful work went, and quick-review points. |
| `open-in-lists.ts` | Chart → Lists jump. |
| `accuracy-stats.ts` / `accuracy-views.css` | Pure math and skin for the new Accuracy plates (band verdicts, barcode, bias stats, size bins, PERT hits, age bands, done share by pushes, goal pace). Tested in `accuracy-stats.test.ts`. _Last mapped: 2026-10-23_ |
| `analytics-chrome.css` | Milled range/index chrome + light instrument interior (`.an-plate`, white `.an-plot-well`, pie, treemap, density, mosaic, hour×day, phosphor `.an-scope`, horizon/violin/alluvial). Plate hover dims rows/mosaic at 0.35; pie dims per `.recharts-sector` at 0.72 (not the pie `<g>` wrapper). One body scroll on `.an-content`. Title/status stay Lists. Drill / popup titles (`.an-drill`, `.an-popup`) are crisp Karla ink-green — opted out of the global CRT glow caption in `app/win95.css`. |
| `studio-kit.tsx` | FindingBlock, StudioReadout (`formatCrtNumber` for numeric values), StudioHelp (`?`), StudioCheck, CanvasTitle, SlicePie (no Recharts Legend; white 2px slice gaps; hole label; pen fills stay opaque — hover/active dims other sectors to 0.72 and strokes the active path 2px ink; never opacity on the whole pie SVG), SliceTreemap, SliceMosaic (full chroma; luminance text), SplitBar (one segment row: name · duration · percent; clickable; narrow segments keep full text in title/aria), HourDayHeatmap (opaque empty cells; first/month/last day labels), DensityCalendar, StudioBars (`formatCrtNumber`), PhosphorTrace. |
| `studio-plots.tsx` / `studio-plot-stats.ts` | Horizon, ridgeline, violin+histogram, alluvial, beeswarm, slopegraph, UpSet, hour×pen small multiples (shared white frame), Cleveland cycle, StudioSpark (phosphor on `.an-scope`). |
| `hour-day.ts` | Hour × day occupancy. Instants off the heat; missing hours stay 0. Overlapping blocks on one minute count once, so an hour stays ≤ 60. Hour×pen small multiples + weekday cycle. |
| `observatory-findings.ts` | Pearson-r findings for Observatory. Named apart from `Observatory.tsx` (macOS case-fold). |
| `research-report.ts` / `ResearchReportView.tsx` | Meta view `research-report`: a plain-language rundown of the shared window. Sections appear only when a live series clears a floor (habit-day gap, streak, grade gap, tracking coverage, sleep, one wellbeing move, plan vs tracked minutes, text-pipeline stamps, gratitude, why / blocked-reason counts). Copy rundown is plain text. No model. |
| `signal-stats.ts` | Shannon entropy of pens/day, Gini, list HHI, Markov transitions, weekday/weekend cut, open-item ages. |
| `HabitsView.tsx` | Density calendar, sorted bars, week/month grade, Good days, climb, tracking-link split, habit-% lag trace, horizon of daily %, weekday/weekend slopegraph. Day % and rates drop exempt periods from the denominator. |
| `PointsView.tsx` | Daily stacked source split (habit / bonus / task) + cumulative + top earners. _Last mapped: 2026-10-20_ A **Points ledger** plate (`#analytics-points-ledger`) lists every award, newest first; a row opens the same breakdown as Home Latest award (`components/Home/award-detail.tsx`). Latest award's foot key lands here through `lib/points-ledger-nav.ts`, and the row that was open on Home opens expanded. |
| `StreaksWidget.tsx` | Current + longest (not clipped). Optional week-habit streak. Not merged with Home. |
| `ReflectionView.tsx` | Legacy score trajectory + queue, plus completion-review plates (`CompletionReviewPlates.tsx`): points, clock certainty, expected vs actual difficulty, feelings (satisfaction and distraction included), later Reflect notes, goal/objective texture. Prompt history shows each task's `reflectNotes`. |
| `TodoPulseView.tsx` | Morning to-do walkthrough: labeled tier / duration / points / day importance / resistance series / day excitement; BIM mornings tagged. |
| `ReviewsView.tsx` | Rituals reader: morning (sun), start slices, end/night body, blocked-reason mosaic (Other shows the typed words). Quarter cards show the season label. Below that, a dated list of why-it-didn't notes (push, missed task, habit, missed op, and the same ritual tokens) with counts by preset and by source. The mosaic stays the ritual chart. |
| `PeriodArcReading.tsx` | Week, month, season, and year reflections in the analytics range, grouped by the ritual headings. Inspiration photos use the attachment store. |
| `SeasonsView.tsx` | Calendar-quarter comparison (this year + last year): completions, points, quarter rituals, climate rollup, season goals. |
| `OvercommitmentView.tsx` | Sentence + n; weeks/months pushed in the finding when present. Does not reschedule. |
| `VelocityView.tsx` | Completions, points, median cycle time, reward scatter. |
| `TrackingAnalytics.tsx` | Centered header bay (scope, % basis, untracked, assumed, depth, **Find blocks**) under the range bar; full help behind `?`. Plates: **How much** (metal readouts + phosphor spark), **Composition** (large donut + ranked rows as legend + **period filmstrip** + **day/week color strips** above average-day All/Mon–Sun ribbons + tags + tag bars), **Up / down** (compact white-well table vs `previousAnalyticsWindow`), **Hour × day**, **Rhythm** (weekday/weekend + hour×pen), **Duration** (violin + instants + Open in Lists). Linked `activeId` highlight lives on the composition plate — hovering a pen does not rebuild the filmstrip or the hour×day grid. Pen drill: Split/Reach, donut, **one** SplitBar with name · duration · percent (no duplicate percent row), block list → `entry-dialog` / gap → `LogActivityDialog` with `an-popup` crisp titles. Mosaic rectangles removed from Tracking only (`SliceMosaic` stays for other views). After the composition: **By level** (`TrackingContextPlates.tsx`, `LevelLadderPlate`) — one 100% bar per named level of the chosen view, minutes rolled to the pen at that level, “No {level}” grey when a chain lacks that rung; click drills the pen. **Who you were with** (`CompanyHeadcountPlate`, `lib/company-headcount.ts`) — Company minutes by headcount (Alone, 1, 2, 3, 4+, count unknown), readouts for alone / with others / mean company / not recorded, top Activity pens per headcount, and most time with. Unknown company is neither alone nor with anyone. |
| `PeopleView.tsx` | Time → **People**. Company person pens (`isPersonPen`), minutes from `personMinuteMasks` (Company blocks naming them ∪ Social “Who with?” ticks). Readouts (people seen, time with anyone, new faces, drifting), the **Who** table (window time, change vs the previous window, days, times, last, usual activity · place, rhythm), **Drifting** (past 2× rhythm and ≥ 14 days), time with anyone by day, and the headcount plate. |
| `average-day.ts` / `AverageDayBoard.tsx` | Pure 15-minute slot averages → All days + Mon–Sun ribbons. Stable pen order from ranked rows; empty occupancy is white well. Sits **under** the period filmstrip in Composition. |
| `period-filmstrip.ts` / `PeriodFilmstrip.tsx` | Chronological pen bar for the whole window (Home Tracking ribbon language), **above** average-day ribbons. One owner per minute (same as the time grid); painted minutes plus gaps equal days × 1440. Gaps respect Show untracked; click block → EntryDialog, click gap → Log activity. A search jump adds `is-hit` and scrolls that block into the strip. The daily sparkline uses `uniqueMinutesByDate`. |
| `grain-strips.ts` / `GrainStrips.tsx` | One equal cell per day, and per week when the window spans two Mondays. Color is the pen at the current display depth that owned the most minutes (`minuteMap`, so overlap votes once). Empty days stay white. A tie keeps the earlier pen in the palette. |
| `tag-trends.ts` / `TagTrendBoard.tsx` | Monthly tag bars beside the weekly series from `tagWeekTrend`. Same union as `tagTotals`: a minute tagged in two scopes counts once. Zero buckets stay in the row. |
| `block-search.ts` / `BlockSearch.tsx` | Find blocks on this surface. Matcher is `searchTracking` in `lib/tracking-search.ts` (display name, notes, project, primary pen, secondary pens, counts-as chains, action formats, and a mood reading’s word, body, vibe, shorthand, reframe, and about-that). A row jumps: switch scope, highlight the filmstrip segment, open `entry-dialog`. A date outside the shared window opens the block and says so — the window does not move. **Show matches in this view** reruns the Tracking measures on that set (`SEARCH_FILTER_LIMIT`). Other paint is omitted, not called untracked, and Show untracked is paused until Clear. |
| `period-delta.ts` / `PeriodDeltaTable.tsx` | Pen minutes vs previous equal window from `previousAnalyticsWindow` (same stepper as the range bar). Ink ± deltas; "new" / "same". Renders as a tight four-column table in a scrollable white plot well (max ~320px). |
| `analytics-atlas.css` | The atlas skin over `analytics-chrome.css`: same selectors, loaded after it (here and in `app/layout.tsx`). Re-points the `--an-*` tokens so boards and Tracking cuts follow, and adds `--at-*` (paper, ink, cobalt, steel, bearing, pearl, key rim). Keys that the house button lip in `app/win95.css` would repaint carry `:not(#at)` for id weight. The field-ring band (`public/analytics-atlas/field-lines.svg`) and the degree ruler are no longer drawn (2026-10-23); the SVG file stays on disk. |
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
| `PlanVsReality.tsx` | Window ribbon (sortable, with median / best / worst) + plan bar with a thin actual bar inside; mirror split; truth barcode of planned items; calendar events as planned minutes; capacity vs waking window (`~` when inferred). Doc: `docs/analytics/accuracy-plan.md`. |
| `CalibrationView.tsx` | Sentence + n + caveat; scatter with y = x and ±band lines; estimate barcode with band slider; P50/P80/P90 forecaster from your ratios; bias by task size; type/list breakdown when n clears the floor; folded PERT bands with hit count. Doc: `docs/analytics/accuracy-calibration.md`. |
| `CycleView.tsx` | `daysPushed` distribution, done share by push count, most-pushed peaks, open important items, estimate confirmation, empirical survival of open stock, age beeswarm, open-stock unit grid with an importance slider. Doc: `docs/analytics/accuracy-cycle.md`. |
| `RegretView.tsx` | Accrued cost of important items sitting undone. Regret clock with look-ahead slider, squares by list with an anchor, searchable sortable overdue table. Doc: `docs/analytics/accuracy-regret.md`. |
| `GoalsAnalytics.tsx` | Objective contribution, neglected goals, progress, pace vs a straight line (filter, sort), work bubbles per goal, and which linked goals held the harder or more enjoyable work. Doc: `docs/analytics/accuracy-goals.md`. |
| `Observatory.tsx` | Classical findings + linked Cross-section (`data-ui-name="Observatory"`, `#studio-views`). Thin overlap watermarked. |
| `CrossSection.tsx` | Linked density (habits, tracking, sleep, completions, points, operations, regret, mood, joy, switches, places, goals, Screen Time occupancy). `data-ui-name="Cross-section"`, `#studio-views`. |
| `cross-section.ts` | Pure series builders: missing stays missing. |
| `MetricsTrends.tsx` | Small-multiples of all five wellbeing metrics + phosphor detail chart + **Log {name}**. |
| `CorrelationExplorer.tsx` | Pairwise Pearson matrix (metrics + habit % / tracking / sleep / points). Click a cell → scatter. |
| `SpectrumView.tsx` | Habit-% autocorr + periodogram, sleep CV and lag-1. |
| `ItemTypesLibrary.tsx` | Types / Relations tabs. Type mosaic, sort, drill, Open in Lists. |
| `InstagramView.tsx` / `instagram-view.css` | Sources → **Instagram**. Hosts the generated `report.html` in a frame. See **Instagram (Sources)** below. `data-testid="instagram-view"`. |
| `relations/RelationsLibrary.tsx` | _Last mapped: 2026-10-16._ Relations tab ([`LINKS_REDESIGN.md`](../../docs/LINKS_REDESIGN.md) L2.1): by family or tree, scope, usage, origin. A row opens `RelationSheet.tsx` (L2.2: parent, reciprocity, traits, phrases, description, usage; built-ins write `relationOverrides`; merge as alias with undo, L2.3). Views: `RelationSchematic.tsx` (L2.4), `RuleEditor.tsx` (L3.5, dry run), `GraphInbox.tsx` (L8.1–8.2: snapshot export, proposal import, accept through `commitItemDraft`). |
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

### Texts

_Last mapped: 2026-10-22_

Group **Texts**, view **Report** (`TextsReportView.tsx`). It frames the texts report drawn by `scripts/texts-analysis/` and served on loopback by `electron/texts-report.js`. The report keeps its own look on purpose: the studio skin does not apply inside the frame (allie, 2026-10-22). The view adds only a title, the last update, and **Update now**. It does not use the shared window. It refreshes weekly after Sunday 21:00. The web build shows a sentence instead. Renderer bridge: `lib/texts-report.ts`. _Last mapped: 2026-10-23:_ the view also posts People I Know into the frame and takes link, unlink and open-person requests from it (own frame and origin only, `readReportRequest`), so a relationship page can link its chat to a Person. _2026-10-23:_ it also creates a Person from a chat (`create-person`), keeps the frame's person cards for Person → View text analytics (`writeTextsIndex`), opens a card on request, and reloads when the frame starts an update. **Open in window** shows the view alone at `/popout/?view=texts` (`app/popout/page.tsx`; `electron/main.js` allows only that view name). _2026-10-23:_ in the main window the frame sends its sections (`sections`, `section`) and hides its own nav. `AnalyticsNav` lists them under **Sections** below Views (`lib/texts-report-nav.ts`, `.an-section-bar` in `analytics-atlas.css`); a click sends `goto`. The pop-out keeps the report's nav. Week and month comparisons, notes, and on-demand AI reads are **Planned** in [`docs/TEXTS_ANALYTICS_PLAN.md`](../../docs/TEXTS_ANALYTICS_PLAN.md).

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

## Instagram (Sources)

_Last mapped: 2026-10-23_

Sources → **Instagram** shows the person's Instagram report: the page that
`build_report.py` writes from an Instagram data export. Brain2 does not redraw
it. The report keeps its own CSS, script, sticky nav, dialogs and dark mode
(it follows the system setting, as it does standalone). Brain2 adds only its
title bar, status bar, a line with the export date and last update, and the
last error. Do not reskin the report with the atlas CSS (`docs/DESIGN_STYLE.md`).

**Where it is served from.** The view reads `lib/instagram-report.ts`:

- Desktop: `window.desktop.instagram` (IPC) and the `brain2-ig://report/` scheme (`electron/instagram-ipc.js`).
- Chrome at localhost: `/api/instagram/*` from the dev server (`scripts/instagram-api.mjs`). It shows the last build. It never runs Python.
- Web and iOS: one sentence that the desktop app builds the report.

**Pipeline** (`electron/instagram-report.js`, Electron main only):

1. Scan `~/Downloads`, an optional folder ("Watch a folder…") and, while `watchGoogleDrive` is on, each Google Drive `My Drive` (`googleDriveDirs` via `watchedDirs`) at start, on folder changes, and every minute. Match `instagram-<account>-<YYYY-MM-DD>-<id>` as a zip (several parts are grouped) or an unzipped folder with `your_instagram_activity/`. Skip `.crdownload`, `.download`, `.part`. A zip must hold still for 10 s. Other accounts are ignored.
2. Copy or unzip into `<userData>/instagram/exports/<date>-<id>/`. Downloads is never changed.
3. Write the view's manual DM matches to `matches.json`.
4. Run `analyze.py` then `build_report.py` with the configured Python and `-I`, into a new `builds/<stamp>/` (`IG_OUT`). Last run's thumbs are copied in first.
5. Only when both succeed, `state.json` points at the new build. The old build and its export stay until then, so thumbs and media never break. On failure the old report stays and `lastError` holds the step and stderr.
6. Keep the current and previous build and the newest `keepExports` exports (2).

`<userData>/instagram/config.json` holds the paths and names (defaults in
`defaultConfig()`): `scriptsDir` (`~/instagram-analysis`), `python`
(`~/texts-analysis/.venv/bin/python`), `me` (`IG_ME`, the DM sender name),
`handle` (`IG_HANDLE`, the subtitle and the account an export must match),
`downloadsDir`, `extraDir`, `matchesPath`, `ffmpeg` (`IG_FFMPEG`; otherwise
PATH, Homebrew, Anaconda), `keepExports`, `watchGoogleDrive` (default on). Missing Python, scripts, packages
(emoji, scikit-learn, vaderSentiment, Pillow) and ffmpeg show in the view.

**State the report keeps.** The report stores `ig-matches`, `ig-hide-cols` and
`ig-photos` in localStorage, which is per origin. Brain2 keeps a copy in
`ui-state.json`. A small script put in front of the report's own seeds those
keys and posts each change to the view (`injectBridge`). It draws nothing.
`ig-matches` starts from `matches.json` and is written back to it on every
change. Hidden columns and the photo choice from a standalone browser are
brought over once by a console snippet ("bring settings from the standalone
report").

**Network.** The report's CSP (`REPORT_CSP`) allows only the click-to-load
embeds (`https://www.instagram.com` frames) and the opt-in profile photos
(`https://unavatar.io` images). Links with `target=_blank` open in the system
browser (`setWindowOpenHandler`). Export data, builds and thumbs live in
userData, never in the repo.

**Limits of the export.** These are stated in `ANALYTICS_TAB_HELP.instagram`.
Do not fill them with made-up numbers:

- Who liked or commented on my posts and stories is not in the export. Per-person engagement comes from DMs only.
- Carousel posts have no insights.
- Follower counts of other accounts are not in it.
- Comments have no link to their post.
- Time active is an estimate. Before the recent view-log window it is a floor.

**Google Drive scheduled export.** _Last mapped: 2026-10-23_ Meta writes
each scheduled export into My Drive as `meta-<YYYY>-<Mon>-<DD>-<HH>-<mm>-<ss>`.
`parseMetaFolderName` reads the date from it. `scanMetaFolder` takes, inside
it, an unzipped export, `instagram-…` zips or folders, or plain zips as the
parts of one export. The name has no account, so the username is read from
`personal_information.json` after unzipping (`exportAccount`); another
account's export is skipped. A `meta-…` folder must hold still (file count,
size, newest mtime) for 10 s, since Drive may still be syncing it. The newest
export builds the report. Every other export not yet archived is unzipped,
archived and its copy removed (`archiveOnly`); a failed one is retried hourly,
or at once if it changes. The view says **Google Drive watched** when a Drive
folder is found. Not checked yet: the contents of a real Drive export (the
first one was still empty). See `docs/INSTAGRAM_AUTO_UPDATE.md` → "TO DO LATER".

### Export archive (every export, merged)

_Last mapped: 2026-10-23_

The report pipeline keeps only the newest exports (`keepExports`). The
archive keeps all of them (`electron/instagram-archive.js`). It runs after a
build is marked good and before `prune`, and once at watcher start for any
export folder not archived yet.

- `archive/blobs/<aa>/<sha256>` holds every file of every export once, by content. Hard links when on the same disk, so an unchanged file across daily exports costs nothing. Pruning an export folder does not touch the blobs.
- `archive/manifests/<exportDir>.json` maps each export's paths to blobs, so any old export can be rebuilt.
- `archive/messages.json` merges all DMs. A message is keyed by thread folder, time, sender and a content hash, and keeps the first and last export that held it.
- `removedMessages` lists DMs an earlier export had and a later one does not: **removed** (unsent or deleted), **edited** (same time and sender, other text), or **chat gone** (the whole thread is missing). The view shows them under "Unsent, deleted and edited messages" (`cogs:instagram:removed`, `/api/instagram/removed` in dev).
- Limit: a message sent and removed between two exports was never in any export. Daily exports keep that gap to a day.
- Meta's Latin-1 text is fixed on the way in (`fixText`).
- Half-copied `exports/*.partial` folders are never archived. A blob copy goes to a temp file and is renamed, so a failed copy leaves no short blob.

**Planned:** checks for when the first real Google Drive export lands are in `docs/INSTAGRAM_AUTO_UPDATE.md` → "TO DO LATER". The same "gone since" merge for followers and following (unfollows), comments and likes. Showing archived photos of removed messages (the blobs are kept; the view lists them as attachments for now).

### Monthly export reminder

_Last mapped: 2026-10-23_

Everything after the request is automatic; a device export's request is not.
Accounts Center can also repeat an export to Google Drive or Dropbox on a
schedule (Meta's deep-link guide, checked 2026-10-23). That route is not
tested yet; see `docs/INSTAGRAM_AUTO_UPDATE.md`. A monthly row,
**Request a new Instagram export**, sits on the Reminders list
(`lib/instagram-export-reminder.ts`). It uses the normal reminder clock in
`lib/reminders.ts`: Inbox copy, header bell until Dismiss, and a Telegram
text with the Accounts Center link when Text me is on. Its description holds
the link and the steps. The steps and link have one copy,
`lib/instagram-export-steps.ts`, shared with the view's `ExportSteps`.

- The status line shows **Reminder** with the next fire time and a switch. On means the row exists. Off deletes it.
- The view seeds it once per device, after the report status loads. The first fire is one month after the export date at 10:00, or the next 10:00 when that has passed. A deleted row stays deleted (`brain2-instagram-export-reminder-seeded` in localStorage).
- Each switch-on gets a new id (`reminder-instagram-export-<ms>`), because a deleted id is tombstoned for sync.
- Export settings are always JSON, All time, all information. A date-range export leaves whole sections empty.

Later routes (iPhone app, APIs, free tools) and what each can and cannot
reach are in [`docs/INSTAGRAM_AUTO_UPDATE.md`](../../docs/INSTAGRAM_AUTO_UPDATE.md).

## Instagram: open one account

_Last mapped: 2026-10-23_

`InstagramView.tsx` hosts the report frame. A Person's **View Instagram data ↗** stores the handle (`openInstagramFor`, `lib/instagram-report.ts`), switches to this tab, and on the frame's `load` the view posts `{ brain2Instagram: "open-account", handle }` into it. The bridge script that `injectBridge` (`electron/instagram-report.js`) puts in the report calls the report's own `openAcct(handle)`. An account not in the export opens an empty card.

_Last mapped: 2026-10-23_ **Account card ↔ Person.** The report's per-account card (`openAcct`: follow state, DM threads sent vs got, likes, saves, comments, rankings, timeline) is the Instagram relationship card. The bridge adds an **Attach to Person** bar to its header (`ACCOUNT_BAR` in `electron/instagram-report.js`): pick a Person, **New person**, or when linked, **Open** and **Unlink**. The frame posts `{ brain2Instagram: "account", action }`; `InstagramView` answers with `person-state` and writes `personProfile.instagram` through `lib/instagram-person-links.ts` (one account, one person). **Open** and the texts report's open-person now open the Person as a popup over Analytics (`openItemDetailPopup`, `lib/points-ledger-nav.ts`; the shell listens in `app/page.tsx`). The Points ledger still opens the item page. The pop-out has no shell, so the texts report there still alerts.

## Browser history (`browser`)

_Last mapped: 2026-10-23_

**Kept rows only grow.** The view stores merged visits in IndexedDB key `visits` (union by time+url), so a later export that has lost the old 90 days never removes them. **Screen Time:** `lib/chrome-sessions.ts` paints each site stretch on the Screen Time scope (pen = site name, local servers by page title, sites under 3 visits in `Other sites`, notes start `logged from chrome browser data`, YouTube notes list minutes per video). It merges through `mergeSessionEntries`, so edits and deleted ids win. The backlog is ~3,500 blocks (~1.2 MB); watch the localStorage quota. It may overlap blocks from the ActivityWatch Screen Time sync.

`BrowserHistoryView.tsx` (Sources → Browser) takes Chrome "Quick Chrome History Export" JSON files, one per profile, through a file picker. Files are kept in IndexedDB (`brain2-browser-history`) because they are too big for localStorage. All analysis is `lib/browser-history.ts` (pure, tested in `lib/browser-history.test.ts`): merge and dedupe by time+url, site kinds, sessions (30 min gap), Google searches, YouTube videos.

- YouTube topic is a keyword guess from the title (`TOPICS` in the lib). The export has no channel or description. **Planned:** fetch channel and category by oEmbed if the user opts in.
- Active time is session span plus one minute per page. An estimate.
- Not in the Instagram/Texts shell: charts are small inline SVG, skin is `browser-history-view.css`.
