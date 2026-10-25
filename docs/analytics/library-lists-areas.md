# Library → Lists & areas

_Last mapped: 2026-10-25_

View id `lists-areas`. File: `components/Analytics/ListsAreasView.tsx`. Math: `library-stats.ts` (`areaRollup`, `summarize`), `signal-stats.ts` (`listHerfindahl`, `allocationGini`).

## Data
- `task-store`: lists (`name`, `color`, `parentListId`), tasks (`lists`, `completed`, `daysPushed`, `completedDate`, `createdAt`).
- Range store: only **In window** uses the range (completed in window, or created in window if open). Everything else is all-time.
- An **area** is a top-level list. Sublists roll up through `parentListId` (cycle-safe).

## What is on the page
- Modes: **Size by items** (treemap), **Completion rate** (bars, now labeled with n, plus **Size × rate**), **Areas** (new).
- **Size × rate** (new, IIB Quadrant scatter, under Completion rate): x = items on a log scale, y = completion %, dot area ∝ stalled items, dashed median lines split four named corners. Click a dot to open the list.
- Size mode readouts: HHI, Gini (new), median list size (new), stalled items (new: open with `daysPushed > 0`, an item on two lists counts twice).
- **Areas** (new, IIB Sized squares): one square per area, side ∝ √(unique items), inner bands split by each list's own count. Click a band to open the list.
- **List ledger** (new, all modes): search, sortable columns List (with parent), Items, Done, Rate (with meter), Stalled, In window. Click a row to open the list.

## Fixes in this pass
- `touched` was computed and never shown. It is the ledger's In window column.
- Rate bars dropped list size and silently cut at 24. Names now carry n and a note points to the ledger.
- Treemap labels hid under 88px. Library treemaps now keep cells at 112px minimum (`library-views.css`).

## Ideas not built yet
- Rate over time per list (needs a per-window rollup).
