# Time → Cycle phase

_Last mapped: 2026-10-23_

Files: `components/Analytics/CyclePhaseView.tsx`, `cycle-phase-concealed.tsx` (the gate; unchanged). Math: `cycle-phase-stats.ts`, `cycle-wheel.ts`, `lib/cycle-estimate.ts`. Styles: `time-rhythms.css`. Tests: `CyclePhaseView.test.tsx`, `cycle-phase-stats.test.ts`, `time-rhythms.test.ts`.

The view stays hidden behind **Show cycle** while cycle tracking is on and the latch is closed. Not a diagnosis.

## Data in

- Cycle marks (bleed, spotting, ovulation). Each day gets a shown phase, a marked phase and a basis (marked or estimated).
- Joined series by day: sleep, five wellbeing metrics, mood ranks, food / drink / drug / intake logs, Screen Time, iPhone Screen Time, Activity minutes, tasks done, habit %, points, regret.

## Plates

1. Days in each phase: readouts, mix table, marked and estimated bars, basis note.
2. **Cycle wheel**: one ring per cycle that starts in the window (last 8), oldest inside. Day 1 is the first marked bleed day, at the top. Estimated days hatched. Readouts: cycles started, median length, length range.
3. **Phase lens**: pick one series. One dot per marked day in its phase row, black tick at the phase mean.
4. **Filter series** search (shown when there are more than 3 series).
5. One plate per series: marked table, thin note, and the estimated table now in a fold.

## Math

- A cycle starts on a marked menstrual day whose previous day in the window is not menstrual. A window that opens mid-bleed starts with a partial run, which is not a cycle and is not on the wheel.
- A cycle is complete when the next onset is in the window. Lengths use complete cycles only.
- Means in the lens use marked days only, like the tables.

## Research notes

- Typical adult cycle length is 21–35 days, with day-to-day variation of a few days. Shown as data, not judged.
- IIB moves used: **Culture wheel** (cycle wheel).

## Ideas not built yet

- Align the lens by cycle day instead of phase.
- Show ovulation marks as a dot on the wheel ring.
