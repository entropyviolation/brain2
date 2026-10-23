# Time → Tracking

_Last mapped: 2026-10-23_

The biggest Analytics view. Entry: `components/Analytics/TrackingAnalytics.tsx`. Index row: `docs/analytics/INDEX.md` → Time. Ideas: `docs/analytics/viz-inspiration.md` → Tracking.

Read the sub-section you need. Each one lists its data, files, what was fixed, and what was added.

## Data

Everything comes from `time-tracking-store` (scopes, pens, tags, entries) plus `task-store` for Open in Lists. Totals go through `lib/tracking-summary.ts`, so a minute painted twice counts once. The shared range (`useAnalyticsRange`) gives `dateKeys`. The previous window is `previousAnalyticsWindow`.

One board is computed per (entries, scope, depth, window, toggles) in `computeTrackingBoard` (~230) and cached in `trackingBoardCache`. New plates read board fields. They do not walk entries again, except Day edges (one pass over the scoped blocks).

## Sub-sections

### 1. Header

Scope select, % of tracked / % of day, Show untracked, Include assumed, **Find blocks** (`BlockSearch.tsx`, `block-search.ts`), depth (`DepthControl`), one hint line with `?`.

- Not changed. The long help paragraph above the header belongs to the shell (`enhanced-analytics.tsx`), which all views share, so it was left alone. **Planned:** fold it behind `?` in a shell pass.

### 2. How much

Readouts: Tracked, Coverage, Average / day, Longest block. Sparkline of daily tracked minutes.

- Fixed: the sparkline had its title twice (title + hint said the same). The hint now gives n days and the peak day.

### 3. Composition (`TrackingComposition`, ~360)

Donut + ranked rows (same slices), then filmstrip (`PeriodFilmstrip.tsx`), day/week strips (`GrainStrips.tsx`), average day (`AverageDayBoard.tsx`), fragmentation line, tags (`SliceRows`) and tag trends (`TagTrendBoard.tsx`).

- Fixed: this plate was one very long scroll. Filmstrip, Day and week strips, Average day and Tags are now **folds** (`TrackFold` in `TrackingInsights.tsx`). Each fold remembers open or closed per viewer in `localStorage` (`brain2.an.track.fold.<id>`). All start open. The fold names the band, so the band's own first title is hidden inside a fold (CSS in `tracking-insights.css`).
- Fixed: ranked rows show the top 12, tag rows the top 10, then **Show all N**. The donut still shows every slice.
- Fixed: the title kicker used an inline style. It is now `.an-track-kicker`.

### 4. Sized squares (added)

`SizedSquaresPlate`. IIB move: **Sized squares** (Billion Dollar-o-Gram). Each pen is a square whose area is its minutes. A dashed square is one 24h day for scale. Toggle **Per average day** (minutes ÷ days in window) or **Whole window**. Click a square to open the same pen drill. Small squares put the name under the square.

Math: `sizedSquares`, `squareSide` in `tracking-insights.ts`. Side = √(days) × anchor px. Anchor fits the biggest square in ~240px and stays 60–200px.

### 5. At this pace (added)

`PacePlate`. IIB moves: **Rate clock** + **Your-number input**. Pick a pen, set hours awake (number input) and a horizon (slider, 1–50 years). Readouts: per day (and share of waking day), per week, per year (and full days), over the horizon (and waking years). The hint shows the division.

Math: `paceOf`. Per day = window minutes ÷ days (blank days count). Per year = per day × 365.25. Waking years = horizon minutes ÷ (awake hours × 60 × 365.25).

### 6. By level and Who you were with

`TrackingContextPlates.tsx` (`LevelLadderPlate`, `CompanyHeadcountPlate`). Not changed here. **Planned:** a mirror split of alone vs with others by Activity pen.

### 7. Up / down and Before | now

`PeriodDeltaTable.tsx` (math in `period-delta.ts`).

- Fixed: the table had no column names. It now has Pen / Now / Change / %.
- Added: `MirrorSplitPlate`. IIB move: **Mirror split** (Left vs Right). Before bars grow left, now bars grow right, one shared scale, change in the middle. Controls: filter by pen name, sort (biggest change, most now, most before, name), Top N slider. Math: `mirrorRows`.

### 8. Hour × day, Day edges, Rhythm

`HourDayHeatmap` (`hour-day.ts`), weekday/weekend readouts (`weekdayWeekendCut`), `HourPenSmallMultiples`.

- Added: `DayEdgesReadouts`. Median first start, median last end and median span of lasting blocks per day with data, with the earliest and latest. **Leave out** drops one pen at the shown depth. It defaults to a pen named Sleep or Bed, because sleep crosses midnight and would pin the edges to 12 AM. The day's end reads as "midnight". Math: `dayEdges`.

### 9. Block length

`ViolinHistogram` + instants count + Open in Lists.

- Added: `BlockLengthCut`. A **Long block ≥ X** slider (5 min–4 h). Readouts: blocks and mean, median and 90th percentile, long blocks (count and share), time in long blocks (share of painted minutes). Math: `lengthStats` (linear-interpolated quantiles).

### 10. Drills (dialogs)

Pen drill (Split / Reach, child pens, block list), tag drill, untracked gap list.

- Added: the pen drill's block list has a text filter (title, note, date) and a sort (date and time, or longest first). Opening another pen clears the filter.
- Fixed: the untracked list could run to hundreds of rows. It now shows 60 at a time with **Show more**, a gap count and the longest gap, and the same sort.

## Research notes

Short, so later passes need not search again.

- **Anchors make sizes readable.** Comparing areas works better with a familiar reference beside them (McCandless, Billion Dollar-o-Gram). The one-day square plays that part here.
- **Rates feel more real than totals.** "Per hour" and "per year" re-expressions (IIB "Senseless") turn a window total into something felt. Time-use surveys such as the ATUS report "hours per day" for the same reason.
- **Fragmentation matters, not only totals.** Studies of interrupted work (Gloria Mark's lab, "Attention Span", 2023) report short attention stretches on screens and a cost to switching. Sophie Leroy (2009) calls the leftover pull of the last task "attention residue". The block-length cut and the fragmentation line show this without claiming a cause.
- **Small multiples** (Tufte) are already used for Hour × pen. Keep shapes on one scale.

## Planned

- Tag **Fear peaks**: weekly minutes per tag as labeled peaks, with tag-family filter chips.
- Fold the shell's long help paragraph (all views).
- Mirror split for company (alone vs with others).

## Files

| File | Role |
|---|---|
| `components/Analytics/TrackingAnalytics.tsx` | View, board cache, drills. |
| `components/Analytics/TrackingInsights.tsx` | `TrackFold` and the added plates. |
| `components/Analytics/tracking-insights.ts` | Pure math for the added plates. Tests: `tracking-insights.test.ts`. |
| `components/Analytics/tracking-insights.css` | Fold, squares, mirror, control row styles. |
| `components/Analytics/analytics-boards.css` | Header, composition, filmstrip, average day, Up / down (incl. column names). |
