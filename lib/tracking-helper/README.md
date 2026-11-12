# `lib/tracking-helper/` — the Tracking BIMBY's pipelines

_Last mapped: 2026-11-07_

The Tracking BIMBY (formerly the Tracking Helper; file, route and id names stay `tracking-helper`) has two built pipelines, each also a tool of the whole agent: **description to timeblock** (`## The flow` below) and **generate gap questions** (`gaps.ts`). Planned: gap readings (`docs/BIMBY_IDEAS.md` §10.4) and account to other kinds (intake, mood, company).

The second place a model meets Brain2, after BIM chat. A chat bot for one job: turn an
account of a day ("on Friday I walked Ocean Beach from about 4:30 …") into proposed
Activity and Location blocks. Pure code except one model call. Plan and reasoning:
[`docs/TRACKING_HELPER.md`](../../docs/TRACKING_HELPER.md). The dialog is
[`components/Home/Tracking/helper/`](../../components/Home/Tracking/helper/README.md). The bench is
[`components/Lab/TrackingHelper/`](../../components/Lab/TrackingHelper/README.md); its Blueprint (`lib/agents/adapters/tracking-helper.ts`) is read-only.

## The flow

`ROUTE (code) → TOKENIZE (code) → WIRE (one model call) → PLACE (code) → WHERE (code)`

1. **ROUTE** (`run.ts` `routeOf`). `log`, `revise` (a correction while blocks are on screen: the earlier
   account is re-read with `Correction: …` after it, so later words win), or `question` (answered with a
   fixed line, no model). Two editable regexes in the flow.
2. **TOKENIZE** (`tokens.ts`). Every day word, clock and length becomes a tag in the text: `4:30[T1]`,
   `Friday[D1]`, `20 minutes[U1]`. Hedge words ("ish", "around", "maybe") and strong words ("for sure",
   "exactly") near a clock set its `cue`. A time restated with a strong word makes every mention of that
   time firm.
3. **WIRE** (`wire.ts`). One schema-bound call. The model says, per thing done, which tag starts it, which
   ends it, its activity, a stated place, who was `with` them, their `mood`, short notes, and whether an edge is vague. Every tag field is an
   enum of the tags that exist plus `""`, so it cannot name a time that was not written. With no model,
   `wireByRules` reads the same tags with plain rules.
