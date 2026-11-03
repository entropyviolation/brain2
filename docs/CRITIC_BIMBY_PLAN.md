# The Critic BIMBY: a second look before the person decides

_Last mapped: 2026-11-02_

**Status 2026-11-02: C0, C1 and C2 are built** (code layer, ledger, bench, model layer with a per-model gate; see `lib/critic-bimby/README.md`). C3 onward is not. This expands `docs/BIMBY_IDEAS.md` §4 into a plan with files, tests and a ship rule. It is grounded in seven papers the person pasted on 2026-11-02 and in the code as it stands: `lib/plan-bimby/`, `lib/lists-helper/`, `lib/bim-flow/crew.ts`, `lib/agents/` and `lib/skills/`.

**One named idea: the second look.** After a BIMBY has made a plan and before the person is asked to approve it, one more stage reads the person's own words and the finished plan, and says "this matches" or "this does not, here is where". It never edits. It never writes. It turns a wrong plan into a visible doubt, and a doubt into keys.

## 1. What the papers say, and what it changes

| Paper | Finding | What it changes here |
|-------|---------|----------------------|
| Dochkina, "Drop the Hierarchy and Roles" (arXiv 2603.28990) | The best protocol gave each agent the **completed outputs** of earlier agents, not their intentions, history or plans (Table III, §V-B). Fixed order plus free choice beat full control by 14% and full freedom by 44%. Below a model capability threshold, structure beat autonomy. More agents past 64 gave nothing; model quality mattered more. The judge was a different model from the agents. Judges carry verbosity bias (§V-F). A three-ring rule: the closer to "why", the more human control. | The critic reads the **finished** plan, never the planner's reasoning. It is **one** call, not a panel. It must be a different model or prompt. A small critic that fails the bench is switched off, not trusted (§3.7). The three rings map onto what the critic may change (§3.8). Reasons are capped in length. |
| Wang and Li, "Dynamic, Efficient, Generalizable Multi-Agent Communication" (ICDMW 2025) | A router decides which agent runs next and what context it sees. Reward balances accuracy, token cost and context compactness. The loop supports early stop. Wanted: detect and downweight low-quality agents; traceable paths. | The critic sees a **compact** context only (line, plan, a few evidence rows). The run is skipped when it cannot help (§3.6). Every call lands on the Trace. Per-model quality is tracked, so a bad critic is downweighted by the ledger (§5). |
| Aratchige and Ilmini, "LLMs Working in Harmony" (arXiv 2504.01963) | In Mixture-of-Agents, a model good at proposing can be poor at aggregating. Agent Forest voting has diminishing returns and a rising bill. AdaPlanner refines a plan from feedback (in-plan and out-of-plan). ReAct: traces make a decision readable. Hallucination is the standing risk. | The critic role gets its **own** model ladder, chosen by bench, not borrowed from the planner. No swarm for v1. Repair is a later slice, capped at one try (§7, C6). The reason line is the trace. |
| Tran et al., "Multi-Agent Collaboration Mechanisms" (arXiv 2501.06322) | Collaboration has actors, type, structure and strategy. Cooperation, competition and **coopetition** are different channels. A hybrid is real: in LEGO, an Explainer and a **Critic** first cooperate, then compete to refine. Rule-based protocols are predictable and easy to debug but rigid. Failure handling and trustworthiness need design. | The critic is a **cooperative, centralized, rule-then-model** channel. It is a stage the host calls. It does not message other BIMBIES. The code layer is the rule-based part; the model layer is the model-based part. |
| Gong, "A Survey of LLMs in Multi-Agent Systems" (CONF-CDS 2026) | Debate fails by echo chambers and shared misconceptions; remedies are diversity and quality pruning. EvoSkills warns that a surrogate verifier can drift from the real oracle. SciCrafter scores **stages**, not only the end. LLM judges are subjective and costly. CAMEL uses explicit termination to stop role drift and loops. | Two copies of one model are not two opinions (§3.7). The **person** is the oracle; a model score is a hint (§5). Score each stage (`BIMBY_IDEAS.md` §5). A hard step cap and a stop condition go in the Blueprint. |
| Navarro, "Enhancing Cognitive Functions in LLMs" (IEEE ICMLT 2025) | Hallucination splits into factuality and **faithfulness**. Post-processing against a verified source filters wrong output. Chain-of-Verification drafts, then asks verification questions, then revises. RLHF models are verbally overconfident. Self-consistency helps. | Brain2 only owes **faithfulness** to the person's words and the vault, the easier half. The critic must **quote** the line, and **code** checks the quote is really in the line (§3.3). Never ask the critic "how sure are you". |
| Xia et al., SkillRL (arXiv 2602.08234) | Failed runs are distilled into short lessons: where it failed, what it should have done, a general rule. Skills come in two tiers (general, task-specific). Evolution fires only for categories under a success threshold. Raw trajectories as memory were far worse than distilled skills (up to 25% lower in their ablation). | The person's misses and false alarms become critic lessons through `lib/skills/` (already built for the Tracking Helper). General and per-BIMBY tiers. Evolve only where the catch rate is low. Keep lessons, not raw chats (§6). |

