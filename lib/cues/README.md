# `lib/cues/` — "Remind me if …"

_Last mapped: 2026-11-11_

A **cue** is a fact and the situation it should come back in. It is not a timed reminder (`lib/reminders.ts`): nothing fires on a clock.

"got 15$ off restaurant food on instacart remind me if im thinking about ordering food or if i need to order food" keeps the fact ("got 15$ off restaurant food on instacart") and the situation, reduced to its words (`order`, `food`).

## Matching

`matchCue` in `cue.ts`, code only.

- **yes**: every word of a condition is in the line, as itself or a word that means it ("should i doordash dinner?"). The cue is said.
- **maybe**: only part of the condition is there ("so hungry"), or the line reads as already done ("ordered food an hour ago"). With LLM on, BIM chat asks a small model one yes/no (`cueGatePrompt`). With it off, the cue stays quiet.
- **no**: nothing in common.

The word groups (`CONCEPTS`) are small on purpose. A wrong reminder is worse than a missed one.

A cue that was just said stays quiet for 30 minutes. It is never used up by being said: it ends when you say "used it" or "stop reminding me", or press stop on `/lab/finance-bimby`.

## Where it runs

`lib/ingest/bim-keep.ts` makes cues (BIM chat lane `keep`) and checks every BIM chat line against them after BIM has answered (`fireCues`, called from `sendToBim`). A cue whose fact is a discount is tied to a Financial BIMBY perk; closing one closes the other.

"what are you reminding me about?" lists them. "stop reminding me about the instacart discount" ends one by name.

## Files

- `cue.ts`: `parseCue`, `cueClauses`, `cueTokens`, `matchCue`, `cuesFor`, `cueGatePrompt`.
- `store.ts`: `useCueStore` (`brain2-cues`, in the vault).
- Tests: `lib/finance-bimby/finance-bimby.test.ts` ("cues"), `lib/ingest/bim-keep.test.ts`.

**Planned.** Checking Tracking log lines and Telegram, not only BIM chat. Places as a situation ("when I'm at Target"). An expiry date on a cue.
