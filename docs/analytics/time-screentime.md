# Time → Screen Time

_Last mapped: 2026-10-23_

File: `components/Analytics/ScreenTimeView.tsx`. Math: `lib/tracking-summary.ts`, `components/Analytics/hour-day.ts`, `components/Analytics/screen-time-stats.ts`. Styles: `time-rhythms.css`. Tests: `ScreenTimeView.test.tsx`, `time-rhythms.test.ts`.

## Data in

- The Screen Time scope (id `screentime` or the name "Screen Time"), painted by ActivityWatch sync. Pens are apps; depth-0 pens are categories. AFK is unpainted.
- The Activity scope, for the overlap.
- Last successful sync from `loadScreenTimePrefs()` (read once per mount).
- iPhone Screen Time is a separate scope and is not shown here (Cycle phase shows it).

## Plates

1. Readouts: active, untracked, last sync (short date), **per painted day**, **peak hour**.
2. **Day by day**: screen minutes per day. A grey tick is a day with no paint, not zero. Dashed line is the mean over painted days.
3. **When the screen is on**: mean minutes of each clock hour over painted days. Peak hour in orange.
4. Alignment vs Activity. Fixed: the old bar laid two widths side by side and could run past 100%. It is now one bar of three parts of the union: Screen Time only, both, Activity only, with a legend.
5. **Apps against familiar things**: every app ranked, with hatched anchor rows (a film, a workday, London → Tokyo, War and Peace, a work week, Game of Thrones). Anchors only appear up to 1.25× the top app. Controls: search, By time / A–Z, Per day, Anchors.
6. Top apps and top categories mosaics (unchanged).

## Math

- Overlap = Screen + Activity − union of unique minutes. Shares are of the union.
- Per painted day = screen unique minutes / days with any paint.
- Hour profile = for each hour, mean painted minutes across painted days (0–60).

## Research notes

- IIB moves used: **Anchored bars** (Million Lines of Code), **Rate clock** idea in the hour profile.
- ActivityWatch only records while watchers run, so a blank day is "not watched", not "no screen".

## Ideas not built yet

- Sized squares: category → app, nested.
- Screen minutes laid over the Sleep window (screens in the hour before bed).
