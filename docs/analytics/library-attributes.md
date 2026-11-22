# Library → Attributes

_Last mapped: 2026-10-23_

View id `attributes`. File: `components/Analytics/AttributesView.tsx`. Math: `library-stats.ts` (`summarize`, `bins`).

## Data
- Number, selection, boolean and goal attributes from item-type schemas (`type.attributes`) and list schemas (`list.itemAttributes`). Text and date fields are skipped. First definition of an id wins.
- Values from `task.attributes[id]`. Goal reads `.current`.
- **Eligible** items: items of the type (`itemsOfType`) or items on the list. **Fill rate** = items with a value ÷ eligible.

## What is on the page
- Attribute picker. With no pick, opens on the attribute with the most values (was: first by name, often empty).
- Readouts (new): values and distinct count, fill rate, and for numbers mean ± SD, median with IQR, range.
- Bars: numbers in scale order (was by frequency), up to 40; labels by frequency, top 20.
- **Binned** (new): ten equal-width bins when a number has more than 12 distinct values.
- **Attribute table** (new, IIB Periodic taxonomy): one tile per attribute with kind symbol (# ◉ ✓ ◎), source, spark of top values, fill rate. Filled tiles first. Search. Click a tile to chart it.

## Ideas not built yet
- Pair two numeric attributes as a scatter (axis picker, IIB Hollywood In$ider).
- Flag attributes nobody fills (0% for 30 days) as candidates to drop from the schema.
