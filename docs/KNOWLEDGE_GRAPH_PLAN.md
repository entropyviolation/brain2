# Brain2 knowledge graph plan

_Last mapped: 2026-10-27_

**Status: Planned, with a partial landing on 2026-10-27.** Nothing here is built
unless a line says **Landed**. The day spine, identity proposals, observation
evidence, machinery answers, and Cmd-K house questions are **Landed** only in
the slices named in the register under §5. This file opens no wave in
[`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md). A piece of it ships only when a wave
there claims it. Wave 10 (Ontology) and Wave 12 (Wiki links) are the nearest
homes.

**The texts.** Three sources, none in the repo. Everything here paraphrases
them. Nothing is quoted.

- **[H]** Aidan Hogan, Eva Blomqvist, Michael Cochez, Claudia d'Amato, Gerard
  de Melo, Claudio Gutierrez, and others, *Knowledge Graphs*, ACM Computing
  Surveys 54(4), 2021 (arXiv 2003.02320v6, 11 Sep 2021). Section numbers
  (§2.1, §5.4 …) are that paper's.
- **[BW]** Jesús Barrasa and Jim Webber, *Building Knowledge Graphs: A
  Practitioner's Guide*, O'Reilly, 2023. Chapter numbers are written `BW ch.9`.
  Its examples use Neo4j and Cypher. Brain2 runs neither; only the ideas
  carry over.
- **[KL]** The chapter 1 summary and FAQ of *Knowledge Graphs and LLMs in
  Action* (Manning), as pasted by the person on 2026-10-16. Only that summary
  was read.

**What this file does.** It reads [H] chapter by chapter, then [BW] and [KL],
says where Brain2 already does each idea, and turns the rest into numbered
proposals (`KG-D1`, `KG-V4`, …) that respect the house laws. It ends with
competency questions, expansions, an idea bank for cheap language models, a
build order, and the ideas this house refuses.

Related: [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) (fields),
[`MODULE_PLATFORM.md`](MODULE_PLATFORM.md) (five laws),
[`ScienceandSanityBrain2.md`](ScienceandSanityBrain2.md) (GS slices, the four
orders), [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md) (shared laws),
[`COUNTS_AS.md`](COUNTS_AS.md) (pen ladders),
[`TEMPORAL_POLARITY.md`](TEMPORAL_POLARITY.md),
[`BRAIN2_FEATURE_IDEAS.md`](BRAIN2_FEATURE_IDEAS.md) sections G–I and #146–#148
(the older second-brain graph ideas), and [`DESIGN_STYLE.md`](DESIGN_STYLE.md).

---

## Contents

1. [The definition, in house words](#1-the-definition-in-house-words)
2. [Laws this plan obeys](#2-laws-this-plan-obeys)
3. [Brain2's graph today](#3-brain2s-graph-today)
4. [The paper, chapter by chapter](#4-the-paper-chapter-by-chapter) — [H],
   then [BW] in §4.18 and [KL] in §4.19
5. [Proposals](#5-proposals)
6. [Competency questions](#6-competency-questions)
7. [Expansions](#7-expansions)
8. [Language model idea bank](#8-language-model-idea-bank)
9. [Build order](#9-build-order)
10. [Refused, and why](#10-refused-and-why)
11. [Open questions for the person](#11-open-questions-for-the-person)

---

## 1. The definition, in house words

The paper uses an inclusive definition. A knowledge graph is a graph of data
meant to gather and carry knowledge of the real world. Nodes are entities.
Edges are relations between them. A *data graph* becomes a *knowledge graph*
when schema, identity, context, ontologies, or rules are layered on it (§1,
§3).

Two kinds of knowledge sit on top:

- **Deductive.** What follows for certain from the data plus rules ("a Novel
  counts as a Book, so it counts as Reading").
- **Inductive.** What a pattern suggests, with a confidence ("on 21 of 30
  nights over 7 hours, Writing ran over an hour the next day").

Brain2 is a **personal knowledge graph**. The tourism board in the paper's
running example is one person here. The "real world" is one life. The paper's
enterprise trends (§10.2) all apply at small scale: many sources, refinement
matters, freshness matters, and lightweight taxonomies beat heavy logic.

The house already says the same thing in its own words. "Item is the only
noun" is the node law. "Isolation is a bug" is the edge law. "A record is a
map" is the paper's distinction between the data graph and the domain graph it
describes (§4.1.1). The four orders (observed, recorded, derived, inferred) are
the paper's provenance context (§3.3).

---

## 2. Laws this plan obeys

These are locked elsewhere. A proposal below that fights one loses.

1. **Item is the only noun.** No new record kind for a tag, a day, a concept,
   or an edge. Non-item records (pens, habits, days, periods) can be *addressed*
   as graph nodes at read time. They do not become Items by this plan.
   ([`MODULE_PLATFORM.md`](MODULE_PLATFORM.md))
2. **One write door.** New writes go through `commitItemEdit`
   (`lib/commit-item-edit.ts`) and the stores. A graph layer reads. It does not
   become a second store.
3. **Deterministic after install. No runtime model judges.** No embedding,
   graph neural net, or language model decides a finding, a link, or a weight
   at runtime. The paper's numeric learning (§5.2, §5.3) is out of the runtime.
   ([`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md) law 5)
4. **Four orders. Never a fifth.** Observed, recorded, derived, inferred. Every
   computed edge or value names one. A typed value stays recorded.
