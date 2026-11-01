# Knowledge graph deepening: research

_Last mapped: 2026-11-01_

**Status: research. Every proposal here is Planned.** Nothing is built
unless a line says it already exists in code. This file adds to
[`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md) and does not replace
it. Where an idea there already has an id (`KG-A5`, `KG-L1`, …), this file
names it and adds only the method.

Five topics: category theory, extraction without a model, insights that
describe, feedback from use, and pictures. Each section ends with numbered
proposals. Ids use the prefix `KD-` (knowledge deepening) so they do not
clash with the plan's families.

**The laws, short.** From the plan's §2. A proposal names the law it could
trip.

| # | Law |
|---|---|
| L1 | Item is the only noun. Addresses, not new record kinds. |
| L2 | One write door: `commitItemEdit` and the stores. The graph layer reads. |
| L3 | Deterministic after install. No runtime model judges. |
| L4 | Four orders: observed, recorded, derived, inferred. Every computed edge names one. |
| L7 | Extensional sentences: date range, subset, `n`, what is not covered. Floors stay. |
| L8 | Description, not prediction. "Co-occurs", never "will" or "causes". |
| L9 | Second-order changes only after an accept. |
| L10 | No "should" in chrome. |

---

## 0. What the code already has

_Last mapped: 2026-11-01_

Read for this file: `lib/links.ts`, `lib/graph/relation-rules.ts`,
`lib/graph/densify.ts`, `lib/graph/densify/*`, `lib/graph/graph-quality.ts`,
`lib/graph/kg-model.ts`, and the `graph/` rows of `lib/README.md`.

- `RelationDef` already carries most of an olog arrow: `fromTypes` /
  `toTypes` (domain and codomain), `inverse`, `parent` (sub-relation), and
  `RelationTraits` (`transitive`, `acyclic`, `functional`,
  `inverseFunctional`, `disjointWith`).
- `RelationRule` (`lib/graph/relation-rules.ts`) is a chain of 1–3
  relations with a head. In relation algebra that is an inclusion
  `R ; S ⊆ T`. Today it only derives. It does not check.
- `lib/graph/kg-model.ts` already declares `SchemaObject`,
  `SchemaMorphism`, `PathEquation` (`equal` or `implies`) and
  `EquationBreak`. The category-theory proposals below fit those types.
- `densify.ts` has eight suggestion sources. Scores order the shelf. They
  decide nothing.
- **Gap found.** Feedback is half-recorded. A dismissal stores an edge key in
  `Task.dismissedLinkSuggestions`, with no source. An accept on the shelf
  (`components/ItemDetail/tabs/links/RichLinksPanel.tsx`, `onAccept`) calls
  `addLink` and records no source either, except inbox proposals, which get
  `status: "accepted"`. `graph-quality.ts` re-runs four sources to guess
  which one made a dismissed key. So an accept rate per source cannot be
  counted today. Section 4 fixes that first. _Partly built 2026-11-01:_ the
  shelf now calls `recordAction` (`lib/graph/graph-usage-store.ts`) with the
  source and relation, and `lib/graph/feedback.ts` counts them. The ledger
  line and the KD-IE6 pattern id are still **Planned**, and nothing calls
  `recordVisit` yet.
- **Small tension with L10.** The noisy-source line in
  `graph-quality.ts` ends "Mute it on the Links tab." That reads as advice.
  A fact form is "Muting is on the Links tab."

---

## 1. Category theory as a working tool

### 1.1 What the sources say

**Ologs.** Spivak and Kent model knowledge as a category
([arXiv 1102.1889](https://arxiv.org/abs/1102.1889)). A *type* is a box
("a person"). An *aspect* is an arrow that must be a function ("a person has
as birth mother a woman"). A *fact* is a commutative diagram: two paths
between the same boxes that agree. An *instance* fills each box with a set
and each arrow with a function, so data is a functor from the schema into
sets. A relation that is not a function is drawn as its own box with two
aspects out of it (a span). Ologs connect to each other by functors.

**Functorial data migration.** A schema mapping `F: C → D` is a functor.
It gives three ways to move data
([Spivak, arXiv 1009.1166](https://arxiv.org/abs/1009.1166);
[Fong and Spivak, *Seven Sketches*, ch. 3](https://arxiv.org/abs/1803.05316)):

- **Δ_F** (pullback, "restrict"). Read D-data through C's eyes. It is
  precomposition, so it only reshapes and never invents. Projection and
  renaming live here.
- **Σ_F** (left adjoint, a left Kan extension). Push C-data into D. Where
  F sends two things to one, Σ glues them (a union and a quotient). Where D
  has an arrow C lacks, Σ makes a fresh labelled unknown.
- **Π_F** (right adjoint, a right Kan extension). Push C-data into D by
  taking only what is consistent across all ways in. This is the join.

The Kan extensions are the "best guess" moves. Σ is the most generous
completion. Π is the most cautious one.

**CQL.** The categorical query language puts these into practice
([Wisnesky and others, arXiv 2001.00338](https://arxiv.org/abs/2001.00338);
[Schultz and Wisnesky, *Algebraic data integration*](https://arxiv.org/abs/1503.03571)).
A schema is a graph plus path equations, for example "the department of an
admin's employer is the admin's department". A mapping must send each
source equation to an equation that holds in the target. Because functors
keep equations, a checked mapping cannot break integrity. The general check
is undecidable, but for short, finite path sets it is a plain comparison.

**Relations, not functions.** Most Brain2 links are not functions (a person
has many friends). The right setting is a category of relations, an
*allegory* ([Freyd and Scedrov](https://ncatlab.org/nlab/show/allegory)).
There, composition `R ; S` is "some middle step exists", converse is the
inverse relation, and facts become inclusions `R ; S ⊆ T` rather than
equalities. Brain2's `RelationRule` already has that exact shape.

**Composition tables.** Qualitative reasoning precomputes what `R ; S` can
be for every pair of base relations. Allen's interval algebra is the classic
one: 13 relations between time intervals and a 13 × 13 table. Path
consistency then finds impossible networks in polynomial time for useful
subsets ([Allen's interval algebra](https://www.wikipedia.org/wiki/Allen%27s_interval_algebra);
[Renz and Nebel, efficient methods](https://arxiv.org/pdf/1106.0679)).

### 1.2 What this gives Brain2

The vocabulary is already a small category. Item types and address kinds are
objects. Relations with `fromTypes` / `toTypes` are arrows. Chain rules and
transitive traits say how arrows compose. `functional: 1` marks the arrows
that are true olog aspects. What is missing is the *fact*: a path equation
that the data can be checked against. A check is the safest kind of
category feature. It reads, counts, and writes nothing.

### 1.3 Proposals

1. **KD-CT1 · Rules that check, not only derive.** Add `mode?: "derive" |
   "check"` to `RelationRule`. A check rule is a `PathEquation` of kind
   `implies` (`kg-model.ts`). The checker walks the chain and lists pairs
   where the chain holds and the head does not, as `EquationBreak` rows:
   "12 of 15 tasks in a phase of Kitchen Remodel are also part of it. 3 are
   not: …". Shown in the weekly review beside `egoChecks`. Absent `mode`
   means `derive`, so old rules read unchanged. Could trip: L10 if the line
   says "fix"; L7 if it drops `n`.
2. **KD-CT2 · Equal-path facts on aspects.** When every arrow on both sides
   has `functional: 1`, offer kind `equal`. Example: "a person's mother's
   mother" equals "a person's maternal grandmother" when both are recorded.
   An equality with a non-functional arrow is refused at save with the reason
   ("friend-of is not one-to-one, so only 'implies' fits"). Could trip: none
   if read-only.
3. **KD-CT3 · Composition table of the vault.** For each pair of relations
   `(R, S)` with matching ends, count chains `a R b S c` and how often `a T
   c` is already recorded, for each `T`. Show the top cells as a table: "part-of
   then part-of lands on part-of in 41 of 41 chains". A cell with high
   coverage is a candidate rule. Accept writes a `RelationRule` (person
   origin). This is AMIE at length two (section 3). Could trip: L9 if a rule
   is saved without the accept; L7 floors (`n ≥ 7`).
4. **KD-CT4 · Allen relations on time.** Spans, blocks, and events have
   start and end. Derive the Allen relation between two of them at read time
   (`before`, `meets`, `overlaps`, `during`, …) as order `derived`. Use the
   composition table to find impossible plans: "Task A before B, B during
   Event C, C before A: no ordering fits." That is a fact, not a fix.
   Could trip: L4 (must say `derived`). Seam: `lib/graph-layout.ts`
   `topologicalRanks` already handles the `before` part.
5. **KD-CT5 · Imports as checked mappings.** Each import (Letterboxd,
   Instagram, a CSV) declares a small source schema and a mapping into
   Brain2 types and relations: each source field goes to a relation path
   with a compatible `fromTypes` / `toTypes`. A pure checker says which
   fields map, which fall outside scope, and which source facts would break.
   This is the "is it a functor" check from CQL, done on finite paths. It
   extends `KG-N5` (mapping files). Could trip: L2 if the import writes
   outside the existing door; the mapping itself only reads.
6. **KD-CT6 · Δ for module views.** A module (`ModuleDefinition` roles)
   already picks lists and types. Read it as a mapping from the module's
   small schema into the vault schema. Δ along it is the module's view: a
   read-only reshape, never a copy. Naming it this way gives one function
   (`restrictAlong(mapping, graph)`) that every module view can reuse.
   Could trip: none.
7. **KD-CT7 · Σ as staged gluing, Π as the cautious join.** When an import
   maps two source records to one Brain2 item (identity), that is Σ's glue.
   Brain2 stages it as `same-as` proposals in the graph inbox
   (`identity-match.ts` already does this). Where the target type has a
   relation the source lacks ("every book has an author"), Σ would invent a
   blank. Brain2 shows a *hole* at read time ("author: not recorded") and
   writes nothing. Π is the join question in KD-CT8. Could trip: L9 and L2
   if Σ wrote; it never does.
8. **KD-CT8 · Pullback questions.** Two arrows into one object form a
   pullback: "people and events that share a place", "tasks and goals that
   share a list". Add one join variable to `pattern-questions.ts`:
   `? a at ?p ; ? b at ?p`. Answers list the shared node and both sides.
   This is the first step of `KG-Q` variables. Could trip: L7 (sentence
   needs `n`).
9. **KD-CT9 · Spans for non-functional facts.** Where a relation needs its
   own data (a friendship that began in 2019), the olog answer is a box with
   two aspects. In Brain2 that box is a `formulation` item (GS-5), not a new
   record kind. Could trip: L1 if anyone adds an edge record instead.

---

## 2. Extraction without a model

### 2.1 What the sources say

- **Lexical patterns.** Hearst showed that a few hand-written phrase
  patterns ("X such as Y", "Y and other X") find is-a pairs with high
  precision and low recall
  ([Hearst 1992, ACL C92-2082](https://preview.aclanthology.org/fix_video/C92-2082.pdf)).
  The lesson is the trade: precise patterns, many misses, no training.
- **Dictionary matching.** Aho–Corasick matches every name in a fixed
  list in one pass over the text, in time linear in text plus matches.
  Gazetteer linkers pair it with longest-match-first and a stoplist for
  short or common names
  ([a hybrid domain entity linker, arXiv 1509.01865](https://arxiv.org/pdf/1509.01865)).
- **Time expressions.** Rule systems such as SUTime and HeidelTime find
  "last Tuesday" or "the week after next" and normalise it against an anchor
  date into a TIMEX3 value
  ([SUTime](https://typeset.io/pdf/sutime-a-library-for-recognizing-and-normalizing-time-53w0y4a0ke.pdf);
  [HeidelTime at TempEval-2](https://preview.aclanthology.org/moar-dois/S10-1071.pdf)).
  They are deterministic if the anchor is fixed.
- **Labelling functions.** Snorkel writes many small heuristic labellers and
  tracks how often each is right
  ([Snorkel DryBell, arXiv 1812.00417](https://arxiv.org/pdf/1812.00417)).
  Snorkel then trains a model, which Brain2 refuses (L3). The useful part is
  the bookkeeping: every heuristic has an id and a measured precision.

### 2.2 What Brain2 has

`densify/mention.ts` matches full titles (≥ 3 characters) and close
people's first names and nicknames (≥ 2) in an item's text fields, one row
per name, with the sentence as evidence. `RelationDef.phrases` already
holds forward and inverse phrases per relation. _Partly built 2026-11-01:_
`relation-word` now has `lib/graph/densify/relation-word.ts`, fed by
`lib/graph/extract/relation-phrases.ts`, and `lib/graph/extract/wiki-links.ts`
reads `[[Title]]` and `[[relation::Title]]`. The Aho–Corasick matcher and
capture-time linking stay **Planned**.

### 2.3 Proposals

1. **KD-IE1 · One gazetteer automaton.** Build one Aho–Corasick trie over
   titles, aliases, and nicknames, cached by tasks identity. Rules:
   whole-word only, longest match wins, a name shared by two or more items
   gives a row naming both and no default. A stoplist (house words, months,
   one-word titles under 4 letters) blocks the rest. `mention.ts` keeps its
   output shape and reads the automaton. Could trip: none. Gain: one pass per
   text instead of one scan per title.
2. **KD-IE2 · Phrase patterns from `phrases`.** Compile each relation's
   `phrases.forward` into patterns `<NAME> <phrase> <NAME>` and the inverse
   into the swapped form. A row is made only when both names resolve through
   KD-IE1 to one item each. This is the missing `relation-word` source.
   Evidence is the span (`KG-NL8`). Add Hearst forms only for the taxonomy
   pack (`broader`, `instance-of`): "X such as Y and Z", "Y and other X".
   Could trip: L9 if a hit writes a link; it goes on the shelf.
3. **KD-IE3 · Typed inline links.** Read `relation:: [[Title]]` in notes
   and bodies as a recorded link the person wrote by hand, and `[[Title]]`
   alone as `mentioned`. Unknown relation words become a shelf row that
   offers the nearest relation by phrase, not a new relation. Could trip:
   L2 (the write goes through `commitItemEdit` on save).
4. **KD-IE4 · Dates anchored to the capture.** Normalise relative dates
   against the capture's own timestamp (`captureOrigin`), never against
   today. "Dinner with Ana last Friday", captured Monday 3 Nov, gives
   `day:2026-10-31` every time it is read. The edge item → day is
   `derived`. A small rule grammar (weekdays, "last/next", "N days ago",
   month names, ISO) covers most captures. Ambiguous forms ("Friday" alone)
   give two candidates and no default. Could trip: L3 if "now" leaks in; L4.
5. **KD-IE5 · Co-mention counts.** Two items resolved in the same sentence,
   across at least 7 sentences (`OBSERVATORY_FLOOR`), give a row: "Ana and
   the Climbing Gym are named together in 9 sentences, Mar–Oct 2026."
   Relation `related`, source `co-mention`. Order by pointwise mutual
   information so two famous names do not win by size. Could trip: L7, L8
   (says "named together", never "linked").
6. **KD-IE6 · Every pattern has an id.** Each pattern (a phrase, a Hearst
   form, the date grammar's rule) carries a stable id in the suggestion's
   `reason`, so section 4 can count it. Could trip: none.

---

## 3. Insights that describe

### 3.1 What the sources say

- **Betweenness.** Brandes computes exact betweenness in `O(nm)` for an
  unweighted graph
  ([Brandes 2001](https://www.bibsonomy.org/bibtex/1dff547c1a86412c8f3742aab68f7a243/dbenz);
  [adaptive version, arXiv 1802.06701](https://arxiv.org/pdf/1802.06701)).
  At 5,000 nodes and 20,000 edges that is about 10⁸ steps: a worker job,
  cached.
- **PageRank.** Power iteration with damping 0.85 and a fixed number of
  steps is fully deterministic. Personalised PageRank restarts at one node and
  ranks "what is near this"
  ([igraph `page_rank`](https://rdrr.io/cran/igraph/man/page_rank.html)).
- **Bridges and cut nodes.** One DFS with low-links finds every bridge and
  articulation point in linear time
  ([bridges and articulation points](https://soi.ch/wiki/bridges-articulationpoints/)).
- **Communities.** Label propagation is near-linear but random: node order
  and ties change the answer
  ([Raghavan and others, arXiv 0709.2938](https://arxiv.org/abs/0709.2938);
  [fast label propagation, arXiv 2209.13338](https://arxiv.org/pdf/2209.13338)).
  Fixing the order and the tie rule makes it repeatable.
- **Structural holes.** Burt's constraint and effective size measure how
  much a person is the only bridge between groups in their ego network
  ([NetworkX structural holes](https://networkx.org/documentation/networkx-2.2/_modules/networkx/algorithms/structuralholes.html)).
- **Association rules.** Support, confidence, and lift
  ([Agrawal and others 1993](https://www.comp.hkbu.edu.hk/~markus/teaching/comp7650/Agrawal.pdf);
  [interest measures, arXiv 0803.0966](https://arxiv.org/pdf/0803.0966)).
  AMIE mines Horn rules over relations in an open-world graph. Its *PCA
  confidence* counts a missing fact as a counter-example only when the
  subject already has some fact of that relation
  ([AMIE, MPI-INF](https://www.mpi-inf.mpg.de/de/departments/databases-and-information-systems/research/yago-naga/amie)).
  That matches Brain2's open world: a blank is "not recorded", not "no".

### 3.2 Proposals

The plan already names `KG-A1` (betweenness), `KG-A4` (communities),
`KG-A5` (bridges), `KG-A9` (personalised PageRank), and `KG-L1`–`KG-L4`
(rule mining over day graphs). These add method and the sentence form.

1. **KD-IN1 · Bridges and cut items** (`KG-A5`). Tarjan's DFS over the
   `KnowledgeGraph` undirected view. Sentence: "Removing the link Ana –
   Climbing Gym splits 14 items from the other 610." Item addresses only;
   day spine edges excluded, or every day is a hub. Could trip: L10 if it
   says "add a link".
2. **KD-IN2 · Exact betweenness, cached** (`KG-A1`). Brandes in a Web
   Worker, keyed by graph identity, top 10 with their scores and the edge
   count used. Above 10k nodes, sample sources in a fixed order (every k-th
   by id) and say so in the sentence. Could trip: L3 if sampling uses
   `Math.random`.
3. **KD-IN3 · "Near this item"** (`KG-A9`). Personalised PageRank, 30
   steps, damping 0.85, node order by id. The Links tab can show the top
   five not yet linked, each with the shortest path as its reason
   (`path-sentence.ts`). Could trip: L9 (rows go to the shelf).
4. **KD-IN4 · Repeatable communities** (`KG-A4`). Asynchronous label
   propagation, nodes visited in id order, ties broken by the smallest
   label, at most 20 rounds. A community is named by its highest-degree
   member ("the Ana group"), never by a model. Show size and internal edge
   share. Could trip: L3 if a model names it.
5. **KD-IN5 · Brokers among people.** Burt's effective size and constraint
   on each person's ego network of people. Sentence: "Ana is the only
   recorded tie between 6 Climbing people and 9 Work people." Private by
   default under `KG-P7`. Could trip: L8 if it says what a tie is "worth".
6. **KD-IN6 · Rules over item links** (extends `KG-L1`). Length-2 rules
   `a R b, b S c ⇒ a T c` over recorded links, with support (count of
   matching pairs), head coverage, and PCA confidence. Floor: support ≥ 7.
   Sentence: "In 14 of 17 cases where a task is part of a phase of an
   operation, it is also recorded as part of the operation (PCA, Jan–Oct)."
   Lift is said as "more often together than their counts alone give".
   Accept saves a `RelationRule` in check mode (KD-CT1) or derive mode.
   Could trip: L8 ("will"), L9.
7. **KD-IN7 · Anomaly is a broken equation.** The only anomaly Brain2 names
   is a pair that breaks a fact the person accepted (KD-CT1) or a mined rule
   above 0.9 PCA confidence (the "exception" of `KG-L4`). No distance score,
   no outlier model. Could trip: L3 if a statistical outlier score sneaks in.
8. **KD-IN8 · Week-over-week change.** For every metric above, keep the
   last weekly value in the review record and print the difference: "Cut
   items: 4 last week, 3 now." The review record is an existing store.
   Could trip: L2 if a new store appears; L8.

---

## 4. Feedback from use

### 4.1 What the sources say

- **Smoothing small counts.** Additive (Laplace) smoothing gives a rate of
  `(a + 1) / (n + 2)`: the mean of a Beta(1, 1) prior updated with `a`
  accepts in `n` decisions
  ([additive smoothing](https://en.wikipedia.org/wiki/Additive_smoothing)).
  It stops 1 of 1 from outranking 40 of 50.
- **Ranking under doubt.** Ranking by the lower bound of the Wilson interval
  is a stricter, still deterministic option
  ([Evan Miller, "How not to sort by average rating"](https://evanmiller.org/how-not-to-sort-by-average-rating.html)).
- **Bandits need randomness.** Thompson sampling and ε-greedy explore by
  chance. That breaks L3: the same vault would show a different shelf.
  Brain2 can do without exploration because the person sees every source
  every week in review.

### 4.2 Proposals

1. **KD-FB1 · Record the source at the decision.** On shelf accept and
   dismiss, the ledger line (`lib/item-activity.ts`, which has `source`
   and `order`) carries `densify:<source>` and the pattern id (KD-IE6).
   Accept stays order `recorded`. No new store, no new `ItemLink` column.
   This closes the gap in section 0. Could trip: L2 (must go through
   `commitItemEdit`); GS-10 if anyone adds the source to `ItemLink`.
2. **KD-FB2 · Rate per source, shown raw.** Count accepts `a` and decisions
   `n` per source over the last 90 days from the ledger. Show the raw count:
   "triad: 12 of 20 accepted, Aug 3 – Nov 1." Use the Laplace rate only to
   order the shelf. Could trip: L7 (needs the window and `n`).
3. **KD-FB3 · Re-rank without hiding.** Shelf order is `score ×
   laplace(source)`, then `score × laplace(pattern)` when the pattern has
   at least 5 decisions. A source is never removed by its rate; muting stays
   the person's act (`links-view-store.ts`). Re-ordering is first-order and
   reversible, so it does not trip L9. Could trip: L9 if a low rate auto-mutes.
4. **KD-FB4 · Windows, not decay curves.** A 90-day window is easy to say
   in one sentence. An exponential half-life is not. If decay is needed, use
   two windows (last 30 and last 90 days) side by side. Could trip: L7.
5. **KD-FB5 · Rate per relation too.** `mention` → `mentioned` and
   `co-time` → `spends-time-with` may differ a lot from the same source on
   other relations. Count per `(source, relation)` once `n ≥ 7`; below that,
   fall back to the source rate. Could trip: none.
6. **KD-FB6 · The calibration table in review.** One small table in the
   weekly graph review: source, accepted, dismissed, window. Neutral ink. It
   replaces the imperative tail of the noisy-source line (section 0). Could
   trip: L10.
7. **KD-FB7 · Feedback on facts.** When the person marks an `EquationBreak`
   as "fine as is", record it on the ledger of the item, and the check skips
   that pair. The equation is not changed. Could trip: L9 if the equation
   is edited by the tally.

---

## 5. Pictures

### 5.1 What the sources say

- **Node-link or matrix.** In a controlled study, node-link drawings won on
  small graphs and on path tasks. Matrices won on larger or denser graphs for
  most other tasks
  ([Ghoniem, Fekete, Castagliola 2004](https://www.lisn.upsaclay.fr/publications/a-comparison-of-the-readability-of-graphs-using-node-link-and-matrix-based-representations/)).
- **Overview, zoom, details.** "Overview first, zoom and filter, then
  details on demand"
  ([Shneiderman 1996](https://drum.lib.umd.edu/handle/1903/5784)).
- **Start from a node.** For large graphs, "search, show context, expand on
  demand": a degree-of-interest score (a priori importance plus distance from
  the focus) picks what to draw around a focus node
  ([van Ham and Perer 2009](https://dig.cmu.edu/publications/2009-doigraphs.html)).
- **Schemas as diagrams.** *Seven Sketches* draws schemas as boxes and
  arrows with equations marked, and monoidal structure as string diagrams
  ([Fong and Spivak](https://arxiv.org/abs/1803.05316)).
- **Rendering limits.** A 2025 EuroVis poster measured SVG and WebGL. Both
  stayed above 50–100 fps up to about 1,000–5,000 nodes, depending on the
  machine. Beyond that SVG fell toward 0 fps and WebGL held at 30–100 fps.
  Canvas was not measured; earlier work it cites puts Canvas between the two
  ([WebGraphViz, EuroVis 2025](https://diglib.eg.org/bitstreams/e5783eb9-1259-4a5a-9370-2bbf1398455c/download)).
  d3-force uses a Barnes–Hut quadtree for repulsion, about `n log n` per
  tick ([d3-force many-body](https://d3js.org/d3-force/many-body)).

### 5.2 What Brain2 has

`lib/graph/ego-matrix.ts` (neighbourhood matrix with open triads),
`lib/graph/link-path.ts` with the path ruler, `lib/graph-layout.ts`
(layered ranks), and `lib/graph/relation-schematic-layout.ts`. Brain2 is
already ego-first. The plan's `KG-V1`–`KG-V16` cover plates and line
grammar.

### 5.3 Proposals

1. **KD-VZ1 · Pick the view from traits.** One pure function
   `viewFor(edges, defs)`: if every relation shown is `acyclic`, draw
   layered (`graph-layout.ts`); if the ego network has more than 30 nodes or
   density above 0.3, draw the matrix (`ego-matrix.ts`); else radial ego
   node-link. The person can switch. Could trip: none.
2. **KD-VZ2 · Degree of interest for the plate.** Score = a priori rank
   (KD-IN3 PageRank) − distance from focus + 1 if touched this week. Draw
   the top 40; the rest is a count ("+ 112 more"). Deterministic and
   explainable in a tooltip. Could trip: L3 if "touched" reads a model.
3. **KD-VZ3 · Semantic zoom by community.** At the widest zoom, each
   community (KD-IN4) is one node sized by members, edges are counts between
   groups. Zoom in to members. Details stay in the edge inspector (`KG-V4`).
   Could trip: none.
4. **KD-VZ4 · Same vault, same picture.** Seed positions from a hash of the
   node id, run a fixed number of ticks, and stop. The layout repeats across
   reloads, so the person's spatial memory holds. Could trip: L3 in spirit if
   `Math.random` seeds the layout.
5. **KD-VZ5 · The schema as a diagram.** In the Relations library, draw
   types as boxes and relations as arrows (`SchemaObject`,
   `SchemaMorphism`). A path equation (KD-CT1, KD-CT2) draws as a shaded
   cell between its two paths, with its break count on it ("3 breaks").
   This extends `KG-V5`. Could trip: L10 (count in neutral ink).
6. **KD-VZ6 · Size budget.** SVG for ego plates and schema diagrams (under
   about 500 nodes). Canvas 2D for the whole-vault atlas up to about 5,000
   nodes, with the layout in a Web Worker. Above that, draw communities only
   (KD-VZ3). No WebGL dependency until a vault passes 5,000 item nodes.
   Could trip: none; check `docs/DESIGN_STYLE.md` for ink and stroke.
7. **KD-VZ7 · Orders as stroke, everywhere.** Reuse `KG-V3` (observed,
   recorded, derived, inferred as stroke styles) on every view above, so a
   derived Allen edge or a rule edge never looks recorded. Could trip: L4.

---

## 6. Suggested order

Each step is useful alone. The first three unblock the rest.

| Step | Ids | Why |
|---|---|---|
| 1 | KD-FB1, KD-IE6 | No rate can be counted until decisions carry a source |
| 2 | KD-CT1, KD-IN7, KD-VZ5 | Checks are the cheapest, safest category feature; `kg-model.ts` already has the types |
| 3 | KD-IE1, KD-IE2 | One automaton feeds mention, phrases, co-mention |
| 4 | KD-IN1, KD-IN3, KD-IN4 | Plain analytics on the `KnowledgeGraph` |
| 5 | KD-CT3, KD-IN6 | Rule candidates, accept-gated |
| 6 | KD-FB2–FB6 | Re-ranking once a few weeks of decisions exist |
| 7 | KD-VZ1–VZ4, KD-VZ6 | Views, once the numbers exist |
| 8 | KD-CT4, KD-CT5–CT8, KD-IE3–IE5 | Time algebra, import mappings, joins, dates |

## 7. Refused here

| Idea | Why |
|---|---|
| Bandit exploration on the shelf | Random order breaks L3. The weekly review already shows every source. |
| Auto-muting a source below a rate | L9. Muting is the person's act. |
| Σ migration that writes blanks or merges on import | L2, L9. Holes show at read time; merges stay `same-as` proposals. |
| Outlier scores as "anomalies" | L3, L8. An anomaly here is only a broken accepted fact. |
| Model-named communities | L3. A community is named by a member. |
| Snorkel's learned label model | L3. Only its per-heuristic bookkeeping is kept. |

## 8. Sources

- Spivak and Kent, *Ologs: a categorical framework for knowledge representation*, [arXiv 1102.1889](https://arxiv.org/abs/1102.1889)
- Spivak, *Functorial data migration*, [arXiv 1009.1166](https://arxiv.org/abs/1009.1166)
- Fong and Spivak, *Seven Sketches in Compositionality*, [arXiv 1803.05316](https://arxiv.org/abs/1803.05316)
- Wisnesky and others, *Informal data transformation considered harmful*, [arXiv 2001.00338](https://arxiv.org/abs/2001.00338)
- Schultz and Wisnesky, *Algebraic data integration*, [arXiv 1503.03571](https://arxiv.org/abs/1503.03571)
- Allegories, [nLab](https://ncatlab.org/nlab/show/allegory)
- Allen's interval algebra, [Wikipedia](https://www.wikipedia.org/wiki/Allen%27s_interval_algebra); Renz and Nebel, [arXiv 1106.0679](https://arxiv.org/pdf/1106.0679)
- Hearst 1992, [ACL C92-2082](https://preview.aclanthology.org/fix_video/C92-2082.pdf)
- Domain entity linking with dictionaries, [arXiv 1509.01865](https://arxiv.org/pdf/1509.01865)
- SUTime, [paper](https://typeset.io/pdf/sutime-a-library-for-recognizing-and-normalizing-time-53w0y4a0ke.pdf); HeidelTime, [S10-1071](https://preview.aclanthology.org/moar-dois/S10-1071.pdf)
- Snorkel DryBell, [arXiv 1812.00417](https://arxiv.org/pdf/1812.00417)
- Brandes 2001, [record](https://www.bibsonomy.org/bibtex/1dff547c1a86412c8f3742aab68f7a243/dbenz); adaptive Brandes, [arXiv 1802.06701](https://arxiv.org/pdf/1802.06701)
- PageRank in igraph, [docs](https://rdrr.io/cran/igraph/man/page_rank.html)
- Bridges and articulation points, [SOI wiki](https://soi.ch/wiki/bridges-articulationpoints/)
- Label propagation, [arXiv 0709.2938](https://arxiv.org/abs/0709.2938); fast label propagation, [arXiv 2209.13338](https://arxiv.org/pdf/2209.13338)
- Burt's structural holes in NetworkX, [source](https://networkx.org/documentation/networkx-2.2/_modules/networkx/algorithms/structuralholes.html)
- Agrawal, Imielinski, Swami 1993, [PDF](https://www.comp.hkbu.edu.hk/~markus/teaching/comp7650/Agrawal.pdf); interest measures, [arXiv 0803.0966](https://arxiv.org/pdf/0803.0966)
- AMIE, [MPI-INF](https://www.mpi-inf.mpg.de/de/departments/databases-and-information-systems/research/yago-naga/amie)
- Additive smoothing, [Wikipedia](https://en.wikipedia.org/wiki/Additive_smoothing); Evan Miller, [Wilson lower bound](https://evanmiller.org/how-not-to-sort-by-average-rating.html)
- Ghoniem, Fekete, Castagliola 2004, [LISN](https://www.lisn.upsaclay.fr/publications/a-comparison-of-the-readability-of-graphs-using-node-link-and-matrix-based-representations/)
- Shneiderman 1996, [DRUM](https://drum.lib.umd.edu/handle/1903/5784)
- van Ham and Perer 2009, [CMU](https://dig.cmu.edu/publications/2009-doigraphs.html)
- WebGraphViz, EuroVis 2025 poster, [Eurographics DL](https://diglib.eg.org/bitstreams/e5783eb9-1259-4a5a-9370-2bbf1398455c/download)
- d3-force many-body, [docs](https://d3js.org/d3-force/many-body)
