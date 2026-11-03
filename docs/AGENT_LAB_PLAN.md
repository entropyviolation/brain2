# Agent Lab — one room to see, tune, and compare every agent's mind

_Last mapped: 2026-11-01_

**A plan. Nothing here is built unless a line says Landed.** Anything marked
**Planned** is unbuilt intent. Where the plan names a file that does not exist
yet, it is a proposed path.

The person's brief: designing, redesigning, and tweaking agent architectures
becomes a main activity of the app. Agents differ a lot (a Tracking helper is
not a Budget helper is not a baby-animal friend chat), and later a module may
own an agent with its own architecture. The in-house lab for viewing and
tuning their internal design should be the most robust, beautiful, and clear
multi-agent lab there is.

Read beside: [`REASONING_TOPOLOGIES_AND_AGENTS.md`](REASONING_TOPOLOGIES_AND_AGENTS.md)
(`RT-n`, `AG-n`), [`COGNITIVE_ARCHITECTURE_AS_BLUEPRINT.md`](COGNITIVE_ARCHITECTURE_AS_BLUEPRINT.md)
(`CA-n`), [`BIM_FLOW_HANDOFF.md`](BIM_FLOW_HANDOFF.md),
[`BIM_SIGNALS_PLAYBOOK.md`](BIM_SIGNALS_PLAYBOOK.md),
[`KG_LLM_REFERENCES_AND_ROUTING.md`](KG_LLM_REFERENCES_AND_ROUTING.md),
[`FRIEND_COMPANION.md`](FRIEND_COMPANION.md), [`DESIGN_STYLE.md`](DESIGN_STYLE.md),
[`MODULE_PLATFORM.md`](MODULE_PLATFORM.md), `components/Lab/BimFlow/README.md`.
The ids in this file are `LAB-n` (rooms), `SPEC-n` (the agent description),
`TOOL-n` (the tool shelf), `EV-n` (evaluation), `MOD-n` (module agents), and
`PH-n` (build phases).

> Later experiments for BIMBIES (a ten-model swarm vote with a reworded question, and confidence from logprobs as a first-class part of the architecture): [`BIMBY_IDEAS.md`](BIMBY_IDEAS.md).

## 1. What exists today (read from code, 2026-11-01)

Three agent shapes already ship, each with its own private plumbing:

| Agent | Shape | Where | Model use | Lab today |
|-------|-------|-------|-----------|-----------|
| **BIM flow** (log, ask, summarize, recap) | Editable directed graph of ~19 node kinds: gate, search, choose, extract, propose, blocks, related, retrieve, answer, route, handoff, link, compute, clarify, guard, fallback, question, context, message | `lib/bim-flow/` (`types.ts`, `run-flow.ts`, `crew.ts`, `chat-router.ts`) | Local Ollama, role ladders (route, gate, pick, extract, prose, check) that climb only when unsure | `/lab/bim-flow`: canvas, inspector, runs, tests (28 hand-written plus about 80 from real data), parallel jobs, replay with prompts |
| **Tracking Helper** | Fixed five-stage pipeline: ROUTE (code), TOKENIZE (code), WIRE (one model call), PLACE (code), WHERE (code). One `HelperFlow` object, rev-stamped, with a backup on rev change | `lib/tracking-helper/` (`flow.ts`, `run.ts`, `wire.ts`, `assemble.ts`, `accept.ts`) | One call; the rest is code | Its `flow.ts` names a lab at `/lab/tracking-helper`. `app/lab/` in this checkout holds only `bim-flow` and `node-detail`. |
| **Friend chat** (baby animal) | Code-picked nudge from habits and To Do, species bias, a mission, a bubble; personality and greeting modules | `lib/baby-animal-nudge.ts`, `baby-animal-personality.ts`, `baby-animal-greeting.ts`, `components/friend-details/` | Mostly none today | None. Not inspectable. |
| Budget (and others) | Math and stores, no agent | `lib/budget-math.ts`, `budget-store.ts` | None | None |

Shared pieces that already work and must be kept:

