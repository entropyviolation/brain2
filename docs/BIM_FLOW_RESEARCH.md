# BIM flow: research notes

_Last mapped: 2026-10-30_

Reading that bears on BIM's model layer (`lib/bim-flow/`, the `/lab/bim-flow`
bench). Sources: Hogan, Dong, Vrandečić, Weikum (2025), arXiv 2501.06699; the
KG+LLM tutorial and paper lists the person pasted on 2026-10-30 (the
"Knowledge-Graph-Tutorials-and-Papers" style survey pages: KG and LLM, Taxonomy
and Ontology, KGQA). Everything with a plausible use is here, even when it is
not planned. Nothing here changes what is built. Items marked **Built** exist
in the lab today; **Planned** are not built.

Longer, item-by-item reading lists from the same pastes (ids `ONT-n`, `QA-n`,
`ENT-n`, `KL-n`) sit beside this file:
[`KG_ONTOLOGY_KGQA_REFERENCES.md`](KG_ONTOLOGY_KGQA_REFERENCES.md) and
[`KG_LLM_REFERENCES_AND_ROUTING.md`](KG_LLM_REFERENCES_AND_ROUTING.md). This file
is the short, BIM-specific mapping and the backlog; use those for the full lists.

Vocabulary used below:

- **KG** (knowledge graph) = Brain2's own structure: items, lists, people,
  pens, time-grid entries, links, with their dates.
- **Ontology** = the schema over it: item types, pen scopes (Activity,
  Location, Mood, Company), tags, list roles.
- **SE** (search engine) = word search and embedding search over the person's
  own text (`vault-search.ts`, `retrieve.ts`, `embedScores`).
- **LLM** = the local Ollama nodes. Hosted models never see this text
  (`docs/KNOWLEDGE_GRAPH_PLAN.md` §8.2 rule 5).

## 1. Routing and many doors (the newest design step)

The first build ran every lane on every message in parallel (ten yes/no gates).
That is simple and was close to right, but it asks every question of every
line, costs about ten model calls per line, and lets unrelated lanes fire.
The person asked for more routing and more specialization. Built:

- **One door per screen.** Each way into BIM has its own view in the lab, with
  one start node (`config.entry`, catalogue in `lib/bim-flow/entries.ts`), so a
  routing can be run on its own against different inputs (a pasted day, a
  grouped burst, a typed question, with Search / Related / Semantic context).
  Built views: BIM text, phone capture (a command or question hands off to
  Ask), time-grid note (the activity is known, so it skips that lane), a
  why-blocked reason, a night ritual answer, and a morning plan. The engine
  still allows several start nodes in one flow (`FlowMessage.entry` picks one),
  but none ship that way.
- **`route` node.** Sends a message to the best one output, or none. Outputs can
  carry a regex, so obvious cases are routed by code with no model call. Coarse
  to fine: `Log (routed)` asks one family question (doing / keeping / body or
  mind / people), then one narrow question inside the family. A route follows
  one output by default: the earlier lesson was that multi-select arrays get
  padded to the cap.
- **`handoff` node.** Hands the message, and its entry, to another flow and
  keeps what that flow produced. The phone-capture view uses it to pass a
  question to Ask.
- **A/B on purpose.** `log` (all lanes in parallel) stays as the baseline. The
  Tests sheet has the same afternoon through both. Judge routed vs parallel on
  accuracy and on calls per line before retiring either. Each routed view is a
  pruned copy of one master graph (`only()` in `task-flows.ts`), so a lane fixed
  in one is fixed in the others.

Planned doors (listed in `entries.ts`, `built: false`): new list item, habit
cell, person card, day photo, screen time. Each wants its own start node and
its own first step, not a copy of the BIM-text path.

Research that supports routing and specialization:

- **Question decomposition and templates.** Question Answering Over Knowledge
  Graphs: Question Understanding Via Template Decomposition (VLDB 2018);
  SPARQA, skeleton-based semantic parsing (2020); Unsupervised Question
  Decomposition for Question Answering (EMNLP 2020); CompKBQA, component-wise
  task decomposition (EMNLP 2025); Query Graph Generation for multi-hop complex
  questions (ACL 2020). Use: the `plan` extract is a one-step decomposition
  (subject, person, days, intent). **Planned:** decompose a compound question
  ("what do I wear most with Elijah, and is it the same at his place?") into
  sub-questions that each take their own lane, then join.
- **Agents that act and observe.** Interactive-KBQA (ACL 2024): the model
  thinks, calls a tool on the KB, observes; Think-on-Graph (ICLR 2024); Tree-of-
  Traversals (ACL 2024); KBQA-o1 and ReKG-MCTS (search over reasoning paths);
  Reasoning with Trees. Use: today's flows are fixed graphs. A later `act`
  node lets the answer step request one more `retrieve` when its evidence is
  thin (federation, in the Hogan et al. sense). Keep a hard cap on loops.
- **Pangu, "Don't Generate, Discriminate" (ACL 2023).** A symbolic agent builds
  candidate plans and the model only judges plausibility. This is the BIM
  split: code proposes (search, counts, blocks), the model picks or phrases.
- **Choosing the tool by question type** (Hogan et al. §4.4 ensemble and
  federation; ToolQA, NeurIPS 2023, a dataset for LLMs using external tools;
  Graph-ToolFormer). Use: routes are the ensemble; `compute` and calendar/
  weather reads are the tools. **Planned.**

## 2. Ontology and taxonomy

- **The three-layer ontology (Palantir style): semantic + kinetic + dynamic.**
  General KGs mean only the semantic layer. Mapped onto Brain2:
  - *Semantic:* item types, list roles, pen scopes and their tree, tags. This
    exists and is the closed vocabulary BIM's `choose` nodes pick from.
  - *Kinetic:* binding changing data to that schema: Telegram rows, time-grid
    entries from the phone, screen time, iPhone calls and texts, and the hub
    (`/api/persist`). `store-snapshot.ts` and `datasets.ts` are the read side.
    **Planned:** a declared binding table (source, table, schema it maps to,
    freshness) so each flow can state what it depends on and how old it is.
  - *Dynamic:* rules that fire when the data meets a condition. **Planned, and
    the most useful idea here:** watchers such as "a task pushed three times
    with no reason" starts the `item-why` door; "no Location entry for four
    hours while on the Brain2 pen" asks one question; "a ritual worry seen in
    three rituals" raises a pattern. Each watcher is a condition in code that
    opens a start node. It never writes; it asks or suggests.
  - Do not call this layering the same as a plain OWL ontology; keep the three
    names apart in code and docs.
- **Microsoft Fabric ontology** (semantic + binding): the closest to what
  Brain2 has. Keep as the minimum bar: every dataset names the schema it maps
  to.
- **Knowledge Graph = ontology (schema) + graph database (instances).** The
  schema half is what lets a small model pick from five options instead of a
  thousand. Grow it with data, not by hand.
- **Growing the schema with LLM suggestions.** Extending an Event-type Ontology
  with fine-tuned LLM suggestions (ACL 2023); LLMs4OL (ISWC 2024); Scientific
  KG and Ontology Generation with open LLMs (NeurIPS 2024); Burr, ontology
  learning from relational databases (SIGMOD 2025). Use: propose new activity
  pens, tags, and list roles from repeated unmatched text, as a reviewable
  list, never silently. **Planned:** a "new pen suggested" insight kind.
- **OG-RAG: ontology-grounded retrieval (EMNLP 2025).** Retrieve by the
  schema's own structure, not by text alone. Use: the `entries` retrieve
  should be able to say "the Activity pen named X and its tag path", not just a
  text hit.
- **Taxonomy induction and set expansion.** SetExpan; Taxonomy Induction Using
  Hypernym Subsequences; Probase; Customized organization with a focused topic
  hierarchy; Top-k graph summarization of large hierarchical DAGs. Use:
  `related` is a set-expansion step today, done by the model. A code-side
  expansion from the person's own pens and tags (siblings, children) would be
  more accurate for "showered" → bathing, hygiene. Summarizing the pen/list
  tree into a small hierarchy is how to show the person the shape of their
  data.
