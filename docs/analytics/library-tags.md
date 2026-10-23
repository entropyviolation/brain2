# Library → Tags

_Last mapped: 2026-10-23_

View id `tags`, `TagsView` in `components/Analytics/LibraryCuts.tsx`. Math: `library-stats.ts` (`tagPairs`, `shannon`, `summarize`), `studio-plot-stats.ts` (`tagIntersections`). Item tags only, not tracked-minute tags.

## What is on the page
- Readouts (new): distinct tags, tagged share, tags per tagged item (mean, median, max), Pielou evenness with H in bits.
- Tools (new): **search** and **Min items** slider. They filter the treemap, the bars and the pairs table. UpSet stays whole.
- Treemap: one hue, darker for more-used tags. Bars: top 16, with a note when more exist.
- **Tag combinations** (UpSet, Lex et al. 2014): rebuilt so dots, name, n and bar sit in one grid row, with the 8 column tags named on top.
- **Tag pairs** (new): every pair sharing ≥ Min items. Columns: items, Jaccard = |A∩B| / |A∪B|, lift = P(A∩B) / (P(A)·P(B)) over tagged items. Sortable. Click opens the items.

## Fixes in this pass
- Treemap tiles were one flat color and narrow tiles hid their names.
- UpSet rows did not line up with their dots (two separate columns of different heights, buttons sized to content).

## Ideas not built yet
- **7-way Venn** (IIB) for the top 7 tags beside the UpSet.
- Tag trend over the range (needs tag-added dates).

## Research notes
No new web search. Lift and Jaccard are the standard association-rule measures (Agrawal et al. 1993; Jaccard 1901). UpSet: Lex, Gehlenborg et al., IEEE TVCG 2014.