- **Run record.** `lib/bim-flow/run-history.ts` keeps the graph as it was, the
  input, every step (node, port, ms, output, prompt), and the final answer.
  Replay lights the path and shows the prompt.
- **Crew ladders.** A role, not a model; smallest installed rung first.
- **The accept door.** Agents propose; `accept.ts` writes. Writes carry
  `generatedBy: { kind: "llm", id }` and `createdBy.surface`, so they can be found
  and swept.
- **Parallel jobs, tests from the person's own data, a note per run.**
- **Local by default.** On the iPhone the Mac serves Ollama through `/api/ollama`.

What is missing is a **common description of an agent**. Each shape stores its
design differently, so a lab that only shows graphs cannot show the Helper, and
a lab that shows the Helper's fixed stages cannot show a friend. That is the
core design problem of this plan.

## 2. The one idea: an agent is a Blueprint

Every agent, however simple, is described by one declarative object, the
**Blueprint**. The lab edits Blueprints. Runtimes execute them. This is the
cognitive-architecture reading of the Autodesk post and the topology reading of
the Besta paper, made concrete: a named perceive, attend, remember, reason, act
loop whose reasoning part may be any of chain, tree, graph, or plain code.

```
Blueprint
├─ identity        id, name, owner (house | module:<id>), rev, purpose (one sentence)
├─ senses          what it perceives: typed input kinds (text, day, item, question, clock, event)
├─ attention       when it wakes and what it ignores (triggers, filters, budget)
├─ memory          reads and writes, by kind: semantic · episodic · procedural · working
├─ mind            the reasoning body, one of:
│    ├─ pipeline   ordered stages (Tracking Helper)
│    ├─ graph      nodes + edges + ports (BIM flow)
│    ├─ policy     code rules + weights, no model (friend nudge, today)
│    └─ crew       a planner + specialists that call each other (later)
├─ tools           named tools it may call, with arguments typed and capped
├─ voice           persona and style (friend chat), kept apart from the mind
├─ models          role → ladder, per-node overrides, local-only flag
├─ limits          max calls, max ms, max tokens, max writes, stop reasons
├─ door            what it may propose, and which accept surface writes it
└─ checks          the evals bound to it (see §6)
```

Rules for the Blueprint:

- **SPEC-1 One schema, several minds.** `mind.kind` picks the body. The envelope
  (identity, senses, memory, tools, models, limits, door, checks) is identical
  for all, so every room of the lab works for every agent.
- **SPEC-2 Existing shapes are adapted, not rewritten.** The BIM `Flow` becomes a
  `graph` mind as it is. `HelperFlow` becomes a `pipeline` mind as it is. A
  friend's nudge rules become a `policy` mind. Adapters read the old saved
  objects and write nothing back until the person edits.
- **SPEC-3 Declared, not discovered.** An agent that calls a tool, reads a
  memory, or writes a record it did not declare is refused at run time, and the
  refusal shows in the trace.
- **SPEC-4 Versioned.** Each save is a rev with a one-line reason. The previous
  rev is kept (the Helper already keeps `:backup:<rev>`; this generalises it).
- **SPEC-5 Voice is separate from mind.** A friend's charm lives in `voice` and
  can be swapped without touching what it decides. A Budget helper has a plain
  voice and a stern mind. They tune separately.
- **SPEC-6 Local-only is a switch on the Blueprint.** When on, no tool or model
  that leaves the machine is allowed, and the lab shows the lock.
- **SPEC-7 Plain data.** A Blueprint is JSON. It can be exported, diffed,
  attached to a bug, and loaded in tests.

A runtime is a small interface: `run(blueprint, input, ctx) → Trace`. The same
call serves the lab, the app, and the tests. `run-flow.ts` and `run.ts` become
the first two runtimes behind it.

## 3. The Trace: one record, every agent

The lab is only as good as what it can replay. One trace shape for all minds:

