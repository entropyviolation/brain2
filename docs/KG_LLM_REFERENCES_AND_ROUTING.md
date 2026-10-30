# KG + LLM reading list, and many start nodes with routing

_Last mapped: 2026-10-30_

Second paste from the person on 2026-10-30. Companion to
[`KG_ONTOLOGY_KGQA_REFERENCES.md`](KG_ONTOLOGY_KGQA_REFERENCES.md) (ids
`ONT-n`, `QA-n`). Ids here are `ENT-n` (entry points and routing) and `KL-n`
(KG + LLM ideas).

**Notes only.** No code, no other doc changed. Nothing here is built unless a
line says **Landed**. Where a paper's content is not in the paste, the mapping
is a guess from its title, marked _(from title)_.

Read beside: [`BIM_FLOW_HANDOFF.md`](BIM_FLOW_HANDOFF.md),
`components/Lab/BimFlow/README.md`, [`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md),
[`MESSAGE_INGEST.md`](MESSAGE_INGEST.md), [`ORACLE_CAPTURE_BOX.md`](ORACLE_CAPTURE_BOX.md),
[`PHONE_SYNC_PLAN.md`](PHONE_SYNC_PLAN.md), [`LINKS_REDESIGN.md`](LINKS_REDESIGN.md).

## 1. The request: many start nodes, more routing, more specialization

The person's words, condensed: there should be many different start nodes for
different scenarios, the way different parts of the app lead into different
systems. Inputs, outputs and constructions differ by scenario. The flows should
**not** analyze every text along every path in parallel every time. More
routing, more specialization.

### What exists

- The bench has one start kind, `message` (`lib/bim-flow/types.ts`). Four flows
  (`flows.ts`, `task-flows.ts`): Log a message, Ask about me, Summarize a topic,
  Recap a day. An input mode (`inputs.ts`) decides what a start emits: each
  message, grouped by time, or a whole day.
- Log a message has eight or more lanes (`default-flow.ts`). Each message is
  put through lanes that are all asked. The gates make a lane cheap when its
  answer is No, but every gate still runs on every message: about 10 s per
  message on a 14B model.

### The shape to build (all **Planned**, additive)

**ENT-1 Named start kinds.** Add start nodes beside `message`, each with its
own output shape, so a flow begins where the app begins:

| Start | Fired by | Emits | Natural first route |
|-------|----------|-------|---------------------|
| `bim-text` | Telegram/BIM feed message (`MESSAGE_INGEST.md`) | one message + time | Log flow, router first |
| `phone-capture` | Phone quick capture / share sheet (`PHONE_SYNC_PLAN.md`) | text, maybe a list hint | list/item lanes only |
| `oracle-box` | Capture box (`ORACLE_CAPTURE_BOX.md`) | free text with no time | intent router: log, ask, note |
| `question` | Cmd-K house questions, Ask about me | a question + now | question router (§2) |
| `day-close` | End of day, or the Recap button | whole day | Recap flow, summarize lanes |
| `item-open` | Opening an item detail or person detail | an item or person id | link suggestions, "what do I know about this" |
| `links-review` | Weekly graph review (`Links` tab) | a batch of suggested edges | verify and deprecate (§4, `KL-6`) |
| `timer-edge` | A block opened or closed in the timegrid | one block + neighbours | spans and conflicts only |
| `import-batch` | Bulk paste, export file, Instagram dump | many rows | classify type first, then a per-type lane |
| `schedule` | Clock (hub), see `ONT-2` | a time and a condition | rules |

Each start declares: its **input type**, its **allowed output kinds** (what its
flow may propose), and a **budget** (max model calls). A flow is reachable from
the start kinds it lists. Today's four flows become the default flow of
`bim-text`, `question`, `question` (summarize intent) and `day-close`. Nothing
existing changes; the old `message` start stays and maps to `bim-text`.

**ENT-2 Route first, then run only that lane.** Replace "ask every lane's gate
on every message" with a two-step shape:

1. A **cheap router**: code rules first (a leading `?`, a clock-only line, a
   known shorthand like `o` or `addy`, a link, a number-only line), then one
   small-model call that returns a single label from a closed enum. Not a
   multi-select; multi-select gets padded (handoff lesson 2).
2. A **lane** per label with its own nodes. Only the chosen lane (or at most
   two, when the router returns a primary and a secondary) runs.

The router's labels come from the information-need taxonomy already in the
handoff (facts, explanations, planning, advice) for questions, and from the
current pens/lanes for logs. Keep gates *inside* lanes as the narrow check.

**ENT-3 Cheapest first.** Order of attempts per input: exact code rule →
word match in `vault-search.ts` → small model (3–4B) for the router → 14B only
for `choose` and `extract` in the chosen lane. Stop at the first step that is
sure. Record which step answered, so the test sheet can show cost per route.

**ENT-4 Specialized lane libraries.** One lane per scenario family, built once
and shared by several starts: time-span lane, intake lane, person/place lane,
list-capture lane, mood/body lane, dream lane, question-answer lane, recap lane.
A start picks lanes; it does not own them. This is the "specialization".

**ENT-5 No parallel fan-out by default.** The walk stays breadth-first inside a
lane, but a node runs only when its router label or gate says so. An explicit
**fan-out** node (opt-in) exists for the rare case the person wants several
lanes at once. Show the call count per message in the Preview so the saving is
visible.

**ENT-6 Per-start inspector.** The bench picks a start first (a picker above
the flow tabs), then shows only the lanes that start can reach, and test cases
are stored per start. Test sheet gets a "route correct?" check beside the
answer check: did the router choose the label the person expects?

**ENT-7 Outputs differ per start.** A question start ends in `answer`. A log
start ends in `propose` and `blocks`. An item-open start ends in suggested
links. An import start ends in a typed batch preview. Enforce this in the start
declaration so a wrong terminal node is a build-time error in the bench, never a
runtime surprise. Writes still go only through the auto-write rules in the
handoff (tags, undo, no widening).

**ENT-8 Beyond the bench.** The same start/route/lane vocabulary applies to
other graph parts of the app: densify suggestions (`lib/graph/densify/`),
`ego-reason.ts`, identity `same-as` proposals, weekly graph review. Each is
already a single-purpose pipeline; the change is only to give them a named start
and a router when they gain more than one job. Do not rewrite them now.

## 2. Question routing (from the pasted survey and the earlier list)

A `question` start routes by what is asked, before any retrieval:

| Label | Example | Lane |
|-------|---------|------|
| `last-time` | "when did I last…" | `retrieve entries` → first/last in code → short say |
| `count` | "how many hours…" | `compute` (`QA-3`) → phrase |
| `with-person` | "what did I do with Elijah" | person resolve (clarify if two) → day join |
| `summarize` | "summarize my week of cooking" | topic search → summarize |
| `recap-day` | "what happened Tuesday" | day retrieve → recap |
| `plan` | "what should I do Friday" | planning lane (spatio-temporal) |
| `advice` | "how do I improve sleep" | advice lane with the person's own history |
| `fact-check` | "did I really…" | `check` mode only |
| `unknown` | anything else | clarify or say the notes do not record it |

Router rules: code first, one small-model call second, `unknown` is an allowed
answer and must be cheap. This is the Hogan table of information needs (handoff
item 1) turned into routes.

## 3. The pasted opinions

The paste opens with the author's thoughts. Mapped:

1. Graphs match human cognition but are not necessarily optimal for all world
   knowledge; LLMs capture complex distributions. Brain2 keeps typed rows and
   links for what the person did, and uses a model only for language.
2. KGs give verified facts and avoid hallucination (crowdsourced and human
   validated). Brain2's version: rows the person entered or accepted are
   verified; rows tagged `llm` or `autowritten` are not, and an answer says
   which it used.
3. Two directions the author likes: (1) high-precision KGs to improve LLM
   post-training and fine-tuning data; (2) high-precision KGs to improve
   inference by RAG or prompting. Brain2 does (2) and does not fine-tune.
   (1) stays a **note**: the vault plus test history could make a personal
   instruction set later, only if the person asks (`KL-9`).

## 4. KG + LLM ideas, by pasted section

### 4.1 Overviews, surveys, tutorials (paste items 1–16)

| # | Item | Use for Brain2 |
|---|------|----------------|
| 1 | GitHub: KG-LLM-Papers (zjukg) | Paper index |
| 2 | GitHub: Awesome LLM-KGs | Paper index |
| 3 | The Journey to a Knowledgeable Assistant with RAG (Luna Dong, WSDM/SIGMOD 2024 keynote) 🌟 | Same author as Head-to-Tail. Source for "long-tail and dynamic facts fail in LLMs, retrieve them". Supports `ENT-2` |
| 4 | LLM+KG Workshop VLDB 2024, talk by Prof. Qi | The talk's lists, kept in §4.2 below |
| 5 | Research Trends for the Interplay between LLMs and KGs (VLDB 2024 workshop) 🌟 | Ref |
| 5b | KaLLM 2024 workshop (ACL) | Ref; contains the few-shot implicit-reasoning KGQA paper |
| 6 | KGs Meet Multi-Modal Learning (survey) | Photos and audio attached to items. Ref |
| 7 | OneGraph: a KG constructed by LLM | Ref |
| 8 | Unifying LLMs and KGs: A Roadmap (TKDE 2024) 🌟 | Three frames: KG-enhanced LLM, LLM-augmented KG, synergized. The same split as the Hogan three-way map in the handoff |
| 9 | Knowledge-Empowered, Collaborative, and Co-Evolving AI Models: the Post-LLM Roadmap | Co-evolve: corrections feed taught examples; taught examples improve routes |
| 10 | Integrating LLMs and KGs for Next-level AGI (WWW 2025 tutorial; also KL list item 14) | Ref |
| 11 | Towards Graph Foundation Models (WWW 2024 tutorial): GNN, LLM, GNN+LLM | Ref |
| 12 | Advancing Graph Representation Learning with LLMs | Ref |
| 13 | Give Us the Facts: fact-aware language modeling (TKDE 2024) 🌟 | KG before/during/after training. Only the "after" (prompt-time) stage applies |
| 14 | LLMs on Graphs: A Comprehensive Survey (TKDE 2024) 🌟 | Taxonomy of graph types: pure graph, text-attributed graph, text-paired graph. Brain2's vault is a text-attributed graph (rows with text, linked) |
| 15 | Graph meets LLM: progress and future directions (IJCAI 2024) | Ref |
| 16 | Graph learning advancements on LLMs: a holistic survey | Ref |

### 4.2 The VLDB 2024 talk lists (paste item 4)

**KG for LLM:** pretraining; as prompt (KAPING); fine-tuning; inference
(reduce hallucination); RAG; knowledge update or edit; knowledge fusion;
knowledge validation as benchmark; future: symbolic knowledge, benchmarks,
more interpretable reasoning.

**LLM for KG:** entity and relation extraction (in-context and SFT); triple
generation; ontology matching (OLaLa); entity alignment (ChatEA); KBQA
(ELLMKGQA); ontology reasoning (subsumption and instance checking); KG
reasoning (embedding enhanced, KoPA).

**Integration:** a knowledge service platform; OpenKG plus tools plus apps.

Brain2 mapping:

| Item | Where | Status |
|------|-------|--------|
| As prompt, inference, RAG, validation | BIM flow `retrieve` → `answer` → `check` | **Landed** |
| Entity and relation extraction | `extract`, `choose` nodes | **Landed** |
| Entity alignment | Identity `same-as` proposals; person nicknames in `namesFor` | **Landed** in part |
| Ontology matching | Match a new pen/list name to the nearest existing one before making one (`KL-1`) | Planned |
| Triple generation | Auto-write behind rules (handoff item 1) | Planned |
| Knowledge update or edit | `KL-6` below | Planned |
| Tools plus app | `compute` (`QA-3`), `ENT-1` | Planned |

### 4.3 Discussions (paste items 1–5)

Talks only: Vrandečić on KGs in a world of LLMs (KGC 2023), ArangoDB on
bridging KGs and LLMs, Big Data LDN 2023 on uniting them, a Chinese discussion
write-up on KGs after ChatGPT, a keynote on KG data in LLMs. Take-away already
in the repo: keep the KG as the checkable memory and the model as the language
layer.

### 4.4 KG and LLM relationship (paste items 1–15)

| # | Title (short) | Idea _(from title unless marked)_ | Brain2 use | Tag |
|---|---------------|-----------------------------------|------------|-----|
| 1 | Language Models as Knowledge Bases? (EMNLP 2019) | Probe an LM for facts | The model must never be the source of a fact about the person. Rule already in the answer node | Rule |
| 2 | Language Models are Open Knowledge Graphs | Extract a KG from an LM's attention | Ref | Ref |
| 3 | JAKET: joint pre-training of KG and language understanding | Joint training | Ref | Ref |
| 4 | Language Models sounds the Death Knell of KGs | The opposing view | Counter-view; the answer to it is §3 point 2 | Ref |
| 5 | ChatGPT vs Traditional QA for KGs (also in KGQA list) | Key point from the paste: ChatGPT does not generalize to unseen domain information. Combine LM question understanding, robustness and explainability with a KGQA system's ability to use recent information across domains | Exactly this split: model understands the question and phrases; code and vault supply the recent, private facts. A personal vault is 100% unseen domain | **Use** |
| 6 | InnoGraph: a KG for AI innovation | Ref | Ref |
| 7 | Augmented Language Models: a Survey (MetaAI) | Paste note: interacting with tools like a knowledge base needs structured information | `compute` node and typed outputs | Plan |
| 8 | Let's Chat to Find the APIs: human, LLM, KG through an AI chain (ASE 2023) | A chain: LLM asks, KG maps to an API | A chain of narrow steps, same as the BIM graph. Ref for tool lookup | Ref |
| 9 | Head-to-Tail: How knowledgeable are LLMs? (NAACL 2024, Luna Dong) 🔥 | LLMs are weakest on tail entities | The person's own life is all tail. Never trust the model for it | Rule |
| 10 | LLMs as Reliable Knowledge Bases? (2024) | Criteria: factuality and consistency, seen and unseen knowledge | The coherency axis (same question ×5, cache off) in `QA-8` | Plan |
| 11 | LLM-TIKG: threat intelligence KG | Ref | Ref |
| 12 | LLMs and KGs: Opportunities and Challenges | Ref | Ref |
| 13 | MKGL: Mastery of a Three-Word Language (NeurIPS 2024 spotlight) | A "KG language" where a sentence is entity noun + relation verb + entity noun. LLMs reach fluency and beat embedding methods on completion | Render rows as three-word sentences "Allie cooked garlic" for prompts and for the gaps list. Pairs with `QA-9` | Plan `KL-2` |
| 14 | Next-level AGI tutorial (WWW 2025) | Duplicate of survey 10 | Ref |
| 15 | OpenSPG (Ant Group, OpenKG) 🔥 | Open engine with explicit semantic representation, logical rule definitions, and operator frameworks for construction and inference | The three-part split matches `ONT-1` (binding), `ONT-2` (rules), and the construct/infer nodes. Do not adopt the engine; borrow the "operator" vocabulary: each node is an operator with a declared input and output (`ENT-1`, `ENT-7`) | Ref/Plan |

### 4.5 LLMs for KGs (paste items 1–30)

Grouped by what they teach.

- **Construction by model with human review.** 1 Enhancing KG construction
  using LLMs; 8 CodeKGC (code-style prompts for generative construction); 9 and
  16 LLMs for KG construction and reasoning; 12 LLM-assisted KG engineering with
  ChatGPT; 14 evolution of LLM abilities for KG engineering in 2023; 17
  collaborative human expertise + LLM for legal KGs; 18 SAC-KG (domain
  constructors); 19 UrbanKGent (agent framework); 23 economic KGs with
  canonicalization; 24 synthetic KG generation; 25 SSKG Hub (the paste's note:
  LLM extraction yields provenance-linked **Draft** KGs that experts review and
  promote to **Certified** KGs under role-based governance); 27 domain-specific
  KGs from LLMs; 29 self-retrieval-augmented divide-and-conquer for KB
  construction; 30 KG4ESG atlas.
  Brain2: the **Draft → Certified** staging is the cleanest picture of the
  accept-only rule. Rows an LLM proposes sit as *draft* (tag `llm`,
  `autowritten`, with model, node path, `why`); accepting or leaving them
  untouched for N days promotes or archives them. **Planned** `KL-3`. Canonical-
  ization (23) = the same entity under many names: reuse `namesFor` and the
  identity proposals.
- **Reasoning and completion.** 2 complex logical reasoning over KGs with LLMs;
  4 topology contexts and logical rules in LMs for completion; 5 completion with
  a generative transformer; 13 making LLMs better at completion; 20 prompt-based
  KG foundation model for in-context reasoning; 22 LMs over large-scale KBs on
  new facts; 25b finetuning with discrimination instructions; 8 contextualization
  distillation. Brain2: completion is "suggest the missing link"; Densify
  already does it with rules. Use the _discrimination_ framing: show the model a
  candidate edge and ask yes/no (a gate), do not ask it to generate edges.
- **Freshness.** 21 Editing LM-based KG embeddings (update for data freshness).
  Brain2: embeddings, once added, must be recomputed per changed row, never per
  vault. `KL-6`.
- **Temporal.** 15 LM-enhanced semantic topology for temporal KG extrapolation.
  Pairs with deixis `QA-6` and the timegrid.
- **Agents that walk the KG.** 10 Think-on-Graph (LLM as agent exploring
  entities and relations; the paste notes paper 11's authors commented on the
  review panel) and 11 Pangu (a symbolic agent builds valid plans, the LM
  scores plausibility; evaluated on KBQA). Both are Pattern C in the previous
  doc; the Pangu split is already the `choose` node.
- **Others.** 3 story comprehension via dynamic document KGs (a graph built per
  document on the fly, which is what one run's trace is); 6 path language
  modeling for explainable recommendation (a path as a sentence, `KL-2`); 7
  GraphGPT (github); 26 CypherBench (precise retrieval over full-scale KGs;
  the lesson is typed queries, `QA-3`); 28 enriching a contextual LM from a KG
  for biomedical extraction.

### 4.6 KGs for LLMs (paste, section by section)

The author's note: using a KG to prepare training data (pre-training,
post-training, SFT) is the more promising direction. Brain2 does not train, so
treat §1–2 as background and §3 as the applicable part.

**1. Pretraining.** Knowledge-enhanced contextual word representations; SKILL
(structured knowledge infusion); KG-based synthetic corpus generation; KG-
enhanced image captioning with an LLM (AAAI 2026). Background. One Brain2
reading: the *synthetic corpus from a KG* trick is how to write eval questions
from the vault (`QA-5`): turn a row into a sentence and a question with a known
answer.

**2. SFT.** 2.1 CoT data from KGs: MedReason, Graph Chain-of-Thought, healthcare
predictions with KG community retrieval, KG finetuning enhances knowledge
manipulation, KBLaM (a knowledge base encoded into the model's attention).
Background. "Graph chain-of-thought" and "community retrieval" are usable
prompt-time: group linked rows into a community (a day, a person, a project) and
reason over the group (`ONT-10`).

**3. Inference.**
- **3.1 KG for RAG** and **3.2 KG in agent memory** ("Memory Graph" is the same
  thing under another name). The paste points to two separate pages on GitHub;
  those pages are not in the paste. Brain2 note: the vault *is* a memory graph;
  the BIM flow is a memory reader. Name it that way in prompts to the person:
  "memory", not "knowledge graph".
- **3.3 KG and prompting.** KG prompting for multi-document QA (an agent walks a
  graph of passages, tables and edges by lexical and semantic similarity or
  structure); KG-prompt (interpretable); KnowGPT (the paste lists its three
  challenges: huge search space, high API cost, laborious prompt engineering;
  its two modules: extract the most informative knowledge, then build a
  context-aware prompt); knowledge-augmented LM prompting (KAPING); G-Retriever
  (RAG for textual graphs); Graph-ToolFormer (graph reasoning via tool calls);
  expert-in-the-loop KG prompting for professional writing (HCII 2026). Brain2:
  pick the *most informative few* rows by rank, then convert them to one short
  sentence each (`QA-9`). The expert in the loop is the person: they curate the
  pens and relation vocabulary that structure the prompts.
- **3.4 KG as grounded truth.** KG-augmented LMs for complex QA; FABULA
  (intelligence reports by retrieval-augmented narrative construction, which is a
  recap done from evidence); autonomous KG-based retrofitting to reduce
  hallucination; conceptual diagnostics for KGs and LLMs. Brain2: the `check`
  node is a retrofit step. Extend it to flag any sentence with no row behind it
  (`QA-11`).
- **3.5 Reasoning/CoT in inference.** GIVE (veracity extrapolation: reason from
  a sparse KG to likely-true candidates, flagged as inferred); LightPROF
  (lightweight reasoning); Graph-constrained Reasoning (the model may only walk
  edges that exist, so output is faithful); MemoTime (memory-augmented temporal
  KG reasoning, WWW 2026). Brain2: **graph-constrained answers**. The answer node
  may only cite row ids that the retrieve step returned. The test sheet checks it
  by code (every cited id is in the evidence). That is one cheap check with high
  value. **Planned** `KL-4`. Two entries in the paste are duplicates (GIVE,
  Graph-constrained Reasoning appear twice).
- **3.6 KG other roles.** KBLaM; KGLM ("Barack's Wife Hillary": select and copy
  facts from a KG into the output, i.e. a *copy mechanism*); Tree-of-Traversals
  (zero-shot reasoning for black-box LMs over KGs; it comes with a
  MusicBrainz-x-Wikidata set of 109 cross-source questions); aligning KGQA as
  constrained code generation. Brain2: the copy idea means numbers and names in
  an answer are filled *from rows by code*, not typed by the model (the model
  writes a template with slots). **Planned** `KL-5`. Cross-source questions
  (two stores) are the person's "with Elijah on the day I felt X" questions.

**4. KG for evaluation.** KG-guided evaluation of abstention techniques (NAACL
2025): use a KG to know when the model should refuse. Brain2: the unknown test.
Abstention is a feature; score it (an `unknown` route that is correct counts as
a pass).

### 4.7 Other tasks (paste items 1–16)

| # | Title (short) | Brain2 use |
|---|---------------|------------|
| 1 | ChatGraph: interpretable text classification by converting ChatGPT knowledge to graphs | Classify a message and show why. Router explanation |
| 2 | KG-BART | Ref |
| 3 | QA-GNN | See previous doc |
| 4 | KG chatbot with GPT-3 and Neo4j | Ref; Neo4j not used |
| 5 | Integrate LLM workflows with a KG using Neo4j and APOC ⭐. Two solutions per the paste: (1) LLM writes Cypher to fetch connected info; (2) use connection info to enrich the text embeddings and retrieve it at query time (used in that project) | Solution 2 is the one for Brain2: when embedding a row, embed it with its list, person, and pen names appended. **Planned** `KL-7`. Solution 1 is `QA-3` with typed JSON, never raw query text |
| 6 | FLEEK: factual error detection and correction with evidence from external knowledge | The `check` mode, and `KL-6` |
| 7 | KGLink: column type annotation with a KG and a pre-trained LM ⭐ | Typing columns of an import: the `import-batch` start's first lane (`ENT-1`) |
| 8 | Contextualization distillation for KG completion | Ref |
| 9 | From Superficial to Deep: follow-up question generation with a KG and LLM | After an answer, offer the next question from linked rows. A small chip row in Ask about me. **Idea** `KL-8` |
| 10 | CogMG: collaborative augmentation between LLM and KG. The paste's reading: KGs fix hallucination but may be incomplete or inconsistent when built with extraction; the LLM helps with both | Gaps list + contradiction proposals (handoff items 7, 8) |
| 11 | Feature extraction in healthcare with KGs and LLMs | Ref |
| 12 | LLM-based Typed Hyperresolution for commonsense reasoning with KBs | Typed rules applied to rows: `relation-rules.ts` | 
| 13 | LLM is KG reasoner for cold-start sequential recommendation | Cold start = a new person with few rows; use the lattice to borrow from similar types |
| 14 | Self-supervised quantized representation integrating KGs with LLMs | Ref |
| 15 | Synergizing LLMs and KGs in science: survey | Ref |
| 16 | KG-driven audit dataset for LLM unlearning | Ref; but "delete means forget" is relevant to the cache: when a row is deleted, cached answers that cited it must drop (`KL-6`) |

### 4.8 VLMs, related works, tools and benchmarks

- **VLMs and KGs.** GraphAdapter (tuning VLMs with a dual KG); improving
  commonsense in VLMs via KG riddles; an empty third item in the paste. Brain2:
  only if photos are ever read by a model; Ref.
- **Related works.** ReGen (RL for text and KB generation, graph to text); the
  CVPR 2023 knowledge-driven vision-language tutorial; *How LLMs will disrupt
  data management* (VLDB 2023) ⭐ (LLMs for cleaning, matching, extraction: the
  import and dedupe starts); Graph ML in the era of LLMs (ACM TIST 2025). Ref.
- **Tools, datasets, benchmarks.** Open RAG (an open source RAG KB); a benchmark
  on the role of KGs for LLM accuracy over enterprise SQL; **OneEval**, a
  benchmark for LLM+KB tasks with four knowledge types (text, table, KG, code)
  across six areas (general, medical, politics, science, law, programming).
  Brain2 reading of OneEval's four types: notes are text, timegrid and tracking
  are tables, links are a KG, and BIM commands/pens are code-like. A test set
  that has at least one question per type tests the router (`ENT-6`).

## 5. Additional Brain2 ideas from this paste (`KL-n`)

| Id | Idea | Source thread | Needs | Status |
|----|------|---------------|-------|--------|
| KL-1 | Match a new pen/list/relation name to the nearest existing one before creating | Ontology matching (OLaLa) | Word + embedding match | Planned |
| KL-2 | Three-word row sentences ("Allie cooked garlic") for prompts and the gaps list | MKGL, path language modeling | Small formatter | Planned |
| KL-3 | Draft → Certified staging for model-written rows; untouched drafts expire | SSKG Hub, legal KG human+LLM | Tags, a status field | Planned |
| KL-4 | Graph-constrained answers: every cited id must be in the evidence; checked by code | Graph-constrained Reasoning, GIVE | `answer` post-check | Planned |
| KL-5 | Slot filling: the model writes a template, code fills names, numbers, times | KGLM copy mechanism | `answer` node | Planned |
| KL-6 | Freshness: re-embed and re-cache per changed row; drop cached answers that cited a deleted row; propose corrections when a new message contradicts a row | KG embedding editing, FLEEK, unlearning audit, SE for KG | Cache keyed by cited ids | Planned |
| KL-7 | Embed each row with its list, person and pen names appended | Neo4j + APOC solution 2 | Semantic input | Planned |
| KL-8 | Follow-up question chips after an answer | Follow-up question generation | UI chip | Idea |
| KL-9 | Personal instruction set from test history (no training) | KG for SFT data, taught examples | Test history | Idea, only if asked |
| KL-10 | Abstention is scored as a pass when correct | KG-guided abstention evaluation | `tests.ts` | Planned |
| KL-11 | Call a run's trace a "dynamic document graph" in docs: the graph built from one message | Story comprehension via dynamic KGs, Cognitive Graph | Docs only | Planned |

## 6. Build order if this is ever claimed

1. `ENT-2` and `ENT-3`: add the router and the cheapest-first order inside the
   existing Log flow. No new start yet. Measure model calls per message before
   and after on the stored test runs.
2. `ENT-1`: add `question` and `day-close` starts for the flows that already
   exist; the `message` start keeps working.
3. `KL-4` and `KL-5`: both tighten answers without a new model call.
4. `ENT-6`, `QA-8`, `KL-10`: score route correctness and abstention.
5. Further starts (`item-open`, `import-batch`, `links-review`) one at a time,
   each with its allowed output kinds.
6. `KL-3` before any wide auto-write.

## 7. What this does not change

- Hosted models never see vault text.
- Writes stay tagged, undoable and within the node's declared outputs.
- No Neo4j, Cypher, OpenSPG or OWL file. Their ideas carry; their tools do not.
- No fine-tuning. Taught examples are the lever.
- The existing four flows, the `message` start, `bimflow-graph-v2:*` and
  `bimflow-tests-v1` stay as they are.