**What argues against the critic**, from the same papers:

- Dochkina: models under a capability threshold do worse with freedom, and the critic is a small model with a freer job than the planner.
- Gong and Tran: agreeing models spread one error to each other. A critic from the same family as the planner may only nod.
- Wang and Li, Aratchige: every extra call is a cost, and gains shrink.
- Tran (Table 3): rule-based checks are cheap and debuggable, which says the code layer should carry most of the load.

So the plan below builds the free layer first, builds the bench before the model, and ships the model layer only if it beats the free layer by a stated margin. If it does not, the critic stays code-only and says so in its README.

_Read in part, so check the source before leaning on a detail:_ Tran pp.1-8 and 11-18 of 35, SkillRL pp.1-8 of 31, Gong pp.1-10 of 13, Navarro pp.1-6 of 11. Dochkina, Wang and Li, and Aratchige were read whole.

## 2. Where it sits

Today, `lib/plan-bimby/`: SAY → SEGMENT (`parse.ts`) → LINK (`links.ts`) → CONFIRM → RUN.

With the critic: SAY → SEGMENT → LINK → **SECOND LOOK** → CONFIRM.

The second look draws a strip at the top of the confirm card the person already reads, so it adds no step. The Lists BIMBY today has no model (its planner is code), so its critic waits for a model planner (§4).

## 3. Design

### 3.1 The role card (what goes in the Blueprint)

| Field | Value |
|-------|-------|
| Role | Evaluator (`StepRole` `check`, `ModuleRole` `evaluator`), one per host BIMBY |
| Question it answers | "Does this plan do what the line says, and nothing more?" |
| Senses | The person's line, the finished plan, up to eight evidence rows the host names |
| Tools | None. It reads what code hands it. `writes: false` |
| Output | A `Critique` (§3.4). Never a plan |
| Stop condition | One verdict. At most one escalation rung. No retry loop |
| Step cap | `limits.maxCalls: 2` (one call plus one rung), `maxWrites: 0`, `maxMs` set per host |
| Door | `proposes: []`, `surface: "critic-bimby"` |
| Talks to other BIMBIES | No. The host's code passes it data and reads the result |

### 3.2 Three layers, cheapest first

The ladder from `BIMBY_IDEAS.md` §2 ("cheapest competent path") applies inside the critic too.

1. **Code layer (free, certain).** Checks that need no model: is each quoted number in the line, is each deadline phrase a substring of the line, is every clause of the line covered, do links resolve, does the plan stay under the host's guard. A **certain** finding fails the plan at once and skips the model call.
2. **Model layer (one call).** A different model or prompt from the planner reads the line and the plan and answers in a closed schema. It runs only when the trigger rules in §3.6 say it can help.
3. **Escalation (one rung).** If the model layer is unsure (low margin, or it disagrees with the code layer), `escalate` from `lib/bim-flow/crew.ts` climbs one rung. Still unsure means **keys**, not a guess.