- **Efficient axiomatization of OWL 2 EL from data by formal concept analysis**
  (AAAI 2024): deriving rules from instance data, e.g. "every entry on pen
  Elijah is also on Company". **Planned,** low priority.

## 3. Question answering over the vault (KGQA)

The pasted KGQA page is about KGs; the person's vault is a small, personal,
incomplete, temporal KG plus a lot of free text. What transfers:

| Technique | Source | In BIM |
|-----------|--------|--------|
| Entity linking and disambiguation | KGQA page cross-reference | `namesFor` resolves a name, nickname, or full name to a person. **Planned:** a `link` step that returns the candidate set and a confidence, and routes to clarify when two match. |
| Relation linking | same | Matching the question to a pen scope (Activity vs Location vs Company). Today `plan` has no scope field in the ask flow; **Planned:** add one and use it to pick `scopeIds`. |
| Query graph / structured query generation | Query Graph Generation (ACL 2020); LLM-Based SPARQL Generation with Selected Schema (CCKS 2023); SPARQL generation studies (CIKM 2024, ISWC 2024) | **Planned:** the plan emits a small structured query (scope, pen filter, date range, group by, aggregate) that code executes over entries. Select only the relevant schema slice into the prompt, as the CCKS paper does, so the model never sees all 300 pens. |
| Compositional programs | KQA Pro (ACL 2022) | The same: a program, not prose, so a count is a function call. |
| Multi-hop | MetaQA, HotpotQA, MuSiQue, 2WikiMultiHop, HOLMES (ACL 2024), Scalable Multi-Hop Relational Reasoning | The `overlap` retrieve is a two-hop (person → days → subject on those days). **Planned:** a generic hop chain (A → days/places/people → B). |
| Temporal questions | TEQUILA (CIKM 2018), TEQA, Time-aware ReAct (NAACL 2025), MemoTime (WWW 2026), RTQA (EMNLP 2025), STaR | "Last time", "since", "this week", "how long ago". Built: `plan.days` and "days before TODAY". **Planned:** typed temporal intents (first, last, between, every, streak, gap) with code doing the date math. |
| Numerical and analytical | MarkQA (EMNLP 2023) | Counts, minutes, and top words are counted by code (`retrieve.ts` facts). **Planned:** the `compute` node. |
| Spatial | SAKE (ICDE 2021); GeoQuestions1089 | Location entries and place names. Questions like "where was I when…". |
| Ambiguity and clarification | KGQA with Ambiguous Query (WWW 2023); Asking Clarification Questions in KB-QA (EMNLP 2019) | **Planned:** a `clarify` node that returns one question ("which Elijah?", "which week?") when the link step finds more than one candidate, and records the answer as a taught example. |
| Incomplete KG | Generate-on-Graph (EMNLP 2024); What's Missing: knowledge-gap guided multi-hop QA (EMNLP 2019); CogMG (ACL 2024) | The vault is incomplete (no shirt rows). Built: the answer says "the notes do not record it", confidence none. **Planned:** a gaps list: questions asked that no row can answer, shown as "start logging X?". |
| Faithful, constrained reasoning | Graph-constrained Reasoning (ICML 2025); FiDeLiS (ACL 2025); GIVE (ICML 2025); Reasoning with Trees (COLING 2025) | Answers are limited to evidence lines and cite them (`used`). **Planned:** reject any answer whose cited lines do not contain the date or number it states (code check, like the insight citation check). |
| Uncertainty and abstention | Towards Trustworthy KG Reasoning: an uncertainty-aware view (AAAI 2025); KG-guided evaluation of abstention (NAACL 2025) | `confidence` plus the "unknown" control test. **Planned:** calibrate per lane from the test history; abstain below a bar. |
| Question naturalness | Would You Ask it that Way? (SIGIR 2022) | People type "when was i last showered", "showr", "when did i last wash". **Planned:** a rewrite step, and tests with several phrasings per question. |
| Re-ranking | Efficient and Accurate Contextual Re-Ranking for KGQA (LREC-COLING 2024) | A second pass that re-scores the top rows against the full question before the answer node. |
| Keyword search over graphs | Keyword Search on RDF Graphs, query graph assembly (CIKM 2017); top-k similarity search over KGs (ICDE 2020) | `vault-search.ts` ranks by words matched; items bring their lists. Same idea. |
| Retrieve, rewrite, answer | Retrieve-Rewrite-Answer (KG-to-text) | Turn the structured facts into a short sentence list before the answer node. The `FACTS COUNTED BY CODE` block is this. |
| Hyper-relational facts | HOLMES; Wikidata qualifiers | An entry carries qualifiers: precision, clock certainty, generator, notes. Pass them to the answer ("estimated"). |
| Conversational | DiaKoP; Interactive-KBQA | **Planned:** follow-up questions ("and the time before that?") need the previous question's plan kept. |
| Commonsense and long tail | CR-LT-KGQA (SIGIR 2024); Head-to-Tail (NAACL 2024) | Own-life questions are all long tail. Tail rows are why retrieval beats the model's memory here. |
| Message passing, GNN reasoning | QA-GNN; Message Passing for Complex QA; NuTrea | Not needed at this size. Revisit only with a large graph. |

