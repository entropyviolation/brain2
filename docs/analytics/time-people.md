# Time → People

_Last mapped: 2026-10-23_

File: `components/Analytics/PeopleView.tsx`. Minutes per person come from `personMinuteMasks` (`lib/person-time.ts`): Company blocks naming them ∪ Social "Who with?" ticks, counted once.

## Data
- Company person pens (`isPersonPen`). Per person: window minutes, previous-window minutes, days, sessions, last seen, rhythm (median gap), usual place and activity (all-time), first-ever date.
- Each row also keeps `byDay` (window minutes per date) for the strip plate.

## Plates
1. **Readouts**: people seen, time with anyone, new faces, drifting.
2. **Who** table: now with **Find**, **Sort** (most time, biggest rise, most days, seen most recently, name) and a top-12 cap with **Show all**.
3. **Company arcs** (IIB *Lawsuit arcs*, turned inward): you in the middle, one curved spoke per person, width ∝ √minutes. Drifting people (not seen in the window) sit faded with dashed spokes. Hover dims the rest. Top 16 seen plus up to 6 drifting.
4. **Days together** (IIB *Era bars*): one row per person (top 12), one cell per day of the window, darker = more minutes. Gaps show rhythm.
5. **Drifting**, **Time with anyone, by day** (now with a range and peak caption), and the **Who you were with** headcount plate (`TrackingContextPlates.tsx`).

## Fixed (2026-10-23)
- The name cell used `display: flex` on a `<th>`, which broke table-cell alignment. The flex now sits on an inner span.
- `analytics-boards.css` is imported by the view, so the table styles load even when no other board has loaded.

## Ideas not built
- Person × place or person × activity matrix.
- Ego-network: who appears together (co-presence on one block).
