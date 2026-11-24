# Thought patterns

_Last mapped: 2026-11-24_

A thought pattern is a shape that recurs in how you think and say things. BIM reads them from what you write, keeps every read in a ledger, and asks you to confirm each one. The counts over time are the point: they are the data later screens and BIMBIES read. A pattern is an observation, never a diagnosis.

## Patterns

| Id | Name | Read from |
|----|------|-----------|
| `overwhelm` | Overwhelm | "so many things", "too much", "overwhelmed", or the same short sentence twice in a row |
| `urgency-stack` | Urgency stack | two or more of ASAP, !!!, right now, urgent in one message |
| `should` | Should | "I definitely should be", "at my age", "I'm supposed to be" |
| `permission` | Permission | "allowing myself", "letting myself", "I'm allowed" |
| `substance-credit` | Substance credit | a drug or caffeine word with "effect", "because", "makes me" |
| `scarcity` | Scarcity | "one of my last", "only 3 left", "running low" |
| `deferral` | Deferral | "figure out", "whatever", "at some point" |
| `money-gate` | Money gate | "need 2.5", "less cash", "can't afford" |
| `self-kindness` | Self-kindness | "<3", "proud of myself", "go easy on" |
| `recurring-intention` | Recurring intention | a plan said on two or more earlier days (`lib/dump-bimby/match.ts`) |

## Files

| File | Role |
|------|------|
| `patterns.ts` | Pure. `PATTERNS` (name and meaning), `readPatterns(text)` (one hit per pattern, with the words), `sentences` |
| `store.ts` | `useThoughtPatternStore` (`brain2-thought-patterns`, in the vault, newest 2000). Each read is `proposed`; Accept on the card makes it `confirmed`, Reject `rejected`. `summarize` counts per pattern over N days, rejected reads left out. `parsePatternAsk` and `patternSummaryText` answer "what are my thought patterns?" in BIM chat |

Only the Dump BIMBY writes reads today (`source: "bim-dump"`).

**Planned:** reads from every BIM line, the Day Log and journal, not only dumps; a Thought patterns screen with counts per week and the quotes; patterns tied to what happened next (did the urgent plan get done, how the day went), from the follow-through ledger; learned phrasings from confirmed reads.
