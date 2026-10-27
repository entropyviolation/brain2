# Time → Sleep

_Last mapped: 2026-10-23_

File: `components/Analytics/SleepAnalytics.tsx`. Math: `lib/sleep-log.ts`, `lib/sleep-inference.ts`, `lib/sleep-sun.ts`, `components/Analytics/sleep-rhythm.ts`. Styles: `components/Analytics/time-rhythms.css`. Tests: `SleepAnalytics.test.tsx`, `time-rhythms.test.ts`.

## Data in

- Nights from `useSleepStore` merged with Sleep paint on the Tracking grid (`resolveNights`). A stated time beats a painted one.
- Each night: `date` (the morning), `sleptMin` / `wokeMin` as offsets from that midnight (negative is the evening before), `minutes`, `estimated`, `source` (`logged` or read off the grid).
- Sleep target from the store (default 8h). All-nighter flags with time and source (desktop or text pipeline / BIM).
- Sunset and sunrise per day for the home city (`useSunTimesStore`), cached as they are computed.
- Stray sleep: naps and runs that do not form a night (`straySleep`). Kept out of per-night numbers.

## Plates, top to bottom

1. Kicker: nights tracked of the window, blank, read off the grid, % estimated, all-nighters.
2. All-nighters (only if any). Date list folds when there are more than 5.
3. How much sleep: average, usual bed and wake, under-target debt. **What if I need** slider (5h–10h) recounts nights that reach it and the debt. It does not change the saved target.
4. **Body clock**: social jetlag, chronotype (MSFsc), Sleep Regularity Index. Each shows "not yet" below its floor.
5. How far the ends swing: earliest and latest bed and wake.
6. Against the sun: medians, then each night in a fold (open at 7 or fewer).
7. **Sleep window**: every night of the window as a bar on the 6 PM → noon axis, oldest at the top, over that night's dark. **Late after** slider draws a line and turns later nights orange, with a live count.
8. Night by night: newest 14 rows, the rest in a fold.
9. What changed (later half vs earlier half), regularity CV and lag-1, ridgelines by weekday.

## Math

- Mid-sleep = (sleep + wake) / 2, in offset minutes.
- Social jetlag = mean mid-sleep on free nights minus work nights. Free nights are Friday and Saturday (Saturday and Sunday mornings). Floor: 2 of each. Wittmann et al. 2006.
- MSFsc = MSF − (SDf − SDweek) / 2 when free nights are longer, with SDweek = (5·SDw + 2·SDf) / 7. Bands: before 2:30 early, 2:30–4 slightly early, 4–5 intermediate, 5–6:30 slightly late, later is late. Roenneberg et al. 2004 (MCTQ).
- SRI = 200 · P(same state at the same minute on consecutive days) − 100, on 5-minute steps over 6 PM → noon only. Floor: 2 back-to-back pairs. Phillips et al. 2017. The full method uses 24 h; naps are out here. An all-nighter day has no night, so it breaks a pair instead of counting as awake. The readout says so.

## Research notes

- Social jetlag over about 2 h is linked in population studies with worse mood, more smoking and caffeine, and metabolic markers. Use it as context, not a verdict.
- SRI predicted health outcomes better than duration in UK Biobank actigraphy (Windred et al. 2024). That is why it sits next to the averages.
- IIB moves used: **Era bars** (sleep window), **Your-number input** (what-if need).

## Ideas not built yet

- Unit grid of all-nighters by source.
- Debt as a running line across the window, with recovery nights marked.
- Sleep window rows sorted by bedtime instead of date (a toggle).