```
Trace
├─ run        id, blueprint id + rev, input, origin (lab | app | test | eval), start, end
├─ events[]   in order, each with: id, parent id, kind, actor (stage or node), t0, t1, status
│    kinds: sense · wake · memory-read · memory-write · prompt · model-reply · tool-call ·
│           tool-result · decision (route/gate with the reason) · branch · merge ·
│           propose · stall · halt · error · person-verdict
├─ memory     what each memory read returned, with row ids (so "why did it think X" has rows)
├─ cost       calls, tokens in and out, ms, per model and per tool
├─ stop       stop reason from a closed list (done, gate-no, budget, needs-person, error, refused-tool)
└─ result     final answer + proposals + which were accepted, rejected, or left
```

- **Landed (as parts):** per-step node, port, ms, output, prompt; proposals;
  suggestion verdicts; reject reasons.
- **Planned:** the common envelope, `parent id` (so tree and multi-agent calls
  nest), memory reads with row ids, closed stop reasons (`RT-3`, `AG-1`), and
  `stall` events (`CA-5`).
- **Planned:** traces stored in IndexedDB or the vault store, not only
  localStorage keys, with the existing cut-off for big outputs and a pin so
  a trace can be kept forever.

## 4. The rooms of the lab

One route, `/lab/agents`, with the existing `/lab/bim-flow` kept as the graph
editor room inside it (nothing breaks; deep links still work). A left rail lists
every agent as a card: name, owner, mind kind, last rev, last run result,
health. Select an agent and a row of rooms opens. Each room is useful alone.

**LAB-1 Atlas.** All agents on one canvas. Each agent is a small glyph (its
mind kind drawn as chain, tree, graph, or loop) with its tools and memories as
docked ports. Lines show who calls whom, who shares a memory, who writes where.
Zoom in to see an agent's inside. Filters: owner, tool, memory, model, cost,
last failure. Purpose: the whole system in one glance, and where two agents
overlap.

**LAB-2 Blueprint.** The editor for one agent. Two synced views of the same
object: a **form** (every field of §2, with plain-words help) and a **diagram**
that fits the mind kind (graph canvas for `graph`, a stage rail for `pipeline`,
a rule table with weights for `policy`, a lane map for `crew`). Editing either
updates the other. Every field says what it does, what it costs, and what broke
last time it was changed. Undo and redo across the whole Blueprint.

**LAB-3 Theater.** Run an input and watch it think. The diagram animates: the
active node glows, a clock ticks per step, branches fork and merge, tool calls
leave and return, memory reads light the memory port with the row count. A
timeline strip below shows every event as a bar (parallel runs stack). Pause,
step forward, step back, speed. Click any event: prompt, reply, parsed output,
the rows read, the reason code. Runs are replayable at any speed from the saved
Trace; live and replay look the same. Several agents can run side by side on
the same input.

**LAB-4 Memory.** The agent's mind, as data. For one agent: which of the four
memories it reads and writes, with counts and recent rows; a **provenance**
view ("this decision used these 6 rows"); a **promotion shelf** where repeated
episodes are offered as candidate facts with proof (`CA-2`); a **forgetting**
view of what it never reads. Working memory is shown per run as the exact
context each node saw.

**LAB-5 Tools.** The tool shelf (§5): browse, read the contract, call one by
hand with typed arguments, and see its output. Per agent: which tools are
granted, caps, call counts, failure rate, average ms.

**LAB-6 Prompts.** Every prompt in the agent, side by side with the model
reply, token counts, and the few-shot examples taught to it. Edit a prompt,
rerun against saved inputs, see the diff in output. A prompt library with
named, versioned prompts, so two agents can share one and see who uses it.

**LAB-7 Models.** The crew ladders for the agent: role, rung, installed or not,
last answer quality, speed, cost. Swap a rung and rerun the same inputs. Shows
when a model climbed a rung and why (unsure, off options, schema failed).

**LAB-8 Evals.** The bench of tests for the agent (§6): hand-written, built from
the person's own data, and replayed past runs. Scorecards, a confusion matrix
for gates and routers, failing cases pinned at the top, and **Run on this rev
vs the last** for regressions.

**LAB-9 Compare.** Two revs of one agent, or two agents on the same inputs, side
by side: diagram diff (added, removed, changed nodes), prompt diff, output diff
per input, and a cost, speed, and score table. A **sweep** varies one setting
(model rung, branch width, threshold, budget) over a range and plots score
against cost.

