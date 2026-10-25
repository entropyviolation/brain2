# Time → Text events and Text spans

_Last mapped: 2026-10-23_

File: `components/Analytics/TextPipelineView.tsx` (`TextEventsView`, `TextSpansView`). Math: `time-flow-stats.ts` (`spanStats`). Styles: `time-flow.css`.

These are **not** the Texts report (`texts-report`, out of scope). They read Tracking entries that the phone text pipeline stamped with `generatedBy.kind === "text"`. Logged-span stamps are left out (`isLoggedSpanStamp`).

## Text events

- Instants: `log:`, discrete triggers, `switch …` markers.
- **Readouts.** Events, discrete, switches, per day (with the busiest day).
- **Bars by day.** Fill moved off the old bright blue to the house data green. Ticks thin out with `minTickGap`.
- **Every event, one square.** Unit grid. One square per instant, grouped by pen, switches on their own row, oldest first. Square color = pen color. Hover for title and time.
- **Filter.** Search by title, pen name or date. It narrows the grid and the list.
- **Event list.** Folded, scrolls inside a 320px box. It used to run the full page.

## Text spans

- Intervals: currently / stopped / switched.
- **Readouts.** Spans, duration, switch instants, median span (and the longest).
- **Bars by day.** Minutes on the left axis, switches on their own right axis. On one shared axis the switch bars were too small to see.
- **Spans on the clock.** Era bars. One row per day, midnight to midnight, a bar from start to end in the pen's color. Gridlines every 6 hours.
- **Filter** and a folded **span list**, as for events.

## Research notes

No new search was run in this pass. IIB moves used: **Unit grid** (Plane Truth) for events and **Era bars** (Largest Empires) for spans. See `viz-inspiration.md` → Text events / Text spans.

## Planned

- Mark the gap between a "stopped" and the next "currently" as a hollow bar.