### 3.3 Two modes for the model layer

**Judge** (for free-form output, such as the Plan BIMBY). The critic reads the line, then the plan rows. For each row it returns `ok` or a finding kind. It also lists `missing` spans of the line that no row covers. **Every finding must carry a `quote` copied from the line. Code drops a finding whose quote is not a substring of the line** (after trimming case and spaces). This is Chain-of-Verification's faithfulness check done in code, and it removes the critic's own hallucinations.

**Re-derive and diff** (for a BIMBY with a closed tool list). The critic is given the line only and asked to fill the same closed schema the planner filled (tool and slots). Code diffs the two. A difference is the finding. This is cheaper to trust than a yes or no, because there is nothing to be persuaded by. It is also the same signal as the swarm vote in `BIMBY_IDEAS.md` §1, so when the swarm lands the critic reuses its spread and the two are not built twice.

The critic never sees the planner's reasoning, its prose or its scores. It sees the line first, then the plan. That avoids anchoring and keeps its answer short.

No chain of thought here. The critic picks from a closed list, which `BIMBY_IDEAS.md` §7.8 says should not "think" (`think: false` in `lib/bim-flow/ollama.ts`).

### 3.4 Types (sketch, `lib/critic-bimby/types.ts`)

```ts
export type FindingKind = "invented" | "dropped" | "misordered" | "wrong-link" | "too-broad" | "ambiguous"

export interface Finding {
  kind: FindingKind
  /** The host's id for the row or slot this is about. */
  where: string
  /** Copied from the line. Required for a model finding; code verifies it. */
  quote?: string
  /** One plain sentence, capped at 140 characters. */
  reason: string
  by: "code" | "model"
  /** certain: the line contradicts the plan. hint: probably wrong, a person should look. */
  strength: "certain" | "hint"
}

export interface Critique {
  verdict: "pass" | "warn" | "fail"
  findings: Finding[]
  /** full: model layer ran on a different model. code-only: no model. same-model: critic and planner share a model, so the model layer counts as a hint only. */
  trust: "full" | "code-only" | "same-model"
  model?: string
  hops: { model: string; ms: number; why?: string }[]
  ms: number
}
```

Verdict rule: any `certain` finding is `fail`. A model `hint` with a valid quote is `warn`. Two or more model hints with valid quotes is `fail`. `same-model` trust can only reach `warn` from the model layer. No findings is `pass`.

### 3.5 Verdict → what the person sees

| Verdict | Shown | Keys |
|---------|-------|------|
| `pass` | Nothing, or a small "checked" lamp on the card | None |
| `warn` | A chip on the row it is about, with the reason. Non-blocking | "Keep as is" |
| `fail` | A strip: "Looks off: <reason>" plus a key per finding | One key per finding (below), "Keep as is", "Cancel" |

Keys carry out **existing** confirm-screen edits, run by code on the person's pick, never by the critic:

| Finding | Key |
|---------|-----|
| `dropped` (quote Q) | "Add “Q” as a task" (a new row titled from the quote, editable) |
| `invented` (row R) | "Remove “R”" |
| `wrong-link` | "Clear the link on “R”" |
| `too-broad` | "Split “R”" opens the row's subtasks |
| `ambiguous` | The same candidate dropdown the confirm screen already shows |
| `misordered` | A chip only for now. No key |

"Keep as is" is always present and always safe. A pick of it over a `fail` is logged: it is the false-alarm datapoint (§5).

### 3.6 When it runs

The model layer is skipped unless at least one of these holds. Each is a dial the host sets, not a constant.

- The code layer found a `hint` (the model is the second opinion on it).
- The planner climbed a rung (a `hops` entry with `why`) or fell back to rules.
- The plan is big: Plan BIMBY with four or more rows or any subtask; Lists plan above a total near the host's confirm count.
- The plan has a link the person has not confirmed.

