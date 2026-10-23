# Meta → Spectrum

_Last mapped: 2026-10-23_

`components/Analytics/SpectrumView.tsx`. Math in `lib/metrics.ts` (`autocorrelation`, `periodogram`, `coefficientOfVariation`) and `meta-math.ts` (`acf`, `whiteNoiseBand`, `spreadMinutes`). Plots `Correlogram` and `LogPeriodogram` in `meta-plots.tsx`.

## Information
Habit % per day, sleep minutes and bedtime per night (`sleepStats`), tracked minutes per day (new, painted days only). Floor `SAMPLE_FLOORS.spectrum = 14`.

## Layout
1. Readouts: habit r(1), r(7), peak period, sleep r(1).
2. **Rhythm finder** (new): pick habit %, sleep or tracked minutes. Lags slider 7–60 (capped at n/2).
   - Correlogram: r(k) bars, shaded ±1.96/√n band. Bars past the band are filled teal and listed under the plot. Multiples of 7 are named on the axis.
   - Periodogram on a log period axis from 2 days up, with ½ wk, week, 2 wk, month, quarter, year named, and the peak labelled.
3. Habit % trace and periodogram (unchanged).
4. Sleep CV readouts plus **Bedtime spread** (new, σ in minutes).

## Research notes
- The ±1.96/√n band is Bartlett's large-sample bound for white noise (Box, Jenkins & Reinsel, *Time Series Analysis*). Neighboring lags are correlated, so one real 7-day beat also lifts 14 and 21. Caveat is on the plot.
- Bedtime CV divides by the mean offset from midnight. When the mean bedtime is near 00:00 the CV explodes. σ in minutes reads the same spread without that trap.
- Log period axis is IIB's **Log timeline** move.
- Gaps are dropped before the transform, so the series closes up. **Planned**: a Lomb–Scargle periodogram, which handles uneven gaps properly.