5. **No `concept` type.** GS-5 adds one type, `formulation`, with a role. A
   relation that needs its own certainty becomes a formulation (idea #77). Do
   not add certainty columns to `ItemLink` beyond the GS-5 link pair (GS-10).
6. **Counts-as.** Pens may have many parents (`TrackPen.parentIds`, persist
   v14). Types, tags, and lists get one parent under GS-8. This plan computes
   ladders on read and never rewrites stored ids.
7. **Extensional sentences.** A sentence that states a pattern carries a date
   range, the subset, and `n`, and names what it does not cover (GS-2). Sample
   floors stay (`OBSERVATORY_FLOOR = 7`).
8. **Out of Data: predictive or ML analytics** ([`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md)
   "Do not"). Counting support and confidence is description, not prediction.
   A count may say "co-occurs". It never says "will" or "causes".
9. **Second-order changes only after an accept**, in the weekly review. The
   graph never rewrites itself when a source arrives (idea #83 stays out).
10. **No "should" in chrome.** Quality reports state facts in neutral ink.
11. **The person keeps the means.** Offline-first, plain JSON, optional sync.
    Export never strips the person's data from them.

**How the paper's ideas get past these laws**

| Paper idea | House-legal form |
|---|---|
| Everything is a node | Read-time node addresses (`pen:…`, `day:…`) over existing stores, no new records (KG-D2) |
| Edge metadata (property graph, reification) | Provenance read from the existing `lib/item-activity.ts` ledger, which already stores `order` and `source` (KG-C2) |
| Materialised entailments | Computed on read, never written, marked **derived** (KG-R1) |
| Embeddings, GNNs | Refused at runtime (section 10). Section 8 lists the narrow, opt-in uses. Symbolic rule mining and plain graph analytics instead |
| Link prediction | Suggestions in the weekly review Infer step; accept writes a **recorded** link (KG-F1) |
| Many-parent subclassing | Pens already; types/tags/lists wait on the COUNTS_AS parallel question (section 11) |
| Open-world semantics | Default for the vault. Local closed world only where the person marks a list complete (KG-O9) |

---

## 3. Brain2's graph today

_Last mapped: 2026-10-16_

The paper says a relational schema that keeps growing ends up as binary
relations, which is a graph (§2.1). Brain2 is that story. Its graph exists, but
only one family of edges is called a graph. The rest hide in fields and side
stores. A reader that joins them is the first missing piece (KG-D1).

### 3.1 Edges already stored

| Edge (subject → object) | Where it lives | Notes |
|---|---|---|
| item → item, typed | `Item.links` (`ItemLink`: `relation`, `targetId`, `stance?`, `weight?`) | The named graph. 23 relations with inverses in `RELATIONS` (`lib/links.ts`). Backlinks derived. |
| item → list (member) | `Task.lists` | Many lists. Rule-added members are tracked (`Task.listRuleAddedIds`); hand removals in `Task.listMembershipExclusions` (`lib/list-membership-rules.ts`). That is provenance on an edge already. |
| list → list (connected) | `List.linkedTargetListIds` (`lib/list-links.ts`) | Directed. Copies membership. A propagation rule. |
| list → list (nested) | `List.parentListId` | One parent. |
| list → folder | `Folder.listIds` (`lib/folder-membership.ts`) | Many-to-many. Direct vs inherited membership is computed. |
| folder → folder | `Folder.parentFolderId` | Tree. |
| task → task | `Task.dependencies`, `parentTaskId` | Scheduler edges. Not in `links` yet (`lib/links.ts` header names this debt). |
| item → item, via attribute | `AttributeDefinition.refListId`, `optionListId`, list-sourced selections | Item-valued attributes are edges wearing a column. |
| item → type | `Item.type` | One type per item (a heterogeneous graph, §2.1.2). |
| type → type | `ItemTypeDefinition.parentTypeId` | Subclass. Inherits attributes, defaults, capabilities, rules. |
| task → goal / objective | `GOAL_RELATIONS` (`action-of`, `objective-of`, `goal-of`) plus `goals-store` | Objectives ↔ goals live in `brain2-goals-store`. |
| task → event | `checklist-of` (`lib/event-links.ts`) | Derives `mustBeDoneBefore` from the event. A rule. |
| source → belief | `supported-by` / `refuted-by` with `stance` | Strength derived in `lib/belief-strength.ts`. |
| block → pen | `TimeEntry` minutes in `brain2-timegrid-store` | Secondary pens and variants ("Who?") are qualifiers, an n-ary edge (§3.3.3). |
| pen → pen (counts as) | `TrackPen.parentIds` | Many parents. `wouldCycle` guards. |
| pen → pen (always means) | `TrackPen.links` (`PenLink`, `lib/entry-links.ts`) | A standing Horn rule: Ian's House ⇒ Social. Fills only blank minutes. |
| pen → tag | `TrackPen.tags` (`TrackTag` ids) | A second tag identity beside `Item.tags` strings. |
| person ↔ pen ↔ item | `lib/people-sync.ts` | Identity resolution by name across a who-pen detail, a Company pen, and People I Know (`company-pen` pipeline). |
| habit → tag / habit / tracking | `taggedTaskTag`, `habitValueLink`, coverage links, `sleepCompleted` / `listCompleted` connections | Each sync file (`lib/habit-*-sync.ts`) is a rule that derives a cell. |
| type/list → action | `ItemTypeRule` implied actions (`lib/implied-actions.ts`) | `logAction`, `incrementHabit`. Rules again. |
| count → keyword | `count-statuses.ts` `countId` on log keywords | Lexical binding. |
| GPS fix → place → Location pen | `lib/ingest/gps-places.ts` | Clustering then naming. Entity creation from observation. |
| message → item | `CaptureOrigin` (`Task.captureOrigin`) plus the applied-message log in `brain2-ingest-store` | Provenance of a node. |
| item → activity line | `brain2-item-activity` (`ItemActivityEntry.order`, `source`) | The append-only ledger. Already carries the four orders. |
| module → list (role) | `ModuleDefinition` bound lists + roles | A small schema mapping per module. |
| workflow → effect | `WorkflowDefinition` (`lib/workflow-engine.ts`) | Trigger → conditions → actions. Production rules. |

### 3.2 What the stores are, in the paper's terms

Each persisted store is a **named graph** (§2.1.4) with its own key:
`brain2-task-storage`, `brain2-timegrid-store`, `brain2-habits-store`,
`brain2-goals-store`, `brain2-reviews-store`, `brain2-event-storage`,
`brain2-planned-actions`, `brain2-sleep-store`, `brain2-cycle-marks`,
`brain2-count-statuses`, `brain2-metrics-store`, `regret-store`,
`brain2-affirmation-log`, `brain2-ingest-store`, `brain2-item-activity`, and
the rest in `lib/README.md`. The full backup (`lib/data/backup.ts`) is the
**dump** (§9.2.1). `lib/search.ts` is a keyword index. Cmd-K is a **node
lookup** (§9.2.2). Nothing yet answers an **edge pattern** or a **graph
pattern** (§9.2.3–9.2.4) across stores.

### 3.3 What the paper would call each house idea

| House idea | Paper term |
|---|---|
| Item is the only noun | Uniform node model |
| `RELATIONS` with inverses | Inverse property axioms (§4.1.3) |
| `stance`, `weight` on `ItemLink` | Property-graph edge attributes (§2.1.3), fuzzy annotation (§3.3.4) |
| `parentTypeId` | Subclass (§3.1.1) |
| Type attributes ∪ list attributes | Inherited shapes (§3.1.2) |
| Counts-as ladders | Subclass hierarchy with roll-up (§3.3.5 contextual OLAP) |
| Four orders | Provenance context (§3.3, PROV) |
| `FieldEstimate` | An annotated value with its derivation |
| Temporal polarity | Temporal context: prospective vs retrospective validity |
| A missing Instagram boolean means "not loaded" | Open World Assumption (§3.1.1) |
| `removedTaskIds` tombstones | Negative knowledge kept so a union cannot resurrect (§4.1.2 negation, used operationally) |
| `item-merge.ts` | Identity consolidation (§8.1.3), destructive form |
| `people-sync.ts`, `name-resolve.ts`, `book-match.ts` | Entity matching and entity linking (§6.2.3, §8.1.3) |
| Workflows, implied actions, PenLinks, habit syncs | Rules with materialised heads (§4.3.1) |
| Observatory (Pearson r + n) | Inductive knowledge with support (§5) |
| Module list import, Instagram import, Letterboxd parse | Mappings from structured sources (§6.4) |
| Backup JSON | Dump (§9.2.1) |

---

## 4. The paper, chapter by chapter

Each part: what the paper says, then **Brain2 reading** (where it lands), then
the proposal ids it feeds.

### 4.1 Data graphs (§2.1)

- **Directed edge-labelled graph.** Nodes plus labelled directed edges. New data
  is new nodes and edges. Missing data is a missing edge. Cycles are fine. RDF
  standardises it with IRIs, literals, and blank nodes.
- **Heterogeneous graph.** Each node and edge has exactly one type, built into
  the model. Good for partitioning. Bad when a node has zero or many types.
- **Property graph.** Nodes and edges carry a label and property–value pairs.
  Translates to and from an edge-labelled graph without loss.
- **Graph dataset.** Several named graphs plus a default graph that can hold
  metadata about the others (when each was updated, where it came from).
- **Other models.** Hypernodes (nodes that contain graphs) and hypergraphs
  (edges over sets of nodes).
- **Stores.** A triple table, one table per property (vertical partitioning), or
  property tables per type.

**Brain2 reading.** Brain2 is a heterogeneous property graph: one `type` per
item, `attributes` on nodes, `stance` and `weight` on edges. The stores are a
dataset of named graphs with no default graph describing them. A list is a
hypernode (a node that holds items). An operation with phases and parts is a
nested graph. A painted block with several pens and a "Who?" variant is a
hyperedge. Feeds KG-D1–D6.

### 4.2 Querying (§2.2)

- **Basic graph patterns.** Patterns with variables, matched by mapping
  variables to terms. Homomorphism semantics lets two variables land on one node
  (SPARQL). Isomorphism semantics forbids it (Cypher on edges).
- **Complex patterns.** Relational algebra on top: projection, selection, join,
  union, difference, anti-join (not exists), left-join (optional). Bag vs set
  semantics (duplicates or DISTINCT).
- **Navigational patterns.** Regular path queries: inverse (`r⁻`), Kleene star
  (`r*`), alternation (`r1|r2`), concatenation (`r1·r2`). Results as shortest
  paths, simple paths, or node pairs.
- **Other features.** Aggregation, datatype filters, federation, updates, and
  queries under entailment.

**Brain2 reading.** `lib/search.ts` is keyword-only. Smart lists
(`list-membership-rules.ts`) are single-node selections (type, list, date,
attribute, tag, done). Formulas reach across items (`LOOKUP`, `COUNTIF`,
`ROLLUP` in `lib/formula.ts`) — a narrow join. Nothing walks paths. Feeds
KG-Q1–Q12.

### 4.3 Semantic schema (§3.1.1)

Classes, subclasses, subproperties, domain, and range give terms meaning.
`venue` is a subproperty of `location`; the range of `city` is City; so a node
used as a city is entailed to be a City. Semantic schemas assume the **Open
World**: a missing edge is unknown, not false. The **Closed World** treats the
data as complete. The **Local Closed World** says only marked parts are
complete.

**Brain2 reading.** `parentTypeId` is subclass. Relations have inverses but no
subproperties, no domain, no range. Brain2 already reasons open-world in places
(Instagram follow-back blanks, missing observations not drawn as zero in
`cross-section.ts`) and closed-world in others (a habit cell with no tick reads
as not done). That split is undeclared. Feeds KG-O1–O9.

### 4.4 Validating schema (§3.1.2)

Shapes target nodes (by class, by property, by query) and constrain them:
counts (`[1..*]`), datatypes, and links to nodes that must meet another shape.
Shapes inherit. **Open shapes** allow extra properties. **Closed shapes** do
not. Recursion plus negation can produce paradoxes, so semantics are
stratified. Validation can run after inference, which can mean relaxing counts.
SHACL and ShEx are the standards.

**Brain2 reading.** Zod schemas in `lib/data/schemas.ts` are syntactic and
`.passthrough()`. `ItemTypeRule` is closest to a shape. No surface lists which
items fail a type's expectations. Feeds KG-O10–O14, KG-QA3.

### 4.5 Emergent schema (§3.1.3)

A graph summary built from the data. Partition nodes by an equivalence (class,
shape, neighbourhood), merge each partition, keep edges between partitions: a
**quotient graph**. Every quotient graph *simulates* the data. A *bisimilar*
quotient also guarantees every member really has each edge, and preserves
forward path matches. Uses: an overview for people, help writing a schema,
indexing, integration.

**Brain2 reading.** `ItemTypesLibrary.tsx` lists types. It does not show how
types actually connect in the vault, or which members lack an edge the others
have. Feeds KG-O15, KG-V5.

### 4.6 Identity (§3.2)

- **Persistent identifiers** avoid clashes when graphs merge (DOI, ORCID, ISBN,
  country codes).
- **IRIs vs URLs.** Name the thing apart from the page about it, so "founded by"
  cannot attach to the webpage.
- **External identity links.** `sameAs` states two ids are one entity. Or
  ground identity with uniquely identifying facts (coordinates, a postcode).
- **Datatypes.** Typed literals can be ordered, parsed, compared.
- **Lexicalisation.** Opaque ids (Wikidata's Q codes survive a renamed country)
  plus labels, aliases, and descriptions, in several languages.
- **Existential nodes.** "These two events share a venue, not yet known." Blank
  nodes. Skolemising gives them stable labels.

**Brain2 reading.** Ids are stable and opaque (good). Titles are the label.
People have nicknames. Nothing else has aliases. `ItemLink.targetId` assumes an
item id, so an item cannot point at a pen, habit, day, or period. Two tag
identities coexist (`Item.tags` strings and `TrackTag` ids). Identity across
Instagram rows, People I Know, pens, and Telegram names is matched by name in
three different places. Feeds KG-I1–I12.

### 4.7 Context (§3.3)

Context is the scope in which a fact is true: when, where, according to whom.

- **Direct representation.** Treat context as data (dates on an event). Turn an
  edge into a node to annotate it. Standard vocabularies: the Time Ontology
  (instants, intervals, before, overlaps) and PROV (entities derived from
  entities, generated by activities, attributed to agents).
- **Reification.** Statements about statements: RDF reification, n-ary
  relations, singleton properties. A reified edge need not be asserted.
- **Higher-arity.** Named graphs (context on many edges at once), property
  graph edge attributes, RDF\*.
- **Annotations.** Temporal RDF (intervals on edges), Fuzzy RDF (degree of
  truth), Annotated RDF (semirings with *meet* to intersect contexts along a
  join and *join* to union alternative answers).
- **Contextual knowledge repositories.** Each subgraph takes a value on each
  context dimension. Each dimension is a partial order (`2020-03-22 ⪯ 2020-03 ⪯
  2020`). Contextual OLAP: slice, dice, roll up.

**Brain2 reading.** This is the richest overlap. Brain2 already has:
temporal context everywhere (period keys, `createdAt`, local-day keys),
provenance (`captureOrigin`, activity `source`, the four orders), a fuzzy degree
(`stance`, `weight`, `trust`, `certainty`), and a dimension partial order (day ⪯
week ⪯ month ⪯ season ⪯ year in `lib/period-keys.ts` and `lib/seasons.ts`).
What it lacks: context on *edges* (when a link began, who or what wrote it), and
one algebra that intersects and unions contexts in a query. Feeds KG-C1–C14.

### 4.8 Deductive knowledge (§4)

- **Interpretations.** The data graph is read as a *domain graph* of real
  entities. CWA vs OWA. Unique Name Assumption (two names are two things) vs
  No UNA (they might be one). OWL takes OWA and No UNA.
- **Individuals.** Assertions, `sameAs`, `differentFrom`, negated assertions.
- **Properties.** Equivalent, inverse, disjoint; transitive, symmetric,
  asymmetric, reflexive, irreflexive; functional, inverse-functional; keys;
  property chains (`venue·city ⇒ location`).
- **Classes.** Equivalent, disjoint, complement, union, intersection,
  enumeration; restrictions: some values, all values, has value, has self,
  cardinality, qualified cardinality. The paper warns that "all values" is true
  of nodes with no values at all.
- **Entailment.** One graph entails another when every model of the first is a
  model of the second. OWL uses if-and-only-if semantics.
- **Reasoning.** Full OWL entailment is undecidable. Practical choices: sound
  but incomplete rules (fast), decidable fragments (complete), or neither.
- **Rules.** Body pattern ⇒ head pattern, positive Datalog. **Materialisation**
  runs rules to a fixpoint and stores the results. **Query rewriting** expands a
  query instead (OWL 2 QL). Some rules (cyclic patterns, like "a flight within
  one country is domestic") cannot be written as ontology axioms.
- **Description logics.** A-Box (facts), T-Box (class axioms), R-Box (property
  axioms). Tableau reasoning is costly; fine for modelling, rare at scale.

**Brain2 reading.** Brain2 materialises many small rule sets, each in its own
file (connected lists, membership rules, PenLinks, habit syncs, implied
actions, event checklists, workflows). Each writes its head into a store. None
is described in one vocabulary, and none can be asked "why is this here?".
Feeds KG-R1–R12, KG-O4–O8.

### 4.9 Graph analytics (§5.1)

- **Centrality.** Degree, betweenness, closeness, eigenvector, PageRank, HITS,
  Katz. Betweenness on edges finds the edges many shortest paths depend on.
- **Communities.** Min-cut, label propagation, Louvain modularity.
- **Connectivity.** Density, k-connectivity, strongly and weakly connected
  components, spanning trees, minimum cuts. Finds brittle routes.
- **Node similarity.** Structural equivalence, random walks, diffusion kernels.
- **Path finding.** Simple, shortest, or label-constrained paths.
- **Frameworks.** Message passing: each node reads messages, computes, sends.
  PageRank as an iteration with damping 0.85.
- **Data on labelled graphs.** Four ways in: *projection* (pick a
  subgraph, drop labels), *weighting* (labels to numbers), *transformation*
  (lossy or lossless to a simpler graph), *customisation* (an algorithm that
  reads labels). Results change a lot with the choice.
- **With queries.** Queries pick the subgraph; analytics rank the results; the
  two can interleave (find what is unreachable once one route is cut).
- **With entailment.** Results differ before and after inference (an inverse
  edge flips direction). The paper asks for *semantically invariant* analytics
  that give the same answer on equivalent graphs.
- **Markov chains** over weighted transitions give steady states, recurrence,
  periodicity (footnote 21).

**Brain2 reading.** `DependencyGraph.tsx` and `critical-path.ts` do path work
on task dependencies. `TransitionsView.tsx` and `ContextSwitchHeatmap.tsx`
already look at sequences of pens. Nothing ranks items, lists, people, or pens
by how much of the vault they hold together. Feeds KG-A1–A14.

### 4.10 Embeddings and graph neural nets (§5.2, §5.3)

Embeddings put each node and relation in a low-dimensional vector space and
score edges for plausibility. Families: translational (TransE, TransH, TransR,
TransD, RotatE, MuRP), tensor decomposition (DistMult, RESCAL, HolE, ComplEx,
SimplE, TuckER), neural (SME, NTN, MLP, ConvE, HypER), language-model style
(RDF2Vec random walks fed to word2vec, KGloVe), and entailment-aware joint
models (KALE, RUGE, FSL). Graph neural nets learn transition and output
functions over neighbourhoods (recursive) or apply learned convolutions.

The paper names their limits: they do not explain themselves, and they fail on
unseen nodes until retrained (the out-of-vocabulary problem, §5.4).

**Brain2 reading.** Refused at runtime (law 3, and "predictive or ML
analytics" is out). Two narrow uses stay on the table for the person to decide
(section 11, and the idea bank in section 8): text similarity at install time for a module mapping, and duplicate
*suggestions* that never decide alone. Everything else in this file is
symbolic or counted.

### 4.11 Symbolic learning (§5.4)

- **Rule mining.** Find rules whose entailments are mostly observed edges.
  **Support** counts confirmed entailments. **Confidence** is the share
  confirmed. Under the Partial Completeness Assumption, an absent edge counts as
  negative only if the subject has some other value for that property.
- **AMIE.** Start from a head, add body edges (fresh variable, constant, or two
  existing variables), prune when support drops below the floor, keep rules
  closed (every variable in two edges) and safe.
- **Exceptions.** Non-monotonic rules with a negated body edge ("…unless the
  airport is international").
- **Better negatives.** Use shapes or cardinalities to know where the data is
  complete; use disjointness to get certain negatives.
- **Differentiable rule mining** (NeuralLP, DRUM) learns path rules with
  matrices. Refused here (learned weights).
- **Axiom mining.** Disjointness from classes that rarely share members;
  DL-Learner finds a class description that separates positive from negative
  examples, scored by count queries.

**Brain2 reading.** This is the inductive family that fits the house. Support
and confidence are counts with an `n`. A mined rule is readable and the person
can accept or ignore it. Feeds KG-L1–L10.

### 4.12 Creation and enrichment (§6)

- **Human collaboration.** Editors add facts or verify extracted ones. Costs:
  error, disagreement, bias.
- **Text.** Tokenise, part-of-speech, dependency parse, word-sense
  disambiguation; named entity recognition (rules and gazetteers still used for
  predictability); entity linking (aliases matter; disambiguate with context, a
  prior, and centrality); relation extraction (closed set, or open extraction
  later aligned to known relations); n-ary relations from frames ("named" has a
  namer, a thing, a name, a time).
- **Markup.** Wrappers, web tables (classify, normalise, find the protagonist,
  link cells), Deep Web forms.
- **Structured sources.** A *direct mapping* turns each table cell into an edge
  (row, column, value), with foreign keys as links. A *custom mapping* (R2RML)
  uses templates and queries. Materialise (ETL) or virtualise (rewrite queries
  over the source). JSON-LD maps JSON. Pull subgraphs from other knowledge
  graphs and align ids.
- **Ontology engineering.** Agile methods. DILIGENT keeps local views apart from
  a reviewed global core. **Competency questions** are the requirements, then
  the tests. **Ontology design patterns** are reusable shapes (the Core Event
  pattern: where, when, sub-events, participants).
- **Ontology learning.** Term extraction (unithood, termhood); subclass axioms
  from noun phrases and Hearst patterns ("discounts such as off-peak rates").

**Brain2 reading.** Brain2 is a strong creator: Telegram ingest
(`lib/ingest/`), smart-parse, Apple/iPhone notes, receipts, OCR, GPS, Instagram
and Letterboxd imports, module list import, PDF to HTML, screen time. It
extracts mostly by deterministic rules and gazetteers (habit, pen, and
operation names in `name-resolve.ts`), which is exactly what the paper says is
still chosen for predictability. Missing: a shared alias table, mention→node
linking beyond pens and habits, and mapping files for imports. Feeds
KG-N1–N14.

### 4.13 Quality (§7)

| Dimension | Sub-dimension | Metric idea |
|---|---|---|
| Accuracy | Syntactic | Share of malformed values per property |
| | Semantic | Check against other sources; precision of each extractor |
| | Timeliness | How often each source refreshes; temporal annotations |
| Coverage | Completeness (schema, property, population, linkability) | Share of missing values; share of nodes with links |
| | Representativeness | Compare distributions with known ones; bias checks; Benford |
| Coherency | Consistency | Count contradictions per axiom |
| | Validity | Count shape violations per constraint |
| Succinctness | Conciseness (intensional, extensional) | Share of schema and data relevant to the domain |
| | Representational conciseness | Duplicate nodes, duplicate properties, needless reification |
| | Understandability | Share of nodes with labels and descriptions; label uniqueness |

**Brain2 reading.** `vault-guard.js` and `vault-coverage.test.ts` protect the
vault from loss. `needs-attention.ts` finds stale and blocked work. Nothing
measures the graph's own quality. Feeds KG-QA1–QA12.

### 4.14 Refinement (§8)

- **Completion.** General link prediction, type prediction (a classification
  from a node's edge labels), identity prediction (value matchers compare
  fields, context matchers compare neighbourhoods; *blocking* and *windowing*
  avoid comparing every pair; confident pairs are *consolidated* onto one
  canonical node).
- **Correction.** *Fact validation* scores an edge against sources. Fact
  finders build a source–fact graph and compute source trust and fact
  plausibility together (Sums, Average·Log, Investment). *Inconsistency repair*
  picks edges to remove using minimal explanations and source trust, or answers
  queries only with what every repair agrees on.

**Brain2 reading.** `item-merge.ts` consolidates by hand. `belief-strength.ts`
already computes fact plausibility from trust-weighted sources, one direction
only. Feeds KG-F1–F10.

### 4.15 Publication and usage control (§9)

- **FAIR.** Findable (persistent ids, rich metadata, indexed), Accessible
  (standard protocol; metadata survives the data), Interoperable (shared
  formalism and vocabularies, qualified references), Reusable (license,
  provenance, community standards).
- **Linked Data.** Name things with IRIs that resolve to useful data, and link
  to related things. Keep the entity id apart from the document id.
  *Link discovery* finds links across graphs with handwritten linkage rules;
  shared ids (ISBN, Wikidata) make it easy.
- **Access protocols**, cheap to costly: dumps (plus diffs), node lookups, edge
  patterns (with pagination and batched joins), graph patterns.
- **Usage control.** ODRL licenses (permissions, duties, prohibitions).
  Usage policies (who may run which process on which subgraph for what
  purpose). Encryption of single nodes or edges. Anonymisation: k-anonymity,
  l-diversity, neighbourhood attacks, k-degree, k-isomorphic neighbourhoods,
  k-automorphism; ε-differential privacy for aggregate queries.

**Brain2 reading.** Brain2 publishes to one person and a phone hub. Its
"publication" is backup, module export, the sync hub, and the Telegram bot.
Usage control still matters: friend-facing views, shared module blueprints
(GS-6 already strips personal bodies), and screenshots of a personal vault.
Feeds KG-P1–P12.

### 4.16 Knowledge graphs in practice (§10)

- **DBpedia, YAGO.** Extracted from Wikipedia infoboxes and categories. YAGO
  canonicalises (one id per thing, duplicates removed) and type-checks.
- **Freebase.** Human edits. A loose typing system that let incompatible types
  coexist instead of forcing consistency.
- **Wikidata.** Opaque ids, labels and aliases in many languages, claims that
  cite sources, contradicting claims kept side by side, shapes and lightweight
  axioms edited by the community.
- **Enterprise trends.** Many sources, very large, refinement matters,
  freshness matters, ontology plus machine learning, lightweight taxonomies.
  Search moved to "things, not strings": the Knowledge Panel shows the entity a
  query is about.

**Brain2 reading.** Freebase's loose typing is Brain2's catalog types:
seeded, user-editable, allowed to disagree. Wikidata's "keep both claims with
their sources" is the belief graph. The Knowledge Panel is item detail. Feeds
KG-V1, KG-X1, KG-I8.

### 4.17 Future directions (§11)

Formal semantics for property graphs. Reasoning and querying over context.
Similarity-based query relaxation. **Shape induction** (mine constraints from
the data). Contextual embeddings that vary with time and place.
Entailment-aware learning. Better rule and axiom mining. General challenges:
scalability, quality of data *and* models, diversity of context and modality,
dynamics (temporal, streaming), and usability.

**Brain2 reading.** A personal vault is small, temporal, streaming (phone,
GPS, screen time), and multimodal (photos, PDFs, voice). Usability is the
whole product. Shape induction and contextual reasoning fit the house without
any model. Feeds KG-O14, KG-C11, KG-X16.

### 4.18 The practitioner's guide [BW]

_Last mapped: 2026-10-16_

[H] is the survey. [BW] is the workshop manual. It adds little theory and a
lot of shape: how a graph earns its keep in a running system. Where it repeats
[H], this section skips it.

**BW ch.1–2 · Organizing principles.** A graph becomes a knowledge graph when
it carries an *organizing principle*: rules that let a person or a program read
it without the code that wrote it. Without one, the meaning lives in queries
and leaves when their author does. The principle is a **contract** between the
graph and every tool that reads it. Layers, from weak to strong: plain graph →
property graph (labels, typed directed edges, properties) → taxonomy
(broader/narrower) → ontology (part-of, compatible-with, depends-on, upsell,
with traits like transitive and symmetric) → layered ontologies that bridge
several taxonomies. Several taxonomies can classify the same nodes at once,
and classification is *dynamic*: a product sits in "Black Friday · half price"
this week and "high-end audio" next month, because a category link is just
data. The advice is **just-enough semantics**: model what a use needs now,
version it, and add more when a use asks. Overbuilding the ontology up front is
named as a common, costly mistake. Standards (schema.org, SKOS, Dublin Core,
SNOMED) are worth adopting where they fit; RDF is a good wire format and a poor
reason to pick a storage model. A property graph is "schema-ish": constraints
only where needed.

*Brain2 reading.* The house already has a contract (`lib/types.ts`,
[`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md)), but the meaning of each sync
rule lives in its file. Lists are dynamic classification already (membership
rules on a clock). "Just-enough semantics" is the house's "do not overbuild"
under another name, and it argues for KG-O1 as a small file, grown by use.
Feeds KG-PT1–PT4, KG-O1.

**BW ch.3 · Graph databases.** Labels group nodes and speed lookups. Direction
is stored once and walked both ways at the same cost. Query cost tracks how
much of the graph a query touches, not how big the graph is (index-free
adjacency). Walk structure first, read properties last. *Graph-local* queries
start at a known node and are cheap. *Graph-global* queries scan everything and
belong on a schedule. **MERGE** writes a pattern only if the whole pattern is
absent, and a **node key** constraint (city + country) stops duplicate nodes
at the door. EXPLAIN and PROFILE show the plan before and after running.

*Brain2 reading.* The vault is small enough to hold in memory; the edge view
(KG-D1) can keep adjacency maps per predicate and stay local-first. Merge-on-
key is what `people-sync.ts` does by name and what ingest needs for every
capture door. Feeds KG-ER1, KG-D14, KG-Q13.

**BW ch.4 · Loading data.** Draw the model, map columns onto it, preview, then
load. Start with a small slice. Irregular rows are normal; set only the
properties a row has. Split nodes and edges into separate files with one header
each. Batch large writes. Keep the generated mapping in source control so it
can evolve.

*Brain2 reading.* Every importer (Instagram, Letterboxd, module list import,
spreadsheet paste) is a hand-written mapping. [BW]'s data-importer idea is a
visual mapping screen whose output is a stored, editable mapping (KG-N5). A
preview on a ten-row slice before the full import is a Win95 dialog the house
already likes. Feeds KG-N5, KG-X17.

**BW ch.5 · Integration.** A *data fabric*: the graph is a curated index over
other systems, holding *golden records* for the entities that matter. Records
can stay where they are and be fetched at query time as **virtual nodes**
(SQL, CSV, JSON APIs, document stores), mixed with stored nodes. A **digital
twin** keeps topology in the graph and pulls fast-changing metrics on demand.
Federation joins several graphs behind one query. Change streams publish
matches of a query on an interval ("new arrivals in Berlin every 5 s") and
ingest messages through a merge.

*Brain2 reading.* Brain2 is a digital twin of one life. Topology (items,
lists, people, places, pens) lives in the vault. Fast or external readings
(weather `home-weather.ts`, tides `tide-client.ts`, sun times, lunar phase,
flight lookups, screen time) can be **virtual nodes** read on demand and never
stored, unless the person pins one. The Telegram bot is already a change
stream; a "standing pattern" that messages when it matches is the publish half
(KG-X18). Feeds KG-D15, KG-M1.

**BW ch.6 · Graph data science.** Three kinds of algorithm: statistical
(counts, degree distribution), analytical (patterns over the whole graph), and
learned. Five families matter most: network propagation, influence
(centrality), community detection, similarity, link prediction. Work in four
steps: **project** a subgraph into memory, **load**, **run**, then **stream**
(show only), **mutate** (keep in the projection), or **write** (store on the
graph). Different algorithms disagree (WCC vs Louvain); try more than one.
Results can be counterintuitive: the busiest rail station was not the most
central one, because centrality counted track, not passengers. Run heavy
analytics on a secondary so writes stay fast.

*Brain2 reading.* Stream / mutate / write maps onto the four orders: stream is
a derived view, write would make it a stored derived value with an est. mark,
and the house prefers stream. The rail lesson is KG-A11 (name the projection
and the weighting on every chart). A worker thread is the "secondary".
Feeds KG-A11, KG-A15–A17.

**BW ch.7 · Graph-native machine learning.** In-graph prediction of missing
edges and labels, and graph features for outside models. Simple topological
link scores (preferential attachment, common neighbours, triangles) need no
training. Pipelines add embeddings and a classifier. Results can be written
back as relationships (`SHOULD_ACT_WITH`) and refreshed on a schedule. The
model and the graph sit in a feedback loop.

*Brain2 reading.* The topological scores are counts and fit KG-F1. Learned
pipelines are refused (law 3, "predictive or ML analytics"). A suggested link
is never written as a relationship of its own kind; it waits in the weekly
review. Feeds KG-F1, KG-A7.

**BW ch.8 · Metadata knowledge graphs.** A map of datasets, the tasks and
pipelines that transform them, and the sinks (dashboards, model inputs) that
consume them, with owners and glossary terms. It answers *lineage* (where did
this number come from?), *impact* (what breaks if this task fails?), and
*popularity* (which datasets are used most?). Data and metadata can sit in one
graph, so a domain answer can come with its provenance.

*Brain2 reading.* This is the missing map of Brain2's own machinery. Stores
are datasets. Sync files (`habit-*-sync.ts`, `list-links.ts`,
`list-membership-rules.ts`, `entry-links.ts`, `people-sync.ts`,
`implied-actions.ts`, `points-*`, workflows) are tasks. Home squares, Data
views, and the Telegram replies are sinks. A lineage graph answers "why is
this habit cell 4?" and "what will change if I delete this pen?". Feeds
KG-M1–M8.

**BW ch.9 · Identity knowledge graphs.** Entity resolution in three acts:
prepare (normalise types, units, names, dates; build blocking keys), match,
and persist master entities. The matching recipe: (1) a `SAME_AS` edge for a
shared **strong identifier**; (2) a weighted `SIMILAR` edge for a **weak
identifier** above a threshold; (3) drop `SIMILAR` where a strong identifier
disagrees; (4) nudge the weight up or down with **non-identifying** features;
(5) drop what falls below the floor. Then connected components over `SAME_AS ∪
SIMILAR` are the master entities, each a *golden record* linked to its source
records, rebuilt as deltas arrive. Token overlap (Jaccard over words) beats raw
string distance for messy titles. Graph features (degree, neighbours) help
matching.

*Brain2 reading.* This is a clean recipe for people, places, books, films, and
captures. The golden record is not a new noun: it is a read-time grouping
(KG-I4) with one survivor chosen as the display record. Feeds KG-ER1–ER8.

**BW ch.10 · Pattern detection.** Check the graph's shape against what it
should look like (one community per customer; more people than communities
means shared identifiers). Sample the odd subgraphs. Name *positive* patterns
(a household sharing an address and a phone) and *negative* ones (a ring of
shared identifiers). Check small, local patterns on every write and run wide
patterns on a schedule. Skills come from time spent on projects that used them,
plus recency. A peer graph of who worked well together shapes teams. Rollups
of outcomes by manager chain show structural trouble.

*Brain2 reading.* "Expected shape vs actual shape" is a cheap quality probe
(KG-PT5). Skills-from-time is directly Brain2: competence and practice read from
painted minutes on pens, by recency (KG-PT7). Outcome rollups by chain read as
"misses by list, by goal, by operation phase" (KG-PT8). Feeds KG-PT5–PT10.

**BW ch.11 · Dependency knowledge graphs.** A dependency graph is a directed
acyclic graph. Qualify edges with strength (a share, a capacity) and temporal
validity, and query "as of t". Multidependency has two meanings. **Additive**:
the parent's impact is the weighted sum of its children's (a portfolio, bonded
links). **Redundant**: the parent fails only if all children fail (`min`), or
fewer than a **threshold** survive (a quorum). Analyses: impact scope (every
node downstream of a failure), impact with semantics, **single point of
failure** (several chains converge on one node), and **root cause** (which
upstream node best explains a set of symptoms, ranked by precision, recall, and
F-score). Validations: no cycles; additive shares sum to 100%; consumption does
not exceed production; a redundant set has at least its threshold.

*Brain2 reading.* Brain2 is full of dependency graphs: tasks (`blocks`,
`critical-path.ts`, `prereqs.ts`), goals and objectives, operations and phases,
habits fed by other habits, event checklists, and the day's time budget. The
additive/redundant split is new to the house and answers real questions: "this
goal needs *any one* of these three routes" vs "this goal is 40% this habit and
60% that one". Feeds KG-DEP1–DEP12.

**BW ch.12 · Semantic search and similarity.** Extract entities from text
("things, not strings"), weight each mention by *salience*, link documents to
entities, and you get: what a document is about, which documents mention an
entity, entity trends over time, and explainable "similar documents" (sum of
shared salience, listing the shared entities). Cold start: show what is
trending. Link entities to an organizing principle (a concept scheme) so a
search for a broad term finds documents that only name a narrow one.
Disambiguation can use keyword or regex lists attached to each concept, plus a
tie-break by context.

*Brain2 reading.* Docs, notes, saved links, Telegram text, and PDFs become
searchable by the people, places, lists, and items they mention, with the shared
entities as the explanation. A broad list or tag finds items filed under its
narrower ones (KG-PT2). Keyword lists per concept are exactly the house's log
keywords and pen names. Feeds KG-N1, KG-NL1, KG-X19.

**BW ch.13 · Talking to the graph.** Three ways language meets a graph: text
as a *source* of facts (fact extraction gives subject–property–value with
evidence spans and confidence), the graph as *context* for language tasks, and
text *generated* from the graph. A rule-based matcher (patterns over tokens,
lemmas, parts of speech) turns questions into graph queries; the graph's own
schema plus a few annotations ("write" ↔ `WROTE`) drive it. Generation without
any model: a generic query reads each edge as subject–predicate–object, and an
ontology annotated with how to name each node, plus a *direct* and an
*inverse* phrase per relation (and long/short forms with `$s` and `$o` slots),
turns any node into readable sentences. A lexical graph (WordNet: forms →
senses → concepts, with hypernyms) gives path, Leacock–Chodorow, and
Wu–Palmer similarity, and can be extended with the person's own terms. Fact
extraction needs a closed relation list or relations proliferate.

*Brain2 reading.* `RELATIONS` already stores a forward and an inverse label.
That is most of a sentence generator. BIM already has a rule-based grammar
(`lib/ingest/parse-message.ts`, `command-catalog.ts`). KG-NL turns both into
"say what the vault knows about X" and "answer simple questions" with no model.
Feeds KG-NL1–NL8.

**BW ch.14 · Knowledge lakes.** Graphs start per use, then join through shared
ontologies, then become a foundation many systems build on. A knowledge lake
is a curated, general graph beside the raw data lake, giving the raw data its
meaning after the fact.

*Brain2 reading.* The stores are the lake (raw, fast, per room). The vault
edge view plus the vocabulary is the knowledge lake: one curated lens every
room can read. That is Expansion E1 and E2 in one line.

### 4.19 Knowledge graphs and language models [KL]

_Last mapped: 2026-10-16_

The pasted summary makes five claims:

1. Graphs and language models cover each other's gaps. Models help **build**
   graphs (extract entities and relations from text, map structured data) and
   **query** them (turn a question into a query, phrase the answer). Graphs
   **ground** models with current, private, checkable facts, which reduces
   invented answers and gives an explanation path.
2. Knowledge encoded once in the graph serves many tasks. Updating a fact does
   not need retraining a model.
3. Four pillars of a modern knowledge graph: **evolution** (the structure keeps
   growing), **semantics** (typed entities, meaningful relations),
   **integration** (structured and unstructured, many sources), **learning**
   (people, reasoning, and machine learning all work over it).
4. Two technologies: RDF (statements, strong interoperability, SPARQL) and
   labelled property graphs (traversal, path finding, Cypher/Gremlin). They can
   complement each other.
5. Taxonomies and ontologies are the semantic metadata that make a plain graph
   smart.

*Brain2 reading.* Pillars 1–3 are the house's two laws and the "isolation is a
bug" rule. Pillar 4 is where the house draws a line: people and reasoning yes,
runtime learning no, with narrow exceptions the person must approve (section
8). Claim 1 is the strongest argument for building the graph *before* adding
any model: a model is only as honest as the facts it is pinned to. The house
storage stays plain JSON; RDF/JSON-LD is the export format (KG-P2), and the
edge view is a property graph.

---

## 5. Proposals

_Last mapped: 2026-10-27_

Every proposal is **Planned** except the partial landings in the register.
Each names the paper section, the files it would touch, and the law it must
clear. Families:

| Prefix | Family | Count |
|---|---|---|
| KG-D | Data model | 15 |
| KG-O | Schema and ontology | 15 |
| KG-Q | Query | 13 |
| KG-R | Reasoning | 12 |
| KG-I | Identity | 12 |
| KG-C | Context and time | 14 |
| KG-A | Graph analytics | 17 |
| KG-L | Symbolic learning | 10 |
| KG-N | Creation and ingest | 14 |
| KG-QA | Quality | 12 |
| KG-F | Refinement | 10 |
| KG-P | Publication and privacy | 12 |
| KG-V | Visual design | 16 |
| KG-X | Features and flows | 20 |
| KG-M | Lineage and metadata ([BW]) | 8 |
| KG-DEP | Dependencies and impact ([BW]) | 12 |
| KG-ER | Entity resolution ([BW]) | 8 |
| KG-PT | Patterns and taxonomies ([BW]) | 10 |
| KG-NL | Natural language without a model ([BW]) | 8 |

### Landed in part, 2026-10-27

| Id | What a person can call | Still not built |
|---|---|---|
| KG-D1, KG-D2, KG-D10, KG-D11 | `lib/graph/vault-graph.ts` `projectVault`. Blocks, completions, captures, spans, reviews. Addresses `day:`, `week:`, `month:`, `season:` (calendar quarter), `year:`, `block:`, `pen:`, `item:`, `message:`. | The rest of the stores. Habit cells. GPS name file. Full attribute and list hyperedges (KG-D3–D9, D13–D15). |
| KG-D12 | Applied ingest events as `message:` nodes with `produced`. | A Telegram event is not "messaged this person". |
| KG-C1 | `nested-in` from day up to year. `peopleDuring` meets block minutes. | The rest of KG-C. |
| KG-I4, KG-I6 | `same-as` / `different-from` in `RELATIONS`. `lib/graph/identity-match.ts` proposes. Accept in the graph inbox writes a recorded `same-as`. Dismiss stays a dismissal. | No automatic merge. `same-as` groups are not folded on every query. Tag identity and external ids stay planned. |
| KG-Q1, KG-Q5 | `lib/graph/pattern-questions.ts`. One triple `? s p o` with `*`, plus the house questions. Cmd-K shows triples and a template sentence. | Variables, paths, optional, aggregates, saved patterns. |
| KG-NL2, KG-NL3 | Template sentences in that same module and in Cmd-K. | BIM, read-aloud, a full phrase table per predicate. |
| KG-M2, KG-M3 | `lib/graph/machinery.ts` `whereFrom` and `whatReadsThis`. Shown under the weekly graph review. | Delete-confirm chrome. A row for every store key (KG-M1 stays planned). |
| E3 | Observation addresses count in `lib/belief-strength.ts` at trust 1. `evidenceMissingFromSpine` lists addresses the spine no longer has. The belief is not rewritten. | No `formulation` type (GS-5 is still planned). Beliefs are the records that carry evidence links. |

### 5.1 Data model (KG-D)

**KG-D1 · The vault edge view.** **Landed in part, 2026-10-27** — see the register. A pure `lib/graph/vault-graph.ts` that reads
every store and yields one list of triples: `{ s, p, o, graph, order, at? }`.
Every row in §3.1 becomes a predicate (`member-of`, `connected-to`,
`nested-in`, `filed-in`, `blocks`, `part-of`, `ref:<attrId>`, `type`,
`painted-with`, `counts-as`, `always-means`, `tagged`, `feeds-habit`,
`checklist-of`, `captured-by`, …). `graph` is the store key it came from.
Nothing is written. This is the paper's *virtualisation* (§6.4.1): a graph view
over the legacy stores, so updates never need propagating. Wave 10 open item 2
("habits, sleep, minutes, and plan prose stay fast projections of Items") is
the same idea from the other side. Law: one write door (read only).

**KG-D2 · Node addresses for non-item records.** **Landed in part, 2026-10-27** — day, week, month, season, year, block, pen, item, message. A prefixed id scheme the
edge view and every graph surface share: `item:<id>`, `list:<id>`,
`folder:<id>`, `type:<id>`, `pen:<id>`, `scope:<id>`, `tag:<normalized>`,
`habit:<id>`, `event:<id>`, `goal:<id>`, `objective:<id>`, `review:<key>`,
`day:2026-10-16`, `week:2026-W42`, `month:2026-10`, `season:2026-Q3`,
`year:2026`, `place:<cluster id>`, `count:<id>`, `module:<id>`. Days and
periods become the hubs that tie autologged data together (Expansion E1).
No record is created for a day. Law: Item is the only noun (addresses, not
nouns).

**KG-D3 · Let `ItemLink.targetId` hold an address.** Accept the KG-D2 prefixes
in `targetId` so an item can link to a habit, a pen, a goal, or a period. Bare
ids stay item ids (no migration). `getBacklinks` learns to index addresses.
Paper: §3.2.1 (persistent identifiers). Files: `lib/links.ts`,
`lib/task-store.ts`, `lib/data/schemas.ts`.

**KG-D4 · Fold task edges into links.** Move `Task.dependencies` and
`parentTaskId` onto `blocks` / `blocked-by` and `part-of` / `has-part`, as the
header of `lib/links.ts` already plans. Scheduler and `critical-path.ts` read
links. One persist bump. Paper: §2.1 (one model, not two). Lane: Item.

**KG-D5 · Item-valued attributes as edges.** In the edge view, an attribute
whose definition has `refListId`, `optionSource: "list"`, or an item picker
emits `ref:<attrId>` edges, labelled with the attribute name. Formulas that
`LOOKUP` across lists then have a graph to stand on. Paper: §6.4.1 (foreign
keys become links in a direct mapping).

**KG-D6 · The default graph.** One metadata record per store, read at boot:
its key, persist version, last write time, record count, and where its records
came from (typed, phone, import, sync). Shown in Settings → Data and used by
the quality page. Paper: §2.1.4 (the default graph describes the named
graphs). Files: `lib/data/backup.ts` (`previewBackup` already counts),
`lib/storage-keys.ts`.

**KG-D7 · Edge identity.** An `ItemLink.id` exists. Make it the address of the
edge (`link:<id>`) so the ledger, a formulation (idea #77), or a review can
point at one edge. Paper: §3.3.2 (an edge needs an id before context can
attach). No new field.

**KG-D8 · Literal types on attributes.** Map `AttributeType` to a small set of
datatypes in the edge view (`date`, `datetime`, `duration-min`, `money`,
`percent`, `int`, `float`, `bool`, `text`, `url`) so queries can compare and
order. Paper: §3.2.3. File: `lib/attribute-type-catalog.ts`.

**KG-D9 · Lists as hypernodes.** Let a list be the subject of edges about the
whole set ("Reading list · for 2027", "Gift ideas · for person X"). Today list
facts live in list settings. The edge view emits them as `list:<id>` edges.
Paper: §2.1.5 (hypernodes).

**KG-D10 · Blocks as n-ary events.** **Landed in part, 2026-10-27** — pen, who, and place on the block. Read a painted block as one event node
with qualifiers: pen, secondary pens, variant answers ("Who?"), scope, minutes,
counts-as chain. That is a neo-Davidsonian event (§6.2.4): one existential
event with roles. Lets queries ask "blocks where Who = Ian and Location = Ocean
Beach". File: `lib/tracking-summary.ts` (read side only).

**KG-D11 · Completions as events.** **Landed in part, 2026-10-27** — `completed-on` only. Same treatment for a completion: the item,
the tier or grade (GS-9), the `timeLogs` slice, the Done day, the habit cells
it fed, the points row. Today those are five records in four stores joined by
code. Paper: §3.3.1 (turn the relation into a node).

**KG-D12 · Messages as events.** **Landed in part, 2026-10-27** — applied events, plus iPhone text and call blocks as `messaged`. Each applied Telegram message becomes an
event node with `captured-by`, `produced` (the items and blocks it wrote), and
`sent-at`. The applied-message log in `brain2-ingest-store` already holds the
join. Paper: §3.3.1 PROV (an activity generated entities).

**KG-D13 · Ordered lists of members.** Where order matters (steps, ritual
sections, a queue), the edge view emits `next` edges or an index qualifier, not
a linked list of blank nodes. The paper warns that linked lists are often
needless (§7.4.2). Files: `lib/todo-steps.ts`, `lib/rituals.ts` (read side).

**KG-D14 · A triple cache, not a store.** If the edge view is slow, cache it
in memory per store revision (`contentRev`, `appearanceRev` patterns already
exist) with three indexes: by subject, by predicate, by object (the paper's
triple table plus vertical partitioning, §2.1.6). Never persisted. Law: no
second store.

### 5.2 Schema and ontology (KG-O)

**KG-O1 · One house vocabulary file.** `lib/graph/vocabulary.ts`: every
predicate the edge view can emit, with label, inverse, inverse label, domain,
range, and traits. `RELATIONS` in `lib/links.ts` becomes the item-to-item part
of it. Paper: §3.1.1, §4.1.3. This is the T-Box and R-Box (§4.3.2).

**KG-O2 · Domain and range on relations.** `RelationDef.domain?` and `range?`
as type ids (and KG-D2 address kinds). The link picker in
`RelatedItemsPanel.tsx` offers only legal targets. A link outside its range is
*not* refused: it is listed on the quality page (open world, §3.1.1). Example:
`supported-by` ranges over Source; `checklist-of` over events.

**KG-O3 · Subproperties.** `subPropertyOf` on relations: `blocks` ⊑ `related`,
`part-of` ⊑ `related`, `phase-of` ⊑ `part-of`, `checklist-of` ⊑ `part-of`,
`supported-by` ⊑ `evidence-for`. A query for `related` finds all of them.
Paper: Table 2.

**KG-O4 · Property traits.** `transitive` (`part-of`, `subgoal-of`,
`counts-as`, `nested-in`), `symmetric` (`related`, `same-as`), `asymmetric`
(`blocks`), `irreflexive` (`blocks`, `part-of`), `functional` (`phase-of`: one
operation per phase). Readers use them; nothing rewrites data. Paper: Table 4.

**KG-O5 · Property chains.** Declared chains computed on read:
`part-of · action-of ⇒ serves-goal` (a part of an operation that serves a goal
serves it too); `painted-with · counts-as* ⇒ counts-toward`;
`member-of · list-feeds-habit ⇒ feeds-habit`. Paper: §4.1.3 chains.

**KG-O6 · Disjointness.** Declared pairs that cannot share a member: the
`missed` and `done` statuses already behave this way; `Alone` vs a person pen
in the same minute; a list marked "Archive" vs "Now". A shared member shows on
the quality page as an inconsistency (§7.3.1), never an error dialog.

**KG-O7 · Keys.** Declared identifying attributes per type: Book (ISBN, or
title + author), Film (Letterboxd URI, or title + year), Person (Instagram
username), Place (rounded coordinates), Flight (number + date). Two items with
the same key are `same-as` candidates (KG-I4). Paper: §4.1.3 (keys entail
identity without UNA).

**KG-O8 · Defined classes as smart lists.** A smart list *is* an OWL defined
class (§4.1.4): intersection (all rules), union (any rule), complement (not on
list), has-value (attribute = x), some-values (has a link of relation r to a
member of list L), cardinality (at least n links). Grow
`list-membership-rules.ts` with the two graph conditions it lacks:
`has link r to L` and `count of links r ≥ n`. Watch the paper's trap: an
"all values" rule must not admit items with no values.

**KG-O9 · Local closed world, declared.** A list or a store can be marked
**complete for a range** ("My flights 2026 are all here", "Sleep is logged for
every night of September"). Inside that claim, an absent edge reads as *no*;
outside it, as *unknown*. The habit grid already acts closed-world; this makes
it a stated, visible choice. Paper: §3.1.1 LCWA. Data uses it to choose
between "0" and "no reading" (`cross-section.ts` already refuses to draw
missing as zero).

**KG-O10 · Shapes per type.** `ItemTypeDefinition.shape`: attribute counts
(`isbn [0..1]`), required links (`Belief · supported-by|refuted-by [1..*]`,
`Goal · objective-of [1..1]`, `Operation · has-phase [1..*]`), and the shape the
target must meet. Open shapes by default. Validation runs after the reasoner
(§3.1.2, validation over inferences). Never blocks a save.

**KG-O11 · Shapes for lists.** A list can carry a shape its members are
checked against ("Reading list: every item has an author and a status"). This
is the list half of type ∪ list attribute composition, now with counts.

**KG-O12 · Shapes for non-item graphs.** A shape for a day node ("a logged
day has a sleep row, ≥ 1 painted hour, and an evening review") lets the vault
answer "which days are complete?" without new records. Feeds KG-O9.

**KG-O13 · Shape library as design patterns.** Ship a few house patterns as
templates (§6.5.1 ontology design patterns): *Event* (where, when, who,
sub-events), *Evidence* (claim, sources, stance, trust), *Enterprise*
(operation, phases, parts, resources, goal), *Relationship* (person, met,
interactions, gifts), *Habit loop* (cue tag, action, cell, points). Module
templates (`lib/module-templates.ts`) pick from them.

**KG-O14 · Shape induction.** Count, per type, how often each attribute and
relation is present. Offer "92% of your Books have an author. Make author
expected?" in the weekly review. Accepting writes the shape. Paper: §11 shape
induction; §3.1.3 emergent schema helping write a validating one.

**KG-O15 · The emergent schema.** Compute a quotient graph of the vault: one
box per type (and per pen root, per list folder), one edge per predicate that
links members of two boxes, labelled with a count. Then split a box when its
members differ in an edge (the bisimilar version) so "Books with an author" and
"Books without" show as two boxes. Shown in KG-V5. Paper: §3.1.3.

### 5.3 Query (KG-Q)

**KG-Q1 · Pattern syntax.** **Landed in part, 2026-10-27** — one triple and `*`, in `pattern-questions.ts`. A tiny, deterministic pattern language over the
edge view: `?b type Book · ?b supports ?x · ?x type Belief`. Variables start
with `?`. Names resolve through titles and aliases (KG-I2). Homomorphism
semantics by default; `distinct` for set semantics. Pure, in
`lib/graph/pattern.ts`, tested with fixtures. Paper: §2.2.1.

**KG-Q2 · Paths.** `part-of*`, `counts-as+`, `(blocks|part-of)*`,
`^supported-by` (inverse), `member-of·filed-in`. Results return node pairs and
the shortest witness path for display. Paper: §2.2.3.

**KG-Q3 · Optional and not-exists.** `optional ?b author ?a` and
`not ?b member-of "Finished"`. Paper: §2.2.2 left-join, anti-join. This alone
covers most "what is missing" questions.

**KG-Q4 · Aggregates.** `count`, `sum`, `avg`, `min`, `max`, `group by`, over
literal values and minutes. Paper: §2.2.4. Reuses `lib/formula.ts` arithmetic.

**KG-Q5 · Patterns in Cmd-K.** **Landed in part, 2026-10-27** — `?` and the house questions. Node lookup stays. A leading `?` in `GlobalSearch.tsx` switches
from keyword to pattern. Results show as a small table with the witness path
per row. Paper: §9.2.4 graph-pattern access, here local.

**KG-Q6 · Save a pattern as a smart list.** A pattern with one projected item
variable can become a list membership rule (`membershipRulesSync` on). The
list is now a stored query, like a SPARQL CONSTRUCT that writes membership.
File: `lib/list-membership-rules.ts`.

**KG-Q7 · Pattern as a module view.** A module view kind `pattern` that binds
a saved pattern and shows its table, chart, or graph. Module records stay Items
(the view is layout, not data). File: `lib/module-definitions.ts`.

**KG-Q8 · Pattern as a workflow condition.** A workflow condition "this item
matches pattern P" (`lib/workflow-engine.ts`). Bounded like other conditions.

**KG-Q9 · Query under entailment.** A toggle on any pattern result: **as
written** / **with house rules**. The second runs KG-R1 first (or rewrites the
query, §4.3.1). Rows that need a rule show the rule name.

**KG-Q10 · Query relaxation.** When a pattern returns nothing, offer the
nearest relaxations by dropping one constraint at a time, with counts ("0 Books
by X finished in 2026. 3 if 'finished' is dropped. 5 if the year is dropped.").
Symbolic, not vector. Paper: §11 query relaxation.

**KG-Q11 · Edge-pattern door for BIM.** The Telegram bot (`lib/ingest/`)
answers single edge patterns: "who did I see Tuesday", "what blocks X", "what
supports Y". One edge at a time keeps cost low and predictable, as the paper
says of edge-pattern protocols (§9.2.3).

**KG-Q12 · Competency questions as tests.** Every question in §6 below is
written as a pattern and run against `lib/demo-corpus/` in a unit test. A
failing question is a schema gap, as in the paper's agile methods (§6.5.1).

### 5.4 Reasoning (KG-R)

**KG-R1 · A read-time reasoner.** `lib/graph/reason.ts`: positive Datalog over
the edge view, stratified, to a fixpoint, capped. It computes subclass,
subproperty, inverse, transitive closure, chains, and domain/range typing. The
output is a second set of triples marked **derived**, never written. Paper:
§4.3.1 materialisation, kept in memory. Law 3 and law 9.

**KG-R2 · "Why is this here?"** Every derived triple keeps its proof: the rule
id and the triples it matched. Item detail and Cmd-K rows show it on hover in
the GS-1 hover sentence shape. The paper's interpretable models (§5.4) apply to
deduction too.

**KG-R3 · House rules described once.** Describe the existing materialising
rule sets in the vocabulary (KG-O1) as named rules, without changing their
code: connected lists, membership rules, PenLinks, habit syncs, implied
actions, event checklists, people-sync. The reasoner can then *explain* a
membership or a habit cell even though the store wrote it.

**KG-R4 · Rollups on chains.** Goal progress counts every action reachable by
`action-of` through `subgoal-of*`. Operation totals walk `part-of*` and
`phase-of`. Pen minutes roll up `counts-as*` (already, in
`lib/tracking-summary.ts`). One helper, three callers. GS-8's "computed on
read" holds.

**KG-R5 · Exceptions.** A rule may carry an `unless` body edge (stratified
negation, §5.4.1 non-monotonic rules): "Ian's House always means Social,
unless the block also has Work". PenLinks already only fill blank minutes;
this names the exception instead of hard-coding it.

**KG-R6 · Rule editor in the house's own furniture.** A rule is if-pattern ⇒
then-pattern. Reuse the workflow editor's trigger/condition UI. A rule only
derives triples; a workflow acts. Two layers, as `lib/workflow-engine.ts`
already separates formulas (compute) from workflows (act).

**KG-R7 · Dry run for derived triples.** Before a new rule is saved, show what
it would derive on the current vault, with counts (Wave 9's workflow dry run,
applied to rules).

**KG-R8 · Contradiction finder.** With disjointness (KG-O6), functional
properties (KG-O4), and `stance`, list contradictions: an item both done and
missed, a source that both supports and refutes one belief, a phase in two
operations, two "first met" dates. Count per axiom (§7.3.1). Idea #67's
conflict view is this list.

**KG-R9 · Consistent answers.** When a query touches a contradiction, mark the
row and show the answer every repair agrees on, beside the raw one (§8.2.2
consistency-aware answers).

**KG-R10 · Entailment-aware completion.** Before any suggestion (KG-F1) is
shown, drop it if the reasoner already entails it, and drop it if it would
create a contradiction. Paper: §5.2.5 uses rules to filter predictions; here
it filters counted suggestions.

**KG-R11 · Semantic invariance for Data.** Graph analytics (KG-A) run on
a graph where inverse pairs are normalised to one direction first, so `blocks`
written on one side and `blocked-by` on the other give the same centrality.
Paper: §5.1.5.

**KG-R12 · The person's own axioms.** The formulation type (GS-5) with role
`belief` may hold a general statement ("everything I paint as Deep Work counts
toward Writing"). When the person marks one as a rule, it compiles to KG-R1.
The person is the only author of a quantified statement (law 9).

### 5.5 Identity (KG-I)

**KG-I1 · One tag identity.** A tag is addressed `tag:<normalized>` everywhere.
`TrackTag` keeps its id, and gains the normalized name as its address;
`Item.tags`, `taggedTaskTag`, log keywords, and count keywords all resolve to
that address. `catalog-tag.ts` rename becomes an alias add plus a label change,
not a string rewrite. No new record (tags stay the shared bus).

**KG-I2 · Aliases on any item.** `aliases?: string[]` beside `title`,
generalising People nicknames. Read by `name-resolve.ts`, `search.ts`,
`book-match.ts`, `smart-parse.ts`, BIM, and KG-Q1. Paper: §3.2.4 (labels,
aliases, comments). [`CANONICAL_FIELDS.md`](CANONICAL_FIELDS.md) gets the row
before the field ships.

**KG-I3 · A description line.** The paper pairs a label with a short
description to disambiguate (Santiago, capital of Chile). Brain2's equivalent
is one line under the title in pickers: type, first list, and one key attribute
("Sam · Person · People I Know · met 2024"). Derived, not stored.

**KG-I4 · `same-as` without deleting.** **Landed in part, 2026-10-27** — the relation and the accept write. Query-time groups are not built. A symmetric `same-as` relation for two
records the person says are one, when deleting either would lose a source:
an Instagram row and a People I Know person, a Letterboxd film and a Film DNA
item, two imports of one book. The reader consolidates them on query (§8.1.3).
`item-merge.ts` stays the destructive option. Law 2 (no second store).

**KG-I5 · `different-from`.** The opposite mark, stored as a link: "Sam (work)
is not Sam (climbing)". Stops future suggestions from pairing them (§4.1.2).

**KG-I6 · Person identity across rooms.** **Landed in part, 2026-10-27** — candidates, not a gathered biography. One read: a person node gathers the
People I Know item, the Company pen, the who-pen details, Instagram rows, gift
ideas, Telegram mentions, and `same-as` partners. `lib/people-sync.ts` keeps
writing its three records; the graph shows them as one person.

**KG-I7 · Place identity across rooms.** Same for a place: GPS clusters
(`gps-places.ts`), Location pens, trip itinerary items, a person's address,
saved places (`places-search.ts`). Key: rounded centroid plus name.

**KG-I8 · External ids.** Optional attributes that hold an external persistent
id: ISBN, Letterboxd URI, IMDb, Wikidata Q-id, OpenAlex/DOI for papers,
Spotify URI, Instagram username, a program's IPEDS id for GradSearch. They make
link discovery trivial (§9.1.2) and survive a title change.

**KG-I9 · Entity vs document.** A saved link (`saved-links.ts`) is a document
*about* something. Keep `about` separate from the URL: the TikTok is a
document; the recipe it shows is the thing. Paper: §3.2.1 (IRI vs URL).

**KG-I10 · Unknown but existing.** An existential placeholder for "someone
gave me this book", "the venue is not announced", "a person I met at the
party". Stored as a link to a reserved `unknown:<id>` address, so two items can
share the same unknown. Resolving it later rewrites one target. Paper: §3.2.5.

**KG-I11 · Identity over time.** A renamed person, a moved place, a list that
changed purpose keeps one id. The ledger keeps the old label, dated, and search
still finds it (an alias with a `until` read from the ledger).

**KG-I12 · Habit, pen, and operation names as one gazetteer.**
`name-resolve.ts` already matches habits, pens, and operations. Feed it every
label and alias in the edge view so BIM can resolve any node, with the same
ambiguity rule ("close ties become ambiguous so the bot can ask").

### 5.6 Context and time (KG-C)

**KG-C1 · Day and period nodes as hubs.** **Landed in part, 2026-10-27** — the streams `projectVault` actually reads. Every dated record emits an edge to
its `day:` node, and days roll up to `week:`, `month:`, `season:`, `year:`
through `lib/period-keys.ts` and `lib/seasons.ts`. The partial order is the
paper's context dimension (§3.3.5). Expansion E1 builds on it.

**KG-C2 · Edge provenance from the ledger.** Write a ledger row
(`lib/item-activity.ts`) whenever a link is added or removed, with `order` and
`source` (both fields exist). The edge view reads link *since*, *until*, *by*,
and *order* from the ledger. No column on `ItemLink` (law 5). Paper: §3.3.2
reification, done as a log.

**KG-C3 · Provenance on membership.** Same for list membership. The store
already knows hand vs rule (`listRuleAddedIds`, `listMembershipExclusions`).
The edge view reports `order: derived` for rule members and `recorded` for hand
members.

**KG-C4 · Valid time vs record time.** Two clocks per fact: when it was true
in the life (the block's minutes, the completion day, the met date) and when it
was written (`createdAt`, ledger `at`). The paper's temporal context (§3.3) is
the first. Temporal polarity is how the two relate. Queries can pick either.

**KG-C5 · Temporal annotations with meet and join.** Intervals on facts, with
*meet* = interval intersection and *join* = union, as the paper's Annotated
RDF example does with days of the year (§3.3.4). Example: "people I saw
during the trip" intersects the trip interval with each Company block.
`lib/time-entries.ts` has the minute math.

**KG-C6 · Degrees of truth, one algebra.** `stance`, `weight`, `trust`,
`certainty`, belief `strength`, and est. confidence are all degrees. Define one
combination rule per query: along a path, multiply (or take the minimum); across
alternative paths, take the maximum. A fuzzy semiring (§3.3.4). Shown with
order **derived**.

**KG-C7 · Context slices in Data.** Slice, dice, and roll up the vault
graph along time (day ⪯ … ⪯ year), place (pin ⪯ neighbourhood ⪯ city, via
counts-as on Location pens), company (person ⪯ group), and type (type ⪯ parent
type). Paper: §3.3.5 contextual OLAP. The shared range in
`analytics-range-store.ts` is the time axis already.

**KG-C8 · Named graphs per period.** A period review (`PeriodReview`) is the
context in which a week's formulations and handoffs (GS-6) are true. The edge
view tags them `graph: review:<key>`. "What did I believe in March?" filters
on that graph.

**KG-C9 · Graph as of a date.** Rebuild the edge view as of any past instant
from the ledger (KG-C2) and tombstones. Item detail gets an **as of** control
(KG-X9). Paper: §3.3 (what held true in 2016).

**KG-C10 · Prospective vs retrospective edges.** Mark each edge's temporal
polarity in the edge view (plan text, planned actions, scheduled dates are
prospective; paint, completions, logs are retrospective), using
`lib/temporal-polarity.ts`. A query can then compare an intention edge with
its outcome edge directly. No `polarity` field (it is computed).

**KG-C11 · Context-aware queries.** Any pattern can carry `during <period>`,
`at <place>`, `with <person>`, `according to <source>`. Each compiles to a
meet over the relevant context (KG-C5). Paper: §11 reasoning and querying over
context.

**KG-C12 · Recurrence as context.** A recurring item, a habit, a lunation
reminder, and a seasonal ritual share one pattern: a fact valid on a rule of
days. Express each as a temporal annotation, so "what was due on Oct 3" is one
query over habits, reminders, and scheduled items.

**KG-C13 · Geography as context.** The home city in `user-settings-store.ts`,
trip itineraries, and GPS places set a *where* on each day. Queries can split
any metric by where the day was spent.

**KG-C14 · Source context for imported facts.** Every imported item carries
its source graph (Instagram download date, Letterboxd export date, a receipt
photo). Timeliness checks (KG-QA4) read it.

### 5.7 Graph analytics (KG-A)

All counted, deterministic, and shown with range and `n` (law 7).

**KG-A1 · Load-bearing nodes.** Betweenness centrality over the item graph
(links + membership + goals). "These 5 items connect the most of your
vault." Shown on the quality page and as degree pads (KG-V7).

**KG-A2 · Orphans.** Degree zero: items with no link, list, tag, or goal.
"Isolation is a bug" made measurable. A weekly review step lists them
(KG-X5).

**KG-A3 · Hubs and authorities.** HITS over `supports` / `supported-by`:
sources that support many strong beliefs score as hubs, beliefs supported by
good hubs as authorities. Paper: §5.1.1 HITS; §8.2.1 Sums uses the same idea.

**KG-A4 · Communities.** Label propagation or Louvain over items, lists, and
people. A community is offered as "these 14 items cluster together" with the
links that hold them. The person can name it as a list. Never auto-created.
Idea #82 without embeddings.

**KG-A5 · Brittle links.** Bridges and articulation points: a goal that
reaches its actions through one list, a person known only through one pen.
Paper: §5.1.1 connectivity (routes that fail if one bus stops).

**KG-A6 · Reachability from today.** Which open items reach no goal through any
path; which goals reach no open item. "3 goals have no open action." A dated
count, not a judgement.

**KG-A7 · Node similarity.** Jaccard and Adamic–Adar over shared neighbours
(lists, tags, links, people, pens). "Similar items" on item detail. Feeds
link suggestions (KG-F1) and duplicate candidates (KG-F4).

**KG-A8 · Pen transitions as a Markov chain.** From painted blocks, estimate
the chance of moving from one pen to the next, per hour of day. Report
steady-state share, recurrence, and periodicity (paper footnote 21). This
describes the record; it does not forecast. `TransitionsView.tsx` is the home.

**KG-A9 · Personalised PageRank from an item.** "What is closest to this
item?" ranked by a short random walk from it. A small, explainable neighbour
list for item detail. Paper: footnote 25.

**KG-A10 · Shortest path between two things.** Pick two nodes; show how they
connect (Book → supports → Belief → inferred-from → day). Paper: §5.1.1 path
finding. KG-V6 draws it.

**KG-A11 · Label-aware analytics.** Each analysis names its projection (which
predicates), weighting (minutes, weight, trust), and transformation. The choice
shows on the chart footer, since the paper notes results can change a lot with
it (§5.1.3).

**KG-A12 · Data before and after rules.** A toggle on each graph metric:
**as written** / **with house rules** (KG-R1). The difference is itself
information (§5.1.5).

**KG-A13 · Diversity over the graph.** `DiversityView.tsx` today counts
spread. Add entropy over communities and over people seen, per period.

**KG-A14 · Degree over time.** How connected the vault was each week: new
links per week, orphans per week, share of items with a goal. A slow vital
sign of "isolation is a bug".

### 5.8 Symbolic learning (KG-L)

**KG-L1 · Rule mining over day graphs.** AMIE-style search over day nodes
(KG-C1): heads and bodies are day-level facts (sleep ≥ 7h, Writing ≥ 60 min,
a habit done, a person seen, a place visited, a cycle phase, rain). Report
support, confidence, and `n`, with the range. Example shape: "Days after ≥ 7h
sleep: Writing ≥ 60 min on 21 of 30 (70%), Aug 1 – Oct 1, n = 58 nights." The
word is "co-occurs". Paper: §5.4.1. Home: Observatory (it already speaks in r
and n).

**KG-L2 · Closed, safe, short rules.** At most three body facts. Every
variable appears twice. Prune below support floor 7. Same discipline as AMIE.

**KG-L3 · Partial completeness for negatives.** A day counts as a negative for
"Writing ≥ 60" only if that day has *some* painted minutes (the person was
logging). A blank day is unknown. Paper: PCA (§5.4.1). With KG-O9, a day
marked complete is a true negative.

**KG-L4 · Exceptions.** Show the main exception beside a rule: "…except on
travel days (4 of the 9 misses)". Non-monotonic rules (§5.4.1).

**KG-L5 · Rules as formulations, by the person.** A mined rule can be saved as
a `formulation` with role `inference`, linked `inferred-from` to its supporting
days (GS-5). Its strength recomputes as days arrive. The rule never acts on
its own.

**KG-L6 · Support changed.** A saved inference whose support has dropped since
the last review shows in the next weekly review: "support 21 → 14 since Sep 2".
The GS-5 night-person example, in general form.

**KG-L7 · Disjointness mining.** "No item has ever been on both Someday and
This week." Offered as a disjointness axiom (KG-O6) for the person to accept.
Paper: §5.4.2.

**KG-L8 · Class description learning.** Pick a few items that belong together
and a few that do not; the miner offers a smart-list rule that separates them
("type Book · tag fiction · not on Finished"). DL-Learner's idea (§5.4.2),
restricted to the membership rule grammar.

**KG-L9 · Miss-reason rules.** `lib/miss-reason-corpus.ts` holds why-not text.
Mine co-occurrence between miss reasons and day facts ("'tired' on 8 of 10
days after < 6h sleep"). Counts only.

**KG-L10 · Pen action templates from data.** When the same pen plus variant
keeps producing the same Done title by hand, offer a pen action format
(`lib/pen-action-format.ts`). The rule is the template; the person accepts.

### 5.9 Creation and ingest (KG-N)

**KG-N1 · Mention linking in captures.** In `smart-parse.ts` and the Telegram
parser, highlight mentions that resolve to nodes (people, places, lists,
items, pens) using the gazetteer (KG-I12). A resolved mention writes a link
when the capture files. Ambiguous ones ask. Paper: §6.2.3 entity linking,
with context: a mention of "Sam" beside "climbing" prefers the Sam linked to
the climbing list.

**KG-N2 · Wiki links are entity links.** Wave 12's `[[links]]` in Docs resolve
through the same resolver, with aliases. An unresolved `[[name]]` is an
*emerging entity* (§6.2.2): offer to create it.

**KG-N3 · Relation phrases.** A small closed list of phrases per relation
("for", "because of", "part of", "blocked by", "with", "at") that smart-parse
turns into links when both ends resolve: "call dentist for knee" → `action-of`
the knee goal. Closed-set relation extraction (§6.2.4) by rules.

**KG-N4 · n-ary captures.** "Dinner with Sam and Ana at Café X Tuesday 7pm"
becomes one event with roles (who, where, when), the frame the paper describes
(§6.2.4). It lands as a block (Company + Location) and a Plan event, through
the existing apply files.

**KG-N5 · Mapping files for imports.** Each import (Instagram, Letterboxd,
module list import, CSV paste, spreadsheets) gets a declarative mapping: which
column is the key, which becomes an attribute, which becomes a link, which
datatype. The paper's direct vs custom mapping (§6.4.1). Module rung 2
manifests can carry these.

**KG-N6 · Direct mapping first.** Any CSV or spreadsheet can be loaded with a
direct mapping (row → item, column → attribute, foreign-looking column →
link) and then refined into a custom one. Files: `lib/csv.ts`,
`lib/spreadsheet-paste.ts`.

**KG-N7 · JSON-LD in and out.** Read JSON-LD and schema.org markup from saved
links (recipes, events, books, products on web pages) to fill attributes.
Paper: §6.3 markup, §6.4.2 trees.

**KG-N8 · Web tables.** A pasted HTML table goes through the paper's steps:
classify, normalise headers, find the protagonist (what the table is about),
link cells to existing items. File: `lib/spreadsheet-paste.ts`.

**KG-N9 · Approve before ingest.** Idea #61's staging area: extracted links
and entities wait in the Inbox until accepted. The paper's human-verified
extraction (§6.1).

**KG-N10 · Gazetteer of the person's world.** Seed the resolver with the
vault's own names plus a few house lists (days, months, common place words).
No external dictionary needed. Rules stay predictable (§6.2.2).

**KG-N11 · Receipts and menus as structured sources.** `lib/ingest/receipt-parse.ts`
already extracts lines. Map vendor → place, line → item or grocery entry,
total → spend. Each fact carries the receipt photo as provenance.

**KG-N12 · Screen time and GPS as observed graphs.** App use (`lib/screentime/`)
and GPS fixes write observed edges (`day uses app`, `day at place`). They stay
order **observed** and never overwrite recorded paint.

**KG-N13 · Competency-driven capture.** When a competency question (§6) fails
for lack of data, the question names the missing capture ("No Location paint
on 12 of 30 days"). The paper uses competency questions to drive what to model
(§6.5.1).

**KG-N14 · Term suggestions for tags.** Count recurring two- and three-word
phrases in titles and notes (unithood and termhood, §6.5.2). Offer frequent
ones as tags. Counting only; no model.

### 5.10 Quality (KG-QA)

Shown on one page (KG-X6). Every line is a dated count in neutral ink.

**KG-QA1 · Syntactic accuracy.** Share of malformed values per attribute: a
date attribute holding text, a number out of the attribute's bounds, a URL
that does not parse.

**KG-QA2 · Range violations.** Links whose target is outside the relation's
range (KG-O2).

**KG-QA3 · Shape violations.** Count per shape and constraint (KG-O10). "Belief
· no source: 12 of 40."

**KG-QA4 · Timeliness.** Days since each source last refreshed: the Instagram
download, the Letterboxd export, the phone hub sync, the last GPS fix, the last
screen-time pull. Paper: §7.1.3.

**KG-QA5 · Property completeness.** Per type, the share of members with each
expected attribute.

**KG-QA6 · Linkability completeness.** Share of items with at least one link,
list, goal, or tag. The paper names this exact metric (§7.2.1).

**KG-QA7 · Population completeness, where knowable.** Where a closed source
exists, compare: nights in the range vs nights with a sleep row; books on the
Letterboxd/Goodreads export vs items.

**KG-QA8 · Representativeness.** Which rooms the vault over- and
under-records: share of days with paint by weekday, by season, by place. A bias
in the record reads as a bias in every finding. Paper: §7.2.2.

**KG-QA9 · Consistency.** Contradictions per axiom (KG-R8).

**KG-QA10 · Conciseness.** Duplicate candidates (KG-F4), two relations used
for one meaning, two lists with the same members. Paper: §7.4.

**KG-QA11 · Understandability.** Share of items with a title other than
"Untitled", share of lists with a description, share of pens with a parent.

**KG-QA12 · Quality over time.** Each metric as a weekly strip, so a cleanup
shows as a step. The quality of the *models* too: each saved inference's
support history (§11 quality of models).

### 5.11 Refinement (KG-F)

**KG-F1 · Link suggestions in the Infer step.** In the weekly review (GS-5),
offer at most five candidate links per week, ranked by shared neighbours
(KG-A7) and filtered by the reasoner (KG-R10). Accept writes a **recorded**
link. Ignore writes nothing. Dismiss writes `different-from` or a dismissed
pair so it does not return. Paper: §8.1.1, under law 9.

**KG-F2 · Type suggestions.** An item typed `item` whose links and attributes
look like Books (has author, on Reading list) is offered the Book type. Counted
features, not a classifier. Paper: §8.1.2.

**KG-F3 · Blocking for duplicates.** Compare only within blocks (same type
and same first title word, same day for captures, same 80 m cluster for
places). Paper: §8.1.3 blocking.

**KG-F4 · Value and context matchers.** A duplicate score from title
similarity (value) plus shared lists, tags, and links (context). Above the
threshold: offer merge (`item-merge.ts`) or `same-as` (KG-I4). Idea #68 for
beliefs is the same flow.

**KG-F5 · Trust from agreement.** Recompute source trust from the beliefs a
source supports and how those beliefs fare (Sums and Average·Log, §8.2.1).
Shown as a derived number beside the typed trust. The typed number stays the
record (law 4).

**KG-F6 · Fact validation for imported facts.** When two sources disagree (a
person's birthday from two imports, a film's year), show both with sources,
as Wikidata keeps both claims (§10.1.4). The person picks.

**KG-F7 · Repair suggestions.** For each contradiction, list the smallest set
of edits that removes it, ranked by the trust and order of the facts involved:
remove an inferred fact before a recorded one, a recorded one before an
observed one. Paper: §8.2.2 minimal hitting sets.

**KG-F8 · Stale edges.** A link whose ends have both been inactive for a long
time, or a `blocks` edge whose blocker is done, is listed for the person.
Never auto-removed.

**KG-F9 · Membership refinement.** Members a rule added that no longer match
already leave when `membershipRulesSync` is on. Extend the report to hand
members that no longer match the list's shape.

**KG-F10 · Succinctness refinement.** Offer to merge two relations the person
uses for one meaning, or two near-identical lists (`lib/list-merge.ts`
exists). Paper: §8.3 notes succinctness refinement is under-explored.

### 5.12 Publication and privacy (KG-P)

**KG-P1 · A house vocabulary document.** `docs/` gets a generated page listing
every predicate, its inverse, domain, range, traits, and example, from
`lib/graph/vocabulary.ts`. FAIR I2 (vocabularies described).

**KG-P2 · JSON-LD export.** Export any selection (an item, a list, a module, a
period) as JSON-LD with a `b2:` vocabulary and schema.org mappings where
honest (Book, Movie, Person, Place, Event, CreativeWork). Paper: §9.1.

**KG-P3 · Dump plus diffs.** The full backup is the dump. Add a diff export
since a date for the phone hub and for archives. Paper: §9.2.1.

**KG-P4 · Node lookup over the sync hub.** The hub (`lib/mobile-sync.ts`)
answers `GET /node/<address>` with the node and its incident edges. The phone
can browse the graph without the full vault. Paper: §9.2.2.

**KG-P5 · Edge patterns over the sync hub.** `GET /edges?s=&p=&o=` with
pagination, for the phone and BIM. Cheap and predictable (§9.2.3).

**KG-P6 · Blueprint export strips the A-Box.** Module export is the T-Box
(types, shapes, rules, views) without the person's facts. GS-6 already checks
this; describe it in these terms in [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md).

**KG-P7 · Usage policies per subgraph.** Mark subgraphs private to this
device: cycle marks, sleep, mood, intake, a person's notes. Exports, the hub,
screenshots (`BRAIN2_FRESH=0` passes), and friend surfaces honour the mark.
Paper: §9.3.2.

**KG-P8 · Field-level encryption for the hub.** Encrypt marked subgraphs
before they leave the desktop, per field, so the hub stores ciphertext (§9.3.3).

**KG-P9 · k-anonymous sharing of a pattern.** When a module or a finding is
shared, drop or coarsen quasi-identifiers (exact dates, places, names) until
each row matches k others. Paper: §9.3.4.

**KG-P10 · Differentially private counts for public widgets.** If a count ever
leaves the device (a shared streak, a public year-in-review), add calibrated
noise and say so. Paper: §9.3.4 ε-differential privacy.

**KG-P11 · Licenses on imported sources.** Imported text and images carry a
license or "personal use" mark (Source items already carry `origin`). Export
respects it. Paper: §9.3.1.

**KG-P12 · Metadata survives deletion.** A tombstone keeps that a record
existed and when it was removed (already, for union safety). FAIR A2. The
quality page can count deletions per week.

### 5.13 Additions to the families above, from [BW]

**KG-D15 · Virtual nodes for outside readings.** Weather
(`lib/home-weather.ts`), tides (`lib/tide-client.ts`), sun times, lunar phase,
flight status (`lib/flight-lookup.ts`), and screen time join the edge view as
virtual nodes on `day:` and `place:` addresses, fetched or computed on demand
and cached the way `sun-times-store.ts` already caches. Nothing new is stored
unless the person pins a reading. [BW] ch.5 virtual resources; [H] §6.4.1
virtualisation.

**KG-Q13 · Local first, global on a schedule.** Patterns that start from a
known node (item detail, Cmd-K, BIM) run on demand. Patterns with no anchor
(quality page, rule mining, communities) run on idle or on the weekly review,
like the habit history pass already runs on idle. [BW] ch.3 graph-local vs
graph-global.

**KG-A15 · Stream, keep, or store.** Every graph metric declares its mode:
*stream* (computed for the open screen, the default), *keep* (cached for the
session), or *store* (written with a `FieldEstimate`, order **derived**, only
when a room needs it offline). [BW] ch.6 stream / mutate / write.

**KG-A16 · Two algorithms, side by side.** Where two community or centrality
methods disagree, show both, with a line on what each counts. The rail-station
lesson in [BW] ch.6: the obvious hub was not the central one.

**KG-A17 · Expected shape vs actual shape.** A cheap structural probe: if
every person should be one component, count components; if every operation
should have phases, count those without. A mismatch opens a sample of the odd
subgraphs. [BW] ch.10.

### 5.14 Lineage and metadata (KG-M)

From [BW] ch.8. The map of Brain2's own machinery, built from the code, not
the person's data.

**KG-M1 · The machinery graph.** A hand-written manifest,
`lib/graph/machinery.ts`, with three node kinds: *stores* (persist keys),
*tasks* (sync files, rules, workflows, ingest apply files), and *sinks* (Home
squares, Data views, Telegram replies, exports). Edges: `reads`,
`writes`, `feeds`. A unit test fails when a store key in
`lib/storage-keys.ts` or a sync file has no manifest row.

**KG-M2 · Lineage for any number.** **Landed in part, 2026-10-27** — `whereFrom` for the seven named derivations. "Why is this 4?" on a habit cell, a points
row, a grade, a list count, or an Data figure walks the machinery graph
back to the records that produced it. The answer is the GS-7 Structural
Differential stack with real rows in it.

**KG-M3 · Impact before delete.** **Landed in part, 2026-10-27** — `whatReadsThis` and Cmd-K `what reads`. The delete confirm is not wired. Deleting a pen, list, tag, habit, or type
first lists what reads it: habits linked by tag, membership rules naming the
list, workflows that trigger on it, module views bound to it, formulas that
`LOOKUP` it. Win95 confirm with the count. [BW] impact analysis.

**KG-M4 · Popularity of rooms.** Which stores and views the person actually
uses, counted from screen history (`lib/screen-history.ts`), so the house can
see which instruments earn their furniture. Kept on device.

**KG-M5 · Data and metadata in one answer.** Any pattern result can show,
under each row, which store and which door wrote it (the default graph KG-D6
plus the ledger). [BW] ch.8 two layers.

**KG-M6 · Glossary terms on the chrome.** `data-ui-name` and `data-ui-docs`
already name UI parts. Link each to a vocabulary term (KG-O1), so the Names
overlay can say which graph predicate a control writes.

**KG-M7 · Owners for automations.** Every workflow, rule, and sync names its
author (house or person) and its last change, so a surprising write can be
traced to who set it up. Wave 9's run log is the event half of this.

**KG-M8 · Freshness of each sink.** Each Home square and Data view shows
the time its inputs last changed (from the default graph), as a small dated
line. Paired with KG-QA4.

### 5.15 Dependencies and impact (KG-DEP)

From [BW] ch.11. Brain2 has many dependency graphs; this gives them one
grammar.

**KG-DEP1 · One `depends-on` family.** In the vocabulary: `blocks`,
`part-of`, `phase-of`, `checklist-of`, `prereq-of`, `fed-by` (habit value
links), `served-by` (goal ← action) all declare themselves members of one
dependency family, so one set of analyses runs on all of them.

**KG-DEP2 · Additive or redundant.** A parent with several children declares
how they combine. *Additive*: a goal that is 40% reading and 60% writing; a
weekly habit fed by daily ones. *Redundant*: a goal any one of three routes can
serve; a trip that needs one of two flights. *Threshold*: "two of these four
habits make the day". Stored as one attribute on the parent; the default stays
today's behaviour.

**KG-DEP3 · Shares on edges, from weight.** `ItemLink.weight` already exists.
For an additive parent it is the child's share. KG-DEP7 checks the shares.

**KG-DEP4 · Impact scope.** Mark something missed, blocked, or cancelled and
see everything downstream: the tasks it blocks, the goal it serves, the
operation phase it sits in, the event it was a checklist for. A dated list in
neutral ink. No alarm colour.

**KG-DEP5 · Impact with meaning.** Then apply the combination rule: an
additive goal loses that child's share; a redundant one loses nothing while
another route is open; a threshold parent falls only below its count. "Goal
Spanish: 40% of its routes are blocked since Oct 3."

**KG-DEP6 · Single point of failure.** Several chains converge on one node:
four goals that all wait on one call, three operations that all need one
person's reply. Listed on the quality page and on the Plan rail. [BW] SPOF.

**KG-DEP7 · Validation: no cycles.** `blocks` and `part-of` cycles are already
refused on edit (Wave 11 item 4). Extend the check to every member of the
family, and list existing cycles (Gantt may still draw one).

**KG-DEP8 · Validation: shares sum.** An additive parent whose shares do not
sum to 100% is listed. Objectives with point multipliers can use the same
check where shares are meant.

**KG-DEP9 · Validation: consumption ≤ production.** The day's time budget as
a dependency graph: planned actions, scheduled tasks, and habit estimates
consume minutes; awake time (from `sleep-store.ts` and the day anchor) provides
them. Over-commitment (`lib/overcommitment.ts`) is this check already; the
graph form adds *which* commitments share the same hours.

**KG-DEP10 · Validation: redundancy meets its threshold.** A threshold parent
with fewer children than its threshold can never be met. Listed.

**KG-DEP11 · Root cause of a bad week.** Given a set of misses (the
symptoms), find upstream nodes that explain the most of them: a shared
blocker, a person, a place, a short night, a phase of an operation. Rank by
precision, recall, and F-score with `n`, as [BW] does. The sentence says
"explains 5 of 7 misses (precision 0.71)". Never "caused".

**KG-DEP12 · Dependencies as of a date.** Edge `since`/`until` from the ledger
(KG-C2) lets impact and root-cause run "as of last Tuesday".

### 5.16 Entity resolution (KG-ER)

From [BW] ch.9, fitted to [H] §8.1.3.

**KG-ER1 · Strong, weak, and non-identifying features per type.** In the
vocabulary, each type names its strong identifiers (ISBN, Letterboxd URI,
Instagram username, flight number + date, phone number), weak ones (title,
name, rounded coordinates), and non-identifying hints (year, city, author,
list). Same as KG-O7 keys, with the weak tier added.

**KG-ER2 · The five-step matcher.** (1) `same-as` candidate on a shared
strong id; (2) `similar` with a score on a weak id above threshold; (3) drop
`similar` where a strong id disagrees; (4) nudge the score with
non-identifying features (±10% in [BW]'s example); (5) drop below the floor.
Pure, in `lib/graph/resolve.ts`, tested on fixtures. Candidates only; nothing
merges without the person.

**KG-ER3 · Token overlap for titles.** Normalise (lowercase, strip
punctuation), split into words, and compare word sets (Jaccard or overlap
coefficient). [BW] shows this beating raw string distance on messy product
names. `book-match.ts` and `name-resolve.ts` can share it.

**KG-ER4 · Blocking keys.** Compare only inside blocks: same type plus first
significant word, same 80 m GPS cluster, same capture day, same Instagram
download. [BW] and [H] agree this is what keeps matching cheap.

**KG-ER5 · Groups, not merges.** Connected components over accepted
`same-as` (and confident `similar`) form an identity group. One member is the
display record. The others stay, with their sources. Unmerge is removing one
edge. This is a golden record without a new noun.

**KG-ER6 · Deltas.** Re-running an import (a new Instagram download, a new
Letterboxd export) matches only new and removed rows against existing groups,
as [BW] advises for living sources.

**KG-ER7 · Normalise before matching.** Shared helpers for names (first/last
order, nicknames), dates (year of birth from age or full date), places
(coordinate rounding), and units. `lib/string-utils.ts` and
`lib/geo-address.ts` are the homes.

**KG-ER8 · Identity review in the weekly ritual.** At most five candidate
pairs a week, with the evidence (which ids matched, which differed). Accept
writes `same-as`; reject writes `different-from` (KG-I5).

### 5.17 Patterns and taxonomies (KG-PT)

From [BW] ch.2, 10, 12, 13.

**KG-PT1 · Several classifications at once.** A thing can sit in several
taxonomies: list folders, types, pens' counts-as ladders, tags, seasons. The
edge view treats each as its own `broader` hierarchy so a query can pick one
("roll up by type" vs "roll up by folder"). [BW] ch.2 layered taxonomies.

**KG-PT2 · Semantic search over taxonomies.** Search for a broad term finds
items filed under narrower ones: "Reading" finds Novels if Novel counts as
Book counts as Reading (GS-8 on read). [BW] ch.12.

**KG-PT3 · Taxonomy similarity.** Path similarity, Leacock–Chodorow, and
Wu–Palmer (via the least common ancestor) over any ladder: pens, types,
folders. "Climbing gym and Bouldering are close; Climbing gym and Groceries
are far." Pure, deterministic, and it can rank "similar items" (KG-A7) and
break ties in suggestions. [BW] ch.13.

**KG-PT4 · Horizontal relations.** Beside broader/narrower, a few
cross-cutting relations the person may want: `alternative-to` (a substitute
when one is unavailable — another route, another recipe), `upgrade-of`,
`goes-with` (complements). [BW] ch.2's substitute and upsell, in a personal
key: "out of oat milk → alternatives on the grocery list".

**KG-PT5 · Expected shape probes.** KG-A17, with a small library: "every
person has one People I Know item", "every operation has a phase", "every
belief has a source", "every recurring habit has a cell this week".

**KG-PT6 · Positive and negative patterns.** Named patterns the person cares
about, checked locally on each write: positive ("a trip with a flight, a
stay, and a return"), negative ("a task that blocks itself through a chain",
"a reminder for an event that already passed"). Each match is a dated line,
never a block on the write. [BW] ch.10.

**KG-PT7 · Practice from painted time.** Like [BW]'s skills from project time:
total minutes and last-used date per pen and per counts-as parent give a
"practice ledger" (Spanish: 41 h, last Oct 12). Dated facts, not a grade.
Feeds Goals and the weekly review.

**KG-PT8 · Outcome rollups by chain.** Misses, pushes, and estimate overruns
rolled up the list, goal, operation, and person chains. "Pushed ×9 since Jul
3 under Operation Move." [BW] ch.10 rolled failed projects up the reporting
chain.

**KG-PT9 · Who it goes well with.** The person's own ratings of time with
people (already partly in interactions and company blocks) form a peer graph;
"good sessions" can be counted by who was there. Facts only, private by
default (KG-P7).

**KG-PT10 · Trending in your own vault.** For a cold start (empty Cmd-K, a
new module), show entities whose mention count rose this month: people,
places, tags, lists. [BW] ch.12 cold start.

### 5.18 Natural language without a model (KG-NL)

From [BW] ch.13. All rule-based and deterministic.

**KG-NL1 · Talkable vocabulary.** Each predicate in KG-O1 carries a *direct*
and an *inverse* phrase, with short and long forms and `$s`/`$o` slots
("$s is part of $o" / "$o includes $s"). `RELATIONS` already has `label` and
`inverseLabel`; this generalises them. Each type names the field used to refer
to its members (title, name, pen name).

**KG-NL2 · "What the vault knows about X."** **Landed in part, 2026-10-27** — template sentences for the house questions, not a walk of every edge. One generic generator walks a
node's edges and attributes and prints sentences from KG-NL1. Item detail
gets a **Read aloud** text panel; BIM answers "tell me about Sam". It reads
the record; it never interprets it (law 7 and GS-3 copy rules apply).

**KG-NL3 · Rule-based questions in BIM.** **Landed in part, 2026-10-27** — the questions run in Cmd-K, not in BIM. Patterns over words, in the
existing grammar style: "who did I see on Tuesday", "what blocks X", "when did
I last Y", "what supports Z", "how much X this week". Each maps to a pattern
(KG-Q1) and replies with the answer plus the pattern it ran, as [BW] prints
the generated query as the explanation.

**KG-NL4 · Schema-driven question words.** Synonyms per predicate and per type
(write/wrote/author → `author`) live in the vocabulary, so new types get
questions without new code. [BW]: annotate the schema and the matcher grows
with it.

**KG-NL5 · Plain-text period readouts.** A week's handoff (GS-6) or review
Describe step can print "This week: 14 blocks with Sam, 3 at Ocean Beach, 9 of
12 habit cells", generated from triples. Description only; the Infer step
stays the person's (GS-5).

**KG-NL6 · Personal lexicon.** A small lexical graph of the person's own
words: aliases, nicknames, abbreviations they type in captures ("OB" = Ocean
Beach, "gym" = Climbing gym), learned only when the person accepts a
resolution. Feeds KG-I12 and the Telegram parser.

**KG-NL7 · Closed relation list for extraction.** Any extraction — rule-based
now, model-assisted later (section 8) — may only emit relations already in the
vocabulary. [BW] warns that open relation extraction makes relations
proliferate.

**KG-NL8 · Evidence spans.** Every link created from text keeps the source
text span (message id + offsets) in the ledger line, like [BW]'s fact
extraction keeps `evidence` with offsets. Clicking the link shows the words
it came from.

### 5.19 Visual design (KG-V)

House rules: [`DESIGN_STYLE.md`](DESIGN_STYLE.md). Diagram grammar (FIG.
numbers, hairline double rules, crop marks, degree wheels, rulers), cool white
paper over a cobalt graph rule, steel not brass, DSi pixel type and glowing
indicator lights, star *icons* yes, celestial costume no, no yellow paper, no
"should", no alarm colour for a state of the day. The house motif already
names "graph nodes joined by traces".

**KG-V1 · The item's neighbourhood plate.** On item detail beside
`RelatedItemsPanel.tsx`: "FIG. 1 — two hops", orbs as nodes, PCB traces as
edges, laid out by `lib/graph-layout.ts` (radial). Click a node to step to it;
the plate re-centres. This is the Knowledge Panel ([H] §10.2, [BW] ch.12) in
house furniture.

**KG-V2 · A line grammar for relation families.** Composition (part-of,
phase-of) as a solid trace; dependency (blocks, fed-by) as a trace with a bar
arrow; evidence (supports/refutes) dashed with a + or − tick; identity
(`same-as`) a hairline double rule; `similar` a dotted double rule;
association (`related`) a thin plain trace. A key drawn like a schematic
legend in one corner.

**KG-V3 · The four orders as stroke.** Observed: solid phosphor. Recorded:
solid ink. Derived: hatched. Inferred: dotted outline. The same four strokes on
numbers, cells, edges, and nodes. One mark family (GS-1), drawn.

**KG-V4 · Edge inspector.** Click a trace: a small Win95 property sheet with
relation, inverse, stance, weight, since/until (from the ledger), order,
source, and the evidence span (KG-NL8). Edges become things you can handle.

**KG-V5 · Ontology schematic.** In `ItemTypesLibrary.tsx`: the type tree
(`parentTypeId`) as a schematic, with domain→range arrows for relations. A
second plate is the emergent schema (KG-O15): one box per type, trace width
by link count, split boxes where members differ.

**KG-V6 · Path ribbon.** When you walk item → item through relations, a ruler
strip under the title records the route ("Book → supports → Belief →
inferred-from → Oct 3"). Click a stop to go back. Navigational paths ([H]
§2.2.3), made visible.

**KG-V7 · Degree pads on rows.** A small via pad on list rows and Cmd-K rows
with in/out degree, in the `.todo-via` family. A star pad marks a hub
(KG-A1). An empty pad marks an orphan (KG-A2).

**KG-V8 · Day hub dial.** A degree wheel for one day: concentric rings by
store (paint, completions, sleep, cycle, counts, messages, GPS places,
virtual readings), spokes to each record, ticks for hours. Drawn as an
instrument, not a sky.

**KG-V9 · Gravity by link weight.** The Lists Icons-desktop gravity field
already exists (`listIconsGravityField`). Let shared links and weight pull
orbs together, so clusters (KG-A4) show without a new view.

**KG-V10 · Shape inspection sheet.** One plate per type with crop marks:
"Belief · no source: 12 of 40 (n = 40)". Neutral ink. Rows open the members.

**KG-V11 · Dependency schematic.** For a goal or operation, a left-to-right
layered drawing (`topologicalRanks` in `lib/graph-layout.ts`) with additive
parents drawn as a summing junction (Σ) and redundant ones as an OR gate
symbol, thresholds as a small "2 of 4" plate. Circuit grammar, which suits the
PCB house.

**KG-V12 · Impact overlay.** When something is missed or blocked, its
downstream nodes in KG-V11 dim along the traces in neutral grey with the share
lost printed beside each. No red.

**KG-V13 · Lineage strip.** For any number (KG-M2), a horizontal strip of
plates from source records → task (sync file) → value, each plate small and
labelled. The Structural Differential (GS-7) drawn as signal flow.

**KG-V14 · Identity group card.** A group of `same-as` records drawn as
stacked index cards behind the display record, each with its source glyph
(Instagram, Letterboxd, typed, phone). Fanning the stack shows the evidence.

**KG-V15 · Taxonomy ruler.** For KG-PT3, a vertical ruler from the root down,
with two items marked and their least common ancestor highlighted; the
similarity number at the side with its formula name.

**KG-V16 · Quality instrument panel.** The quality page as one instrument (no
card restack): needles for linkability and completeness, tube lamps for
contradiction counts, a filmstrip of weekly values, all in the Habits console
language.

### 5.20 Features and flows (KG-X)

**KG-X1 · Pattern bar in Cmd-K.** KG-Q5, with autocomplete from the
vocabulary and the witness path per row.

**KG-X2 · Save pattern as list / view / workflow condition.** KG-Q6–Q8 as
three buttons on any pattern result.

**KG-X3 · Inferred links toggle.** On item detail and pattern results: **as
written** / **with house rules**, derived rows dotted, each with its proof on
hover (KG-R2).

**KG-X4 · Weekly graph review.** One ritual section, after Describe and in
Infer (GS-5): up to five link suggestions, five identity pairs, five shape
gaps, the orphans count, and any saved inference whose support changed. Each
row: accept, dismiss, or later.

**KG-X5 · Orphan sweep.** From KG-A2: a walk through unlinked items, one at a
time, with three likely homes (list, goal, person) from KG-A7. Like the Inbox
walk (Wave 11 item 7).

**KG-X6 · Vault quality page.** Data gets a "Vault" view: KG-QA1–QA12
on KG-V16. Every line dated, every count with `n`.

**KG-X7 · Shortest path between two things.** Pick two nodes; get the route
(KG-A10) drawn on KG-V6.

**KG-X8 · "Why is this here?"** On any list member, habit cell, points row,
or derived link: the lineage (KG-M2) and proof (KG-R2) in one popover.

**KG-X9 · As-of control.** On item detail and on pattern results: a date
picker that rebuilds the neighbourhood as of that day (KG-C9).

**KG-X10 · Context chips on queries.** `during`, `at`, `with`, `according
to` chips under the Cmd-K pattern bar (KG-C11).

**KG-X11 · Impact preview on miss.** Marking a task missed, or a person as
away, shows the downstream impact (KG-DEP5) in the same dialog, as a dated
fact.

**KG-X12 · Root-cause readout in the weekly review.** KG-DEP11's top three
candidates with precision, recall, and `n`. The person can save one as a
formulation; nothing else happens.

**KG-X13 · Before-delete impact list.** KG-M3 in every delete confirm.

**KG-X14 · Identity groups in People and Places.** People and Places views
(`components/Analytics/time/PeopleView.tsx`, `PlacesView.tsx`) group by identity
group (KG-ER5), with a fan control (KG-V14).

**KG-X15 · Practice ledger.** KG-PT7 on Goals and on each pen's detail:
minutes, last used, trend strip.

**KG-X16 · Graph-native module view.** A module view kind `graph` that draws
the neighbourhood of a bound list or pattern. Module records stay Items; the
view is layout.

**KG-X17 · Import mapping screen.** For any CSV, paste, or export: draw the
mapping (column → attribute / link / key), preview ten rows, then import.
Saved as a mapping file for the next delta (KG-N5, KG-ER6). [BW] ch.4.

**KG-X18 · Standing patterns on Telegram.** The person saves a pattern and a
schedule; the bot sends matches when they appear ("new items tagged gift-idea
for people with a birthday within 30 days"). Opt-in, one per pattern, quiet
when nothing matches (law 4 "silence is the success test"). [BW] ch.5 change
streams.

**KG-X19 · Mentions panel.** On a person, place, list, or item: every doc,
note, message, and saved link that mentions it, ranked by salience (position
and frequency of the mention), with a monthly mention strip. [BW] ch.12.

**KG-X20 · "Similar items" with reasons.** On item detail: up to five similar
items, each with the shared neighbours that make it similar ("both on Reading
list, both tagged ritual, both linked to Sam"). Explainable by construction.
[BW] ch.12.

---

## 6. Competency questions

_Last mapped: 2026-10-16_

[H] §6.5.1 and [BW] ch.2 agree: write the questions the graph must answer,
then turn each into a test. These are Brain2's. Each becomes a pattern (KG-Q1)
run against `lib/demo-corpus/` in a unit test (KG-Q12). A question that fails
names a gap in the schema or in capture.

| # | Question | Needs |
|---|---|---|
| CQ1 | Which open tasks serve no goal through any path? | KG-D4, KG-Q2, KG-R4 |
| CQ2 | Who did I spend time with during the trip to X, and where? | KG-D10, KG-C5, KG-I6 |
| CQ3 | Which sources support a belief I marked core, and how has their trust changed? | KG-F5, KG-C2 |
| CQ4 | Which books on my Reading list were recommended by a person I know? | KG-D3, KG-I6 |
| CQ5 | What is downstream if I cancel this operation phase? | KG-DEP4–DEP5 |
| CQ6 | Which habits are fed by a tag that no longer has a pen? | KG-I1, KG-M3 |
| CQ7 | On days after under 6 h of sleep, how often did I miss a scheduled task? (n, range) | KG-C1, KG-L1 |
| CQ8 | Which people have I not seen in 90 days but message weekly? | KG-I6, KG-D12 |
| CQ9 | Which places do I visit only with one person? | KG-D10, KG-I7 |
| CQ10 | What did I believe about X in March, and what was added since? | KG-C9, GS-10 |
| CQ11 | Which items were captured by Telegram and never linked to anything? | KG-D12, KG-A2 |
| CQ12 | Which goals depend on a single person or a single task? | KG-DEP6 |
| CQ13 | Which lists have a member that fails the list's shape? | KG-O11 |
| CQ14 | How many minutes of practice in every pen that counts as Spanish, by month? | KG-R4, KG-PT7 |
| CQ15 | Which saved links mention a person or place already in the vault? | KG-N1, KG-X19 |
| CQ16 | Which items look like duplicates of each other, and why? | KG-ER2 |
| CQ17 | Which derived numbers on Home came from data older than a week? | KG-M8, KG-QA4 |
| CQ18 | Which pens are always painted together (co-occur ≥ 80% of their minutes)? | KG-L1, KG-A8 |
| CQ19 | What was due on Oct 3 across habits, reminders, and scheduled items? | KG-C12 |
| CQ20 | Which gift ideas belong to people with a birthday in the next 30 days? | KG-Q3, KG-X18 |
| CQ21 | What did this number on Home count, and which sync wrote it? | KG-M2 |
| CQ22 | Which upstream nodes explain most of this week's misses? | KG-DEP11 |
| CQ23 | Which films I rated highly share a director with ones I have not seen? | KG-I8, KG-Q2 |
| CQ24 | Which formulations lost support since the last review? | KG-L6 |
| CQ25 | Which rooms did I not record anything in this month? | KG-QA8, KG-M4 |

---

## 7. Expansions

_Last mapped: 2026-10-27_

Five directions that use many proposals at once. Each was **Planned**.
E1–E5 are **Landed in part, 2026-10-27**, in the slices in the §5 register.
The rest of each expansion stays planned. None of this opened a wave.

### E1 · The Day Graph: a temporal knowledge graph of a life

Every store emits dated triples onto `day:` and `period:` nodes through the
edge view (KG-D1, KG-D2, KG-C1). Observed streams (screen time, GPS, Telegram
send times, sleep inference, virtual readings) and recorded streams (paint,
completions, notes, reviews) meet on one spine. Periods nest day ⪯ week ⪯
month ⪯ season ⪯ year. Each `PeriodReview` and GS-6 handoff is the named graph
for its period (KG-C8). This gives:

- one query for questions that today span five rooms (CQ2, CQ7, CQ19);
- contextual slices and roll-ups for Data (KG-C7);
- the substrate for rule mining (KG-L1) and root cause (KG-DEP11);
- "as of" for everything (KG-C9).

Build order: read-only projection, then the pattern language, then Data
reading from it, then addressable link targets (KG-D3). It is the [BW] ch.14
knowledge lake at personal scale: the stores stay the raw lake; the Day Graph
is the curated lens.

### E2 · A house ontology with a small, deterministic reasoner

One versioned vocabulary (KG-O1) holds types, relations (domain, range,
traits, chains), counts-as ladders, tag identity, dependency semantics
(KG-DEP2), identity features (KG-ER1), and talkable phrases (KG-NL1). A
stratified Datalog reasoner (KG-R1) computes on read and explains itself
(KG-R2). It feeds rollups, smart lists, shape checks, workflow conditions, and
sentence generation. It answers the open parallel counts-as question the way
[H] would: many parents, entailed on read, stored ids untouched. Module
manifests (rung 2) declare their own small vocabulary and a mapping onto the
house one, so the port wizard (rungs 3–4) becomes a known problem: mapping a
structured source into a graph ([H] §6.4, [BW] ch.4). "Just-enough
semantics" ([BW] ch.2) keeps it small: a term enters when a competency
question needs it.

### E3 · An evidence layer across every room

`formulation` items (GS-5) link `inferred-from` to observations in *any*
store, not only Sources. Strength recomputes the `belief-strength.ts` way.
Fact-finder trust (KG-F5) and contradiction lists (KG-R8) feed it. When the
evidence under a formulation moves, the next review raises it (KG-L6). The
graph still never rewrites itself (idea #83 stays out). This is [H]'s
deductive + inductive pairing with the person as the only author of a
quantified statement.

### E4 · A self-describing house

The machinery graph (KG-M1) plus lineage (KG-M2), impact (KG-M3), the default
graph (KG-D6), and owners for automations (KG-M7) make Brain2 able to explain
its own numbers. Every derived value can answer "where from?" and every delete
can answer "what reads this?". The Names overlay (`data-ui-name`) becomes a
door into the graph (KG-M6). This is [BW] ch.8's metadata graph turned inward,
and it is the GS-7 Structural Differential with real rows.

### E5 · A grounded assistant (needs the person's decision)

BIM and Cmd-K answer questions in plain words, but every answer is assembled
from vault triples, with the triples shown. Phase one needs no model at all:
rule-based questions (KG-NL3) and ontology-driven sentences (KG-NL2). Phase
two, only if the person opts in (section 8, tier B): a small model may
*rephrase* the question into a pattern the person can see before it runs, and
*phrase* an answer from the returned triples, citing each. If no triple
supports a sentence, the sentence is not said. This is [KL]'s "graphs ground
models" with the house's laws on top.

---

## 8. Language model idea bank

_Last mapped: 2026-10-16_

**Status: idea bank. Not a plan, not a wave, and partly against current
law.** The house law today: no runtime model judges a coincidence, writes a
card, fits a weight, or summarizes a year; LLM mapping assist is allowed at
install time only (Wave 10 open item 3; [`MODULE_PLATFORM.md`](MODULE_PLATFORM.md)
rung 4). [`analytics-vision/06-language.md`](analytics-vision/06-language.md)
already names models and embeddings as an unbuilt intention for reading stored
prose. This section lists what cheap or nearly free models *could* do, sorted
by how far each sits from that law, so the person can decide. Nothing here is
approved by being written down.

### 8.1 Tiers

| Tier | What the model may do | Law status |
|---|---|---|
| **A · Install time** | Map a module's or import's fields onto the vocabulary once; draft talkable phrases; draft a shape. The person reviews the result; afterwards everything is deterministic. | Allowed today (rung 4). |
| **B · Suggest at capture** | Propose a list, tag, link, entity, or date for raw text. The suggestion is shown, marked **inferred** with the est. mark, and written only on accept. | Needs the person's yes. |
| **C · Phrase, never judge** | Turn a question into a visible pattern; phrase an answer from triples with citations; clean OCR text. | Needs the person's yes. |
| **D · Judge** | Decide a finding, a cause, a weight, a grade, an identity label, or a summary of a period. | **Refused.** Stays out. |

### 8.2 Guardrails for any tier

1. **Off by default.** One switch in Settings, per tier, with the model named.
2. **Deterministic first.** The model runs only when the rule-based path
   (smart-parse, BIM grammar, `name-resolve.ts`) returns nothing or ties.
3. **Closed outputs.** The model chooses from existing ids: lists, tags,
   relations, people, pens. A new list or relation is never invented
   silently (KG-NL7; [BW] relation proliferation). Output is JSON checked
   against a schema; a malformed answer is dropped.
4. **Inferred and marked.** Anything accepted is written with order
   **inferred** on the ledger line, `source: "model:<name>"`, until the person
   edits it, at which point it is **recorded**.
5. **Private subgraphs never leave.** KG-P7 marks (cycle, sleep, mood, intake,
   a person's notes) are never sent to a hosted model. Local models only, or
   nothing.
6. **Cost caps.** Cache by text hash; batch overnight; a daily call cap; a
   visible counter in Settings → Data. Unchanged text is never re-sent.
7. **An evaluation set.** `lib/demo-corpus/` plus a small labelled fixture of
   captures. A model is enabled only if it beats the rule-based path on that
   set, and the score is shown.
8. **Explain or stay quiet.** Every suggestion shows the words it came from
   (KG-NL8). A suggestion with no evidence span is not shown.
9. **Undoable.** Every accepted suggestion is one Cmd/Ctrl-Z, like any write
   (`lib/action-history.ts`).

### 8.3 Cheap model options (for the person to choose)

No prices are stated here; they change. Ordered from most private to least.

- **Rules and small classical models, no LLM.** Naive Bayes or logistic
  regression trained on the person's own filed captures (which list each
  capture went to) can sort text into lists with no network and no large model.
  Counts-based, inspectable, retrains in milliseconds. Often enough for
  "which list does this go in". *Still a learned model; it needs the same yes
  as tier B.*
- **In-app small models.** Small transformer models running in the Electron
  renderer or a worker (for example via transformers.js): a small
  named-entity model like the `bert-base-NER` family [BW] ch.12 uses, and a
  small sentence-embedding model for similarity. Offline, free per call, a few
  hundred MB on disk.
- **On-device system models.** Apple's on-device foundation model framework on
  macOS and iOS (relevant to the Capacitor iOS build), where available. Free per
  call, private, small.
- **Local open-weight models via a local runner** (Ollama or similar) with a
  small instruction model (1–4B parameters). Free per call, private, needs the
  machine to run it.
- **Hosted small models.** The smallest current Claude model, Claude Haiku 5.5
  (`claude-haiku-5-5`), with batch requests and prompt caching for repeated
  instructions. Cheapest hosted option per useful answer; text leaves the
  device, so guardrail 5 applies.

### 8.4 Ideas

Grouped by room. Each names its tier.

**Inbox and capture**

1. *Sort to list* (B). For an unfiled capture, suggest up to three lists from
   the person's existing ones, ranked, with the words that matched. Accept with
   one key in the Inbox walk.
2. *Split a run-on capture* (B). "call mom, buy oat milk, book dentist" →
   three items, each with its suggested list. Rule-based comma split first.
3. *Entity and relation suggestions* (B). From a capture or note, suggest
   links to existing people, places, items, and goals, using only vocabulary
   relations (KG-NL7), with evidence spans (KG-NL8). [KL] "models help build
   graphs".
4. *Date and duration fallback* (B). When `smart-parse.ts` finds no date in
   "the thursday after next" or "sometime before the trip", suggest one, marked
   inferred.
5. *Tag normalisation* (B). Suggest merging near-duplicate tags ("work-out",
   "workout", "exercise") into one tag identity with aliases (KG-I1).
6. *Alias suggestions* (B). "OB" in five captures resolved to Ocean Beach by
   hand → offer it as an alias (KG-NL6).
7. *Title cleanup* (B). Turn "ok so i need to maybe call the landlord abt the
   sink??" into "Call landlord about the sink", keeping the original in `body`.
   The person's words stay theirs; the title is offered, not forced.
8. *Message intent fallback for BIM* (B). When the Telegram grammar
   (`command-catalog.ts`) finds no command, classify the message into one of
   the existing commands or "just a note", shown as "Did you mean: log … ?".
9. *Voice and OCR cleanup* (C). Clean transcription and OCR text
   (`lib/ingest/ocr.ts`, scanned pages) for search, keeping the raw text.
10. *Receipt line mapping* (B). Map receipt lines to grocery items and spend
    categories when `lib/ingest/receipt-parse.ts` leaves them unknown.

**Lists, types, and modules**

11. *Import column mapping* (A). On KG-X17, propose which column is the key,
    which are attributes, which are links, and which datatype each is.
12. *Module install mapping* (A). Rung 4 as written: map an outside app's
    records onto Items, types, and the vocabulary once.
13. *Draft a shape* (A). From 20 sample members, propose a type shape (KG-O10)
    for the person to edit.
14. *Draft talkable phrases* (A). For a new relation or type, draft the direct
    and inverse sentence forms (KG-NL1).
15. *Type suggestion* (B). For an `item`-typed record, suggest a type from the
    catalog, alongside the counted suggestion (KG-F2), and show which agreed.

**Search and reading**

16. *Semantic search* (B, embeddings). A local embedding index over titles,
    bodies, notes, docs, and saved links. Hybrid ranking: keyword
    (`lib/search.ts`) first, then embedding similarity, then graph proximity
    (KG-A9). Results show why each matched.
17. *Similar notes* (B, embeddings). "Notes like this one" on item detail,
    beside the explainable graph version (KG-X20). Two columns, labelled, so
    the person sees which method found what.
18. *Duplicate candidates* (B, embeddings). Feed embedding similarity into
    KG-ER2 as one more weak identifier, never as a strong one.
19. *Document entities* (B). Extract people, places, and works from PDFs
    and docs to fill the mentions panel (KG-X19), linked only to existing
    nodes or offered as emerging ones.
20. *Question to pattern* (C). In Cmd-K or BIM, turn a question into a KG-Q1
    pattern and show it before running ("I'll run: ?p seen-with Sam · during
    last week"). The person can edit the pattern. [BW] prints the generated
    query as the explanation; [KL] "models simplify querying".
21. *Answer phrasing with citations* (C). Phrase the triples a pattern
    returned into one or two sentences, each sentence linked to its triples.
    If the triples do not support a sentence, it is cut. Grounded generation
    ([KL]).

**Docs, beliefs, and reviews**

22. *Formulation drafting* (B). In the weekly Infer step, offer wordings for a
    formulation the person has already chosen to write, from the Describe
    facts. The person edits; the model never proposes *what* to conclude.
23. *Extensional rewrite help* (B). GS-4 already offers an indexed, dated
    rewrite of an allness sentence. A model could offer a smoother wording of
    that rewrite, keeping the vault counts the deterministic check found.
24. *Source summaries* (B). Fill `summaryShort` / `summaryLong` on a Source
    (idea #58), marked inferred, from the source's own text only.
25. *Claim extraction from a source* (B). Offer statements a Source makes as
    candidate `formulation` items with evidence spans, linked
    `supported-by` the source. Accept one at a time.
26. *Contradiction hints* (B). Flag pairs of formulations whose wording looks
    opposed, for the person to read. The contradiction list (KG-R8) stays
    rule-based; this only adds candidates.

**People and places**

27. *Interaction notes to facts* (B). From a dated note on a person ("Sam
    starts the new job in March"), offer structured facts (job, date) as
    attributes with the note as evidence.
28. *Gift-idea extraction* (B). From messages and notes that mention a person,
    offer gift ideas to their Gift ideas list (when Close is on).
29. *Place naming* (B). For an unnamed repeated GPS cluster, suggest a name
    from nearby captures and receipts on the same days. Never from a map
    service without the person's yes.

**Data (kept narrow)**

30. *Chart captions from numbers* (C). Phrase a caption from a computed result
    *and its range and n*, in the GS-2 shape, without adding any claim the
    numbers do not hold. A failing check (missing range or n) drops the
    caption.
31. *Miss-reason grouping* (B). Group free-text why-not answers
    (`miss-reason-corpus.ts`) into the person's own named buckets, offered for
    accept. The counts per bucket stay classical.
32. *Language view support* (B). [`06-language.md`](analytics-vision/06-language.md)'s
    sentiment and topic readings, shown beside classical counts and labelled
    inferred, only if the person enables it.

**Infrastructure**

33. *Nightly batch* (B). All tier-B work for the day's new captures runs once
    overnight in a batch, writing suggestions to a review queue for the
    morning walk. Cheapest pattern; no latency at capture.
34. *Disagreement log* (B). When the model and the rule-based path disagree,
    log both; the weekly review shows the rate, so the person can see whether
    the model earns its place.
35. *Model card in Settings* (all). Which model, where it runs, what it may
    see, how many calls this week, its score on the evaluation set, and the
    off switch.

**Changed 2026-10-30 (the person's decision).** BIM's routed flow
(`lib/bim-flow/`, bench `/lab/bim-flow`) will auto-file without accept. Each
write is tagged `autowritten` and `llm`, carries its reasoning, and is one
undo. A correction becomes a taught example on that node. **Planned**, not
built. See `components/Lab/BimFlow/README.md`.

**Refused even with a model** (tier D): writing findings, naming causes,
judging the person, auto-filing without accept, summarising a period, changing
a weight or a grade, rewriting the graph when a source arrives, inventing
relations or lists, and deciding identity merges.

---

## 9. Build order

_Last mapped: 2026-10-16_

A suggestion for when a wave claims this work. Each phase is useful alone.

| Phase | Work | Ids | Why first |
|---|---|---|---|
| 0 | Competency questions as failing tests; this doc linked | §6, KG-Q12 | Defines done before code |
| 1 | Vault edge view (read only) + node addresses + default graph | KG-D1, D2, D6, D14 | Everything else reads it |
| 2 | Vocabulary file: relations with inverse, domain, range, traits, talkable phrases | KG-O1–O4, KG-NL1, KG-DEP1 | One contract ([BW] ch.2) |
| 3 | Pattern language + paths + Cmd-K pattern bar | KG-Q1–Q5, KG-X1 | The first visible payoff |
| 4 | Machinery graph + lineage + impact before delete | KG-M1–M3, KG-X8, KG-X13 | Explains numbers; prevents loss |
| 5 | Read-time reasoner with proofs; rollups on chains | KG-R1–R4, KG-X3 | Goals and operations add up |
| 6 | Edge provenance from the ledger; as-of | KG-C2, C3, C9, KG-X9 | Time on edges without new columns |
| 7 | Identity: tag ids, aliases, `same-as`, the matcher, identity review | KG-I1–I6, KG-ER1–ER8 | People and places become one each |
| 8 | Dependencies: additive/redundant, impact, SPOF, validations | KG-DEP1–DEP10 | Plan honesty |
| 9 | Quality page + shapes + shape induction | KG-QA1–QA12, KG-O10–O14, KG-X6 | The graph measures itself |
| 10 | Data: centrality, orphans, communities, rule mining in Observatory | KG-A1–A17, KG-L1–L10 | Inductive knowledge, counted |
| 11 | Ingest: mention linking, import mapping screen, evidence spans | KG-N1–N14, KG-X17, KG-NL8 | Capture writes edges |
| 12 | Visual plates: neighbourhood, edge inspector, schematics | KG-V1–V16 | Furniture for all of the above |
| 13 | Rule-based language: sentences and questions | KG-NL2–NL6 | Talks without a model |
| 14 | Export: vocabulary page, JSON-LD, hub node lookup | KG-P1–P6 | The person keeps the means |
| — | Language model tiers A–C | §8 | Only after the person decides |

Lanes from [`PLAN_OF_ACTION.md`](PLAN_OF_ACTION.md): phases 1–2, 5–7 are the
Item lane; 3 is Shell (Cmd-K); 4 is History/Backup/Workflows; 9–10 are
Data; 11 is Capture-adjacent ingest; 12 splits by room.

---

## 10. Refused, and why

_Last mapped: 2026-10-16_

| Idea (source) | Why not |
|---|---|
| Knowledge graph embeddings, GNNs, learned link prediction at runtime ([H] §5.2–5.3, [BW] ch.7) | Law 3; "predictive or ML analytics" is out. Counted similarity and rule mining cover the useful part. |
| Writing predictions back as relationships, refreshed on a schedule ([BW] ch.7) | Law 9. Suggestions wait for an accept. |
| Materialising entailments into the stores ([H] §4.3.1) | One write door; derived stays derived and computed on read. |
| A `concept` type, or a tag/day/edge record type | Item is the only noun; GS-5 forbids `concept`. Addresses, not nouns. |
| Certainty or provenance columns on `ItemLink` | GS-10 and idea #77. Provenance comes from the ledger; a relation that needs certainty becomes a formulation. |
| Self-updating graph when a source arrives (idea #83) | Locked out by GS-10 and law 9. |
| A graph database server (Neo4j or a triplestore) | Offline-first plain JSON; the vault is small; the edge view is enough. RDF/JSON-LD is an export, not storage ([BW] ch.2 agrees: the wire format need not be the store). |
| Full OWL reasoning, tableau, description logics ([H] §4.3.2) | Costly and undecidable in general; positive Datalog with stratified negation is enough here. |
| Closed-world reading of the whole vault | The vault is incomplete by nature. Local closed world only where the person says so (KG-O9). |
| Anonymous federation with other people's graphs | No social layer is planned; sharing stays a file the person sends. |
| Model tier D (§8.1) | Judges, causes, summaries, and silent writes stay out. |

---

## 11. Open questions for the person

_Last mapped: 2026-10-16_

1. **Parallel counts-as for types, tags, and lists.** Pens already have many
   parents. [H] would allow many parents everywhere, entailed on read.
   [`COUNTS_AS.md`](COUNTS_AS.md) keeps this open. Yes or not yet?
2. **Language model tiers.** Which of tiers A, B, C (section 8.1), if any, and
   with which model class from 8.3? Tier A is allowed today.
3. **Embeddings.** Local embeddings for search and duplicate candidates only
   (ideas 16–18), or none?
4. **Which wave.** Wave 10 (Ontology) for phases 1–2 and 5–7, Wave 12 (Wiki
   links) for KG-N2, or a new wave for the whole plan?
5. **Graph plate placement.** KG-V1 on item detail as a new tab, or inside the
   existing Related panel?
6. **Practice ledger and peer graph.** KG-PT7 and KG-PT9 read personal time
   with people. Keep them private-by-default under KG-P7, or skip KG-PT9?
7. **Standing patterns on Telegram.** KG-X18 sends messages on a schedule.
   Allowed, given "silence is the success test", if it only speaks on a match?
