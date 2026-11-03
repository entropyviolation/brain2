# BIM and BIMBY ideas to try later

> Try them in the Agent bench (`/lab/agents`, `lib/agents/bench.ts`): each idea is a `Variant` scored on the same lines, then compared run against run.

_Last mapped: 2026-11-02_

Nothing here is built. Each idea is a Planned experiment for the Agent Lab (`docs/AGENT_LAB_PLAN.md`). A **BIMBY** (BIM + baby) is a small agent that does one specific job, such as the Lists BIMBY or the Tracking Helper. The context of a BIMBY is known: it has a closed list of tools and a closed list of things it may do. That is what makes these ideas cheap to try.

## 1. The swarm vote, then a reworded question

**The problem.** A BIMBY picks one tool from a closed list for a free-form line. One small model picking once is fragile. A line like "Book items that are also Task items shouldn't be Task" has a clear answer to a human and a coin flip to a tiny model.

**The shape.**

1. **Ask ten.** Send the same input to about ten very small, very fast, very cheap models. Each returns an **ordered list** of the tools (and slots) from the BIMBY's closed list, most wanted first. Not one answer: a ranking.
2. **Count.** Merge the ten rankings. Score each action by how many models listed it and how high (a Borda or reciprocal-rank count). Keep the actions that all or most of them had in common. Drop the rest.
3. **Reword.** Give the surviving actions and the original line to a mid-level model: "How would you reword this input so a small model reads it the same way every time? Use only these actions." It returns one plain sentence in the BIMBY's own grammar.
4. **Show the person.** The reworded sentence becomes the on-screen keys, the same way the command-wording keys work today: "Book stays, Task goes" / the reverse. The person picks. A pick is a normal line into the code grammar, so it reaches the same plan, the same approval and the same guardrails.
5. **Learn.** Keep the pairs (original line, line the person picked). They are the best test set the lab can have, and the best few-shot examples.

**Why it should work.**

- Disagreement between cheap models is a signal. Agreement is cheap to read; the tail of the ranking is where the doubt is.
- The mid-level model never decides and never writes. It only rewords, so a mistake costs one extra tap, not data.
- The output is always a tool call from the closed list, so the approval gate and `guard.ts` still apply. The swarm picks what to show; it never writes.

**Things to settle by experiment.**