**LAB-10 Voice.** For agents that talk (friends, helpers). Preview a persona
across a set of scenarios (a missed habit, a finished mission, a hard day),
compare voice variants, and check that the voice never changes the decision.

**LAB-11 Door.** Every proposal the agent has made, with its verdict (accepted,
rejected with reason, left), grouped by kind and over time. Acceptance rate is
the agent's honest report card. Sweep controls for writes the agent stamped
(`generatedBy.id`), so a bad rev's writes can be found and undone as one step.

**LAB-12 Explain.** A plain-words and diagram layer over any run, tuned to the
reader: **Story** (a few sentences: "It read 3 texts, thought you were cooking,
filed one block, and left the pantry alone"), **Why** (the decision chain with
rows), **What if** (change one input or one setting and see the difference
without saving), and **Teach** (what this node kind is, with the paper or
note it comes from). Built from the Trace, never from a second model call.

**LAB-13 Library.** Templates. Start a new agent from a shaped starter: Router
and lanes, Gate-pick-write, Retrieve-and-answer, Skeleton-and-expand, Policy
with weights, Planner and specialists. Each starter ships with a sample eval
set. A good agent can be saved as a template.

**LAB-14 Health.** One page for all agents: error rate, stall rate, budget
overruns, acceptance rate, drift (this week's score vs last), and tests that
went red after the last app update. A red dot on the rail for any agent.

## 5. The tool shelf

An agent's reach is its tools. Today they exist as scattered code
(`vault-search.ts`, `retrieve.ts`, `compute.ts`, `blocks.ts`, `link-node`,
`entity-link.ts`, `day-context.ts`, `accept.ts`). The plan is a **registry**
with one contract per tool: name, purpose, input schema, output schema, cost
class (code, local model, hosted), whether it reads or writes, and a
guarantee ("never writes").

Tool families the lab should ship, grouped by what they do (all **Planned**
unless an existing file is named):

| Family | Examples | Built on |
|--------|----------|----------|
| **Read the vault** | find items, lists, habits, pens, people; read a day; read tracked entries, texts, notes, logs | `vault-search.ts`, `retrieve.ts`, `day-context.ts` |
| **Count and measure** | count, minutes, by-day, streak, days-since, longest gap, top pens, compare, trend, change-point, entropy | `compute.ts`, `lib/metrics.ts` |
| **Time and place** | blocks from activity, gaps, overlap, location and screen context | `blocks.ts`, `tracking-helper/assemble.ts`, `places.ts` |
| **Money** | totals by category, burn rate, month vs plan, anomalies | `budget-math.ts` |
| **Language** | tokenize, extract fields under a schema, yes/no, pick one, rewrite, summarize, check against evidence | `ollama.ts`, `crew.ts`, `wire.ts` |
| **Identity and links** | entity link, nearby items as an adjacency list, relation suggestion | `entity-link.ts`, Links |
| **Memory** | read by kind, write a candidate fact, promote, expire | new (`CA-2`) |
| **Ask the person** | one question, a pick from a list, a yes/no card | interview mode, `clarify` |
| **Propose** | add a record as a proposal (never a write) | `propose`, `accept.ts` |
| **Plan and schedule** | find a free slot, check conflicts | Plan, Scheduler libs |
| **Time and clock** | now, local day, week bounds, relative dates | code |

Tool law (all of it already the house rule, made checkable):

- **TOOL-1** A tool says if it writes. Only `Propose` reaches the accept door.
- **TOOL-2** Tools return rows with ids. Answers cite rows; an uncited claim is dropped.
- **TOOL-3** Every call has caps (rows, ms, calls per run) from the Blueprint.
- **TOOL-4** A tool has fixtures: a sample call and result, used by tests and
  by the Tools room's "try it".
- **TOOL-5** A module may register tools for its own agents (`MOD-2`), with the
  same contract and the same refusals.
- **TOOL-6** Anything that leaves the machine is a separate class. It is off
  unless the person turns it on, for that agent, and the lab shows the lock.

## 6. Evaluation: the lab's spine

An agent you cannot score is an opinion. The BIM bench already has hand tests,
tests built from real data, and replay. The plan generalises them.

- **EV-1 Case.** An input, the expected result (exact, set, range, or a rubric
  of code checks), and tags. Cases come from hand writing, from the person's
  own data, from replayed runs, and from a verdict ("this was wrong").
- **EV-2 Checks are code first.** Counted facts, schema validity, quote present
  in source, span inside confirmed time, no write without proposal, within
  budget. A model judge is the last resort, labelled as one, and off by default.
- **EV-3 Suites.** Named sets per agent (smoke, regression, real-data, hard).
  A suite runs against a rev and stores a **Scorecard**: pass rate, per-tag
  rate, cost, ms, stalls, stop reasons.
- **EV-4 Regression guard.** Saving a Blueprint offers "run smoke on this
  rev". A red result shows the cases that flipped and the diff that caused it.
- **EV-5 Calibration.** For gates, routers, and confidence outputs: the
  confusion matrix and a reliability curve. This is the surprise ledger
  (`CA-3`) applied to agents.
- **EV-6 Drift.** The same suite, run on a schedule on the person's current
  data, with a trend line. A small model update or a data change that breaks a
  case is seen the day it happens.
- **EV-7 Human verdicts as data.** Accept, reject with a reason, "wrong here"
  on any event. They become new cases with one click.
- **EV-8 Honest numbers.** A score always shows its sample size and what
  fraction came from the person's own data. Never a bare percentage.

## 7. Seeing a mind clearly: the visual language

The lab's job is clarity. The rules:

- **One grammar of shapes.** A mind kind has a recognisable silhouette
  (chain: a line of beads; tree: branching; graph: nodes with ports; pipeline:
  stages on a rail; policy: a weighted table; crew: lanes with a planner).
  The same silhouette appears in Atlas, the rail, the starter library, and the
  Theater. The shape alone tells you what you are looking at.
- **One grammar of roles.** Each node role (sense, attend, remember, reason,
  act, check, halt) has one mark and one tint, used everywhere. The four
  modules from `REASONING_TOPOLOGIES_AND_AGENTS.md` (generator, evaluator,
  halter, controller) are a second label on the same nodes (`RT-1`).
- **Cost is visible.** Code steps look light; local model steps look weighted;
  anything hosted looks sealed or locked. Time bars use one scale across the
  screen.
- **Time is a first-class axis.** The Theater timeline and the Compare view
  share an axis, so "slower here, since this rev" is readable at a glance.
- **Every number has its rows.** Click a number, see the rows or events behind it.
- **Plain words first, jargon on demand.** Each field has a one-sentence help;
  deeper help links to the doc and paper behind it.
- **Never decorative.** No motion that is not information. Animation shows
  flow, wake, wait, or fault.
- **Calm by default.** A quiet screen with the active thing bright. Beauty here
  is clarity (the "genius of enough" in the beauty rule).
- **House look, applied honestly.** The lab follows `DESIGN_STYLE.md`: cool
  paper and graph rule, diagram grammar, silver chrome, the milled bay and
  phosphor wells that the BIM bench already wears, no yellow, no celestial
  costume. Star glyphs are fine as icons. The iPhone app follows
  `MOBILE_STYLE.md`, not this.
- **Desktop first, phone for watching.** Editing is a desktop job. The phone
  gets Health, a run's Story, and Door verdicts.

## 8. How agents differ, and how the lab handles each

| Agent | Mind | Notable needs | What the lab gives it |
|-------|------|----------------|------------------------|
| **BIM** log/ask/recap | graph | Many lanes, cheap routing, evidence-only answers | Graph canvas, tests from real data, lane cost bars, router confusion matrix |
| **Tracking helper** | pipeline | One model call, strong code stages, exact clock handling | Stage rail with time per stage, WIRE prompt and examples editor, PLACE defaults, side by side revs |
| **Budget helper** (**Planned**) | policy + tools | Math must be code; the model only phrases; strict, quiet voice | Tool-heavy blueprint over `budget-math.ts`, check that every figure cites a row, a stern voice preset |
| **Friend chat** | policy + voice (+ optional chat model) | Charm that never changes the decision; a bond that grows | Voice room with scenario previews, policy weights table, a "decision unchanged by voice" check |
| **Module agent** (**Planned**) | any | Owned by a module, narrow tools, own memory namespace | Same Blueprint, same rooms, an owner badge and a sandboxed door |
| **Crew** (**Planned**) | crew | A planner and specialists, shared workspace | Lane map, handoff trace with `parent id`, workspace shelf view (`CA-4`) |

## 9. Module agents

- **MOD-1 A module may ship Blueprints** in its folder (`components/<Room>/agent/`
  or `lib/<room>/agent.ts`), registered at load. They appear in the lab's rail
  with the module as owner.
- **MOD-2 A module may register tools** that follow the tool law.
- **MOD-3 Scoped memory.** A module agent gets a memory namespace by default and
  reads other rooms only through declared tools. "Item is the only noun" still
  holds: its writes are items.
- **MOD-4 Same door.** Writes are proposals, stamped with the module surface.
  The person can turn a module's agents off from the lab.
- **MOD-5 No back doors.** A module may not run a model outside the runtime. The
  runtime is the one place that enforces limits, locality, and tracing.
- **MOD-6 Docs.** A module's README names its agent Blueprint ids and the eval
  suite that guards them. Docs sync stays under the existing rule.

## 10. Safety and trust, built in

- Every write is a proposal until accepted; sweeps undo a rev's writes in one step.
- Budgets are hard stops, not hints; every stop has a closed-list reason.
- A kill switch per agent and one global.
- Local-only flag per agent, visible lock on anything that leaves the machine.
- Evidence-only answers; uncited claims dropped; guesses labelled as guesses.
- A Blueprint cannot grant itself tools or widen its own limits at run time.
- Raw vault text in traces stays on the device; exports are redacted by default,
  and an export says what it redacted.
- Prompt-injection hygiene: text from texts, notes, or imports is data. A
  node's prompt marks it as quoted data; a tool call requested by quoted data
  is refused and shown as such in the Trace.

## 11. Build order

Each phase ships something useful by itself and leaves the old lab working.

**PH-1 Name and adapt (small).**
Write `lib/agents/blueprint.ts` (types for §2) and read-only adapters for the
BIM `Flow` and `HelperFlow`. A registry (`lib/agents/registry.ts`) lists them.
Tag node kinds with roles (`RT-1`). No UI change except a shared agent rail in
the BIM lab. Done when: both existing agents show as Blueprints with identical
envelopes, and a unit test round-trips each saved flow.

**PH-2 One trace.**
Add the common Trace envelope and wrap the two runtimes so they emit it, with
closed stop reasons and `parent id`. Store in a shared run store. Done when:
BIM runs and Helper runs open in the same replay component, and old kept runs
still open.

**PH-3 Theater and Blueprint form.**
`/lab/agents` shell, rail, Blueprint form, and the Theater with timeline,
pause, step, and event detail. The BIM graph canvas and the Helper stage rail
become the two diagram views. Done when: the Tracking Helper has a working lab
room that matches `flow.ts`'s promise, and both agents run side by side.

**PH-4 Tools and Prompts.**
Registry with contracts and fixtures for the existing tools; Tools room;
Prompt library and rerun-on-saved-inputs. Done when: every BIM node kind that
calls code uses a registered tool, and an edit-prompt-and-rerun loop works for
the Helper's WIRE stage.

**PH-5 Evals and Compare.** _Started 2026-11-02: **Landed** as `/lab/agents` (cases, variants, scorecard, two-run compare for closed-list BIMBY picks; `lib/agents/bench.ts`). Not yet: the BIM bench suites, rev-on-save guard, sweep._
Cases, suites, scorecards, regression guard on save, diff view for two revs, a
one-variable sweep. Done when: the 28 hand and ~80 real-data BIM tests run as a
suite under EV-1 to EV-4, and a Helper rev can be compared to the last.

**PH-6 Memory, Door, Explain, Health.**
Memory provenance (`CA-2` promotion shelf), Door verdict room, Explain Story and
Why from the Trace, Health page. Done when: any accepted or rejected proposal
links back to the run, the rows read, and the rev that made it.

**PH-7 Friend and Budget as agents.**
Wrap the friend nudge as a `policy` mind and add the Voice room. Build the
Budget helper as the first tool-heavy `policy` agent. Done when: the friend's
decision is checked as unchanged under three voice variants, and the Budget
helper answers only with cited rows.

**PH-8 Atlas, templates, crew.**
Atlas canvas, starter library, and the first `crew` mind (a planner over BIM
and Tracking lanes), with the workspace shelf (`CA-4`). Done when: one request
fans out to two agents, the Trace nests both, and the budget stops it on cue.

**PH-9 Module agents.**
Registration API, namespaced memory, owner badges, module off switch (§9). Done
when: a module ships an agent with a suite and it appears in the lab.

Anything about the model that is not this machine's (hosted calls, shared
agents between people) is out of scope until the person asks.