A certain code finding skips the model call. A clean, small, first-rung plan skips it too.

### 3.7 Trust, capability and independence

- **Independence.** Add a `critic` role to `CREW_LADDERS` (extend `CrewRole`, `CREW_LADDERS` and `crewFor` in `lib/bim-flow/crew.ts`). Code rule: the critic's first rung must not equal the model that planned. If only one model is installed, the critic runs on a different **prompt**, is marked `trust: "same-model"`, and counts as a hint only.
- **Capability gate.** A model is allowed the critic role for a host only after it passes the bench (§5) for that host. The result is stored as `criticReady` per model and host. Failing models fall back to `code-only`. This is Dochkina's threshold, and Aratchige's "a good proposer may be a bad aggregator", applied.
- **Never ask for a confidence number.** Where logprobs exist, read them. Else use agreement between the code layer and the model layer, and between rungs.

### 3.8 The three rings

| Ring (Dochkina §V-D) | In the critic |
|----------------------|---------------|
| 1. Human only | The critic never edits or writes. The closed tool lists. Never destroy. The person is the judge. The existence of "Keep as is" |
| 2. Human and system | The rubric text, the finding kinds, the ship thresholds. The ledger proposes changes; the person approves |
| 3. System, tuned on replay | Trigger dials (§3.6), which rung, timeouts, the string-overlap thresholds in the code layer |

## 4. Fit by BIMBY

### 4.1 Plan BIMBY (first)

It has a model planner, free-form output, an editable confirm screen (which gives free ground truth), and a rules parser (`parseByRules`) that is a free independent second reader of the same line. The code layer uses that parser as a second voter.

| Check | Layer | Strength | How |
|-------|-------|----------|-----|
| A number in `minutes` that is not in the line | code | certain | Digits or number words must appear in `source`. "an hour" and "half an hour" are accepted forms |
| A `due` or `paceNote` that is not in the line | code | certain | Substring check on `source` (the schema says "their words") |
| No rows from a line with clauses | code | certain | `parseByRules` found rows, the plan has none |
| A row with no content word from the line | code | hint | Word overlap after dropping stop words |
| A clause of the line no row, subtask or remark touches | code | hint | Clauses from `parseByRules`; kind `dropped` |
| First-mention order differs from row order | code | hint | Position of each row's best-matching word in `source` |
| An unconfirmed task link with weak name overlap | code | hint | Reuses the match score in `links.ts`; kind `wrong-link` |
| A taking-verb intake link on a line with no drink, drug or food | code | certain | The check `detectIntake` already implies, run back from the plan |
| Row-by-row judge, `missing` spans, quotes verified | model | hint | §3.3 judge mode |

### 4.2 Tracking Helper and Habits BIMBY (second)

They have an accept door (`lib/tracking-helper/accept.ts`) and a skills panel. Map their stages first and write what each proposal's checkable claim is (a time span, a place, an activity name), then give each an adapter. Not mapped here.

### 4.3 Lists BIMBY (waits for a model planner)

Its planner is code with a guard, so a critic would be checking code with a model. The known worst case, "Book items that are also Task shouldn't be Task" read in the wrong direction, is a grammar problem (`exclusive-type` keep and drop). Its useful form is **re-derive and diff** the day a model picks the tool (the swarm in `BIMBY_IDEAS.md` §1). Until then, the cheap win for it is the dry-run count line (`BIMBY_IDEAS.md` §3), which needs no critic.

### 4.4 BIM flow answers

`BIMBY_IDEAS.md` §7.1 (verify the Ask answer in code) is the critic's code layer for BIM. It needs no new framework. Build it as the code layer of a `CriticHost` for the flow (§7, C4) if it ships.

## 5. How we will know it works

**Principle.** The person's action is the oracle. A model's score is a hint. A critic can drift from the real target (Gong, on EvoSkills), and judges have bias (Dochkina).

