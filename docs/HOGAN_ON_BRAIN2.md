# Hogan et al. on Brain2

_Last mapped: 2026-10-28_

Source: Aidan Hogan et al., *Knowledge Graphs* (arXiv:2003.02320v6, 2021). A knowledge graph is a graph of data meant to accumulate and convey knowledge of the real world. Nodes are entities. Edges are relations. Simple statements are edges. Quantified statements need a schema or rules. Further knowledge is entailed (deduction) or guessed from patterns (induction). A graph built from many sources needs schema, identity, and context, then creation, quality, and refinement.

Brain2 is an enterprise knowledge graph of one person (§10.2), not an open web graph. Two projections stay two:

- **Item graph.** Every vault row is a node (`Item` / `Task` in `lib/types.ts`). Edges are `ItemLink` `{ relation, targetId, stance?, weight? }`, stored on the source only. Backlinks are an index (`lib/task-index.ts`). Vocabulary, lattice, rules, and checks live in `lib/links.ts` and `lib/graph/`.
- **Day spine.** A read-only triple projection (`lib/graph/vault-graph.ts`): `s, p, o, graph, order, at`. Orders are `observed | recorded | derived | inferred`. This is the paper’s named-graph and provenance idea (§2.1.5, §3.3) for time, capture, and messages. It is not a second place to write links.
- **Scheduler edges** (`dependencies`, `parentTaskId`) stay off the knowledge graph.

`docs/KNOWLEDGE_GRAPH_PLAN.md` is the numbered idea bank (238 proposals). `docs/LINKS_REDESIGN.md` is the part that was built. This file is the section-by-section reading of the paper against the vault, including what that reading shipped.

## Laws

From `docs/LINKS_REDESIGN.md` §15–§16.

- Links stay on the source. The reverse is a question, not an automatic second write.
- Rules derive on read. Pinning stores a real link. Derived edges are not cached.
- A relation merge is an alias (`aliasOf`). Stored link ids do not change. `same-as` does not fuse two items.
- No certainty column on `ItemLink`. Certainty belongs on a Belief, with evidence links.
- No embedding score on the Links tab. A suggestion needs a sentence.
- No graph database and no SPARQL endpoint. Offline JSON and the ego index are the store.
- No model runs inside the app. A model may read a snapshot and return a proposal file. Nothing is written without an accept. The in-app proposer (L8.3) stays deferred.

## What this reading shipped

1. **Co-time** on the Links shelf for person items. Company blocks both people are named on become sittings (`lib/graph/densify/co-time-rows.ts`). The floor is 7. The relation is `spends-time-with`. Dismiss and mute still apply.
2. **Quality strip** on the weekly graph review (`lib/graph/graph-quality.ts`): beliefs with no evidence, sources never linked, functional collisions, open `same-as`, suggestion sources dismissed five or more times.
3. **House questions** on the item graph: `unsupported beliefs`, `shared names`, `unpinned derived`, and `via <relation> <title>`.
4. **Lattice on paths.** `family-of Ada` in the path box, and `via family-of Ada` in search, walk child relations such as `mother-of`.
5. **External ids** on a person (`personProfile.wikidata`, `orcid`, `isbn`, `url`) and on a Source (the same attribute ids). Identity match prefers an exact id. It still only proposes `same-as`.
6. **Mentions** quote the note sentence and drop the row when the relation’s scope does not fit.
7. **Competency tests** in `lib/graph/competency.test.ts`: belief strength moves when a trusted source supports it; a `same-as` proposal does not delete either person; a private item is absent from the snapshot.

A counter that proposes a chain rule into the inbox when a path keeps repeating stays later. It is counting, not a model, and it is not built.

## §2 Data graphs

The item graph is a directed edge-labelled graph. A missing edge is unknown, not false. Item types are the heterogeneous-graph idea. `stance` and `weight` are the only edge properties. The spine’s `graph` field is a light named graph.

Edges still cannot carry their own valid time. An n-ary fact is its own item (a Belief, a visit), then linked. That is the paper’s n-ary pattern without reification. There is no graph database.

## §2.2 Querying

Neighbourhood (`egoEdges`, `secondRing`), undirected BFS to depth 6 (`linkPath`), the ego matrix, and one-hop smart-list rules are the query layer. House questions over the spine stay: people during a block, places with one person, captures never linked, people messaged but not seen.

