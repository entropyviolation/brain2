# Library → Weight

_Last mapped: 2026-10-25_

View id `weight`, `WeightView` in `components/Analytics/LibraryCuts.tsx`. Math: `library-stats.ts` (`crossTab`, `spearman`, `summarize`).

## Data
`importance` (1–5), `cognitiveLoad` (1–3), `entropy` (0–1) on items. Missing stays missing.

## What is on the page
- Three distributions. Bars now in scale order (were in first-seen order).
- Readouts (new): mean importance, mean load, median entropy (with IQR in the tip), and Spearman ρ of importance × load with n.
- **Importance × load** (new, IIB Quadrant scatter): 5 × 3 grid, bubble area ∝ items. Corners tinted and named: Quick wins (4–5, light), Big lifts (4–5, heavy), Heavy chores (1–2, heavy), Filler (1–2, light), with counts and the mean days pushed of each corner's items. **Open only** toggle. Click a bubble to open its items.

## Fixes in this pass
- Open in Lists listed an item up to three times. Ids are now unique.

## Ideas not built yet
- Entropy as bubble color in the grid.
