# Follow-through

_Last mapped: 2026-11-09_

Every line of the stream becomes one of four linked records, and this module keeps the links between them honest. It sits on the Stream BIMBY (`lib/stream-bimby/README.md`): the stream is read into filings there, and into records here.

## The four records

| Record | What it is | Shape (`types.ts`) |
|--------|-----------|--------------------|
| Intention | Anything future tense, stamped with its minute, split into ordered steps. Each step has a hedge: `must` (need to), `will` (gonna), `maybe` (maybe, try to) | `Intention`, `Step` |
| Prospective feeling | Before a step, on separate scales: `excitement` (pull), `resistance` (push), `importance`. Both pull and push can be high | `Feeling` with `phase: "before"` and `stepId` |
| Action | What happened, at its minute: a block, a count, food, a drink | `Action` |
| Retroactive feeling | How one action sits afterwards: `satisfaction`, tied to the action, or kept with its own words when no action matches ("I woke up early") | `Feeling` with `phase: "after"` and `actionId` or `aboutWords` |

Every scale is 0–4 so one tap answers it. A blank is unknown, never zero.

A step carries its verdict, the plan-to-outcome link: `done`, `late`, `displaced`, `dropped`, `open`. An action no step predicted, after the day's first plan, is unplanned (`unplanned`).

## Standing

A record is saved when it is read, as `proposed`. It becomes `confirmed` by Accept on the card or by a one-tap answer, and `rejected` by Reject. **Findings count confirmed records only.** A rejected link is undone and that action is never proposed for that step again (`Step.refused`). The ledger is the only store this module writes (`brain2-follow-through`).

## Flow

1. `tryStream` (`lib/stream-bimby/run.ts`) calls `startFollowRead` beside the filings read, then `finishFollow` (`run.ts`).
2. `read.ts` reads the pieces by rules. With LLM on, `llm.ts` sends the model only the plan, feeling and "didn't" pieces, the day's actions, and the steps still open. The model splits steps, marks the scales (−1 = not stated), says what a feeling is about, and pairs open steps with actions. A step or an "about" whose words are not in the piece is dropped; a pair naming no real step or action is dropped. The model pairs only: code computes the delay and so `done` or `late`.
3. `link.ts` proposes verdicts. A step is matched to the action that carries at least half its content words ("ate" and "eat" are one word). `late` is more than 60 min per place in the plan's order (`LATE_AFTER_MIN`). An action up to 15 min before the plan line still answers it (`GRACE_MIN`), because a stream is typed a little out of order. "Didn't; ended up scrolling" is a displacement of the step it names, or the next open step. An open step is proposed as dropped after 2 days.
4. Each proposed link is a `verdict` effect (card label LINK) and each read feeling a `feeling` effect (FEEL) at the end of the stream's plan card. Accept goes through `lib/report-bimby/apply.ts` → `applyFollowEffect`.
5. The chat reply ends with one gap question as tap choices.

A plain chat line that is not a stream, a command or a question is read by rules alone (`observeLine`, called by `sendToBim` after the reply is built) and its gap asked the same way. Blocks already in Tracking's Activity view join the day's actions (`trackedActions`), so an accepted Report BIMBY block can fulfil a step.

_2026-11-11:_ a filed day plan (`lib/plan-bimby/README.md`, "Today") adds one intention with a step per thing, and its resistance and importance as confirmed "before" feelings. A row finished there adds the action and confirms the step `done`.

## Questions (`ask.ts`)

One at a time, in this order, each with Skip. A skipped gap is not asked again.

| When | Question | Tap sends |
|------|----------|-----------|
| A step was displaced and no reason given | What pulled you away from "…"? | `away: phone \| tidy` |
| A step has come up 3 times undone | What's in the way? | `in the way: dread \| call shelby` |
| A block ended in the last 3 hours with no feeling | How was …? | `after 3: walk` |
| A step of today's newest plan has no pull or push | how much do you want to? / how much resistance? | `pull 2: …`, `push 3: …` |

A scale read from the words ("I NEED TO I NEED TO" is resistance 3, importance 4) is not asked.

## Chat commands (`tryFollowCommand`)

| Line | Reply |
|------|-------|
| `day's end`, `follow-through`, `how did my plan go` | The plan next to what happened: each step, its verdict, unplanned actions, what was said afterwards |
| `findings`, `what have I learned` | Every finding with its count and days, plus how many proposed records are not counted |
| `mine follow-through` | Reads what the app already holds: your BIM chat lines, every stream and report message kept in `bimchat-reports`, and the Overcome BIMBY's resistance log (a resisted task becomes a `must` step with resistance 3, or 4 for dread). Rules only. Safe to run again |

## Findings (`learn.ts`)

Code counts; no model writes a finding. Each needs 3 cases (`MIN_CASES`) and says "not enough yet" below that.

- **Prediction error.** Steps resisted strongly (3–4) and then done: how many sat fine or better. Steps you were excited about: how many disappointed.
- **Resistance cost.** Per resistance band: steps done, and the median wait.
- **What displaces what.** `scroll → tidy (3)`.
- **Plan realism.** Share of steps finished per plan; morning plans on their own.
- **What sets up good days.** Days with a marker (a kind of action, a first action before 8:00, a good feeling about something) against days without, when the gap is 20 points or more.

Given back: `realismLine` on a new plan ("this 4-step plan is more like a 2-step day"), `dreadLine` on resistance 3+ ("the last 5 times …"), `dayEnd`.

## Analyses

`rows.ts` turns the ledger into the `follow-through` dataset (`lib/bim-flow/datasets.ts`): one row per step with its verdict as the source, one per unplanned action, one per free-standing feeling. Six built-in analyses read it (group "Follow-through" in `lib/bim-flow/analyses.ts`).

## Files

| File | Role |
|------|------|
| `types.ts` | The records, scales, verdicts, `hashId` (same text, same record) |
| `read.ts` | Pure rules: `splitSteps`, `hedgeOf`, `beforeFeeling`, `afterFeeling`, `displacementIn`, `readPieces`, `contentWords` / `overlap` |
| `link.ts` | Pure: `merge`, `proposeLinks`, `unplanned`, repeats, feelings tied to actions |
| `llm.ts` | Model stage: `FOLLOW_SYSTEM`, `FOLLOW_SCHEMA`, `followFromModel` (the checks), `readFollowWithModel` (crew extract ladder, 180 s) |
| `ask.ts` | Pure: `nextQuestion`, `readAnswer` |
| `learn.ts` | Pure: findings and what is given back |
| `rows.ts` | Pure: dataset rows |
| `store.ts` | `useFollowStore`, the ledger |
| `run.ts` | The doors: `startFollowRead`, `finishFollow`, `applyFollowEffect`, `rejectFollowEffect`, `tryFollowAnswer`, `tryFollowCommand`, `observeLine`, `mine` |

## Limits

The model stage has not been run live; tests cover the checks on its answers, not the call. Matching is by shared words, so "work on the app" will not find "BRAIN2". The rules know a fixed list of feeling words. A plan with several steps and one stated feeling does not say which step it is about, so that feeling is asked, not guessed. Findings are counts on your own confirmed records, not causes. A chat line read by `observeLine` shows no card; its links wait for the next stream card or `day's end`.

**Planned:** a screen for the ledger and findings (today they are chat replies and analyses); a timed check-in when a block ends, where now the question waits for your next message; Health and Screen Time rows as actions; a "Show the math" view of each finding; one tap per plan when its steps share a feeling.

Test: `npx vitest run --exclude '.claude/**' lib/follow-through`
