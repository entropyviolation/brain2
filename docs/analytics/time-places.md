# Time → Places

_Last mapped: 2026-10-23_

File: `components/Analytics/PlacesView.tsx`. Helpers: `time-views-stats.ts`, `hour-day.ts` (`buildHourPenRows`). Styles: `analytics-boards.css` (imported by the view).

## Data
- Location scope blocks in the window (`entriesInRange`), totals at the chosen depth (`penTotalsAtDepth`, Depth control).
- Repeated GPS pins (`lib/ingest/gps-places.ts`, 80 m clusters). Naming one writes the Location pen (`adoptGpsPlaceName`).
- Not a map. There is no lat/lng plot on purpose.

## Plates
1. **Readouts**: places, time placed (and per day), top place share, spread = 2^H of place shares (Hill number, "like this many equally used places").
2. **Time at pen**: the mosaic, plus a ranked list under it with names, time and share (the mosaic alone had no names).
3. **Place clock** (IIB *Digit grid*): one row per Location pen at the finest level, 24 hour cells, darker = more minutes. A find box shows when there are more than 6 places.
4. **Repeated coordinates**: sorted by pins, with an "Unnamed only" toggle. The name field and Save button now sit on one row.

## Fixed (2026-10-23)
- Shorter kicker. Inline list style moved to CSS. The GPS row no longer stacks the button under the field.

## Ideas not built
- Packed bubbles by place kind (IIB *Size bubbles by cause*), grouped by the Location depth rung.
- Weekday × place mirror split.
