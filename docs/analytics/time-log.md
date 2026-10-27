# Time → Log

_Last mapped: 2026-10-23_

File: `components/Analytics/LogEventsView.tsx`. Math: `log-event-stats.ts` (by day, by kind, clock scatter, phase strip) and `time-flow-stats.ts` (`kindRhythms`, `circularClock`). Classification: `components/Home/Tracking/tracking-log-model.ts` (`classifyLogInstant`). Styles: `time-flow.css`.

## Inventory

- Reads time-tracking entries and scopes, and cycle marks (`useLogCycleMarks`).
- Each log instant has a `kindKey` (for example `intake.food`, `left-room`) and a clock certainty: exact, estimated (`~`) or unknown.
- Unknown clocks are counted, never plotted at the stored minute.

## Plates

1. **Kind filter.** Typed filter now matches part of the kind (`food` finds `intake.food`). It used to need the exact string.
2. **Kind chips.** The top 10 kinds with counts. Click to filter, click again to clear.
3. **Readouts.** Events, exact, estimated, unknown clocks.
4. **Bars by day.**
5. **Every event, one square.** Unit grid by kind, oldest first. Solid = exact, hatched = estimated, hollow = unknown. This replaces the plain kind list.
6. **Rhythm by kind.** Table: n, typical time, regularity, median gap ("every").
7. **Clock scatter.** In the house data color. Days now run oldest to newest with short labels. They ran newest first with full dates that overlapped.
8. **Phase.** Now folded, with the day count in the summary. Same caveat text.

## Math

- Typical time = circular mean of known clock minutes. 23:50 and 0:10 average to midnight, not noon.
- Regularity = mean resultant length r (0–1). 1 = always the same time. Shown only with two or more known clocks.
- Gap = median time between one event of a kind and the next, over known clocks only.

## Research notes

From known work. No new search was run in this pass.

- **Circular statistics** (Fisher, *Statistical Analysis of Circular Data*, 1993). The mean resultant length is the standard spread measure for times of day.
- IIB moves used: **Unit grid** and **Bubble timeline + filter**. See `viz-inspiration.md` → Log.

## Planned

- Rose diagram per kind (24-hour polar histogram).
- Cross with Cycle phase: events per phase, once enough cycles are marked.