## 12. Files this plan would add (proposed)

```
lib/agents/blueprint.ts       types and validators for the Blueprint
lib/agents/registry.ts        register, list, load, version, adapters
lib/agents/adapters/          bim-flow.ts, tracking-helper.ts, friend.ts, budget.ts
lib/agents/trace.ts           Trace types, recorder, redaction
lib/agents/runtime.ts         run(blueprint, input, ctx) → Trace; limits and refusals
lib/agents/tools/             registry.ts, read.ts, count.ts, time.ts, money.ts, language.ts, memory.ts, ask.ts, propose.ts
lib/agents/evals/             case.ts, checks.ts, suite.ts, scorecard.ts, drift.ts
lib/agents/README.md          the seam, in short plain sentences
app/lab/agents/page.tsx
components/Lab/Agents/        Atlas, Blueprint, Theater, Memory, Tools, Prompts, Models, Evals, Compare, Voice, Door, Explain, Library, Health, README.md
```

The existing `lib/bim-flow/` and `lib/tracking-helper/` stay where they are and
become the first runtimes behind `runtime.ts`. `components/Lab/BimFlow/` stays
as the graph editor room.

## 13. What stays refused

- A big rewrite that replaces a working agent before an adapter proves it.
- Hosted models or shared agents by default.
- A model judge as the main score.
- Auto-applied "improvements" that edit a Blueprint without the person's yes.
- Agents that write without the accept door.
- A lab that is only a pretty graph: every picture is backed by a Trace, a score,
  or rows.
