# lib/geniuses — baby animal friends with a higher goal

_Last mapped: 2026-11-24_

A **genius** is a baby animal friend bound to one area of your life: habits, money, one project. It takes a side, argues for the next step, listens to your reasons, and remembers. It is the superego (the ego ideal only, never the conscience) in `docs/GENIUSES.md`. It is not a BIMBY: it records nothing for you and calls no BIMBY. Lab: `/lab/geniuses` (`components/Lab/Geniuses/`).

## Files

| File | What it does |
|---|---|
| `types.ts` | `Genius`, `GeniusNote`, `GeniusTalk`, `TalkLine`, `GeniusReply`, `CouncilMeeting`, `CouncilAsk`, `CouncilReply`, `PromptId`. |
| `sanitize.ts` | Clamps anything from disk. Caps: 7 active (later ones rest), 200 notes, 60 talks of 12 lines, 60 meetings, 280-character lines and charter. `dropDangling` removes binding ids the vault lost. |
| `starters.ts` | Hearth (habits, hedgehog), Coin (money, raccoon), Muse (project, crow). Placeholders, unbound. |
| `read.ts` | `readArea`: what a genius sees of its area, pure. Items on a bound list, under a bound root, or serving a bound goal or objective; bound habits open or done today; bound goals' progress; done this week; days since the last done step. Secret items never enter. `areaLines` turns it into prompt lines. |
| `memory.ts` | `recall` and `memoryLines`: what it remembers, newest first. Notes (12), its last talks (3, with your last words and the outcome), the councils it sat in (3, with its ask and which area got the time). Never another genius's notes or talks. |
| `prompts.ts` | The three prompt templates (talk back, council ask, council answer) with `{{slots}}`, their JSON schemas, `fillPrompt`, `promptFor` (saved overrides first). |
| `reply.ts` | `checkReply`, `checkAsk`, `checkCouncilReply`: closed JSON, at most two sentences, no shame or pressure words, a valid stance, a smaller step for `split`, concede or reschedule on the sixth exchange. `scriptedReply`: the ladder that answers when the model is off, down, or fails a check. |
| `run.ts` | `geniusContext` (area read + memory + tone), `voicePrompt` / `askPrompt` / `councilReplyPrompt` (the exact text), `speak` / `councilAsk` / `councilAnswer` (ask the model through `lib/bim-flow/` `escalate` and `ollamaCall`, check, fall back). Each result carries the system and user text sent and the raw JSON. A prompt edited by hand is sent as written. |
| `store.ts` | `useGeniusesStore`, `brain2-geniuses`, v1: geniuses (with notes), talks, meetings, prompt overrides. In the full backup and shrink-guarded (`cogs-geniuses` in `lib/vault-guard.js`). Writes nothing outside itself. |
| `geniuses.test.ts` | Sanitize, area read, memory, prompts, checks, the script, and model runs with a fake call. |

## Memory

Three kinds, all in the store, all read back into the next prompt by `memory.ts`:

- **Notes**: what you told it on purpose ("Remember what I typed"), or a line the model offered to keep and you accepted ("picked up", shown marked). Long-term.
- **Talks**: each argument about one task, up to 12 lines, and how it ended (took it, declined, it conceded, moved). Short-term; the last three are recalled.
- **Council minutes**: each meeting's topic, every ask, every answer, your pick and your reason. A genius recalls its own ask and which area got the time.

## What is not built yet (**Planned**)

- The header friend speaking as a genius, and a reply box on the real mission sheet (GN-3, GN-5 UI).
- `FriendMission.geniusId` and the in-area picker (GN-2). The lab picks from the area read instead.
- The write cards: note on task, goal progress, child step, new time (GN-6). The lab shows what each would offer and writes only the genius's own note.
- Relationship levels (GN-4), new geniuses from Goals (GN-7), the Agents Blueprint and Trace (asks first: shared with the BIMBIES).
