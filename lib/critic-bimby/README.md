# `lib/critic-bimby/` — The Critic BIMBY (the second look)

_Last mapped: 2026-11-02_

A BIMBY stage that reads the person's own words and a finished plan, and says what does not match. It never edits and never writes. Plan, papers and ship rule: [`docs/CRITIC_BIMBY_PLAN.md`](../../docs/CRITIC_BIMBY_PLAN.md).

**Built: C0 and C1 (the code layer, ledger and bench for the Plan BIMBY) and C2 (the model layer).** The Blueprint and a first lab page (C3: `/lab/critic-bimby`, a dry run, bench and ledger rates; a richer view), a second host (C4) and lessons (C5) are Planned.

## Flow

`planChecks` (free checks on the draft and the sentence) → `verdictOf` (pass, warn or fail) → `keysOf` (a key per fixable finding) → the confirm card (`components/Lab/PlanBimby/PlanBimbyPanel.tsx`) → `diffPlan` and `makeRecord` when the person starts or goes back → the ledger.

- **Certain** findings fail the plan: a length (`minutes`), a deadline or a pace note the person never said; an intake link on a thing never named; a flight link with no flight; a plan with no rows from a sentence that has tasks.
- **Hints** warn: a row sharing no word with the sentence, a clause of the sentence in no row (`dropped`, with the clause as the quote), rows out of spoken order, a weak unconfirmed task match.
- A fail draws a strip with one key per fixable finding (add the dropped task, remove the made-up row, clear the link). A key is an edit the person chose, run by code (`applyKey`). A warn is a chip on the row. "Start" and "Back" are always there.
- The ledger (`critic-ledger-v1`, newest 500, also sent to the disk archive as `critic-verdict`) keeps the line, the critique and what the person did. `classify` reads a record as a catch, a miss, a false alarm or unchanged. The person's action is the oracle.

## The model layer (C2)

`critiqueWithModel` (`run.ts`) runs the free checks first. A certain finding fails the plan and no model runs. Otherwise a model reads the line and the plan, only when it can help (`modelReason`: a doubt from the free checks, a rules read, four or more rows or any subtask, an unconfirmed task link), and only a model that passed the bench.

- **One call, one rung.** `escalate` over at most two rungs of the `critic` crew ladder (`lib/bim-flow/crew.ts`). It climbs when the model says `unsure`, or finds nothing where the free checks had a doubt. A 20 s cap (`maxMs`) falls back to the free checks. Any error does too.
- **Independent.** It prefers a rung that is not the planner's model (`draft.model`). With none, it runs on the same model, is marked `same-model`, and can only warn.
- **Quotes checked in code.** The schema (`prompt.ts`) makes each finding carry a `quote` from the line. `keepQuoted` drops any finding whose quote is not in the line, or has none. The model can only raise hints; only code is certain. Two model hints fail the plan, one warns.
- **Gate.** `gate.ts` keeps three dials (catch 0.6, false alarms 0.1, margin 0.15 over the free checks on faults only a model can see) and a per-device pass per host and model (`critic-ready-v1`, revision `GATE_REV`). `qualify.ts` runs the bench on one model and records the result. Nothing in the model layer runs for a model that has not passed.
- **Off by default.** The "Second look with a model" box on the Plan BIMBY composer (`critic-model-layer`) turns it on; "Check it" runs the bench for the first `critic` rung. When the model layer ran or was skipped, a quiet footer on the confirm card says why (`traceLines`).
- **Live bench.** `BIM_LIVE=1 npx vitest run lib/critic-bimby/bench.live.test.ts` runs the real models (`BIM_CRITIC_MODELS` to choose).

## Live bench, 2026-11-02 (five gold plans, 32 injected faults)

| Model | Faults caught | `wrong-object` | Clean plans flagged | Gate |
|-------|---------------|----------------|---------------------|------|
| `qwen3:30b-a3b` (153 s) | 30/32 | 3/5 (free checks: 0/5) | 1/5 ("with a feeling") | Not ready: false alarms 20%, dial is 10% |
| `qwen2.5:14b-instruct` (500 s) | 27/32 | 0/5 | 0/5 | Not ready: no gain over the free checks |

With five clean plans one false alarm is 20%, so the false-alarm dial cannot tell 10% from 20% yet. No model has passed, so the model layer stays off. Dials are unchanged.

## Bench

`bench.ts` runs a critic over the gold plans (should raise nothing) and over faults injected one at a time (`inject.ts`: drop a row, invent a row, swap order, change minutes, change a deadline, add a wrong intake link, and `wrong-object`: keep a word the person said and swap what it was done to, which the free checks cannot see and so the gate's margin is measured on). `bench.test.ts` prints the report. The gold set is five hand-written plans, so its numbers are optimistic. Real corrections in the ledger are the truth.

## Files

- `types.ts`: `Finding`, `Critique`, `CriticKey`, `PlanEdit`, `CriticRecord`.
- `checks-plan.ts`: `planChecks`, `minutesSaid`, `clausesOf`.
- `verdict.ts`: `verdictOf`, `keepQuoted` (for model findings, C2), `critiquePlan`.
- `keys.ts`: `keysOf`, `applyKey`.
- `diff.ts`: `diffPlan`.
- `ledger.ts`: `makeRecord`, `appendRecord`, `loadLedger`, `classify`, `rates`, `planHash`.
- `inject.ts`: `gold`, `faultsFor`. `bench.ts`: `GOLD`, `runBench`, `formatBench`.
- `prompt.ts`: `CRITIC_SCHEMA`, `CRITIC_SYSTEM`, `renderPlan`, `criticUser`, `findingsOf`. `run.ts`: `critiqueWithModel`, `modelReason`, `traceLines`. `gate.ts`: `DIALS`, `gateOf`, `recordGate`, `isReady`, `modelLayerOn`. `qualify.ts`: `qualifyModel`.
- `critic-bimby.test.ts`, `bench.test.ts`, `run.test.ts` (scripted models), `bench.live.test.ts` (opt-in).

## Planned

A Blueprint adapter and a lab view of per-host rates. A generic `CriticHost` and the Tracking Helper as host. Lessons from misses and false alarms through `lib/skills/`.