4. **PLACE** (`assemble.ts`, `clock.ts`). All the arithmetic, in code:
   - days: `resolveDay` ("Friday" is the latest Friday; "october 31st" this year's unless still ahead);
   - clocks by **continuity**: an unmarked clock is the earliest reading not before the clock before it,
     reset at each day word (4:30, 5, 5:55, 6:19, 7:19 climb through the evening with no hint);
   - certainty from the words (`certOf`); the model may soften an edge, never firm one; a dash joins a
     range so "6:30 - 7:19 ish" is estimated at both ends;
   - **chaining**: no start → where the block before ended; no end → where the next begins, with that edge's
     certainty;
   - **orphan clocks** (`adoptOrphans`): a clock the model left unused, between its neighbours' clocks, is
     given to the entry that lacks a start or end ("by 6:22 the trash stuff was done");
   - **untimed entries**: an entry with only a length ("walked for 5 hours") takes the neighbour's edge and counts back or forward by the length; one with no time at all ("then I got ice cream") starts where the one before ended. Both edges are estimated. Only an entry with no neighbour to lean on is `unplaced`;
   - **overnight**: an end that reads earlier than its start ("from 9 until about 6am") ends the next day (`endMin` past 1440, written as one entry per day), when the block is 16 hours or less; before, it was dropped and became a 30 minute stand-in;
   - **sleep** (`sleep.ts`): code reads bed and wake clocks by the word before them (after woke/got up: morning; after bed/slept: 6–11 PM, 12 midnight, 1–5 AM; "slept from 10 to 6" takes the second as the wake; written am/pm wins) and, with both, builds the `sleeping` block itself, replacing the model's sleep entry. The small model once filed "woke at 1:30 am after bed yesterday around 9" as 9 AM to 9:05 AM. With one clock, only its reading is fixed;
   - **stand-ins**: a start with no end gets `openMin` (30) minutes, estimated, flagged `openEnd`.
5. **WHERE** (`places.ts`). A stated place is matched to a Location pen. A missing place is **learned from the
   person's own history** (the place that overlapped this activity on past days, at least 2 sightings and 60%),
   else Home for a chore (`assumed`). Each place carries its `source` so the card says how sure it is.

## Generate gap questions pipeline (`gaps.ts`)

`WINDOW → MEASURE → FIND → ASK`, all code, no model, writes nothing. `runGapQuestions(entries, now, dates)`; `dates` default to the past 7 days ending today (`pastDates`), not the days since Monday.

1. **WINDOW.** Each day's awake time: the day minus its Sleep blocks, else 07:00–23:00. Today stops at now; future days have none.
2. **MEASURE.** The share of awake time covered by Activity, Location and Company, per day and for the week, plus food entries (intake instants with `intakeClass: "food"`).
3. **FIND.** Gaps: an Activity hole of 60 minutes or more; a Location or Company hole of 60 minutes or more inside time where Activity is tracked (at least 2 h that day); a stretch of 6 hours awake with no food entry on a day Activity is tracked. Thresholds are `GAP_DEFAULTS`.
4. **ASK.** One question per gap, largest first, up to 8. Each has a `reason` and, for Activity, Location and Company, a `seed` (“On Tuesday from 1:10 pm to 4:40 pm I ”) to finish and send to the timeblock pipeline. Food has no seed yet: that pipeline files no food.

## Why it is cheap

One call per message, about 40 output tokens per activity, schema-capped. The model never does time math. Identical
prompts are answered from `ollamaCall`'s memory. The ladder starts at the crew's `extract` rung and climbs only on an
empty answer. Questions, corrections' routing, clocks, days, certainty, chaining, pens and places cost nothing.

## Files

| File | Role |
|------|------|
| `types.ts` | `Token`, `WiredSegment`/`Wiring` (the model's shape), `ProposedBlock`, `HelperContext`, `TraceStage` |
| `tokens.ts` | `tokenize`: days, clocks, lengths, hedge/strong cues, the marked text |
| `clock.ts` | `resolveDay`, `placeClocks` (continuity), `clockText`, `parseTyped` |
| `places.ts` | `matchPen`, `learnedPlace`, `resolvePlace` |
| `wire.ts` | `wireSchema`, `systemText(flow, skills?)`, `wire` (ladder via `escalate`), `wireByRules`, `cleanWiring` |
| `count.ts` | `readTagWords`, `readHabit`, `readCounts`: tags and the daily habit a block counts for, read from the words in code |
| `sleep.ts` | `readSleep`, `withSleep`: bed/wake clocks and the sleep block, in code |
| `assemble.ts` | `assemble`, `adoptOrphans`: wiring → `ProposedBlock[]` |
| `gaps.ts` | `runGapQuestions`, `pastDates`, `windowFor`, `GAP_DEFAULTS`: the gap questions pipeline |
| `flow.ts` | `HelperFlow` (editable prompts, routes, ladder, defaults), `starterFlow`, `loadFlow`/`saveFlow` (`trackinghelper-flow-v1`), `TRACKING_HELPER_REV` |
| `run.ts` | `runHelper`: route, stages, trace. Takes an optional skill `bank`; the skills that fit ride in the WIRE prompt and come back as `skillsUsed` |
| `learn.ts` | What a reaction teaches: `reactionsOfAdd` (block as proposed vs as added), `reactionOfDismiss`, `reactionOfCorrection`. Pure. |
| `accept.ts` | `buildContext` (pens + 180 days of history), `conflictsOf`, `acceptBlocks` (one undo step) |
| `store.ts` | `useTrackingHelper`: chat lines, proposals, per-card decisions (`trackinghelper-chat-v1`) |
| `open.ts` | `openTrackingHelper`, `useHelperOpenRequest`: go to Home → Tracking and open the chat |
| `tests.ts` | Shared test cases (`SHIPPED_TESTS`), `replay`, `compare`; user cases in `trackinghelper-tests-v1` |
| `learn.test.ts` | Reactions, and learned skills reaching the WIRE prompt |
| `tracking-helper.test.ts`, `accept.test.ts` | Unit tests, including the 7-block Friday account and two slips the live 14B made |

## Skills (from SkillRL)

_Last mapped: 2026-11-02_ The Helper learns from what the person does with its blocks (`lib/skills/`, research in
[`docs/SKILLRL_RESEARCH.md`](../../docs/SKILLRL_RESEARCH.md)). On Add, each block is compared with the block as
proposed (`HelperLine.proposed`): unchanged is a success for activity, edges and place; a changed value is a
failure that carries the corrected value. A dismissed block and a revise line are failures too. Rows go to the
per-device log `skillexp:tracking-helper`. Skills never touch a write: they only add a block to the WIRE prompt.
The shipped seeds (`TRACKING_HELPER_SKILLS`) restate `WIRE_SYSTEM`, so only learned skills (`source` not `hand`)
are put in the prompt, and an empty bank leaves the prompt byte for byte as it was. Review and the evolve key live in the lab's Skills panel.

_2026-11-11:_ **Neutral** (beside Add; `add(lineId, ids, force, "ok")`) writes the same blocks. `reactionsOfAdd` then
records an untouched aspect as `neutral` instead of a success, and a changed one as a failure as before. The line
keeps `grades[blockId] = "ok"`. See "Neutral accept" in `components/Bim/README.md`.

## Tags and the daily habit

_Last mapped: 2026-11-07_ "…should also be tagged music and count for the daily habit" is read in code (`count.ts`, after PLACE, no model). `tagged X` gives `ProposedBlock.tags`. A habit is proposed only when the words ask ("count as/for …", "daily habit"): the words after "count as" are scored against the daily habits with the Habits BIMBY's lexicon; a tie or no hit proposes nothing. The card shows tags (editable) and "Counts for habit: X" with a remove key. On Add, the tag names become Tracking tags (made if new) and go on the Activity row's `tagIds`; the habit's Tracking tags go there too, so the existing sync (`lib/habit-tracking-sync.ts`) credits the minutes. A habit with no link yet gets one (`trackingLink`) on a tag named for the habit, shown as "(will link)". The model's note "music, daily habit" is dropped from the notes.

## Add does not block the screen

`useTrackingHelper.add` returns at once. It marks the blocks `adding`, waits one paint (the card shows a loading bar), then writes inside `deferSyncs`, so habit and pen syncs run after the next paint instead of inside the write. The write lives in the store, not the card: scrolling, clicking elsewhere or leaving the tab does not stop it, and the result is kept in `msgs`. **Planned:** chunk a very large "Add all" per block if the syncs still stall.

## Writes

`acceptBlocks` paints an Activity row and, with a place, a Location row over the same span through
`layerEntries`, inside `runAsAction` and `withItemWriteSource({ surface: "tracking-helper" })`. Rows are
`generatedBy: { kind: "llm", id: "tracking-helper:<id>" }` (place: `…:place`), so they may overlap other LLM
blocks and can be swept. Notes begin "Created from Tracking helper." and keep the person's sentence, the
edges and how each was reached. A guessed edge is stored as `startCertainty`/`endCertainty` `estimated`. The block itself is never marked assumed (`precision`) by Add; only the person flips that. Time painted by hand refuses the
block unless the person presses **Add anyway**.

## Changing the shipped flow

Edit `starterFlow` / `WIRE_SYSTEM` / `WIRE_EXAMPLES` in `flow.ts` and bump `TRACKING_HELPER_REV`. A browser
with an older saved copy gets the new one; its own is kept under `trackinghelper-flow-v1:backup:<old rev>`.

## Planned

- Express the flow as a BIM flow graph (`lib/bim-flow`) once the engine can return a list from an extract.
- Keep every lab run (like `run-history.ts`), and the person's verdicts as few-shot examples.
- A `drive` proposal when the account says a task was resisted (`lib/bim-flow/drive.ts`).
- Other kinds from one account: intake, mood, company, a person.
- Phone: the same chat on iPhone through the `/api/ollama` proxy (`chat-models.ts` already routes it).
