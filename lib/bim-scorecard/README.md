# `lib/bim-scorecard/` — BIM chat scored on real lines

_Last mapped: 2026-11-21_

Replays labelled lines through the real BIM chat turn and scores each one. It is the bench of
`lib/agents/bench.ts` (`runSuite`, `scorecardOf`, `compareCards`) pointed at `sendToBim`, not a new
framework. Why: `docs/BIM_CHAT_USAGE.md` (the usage map) and its step 3 fixes 1, 5 and 6.

## What a line is scored on

- **Lane right.** BIM took the line the way the person meant. The observed lane comes from the route chip,
  the cards and the writes (`observedLane` in `score.ts`). Near lanes count (`ACCEPTS`): a dream filed as a
  log, a Brain2 idea put on To Do.
- **Action right.** It also did the thing: a To Do sharing words with the line, an answer that is not "I
  don't know", a log that was written. For other lanes it equals lane right.
- **No invented write.** Nothing went to a room the line did not ask for. A plain log or an unsorted Inbox
  capture is a fallback, not an invention. A mood set from "grocery list: …" is one.
- **Time per stage**, from the turn's Trace (`stagesOf`): the code lanes, the crew check, the router, the
  Ask or chat lane, the executor's write, the follow-through read, the cues, every model call with
  Ollama's own load time. Stages nest, so they do not add up to the turn.

Each line starts from the same stores (`reset`), so it is scored alone. Lines that lean on the line
before (a bare "2", "skip") are scored without it. Photo lines are left out; a text replay has no photo.

## Files

| File | Role |
|---|---|
| `score.ts` | `observedLane`, `ACCEPTS`, `scoreLine`, `stagesOf`. Pure |
| `replay.ts` | `replayLine` (one line through `sendToBim`, origin `eval`), `replayLines` (all of them as three bench scorecards: lane, action, clean). Runs in vitest (jsdom) |
| `card.ts` | `summarize` (the saved record), `diffRuns` (gained / lost per check, by `compareCards`), `formatCard` (the printout). Pure |
| `fixture.ts` | 40 paraphrased lines in the shape of the real ones, for CI. No names, places or private details |
| `real-lines.test.ts` | CI: the fixture, code only, against `FLOOR`. A drop fails the build. Raise the floor when a fix lands |
| `real-lines.live.test.ts` | Opt-in (`BIM_SCORECARD=1`): the real labelled lines, the person's vault copy, code only and optionally LLM on; saves and compares |

## Running it

```bash
npm run bim:scorecard
```

That is code only, on `data/bim-log-export/real-lines.labelled.jsonl` (gitignored), with the hub's vault
copy `data/shared-persist.json` loaded into the stores. Nothing is written back; the web, the texts hub and
the flow archive are cut off during the run. Options (`scripts/bim-scorecard.mjs`):

- `--llm` adds the live run on this Mac's Ollama with the chat crew. Each crew model is loaded once first;
  that load time is printed apart from the run.
- `--llm-only` runs the live variant alone.
- `--cold` skips the warm-up, so a cold load shows inside the turns.
- `--limit N`, `--lanes track,todo`, `--no-vault`, `--file path`.

The card is saved as `data/bim-scorecards/<date>-<variant>.json` and printed with what was gained and lost
since the last card of the same variant and the same lines. The full code-only run takes about 10 minutes:
each line resets a 35 MB vault.

## Baseline (2026-11-21)

See `docs/BIM_CHAT_USAGE.md` §9 for the numbers per lane and the stage breakdown.

**Planned:** a Tests-sheet view of the saved cards; replaying a day in order so context lines are scored with
the line before; a CI floor per lane; the iPhone transcript once it is exported.