Do not use: knowledge-graph embedding QA (KEQA), training QA models from
corpora, and large GNN pipelines. The vault is small and the model is a
local 14B.

## 4. KG for the LLM: what goes into the prompt

From the "KG for inference / prompting / RAG" lists:

- **Inject triples** (KAPING, ACL 2023 workshop; KnowGPT, NeurIPS 2024; KG
  Prompting for multi-document QA, AAAI 2024; Question-Aware KG Prompting, ACL
  2025): put a few relevant facts about the person's own entities into the
  prompt. **Planned:** person profile (nicknames, relation, dates), pen tag
  path, list membership as short triples.
- **GraphRAG, G-Retriever, KAG, Graph-RAG for customer service (SIGIR 2024),
  Retrieval and Reasoning on KGs (EMNLP 2024).** Retrieve neighbours, not only
  matches. **Planned:** an item's linked items, the list it sits on, and the
  people linked to it.
- **Agent memory graphs** (list 3.2; MemoTime). BIM is a memory system for one
  person. The insight log, the taught examples, and the answered questions are
  its memory; `insight-log` is already a dataset the Loop analyses read.
- **Fact-error detection and correction with retrieved evidence** (FLEEK,
  EMNLP 2023); **KG-based retrofitting of hallucinations** (AAAI 2024). The
  `check` node is this, against the person's own rows.
- **KGs as a source of trust** (JWS 2025); **Can KGs make LLMs more
  trustworthy** (ACL 2025). The product claim for BIM: every answer shows the
  rows it came from.
- **Ontology-guided reverse thinking** (ACL 2025): from the answer type back to
  the question, to prune retrieval. Use: if the question asks "when", only
  retrieve dated rows.

## 5. LLM for the KG: construction and auto-write

The decided auto-write item (`BIM_FLOW_HANDOFF.md`, "Decided, build next" 1)
is LLM-for-KG knowledge generation. What the literature adds:

- **Draft, then certified.** SSKG Hub (2026): LLM extraction produces
  provenance-linked draft KGs that experts review and promote under
  role-based governance. Collaborative human + LLM construction (legal KG,
  2024). Expert-in-the-loop prompting (HCII 2026). Use: three states for
  anything BIM adds: **draft** (suggested, visible in the dry-run sheet),
  **kept** (the person pressed Keep, or auto-write above a bar), **certified**
  (confirmed twice or edited by the person). The insight log already has
  new / kept / dismissed.
- **Provenance on every fact.** Store the evidence span, model, node path, and
  `why`. The analyses already store the cited evidence lines.
- **Canonicalization.** Construction and Canonicalization of Economic KGs with
  LLMs (KGSWC 2024): merge "mongoose", "Elijah", "elijah g" into one entity
  before writing.
