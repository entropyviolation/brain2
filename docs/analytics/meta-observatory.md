# Meta → Observatory

_Last mapped: 2026-10-23_

`components/Analytics/Observatory.tsx`, math in `observatory-findings.ts` and `meta-math.ts`, plot in `meta-plots.tsx` (`ForestPlot`), skin in `analytics-meta.css`.

## Information
- Daily series built in the view: habit % (`calculateDayPercentageAV`), tracked minutes, sleep minutes (`resolveNights`), points, Activity context switches, mean joy reading per day (`dailyMeans`), Activity and Screen Time occupancy.
- Eight pairs (`PAIR_LABELS` ~262): habits↔tracked, switches↔sleep, points↔habits, joy↔habits, joy↔sleep, Activity↔Screen Time, habits↔sleep, switches↔habits.
- Each pair → Pearson r on inner-joined days. Floor `OBSERVATORY_FLOOR = 7`. Below it the pair is thin and only watermarked.
- The view mounts `CrossSection` on top (see `meta-cross-section.md`).

## Layout
1. Cross-section.
2. **Every link at a glance** (new): a forest plot. Dot = r on −1…+1, dot area = overlap days, whisker = 95% Fisher-z interval, shaded edges = |r| ≥ 0.3. Sort by |r|, days or name. "Show thin" adds hollow dots. Click a row for its sentence and interval. The hint counts how many links have an interval that clears 0.
3. One `FindingBlock` per ready pair, then thin frames.

## Research notes
- Forest plots are the meta-analysis standard for comparing many effect sizes with their uncertainty in one glance (Lewis & Clarke, BMJ 2001). They fit IIB's **Evidence bubbles** move: size = weight, position = strength.
- Fisher z: z = atanh(r), SE = 1/√(n−3). The interval needs n ≥ 4. With 8 pairs, one interval in 20 clears 0 by chance, so a single clear link is weak evidence. Say so in copy; do not add p-values.

## Planned
- **Axis picker** (IIB *Hollywood In$ider*): choose any two Cross-section series for x/y and a third for size. Reuse `buildCrossSection` output.