`linkPath` takes an optional `along` filter: a step counts when its relation is the asked relation or a child in the lattice (`lib/graph/relation-lattice.ts`). Search uses the same walk for `via family-of Ada`. There is no SPARQL, Cypher, or regular-path language the person writes.

## §3.1 Schema

`parent` is `subPropertyOf`, rooted at `related`. `fromTypes` / `toTypes` are domain and range. Traits (transitive, acyclic, functional, inverse-functional, disjoint) are checks, not a blocked save. Item types are the class side. There is no OWL and no SHACL.

There is still no local-closed-world flag on a list. A missing link stays unknown.

## §3.2 Identity

Stable ids. Relation aliases. `same-as` / `different-from` are real relations and do not merge records. `lib/graph/identity-match.ts` proposes `same-as` from a shared name, a shared Instagram handle, or a shared external id (`lib/graph/external-ids.ts`: Wikidata `Q…`, ORCID, ISBN-10/13, http URL). An external id wins the reason when both match. A source is compared only by id, not by title, so a book named Sam does not match a person named Sam.

Queries do not silently union `same-as` twins. The person is editing one record.

## §3.3 Context

Spine order, `lib/graph/machinery.ts`, source `origin` and `trust`, belief `certainty`, and derived strength stay the context. Co-time is the temporal signal on the shelf: shared painted minutes over the shorter person’s Company minutes, with a since-month in the reason. There is still no `validFrom` on `ItemLink`. A fact that expires is its own item.

## §4 Deductive knowledge

Chain rules of length 1–3, transitive closure to depth 6, proofs, derive-on-read, and dry run are the reasoner (`lib/graph/ego-reason.ts`). Subsumption is not emitted as extra edges. The lattice answers “is this `family-of`?” inside path, search, checks, and list rules. Belief strength is a separate score over evidence links and source trust.

No OWL reasoner. No negation. Cardinality is a check, not an entailed repair.

## §5 Inductive knowledge

Ego degree, clustering, and open triads. Weekly link-edits. Densify with a reason: reciprocal, Adamic–Adar triad, co-member, mention, co-time, rule expectation, inbox proposals. Identity link prediction is name, handle, and external id, not an embedding.

No PageRank, community detection, GNN, or embedding rank on the Links tab. `relation-word` is still a source name without a producer.

## §6 Creation and enrichment

The person is the extractor: composer, relation library, shelf, inbox. Mentions are a narrow entity link. A full title matches in the title, description, body, notes, note log, or another text field. A close person also matches by first name and nickname, once per name. The relation is `mentioned`. A hit in the title is written; the rest wait on the shelf. The reason quotes the sentence, and the row is omitted when neither `mentioned` nor `related` fits the types. Ingest does not extract relations from prose. The graph snapshot is the file door for an outside model.

Competency questions for the schema that already exists are the three tests in `lib/graph/competency.test.ts`.

## §7 Quality

The weekly strip (`GraphReviewSection`, `data-testid="graph-quality"`) is five counts, each a list:

- Beliefs with no supports or refutes link.
- Sources with degree zero.
- Functional and inverse-functional collisions.
- Open `same-as` proposals in the inbox.
- A densify source whose current suggestions have been dismissed at least five times (`NOISY_SOURCE_FLOOR`).

There is no single quality score, no gold graph, and no automatic repair.

## §8 Refinement

Completion is the shelf and the weekly five, plus co-time. Identity completion does not canonicalise. Correction is a check on the ledger. External identifiers are the only cross-graph link, and only as a field the person pastes.

## §9 Publication

The snapshot and the full backup are the dump end of the paper’s access spectrum. Private items and note bodies stay out. There is no SPARQL endpoint and no JSON-LD serialisation.

## §10 Applications

Search answers the house questions, then falls through to text. `via family-of Ada` is the semantic-search pattern: a relation plus a name, lattice-aware, with the path in the sentence. Recommendations are the densify shelf. The personal agent is the file door. L8.3 stays paused.

## §11 What stays put

Scale is the ego index and derive-on-read. New modules project into the spine or the item graph. The Links tab, the weekly review, and search are the surfaces. There is no query console.

## What stays refused

Graph database, SPARQL endpoint, OWL reasoner, automatic reverse links, certainty on edges, embedding ranks on the Links tab, self-updating graph, rewriting stored relation ids on merge, fusing two items because of `same-as`, OpenIE over the diary, web fact-checking of personal beliefs.
