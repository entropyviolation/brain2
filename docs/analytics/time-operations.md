# Time → Operations

_Last mapped: 2026-10-23_

File: `components/Analytics/OperationsAnalytics.tsx`. Math: `lib/operations.ts` (`buildHeatmap`, `neglectedDays`), `operation-debrief.ts`, `time-flow-stats.ts` (`operationNeglect`, `debriefPoints`). Styles: `time-flow.css`.

## Inventory

- Reads operation items (`operationTasks`) and their `timeLogs`, stage and categories, plus `operationReviews` (after-action reports: summary, worked, failed, lessons, 1–10 ratings, stored hours).

## Plates

1. **Readouts.** Operations, reviews, rated.
2. **Stage mosaic.**
3. **Category mosaic.** Each category now has its own color. They were all one teal.
4. **Work by day.** Heat cells, plus a line: days in the window with no logged work.
5. **Longest untouched.** New. Each operation ranked by days since its last time log. Never logged sits on top. Bar color = stage. Right column = minutes logged in the window. Stage chips and a search box filter it. Scrolls inside 320px.
6. **After-action debrief.** Readouts as before, then:
   - **Morale × execution.** New quadrant. One bubble per report with both scores. Bubble area = stored hours. Corners: Smooth run, Grind, Fun mess, Rough. The cross sits at 5.5.
   - **Written debriefs.** Now a fold. Open by default when there are two or fewer.

## Fixes

- The heat map's start and end dates were rebuilt on every render, so its memo never held. It now keys on the first and last day.
- The title now uses `CanvasTitle` with help.

## Research notes

No new search was run in this pass. IIB moves used: **Evidence bubbles** / **Quadrant scatter** (Best in Show) for the debrief, **Anchored bars** for neglect. See `viz-inspiration.md` → Operations.

## Planned

- Bubble timeline: x = date, size = hours, color = stage. Click opens the debrief.
