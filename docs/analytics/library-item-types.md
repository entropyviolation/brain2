# Library → Item Types (and Relations)

_Last mapped: 2026-10-23_

View id `item-types`. Files: `components/Analytics/ItemTypesLibrary.tsx`, `components/Analytics/relations/`. Shared plates: `library-kit.tsx`, math: `library-stats.ts`, skin: `library-views.css`.

## Data
- `item-type-store`: types (name, kind system / catalog / user, color, icon, description, `attributes`), relations, relation overrides.
- `task-store`: tasks, lists. Items of a type come from `itemsOfType` (primary type, subtypes, or a list that allows the type). An item can count under two types.
- Relations: `allRelations()`, usage from `relationUsage(tasks)`.

## What is on the page
**Types tab**
- Header: sort (count / name / kind), kind chips, **search** (name or description), New type.
- Readouts (new): types in use / total, top type share, Pielou evenness J = H / log2 k with H in bits.
- Mosaic: one cell per type, width grows with item count. Unused types shrink to a 28px swatch.
- List + detail: edit, delete, Open in Lists, first 40 items. **Schema coverage** (new): share of the type's items carrying each attribute.

**Relations tab** (`RelationsLibrary.tsx`)
- By family view (new): **search** (label, inverse, id), **Used only**, **Fold all**, a **family strip** (width = relations in family, label = links using them; click folds), foldable family groups. Families start open.
- Tree, Schematic, Rules, Inbox are unchanged.

## Fixes in this pass
- Mosaic text faded to unreadable: the cell opacity ramp (0.55–1) is gone, ink now follows `inkOnFill`.
- Mosaic left a tall empty band and hid every label: cells now fill a 120px plate, used types get 112px so names show.
- Relations was a 64-row wall with no way to narrow it.

## Ideas not built yet
- **Category tiles** (IIB Top 500 Passwords): every item one tile, colored by type, grouped by list.
- Relations usage over time once links carry a created date.

## Research notes
No new web search. Evenness is Pielou (1966). Mosaic sizing follows the IIB **Sized squares** move in `viz-inspiration.md`.
