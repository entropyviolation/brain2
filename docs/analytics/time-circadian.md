# Time → Circadian

_Last mapped: 2026-10-23_

File: `components/Analytics/CircadianView.tsx`. Math: `components/Analytics/hour-day.ts`, `components/Analytics/circadian-rhythm.ts`. Styles: `time-rhythms.css`. Tests: `hour-day.test.ts`, `time-rhythms.test.ts`.

## Data in

- Any Tracking scope (picker; Activity by default, Mood gets a pink hue). Minutes per clock hour per day, overlapping blocks counted once (`buildHourDayGrid`).
- Instants (no duration) stay off the heat and are listed in a fold with time and pen.

## Plates

1. Controls: scope picker, **All days / Weekdays / Weekend** chips. The filter feeds every plate.
2. Hour × day heatmap.
3. **Rhythm**: a one-line read, then IS, IV, M10 / L5 with start hours, RA. "Needs 3 painted days" below the floor.
4. **24-hour wheel**: midnight at top, clockwise. Rings are weekdays, Monday inside. Darker is more of that hour painted on an average day of that weekday.
5. Weekday cycle plot (Cleveland).
6. Instants fold (first 200, newest first).

## Math (Van Someren et al. 1999)

Only days with paint enter. x is minutes per hour, n = 24 × days, x̄ its mean, x̄ₕ the mean for clock hour h.

- IS = n · Σₕ (x̄ₕ − x̄)² / (24 · Σᵢ (xᵢ − x̄)²). 0–1. Higher is more alike day to day.
- IV = n · Σᵢ (xᵢ − xᵢ₋₁)² / ((n − 1) · Σᵢ (xᵢ − x̄)²). Near 0 is smooth, near 2 is noise. Day joins are included.
- M10 / L5 = highest 10-hour and lowest 5-hour mean in the average day, wrapping midnight. First window wins a tie.
- RA = (M10 − L5) / (M10 + L5).

## Research notes

- These are standard actigraphy measures. Here they run on painted minutes, so they describe the log, not the body.
- IIB moves used: **Culture wheel** as a 24-hour clock.

## Ideas not built yet

- Digit grid: hour × day-of-year for long windows.
- Toggle the wheel to a single chosen pen.
