# Time → Diversity

_Last mapped: 2026-10-23_

File: `components/Analytics/DiversityView.tsx`. Math: `signal-stats.ts` (`penMinutesByDay`, `allocationGini`, `weekdayWeekendCut`), `time-views-stats.ts` (`coverCount`, `effectiveCount`, `entropyByDayType`).

## Data
- One tracking scope at a time (Scope picker). Per day: Shannon entropy H = −Σ p log₂ p of pen-minute shares. Window: pen totals, Gini, weekday vs weekend minutes.
- Thin windows keep the honest frame (`SAMPLE_FLOORS.entropyDays`).

## Plates
1. **Readouts**: mean entropy; **Like this many pens** = 2^H (Hill number of order 1, the count of equal pens with that entropy); Gini; weekday and weekend minutes per day, now with the mean entropy of each.
2. **Entropy · bits / day** trace.
3. **Where your days sit** (IIB *Anchored bars*): your mean and most mixed day among fixed anchors: 0 b (one pen), 1 b (two equal pens), log₂ k (every pen in the window even).
4. **How many pens make up your time** (IIB *Your-number input*): a 50–99% slider; the answer is the fewest pens that reach that share, and those bars light up. Top 16 pens shown.

## Fixed (2026-10-23)
- Plate children were mis-indented. Pen totals are computed once and shared by Gini and the cover plate.

## Ideas not built
- Entropy by hour of day. Rolling 7-day entropy. Compare two scopes side by side.