| Question | How to test |
|----------|-------------|
| How many voters, and how small? | Replay recorded lines with 3, 5, 10, 20 voters; plot accuracy against cost |
| Should voters differ? | Mix model families and prompt phrasings (the paraphrase set from #3 below) against ten copies of one model |
| Rank or single pick? | Compare top-1 votes with full ranking merged by reciprocal rank |
| When does the swarm skip the reword? | If the top action holds a clear majority and confidence is high (see 2), go straight to the plan |
| Slots as well as tools | Ask the voters to fill the slots (types, lists) as well; vote slot by slot, and use the keys for any slot that splits |
| Latency | Voters run in parallel, so the wait is the slowest one. Set a hard timeout and vote with whoever answered |
| Cost cap | A per-line budget, with a local-only fallback to the code grammar |

**What the research says** (searched 2026-11-02; each claim is from the paper named, not verified by us).

| Finding | Source | What we do with it |
|---------|--------|--------------------|
| Sampling many answers and taking the majority raises accuracy, and the gain grows with the number of agents (a 13B model with 15 samples approached a 70B one on GSM8K). It is unsupervised. | Wang et al. 2023 (self-consistency); Li et al., "More Agents Is All You Need" ([arXiv 2402.05120](https://arxiv.org/abs/2402.05120)) | Voters are cheap samples; no training. Plot accuracy against voter count on replay (the table above). |
| Voting beats consensus on reasoning-style tasks (+13.2%); more voters help; more discussion rounds before voting hurt. | Kaesberg et al., "Voting or Consensus?" ([arXiv 2502.19130](https://arxiv.org/abs/2502.19130)) | One round, no debate between voters. Voters never see each other's answers. |
| Borda count is a simple, cheap way to merge several ranked lists; it matched majority vote closely in a three-model test. | LLM-RankFusion ([arXiv 2406.00231](https://arxiv.org/abs/2406.00231)); [arXiv 2603.04897](https://arxiv.org/abs/2603.04897) | `lib/swarm-vote/` merges rankings by Borda, with plurality (top-1) beside it to compare. |
| Accuracy rises with how consistent the answers are, so agreement is a usable confidence signal; early stopping kept 86.38% against 86.61% for full weighted voting. | ModelSwitch ([arXiv 2504.00762](https://arxiv.org/abs/2504.00762)); EMS ([arXiv 2604.02863](https://arxiv.org/abs/2604.02863)) | `agreement` and `margin` on every tally; `earlyStop` ends the wait once the lead cannot be passed by the voters still out. |
| LLM errors are strongly correlated, most of all within one model family, which puts a floor under what voting can fix. Independence assumptions in majority voting fail. | [arXiv 2602.08003](https://arxiv.org/abs/2602.08003); CARE ([arXiv 2603.00039](https://arxiv.org/abs/2603.00039)) | Ten copies of one model is the weak baseline. Each voter carries a `family`, and the tally reports `families` so diversity is measurable. |
| Voting adds little for open-ended generation. | practitioner guides, not a paper | Vote only over the closed tool list and its slots, never prose. The reword stays a single mid-model call. |
| Confidence-weighted voting among LLM agents: no direct source found. | (search came back empty) | Stays an experiment (§2), off by default. `weight` exists on a voter and defaults to 1. |

**Built** (2026-11-02): `lib/swarm-vote/` (the tally, no model inside) and the lab at `/lab/swarm-vote`. The reword (`reword.ts`, keys in the lab) and the replay bench (`bench.ts`) are built; their results on real models are not recorded yet. Slot voting and the person's-pick learning (step 5) are not built.

**Where it lands.** In the BIMBY pipeline between "read" and "plan". On the BIM flow bench it is a fan-out node, a merge node, and a reword node. It is a reusable shape for any BIMBY with a closed tool list.

## 2. Confidence as part of the architecture

**The stance.** Confidence is not a footnote. It should be a first-class value in the cognitive architecture the Agent Lab builds, wherever a model makes a choice. Do not let "an army of confused neurons" butcher a request because nothing noticed they were unsure.

**Source: log-probabilities.**

- Where a provider returns **logprobs**, read the probability of the chosen tool token (or the margin between the top two). That is the first confidence number. For a ranked list, read it at each rank.
- Where a provider does not return logprobs, estimate it from agreement: the fraction of voters that chose the same action, or the stability of the choice under paraphrase.
- Keep both numbers on the Trace, next to the choice, so the Agent Lab can show them.

**Rules to try.**

- **Early escalation.** If more than N of the first ten voters are low confidence (say under a threshold set per BIMBY), stop. Do not wait for the vote. Send the line straight to a stronger model, or to the person with keys. N and the threshold are tuned on recorded lines.
- **Spread, not just level.** Ten voters each 60% sure of the same action beat ten voters each 95% sure of different ones. Read both level and agreement.
- **Calibration.** A model that says 90% should be right about 90% of the time. The lab measures this on replayed lines and shows a reliability curve per model. A model that is badly calibrated is not trusted for escalation decisions.
- **Confidence gates the write, not only the pick.** A low-confidence pick is never applied with a bare "yes". It shows keys. A bulk change with any doubt shows the keys first, then the plan.
- **Confidence on the person's side.** If the person's wording is unclear ("those books") say so and ask. The model's doubt about the words is a better question than a guess.
- **Cheapest competent path.** Ladder: code grammar (free, certain) → small voters (cheap, ranked) → mid reword (one call) → strong model (rare) → ask the person. Each rung hands up when its confidence is low.

**For the Agent Lab.**

- A confidence strip on each Trace step (the number, where it came from, and the threshold it was compared to).
- A per-BIMBY "escalation rate" and "right when confident" rate on the evals page.
- Confidence as a field on the Blueprint (`checks`), so every agent declares its thresholds and what it does when it falls under them.
- A rule that a new BIMBY cannot ship without a stated low-confidence path.

## 3. Smaller ideas for BIMBIES

- **Paraphrase stability test.** Run the person's line through a model that rewrites it five ways. If the chosen tool changes, the line is ambiguous. Use it as a cheap confidence signal when logprobs are missing.
- **Keys everywhere.** Every BIMBY answers doubt with on-screen keys, not an apology: the exact sentence to send, a candidate per unclear name, "keep as is / put back". The Lists BIMBY does this for type wording and for names that fit two things. The Tracking Helper and future BIMBIES should do the same.
- **Dry run counts.** Before a plan, show how many items the line would touch, and how many that is of the vault. A surprising number is the earliest warning.
- **A write budget per BIMBY.** Each BIMBY has a hard cap on items it may edit in one go and may never delete (see `lib/lists-helper/guard.ts`). Raise the cap by hand, per BIMBY, never by asking the BIMBY.

## 4. A critic BIMBY before the person sees the plan

_Source: the LLM multi-agent survey the person pasted on 2026-11-02 (expert plus evaluator pairs, ChatEval, LLM Harmony). Nothing here is built. The concrete plan, with slices, a bench and a ship rule, is `docs/CRITIC_BIMBY_PLAN.md`._

**The shape.** After a BIMBY writes a plan and before it shows keys or asks for approval, a second small model reads two things only: the person's original line and the plan. It answers one question: "does this plan do what the line says, and nothing more?" It returns pass, or fail with one plain reason.

- The critic never edits the plan. It only gates it, so a mistake costs one extra tap.
- A fail routes to the keys (see 2), not to a silent retry loop. A BIMBY has a hard step cap.
- It runs after `guard.ts`, not instead of it. Code checks come first because they are free and certain.
- Use a different model or prompt from the planner. Two copies of one model share the same blind spots.

**Test by experiment.** Replay recorded lines. Count plans the critic fails that the person had accepted (false alarms) and plans it passes that the person had rejected (misses). Ship it only on BIMBIES where the miss rate drops enough to be worth the extra call.

**Rule for every new BIMBY.** State its role, its closed tool list, its stop condition and its step cap in the Blueprint. Do not let BIMBIES message each other; they read and write through the Item graph, the one write door.

## 5. Score each stage, not only the answer

_Source: same survey (SciCrafter's process-level evaluation)._

**The problem.** A pass or fail on the final result hides which node broke. A flow can fail because the gate routed wrong, the plan was wrong, or the critic missed it.

**The shape.** On the BIM flow bench (`/lab/bim-flow`) and the Agent Lab evals, record a verdict per stage for each replayed line: read, route, plan, critic, approve. `lib/bim-flow/run-history.ts` and `scenarios.ts` are the seams. Show a per-stage pass rate next to the per-BIMBY rates in 2.

**Why.** It points the next fix at the weakest node. It also keeps the person's pick as ground truth: a model-scored stage is a hint, and a stage the person corrected counts as the oracle (the survey warns that a surrogate verifier can drift from the real one).

## 6. Smaller ideas from the same survey

- **Diverse voters.** Mix model families and prompt phrasings in the swarm (1), and prune voters that are persistently wrong on recorded lines. Diversity beat identical copies in the survey, and pruning is its fix for echo chambers.
- **Causal pre-check.** Before a plan runs, check its ripple against known dependencies (a list change, a habit, a night entry). `applyLinkedEffects` in `lib/commit-item-edit.ts` already names the ripple, so a plan with an invalid one can be rejected up front.
- **Heartbeat reflection.** A periodic pass over recent activity that writes a short note. It waits for the always-on host (`docs/ALWAYS_ON_MAC_SETUP.md`).
- **Skipped on purpose.** Self-organizing agents with no roles (they need strong models), latent-space messaging, and training-time adversarial curricula.

## 7. Ideas from the cognitive-functions survey

_Source: "Enhancing Cognitive Functions in Large Language Models Towards AGI: A State-of-the-Art Survey and Exploratory Review" (Navarro, IEEE ICMLT 2025), pasted 2026-11-02. It is a secondhand review of 82 papers, so check a technique's own source before leaning on it. Nothing here is built._

The survey names four gaps: planning, memory, world models, and hallucination. Brain2 already has a part of each fix. These are the parts that are new here. Swarm voting, confidence, the critic, and per-stage scoring stay in 1, 2, 4 and 5.

### 7.1 Verify the Ask answer in code

**Source:** §F (post-processing against a verified database, Chain-of-Verification).

The survey splits hallucination into *factuality* (wrong about the world) and *faithfulness* (wrong about the given context). Brain2 only owes faithfulness to the vault, which is the easier half.

- After `lib/bim-flow/run-flow.ts` writes an answer, a code pass pulls every name, date, and number from it.
- Each one must appear in an evidence row. An unsupported claim is dropped, or the answer becomes "I don't know" and BIM asks you (the don't-know path in `components/Bim/README.md`).
- It is free and certain, so it runs before any critic model (see 4).

**Test:** replay recorded questions. Count answers the pass would have cut that were right (false alarms) and wrong answers it lets through (misses).

### 7.2 Rank evidence by recency and frequency

**Source:** §G (ACT-R).

ACT-R scores a memory by how recently and how often it was used (base-level activation: `ln(Σ t⁻ᵈ)` over past touches, decay `d` about 0.5). `lib/bim-flow/retrieve.ts` scores by keyword hits plus small fixed bonuses. Add activation as one more term. It needs no model. It suits "when did I last…" questions.

**Test:** replay recorded questions. Compare the rank of the right row with and without the term.

### 7.3 Expand retrieval along the graph

**Source:** §B (knowledge graphs, RAG, pseudo-graph retrieval, GraphRAG).

The Item graph is already a knowledge graph: relations (`lib/item-type-store.ts`), list links (`lib/list-links.ts`), people, events.

- **One hop out.** After keyword hits, add the items one relation away (a person's events and lists, a list's items). Cap the extra rows.
- **Global questions.** For "how was October?", read the period summaries and rituals first (`lib/reviews-store.ts`), then drill down. This is GraphRAG's query-focused summary.
- **Type registry as ontology.** Check names the model extracts against the item-type registry and `lib/bim-flow/entity-link.ts`. A name that fits no type is a question for the person, not a new record.

### 7.4 The model proposes, code places

**Source:** §A (LLM writes partial goal schemas, a classical planner writes the actions; hierarchical task decomposition).

For `lib/plan-bimby/`: the LLM names the blocks and goals. Code places them against `deadline`, `mustBeDoneBefore`, `mustBeDoneAfter`, the day anchor, and holidays (`lib/holidays.ts`). The model never touches a hard constraint. This matches the grammar-first rule.

### 7.5 Scenarios that get harder

**Source:** §A (AgentGen, BI-EVOL).

Give `lib/bim-flow/scenarios.ts` a difficulty ladder per BIMBY: the same job made simpler and made more complex. A flat pass rate hides where a BIMBY breaks. A ladder shows the rung. Generated lines count as hints. Lines the person corrected stay the oracle (see 5).

### 7.6 Memory in three kinds, and the missing one

**Source:** §D and §G (memory-augmented models, behavior memory, CoALA).

| CoALA memory | In Brain2 |
|--------------|-----------|
| Semantic | The Item graph (`lib/task-store.ts`) |
| Episodic | Logs, time entries, texts, night entries |
| Procedural | `lib/workflows-store.ts` and the command grammar |
| Working | Missing. The open tell or ask question is in memory only, and the chat transcript is per-device |

- **Persist working memory.** Keep the open question, so a reload does not make BIM forget what it just asked.
- **Behavior memory.** Distil chat into a few durable facts for the dossier card (the Xiao idea). Each fact keeps its source line and can be removed. It waits for the heartbeat reflection in 6.

### 7.7 Summaries by chunk and manager

**Source:** §D (Chain-of-Agents).

Local models have short contexts. For a week, month, or year summary on the 14B: one worker per day or chunk writes a short note from its rows, then one manager merges the notes. Each call stays small and each can be checked against its rows. Workers read through the Item graph and do not message each other (see 4).

### 7.8 Do not spend tokens on reasoning for classification

**Source:** §F (the Sprague finding the survey cites: chain-of-thought helps mainly math and symbolic tasks).

A BIMBY that picks one tool from a closed list should not "think". Spend the budget on voters (1) instead. This agrees with the `think: false` fix in `lib/bim-flow/ollama.ts`.

### 7.9 Do not trust a model's stated confidence

**Source:** §E and §F (RLHF models are verbally overconfident; calibration; self-consistency).

This backs 2. Read logprobs, or agreement across voters or paraphrases. Never ask a model "how sure are you?" and believe the number.

### 7.10 Skipped on purpose

Diffusion language models (LLaDA), attention variants, RLHF and fine-tuning, and a full ACT-R port. They are training or architecture topics Brain2 does not control. The survey's world-model section is thin. Brain2's own version is learning signals from the person's data first and letting the model only narrate.

## 7. Ideas from the collaboration-mechanisms survey

_Source: Tran et al., "Multi-Agent Collaboration Mechanisms: A Survey of LLMs" (arXiv 2501.06322, Jan 2025). Nothing here is built._

**Describe every BIMBY and BIM edge with the survey's five dimensions.** Actors, type (cooperate / compete / both), structure (centralized, peer-to-peer, hierarchical), strategy (rule, role, model) and orchestration (static or dynamic). Brain2 is static, centralized and rule-first: grammar, then small models, then the person. Put type and strategy on the `/lab/bim-flow` edges so the bench shows which hops are code and which are models. Add two Blueprint fields: what a BIMBY hands up to, and who may read its output.

**Plan BIMBY: skeleton first, then parallel fills.** For the disabled Today, This week and Season modes (`lib/plan-bimby/modes.ts`): one call drafts the shape of the week, then one small call per day fills it, each reading only that day's context (`lib/holidays.ts`, sleep). One day can be re-planned without redoing the week.

**Plan BIMBY: dependency edges.** Today `parse.ts` returns an ordered list. Add "blocks / blocked by" edges in `links.ts` (cannot pack before the flight is booked) so the confirm screen shows what waits on what. Independent tasks may be shown as parallel.

**A defender BIMBY (coopetition).** One BIMBY packs the day. A second argues for protected things: sleep, meals, habits, holidays, the never-destroy rule. The person is the judge, shown as keys ("keep the nap / move the nap"). It runs only when the plan is tight.

**Keep the code-grammar fallback.** The survey names two risks: a central hub that fails stops everything, and overconfident models spread errors to each other. Test every flow with all models off. BIMBIES still do not message each other.

**Generate a BIMBY's prompt from its ritual.** MetaGPT writes standard operating procedures into agent prompts. The end ritual and period summary are already such procedures, so a helper's prompt can be built from the same definition and never drift from it.

**Skipped on purpose.** Federated learning, mixture-of-experts, 5G/6G and cultural-simulation sections do not apply.

## 8. Ideas from the dynamic-routing vision paper

_Source: Wang and Li, "Dynamic, Efficient, and Generalizable Multi-Agent Communication for Large Language Models" (IEEE ICDMW 2025, Blue Sky track), pasted 2026-11-02. It is a three-page vision with no results, so treat it as a checklist, not evidence. Nothing here is built._

The paper proposes an agent pool, a router that picks the next agent and its context, an execution loop with early stop, and a router trained on a reward that balances accuracy, token cost and context size. Brain2 already has the cheap form of each: the BIMBIES, `lib/bim-flow/chat-router.ts`, `escalate` in `lib/bim-flow/crew.ts`, and `retrieve.ts`. The ideas below are the parts that are new here. Voting, confidence, the critic and per-stage scoring stay in 1, 2, 4 and 5.

### 8.1 Log every router correction

**The shape.** When the person fixes a lane ("no, that was a log"), store `(line, lane picked, lane meant, answeredBy)` next to the run in `lib/bim-flow/run-history.ts`. No model is trained. The log is a replay set for `scenarios.ts` and a source of few-shot examples for the router prompt. A correction is the oracle (see 5).

### 8.2 A three-number scorecard

**The shape.** Score each replayed line on whether it was right, how many models were called, and how many evidence rows were sent. Plot accuracy against cost for each router setting. This is the paper's reward, read by hand instead of learned. It turns the voter-count question in 1 into a curve.

### 8.3 Re-route after each step, for Ask

**The shape.** Today the router picks a lane once, with an optional `second`. For Ask, loop instead: retrieve, then a small gate asks "is this evidence enough?", then answer, retrieve more, or say "I don't know" (the don't-know path in `components/Bim/README.md`). A hard step cap ends the loop. The gate is code first (the check in 7.1), and a model second.

### 8.4 Working memory for the open question

**The shape.** The paper's shared key-value memory is the missing working memory in 7.6. Persist the open question and the names already resolved, so the Ask lane and the Plan BIMBY do not re-derive them. BIMBIES read it through the Item graph and the one write door. They still do not message each other (see 4).

### 8.5 One runner, many roles

**The shape.** The paper treats a role as a parameter, not a separate agent. A Blueprint (role text, closed tool list, thresholds, step cap, low-confidence path) plus one shared runner would make a new BIMBY a data file. It also forces every BIMBY to state its stop condition (see 4).

### 8.6 Success list for the Agent Lab evals

The paper's success list maps to evals Brain2 can run: accuracy against a static flow, token use, robustness to a noisy or wrong model, generalization to lines not seen before, and a traceable path per answer. The last two already exist as the unseen-lines scenarios and the Trace.

### 8.7 Skipped on purpose

RL-trained routing, soft-prompt or fine-tuned agents, and adaptive agent creation. Brain2 does not control training, and a BIMBY made on the fly has no closed tool list, which breaks `guard.ts`. A fully dynamic topology is also skipped: the code-first static flow can be tested with all models off.

## 9. Ideas from the LLM multi-agent technology survey

_Source: Aratchige and Ilmini, "LLMs Working in Harmony" (arXiv 2504.01963, Mar 2025), pasted 2026-11-02. A shallow survey. Its architecture and framework parts are already covered in 1, 4 and 7. Only the unclaimed parts are here. Nothing here is built._

### 9.1 A forgetting curve on remembered facts

**Source:** MemoryBank (Ebbinghaus updater).

7.6 plans behavior memory (chat distilled into dossier facts) but not how a fact fades. Give each fact a strength. It decays with time and is reinforced when the person uses or confirms it. Weak facts leave the model's context first. They stay visible to the person with their source line. It needs no model and is the write side of 7.2.

**Test:** replay recorded questions. Compare answers with all facts in context against answers with only strong facts. Count facts dropped that the right answer needed.

### 9.2 Refine one block, or replan

**Source:** AdaPlanner (in-plan and out-of-plan refinement).

For `lib/plan-bimby/`: when the person moves or edits one block, re-fit only that block and keep the rest. Replan the whole plan only when a hard constraint breaks (a holiday, a deadline, `mustBeDoneBefore`). This is a rule for the confirm screen. It keeps the plan stable.

**Test:** edit one block in recorded plans. Count how many other blocks moved. The target is none unless a hard constraint forced it.

### 9.3 Accepted plans as examples

**Source:** AdaPlanner (skill discovery: reuse plans that worked as few-shot examples).

Store each approved plan as a pair (input line, accepted plan). Feed the nearest pairs back as examples. This is step 5 of 1 applied to the Plan BIMBY. A plan the person corrected stays the oracle (see 5).

### 9.4 Legal action order in the Blueprint

**Source:** KnowAgent (an action knowledge base of which action may follow which).

Add "what may follow what" to each BIMBY's Blueprint, next to the closed tool list. For example, a delete never follows a bulk select, and a move needs an existing target. `lib/lists-helper/guard.ts` can enforce it in code, so it is free and certain.

### 9.5 A bounded Ask loop (try last)

**Source:** ReAct (interleaved reasoning and retrieval).

Ask retrieves once today. Allow at most two read-only hops, only when the first returns thin evidence, with a step cap and no writes. Try it only on "when did I last…" and "how was October?" questions. It costs more calls and 7.8 says not to spend reasoning on classification, so test it after the rest.

### 9.6 Skipped on purpose

Tree of Thoughts, and CAMEL, AutoGen or CrewAI-style agents that talk to each other. They break the rule that BIMBIES do not message each other, and they cost many calls. Vector databases are skipped too: the Item graph is the memory.

## 10. Ideas from PRIME (fast answer, reflection, then slow agents)

_Source: Tran et al., "PRIME: Planning and Retrieval-Integrated Memory for Enhanced Reasoning" (arXiv 2509.22315v3), pasted 2026-11-02. Read: the method section only, not the benchmarks. It is medical and multi-hop QA over textbooks. Nothing here is built._

**The shape.** A Quick Thinking agent answers as subquestion and subanswer pairs. A Reflection agent reads that trace and decides: keep it, or run System 2 (planner, search, reader, hypothesis, integration). Slow agents run only on doubt.

**What Brain2 already has.** The router ladder (`lib/bim-flow/chat-router.ts`, `crew.ts`: code, 3B, then 14B) is System 1 with escalation. The Ask flow has a `check` answer mode (`CHECK_SYSTEM` in `lib/bim-flow/run-flow.ts`) that tests a draft against its evidence. So a reflector exists in part. It rewrites the draft and does not decide whether to escalate.

### 10.1 Reflection BIMBY on the Ask flow (the first slice)

One job. Input: the question, the draft's subquestion/subanswer pairs, the evidence rows. Output, closed: `{ verdict: "ok" | "escalate", why: one plain sentence, weak: [subquestion numbers] }`.

- It never writes an answer. `escalate` sends the line up the existing ladder (14B, then 30B), or into 10.2.
- Use a different model or prompt from the answerer (see 4). The 14B reads the trace; a 3B reflecting on itself is probably too weak. Test that.
- It adds a third escalation trigger beside logprobs and voter agreement (2, 1). The paper argues against confidence scores alone because they miss a reasoning step that ignored evidence. Keep all three numbers on the Trace.
- Code checks first (empty evidence, a dated row the answer ignores), as in `guard.ts`.

**Test:** replay recorded Ask lines, including "when did Elijah leave for tour?" before the 2026-11-01 fix. Count escalations the 14B answered correctly (waste) and lines it passed that were wrong (miss). Compare accuracy and seconds against confidence-only routing.

### 10.2 A subquestion lane for Ask (try after 10.1)

On `escalate` only: a planner splits the line into at most four subquestions; each goes through `retrieve.ts` on its own; a reader keeps a few facts per subquestion; one answer step sees the facts. Today retrieval runs once for the whole line. This is the more general form of 9.5 (the bounded Ask loop), with the same step cap and no writes. A reader that shrinks the prompt may also help the 32 GB model-reload problem.

### 10.3 A search gate before retrieval

PRIME's Search agent first decides: look it up, or answer from what is in hand. For Brain2 that is vault versus plain reply. Do it as a code rule first (the router already has "sure question"), and use a model only for the leftovers. It is one yes/no node on `/lab/bim-flow`.

### 10.4 Hypotheses for gaps, kept only if supported

For `suggestWeek`: one step proposes several readings of a gap in Activity; an integration step keeps those backed by evidence lines (file activity, location, calendar, chat) and drops the rest. An unsupported reading is confidence none, which already turns into "I don't know" and asks the person (`components/Bim/README.md`, BIM asks you). The proposer never writes; ACCEPT stays the write door.

### 10.5 Skipped on purpose

The full seven-agent System 2 on every line, and agents that pass messages to each other. Both break the rule that BIMBIES read and write only through the Item graph, and both cost many calls on a Mac that already swaps models.
