# Library → Stages

_Last mapped: 2026-10-23_

View id `stages`, `StagesView` in `components/Analytics/LibraryCuts.tsx`. Math: `library-stats.ts` (`stageSteps`, `STAGE_ORDER`).

## Data
`task.stage`: inbox, clarified, scheduled, completed, or list. Missing counts as list. Age uses `createdAt` and `completedDate`.

## What is on the page
- Treemap by count (unchanged).
- Readouts: now in lifecycle order (was by count), each with share and **median age**: days since created for open stages, created → completed for completed.
- **Step heights** (new, IIB Step heights): inbox → clarified → scheduled → completed as steps, height ∝ count. Between steps: the change and the next step as a share of the one before. Click a step to open its items. On a list is left off.

## Caveat
A snapshot of where items sit now, not a flow. Step ratios are not conversion rates.

## Ideas not built yet
- A true flow (alluvial) once stage changes are stamped with dates.
