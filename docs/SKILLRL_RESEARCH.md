# SkillRL, and what Brain2's agents can take from it

_Last mapped: 2026-11-02_

Paper: **SkillRL: Evolving Agents via Recursive Skill-Augmented Reinforcement Learning**, Xia, Chen, Wang, Liu, Zeng, Wang, Han, Zhou, Zhao, Chen, Zheng, Xie, Yao. [arXiv 2602.08234](https://arxiv.org/abs/2602.08234).

Read from the abstract page and the first ~100k characters of the HTML version. The last ~23k characters (appendix) were not read. Numbers below are the paper's, not ours.

Built from this note: `lib/skills/` (see its `README.md`). Everything marked **Planned** is not built.

## 1. The paper in one page

**Claim.** Storing raw trajectories as agent memory is redundant and noisy. Distilling them into short, reusable *skills* transfers better, costs fewer tokens, and can keep improving while the policy trains.

**Four parts.**

1. **Experience-based skill distillation.** A base agent rolls out in the environment. A stronger teacher model (o3) reads both successes and failures.
   - A success yields a strategic pattern and its decision points.
   - A failure yields a concise **failure lesson**: the failure point, the flawed reasoning, the correct action, and a general prevention principle.
2. **SkillBank, two tiers.**
   - **General skills** apply to every task in the environment (explore systematically, check preconditions, track the goal). Always in the prompt.
   - **Task-specific skills** are grouped by task category (domain action sequences, constraints, category failure modes). Retrieved per task by embedding similarity: threshold δ = 0.4, top K = 6.
   - Every skill is `name`, `principle`, `when_to_apply`.
   - Reported compression: 10–20× fewer tokens than replaying raw trajectories. Prompts stayed near 1,300 tokens against about 1,450 for raw memory retrieval.
3. **Cold-start SFT, then RL.** The teacher writes skill-using reasoning traces. The model is fine-tuned on them (this is also the KL anchor), then trained with GRPO on binary success rewards.
4. **Recursive skill evolution.** After each validation epoch:
   - Compute the success rate per task category.
   - Only categories under a threshold trigger evolution.
   - Sample their failures, **diversity-aware**: group by category, order by severity, take round-robin.
   - The teacher names unaddressed failure patterns, proposes new skills, and refines old ones. The bank went from 55 to 100 skills.

**Results (paper's own).**

| Setting | SkillRL | Comparison |
|---|---|---|
| ALFWorld | 89.9% | GRPO 66.1%, MemRL 21.4% |
| WebShop | 72.7% | n/a here |
| 7 search-QA sets (avg) | 47.1% | Search-R1 38.5%, EvolveR 43.1% |

Ablations, ALFWorld / WebShop: no hierarchy 76.8 / 61.4; no skill library 61.7 / 50.2; no SFT 65.2 / 46.5; no dynamic evolution 84.4 / 70.3. The library matters most, evolution least. Kimi-K2.5 distilling its own skills went 71.2 to 88.5 on ALFWorld, so a teacher is not strictly needed.

**Limits the authors state.**

- Needs a strong teacher model.
- RL is expensive: about 30 GPU-hours per experiment on 8×H100.
- Bank growth can add retrieval noise; no settled fix.
- Updates are periodic, tied to validation, not live.
- Only tested on ALFWorld, WebShop and search QA. Not on software work.

## 2. What fits Brain2, and what does not

Brain2's agents are **BIMBIES** and BIM flows. Their Blueprints say `localOnly: true`, they write nothing themselves, and a person approves every write. That decides which parts of the paper carry over.

| Paper part | Brain2 answer |
|---|---|
| Skill = name, principle, when-to-apply | **Built.** `Skill` in `lib/skills/types.ts`. |
| General vs task tiers | **Built.** `retrieveSkills` returns both. |
| Similarity retrieval, δ and top-K | **Built, lexical.** Word-overlap cosine behind a `Scorer` seam. **Planned:** local embeddings. |
| Failure lessons (point, flaw, correct, prevent) | **Built.** `lessonOf` writes them from a person's correction with no model; `distillWithModel` asks a local model to generalise. |
| Learn from both outcomes | **Built.** `Experience` records accepts as successes and rejects, edits and roll-backs as failures. |
| Per-category success rate triggers evolution | **Built.** `evolve.ts`: `weakCategories`. |
| Diversity-aware failure sampling | **Built.** `sampleFailures`: round-robin over categories, worst first. |
| Skills enter the prompt | **Built for the Tracking Helper** (the one BIMBY with a model call). The Lists BIMBY has no model, so its skills are shown in the lab and become prompt text once it gets a model. |
| Bank growth control | **Built.** Cap of 100, prune by win rate, hand-written skills are never pruned. Per-skill `uses` and `wins`. |
| Cold-start SFT and GRPO | **Not taken.** No GPU, no trainable model, and the local-only rule. The prompt-time half of the paper is the half that works without weights. |
| Cloud teacher (o3) | **Not taken by default.** The paper's own self-distillation result says the local ladder can be the teacher. Any hosted teacher would need an explicit opt-in that breaks `localOnly`. |
| Real-time updates | **Not taken.** Proposals wait for a person, which is also the house rule. |

### Where it differs from the paper on purpose

- **The reward is a person.** The paper uses a binary task-success reward. Here the signal is the person's own action on a proposal: accept (success), edit then accept (failure, severity 1 with the corrected value), reject (severity 2), roll back by guard (severity 3). No reward model is needed.
- **Evolution is never automatic.** New skills arrive as `proposed`. A person accepts, edits or retires them. This keeps the BIMBY rule "doubt becomes keys, never destroy". A skill can only change a prompt, never a write, so the approval gate and `guard.ts` are unchanged.
- **Hand-written skills come first.** Hand seeds are what the Blueprint ships. Distilled ones are added on top and can be cleared without touching the seeds.

## 3. How each piece maps to code

```
person acts on a proposal
        │
        ▼
lib/skills/experience.ts   Experience { category, input, chose, should, outcome, severity, skillsUsed }
        │
        ├── credit: bank.recordUse(skillsUsed, won)           (per-skill uses / wins)
        │
        ▼
lib/skills/evolve.ts       weakCategories → sampleFailures → proposals
        │                  deterministic: distill.lessonOf
        │                  with a model:  distill.distillWithModel (local ladder)
        ▼
Skill { status: "proposed" }  →  person: accept / edit / retire
        │
        ▼
lib/skills/bank.ts         retrieveSkills(query) → renderSkills → prompt block
        │
        ▼
lib/tracking-helper/wire.ts  systemText(flow, skillText)   (listed on the Trace as skillsUsed)
```

`Blueprint.skills` (`lib/agents/blueprint.ts`) carries the **seed** skills each agent ships with. Saved, learned skills live in the per-device bank keyed by agent id, the same way the Helper's flow copy and the Lists chat history are kept.

## 4. Tracking Helper: what the skills say

The Helper's one model call turns tagged text into segments. Its known weak spots are the ones the existing prompt already patches line by line (`WIRE_SYSTEM`): which tag is an end versus a "maybe" end, vague edges, never inventing a place, skipping padding. Seed general skills restate those as short principles. Task skills are expected to arrive from real corrections, filed under categories like `wire:end-vs-maybe`, `wire:vague-edge`, `wire:place`, `wire:activity-name`.

## 5. Lists BIMBY: what the skills say

The Lists BIMBY has no model. Its "skills" are the rules the code grammar already keeps (a name that fits two things is asked about, never guessed; a bulk write has a cap; only a merge removes items). Written as skills they appear in the Blueprint, so the lab shows them and an evaluator can check each against a recorded line. When the free-form tool-picking model from `docs/BIMBY_IDEAS.md` lands, these become its prompt, and corrections ("Book stays, Task goes" picked over the top key) become task skills through the same loop.

## 6. Ties to the BIMBY ideas

- **Swarm vote (`docs/BIMBY_IDEAS.md` §1).** The pairs (original line, line the person picked) are the same data as a failure lesson. They feed `Experience.should`.
- **Confidence (§2).** A skill hit with `wins / uses` under a threshold is a low-confidence signal. Per-category success rate is the "right when confident" number the evals page wants.
- **Evals (plan slice 5).** Replay recorded lines with and without `renderSkills` to repeat the paper's "no skill library" ablation locally.

## 7. Open questions and Planned work

**Planned**

- Local embeddings for retrieval, compared with the lexical scorer on recorded lines.
- A review surface in the labs: proposed skills as keys (accept, edit, retire) with the trace that produced each.
- Recording experiences from the Lists BIMBY session (plan approved, cancelled, interrupted, undone).
- A `skills` node for BIM flows (a `remember` role) so a flow can ask for skills as context.
- The with/without-skills replay as an eval in the Agent Lab.
- A pruning pass that retires skills with many uses and a low win rate.

**To settle by experiment**

| Question | How |
|---|---|
| Does a skill block beat one more example in the prompt? | A/B on recorded Helper lines, token cost against accuracy |
| Best K and threshold for lexical retrieval | Sweep on recorded lines |
| Is a local model good enough to distill? | Compare `lessonOf` text with `distillWithModel` text on the same experiences |
| When does the bank get noisy? | Track retrieval hit rate against bank size past 50 skills |