### 5.1 The ledger

One record per critique, kept on this device and appended to the disk archive. Reuse the pattern in `lib/bim-flow/suggestion-verdicts.ts` (a `localStorage` key plus `archive(kind, record)`; add `critic-verdict` to `ArchiveKind`).

```ts
interface CriticRecord {
  id: string; at: string; host: "plan" | "tracking" | "lists"
  line: string; planHash: string
  critique: Critique
  /** What the person did on the card. */
  outcome: "accepted" | "edited" | "key" | "kept-over-critic" | "cancelled"
  /** Rows added, removed or retitled between the draft and what was confirmed. */
  edits: { kind: "added" | "removed" | "retitled" | "relinked"; rowId: string }[]
}
```

`diffPlan(draft, confirmed)` is pure and gives `edits` with no extra tap, because the confirm screen already lets the person edit.

| Outcome | Reads as |
|---------|----------|
| `fail`, then a key used or a flagged row edited | Catch (true positive) |
| `fail`, then "Keep as is", no later edit | False alarm |
| `pass` or `warn`, then the person edited a row | Miss |
| `pass`, accepted unchanged | Probably right, or rubber-stamped. Counted apart, never as a win |

Rubber-stamping is a real limit: a passing critic may make people look less. The fault bench below measures the critic without relying on the person.

### 5.2 Fault injection (works before any user data)

`lib/critic-bimby/inject.ts` takes a good draft from a gold set of lines and applies one labelled fault: drop a row, add a made-up row, swap two rows, change `minutes`, change a `due`, relink to the wrong task, flip a keep/drop slot. The expected finding kind is known. Report catch rate **per fault kind per layer** (code only; code plus model), and the false-alarm rate on **unmutated** gold plans.

