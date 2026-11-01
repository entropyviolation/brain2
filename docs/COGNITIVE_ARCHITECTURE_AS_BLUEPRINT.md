# Cognitive architecture as a blueprint, read against Brain2

_Last mapped: 2026-11-01_

**Notes only.** No code changed. Nothing here is built unless a line says
**Landed**. Anything marked **Planned** is unbuilt intent.

Source: Nikhil Dhamne, _Cognitive Architecture as a Blueprint: Building
Intelligent Systems Beyond Models_, Autodesk Research blog, 2026 (page shows
05/04/2026, format ambiguous).
<https://www.research.autodesk.com/blog/cognitive-architecture-as-blueprint/>

Read beside [`REASONING_TOPOLOGIES_AND_AGENTS.md`](REASONING_TOPOLOGIES_AND_AGENTS.md)
(the prompting-structure paper; this file is its architecture-level partner),
[`cyberneticsbrain2.md`](cyberneticsbrain2.md), [`MAP_LOOP_MEANING.md`](MAP_LOOP_MEANING.md),
[`BIM_SIGNALS_PLAYBOOK.md`](BIM_SIGNALS_PLAYBOOK.md),
[`KNOWLEDGE_GRAPH_PLAN.md`](KNOWLEDGE_GRAPH_PLAN.md).

## 0. What the post is, and what it is not

A short opinion and tutorial piece. It argues that intelligence is a **system
design** problem: closed-loop coordination of perception, representation,
memory, inference, and action, not one model tuned for benchmarks. It defines
a cognitive architecture as the engineered scaffold that makes cognition
operational, introduces Soar, ACT-R, and LIDA, gives cognitive radio and radar
as real closed-loop systems, and ends with a "get started" kit.

It has **no experiments or benchmarks**. Its claims that such systems are more
explainable and deterministic are asserted, not shown. Figures were not
readable in my fetch (image placeholders), so the neuroscience-levels table
and the loop diagrams are not covered. It does not mention LLMs, and mentions
agents and planning only in passing.

So it is a vocabulary and a checklist, not evidence. That fits Brain2, which
already is a perception-first, memory-heavy, closed-loop system.

## 1. The post in brief

| Idea | Content |
|------|---------|
| Levels | Borrow from the brain at one chosen level of abstraction. Do not copy the brain; do not mix levels. |
| Processes | Perception, attention, memory, learning, reasoning, inference, planning. Memory, learning, reasoning matter most. |
| Representation | Perception is a representation pipeline, not preprocessing. Cortical-map analogy: lay sensors on a 2D or 3D surface. |
| Families | Symbolic (rules), emergent (networks), hybrid. Hybrid is pragmatic because hand rules do not scale. |
| Soar | Production rules, decision cycles, impasses become subgoals. Interpretable; brittle outside structured domains; weak on raw perception. |
| ACT-R | Modules with buffers, hybrid symbolic and sub-symbolic. Human-like, predictable; knowledge bottleneck, serial, no fatigue or emotion. |
| LIDA | Global Workspace: attention competition, broadcast, action selection in cycles. Integrates processes; less standard, harder to validate. |
| Architecture vs cognitive AI | Top-down blueprint vs bottom-up single-process work. |
| Toolkit | Closed-loop feedback; state estimation and Bayesian inference (minimize surprise); prediction and error correction; modularity with defined channels; homeostasis. |
| Start kit | Memory (semantic, episodic, procedural, overlapping); DIKW pyramid; Bayesian brain; perception-first plan feeding memory for continual learning. |

## 2. Brain2 against the blueprint

Brain2 was built as a loop before this vocabulary was applied to it.

| Post | Brain2 today |
|------|--------------|
| Closed loop | Capture and tracking sense; vault remembers; Plan and Scheduler act; plan-vs-reality, Calibration, and Reviews feed the miss back. The Wiener reading is `cyberneticsbrain2.md`. |
| Perception as representation | Capture, BIM texts, phone sync, ingest, minute-grid tracking. The minute index 0–1439 per day is the day's "cortical map". |
| Attention | Priority ranking (`lib/priority.ts`), entropy-weighted tasks, Inbox, the morning walk. What gets surfaced is attention. |
| Semantic memory | Item graph, relations, lists, pens, people (`KNOWLEDGE_GRAPH_PLAN.md`, `LINKS_REDESIGN.md`). |
| Episodic memory | Append-only item ledger (`lib/item-activity.ts`), tracked days, BIM messages, kept run history. |
| Procedural memory | Habits, rituals, shipped flows in `lib/bim-flow/`. |
| Working memory | The context a flow node sees on its path; day context (`day-context.ts`); the undo stack (`lib/action-history.ts`). |
| Reasoning | Gate / pick / extract / answer in the BIM flow, with code first and model last. |
| Prediction and error | Plan vs reality, calibration, change-point detection in `lib/metrics.ts`. The miss between order and result is already a first-class input. |
| State estimation | Sleep inferred from two sources, marked estimated (`lib/sleep-inference.ts`). Estimated values never pass as observed (`lib/estimated-values.ts`). That is a small Bayesian rule: prior vs evidence, with the source shown. |
| Modularity | The module law "Item is the only noun". Rooms talk through items, not each other. |
| Homeostasis | Habit weights rise after misses; exemptions drop out of both sides of a fraction. |
| Hybrid family | Rules and code decide the clear cases; small local models decide the rest. Hybrid by the post's definition. |

Brain2 is closest to **ACT-R** in shape (typed modules, productions as rules,
memory with learned weights) and to **LIDA** in its attention and broadcast
need (see below). It is nothing like Soar's single rule engine.

