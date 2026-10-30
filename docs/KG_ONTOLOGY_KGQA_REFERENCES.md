# Ontology, taxonomy and KGQA reading list, mapped to Brain2

_Last mapped: 2026-10-30_

Source: a reading list the person pasted on 2026-10-30. It has three parts:
(1) construction and improvement of taxonomy and ontology, plus how Palantir and
Microsoft Fabric use the word "ontology"; (2) knowledge graph question
answering (KGQA); (3) the list's own closing thought, "combine embedding and
subgraph matching for KGQA".

This file is **notes only**. It changes no code and no other doc. Nothing here is
built unless a line says **Landed**. Titles are kept as pasted; links are not
repeated, so search the title. Where a paper's content is not in the paste, the
mapping is a guess from its title and is marked _(from title)_.

Read beside, not instead of:
[`BIM_FLOW_HANDOFF.md`](BIM_FLOW_HANDOFF.md) (the Hogan et al. 2025 plan, items
1–11, and the build-next list),
[`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md) (238 `KG-*` proposals),
[`BARRASA_WEBBER_IN_BRAIN2.md`](BARRASA_WEBBER_IN_BRAIN2.md),
[`LINKS_REDESIGN.md`](LINKS_REDESIGN.md),
[`COUNTS_AS.md`](COUNTS_AS.md),
`components/Lab/BimFlow/README.md`.
Ids below are `ONT-n` (ontology side) and `QA-n` (question answering side) so
they never collide with `KG-*`.

## 1. One-page fit

Brain2 is a personal knowledge graph with these parts already in the repo:

| Layer | In the pasted lists | In Brain2 today |
|-------|---------------------|-----------------|
| Schema / semantic | OWL ontology, taxonomy | `RelationDef`, `lib/graph/relation-lattice.ts`, `relation-rules.ts`, pen ladders in `COUNTS_AS.md`, `docs/CANONICAL_FIELDS.md` |
| Instances | Graph database triples | Items, lists, people, pens, timegrid entries, `Task.links`; day spine triples in `lib/graph/vault-graph.ts` |
| Question router | KGQA question understanding | BIM flow gates, `search`, `retrieve`, `answer` in `lib/bim-flow/` |
| Retrieval | Subgraph retrieval, embedding retrieval | `vault-search.ts` (words), `retrieve.ts` (entries, text, overlap, day), Semantic input (needs `nomic-embed-text`) |
| Reasoner | Rules, KG embedding, MCTS | `lib/graph/ego-reason.ts` (derive with proofs on read) |

The BIM flow shape (narrow yes/no gate, short list, small pick, code counts, model
phrases) already matches the best-supported idea across the KGQA list: do not
make the model both find and say. Split the work and let code hold what a small
model is bad at.

## 2. The three meanings of "ontology" (the pasted note)

The paste warns that Palantir's word is not the knowledge-graph word. The note
writes "kinect"; the Palantir term is **kinetic**.

| Source | Layers | Brain2 equivalent | Status |
|--------|--------|-------------------|--------|
| General KG (RDF, `.owl`) | semantic only. KG = ontology + instances. Static snapshot | Relation vocabulary, lattice, rules, pens, canonical fields | **Landed** (semantic) |
| Microsoft Fabric Ontology | semantic + binding to data | Same, plus the stores that each pen, list or relation is bound to. `vault-graph.ts` is a virtualized graph over stores that stay where they are | **Landed** in part. A per-type "bound to this store, this field" table is **Planned** (`ONT-1`) |
| Palantir Ontology | semantic + kinetic + dynamic | Kinetic = live stores, phone sync, the hub (`phone:hub`), the person editing. Dynamic = something fires when state meets a condition | Kinetic **Landed**. Dynamic is **Planned** (`ONT-2`) |

- **ONT-1 Binding table.** For each ontology term (pen, list kind, relation,
  field) name the store and field that carries its instances. This is the
  Fabric "binding". It lets the BIM flow and the Links tab ask "what can
  answer this?" from data instead of from code. Fits `docs/SPEC_MAPPING.md` and
  `CANONICAL_FIELDS.md`.
- **ONT-2 Condition → action rules (Palantir's dynamic layer).** The paste's
  example is a white-blood-cell threshold that triggers a risk procedure. The
  Brain2 form: "when a tracked value passes a line the person set, propose a
  note, a ping, or a block". Needs the auto-write rules from the handoff
  (tag `autowritten`, one undo, per-lane confidence bar). Same rule applies:
  proposals first; nothing widens what a node may write.
- **ONT-3 Keep the words apart in docs.** Say "relation vocabulary" for the
  semantic layer and "rules" for the dynamic layer so the two senses stay
  separate. Do not call Brain2's vocabulary "the Palantir ontology".
- Sources named in the paste: Palantir's AI strategy article and the Palantir
  object backend overview; Microsoft Fabric "What is ontology (preview)".
  Neither is read; the mapping above uses only the paste's description.

## 3. Taxonomy and ontology construction (paste part 1)

| # | Title as pasted | Idea _(from title unless marked)_ | Brain2 use | Status |
|---|-----------------|-----------------------------------|------------|--------|
| 1 | Top-k Graph Summarization on Large Hierarchical DAGs | Summarize a big hierarchy by its k most informative nodes | Collapse the pen tag tree, list tree, or a person's link web to a top-k view in the Links tab and in the BIM "summarize" flow. Cheap, no model | **Planned** `ONT-4` |
| 2 | SetExpan: Corpus-Based Set Expansion via Context Feature Selection and Rank Ensemble | Grow a set from a few seeds using the contexts they appear in | "More like these" for a list, a habit set or a pen: seeds = items already on the list; contexts = the words around them in notes and messages. Feeds the `related` node and Densify | **Planned** `ONT-5` |
| 3 | Customized Organization of Social Media Contents using Focused Topic Hierarchy | Organize a feed into a topic tree around a focus | The Telegram/BIM feed, Instagram text, and day notes grouped by a topic tree the person focuses. Also the "topic runs become blocks" item in the handoff | **Planned** `ONT-6` |
| 4 | Taxonomy Induction Using Hypernym Subsequences | Build is-a trees from word sequences | Suggest "X is a kind of Y" between list names and pens from how the person writes. Accept is the only write | **Planned** `ONT-7` |
| 5 | Probase: a probabilistic taxonomy for text understanding | Each is-a edge carries a probability and counts | Matches the house rule that every inferred edge shows its evidence and order (`inferred`). Store a count and a plausibility beside a suggested edge | **Planned** `ONT-8` |
| 6 | Extending an Event-type Ontology: Adding Verbs and Classes Using Fine-tuned LLMs Suggestions (ACL 2023) 🔥 | An LLM suggests new classes/verbs; humans vet | The pen ladder: the model proposes a missing pen or verb (e.g. "confit" → cooking), the person accepts. Matches "propose, never widen" | **Planned** `ONT-9` |
| 7 | Scientific Knowledge Graph and Ontology Generation using Open Large Language Models (NeurIPS 2024) 🔥 | Open (local) models build a KG and ontology | Supports the house stance: local Ollama models only, hosted never sees this text (`KNOWLEDGE_GRAPH_PLAN.md` §8.2 rule 5) | Reference |
| 8 | OG-RAG: Ontology-Grounded Retrieval-Augmented Generation (EMNLP 2025) 🔥 | Retrieve fact groups shaped by the ontology instead of text chunks | A retrieval unit in `retrieve.ts` becomes a typed group (a day, a person, a pen run) not a text snippet. Answer evidence then names its ontology type. Best fit in the list | **Planned** `ONT-10` |
| 9 | Efficient Axiomatization of OWL 2 EL Ontologies from Data by Means of Formal Concept Analysis (AAAI 2024) | Derive subclass rules from data by FCA | Objects = days or entries, attributes = pens/tags. Find "always together" and "always implies" pairs, then offer them as relation rules or as `COUNTS_AS` rungs | **Planned** `ONT-11` |
| 10 | LLMs4OL: Large Language Models for Ontology Learning (ISWC 2024 challenge) 🔥 | Three tasks: term typing, taxonomy discovery, non-taxonomic relation extraction | A ready test-set shape for BIM: type a term (is "confit" a Food, an Activity?), place it in the tree, name a non-tree relation. Add as eval cases in `lib/bim-flow/tests.ts` | **Planned** `ONT-12` |
| 11 | Burr: A Benchmark for Ontology Learning from Relational Databases (SIGMOD 2025) ⭐ | Learn an ontology from tables | Brain2's stores are table-like JSON. Run it backwards: derive a draft ontology from `brain2-*` store shapes and compare to `CANONICAL_FIELDS.md` to find drift | **Planned** `ONT-13` |

Common rule for all of the above: **a model or a statistic may propose; the
person accepts; the write is one undo.** This is already house law for Densify
and identity proposals.

## 4. KGQA (paste part 2)

### 4.1 Related topics named in the paste

| Topic | Brain2 piece |
|-------|--------------|
| Entity linking and disambiguation | `namesFor`, people nicknames, `vault-search.ts`. Gap: two matches for one name → the **clarify** node (handoff item 3) |
| Relation linking and disambiguation | Mapping "with", "since", "after" to a relation or a pen. Gap: no relation linker; the plan node picks pens only |
| KG embedding, learning, reasoning, rule mining, path finding | `ego-reason.ts` for rules; Semantic input for embeddings; path finding for the Links tab |

### 4.2 Surveys and summaries (paste items 1–11)

Read these once and cite from here. None needs code.

| # | Title (short) | Use |
|---|---------------|-----|
| 1 | Core techniques of QA systems over knowledge bases | Vocabulary: question analysis, phrase mapping, disambiguation, query construction. Matches the flow stages |
| 2 | Survey on Complex QA over KB | Complex = multi-hop, constraint, numeric, set. Same classes as the handoff's fact types |
| 3 | Question Answering Summary (NLP-progress) | Benchmark list |
| 4 | Intro to Neural Network approaches for QA over KGs | Background |
| 5 | Awesome KGQA | Paper index |
| 6 | What is in the KGQA benchmark datasets? | Why questions are easier than real use; argues for the person's own eval set |
| 7 | Complex KBQA: A Survey | Same as 2 |
| 8 | KGs and LLMs: Multi-Hop QA (Neo4j blog) and a Wisecube discussion | Multi-hop recipe: find entities, expand a bounded neighbourhood, give the model the triples |
| 9 | Multilingual QA systems for KGs | The person writes some French and Spanish; handoff item 11 |
| 10 | Unifying LLMs and KGs for QA (EDBT 2025 tutorial) 🔥 | Same three-way map as the Hogan paper: LLM for KG, KG for LLM, both |
| 11 | Representation Learning in Complex Logical Query Answering (ACM CSUR) | Logical queries (and, or, not) as embeddings. Far future |

### 4.3 General KGQA papers (paste items 1–48)

Tag key: **Use** = already in the BIM flow shape; **Next** = a small step on
what exists; **Plan** = needs a new node; **Ref** = background only.

| # | Paper (short) | Idea _(from title)_ | Brain2 mapping | Tag |
|---|---------------|---------------------|----------------|-----|
| 1 | Question Understanding via Template Decomposition (VLDB 2018) 🌟 | Break a question into templates | A `plan` node that splits "how long did I cook with Elijah last week" into pen + person + days + metric. `x-plan.intent` exists; extend | Next `QA-1` |
| 2 | KBQA: Learning QA over QA corpora and KBs | Learn templates from past Q→A pairs | Kept test runs (`bimflow-tests-v1`) are such a corpus. Mine them for templates | Plan |
| 3 | SPARQA: Skeleton-based Semantic Parsing | Skeleton of the question, then fill | Same as 1 | Next |
| 4 | Improving Multi-hop QA over KGs using KB Embeddings (ACL 2020) | Embeddings fill missing links | Needs the Semantic input; vault is sparse, so this helps | Plan `QA-2` |
| 5 | AskNow (ESWC 2016) | Question → intermediate form → query | A typed JSON query over stores instead of SPARQL (see `QA-3`) | Ref |
| 6 | Answering NL Questions by Subgraph Matching (TKDE 2018) | Match a question graph to the data graph | The closing thought of the paste. Question graph = {person, pen, day range}; data graph = the day spine. `retrieve` mode `overlap` is a crude form | Plan `QA-4` |
| 7 | NL question answering over RDF: graph data driven (SIGMOD 2014) 🌟 | Same, graph-driven | Same as 6 | Plan |
| 8 | Complex Factoid QA with a Free-Text KG (WWW 2020) | Use text as the KG | The vault's notes are free text. Fits the `text` retrieve mode | Use |
| 9 | Automated template generation for QA over KGs (WWW 2017) | Generate templates from the KG | Generate test questions from the vault (see `QA-5`) | Next |
| 10 | Never-Ending Learning for Open-Domain QA over KBs (WWW 2018) | Learn from each query | Corrections become taught examples on the node that wrote them (handoff item 1) | Use |
| 11 | Learning to Retrieve Reasoning Paths over Wikipedia Graph (ICLR 2020) | Retrieve a path, not a set | Person → shared day → pen. Path retrieval for "who was I with when…" | Plan |
| 12 | Interpretable Reasoning Network for Multi-Relation QA (COLING 2018) | Show the reasoning chain | ★ evidence plus a hop list in the answer trace | Next |
| 13 | Pattern-revising Enhanced Simple QA (COLING 2018) | Fix wrong relation patterns | Teach a gate | Use |
| 14 | TEQUILA: Temporal QA over KBs (CIKM 2018) | Detect time constraints in a question | Deixis: "yesterday", "last week". `plan.days` exists; see `QA-6` | Next |
| 15 | FreebaseQA | Trivia dataset | Ref | Ref |
| 16 | KG Embedding Based QA, KEQA (WSDM 2019) | Predict the entity/relation vector | Semantic input | Plan |
| 17 | Graph-Based Reasoning over Heterogeneous External Knowledge for Commonsense QA (AAAI 2020) | Mix sources | Mix entries + notes + items in one answer | Next |
| 18 | Open QA Over Curated and Extracted KBs (KDD 2014) | Combine hand-made and extracted facts | Brain2 has both: typed rows (curated) and `llm`-tagged rows (extracted). Keep them tagged so the answer can say which | Use |
| 19 | RocketQA (2021) | Dense passage retrieval training | Ref | Ref |
| 20 | NL QA lets users talk with the KG (CIKM 2017) | Chat over a KG | The Ask about me flow | Use |
| 21 | Asking Clarification Questions in Knowledge-Based QA (EMNLP 2019) | Ask when ambiguous | The **clarify** node | Plan `QA-7` |
| 22 | What's Missing: Knowledge Gap Guided Multi-hop QA (EMNLP 2019) | Notice the missing hop | A "gaps" list: asked-about facts no row can answer (handoff item 7) | Plan |
| 23 | KagNet (EMNLP 2019) | Graph network over commonsense | Ref | Ref |
| 24 | Message Passing for Complex QA over KGs (CIKM 2019) | Pass scores along edges | Rank rows by distance in the link graph from the question's entities | Plan |
| 25 | Keyword Search on RDF Graphs — Query Graph Assembly (CIKM 2017) 🌟 | Keywords → small query graph | `vault-search.ts` already does content words. Assemble them into a graph, not a bag | Next |
| 26 | Semantic Guided, Response-Time-Bounded Top-k Similarity Search (ICDE 2020) 🌟 | Top-k within a time budget | Gate runs are ~10 s per message; add a budget to retrieve | Ref |
| 27 | Beyond I.I.D.: Three Levels of Generalization (WWW 2021) | i.i.d., compositional, zero-shot | Score each flow at three levels: seen phrasing, new combination, unseen pen. Add to the eval axes (`QA-8`) | Next |
| 28 | Query Graph Generation for Multi-hop Complex Questions (ACL 2020) | Grow the query step by step | Federation: the answer node asks `retrieve` for a follow-up (handoff item 10) | Plan |
| 29 | CBench: Better Evaluation of QA over KGs (VLDB 2021) 🌟 | Benchmark analysis by question features | Tag each test by question features (hops, numeric, temporal) and report per tag | Next `QA-8` |
| 30 | SAKE: Spatial QA over KG (ICDE 2021) 🌟 | Place questions | `plan.where` from the latest Location entry (handoff item 4) | Plan |
| 31 | BeamQA: Seq2seq and Beam Search (SIGIR 2023) 🌟 | Beam search over paths | Keep the top few candidate paths, not one | Ref |
| 32 | Joint KG Completion and QA (KDD 2022) | Complete while answering | Gaps → proposals | Ref |
| 33 | Would You Ask it that Way? Question Naturalness (SIGIR 2022) | Machine-made questions are unnatural | Test phrasings must be the person's own words, taken from the feed | Next |
| 34 | Seq2Seq KG Completion and QA (ACL 2022) | Same model for both | Ref | Ref |
| 35 | KGQA with Ambiguous Query (WWW 2023) | Handle ambiguity | Clarify node | Plan |
| 36 | Efficient Contextual Re-Ranking for KGQA (LREC-COLING 2024) | Rerank candidates | A rerank step after `search`. Current rule: subject words weighted 3:1 over related words | Next |
| 37 | STaR: Space and Time-aware Statistic Query Answering (CIKM 2024) | Aggregates over space and time | `compute` node (count, sum minutes, group by day or pen) | Plan `QA-3` |
| 38 | DiaKoP: Dialogue-based Knowledge-oriented Programming (CIKM 2024) | Dialogue builds a program | Follow-up questions in Ask about me | Ref |
| 39 | FZI-WIM at AVeriTeC (EMNLP 2024) | Fact checking with QA over a knowledge _store_ | The `check` mode. The paste says it is about a knowledge store, not a graph | Use |
| 40 | Evidence Pattern Retrieval (SIGIR 2024) | Retrieve evidence patterns | Typed evidence groups (same as `ONT-10`) | Plan |
| 41 | NuTrea: neural tree search, context-guided multi-hop (NeurIPS 2023) | Tree search | Ref | Ref |
| 42 | Uniqorn: Unified QA over RDF KGs and text (JWS 2024) | Graph and text together | Entries and notes in one evidence set | Next |
| 43 | Reasoning with Trees (COLING 2025) | MCTS over reasoning paths | Listed three times in the paste. Ref for multi-hop only | Ref |
| 44 | KG QA as Knowledge-Aware Constrained Code Generation (COLING 2025) | Constrain generation to valid queries | Our JSON schema `format` and `maxItems` do the same job | Use |
| 45 | Conjunctive Queries with Safe Negation over RDFS (AAAI 2025) | "Not" in queries | "Days I did X but not Y" is a `compute` function | Plan |
| 46 | TEQA: Temporal KG enhanced QA (KBS 2025) | Time-aware | Same as 14 | Next |
| 47 | Query Graph Approximation (ACL 2025 Findings) | Approximate when exact fails | Relax a query (drop a constraint) and say so | Plan |
| 48 | SAQE: Complex Logical Query Answering via Semantic-Aware Representation (TKDE 2025) | Logic queries as vectors | Ref | Ref |

### 4.4 Multiple hop QA (paste items 1–10)

| # | Paper | Brain2 note |
|---|-------|-------------|
| 1 | Scalable Multi-Hop Relational Reasoning (EMNLP 2020) | Ref |
| 2 | QA-GNN (NAACL-HLT 2021) | Listed again under multiple options and under LLM for KGQA. LLM scores relevance of KG entities, then a graph step. Maps to "rank rows by link distance" |
| 3 | Cognitive Graph (ACL 2019) | The paste's own note: a cognitive graph is a dynamic, partial, local KG built from the query. **This is what a BIM run already makes**: the trace graph per message. Worth naming it so |
| 4 | Complex QA using machine translation and multi-task learning (EACL 2021) | Ref |
| 5 | EmbedKGQA (ACL 2020) | Embeddings for sparse KGs. Vault is sparse |
| 6 | HOLMES: Hyper-Relational KGs for Multi-hop QA using LLMs (ACL 2024) 🔥 | Hyper-relational = a fact with qualifiers (who, when, where, with whom). A BIM block is one: pen + start + end + place + company. Use as the evidence unit |
| 7 | Extending Complex Logical Queries on Uncertain KGs (ACL 2025) | Uncertain edges: our `estimated` precision and `inferred` order |
| 8 | Search-in-Context: Multi-Hop QA over Long Contexts via MCTS with Dynamic KV Retrieval (ACL 2025) | Long day text; Ref |
| 9 | Progressive Prefix-Memory Tuning for Complex Logical Query Answering (IJCAI 2025) 🔥 | Ref |
| 10 | HiGraAgent: Dual-Agent Adaptive Reasoning over Hierarchical KG (EACL 2026) 🔥 | Hierarchical KG + two agents. Our hierarchy: day → block → message |

### 4.5 Other categories

- **Multiple-options QA.** RiddleSense and QA-GNN. Closest to the BIM `choose`
  node (pick from a short list). Ref.
- **Multilingual.** Zero-shot cross-lingual transfer for KGQA (ACL 2021); a
  system for simple questions in multiple languages (ACL 2023 demo). See handoff
  item 11: check the word-stem match on French and Spanish first.
- **Open-world QA.** Leveraging LLM-GNN Integration for Open-World QA over KGs
  (EACL 2026) 🔥. Same stance as handoff item 3: a missing row is not a "no".
- **SPARQL.** Triplet-order-sensitive pre-training (CIKM 2024); Assessing LLMs
  for SPARQL generation in scientific QA (ISWC 2024) 🔥. Brain2 has no SPARQL
  store, so the use is the _idea_: the model writes a small typed query and
  code runs it (`QA-3`). Never let a model write free query text that touches
  the vault.
- **Factoid entity questions.** A KG Embedding Model for Factoid Entity
  Questions (ACM TOIS 2025). Ref.

### 4.6 LLM for KGQA, or KG for LLM-based QA 🔥 (paste items 1–67)

Grouped by what they teach. Numbers are the paste's.

**Pattern A: the model finds entities and relations, code queries** (the shape
BIM uses).
11 Pretrained transformers for simple QA (first LLM-as-relation-classifier),
12 empirical study of PLMs in simple KGQA, 14 BERT with relation-aware
attention, 15 Subgraph retrieval enhanced model for multi-hop KBQA (a hop-by-hop
path retriever), 19 LLM-based SPARQL generation with selected schema (CCKS2023),
20 subgraph extraction for one-shot SPARQL, 21 structure and content prompting
over scholarly data, 26 FlexKBQA (few-shot), 4 / 18 LLMs as controlled natural
language semantic parsers (Amazon; ECAI 2023). Mapping: give the model a short
schema (selected pens, lists, people) and ask for a small structured plan. Already
the `plan` and `extract` nodes. Tag **Use**.

**Pattern B: retrieve a subgraph, show triples to the model.**
3 Retrieve-Rewrite-Answer (KG-to-text), 8 Knowledge-augmented LM prompting for
zero-shot KGQA, 9 Empowering LMs with KG reasoning, 13 QA-GNN, 27 KG prompting
for multi-document QA, 29 Grape, 32 RAG with KGs for customer service (SIGIR
2024), 36 Retrieval and Reasoning on KGs (EMNLP 2024), 54 Question-Aware KG
Prompting. Mapping: handoff item 6 (inject triples) and `KG-to-text`: turn a
row into one plain sentence before it goes in the prompt, "On Oct 29 at 1:30
you started cooking with Elijah." That is cheaper for a 14B model than JSON.
**Next** `QA-9`.

**Pattern C: the model walks the graph (agent / search).**
10 KnowledgeNavigator, 25 Pangu (_don't generate, discriminate_: the model
scores candidate plans an agent builds, which is the `choose` node), 44 / 60
Reasoning with Trees (MCTS), 45 Generate-on-Graph (Thinking-Searching-
Generating, for incomplete KGs), 48 Interactive-KBQA (Thought-Action-
Observation with tools), 53 Time-aware ReAct Agent, 57 ReKG-MCTS, 63
KBQA-o1 (MCTS agent), 64 Memory-augmented Query Reconstruction, 66 Progressive
Planning and Reinforced Reasoning, 67 S-Path-RAG (semantic shortest-path
retrieval). Mapping: this is handoff item 10 (ensemble → federation). Add a
loop with a hard step cap where the `answer` node may call `retrieve` again when
evidence is thin. Keep the cap, since small local models loop. **Plan** `QA-10`.

**Pattern D: self-supervision and training data.**
6 / 22 Bring Your Own KG (a symbolic agent writes query-program exemplars, then
retrieval-augmented reasoning predicts programs). Use it to generate eval
questions from the person's own vault with known answers (`QA-5`). 38 GAIL
fine-tuned LLM for low-resource KGQA, 58 Flow-guided DPO for KG reasoning,
42 Knowledgeable Preference Alignment (KnowPAT) for domain QA: two goals, be
accommodating to the user and use the domain knowledge base. Maps to the
per-person instruction layer in the handoff (item 4). Fine-tuning is not
planned; the taught-example mechanism is the cheap version.

**Pattern E: trust, faithfulness, uncertainty.**
5 Is GPT fit for KGQA? (limits shown), 16 Can ChatGPT replace traditional KBQA
models, 30 ChatGPT versus traditional QA for KGs, 47 KGs as a source of trust
for enterprise QA, 49 Can KGs make LLMs more trustworthy? (open-ended QA), 52
Can LLMs evaluate complex attribution in QA?, 55 FiDeLiS (faithful reasoning),
59 Uncertainty-aware trustworthy KG reasoning (AAAI 2025), 35 Faithful KG
explanation through deep alignment. Mapping: hallucination and opaqueness tests
in the handoff (item 2). Attribution = every sentence of an answer points at a
row id. **Next** `QA-11`: per-sentence ★ links, not per-answer.

**Pattern F: ontology help for QA.**
50 / 65 Ontology-Guided Reverse Thinking (ACL 2025): start from the answer's
type and work back to the question's entities. Cheap for Brain2: the pen's type
says what kind of value it holds, so "how many hours" has an answer type before
retrieval. **Plan** `ONT-14`, together with `ONT-10`.

**Pattern G: domain deployments and other settings (Ref).**
7 enterprise SQL benchmark (a KG improves accuracy over SQL), 17 ReasoningLM, 2
logic programming plus LMs, 1 scholarly KGQA, 23 duplicate of 19, 24 IoT
forensics, 28 CyberQ, 31 educational QA at HCMUT, 33 ESG news QA, 34 implicit
reasoning in few-shot examples (use few-shot lines that show the reasoning step;
the taught gate examples can add a `why`), 37 deep concept injection for video
QA, 39 Generate-then-Ground, 40 RGR-KBQA, 41 Awakening Augmented Generation,
43 duplicate of 44, 46 collaborative RL + LLM framework, 51 LLM message passing,
56 KAG (knowledge augmented generation for professional domains), 61 CompKBQA
(component-wise task decomposition, same idea as gates), 62 RTQA (recursive
thinking for temporal KGQA).

### 4.7 Benchmarks and leaderboards (paste items 1–29)

| Group | Names | Use |
|-------|-------|-----|
| Simple and multi-hop | MetaQA (1/2/3 hop, movie domain, 135k triples), WebQuestionsSP (4,737 questions, 1–2 hop), ComplexWebQuestions, GraphQ, GrailQA (3 generalization levels), KQA Pro, MarkQA (numerical reasoning), 2WikiMultiHop, HotpotQA, MuSiQue, StrategyQA, CQW, WebQSP | Shape for our test levels: 1-hop (last time I…), 2-hop (with Elijah when…), numeric (how many hours) |
| Classic linked-data | QALD-9, LC-QuAD 2.0, Spider4SPARQL, GeoQuestions1089 (spatial) | Ref; geo for `plan.where` |
| Commonsense | CommonsenseQA, OpenBookQA, GQA (visual) | Ref |
| Long-tail and conversation | CR-LT-KGQA (commonsense plus long-tail), RAC (conversational), QuALITY (long input) | Long-tail = the person's own rare events. Conversational = Ask about me follow-ups |
| Tool use | ToolQA (LLM with external tools) | Supports the `compute` node: tools for sub-tasks |
| Meta | KGQA Leaderboard (LREC 2022), Are KGQA datasets enough? (SIGIR 2022), QA datasets summary (NLP-progress) | Why a personal eval set matters (handoff item 5) |

### 4.8 Others in the paste

Unsupervised Question Decomposition (EMNLP 2020), The Web as a KB for Answering
Complex Questions (NAACL-HLT 2018), and Scalable Join Processing on Very Large
RDF Graphs (SIGMOD 2009, 🌟). Decomposition is `QA-1`. Join ordering is only
relevant if a retrieve step joins several stores; start with the smallest set
first.

## 5. The closing thought: embedding + subgraph matching

"Consider combine embedding and subgraph matching for KGQA."

A Brain2 shape for it, in the smallest steps that extend what works:

1. **Word match first** (exists): `vault-search.ts` gives a short candidate list.
2. **Embedding rerank** (Semantic input, needs `nomic-embed-text`; ask before
   pulling): reorder the same list by meaning. Never widen past the word hits at
   first; widen only in a "list all" mode.
3. **Subgraph match** (new, `QA-4`): build a tiny question graph (entities,
   pen, time window, place) from the plan node. Score a candidate day or person
   cluster by how many of the question's nodes and edges it has on the day
   spine. This is graph-aware without a graph database.
4. **Fuse** the two scores (reciprocal rank is enough). Show both scores in the
   trace so the person can tell which one moved a row (transparency axis).
5. **Test** with the cache off (coherency axis) and per question level from
   `QA-8`.

## 6. Proposal register (new ids only)

| Id | What | Needs | Status |
|----|------|-------|--------|
| ONT-1 | Binding table: term → store and field | Read-only table | Planned |
| ONT-2 | Condition → action rules (Palantir dynamic layer) | Auto-write, undo | Planned |
| ONT-3 | Keep "relation vocabulary" and "rules" words apart in docs | Docs only | Planned |
| ONT-4 | Top-k summary of tag tree, lists, person web | Pure code | Planned |
| ONT-5 | Set expansion for lists and habits | Search over notes | Planned |
| ONT-6 | Topic hierarchy over the feed | Ollama | Planned |
| ONT-7 | Is-a suggestions between lists and pens | Accept-only | Planned |
| ONT-8 | Count and plausibility on suggested edges | Pure code | Planned |
| ONT-9 | LLM suggests new pens and verbs | Accept-only | Planned |
| ONT-10 | Typed evidence groups as the retrieval unit | `retrieve.ts` | Planned |
| ONT-11 | FCA: derive always-together rules from entries | Pure code | Planned |
| ONT-12 | LLMs4OL-shaped tests: term typing, taxonomy, relations | `tests.ts` | Planned |
| ONT-13 | Derive a draft ontology from store shapes, diff against `CANONICAL_FIELDS.md` | Script | Planned |
| ONT-14 | Answer type from the pen before retrieval (reverse thinking) | `plan` node | Planned |
| QA-1 | Question decomposition into pen + person + days + metric | `plan` node | Planned |
| QA-2 | Embedding fill for sparse links | `nomic-embed-text` | Planned |
| QA-3 | `compute` node and typed query JSON (count, sum minutes, group, not, streaks, date difference) | New node kind | Planned |
| QA-4 | Subgraph match on the day spine | `vault-graph.ts` | Planned |
| QA-5 | Generate eval questions with known answers from the vault | Script | Planned |
| QA-6 | Deixis: now, yesterday, here, last week | `plan.days`, `plan.where` | Partly exists |
| QA-7 | Clarify node (which Elijah?) | New node kind | Planned |
| QA-8 | Eval axes and levels: correctness, completeness, freshness, transparency, coherency, personalization; plus i.i.d. / compositional / zero-shot and per question feature | `tests.ts` | Planned |
| QA-9 | Rows as plain sentences in prompts (KG-to-text) | `answer` node | Planned |
| QA-10 | Bounded follow-up retrieval loop (federation) | `answer`, `retrieve` | Planned |
| QA-11 | Per-sentence attribution links | Preview UI | Planned |

## 7. What this list does not change

- Hosted models never see vault text. The list's strongest results use large
  hosted models; only the shapes carry over.
- A model or statistic proposes; the person accepts. Palantir-style automatic
  actions (`ONT-2`) stay behind the auto-write rules in the handoff.
- No SPARQL store, no Neo4j, no OWL file. The paste's `.owl` and RDF framing is
  background. The semantic layer stays in `lib/links.ts` and `lib/graph/`.
- No fine-tuning. Taught examples and gate wording are the lever.
- No new top-level system. Each item lands as a node kind, a test, or a
  suggestion in a place that already exists.
