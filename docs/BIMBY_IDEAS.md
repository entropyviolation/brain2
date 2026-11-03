# BIM and BIMBY ideas to try later

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
