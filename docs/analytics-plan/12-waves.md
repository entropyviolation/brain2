# 12 — Waves

Implementation schedule. This pass writes briefs only. The group redesign has not started. One seed view now exists outside that redesign: `research-report` (Meta, “Produce research report”).

Each wave’s agents run in parallel. Their files do not overlap. An agent does not edit a file owned by another agent in the same wave. Tests and screenshot sidecars land in the same wave as the view they cover.

Only the shell agent edits `components/Analytics/analytics-tabs.ts` and `components/Analytics/analytics-views.tsx`. Other agents create the view files their brief names. The shell agent registers the new ids from those briefs.

`MoodFieldView.tsx` is one file. The Presence agent owns it. The Tracking agent does not edit it. The shell agent moves the `mood-field` id.

## Standing laws

Paste this checklist into every wave-lead prompt. Source: `docs/analytics-plan/00-charter.md`.

- [ ] Keep view ids. A moved view keeps its id. New ids are additions.
- [ ] Keep math. Chart formulas, occupancy, grades, and floors stay as they are.
- [ ] Union occupancy. A minute in two scopes counts once.
- [ ] Raw, curved, and blend stay apart.
- [ ] Stamps only. Do not invent times.
- [ ] Missing is an empty frame.
- [ ] No restyle outside Analytics.
- [ ] Language readings are labeled guesses.

## Screenshot rule

If a view’s pixels or copy change, update the `docs/screenshots` sidecar in that wave (`npm run capture-screenshots` while the app is running).

If a view only moves to a new group, update the capture script’s group-then-view click in the same wave (`scripts/capture-screenshots.mjs` clicks the group tab, then the view tab). The old id must still resolve.

## Wave A

Parallel. No agent waits on another agent in this wave.

### Shell

Brief: `docs/analytics-plan/02-shell.md`.

Owns:

- `components/Analytics/analytics-tabs.ts`
- `components/Analytics/analytics-views.tsx`
- `components/Analytics/AnalyticsNav.tsx`
- `components/Analytics/enhanced-analytics.tsx` — default tab and help wiring only
- `components/Analytics/analytics-tabs.test.ts`
- `components/Analytics/studio-views.test.tsx` — id and chunk wiring only
- `components/Analytics/enhanced-analytics.test.tsx` — default tab and help only

Moves ids. Adds new ids. Does not change chart math.

### Tracking plates

Brief: `docs/analytics-plan/03-tracking.md`.

Owns:

- `components/Analytics/TrackingAnalytics.tsx`
- `components/Analytics/SleepAnalytics.tsx` and `SleepAnalytics.test.tsx`
- `components/Analytics/CircadianView.tsx`
- `components/Analytics/PlacesView.tsx`
- `components/Analytics/DiversityView.tsx`
- `components/Analytics/TransitionsView.tsx`
- `components/Analytics/ContextSwitchHeatmap.tsx`
- `components/Analytics/LogEventsView.tsx`, `log-event-stats.ts`, `log-event-stats.test.ts`
- `components/Analytics/CyclePhaseView.tsx`, `CyclePhaseView.test.tsx`, `cycle-phase-stats.ts`, `cycle-phase-stats.test.ts`, `cycle-phase-concealed.tsx`, `cycle-phase-concealed.test.tsx`
- `components/Analytics/ScreenTimeView.tsx` and `ScreenTimeView.test.tsx`
- Tracking siblings already composed by Tracking: `average-day.ts`, `AverageDayBoard.tsx`, `average-day.test.ts`, `period-filmstrip.ts`, `PeriodFilmstrip.tsx`, `period-filmstrip.test.ts`, `grain-strips.ts`, `GrainStrips.tsx`, `grain-strips.test.ts`, `tag-trends.ts`, `TagTrendBoard.tsx`, `tag-trends.test.ts`, `block-search.ts`, `BlockSearch.tsx`, `block-search.test.ts`, `period-delta.ts`, `PeriodDeltaTable.tsx`, `period-delta.test.ts`
- New tracking plate files named in `03-tracking.md`, and their tests

Does not own Habits or Plan. Does not edit `MoodFieldView.tsx`. Does not rewrite day-landing composition; the day agent imports helpers.

### Habits plates

Brief: `docs/analytics-plan/04-habits.md`.

Owns:

