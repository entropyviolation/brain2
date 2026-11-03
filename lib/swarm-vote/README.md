# `lib/swarm-vote/` — The swarm vote

_Last mapped: 2026-11-02_

A reusable shape for any **BIMBY** with a closed tool list: ask several small models the same line, each returns a
**ranked list** of tools, and code merges the rankings. The swarm picks what to show and never writes. Plan and
research: [`docs/BIMBY_IDEAS.md`](../../docs/BIMBY_IDEAS.md) §1. Lab: `/lab/swarm-vote`
(`components/Lab/SwarmVote/SwarmVoteLab.tsx`), which votes on the Lists BIMBY's tools using installed Ollama models.

## What is built

- **Ballots.** `cleanBallot` drops anything off the closed list and repeats. A voter carries a `family` and an
  optional `weight` (default 1; weighting is an experiment, not a default).
- **Tally.** `tally` merges by Borda count. It also reports `agreement` (share of voters whose first pick won),
  `margin` (winner over runner-up) and `families`. `verdict` is `clear` (go to the plan), `split` (reword and keys)
  or `empty` (ask the person). `survivors` are the actions listed by at least half the voters.
- **Run.** `runSwarm` calls all voters in parallel with one ranking schema. A hard `timeoutMs` votes with whoever
  answered; a voter that throws is dropped and named in `missed`. `stopEarly` ends the wait when the first-place lead
  is larger than the ballots still out (`earlyStop`).

- **Reword.** `rewordSplit` runs only on a `split` verdict: one mid-model call turns the surviving actions into one
  imperative sentence each (`cleanKeys` keeps only listed actions, one per action; a missing one falls back to the
  action name, as does a thrown call or no model). The lab shows each as a key; a click puts the sentence back in the
  line box, so a pick is an ordinary new line through the code grammar. `clear` and `empty` return no keys.
- **Replay bench.** `collect` asks live voters once per labelled `Case` and keeps the ballots; `sweep` (pure) replays
  them at 1, 3, 5, 10, 20 voters, either `copies` (in answer order) or `mixed` (round-robin across families), and reports
  Borda accuracy, plurality accuracy, how often the vote was `clear`, and how often a `clear` vote was right. The lab
  has six hand-labelled lines in `SwarmVoteLab.tsx`; add recorded lines there.

## Why

Sampling many answers and voting raises accuracy; agreement tracks correctness; errors within one model family are
correlated, so mixed voters beat copies; open-ended text gains little. See the table in `BIMBY_IDEAS.md` §1 for
sources and what each changed here.

## Planned

Feeding the bench from the person's recorded lines and their picks (the pairs in §1 step 5); the skip-reword rule
tuned on the bench; logprob confidence (§2); slot-by-slot voting; a Blueprint stage
for the Lists BIMBY and the Plan BIMBY once they pick tools with a model.

## Files

- `types.ts`: `Voter`, `Ballot`, `Standing`, `Tally`.
- `tally.ts`: `cleanBallot`, `tally`, `survivors`, `earlyStop`.
- `run.ts`: `runSwarm`, `rankingSchema`.
- `reword.ts`: `rewordSplit`, `cleanKeys`, `rewordSchema`.
- `bench.ts`: `collect`, `subset`, `sweep`.
- `swarm-vote.test.ts`.