- **Construction recipes.** Enhancing KG Construction Using LLMs (2023);
  CodeKGC (code-style prompts for triples); SAC-KG (ACL 2024); Generating
  Domain-Specific KGs from LLMs (ACL 2025); Combining Self-RAG with
  divide-and-conquer for KB construction (LM-KBC 2025). Use: the extract nodes
  are small construction steps; keep them narrow and schema-bound.
- **Completion.** MKGL (a three-word KG language, NeurIPS 2024),
  contextualization distillation, generative KG completion. Use: **Planned**
  "this entry has a pen but no variant", "this person has no relation".
- **Danger noted by the survey.** Hallucinated facts pollute a KG, and model-
  generated facts are far less accurate than curated ones. Write only evidence
  spans; prefer `estimated`; never write the model's own knowledge.
- **Editing and freshness.** Editing LM-based KG embeddings (AAAI 2024). The
  stores are the truth; derived embeddings must be rebuilt, not patched.

## 6. KG as training data (later, per person)

The author's own view: KG for preparing training data is the more promising
direction. For BIM: kept insights, corrected writes, answered questions, and
taught gate examples are a small, high-precision, per-person corpus.
Relevant: SKILL (structured knowledge infusion, NAACL 2022), KG-based
synthetic corpora, MedReason (KG-guided reasoning chains), Graph CoT, KG
finetuning for knowledge manipulation (ICLR 2025), KBLaM (knowledge-base
augmented LM). **Planned, after an eval set exists:** export the labelled gate
examples as few-shot sets, and only then consider tuning a small model for the
yes/no gates.

## 7. Evaluation: how to know a flow got better

- **Three levels of generalization** (GrailQA, WWW 2021): i.i.d., compositional,
  zero-shot. Split the labelled messages the same way: pens seen in examples,
  new combinations of seen pens, and pens never taught.
- **Hops** (MetaQA 1/2/3-hop; MuSiQue; 2WikiMultiHop): tag each test question
  with its hop count and report per hop. "Last shower" is 1 hop; "shirt with
  Elijah" is 2.
- **Head, torso, tail** (Head-to-Tail, NAACL 2024): report accuracy for
  frequent, middling, and rare entities. People and pens seen once are the
  tail.
- **Factuality and consistency of an LLM as a KB** (Large LMs as Reliable KBs,
  2024): run the same question five times, rephrase it, and compare. Needs a
  cache-off mode in the test runner (the in-memory prompt cache hides this).
- **Benchmark design** (CBench, VLDB 2021; Knowledge Graph QA Leaderboard,
  LREC 2022; KGQA dataset critique, SIGIR 2022): publish per-test results with
  the exact prompt, so a regression is reproducible. The Tests sheet keeps the
  output; **Planned:** keep the prompts and model digest too.
- **Attribution** (Can LLMs evaluate complex attribution in QA, ACL 2025):
  check that each cited line supports its claim. Code checks the citation
  exists; **Planned:** a model-judged support check on a sample.
- **Abstention** (NAACL 2025): count correct "I do not know"s as passes. Built
  as the "something never written" test.
- **Table 1 of Hogan et al.** (correctness, completeness, freshness,
  transparency, coherency, personalization) as the per-flow score axes.

## 8. Tools and engines worth knowing

- **OpenSPG** (Ant Group + OpenKG): schema-constrained programmable KG engine
  with logical rules and construction/inference operators. Relevant for the
  *dynamic layer* idea (rules that fire). Heavy; borrow the idea, not the
  engine.
- **Neo4j + LLM patterns.** Two solutions: have the model write a Cypher query,
  or enrich text embeddings with graph connections and retrieve at query time.
  BIM takes the second, which fits a small local model; the first is the
  structured-query plan above.
- **Open RAG**, **OneEval** (four knowledge types: text, table, KG, code; six
  domains), **KG-LLM-Papers**, **Awesome LLM-KG**: reading lists and
  benchmarks. OneEval's split by knowledge type is a good way to tag tests:
  text rows, table rows (entries), graph rows (links), code (compute).
- **LLM+KG workshops** (VLDB 2024, KaLLM 2024) and the WSDM/SIGMOD 2024
  keynote on RAG: survey material.

