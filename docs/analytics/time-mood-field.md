# Time → Mood field

_Last mapped: 2026-10-23_

File: `components/Analytics/MoodFieldView.tsx`. Readings: `lib/mood-reading.ts` (`groupSameWord`, `waterOf`, `marksOf`). Logged metrics: `lib/metrics-store.ts`.

## Data
- Mood scope blocks in the window (pens are any painted name), hour × day grid, mood cards (word, sensation, tone, marks, vibe), the water (vibe phrases and leanings), and the five logged wellbeing metrics.
- Averages use only stretches that were opened and filled. A color with no card stays out of them.

## Plates
1. **How to read this**: now a collapsed `<details>` (was five always-open paragraphs).
2. **Mood pens** mosaic and **Hour × day**.
3. **Mood wheel** (IIB *Colours in Cultures*): rings = 7-day slices of the window (from the first day, oldest inside), wedges = top 12 mood pens, each cell the pen's own color, stronger with more minutes. **Light a word** dims every other wedge. Helper: `weekPenGrid`.
4. **Mood table** (IIB *Periodic taxonomy*): one tile per mood pen with a two-letter symbol, minutes, stretches, distinct days and last date, grouped by the pen it counts as ("Top level" when it has none). Sort by most time, most recent, most stretches. Helper: `penTiles`.
5. **Same word**: each word is a collapsible group (open when it has ≤ 3 stretches), with a find box when there are more than 4 words.
6. **The water**, **Marks**, **Logged metrics**: unchanged.

## Ideas not built
- Mood vs Places / People: mean marks by place or by who was there.
- Annotated year line of mood minutes with the peaks named.
