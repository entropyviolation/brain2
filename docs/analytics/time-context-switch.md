# Time → Context switch

_Last mapped: 2026-10-23_

File: `components/Analytics/ContextSwitchHeatmap.tsx`. Math: `lib/metrics.ts` (`contextSwitchSeries`, `trend`), `hour-day.ts` (`switchCountsByHour`), `time-flow-stats.ts` (`hourlyRate`, `wakingRate`, `weekdayMeans`). Styles: `time-flow.css`.

## Inventory

- Reads the time-tracking store (`scopes`, `entries`) and tasks (for Open in Lists, items with time logs in the window).
- A switch is a pen change on one day in one scope. Instants are skipped in the hour count.
- Thin floor: `SAMPLE_FLOORS.contextSwitchDays` (7 days with a switch).

## Plates

1. **n line.** Days with a switch, average, busiest, trend.
2. **Readouts.** Per waking hour, worst hour, busiest day, calm days (share of days with ≤ 1 switch).
3. **Calendar.** Switches per day. The legend now shows all five steps (0, 1, 2–3, 4–6, 7+). It used to show two.
4. **Rate clock.** A 24-hour dial with midnight at the top. Wedge length = mean switches in that hour per day with a switch. Darker wedges = waking hours. The brightest = the worst hour.
   - Wake and Sleep sliders set the waking window. They drive the per-waking-hour readout.
   - Beside it: by-weekday bars. Mean switches per calendar day. Quiet days count as 0.
5. **Hour of day.** The old bar list, now folded. It shows all 24 hours. Hours with no switches were hidden before, which hid gaps.

## Fixes

- The title now uses `CanvasTitle` with help, like the other views.

## Math

- Rate(h) = switches in hour h ÷ days with any switch.
- Per waking hour = Σ switches in waking hours ÷ active days ÷ waking hours. The window may wrap past midnight.

## Research notes

From known work. No new search was run in this pass.

- **Gloria Mark** (UC Irvine) on attention at work: people switch screens about every minute or so, and getting back to an interrupted task takes on the order of 20 minutes. A rate per waking hour makes your own number comparable.
- IIB move used: **Rate clock** ("Senseless", a total turned into per hour). See `viz-inspiration.md` → Context Switch.

## Planned

- Overlay the sleep window from Sleep Analytics instead of the sliders.