## 9. The author's position (kept as a design check)

1. A graph is an intuitive model of knowledge, but not necessarily the best one
   for everything; a neural model captures distributions a graph cannot.
2. A KG gives verified facts and avoids hallucination.
3. Worth pursuing: KG to prepare training data; KG to improve inference
   (RAG or prompting).

For Brain2 that means: keep the vault authoritative, let the model phrase and
suggest, and let the person's Keep / Dismiss be the verification step.

## 10. Survey and tutorial reading list

Core: Hogan et al. 2025 (this document's origin); Research Trends for the
Interplay between LLMs and KGs (VLDB 2024 workshop, arXiv 2406.08223);
Unifying LLMs and KGs: A Roadmap (TKDE 2024); Knowledge-Empowered,
Collaborative, and Co-Evolving AI Models (Engineering 2024); Integrating LLMs
and KGs for Next-level AGI (WWW 2025 tutorial); Unifying LLMs and KGs for QA
(EDBT 2025 tutorial); Give Us the Facts (TKDE 2024); LLMs on Graphs (TKDE
2024); Graph Meets LLM (IJCAI 2024); Graph learning and LLMs: a holistic
survey (2025); LLMs and KGs: Opportunities and Challenges (2023); Augmented
Language Models: a Survey (Meta, 2023); How LLMs Will Disrupt Data Management
(VLDB 2023); Language Models as Knowledge Bases? (EMNLP 2019); Language Models
Sounds the Death Knell of KGs (2023); ChatGPT vs Traditional QA for KGs (2023);
Core techniques of KBQA systems (KAIS 2017); A Survey on Complex QA over KB
(2020); Complex KBQA: A Survey (2021); Neural approaches for QA over KGs
(2019); Multi-hop QA with LLMs and KGs (Neo4j blog); Multilingual QA systems
for KGs (Semantic Web 2023); Representation learning in complex logical query
answering (ACM CSUR); What is in the KGQA benchmark datasets (J. Data Semantics
2021). Talks: The Future of KGs in a World of LLMs (Vrandečić, KGC 2023); The
Journey to a Knowledgeable Assistant with RAG (Dong, WSDM/SIGMOD 2024).

## 11. Seen, not applicable now

Vision-language KG work (GraphAdapter, KG riddles, multimodal KG survey);
domain KGs for urban data, ESG, sustainability standards, law, healthcare,
cybersecurity, forensics, scholarly data, education, and music; text-to-SQL
enterprise benchmarks; commonsense multiple-choice (RiddleSense, CommonsenseQA,
OpenBookQA); multilingual KGQA beyond the person's own English, French, and
Spanish; video QA. Their methods are covered above where they transfer.

## 12. Backlog derived from all of the above

Order is a suggestion. Each names where it plugs in.

1. **Clarify node** and a `link` step with candidates (`namesFor`, new node).
2. **Structured query plan** over entries, executed by code (`plan` fields,
   `retrieve` kind `query`).
3. **`compute` node** of plain functions: count, sum minutes, group, streak,
   gap, date difference (`run-flow.ts`).
4. **Typed temporal intents** and date math in code (`plan.intent`, `retrieve`).
5. **Watchers** (dynamic layer): conditions that open a start node and ask.
6. **Gaps list**: asked-but-unanswerable questions as "start logging X".
7. **Answer verification in code**: cited lines must contain the stated date or
   number; reject otherwise.
8. **Eval set** with hops, head/torso/tail, and the three generalization
   levels; cache-off consistency runs; keep prompts and model digest.
9. **Per-lane confidence bars** learned from test history, gating auto-write.
10. **Draft / kept / certified** states for anything BIM adds.
11. **Entity canonicalization** before any write.
12. **Graph neighbours** and triples injected into prompts.
13. **Schema suggestions** (new pens, tags, list roles) as a reviewable insight.
14. **Planned doors** in `entries.ts` each get their own start node.
15. **Embedding search** (`nomic-embed-text`, ask before pulling) beside words.
16. **Per-person instruction section** with a safety layer, as already decided.