- `components/Analytics/HabitsView.tsx`
- `components/Analytics/StreaksWidget.tsx`
- `components/Analytics/PointsView.tsx`
- New habit plate files named in `04-habits.md`, and their tests

### Plan plates

Brief: `docs/analytics-plan/05-plan.md`.

Owns:

- `components/Analytics/PlanVsReality.tsx`
- `components/Analytics/CalibrationView.tsx` and `CalibrationView.test.tsx`
- `components/Analytics/OvercommitmentView.tsx` and `OvercommitmentView.test.tsx`
- New plan plate files named in `05-plan.md`, and their tests
- `components/Analytics/CycleView.tsx` only when a caption is required

### Presence

Brief: `docs/analytics-plan/06-presence.md`.

Owns:

- `components/Analytics/MetricsTrends.tsx`
- `components/Analytics/MoodFieldView.tsx`
- New presence plate files named in `06-presence.md`, and their tests

### Phone

Brief: `docs/analytics-plan/07-phone.md`.

Owns:

- `components/Analytics/TextPipelineView.tsx` (`text-events` and `text-spans`)
- New phone plate files named in `07-phone.md`, and their tests

### Language

Brief: `docs/analytics-plan/10-language.md`.

Owns new language view files only, and their tests. Does not edit `ReviewsView.tsx` or `RegretView.tsx`.

### Day landing

Brief: `docs/analytics-plan/09-day-shape-clock.md`.

Owns new day, shape, and clock files only, and their tests. Imports helpers. Does not rewrite `TrackingAnalytics.tsx` composition or `HabitsView.tsx` grade math.

### Viz kit

Brief: `docs/analytics-plan/11-viz.md`. Run only if a wave needs it.

Owns a new word-cloud component and a new join-caption component, and their tests. Does not edit existing chart math (`studio-kit.tsx`, `studio-plots.tsx`, `studio-plot-stats.ts`, `hour-day.ts`).

## Wave B

Starts after Wave A’s day card exists.

### Cross

Brief: `docs/analytics-plan/08-cross.md`.

Owns:

- `components/Analytics/CrossSection.tsx`
- `components/Analytics/cross-section.ts` and `cross-section.test.ts`
- `components/Analytics/Observatory.tsx`, `observatory-findings.ts`, `observatory.test.ts`
- `components/Analytics/CorrelationExplorer.tsx`
- New join cards named in `08-cross.md`, and their tests

May import helpers from the day card and the viz kit. Must not rewrite plan, habits, or tracking view files.

## Wave C

Starts after the joins exist.

### Forecast and quality

Uses `docs/analytics-plan/00-charter.md` and the forecast and quality parts of `docs/analytics-plan/08-cross.md`.

Owns new forecast views and new quality views, and their tests. Where history is missing, the frame is empty. Does not invent a joint ML model. Does not edit Wave A or Wave B view files.

## Preserve

Brief: `docs/analytics-plan/01-preserve.md`.

Runs after Wave A, after Wave B, and after Wave C. It does not redesign.

Runs the Analytics tests that already sit beside the views:

- `analytics-tabs.test.ts`
- `analytics-range.test.ts`
- `hour-day.test.ts`
- `open-in-lists.test.ts`
- `studio-plot-stats.test.ts`
- `studio-views.test.tsx`
- `enhanced-analytics.test.tsx`
- `signal-stats.test.ts`
- `average-day.test.ts`
- `period-filmstrip.test.ts`
- `grain-strips.test.ts`
- `tag-trends.test.ts`
- `block-search.test.ts`
- `period-delta.test.ts`
- `SleepAnalytics.test.tsx`
- `ScreenTimeView.test.tsx`
- `log-event-stats.test.ts`
- `CyclePhaseView.test.tsx`
- `cycle-phase-stats.test.ts`
- `cycle-phase-concealed.test.tsx`
- `OvercommitmentView.test.tsx`
- `CalibrationView.test.tsx`
- `cross-section.test.ts`
- `observatory.test.ts`
- `operation-debrief.test.tsx`
- `ItemTypesLibrary.test.tsx`

The README names `log-event-stats.test.ts`, `cycle-phase-stats.test.ts`, and `operation-debrief.test.tsx` in the file table. The rest are the existing `components/Analytics` tests. Preserve runs that set. It does not take files another wave agent still owns.