- Gold set to start: the line in `lib/plan-bimby/README.md`, the ones in `plan-bimby.test.ts`, and lines the person has sent (device-local).
- It gives a difficulty ladder for free (one fault, two faults, a fault in a long line), the idea in `BIMBY_IDEAS.md` §7.5.
- Generated faults are hints about the critic. Real corrections from the ledger stay the oracle.
- Pattern: a scripted-model unit test (`scenarios.ts`'s `scriptedModel`) for code paths, and a `*.live.test.ts` file for Ollama, like `scenarios.live.test.ts`.

### 5.3 Stage verdicts

Record one verdict per stage for each run: segment, link, **critic**, confirm. `BIMBY_IDEAS.md` §5 (`run-history.ts`, `scenarios.ts` are the seams). A miss then points at the stage that broke.

### 5.4 Ship rule (starting dials, not findings)

Per host, per layer:

- **Catch** at least 0.6 of injected faults of the kinds that layer claims.
- **False alarms** at most 1 per 10 clean plans.
- **Wait**: added time under the host's `maxMs` at the 95th percentile.
- **Margin**: the model layer must beat the code layer by at least 15 points on the kinds code cannot see. If not, it does not ship.

**Kill rule.** If the model layer misses the margin, the critic ships code-only, and the README says why. That is a success, not a failure: it is the free path.

Report per host: catch, false alarm, cost (calls, ms), by kind and by critic model. Keep a reliability curve only if logprobs exist.

## 6. Learning from corrections

`lib/skills/` already does record → weak spot → distill → review → use. The critic joins it as a new agent id, `critic:plan`.

- Record each miss and each false alarm as an `Experience` through `recordReaction` (severity 1-3, the better move).
- `evolve.ts` keeps categories under 0.8 success with at least 3 cases. For the critic, a category is a **finding kind** per host.
- `distill.ts` makes a lesson: what the line said, what the plan did, what to check next time. Lessons arrive `proposed`. Nothing reaches a prompt until the person makes it `active`.
- `pickSkills` puts the top few lessons into the critic prompt. General rules always; kind-specific ones by overlap.
- Store lessons, never raw chat (SkillRL's ablation). A skill only changes a prompt; the critic's power does not change.

## 7. Build slices

Each slice is small and ends in a test. **AMAP:** C0 and C1 touch different files (they share only `types.ts`, written first) and run in parallel. C3's adapter needs only the types.

| Slice | What | Files | Done when |
|-------|------|-------|-----------|
| **C0** Code layer for Plan BIMBY | Types; the checks in §4.1 marked `code`; verdict rule; keys; the strip and chips on the confirm card | `lib/critic-bimby/{types,checks-plan,verdict,keys,index}.ts`, `critic-bimby.test.ts`; edit `components/Lab/PlanBimby/PlanBimbyPanel.tsx` and `plan-bimby.css`; `PlanDraft.critique?` in `lib/plan-bimby/types.ts` | Every certain fault flags. Gold lines raise nothing. No model needed. Strip and chips render with no new step |
| **C1** Ledger, diff, bench | `diffPlan`, the ledger store, `critic-verdict` archive kind, fault injection, bench report | `lib/critic-bimby/{ledger,diff,inject}.ts`, `bench.test.ts`, `bench.live.test.ts` | Bench prints catch and false-alarm per kind for the code layer. Ledger records an outcome on every confirm |
| **C2** Model layer (judge mode) | `critic` role in the crew; schema and prompt; quote check; trigger rules; trust and capability gate; Trace lines; a "Second look" setting, model layer **off** by default | `lib/critic-bimby/{run,prompt,gate}.ts`; edit `lib/bim-flow/crew.ts` (+ its tests); settings key | Scripted-model tests cover each verdict path. Live bench reports the §5.4 numbers. The layer turns on for a model only when the gate passes |
| **C3** Blueprint and lab | `adapters/critic-bimby.ts` (a `pipeline` mind: `code-checks` code, `second-look` local-model, `keys` code), registry entry, lab view of per-host rates and stage verdicts, `checks` ids bound | `lib/agents/adapters/critic-bimby.ts`, `lib/agents/registry.ts`, a panel under `components/Lab/Agents/` | The lab lists the critic with its role card (§3.1) and shows live rates. `validateBlueprint` passes |
| **C4** Generic host seam, second host | `CriticHost<P>`: `render(plan)`, `provenance(line, plan)`, `rubric`, `keysFor(finding)`, `evidence(plan)`. Adapt the Tracking Helper; BIM answer check (`BIMBY_IDEAS.md` §7.1) as a code-layer host | `lib/critic-bimby/host.ts`, `hosts/{plan,tracking,bim-answer}.ts` | Two hosts share one runner with no copy-paste |
| **C5** Lessons | Wire `recordReaction` for `critic:plan`; evolve on finding kinds; show proposed lessons in the lab panel | `lib/critic-bimby/learn.ts`; reuse `lib/skills/` | A recorded miss produces a proposed lesson. Active lessons appear in the prompt |
| **C6** Later, only if the bench asks | One repair try: feed the reason back to the planner once, then keys regardless. A defender BIMBY (`BIMBY_IDEAS.md` §7, coopetition) reusing the same keys. Lists re-derive and diff after the swarm lands | | Each has its own bench result first |

## 8. Settled by default, change if you disagree

- **First host:** Plan BIMBY.
- **Code layer on by default; model layer off until the bench passes** for the installed model.
- **No repair loop in v1.** A `fail` goes to keys.
- **`warn` is a chip, not a blocker.**
- **Lines are kept on this device and the local disk archive only.** They can be personal.
- **The critic is a stage with a Blueprint, not a peer.** It never reads another BIMBY's output except through code.

## 9. Docs to update when slices land

Per `CLAUDE.md`, when code changes: `lib/plan-bimby/README.md` (flow line, `critique`), the new `lib/critic-bimby/README.md`, `lib/agents/README.md` (adapter list, the Planned line), `components/Lab/BimFlow/README.md` for the `critic` crew role, `lib/skills/README.md` (the new agent id). `docs/BIMBY_IDEAS.md` §4 points here.