## 3. What the post adds

1. **A named memory triad as a design check.** Brain2 has all three kinds but
   never labels them. A new feature could be asked: which memory does it read,
   which does it write, and does an episode ever become a fact? That last move
   (episodic to semantic) is the weak seam. Today a person promotes it by hand
   or accepts a suggestion.
2. **DIKW as a lens on rooms.** Data (rows, minutes) to Information (counts,
   spans) to Knowledge (typed edges, habits, confirmed facts) to Wisdom
   (applied rules, calibrated defaults). The Data tab sits at D→I; Links and
   Reviews at I→K; Calibration and the BIM signals playbook at K→W.
3. **Impasse becomes subgoal (Soar).** When a flow cannot decide, it now
   usually drops the message. The Soar idea is to make the stall a visible
   next step. Brain2 has a seed: the interview answer mode asks the person up
   to eight questions about what the data cannot say.
4. **Global workspace (LIDA).** One shared place where competing signals
   (a gap in the day, an overdue habit, a new text) compete, and the winner is
   broadcast to every room. Brain2 has priority per room; there is no
   cross-room "what matters now" winner.
5. **Surprise as the learning signal.** Active inference says minimize
   prediction error. Brain2 already computes the miss; it does not yet rank
   its own predictions by how often they were wrong.
6. **Choose the abstraction level once.** The post warns against mixing
   levels. The matching house rule is to keep each doc and each module at one
   level (data, mechanism, or meaning) and say so.

## 4. Proposals

All **Planned**, additive. Models stay off unless the person turns them on.
IDs are `CA-n`.

**CA-1 Memory declaration per module.** One line in a room README: reads
semantic / episodic / procedural, writes which, and how an episode becomes a
fact. No code. Gives every new feature a check against the triad.

**CA-2 Episode to fact promotion.** A "what keeps repeating" shelf: a pattern
that appears in N dated episodes (same block after same text, same person after
same place) is offered as a candidate fact, with its rows as proof. The
person accepts or rejects. Follows `BIM_SIGNALS_PLAYBOOK.md`: learn it from
their data, then give it to the model. Reuses the Links proposal inbox and the
accept door.

**CA-3 Surprise ledger.** Store each prediction Brain2 makes (estimated
duration, inferred sleep, suggested block, flow route) with the later observed
value. Per source, show a rolling error. Rank estimators by it and show the
rank next to the estimate. Extends the estimated-value rule rather than
replacing it.

**CA-4 Workspace shelf.** A single ranked "now" list that any room may post
to with a reason and a score (gap, overdue habit, unanswered text, open
question). One broadcast rule: the top item is shown everywhere a
now-surface exists (hub, header, phone). Rooms keep their own priority; this
is only the shared winner. Start as a read-only view over existing
priorities.

**CA-5 Stall as a subgoal.** When a flow lane ends undecided, record the stall
(lane, input, what was missing) and queue one question for the interview mode,
instead of dropping it. Store the stall in `run-history.ts` with the stop
reason proposed as `RT-3`.

**CA-6 DIKW tag on analyses.** Tag each Data-tab view and each suggestion
as D, I, K, or W, and show the stage in the inspector. Lets a reader see
whether a number is raw or interpreted.

**CA-7 Level stamp in docs.** Add one word (data, mechanism, meaning) under the
title of new design docs. Cheap, and it stops the mixed-level arguments the
post describes.

**CA-8 Perception-first checks.** Before adding a model prompt about a
person, list what the representation already carries and what it lacks
(clock, place, company, screen, Health). Many failures in the flow handoff
(made-up blocks) were missing representation, not weak reasoning. This is the
post's "perception is not preprocessing" point in practice.

## 5. Where this meets agents

The post is thin on agents, but it gives a clean picture of one: an agent is
an architecture instance that runs the loop (perceive, attend, remember,
reason, act, feed back). With `REASONING_TOPOLOGIES_AND_AGENTS.md`:

- The **flow graph** from that paper is the reasoning module.
- The **memory triad and DIKW** here say what the agent reads and writes.
- The **workspace shelf** (`CA-4`) is where several agents or lanes compete.
- The **surprise ledger** (`CA-3`) and run record (`AG-1`) are how any agent
  learns without a hidden model update.
- **Accept** stays the only door that writes.

Build order if all are taken: `AG-1` run record, then `CA-3` surprise ledger,
then `CA-2` promotion, then `CA-4` workspace. Each is useful without the next.

## 6. What stays refused

- Treating the brain analogy as evidence. It is a vocabulary; each claim
  still has to pass tests on the person's own data.
- A single hidden agent that perceives, decides, and writes. Every write is a
  proposal until accepted.
- Copying Soar-style hand rule piles. Rules stay few, readable, and test-backed.
- Calling a number "explainable" because it came from a module. It is
  explainable when its rows are shown.
- Implying precision the data lacks (the post's own Bayesian framing is
  disputed by neuroscientists; here it is a computing lens only).
- Hosted models by default; vault text stays local without a yes.

## 7. Open questions

- Is a shared workspace (`CA-4`) one more screen, or does it replace per-room
  priority? Start as an extra view and measure use.
- How many repeats make an episode a candidate fact (`CA-2`)? Pick from the
  person's data, not a constant.
- Which estimators are worth a surprise ledger first: sleep, durations, or
  flow routes?

## 8. Not covered

The figures (neuroscience levels, process, memory, DIKW, Bayesian loop) were
not visible, and the post cites no study. This file uses only the body text.
