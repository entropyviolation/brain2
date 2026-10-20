# Links and relations redesign plan

_Last mapped: 2026-10-16_

> **Mostly built** (2026-10-16). The status board says what is left. It picks up where [`PERSON_DETAIL_REDESIGN.md`](PERSON_DETAIL_REDESIGN.md)
> Phases 5–8 stop (the rich Links tab for every item). It takes the deeper
> ideas from [`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md) and gives
> them a home on item detail. Where an idea has a `KG-…` id there, this file
> cites the id and does not repeat the argument.

The Links tab becomes the place where the vault turns into a knowledge graph
one item at a time. The person names relations. Each relation knows its
reverse, its parent relation, and its traits. Rules state what follows from
what. The tab draws the item's neighbourhood. It shows the edges that follow
from rules, and keeps asking, quietly, which edge is still missing. A
language model sits at the table only through files: it reads an exported
snapshot and hands back proposals. It never writes, and no model runs
inside the app.

The graph gets denser because every open of the tab offers a few honest
edges with reasons, not because anything writes itself.

---

## Contents

0. [How to use this file](#0-how-to-use-this-file)
1. [Status board](#1-status-board)
2. [What exists today](#2-what-exists-today)
3. [Invariants: what must not break](#3-invariants-what-must-not-break)
4. [The idea in one page](#4-the-idea-in-one-page)
5. [The math](#5-the-math)
6. [Data model (additive only)](#6-data-model-additive-only)
7. [The Links tab, top to bottom](#7-the-links-tab-top-to-bottom)
8. [The Relations library](#8-the-relations-library)
9. [Rules and patterns](#9-rules-and-patterns)
10. [Densify: where new edges come from](#10-densify-where-new-edges-come-from)
11. [Person and model at one table](#11-person-and-model-at-one-table)
12. [Concepts, categories, labels, vocab](#12-concepts-categories-labels-vocab)
13. [Visual grammar](#13-visual-grammar)
14. [Steps](#14-steps)
15. [Decisions made](#15-decisions-made)
16. [Refused, and why](#16-refused-and-why)
17. [Open questions for the person](#17-open-questions-for-the-person)
18. [Handoff log](#18-handoff-log)

---

## 0. How to use this file

- Read sections 2–3 before touching code. They are the ground truth and the
  fence.
- Take one step from section 14. Each step names its files, what to do, its
  tests, and a handoff line. Steps marked **∥** can run in parallel with the
  others in their phase.
- Finish [`PERSON_DETAIL_REDESIGN.md`](PERSON_DETAIL_REDESIGN.md) steps
  6.2–6.5 and 8.1 first. Phase L1 here can start before them. Every later
  phase draws on their furniture.
- Tick the board, add a handoff line, and update
  `components/ItemDetail/README.md` and `lib/README.md` as you go (CLAUDE.md).

---

## 1. Status board

| Step | Title | Depends on | Status |
|------|-------|-----------|--------|
| L0.1 | Board truth: mark PD 5.2 and 6.1 built | — | ☑ |
| L0.2 | Ship PD 6.2–6.5 and 8.1 (rich Links tab everywhere) | PD plan | ◐ panel mounted in popup and page; PD board rows not re-checked |
| L1.1 | Vocabulary v2 fields on `RelationDef` | — | ☑ |
| L1.2 | Relation lattice helpers (`lib/graph/relation-lattice.ts`) | L1.1 | ☑ |
| L1.3 | Seed hierarchy for built-ins and person seeds | L1.2 | ☑ |
| L1.4 | Persist bump that carries `relations` | L1.1 | ☑ |
| L2.1 | Relations library tab in `ItemTypesLibrary` | L1.1 | ☑ |
| L2.2 | Relation sheet (edit, traits, phrases, usage) | L2.1 | ☑ |
| L2.3 | Merge as alias (no link rewrite) | L2.2 | ☑ |
| L2.4 | Relation schematic (hierarchy diagram) | L1.2, L2.1 | ☑ |
| L3.1 | Rule records + store | L1.4 | ☑ |
| L3.2 | Ego reasoner with proofs (`lib/graph/ego-reason.ts`) | L1.2, L3.1 | ☑ |
| L3.3 | Derived edges on the tab + **with derived** switch | L3.2, L0.2 | ☑ |
| L3.4 | "Why is this here?" proof card | L3.3 | ☑ |
| L3.5 | Rule editor + dry run | L3.2, L2.1 | ☑ |
| L4.1 | Suggestion core (`lib/graph/densify.ts`) | L0.2 | ☑ |
| L4.2 | Deterministic sources (reciprocal, triad, co-member, mention, co-time) | L4.1 | ◐ co-time not wired to tracking |
| L4.3 | Suggestions shelf + dismiss + mute a source | L4.1 | ☑ |
| L4.4 | Density readout (degree, clustering, open triads) | L4.1 | ☑ |
| L5.1 | Checks: scope, functional, acyclic, irreflexive, disjoint | L1.2 | ☑ |
| L5.2 | Checks on the ledger and in the composer | L5.1, L0.2 | ☑ |
| L6.1 | Matrix view | L0.2 | ☑ |
| L6.2 | Path between two items | L1.2 | ☑ |
| L6.3 | Edge inspector sheet | L0.2 | ☑ |
| L7.1 | Ego patterns → smart list (bridge to KG-Q1/Q6) | L3.2 | ☑ |
| L8.1 | Proposal inbox (store + review UI) | L4.3 | ☑ |
| L8.2 | Graph snapshot export + proposal file import | L8.1 | ☑ |
| L8.3 | Model tier B proposer | L8.1 | ⏸ deferred (§15, 2026-10-16) |
| L9.1 | Weekly graph review section | L4.2, L8.1 | ☑ |
| L9.2 | Density over time | L4.4 | ☑ |
| L10.1 | Docs sweep + screenshots | all | ◐ READMEs done; screenshots not taken |

---

## 2. What exists today

_Last mapped: 2026-10-16_

**Storage.** `Task.links: ItemLink[]` (`lib/types.ts` ~79):
`{ id, relation, targetId, stance?, weight? }`. Stored on the source item
only. Backlinks are found by scanning (`useTaskStore.getBacklinks`,
`lib/task-store.ts` ~717) or through the cached index in `lib/task-index.ts`.

**Built-in relations.** `RELATIONS` in `lib/links.ts`: blocks, supports,
refutes, reviews, goal-of, checklist-of, objective-of, subgoal-of, part-of,
phase-of, resource-of, related, plus the evidence pair (`supported-by`,
`refuted-by`) with `stance`. Unknown ids read as symmetric and show the raw
id. `relationLabel`, `inverseRelation` and `inverseRelationLabel` fall back
to the registry.

**Registry.** `lib/relation-registry.ts`: built-ins, then code seeds (person
relations from `lib/person-relations.ts`), then custom relations from
`useItemTypeStore.relations`. Built-in ids always win. Archived relations
still resolve. `relationsFor(fromType, toType)` returns scoped relations
first. `createRelationPair` makes one relation (symmetric) or two that
point at each other (`rel-<slug>-<rand4>`).

**Person seeds.** `lib/person-relations.ts`: family, friend, romance, work,
group, and place relations scoped to the person type. Inverses can be
many-to-one: `mother-of` reads back as `child-of`, and `child-of` reads back
as `parent-of`. That is a hidden subrelation (`mother-of` ⊑ `parent-of`).
L1.3 names it. `RELATION_WORDS` maps Relation-field words to seeds.

**Ego graph.** `lib/link-graph.ts`: `egoEdges(item, all, derived)` gives
out, in, mutual and derived edges. Mutual merging uses
`canonicalRelation = min(R, inverse(R))`. Derived edges drop when a real
edge has the same key. Also `secondRing` and `relationFamily`. 22 tests
green across registry, ego graph and person seeds.

**UI today.** `LinkPicker` + `RelatedItemsPanel` on the popup Links tab and
the page Related card. PD Phase 6 replaces them with
`components/ItemDetail/links/` (composer, ledger, radial plate,
`RichLinksPanel`).

**Other edges that already behave like relations** (KG plan §3.1): list
membership, list-to-list links, dependencies, item-valued attributes, pen
parents, pen "always means" links, `checklist-of` deriving deadlines,
`supported-by` feeding `lib/belief-strength.ts`. This plan leaves them in
their stores. KG-D1 (vault edge view) reads them later.

**Graph layer** _Last mapped: 2026-10-16_ (L3–L9). Pure code in `lib/graph/` (see `lib/README.md`). The Links tab reads it through `components/ItemDetail/links/use-links-graph.ts`. Library views in `components/Analytics/relations/`. Weekly section in `components/Reviews/GraphReviewSection.tsx`.

Where the build differs from the text below:

- Per-viewer settings (with derived, muted sources) live in `brain2-links-view`, not `user-settings-store`.
- The inbox UI sits in the Relations library (**Inbox** view), not Settings → Data. Accept writes through `commitItemDraft` with the proposal origin as source; `model:` origins land `inferred`.
- The composer's cycle question is `window.confirm`, not `CycleConfirmDialog`.
- `reciprocal` skips symmetric relations: one stored link says it both ways.
- Edge inspector shows no created date yet (needs a per-link read of `lib/item-activity.ts`).
- Density over time (L9.2) is link edits per week from the ledger. Mean clustering and linkability show for now only; there are no snapshots to chart them over time.
- L7.1 `link` condition: `applyMembershipRulesToTasks` sees backlinks; a single-task apply reads the item's own links only.

**Status board drift.** Fixed (L0.1): the PD board shows 5.2 and 6.1 as ☑.

**Vocabulary v2** _Last mapped: 2026-10-16_ (L1.1, L1.4). `RelationDef`
carries the §6.1 fields. `getRelationDef` merges `BUILTIN_TRAITS`
(`lib/graph/builtin-traits.ts`, empty until L1.3) and
`useItemTypeStore.relationOverrides` into a cached copy, and resolves
`aliasOf` once. `rawRelationDef` gives the stored def. Persist is v3.

---

## 3. Invariants: what must not break

These hold for every step. A step that breaks one is not done.

1. **One link store.** `Task.links` keeps its shape. New optional fields on
   `ItemLink` are refused (KG law 5) except what GS-5 already allows
   (`stance`, `weight`).
2. **No link is ever rewritten in bulk.** Not by a merge, a rename, a rule,
   or an import. A merge is an alias read at load time (L2.3).
3. **Built-in ids are frozen.** Their ids, labels, inverses, and the
   evidence and stance behavior in `lib/links.ts`. New traits on a built-in
   come from a side table (L1.3), not from editing `RELATIONS` in place.
4. **Unknown ids stay symmetric** and show the raw id.
5. **Readers keep working.** Belief strength, objectives, operations,
   gravity, needs-attention, item merge, the task index, event links. Run
   their tests in every step that touches `lib/links.ts` or the registry.
6. **One write door.** Link edits are draft edits (`addLink`, `removeLink`
   on `useItemDetailDraft`) saved by `commitDraft` → `commitItemEdit`. The
   unsaved guard covers them. Vocabulary edits (relations, rules) write the
   item-type store at once, as PD decision 5 already does.
7. **Derived is never stored.** Rule results, suggestions, and density are
   computed on read. Pinning a derived edge writes a real link (recorded).
8. **Reciprocity is asked, not written.** A link on A never writes a link on
   B. The ledger offers **Confirm** on an in-only row. A relation may ask
   more or less often (L1.1 `reciprocity`), never silently.
9. **Offline, plain JSON, `brain2-*` keys.** Demo profile isolation holds.
   Full backup (`lib/data/backup.ts`) carries every new vocabulary field.
10. **No "should" in chrome.** Checks state facts in neutral ink.
11. **Fast tab.** The Links tab stays ego-scoped: work is bounded by the
    item's degree and its second ring, never by vault size. Vault-wide
    passes run only in the weekly review and are cached by array identity.

---

## 4. The idea in one page

Three layers, each one usable alone:

| Layer | What it is | Where it lives | Order (KG law 4) |
|---|---|---|---|
| **Vocabulary** | Relations with reverse, parent, traits, phrases, scope | `useItemTypeStore.relations` + code seeds | — (schema) |
| **Facts** | Links the person made or accepted | `Task.links` | recorded |
| **Consequences** | What follows from facts + rules, and what might be missing | computed on read | derived · inferred |

Four seats at one table:

| Seat | Can | Cannot |
|---|---|---|
| **Person** | Write links, name relations, write rules, accept or dismiss anything | — |
| **Rules** | Derive edges with a proof | Write |
| **Densify** (deterministic) | Suggest edges with a reason and a score | Write, judge |
| **Model** (off by default) | Propose edges or relation names from closed lists, with evidence | Write, judge, invent ids silently |

The loop: open an item → see its neighbourhood → derived edges show dotted
with "why" → up to five suggestions with reasons → accept writes a real
link → the next open has more to reason from. Each accept makes the graph
denser and the next suggestions better. That is the "living" part, and it
needs no model.

---

## 5. The math

_Plain notation. Every operation below is computed on read._

**Relations as sets.** A relation R is a set of pairs (a, b). The vault
stores only the pairs the person wrote.

**Converse.** R⁻¹ = {(b, a)}. `inverse` names it. For a symmetric relation
R = R⁻¹ (`inverse === id`). Many-to-one inverses (`mother-of`⁻¹ =
`child-of`, `child-of`⁻¹ = `parent-of`) are legal only when the hierarchy
explains them: `mother-of` ⊑ `parent-of`. L5.1 flags a pair that has no such
explanation.

**Hierarchy (subrelation).** R ⊑ S means every R pair is also an S pair.
`mother-of` ⊑ `parent-of` ⊑ `family-of` ⊑ `knows` ⊑ `related`. Every relation
has `related` at the top. Asking "who is family?" walks down the lattice.
Read-only, no extra links (KG-O3).

**Composition (chains).** (R ∘ S)(a, c) when R(a, b) and S(b, c) for some b.
A chain rule names the result: `parent-of` ∘ `parent-of` ⇒
`grandparent-of`; `part-of` ∘ `goal-of` ⇒ `serves` (KG-O5).

**Closure.** Transitive R⁺: `part-of`, `subgoal-of`, `counts-as`. Computed
with a depth cap (default 6) and a visited set, so cycles stop.

**Traits** (each one a small, checkable statement):

| Trait | Statement | Use |
|---|---|---|
| symmetric | R = R⁻¹ | `sibling-of`, `related` |
| transitive | R ∘ R ⊆ R | `part-of`, `subgoal-of` |
| irreflexive | no (a, a) | almost all; `addLink` already refuses self |
| acyclic | no a R⁺ a | `blocks`, `part-of` (already guarded for dependencies) |
| functional | at most k targets per source | `mother-of` k=1, `spouse-of` k=1 |
| inverse-functional | at most k sources per target | `birthplace-of` |
| disjoint with S | no pair in both R and S | `supports` vs `refutes` on one pair |

**Density** (ego-scoped, L4.4):

- degree k = distinct neighbours (mutual counts once).
- local clustering C = 2T / (k(k−1)), where T = links among the neighbours.
  Read: "how many of this item's neighbours know each other".
- open triads = neighbour pairs (b, c) with no link between them. Each is a
  densify candidate (triadic closure).
- vault density D = E / (N(N−1)), weekly review only, per type
  (KG-QA6 linkability, KG-A14 degree over time).

**Scores** for suggestions (L4.2), all bounded in [0, 1], all explained:

- Adamic–Adar over shared neighbours: Σ 1 / log(deg(z)), normalised.
- Jaccard over shared lists and tags, weighted by rarity (IDF).
- Mention strength: exact title or alias match in body or notes = 1.
- Co-time: shared painted minutes / min(total minutes), floor 7 sittings
  (KG law 7: `OBSERVATORY_FLOOR`).

A score orders the shelf. It never decides anything. A suggestion with no
readable reason is not shown.

---

## 6. Data model (additive only)

_All new fields are optional. Old data reads unchanged._

### 6.1 `RelationDef` v2 (`lib/links.ts`)

```ts
export interface RelationDef {
  // existing: id, label, inverse, inverseLabel, fromTypes?, toTypes?,
  //           family?, custom?, archived?, createdAt?
  /** Parent relation id (R ⊑ parent). Absent = `related`. */
  parent?: string
  traits?: {
    transitive?: true
    acyclic?: true
    /** Max targets per source. */
    functional?: number
    /** Max sources per target. */
    inverseFunctional?: number
    disjointWith?: string[]
  }
  /** How hard the ledger asks for the reverse link. Default "ask". */
  reciprocity?: "ask" | "quiet" | "expect"
  /** Talkable phrases (KG-NL1, KG-N3). First is the display label. */
  phrases?: { forward?: string[]; inverse?: string[] }
  /** One plain line: what this relation means. */
  description?: string
  /** Merged into another relation; reads as that one (L2.3). */
  aliasOf?: string
  /** Who named it. Model-named relations stay "proposed" until accepted. */
  origin?: "seed" | "person" | `model:${string}` | `import:${string}`
}
```

- `fromTypes` / `toTypes` already are domain and range (KG-O2). No second
  pair of fields.
- `symmetric` stays implied by `inverse === id`. No flag.
- `reciprocity`: **ask** shows Confirm on in-only rows (today's plan).
  **expect** also counts in-only rows in the density readout as "unconfirmed".
  **quiet** shows in-only rows without Confirm (for one-way facts like
  `reviews`).

### 6.2 Side table for built-ins (`lib/graph/builtin-traits.ts`)

Built-ins stay frozen in `RELATIONS`. Their v2 fields come from a side map
merged by the registry on read: `part-of` transitive and acyclic, `blocks`
acyclic, `supports` disjoint with `refutes`, `subgoal-of` transitive,
`mother-of` inverse-functional 1 (one mother per person; built: the earlier
"functional 1" would cap a mother at one child), and so on. Seed parents
live on the seeds. The person can
override traits on a built-in. The override lives in
`useItemTypeStore.relationOverrides: Record<id, Partial<RelationDef>>`
(labels and ids excepted).

### 6.3 Rules (`useItemTypeStore.relationRules`)

```ts
export interface RelationRule {
  id: string                       // `rule-<slug>-<rand4>`
  label: string                    // "Grandparents"
  /** Body: a chain of relations from ?a to ?z. Length 1–3 (KG-L2). */
  chain: string[]                  // ["parent-of", "parent-of"]
  /** Optional type guards per variable, a..z in chain order. */
  guards?: (string[] | undefined)[]
  /** Head relation between first and last variable. */
  head: string                     // "grandparent-of"
  /** Unless this relation already holds between them (KG-R5). */
  unless?: string
  enabled: boolean
  origin: RelationDef["origin"]
  createdAt: string
}
```

Chains cover composition, subrelation (chain of one: `mother-of` ⇒
`parent-of`, though the lattice already does this), and transitivity (a
trait, not a rule). Anything wider waits for KG-Q1 patterns (L7.1).

### 6.4 Item-side fields

- `Task.dismissedLinkSuggestions?: string[]` (PD 6.3 adds it). Keys are
  `edgeKey(otherId, relation)`. This plan reuses it for every source.
- Nothing else on items. Muted suggestion sources and density preferences
  are per-viewer settings in `user-settings-store.ts`.

### 6.5 Proposal inbox (`brain2-graph-inbox`, L8.1)

A queue, not a graph. A proposal is not an edge until accepted (KG law 1,
KG-N9).

```ts
interface GraphProposal {
  id: string
  kind: "link" | "relation" | "rule"
  sourceId?: string; relation?: string; targetId?: string   // kind link
  relationDraft?: NewRelationInput & { parent?: string }    // kind relation
  ruleDraft?: Omit<RelationRule, "id" | "createdAt">        // kind rule
  origin: `model:${string}` | `import:${string}` | `densify:${string}`
  reason: string            // one readable line
  evidence?: { itemId: string; field: string; span: string }
  score?: number
  createdAt: string
  status: "open" | "accepted" | "dismissed"
}
```

Capped at 500 open. Oldest dismissed are pruned first. Included in full
backup.

### 6.6 Persist

`brain2-item-types-store` bumps one version for `relationOverrides` and
`relationRules`. `migrateItemTypeState` returns only `types` today: the bump
**must** carry `relations`, `relationOverrides`, and `relationRules`
(L1.4 has a test for exactly this).

---

## 7. The Links tab, top to bottom

_Built on PD Phase 6 furniture. Section numbers below say what is new._

```
┌ Links · 14 ─────────────────────────────────────────────┐
│ 9 out · 3 in · 2 mutual · 4 derived    C 0.31 · 6 open  │  readout (L4.4)
│ [Radial] [Matrix] [Path] [Ledger]      ☐ with derived   │  view switch, KG-X3
│                                                         │
│            ( radial plate, PD 6.4 )                     │
│                                                         │
│ Oey  [ is the sibling of ▾ ]  [ search item ▾ ]  Add    │  composer, PD 6.2
│                                                         │
│ Might be missing                                 2 of 5 │  shelf (L4.3)
│  ○ Ana — knows Sam and Lio, who both know Oey  ✓  ✕  ⋯   │
│  ○ Café X — named in the 3 Oct note            ✓  ✕  ⋯   │
│                                                         │
│ Family                                                  │  ledger, PD 6.3
│  is the sibling of  Lio        mutual          Remove   │
│  is the grandchild of Linda    derived · why?    Pin    │  L3.3, L3.4
│ Work                                                    │
│  works with  Sam               in only        Confirm   │
│  reports to  Ida, Kim          2 of max 1 · check       │  L5.2
│                                                         │
│ Relation vocabulary…                                    │  → L2.1
└─────────────────────────────────────────────────────────┘
```

- **Readout.** Counts by direction, local clustering C, and open triads.
  Neutral ink. Click a number to filter the ledger.
- **With derived.** Off by default on first open. Remembered per viewer.
  When on, the plate and ledger include rule edges, dotted, with proofs.
- **Views.** Radial (PD 6.4), Matrix (L6.1), Path (L6.2), Ledger only. The
  ledger is always the full-text twin.
- **Composer.** PD 6.2, plus: the relation combobox shows the lattice
  (children indented under parents), the relation's `description` on hover,
  and an inline check (L5.2) before Add ("Oey already has a mother: Linda").
  The check informs. It does not block, except for a cycle on an acyclic
  relation, which uses the existing `CycleConfirmDialog` wording.
- **Shelf.** At most five suggestions. Each: other item, relation, one
  reason line, ✓ accept (draft `addLink`), ✕ dismiss (stored on the item),
  ⋯ (mute this source, open evidence, open other item).
- **Ledger.** PD 6.3, grouped by family, then relation. New row states:
  derived (Pin · why?), check (neutral note, links to the sheet), alias
  (shows the merged-into label, small "was: …").
- **Belief items** keep their evidence lane: support vs refute balance from
  `lib/belief-strength.ts` at the head of the ledger. Behavior unchanged.
- **Footer.** Opens the Relations library at this item's type.

Popup and page show the same panel. The page shows the composer only while
editing, as PD 8.1 says.

---

## 8. The Relations library

A new **Relations** tab in `components/Analytics/ItemTypesLibrary.tsx`,
beside the types. Vocabulary next to types, as PD decision 1 says.

- **List.** Grouped by family. Each row: label ⇄ inverse label, scope
  (from type → to type), usage count (links using it, read from the task
  index), origin badge (seed · yours · proposed). Archived rows fold away.
- **Tree toggle.** Shows the hierarchy (`parent`) as an indented outline
  with `related` at the root.
- **Sheet** (L2.2) for one relation: label, inverse label, same both ways,
  parent, family, scope, reciprocity, traits (checkboxes with one plain line
  each), phrases, description, and a usage list (first 20 links, each
  opens its item). Built-ins show ids and labels read-only; traits are
  editable through `relationOverrides`.
- **Merge** (L2.3): "Read *coworker of* as *works with*". Sets `aliasOf` on
  the merged relation and archives it. Every reader resolves aliases
  through the registry. Links keep their stored id. Undo clears `aliasOf`.
  Refused when the two scopes conflict or when one is a built-in being
  merged into a custom.
- **Schematic** (L2.4, KG-V5): relations drawn as a hierarchy diagram,
  inverses as paired strokes, rules as labelled junctions. Read-only.
  Click a node to open its sheet.
- **Rules** sub-tab (L3.5). See section 9.

---

## 9. Rules and patterns

### 9.1 Rule editor (L3.5)

A sentence row in the house's own furniture (KG-R6):

```
If  ?a [ is the parent of ▾ ] ?b  and  ?b [ is the parent of ▾ ] ?c
then ?a [ is the grandparent of ▾ ] ?c      unless [ — ▾ ]
                                     Dry run: 7 new edges · 0 conflicts
```

- Up to three links in the chain (KG-L2).
- **Dry run** (KG-R7) counts the new derived edges vault-wide (the one
  vault-wide pass the library allows, run on demand with a progress line)
  and lists the first ten.
- A rule that would derive more than 500 edges asks once before saving.
- A rule's head may be a relation created in place (same inline form as
  the composer).

### 9.2 Ego reasoner (L3.2)

`lib/graph/ego-reason.ts`, pure:

```ts
deriveAround(itemId, ctx: { links: LinkIndex; rules: RelationRule[];
  lattice: RelationLattice; depth?: number }): DerivedEdge[]
interface DerivedEdge extends EgoEdge {
  proof: { ruleId?: string; trait?: "transitive" | "inverse" | "subrelation";
           steps: { from: string; relation: string; to: string; linkId?: string }[] }
}
```

- Bounded: it walks out from the item to chain length 3 at most, and to
  transitive depth 6 at most. The cost depends on the item's
  neighbourhood, not on the vault.
- Output feeds `egoEdges(item, all, derived)`, which already drops a
  derived edge when a real edge has its key.
- This is the ego-sized core of KG-R1. When the vault reasoner lands, it
  calls the same rule evaluator over the whole edge view.

### 9.3 Proof card (L3.4, KG-R2, KG-X8)

"Why is this here?" opens a small property sheet: the rule's sentence, then
each step as a row (item → relation → item), each row clickable. Pin turns
the edge into a recorded link and keeps a ledger line naming the rule.

### 9.4 Patterns (L7.1)

A saved ego pattern is a smart list over "items that have this
neighbourhood shape": for example *people who are `member-of` Foxtide and
have no `works-with` link*. Stored as a list rule. It bridges into KG-Q1
(pattern syntax) and KG-Q6 (save as smart list). Until KG-Q1 exists, L7.1
covers only one-hop shapes: has / has not relation R to X, or to any item of
type T.

---

## 10. Densify: where new edges come from

`lib/graph/densify.ts`, pure. Each source is a function
`(item, ctx) => Suggestion[]`. A suggestion is
`{ key, otherId, relation, source, reason, evidence?, score }`. The shelf
merges sources, drops dismissed keys and existing edges, keeps the best per
other item, and shows the top five.

| Source | Finds | Relation proposed | Reason line |
|---|---|---|---|
| `reciprocal` | in-only edges on `ask`/`expect` relations | the inverse | "Sam says: works with Oey" |
| `rule` | derived edges worth pinning (on `expect` heads) | rule head | "Linda is Lio's mother; Lio is Oey's parent" |
| `triad` | open triads among neighbours, Adamic–Adar | most common relation in the pair's families, else `related` | "Ana knows Sam and Lio, who both know Oey" |
| `co-member` | items sharing ≥ 2 rare lists or tags | `related` | "Both on Reading 2026 and #jung" |
| `mention` | title or alias found in body, notes, note log | `mentions`, if the person has one, else `related` | "Named in the 3 Oct note" + span |
| `relation-word` | Relation field words (PD 7.1) | seed from `RELATION_WORDS` | "Relation: sister" |
| `co-time` | people or items sharing painted time (≥ 7 sittings) | `spends-time-with` (person) / `related` | "Together 11 times since June" |
| `proposal` | open inbox items for this item (L8.1) | as proposed | origin + reason |

Rules for every source:

- One reason line, in house voice, with names. No reason, no suggestion.
- Scope-checked: the relation must allow both types.
- Never two suggestions for the same other item.
- **Mute** a source per viewer (`user-settings-store`): the shelf stops
  showing it everywhere. Settings lists muted sources.
- Accepting writes a draft link. On save, the activity ledger line carries
  `source: "suggest:<source>"` (KG-C2). Order is **recorded**: the person
  accepted it. A model proposal is the exception (section 11).

---

## 11. Person and model at one table

Collaboration means a shared queue the person reviews. No model has a
pen.

### 11.1 The inbox (L8.1)

`brain2-graph-inbox` (section 6.5) holds proposals from any non-person
origin: densify sources that run vault-wide in the weekly review, imports,
and models. The review UI is one list with filters (origin, kind, item
type). Each row reads as a sentence with its reason and evidence span:
accept, dismiss, edit then accept. **Accept all from this origin** is not
offered.

A proposal for a new relation or rule shows the full sheet before accept.
It is never created quietly (KG plan §8.2 guardrail 3).

### 11.2 The file door (L8.2): works with any model, costs nothing at runtime

- **Export graph snapshot** (Settings → Data): one JSON file with the
  vocabulary (relations, lattice, rules), items as `{id, type, title,
  aliases, lists, tags}`, and links. Subgraphs marked private (KG-P7: cycle,
  sleep, mood, intake, a person's notes) are left out by default. The export
  dialog lists what is left out.
- **Import proposals**: a JSON file of `GraphProposal` rows (schema in
  `lib/graph/proposal-schema.ts`, also written into the snapshot as
  `$proposalSchema`). Rows are checked: ids must exist, relations must
  exist or be `kind: "relation"`, scope must hold, and a row needs a reason.
  Malformed rows are counted and dropped.
- This lets a Claude Code session, or any other agent, read the snapshot,
  think as long as it likes, and hand back proposals. Nothing it says
  reaches the vault until the person accepts it.

### 11.3 Model tier B in the app (L8.3): deferred

> **Deferred** by the person on 2026-10-16: the file door only for now. No
> model runs inside the app. The text below is kept for when that changes.

The tier and guardrails are KG plan §8.1–8.2 B, verbatim: off by default,
deterministic first, closed outputs (existing item ids and relation ids,
or an explicit `kind: "relation"` proposal), evidence span required, cost
caps, private subgraphs never sent to a hosted model, eval set gate.
Accepted model links keep `order: "inferred"`, `source: "model:<name>"` on
their ledger line until the person edits them. Then they become recorded.

What it is good for here:

1. Reading a note or body and proposing links to existing items (with
   the span).
2. Proposing a parent and phrases for a relation the person just named.
3. Proposing a missing relation type when many `related` links between
   two types share words in their items ("12 `related` links from Book to
   Person; 9 notes say *by*: propose *written by* / *wrote*?").
   (KG-F10 the other way round.)

**Refused** (tier D): judging which beliefs are true, weighting edges,
merging identities, summarising a person.

---

## 12. Concepts, categories, labels, vocab

The house has no `concept` type (KG law 5). Concepts are items of any
type with relations about them. This plan supplies the relations and lets
the existing rooms do the rest.

- **Taxonomy relations** (seed pack `lib/graph/seed-packs/taxonomy.ts`):
  `broader` / `narrower` (transitive), `instance-of` / `has-instance`,
  `see-also` (symmetric). SKOS words in house labels (KG-PT1, KG-PT4).
  Tags stay strings. A tag can be addressed as `tag:<normalized>` once
  KG-I1 lands. Until then, taxonomy links run between items.
- **Lexical pack** for Language study (`lib/vocab-words.ts`,
  `lib/vocab-dictionary.ts`): `translation-of` (symmetric), `synonym-of`
  (symmetric), `antonym-of` (symmetric, disjoint with synonym-of),
  `root-of` / `derived-from`, `false-friend-of`. Only for items that exist
  as items. This plan does not turn the word bank into items. It is the
  personal lexicon of KG-NL6, opt-in per pack.
- **Seed packs** are opt-in from the library ("Add the Lexical pack"). A
  pack is a list of `RelationDef` with `origin: "seed"` plus optional
  rules, registered with `registerSeedRelations`. Removing a pack archives
  its relations and never deletes links.
- **Labels.** Every relation has a forward and an inverse phrase, so every
  edge reads as a sentence from both ends. `phrases` feeds capture parsing
  later (KG-N3) and Cmd-K questions (KG-NL4).
- **Categories as families.** `RelationFamily` stays the colour and sector
  key. A custom relation picks a family. "other" is the honest default.
- **Organization.** Lists stay lists. A list can be the object of a link
  once KG-D9 lands. Until then, list membership feeds `co-member` only.

---

## 13. Visual grammar

Follow [`DESIGN_STYLE.md`](DESIGN_STYLE.md) and the person's taste notes:
cool paper and graph rule, diagram grammar, data-science plates. Star
icons are fine. Avoid celestial costume.

- **Name.** Call PD 6.4's "Constellation" the **radial plate** in UI copy
  and docs. The file name can stay.
- **Strokes by order** (KG-V3): recorded solid; derived dotted; proposed
  dashed and pale; mutual a double strand. No new colours for order.
- **Hue by family** (KG-V2). Swap PD 6.4's amber in-edge tint and its
  `place` hue `#ffcf7a` for a cool neutral (no yellow). Direction reads from
  the arrowhead alone.
- **Matrix view** (L6.1): rows and columns are the item and its neighbours.
  A filled cell is a link, coloured by family. Order rows by family, then
  degree. Open triads show as outlined empty cells, so missing edges are
  visible at once. It is the densest honest picture of a neighbourhood.
- **Path view** (L6.2, KG-V6, KG-X7): pick a second item; the shortest
  relation path is drawn left to right as a ruler with relation labels on
  the ticks. Undirected BFS over the link index, depth 6, honours aliases.
- **Edge inspector** (L6.3, KG-V4): click a cord or row; a Win95 property
  sheet with relation, direction, order, origin, created (from the
  activity ledger), proof (if derived), and checks.
- **Motion.** PD 6.4 verbs only (ease out, stir, settle). Reduced motion →
  still.

---

## 14. Steps

### Phase L0: ground

#### L0.1 Board truth
- **Files**: `docs/PERSON_DETAIL_REDESIGN.md`.
- **Do**: tick 5.2 and 6.1 after checking their tests against the step
  specs. Add handoff lines. Note what differs from the spec (for example
  `RelationFamily` is a union in `lib/links.ts`, not `string`).

#### L0.2 Rich Links tab everywhere
- PD 6.2–6.5 and 8.1, as written there, with section 13's colour change.
  Every later phase mounts into `RichLinksPanel`.

### Phase L1: vocabulary v2

#### L1.1 `RelationDef` v2 fields ∥
- **Files**: `lib/links.ts` (type only), `lib/relation-registry.ts`,
  `lib/item-type-store.ts` (`relationOverrides`, `updateRelation` accepts
  the new fields), `lib/relation-registry.test.ts`.
- **Do**: add the optional fields in 6.1. `getRelationDef` merges built-in
  side traits and person overrides into a copy. Never mutates `RELATIONS`.
  `aliasOf` resolves once (no chains): the registry returns the target def
  with `id` kept as asked.
- **Tests**: built-in labels unchanged; override adds traits but not a
  label; alias resolves label and inverse; archived still resolves.

#### L1.2 Relation lattice
- **Files**: new `lib/graph/relation-lattice.ts` + test.
- **API**: `buildLattice(defs)`, `ancestors(id)`, `descendants(id)`,
  `isSubrelation(r, s)`, `meet(r, s)` (nearest shared ancestor), `depth(id)`.
  `related` is the root. A parent cycle is cut at the first repeat and
  reported as a check.
- **Tests**: `mother-of` ⊑ `parent-of` ⊑ `family-of` ⊑ `related`; cycle
  cut; unknown id parents to `related`.

#### L1.3 Seed hierarchy
- **Files**: new `lib/graph/builtin-traits.ts`, `lib/person-relations.ts`
  (add `parent` to seeds: values only, no id or label changes).
- **Do**: parents and traits for built-ins (side table) and person seeds.
  Also `family-of`, `knows` as seed roots for the person families if they
  are not there. Fix the many-to-one inverse story by naming parents.
- **Tests**: every person seed has a parent; the L5.1 inverse check passes
  on all seeds.

#### L1.4 Persist bump ∥
- **Files**: `lib/item-type-store.ts`, `lib/data/backup.ts` (if it lists
  keys).
- **Do**: bump the version. `migrateItemTypeState` carries `relations`,
  `relationOverrides`, `relationRules`. Run `cleanRelations` on all three.
- **Tests**: a v2 blob with relations migrates with them intact (the trap
  named in PD §1.4).

### Phase L2: Relations library

#### L2.1 Relations tab
- **Files**: `components/Analytics/ItemTypesLibrary.tsx`, new
  `components/Analytics/relations/RelationsLibrary.tsx` +
  `relations-library.css`.
- **Do**: section 8 list + tree toggle. Usage counts from
  `taskIndexOf(all)` (count links per relation once, cached).
- **Tests**: lists built-ins, seeds, custom; archived folded; counts right.

#### L2.2 Relation sheet
- **Files**: `components/Analytics/relations/RelationSheet.tsx`.
- **Do**: section 8 sheet. Writes through `updateRelation` or
  `relationOverrides`. "Same both ways" on an existing pair is read-only
  (it would change stored meaning).
- **Tests**: built-in label read-only; traits saved; reciprocity changes
  the ledger's Confirm.

#### L2.3 Merge as alias
- **Files**: sheet, registry.
- **Do**: section 8 merge. Show the usage count that will read differently.
  Undo restores.
- **Tests**: merged links read the new label from both ends; stored
  `relation` unchanged; undo.

#### L2.4 Relation schematic ∥
- **Files**: `components/Analytics/relations/RelationSchematic.tsx`, pure
  layout in `lib/graph/relation-schematic-layout.ts` + test.
- **Do**: layered tree layout (root left), inverse pairs as twin strokes.
  SVG. Deterministic.

### Phase L3: rules and derived edges

#### L3.1 Rule records
- **Files**: `lib/item-type-store.ts` (`relationRules`, add/update/toggle/
  remove), `lib/graph/relation-rules.ts` (validate: chain length 1–3,
  every id exists, head scope fits the chain's ends).
- **Tests**: invalid rules refused with a reason; removing a rule never
  touches links.

#### L3.2 Ego reasoner
- **Files**: `lib/graph/ego-reason.ts` + test.
- **Do**: section 9.2. Subrelation edges are not emitted as separate
  edges (the lattice answers queries instead). Transitive closure and
  chain rules are emitted.
- **Tests**: grandparent chain; `part-of` closure with a cycle stops;
  `unless` blocks; depth cap; disabled rule silent; result is stable.

#### L3.3 Derived on the tab
- **Files**: `RichLinksPanel`, `LinkLedger`, radial plate.
- **Do**: **With derived** switch (per-viewer setting). Pass
  `deriveAround` output into `egoEdges`. Pin = draft `addLink`.
- **Tests**: switch off hides derived; pin makes a real edge and the
  derived twin drops.

#### L3.4 Proof card
- **Files**: `components/ItemDetail/links/ProofCard.tsx`.
- **Tests**: each step opens its item through the guarded `openItem`.

#### L3.5 Rule editor
- **Files**: `components/Analytics/relations/RuleEditor.tsx`.
- **Do**: section 9.1, dry run via a vault pass (cached by tasks array
  identity).
- **Tests**: dry run counts match the reasoner over a fixture.

### Phase L4: densify

#### L4.1 Suggestion core
- **Files**: `lib/graph/densify.ts` + test.
- **Do**: types, merge, dedupe, dismiss filter, scope check, top five.

#### L4.2 Sources ∥ (one file per source under `lib/graph/densify/`)
- `reciprocal.ts`, `triad.ts`, `co-member.ts`, `mention.ts`,
  `co-time.ts` (reads `trackedTimeForItem` / people sync; person items
  only at first). `relation-word` wraps PD 7.1.
- **Tests per source**: finds the case, writes the reason, respects
  dismissals and scope, score in [0, 1], and gives no output under the
  sample floor where one applies.

#### L4.3 Shelf
- **Files**: `components/ItemDetail/links/SuggestionShelf.tsx`.
- **Tests**: accept adds a draft link (dirty lamp), dismiss persists after
  save, mute hides the source on another item.

#### L4.4 Density readout ∥
- **Files**: `lib/graph/ego-density.ts` + test, readout row in
  `RichLinksPanel`.
- **Tests**: clustering on a known small graph; open triads listed.

### Phase L5: checks

#### L5.1 Check engine
- **Files**: `lib/graph/relation-checks.ts` + test.
- **Do**: scope (KG-QA2), functional and inverse-functional counts,
  acyclic (reuse `findCyclePath` where it fits), irreflexive, disjoint
  pairs (KG-O6), unexplained many-to-one inverse. Output facts, not
  verdicts: `{ kind, edgeKeys, line }`.

#### L5.2 Checks on the tab
- Ledger row notes and composer pre-checks (section 7). Neutral ink.

### Phase L6: more views

- **L6.1 Matrix** `LinkMatrix.tsx` + pure `lib/graph/ego-matrix.ts`.
- **L6.2 Path** `LinkPath.tsx` + `lib/graph/link-path.ts` (BFS, test on
  cycles and aliases).
- **L6.3 Edge inspector** `EdgeInspector.tsx`; created date from
  `lib/item-activity.ts`.

### Phase L7: patterns

- **L7.1** One-hop ego patterns saved as a list rule
  (`lib/list-membership-rules.ts` gets a `link` condition: has / has not
  relation R [to X | to type T]). Rule-added members keep today's
  provenance (`listRuleAddedIds`). Tests: membership updates when a link
  is saved.

### Phase L8: the shared table

- **L8.1 Inbox**: store `lib/graph/graph-inbox-store.ts`
  (`brain2-graph-inbox`), review view `components/Settings/GraphInbox.tsx`
  (or a weekly review section, see L9.1), shelf source `proposal`.
- **L8.2 File door**: `lib/graph/graph-snapshot.ts` (export, private
  subgraphs left out), `lib/graph/proposal-schema.ts` (validate import).
  Tests: private items absent; bad rows dropped with counts.
- **L8.3 Tier B**: deferred (§15). Do not build. If it reopens, follow KG
  plan §8.2 in full.

### Phase L9: the vault breathes

- **L9.1 Weekly graph review** (KG-X4): in the weekly ritual's Infer
  step, the five best vault-wide suggestions, the newest checks, and the
  open inbox count. Describe first, infer second (MAP_LOOP_MEANING).
- **L9.2 Density over time** (KG-A14): a weekly strip of links added,
  linkability per type, mean clustering. Computed from the activity
  ledger, so no snapshot store is needed.

### Phase L10: docs

- **L10.1**: `components/ItemDetail/README.md` (rich links, derived,
  shelf), `lib/README.md` (`lib/graph/*`), Analytics README (Relations
  library), `docs/README.md` row for this file. Screenshots of the tab
  (radial, matrix, shelf) and the library. DESIGN_STYLE checklist.

### Parallel map

```
L0.1 ─┐
L1.1 ─┼─ L1.2 ─ L1.3          L0.2 (PD 6.2–8.1) ─┬─ L4.1 ─ L4.2 ∥ ─ L4.3 ─ L8.1 ─ L8.2 ─ L8.3
L1.4 ─┘    │                                     ├─ L4.4 ∥            └──── L9.1
           ├─ L2.1 ─ L2.2 ─ L2.3                 ├─ L6.1 ∥  L6.3 ∥
           ├─ L2.4 ∥                             └─ L3.3 ─ L3.4
           ├─ L5.1 ─ L5.2
           └─ L3.1 ─ L3.2 ─ L3.3 / L3.5 ─ L7.1
```

---

## 15. Decisions made

- Vocabulary (relations, overrides, rules) lives in `brain2-item-types-store`.
  No new store for it. The inbox is the only new key.
- Links are stored on the source only. Reciprocity is a question the
  ledger asks, tuned per relation.
- Rules derive on read. Pinning stores a link. Nothing derived is cached
  to disk.
- Merge is an alias. Stored ids never change.
- Built-ins keep ids and labels. Traits arrive through a side table and
  overrides.
- The Links tab stays ego-scoped. Vault-wide work happens in the library
  (dry run, usage) and the weekly review.
- Accepted deterministic suggestions are recorded. Accepted model
  proposals are inferred until edited.
- **Model at the table: the file door only** (2026-10-16). A model works
  outside the app: it reads the graph snapshot export and hands back a
  proposal file (L8.2). No model runs in the app. L8.3 is deferred.

## 16. Refused, and why

| Idea | Why not |
|---|---|
| Auto-write the reverse link on the other item | Invariant 8. Two items would change from one save, and the other item's history would gain a line its owner never made. |
| A certainty column on `ItemLink` | KG law 5. A belief that needs certainty becomes a formulation with evidence links. |
| Embedding similarity on the tab | KG law 3. Jaccard, Adamic–Adar, and mentions give reasons. An embedding gives a number. KG §17 Q3 keeps local embeddings open for search only. |
| A graph database | Offline plain JSON. The ego index is enough. |
| Self-updating graph from a model | Tier D, KG law 9. |
| Rewriting links on rename or merge | Invariant 2. |
| Unlimited rule bodies or recursion beyond closure | Cost and surprise. Three-step chains and declared transitivity cover the asked cases. KG-Q1 patterns take the rest. |

## 17. Open questions for the person

1. ~~**Model at the table.**~~ Answered 2026-10-16: file door only. See §15.
2. **Seed packs.** Ship Taxonomy and Lexical as opt-in packs, or also turn
   Taxonomy on by default?
3. **Suggestion budget.** Five on the tab and five in the weekly review, or
   different numbers?
4. **Co-time for people.** It reads painted time with people. Keep it on by
   default or opt-in (same question as KG §11 Q6)?
5. **Matrix view.** Worth a tab slot, or only inside the edge inspector's
   "show neighbourhood"?

## 18. Handoff log

_Append one line per finished step: `YYYY-MM-DD · step · who · result`._
2026-10-16 · L0.1 · Claude · PD board already showed 5.2 and 6.1 ☑ with handoff lines; their tests are green (person-relations, link-graph). Spec drift was already in the 5.1 handoff (`RelationFamily` is a union in `lib/links.ts`).
2026-10-16 · L1.1 · Claude · `RelationDef` v2 fields (`RelationTraits`, `RelationReciprocity`, `RelationOrigin` types). Registry: `OVERRIDABLE_RELATION_KEYS` (parent, traits, reciprocity, phrases, description), `pickOverridable`, `registerRelationOverrides`, `rawRelationDef`. `getRelationDef` caches resolved defs and clears the cache on every register. Side table and overrides apply to every def. Ids, labels, inverses, scope and `aliasOf` cannot be overridden. An alias returns `{ ...target, id, aliasOf: target.id, archived }`. `allRelations` merges traits but leaves aliases unresolved. Store: `relationOverrides`, `setRelationOverride`, `clearRelationOverride`, registered on rehydrate and on change. `updateRelation` already took the new fields.
2026-10-16 · L1.4 · Claude · `brain2-item-types-store` v3. `migrateItemTypeState` keeps every persisted field, then cleans `relations`, `relationOverrides`, and `relationRules` (rules carried as-is until L3.1 types them). Fixed the stale `cogs-` key read in `item-type-store.test.ts` (the 5.1 handoff named it). `backup.ts` restores the store by key, so it needed no change. Six `components/ItemDetail` tests were stale against the merged ledger markup (`link-ledger-row`, `Remove link to …`, `Create`). Updated them. `LinkLedger` now shows **Open** on every row with an item, not only in-links. 100 ItemDetail tests green.
2026-10-16 · L1.2 · Claude · `lib/graph/relation-lattice.ts`: `buildLattice(defs)` → `ancestors`, `descendants`, `isSubrelation`, `meet`, `depth`, `parentOf`, `checks` (`parent-cycle`, cut at the first repeat). `LATTICE_ROOT = "related"`. An unknown id parents to `related`, and an alias parents to its target. Also `unexplainedInverses(defs, lattice)`, the L5.1 inverse check, here early so L1.3 can test it. Build it from `allRelations()`. Nothing caches it yet. 5 tests.
2026-10-16 · L1.3 · Claude · `person-relations.ts`: new seed `family-of` (sym), `SEED_PARENTS`, and every seed gets `parent` (default `related`) and `origin: "seed"`. No id or label changed. `builtin-traits.ts` filled: part-of / has-part / subgoal-of / has-subgoal transitive + acyclic, phase-of ⊑ part-of, blocks acyclic, evidence pairs disjoint, reviews quiet, mother-of / father-of inverse-functional 1, married-to functional 1. The lattice over `allRelations()` has no cycles and no unexplained inverses. `components/People/person-pipelines.test.tsx` "double-clicking a joined pen" fails on the uncommitted People edits. It is not links work.
2026-10-16 · L2.1 · Claude · `ItemTypesLibrary` now has Types / Relations tabs. `components/Analytics/relations/RelationsLibrary.tsx`: by family or tree (lattice `parentOf`), label ⇄ inverse, scope, usage (`lib/graph/relation-usage.ts`, cached by tasks identity), origin badge (built-in · seed · yours · proposed), archived folded.
2026-10-16 · side · Claude · Built-in **Location** type (`lib/location-types.ts`). Place seeds `born-in` / `birthplace-of`, `grew-up-in` / `where-grew-up` (person → location), `located-in` / `location-of` (location ↔ location, transitive + acyclic). Composer target search ends with Create "<query>": a store write at once (type = relation's first `toTypes`, else item); the link stays a draft. Native `<select>`s in the composer and library now use `components/ui/native-select.tsx` (drop-in over the Radix select). Pre-existing failures outside links: enhanced-analytics, habit, session-plan, task-store titles, iPhone notes, person-pipelines.
2026-10-16 · L2.2–L2.4, L3.1–L3.5, L4.1–L4.4, L5.1–L5.2, L6.1–L6.3, L7.1, L8.1–L8.2, L9.1–L9.2 · Claude · Built in one pass. Libs in `lib/graph/` with `graph-core.test.ts` and `graph-library.test.ts` (16 tests). UI test `components/ItemDetail/links/links-graph-ui.test.tsx` (shelf accept, dismiss, with derived + proof, sheet override, merge/unmerge). `relationRules`, `mergeRelation`, `unmergeRelation` on `useItemTypeStore`. New keys `brain2-graph-inbox`, `brain2-links-view` in backup and declared in `vault-coverage.test.ts`. Left: co-time wiring, created date in the inspector, screenshots (L10.1), PD board ticks for 6.2–8.1. Failures outside links not touched: enhanced-analytics, enhanced-list-view, habit counts, iPhone notes, item-title-reads, next-step, session-plan, task-store titles.