- Decoration. No celestial or astrology costume, no yellow, no gold metal.
- Scores shown without sample size.

## 14. Open questions

- Where do traces live at scale: IndexedDB per device, or a vault-side store the
  phone can read? Start per device; the phone watches the Mac through the hub.
- Is one `Blueprint` type enough, or does `crew` need its own sub-schema once
  built? Decide in `PH-8`, not now.
- How much of the form editor should be generated from the types, and how much
  hand-written help? Generate the fields; hand-write the sentences.
- Which friend decisions are a policy and which are a chat model's? The first
  Voice room settles it.
- Should a Blueprint carry its own eval suites in the same file, or reference
  them by id? Lean to reference, so a suite can serve two revs.

## 15. First slice

**Landed 2026-11-01 (`PH-1`, lib only).** `lib/agents/` holds the Blueprint type, `NODE_TAG`, `validateBlueprint`, read-only adapters for the BIM flows and the Tracking Helper, and a registry. 14 tests pass. **Landed 2026-11-01:** the shared agent rail (`components/Lab/Agents/`), in the BIM lab and the Helper lab, and the `/lab/tracking-helper` route (`components/Lab/TrackingHelper/`). `PH-1` is done. Details: [`lib/agents/README.md`](../lib/agents/README.md).

The reasoning for this slice, as first written:

`PH-1` plus the Helper's missing lab room is the smallest true shape:
a `Blueprint` type, two read-only adapters, one registry, one shared rail, and
`/lab/tracking-helper` reusing the BIM lab's replay pieces. It adds no new
concept to the app beyond the one named here, and every later room grows from it.
