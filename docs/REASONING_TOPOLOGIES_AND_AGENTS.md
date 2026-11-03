# Reasoning topologies, read against Brain2 and its agents

_Last mapped: 2026-11-01_

**Notes only.** No code and no other doc changed except one row in
[`README.md`](README.md). Nothing here is built unless a line says **Landed**.
Anything marked **Planned** is unbuilt intent.

Source: Besta et al., _Demystifying Chains, Trees, and Graphs of Thoughts_,
arXiv:2401.14295v3 (ETH Zurich, April 2024).
<https://arxiv.org/html/2401.14295v3>

Read beside: [`BIM_FLOW_HANDOFF.md`](BIM_FLOW_HANDOFF.md),
[`BIM_SIGNALS_PLAYBOOK.md`](BIM_SIGNALS_PLAYBOOK.md),
[`KG_LLM_REFERENCES_AND_ROUTING.md`](KG_LLM_REFERENCES_AND_ROUTING.md),
[`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md),
`components/Lab/BimFlow/README.md`.

## 0. What the paper is, and what it is not

It is a survey and taxonomy of **prompting structure**. A model's reasoning is
drawn as a graph. Nodes are _thoughts_ (a step, plan, passage, number list).
Edges are dependencies. The shape is a chain (CoT), a tree (ToT, Skeleton of
Thought), or a graph (GoT, with branching and merging). It scores about 40
schemes on a seven-part blueprint and compares cost, latency, and quality.

It is **not** a paper about cognitive architectures, long-term memory, or
autonomous agents. Agent systems (AutoGPT, ReAct, Reflexion) appear in passing.
So the memory and agent ideas below are Brain2's own extension. The paper
supplies the vocabulary for the control part only: how a model's work is
shaped, scheduled, scored, and stopped.

That is still the right part to borrow. Brain2's BIM flow bench is already a
hand-built reasoning topology.

## 1. The paper's vocabulary

| Term | Meaning |
|------|---------|
| Thought | One semantic unit of task resolution. |
| Topology | Graph `G = (V, E)` of thoughts and dependencies. Class: chain, tree, graph, hypergraph. |
| Solution vs in-context topology | The structure the run builds, vs the structure shown as an example inside one prompt. |
| Scope | Single prompt, or many prompts. |
| Representation | Explicit (JSON, triples, adjacency list) or implicit (a textual recipe). |
| Derivation | Manual, automatic, learned, semi-automatic. |
| Schedule | How the graph is walked: BFS, DFS, parallel. |
| Four modules | **Generator** (next steps), **Evaluator** (scores), **Halter** (stop or go on), **Controller** (builds and walks the graph). |
| GoT transformations | Generate, Aggregate, KeepBest, Improve. |

Findings worth keeping:

- Chains are cheapest (usually one call). Trees and graphs do better on hard
  tasks but cost many calls. More branching is not better; the best width
  depends on the problem.
- Aggregation (merging partial results) matters when pieces need each other.
- The authors argue structure can often be encoded in **one** prompt to cut cost.
- Skeleton of Thought: write an outline first, then expand the points in
  parallel. Up to about 2.7x faster in their report.

## 2. Brain2 is already a topology, by hand

The BIM flow bench (`lib/bim-flow/`, `components/Lab/BimFlow/`) is a directed
graph of narrow model and code steps. Placed on the paper's blueprint:

| Blueprint aspect | Brain2 today |
|------------------|--------------|
| Class | Directed acyclic graph with Y/N branches. Mostly tree-like per lane, with merges at `propose` and `blocks`. |
| Scope | Multi-prompt. One small question per node. |
| Representation | **Explicit** and editable: nodes and wires in the bench, saved per flow (`FLOW_REV` refreshes saved copies). |
| Derivation | **Manual**, by the person and the builder. Not learned. |
| Schedule | Code walks the graph per message (`run-flow.ts`). A node sees only outputs on its own path back to the message. |
| Pipeline parts | Retrieval (`search`, `retrieve`), tools (`blocks` assembly, `compute.ts`), local models (`ollama.ts`), no fine-tune. |

The four modules map almost one to one:

| Paper module | Brain2 piece |
|--------------|--------------|
| Generator | `extract` (PULL), `choose` (PICK), `answer` (SAY), `related` (TERMS). |
| Evaluator | `gate` (Y/N), `answer` in `check` mode (re-reads a draft against evidence), suggestion verdicts (`suggestion-verdicts.ts`). |
| Halter | Gates that end a lane on No. The per-start model-call **budget** proposed in `ENT-1`. The person's Accept. |
| Controller | `run-flow.ts` and the chat router (`chat-router.ts`). Code decides first; the model decides last. |

The paper's transformations also have homes:

- **Generate**: `extract`, `propose`.
- **Aggregate**: `propose` collects what would be written; `assembleBlocks`
  merges activity signals into spans.
- **KeepBest**: `choose` over a short list from `search`.
- **Improve**: `answer` in `check` mode. The kept runs of an LLM suggestion pass
  (`run-history.ts`) are the raw material for a later improve loop.

Brain2 already agrees with the paper on its main economy lesson. The handoff
found that one prompt asking for everything filled empty hours with made-up
blocks, while one narrow yes/no per room plus a small pick did much better.
That is the "decompose, then aggregate" result in the survey, found by testing.

## 3. Where the paper pushes back

1. **Cost of a flat fan-out.** Log a message runs every lane's gate on every
   message, about 10 s on a 14B model. The paper's cost analysis says width
   should be tuned to the task, not maximised. This is the same finding as
   `ENT-2` in `KG_LLM_REFERENCES_AND_ROUTING.md` (route first, run one lane).
   The paper adds a name for the fix: a **schedule** that adapts to the input,
   instead of a fixed one.
2. **Single-prompt encoding.** Several gates that share a lane could be asked
   as one structured prompt that returns a small JSON object, then checked in
   code. The paper says this is where the cost savings are. Our own handoff
   warns that multi-select outputs get padded, so any test must compare it on
   the labelled sheet before it replaces separate gates.
3. **Explicit representation helps the model.** Passing a short adjacency list
   of a person's nearby items in a prompt is the paper's "graph in context".
   Brain2's item graph (`KNOWLEDGE_GRAPH_PLAN.md`, `LINKS_REDESIGN.md`) can
   supply it. Feed the model a handful of typed edges, not prose.
4. **Derivation is the open door.** Every topology here is hand-drawn. The
   paper lists automatic and learned derivation as the main open problem.

## 4. Proposals

All **Planned**, additive, off by default where a model is involved. IDs are
`RT-n`.

**RT-1 Name the four modules in the bench.** In the BIM flow README and the
inspector, tag each node kind as Generator, Evaluator, Halter, or Controller.
No code. It gives the next person the paper's map and keeps new node kinds
honest: a new kind should say which role it plays.

**RT-2 Adaptive schedule, router first.** Same as `ENT-2`/`ENT-3`. A code-rule
router, then a small-model label, then only the chosen lane. Log which step
answered so cost per route is measurable. The paper's evidence for it is that
width should follow task difficulty.

**RT-3 Per-start budget and a Halter node.** A budget of max model calls per
start kind, and a visible stop reason on each run ("lane gate said No", "budget
spent", "needs person"). Store the stop reason in `run-history.ts`.

**RT-4 Skeleton then expand, for recaps.** Recap a day could first emit an
outline from code (blocks, gaps, people, counts), then expand each point
separately and in parallel on the local model, then merge. Code owns the facts;
the model only phrases. Stays inside the rule that `answer` cites evidence only.

**RT-5 Topology as data, measured.** Treat each shipped flow as a comparable
record: class, node count, calls per message, seconds, labelled-sheet score.
The bench already has the pieces (`tests.ts`, `tests-real.ts`, run history).
A small table in the lab turns "which shape is better" into a number.

**RT-6 Tree and merge for hard questions.** For Ask about me, run two or three
retrieval paths (by time, by person, by word), `answer` on each, then one
`check` merge that must cite rows. Only for questions the router marks hard.
The paper's Self-Consistency and Aggregate patterns, with our evidence rule.

**RT-7 Learned topology choice.** Only after RT-5 has data: pick a flow shape
from past runs (which lane answered which kind of message correctly). This is
`BIM_SIGNALS_PLAYBOOK.md` applied to the flow itself: learn the fact from the
person's own runs first, then give it to the model.

## 5. Agents and cognitive architectures: what to take and what to add

The paper does not cover these, so this section is Brain2's own reading.

**What an agent is here.** An agent is a Controller that may choose its own
next node, call tools, and loop until a Halter stops it. The BIM flow is the
constrained form: the graph is fixed and code is the controller. A fuller agent
lets a model pick the next node from a closed list.

**Rules that carry over unchanged:**

- **Closed enums, not free choice.** The router picks one label from a list.
  An agent picks one tool from a list. Never free text that code must guess at.
- **Code first, model last.** Exact rules, then word match, then small model,
  then big model (`ENT-3`).
- **Evidence only.** Answers cite rows. A claim without a row is dropped.
- **Nothing is written without an accept.** Agents propose; the accept door
  (`accept.ts`) writes. This is the human Halter, and it stays.
- **Local models by default.** No vault text leaves the machine for a model
  without the person's yes.
- **Bounded.** Every agent run has a call budget and a clock limit.

**A cognitive architecture, in Brain2's terms.** The vault already holds the
parts that classic architectures name:

| Architecture part | Brain2 holder |
|-------------------|---------------|
| Perception | Capture, BIM texts, tracking, phone sync, ingest. |
| Working memory | The context a node sees on its path; `day-context.ts`. |
| Long-term / episodic memory | Append-only item ledger, tracked days, run history. |
| Semantic memory | Item graph, relations, lists, pens, people. |
| Procedural memory | Habits, rituals, shipped flows. |
| Deliberation | The flow graph and its gates. |
| Action | Proposals, then Accept. |
| Reflection | Reviews, Calibration, plan vs reality. Wiener's loop in [`cyberneticsbrain2.md`](cyberneticsbrain2.md). |

**Planned, in order of value:**

- **AG-1 Agent run record.** Every agent run is one row: start kind, nodes
  visited, tools called, stop reason, what it proposed, what the person did
  with it. Extends `run-history.ts`. Nothing else is needed before any agent.
- **AG-2 Tool list as a registry.** The retrieval and compute steps
  (`vault-search.ts`, `retrieve.ts`, `compute.ts`) become named tools with
  typed inputs and outputs. A flow node and an agent call the same tool.
- **AG-3 Reflection pass.** After a day closes, an agent compares what was
  proposed with what was accepted or rejected (reject reasons are already kept)
  and writes a short fact for the person to confirm. This is the Improve step
  and the feedback loop in one. It fits `BIM_SIGNALS_PLAYBOOK.md`: facts come
  from their data.
- **AG-4 Specialist lanes with one planner.** Many small experts (time,
  people, food, money) and one planner that only routes and merges. This is the
  same many-start-nodes idea, with the router as the planner.
- **AG-5 Consistent memory writes.** An agent never edits memory directly. It
  proposes an item, a link, or a note; the existing proposal inbox and Accept
  handle it (`LINKS_REDESIGN.md`).

## 6. What stays refused

- Free-running agents that write to the vault without Accept.
- Open-ended loops with no budget.
- Sending vault text to a hosted model by default.
- Showing a model's reasoning as if it were the person's own data. A guess is
  labelled a guess, as in the estimated-value rule.
- Ever-wider fan-out because trees "score better". Width is bought only where
  the labelled sheet shows a gain.

## 7. Open questions

- Does a one-prompt, multi-gate call hold up on the labelled sheet against
  separate gates? (`RT-2`)
- Which recap sections need expansion in parallel, and which are cheap enough
  to leave as code? (`RT-4`)
- Is a learned topology choice (`RT-7`) worth it for one person's data volume,
  or do hand rules beat it?
- What is the smallest agent run record that still lets `AG-3` learn from it?

## 8. Not covered

Sections of the paper not read in full: the appendices (per-scheme detail,
benchmark tables) and the last 50,000 characters of the page. The proposals use
only the main text, the research opportunities, and the conclusion.
