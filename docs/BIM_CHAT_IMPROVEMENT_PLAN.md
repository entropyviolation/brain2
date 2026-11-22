# BIM chat improvement plan

_Last mapped: 2026-11-21_

The working plan to make BIM chat and the BIMBIES better, faster, more reliable and
self-improving. Any agent can pick up the next open step from here. Each step is its
own branch and its own PR into `main`. The owner merges. Never push to `main`.

Read first: `docs/BIM_CHAT_USAGE.md` (what the real logs show), then
`docs/BIM_CHAT_PLAN.md`, `docs/BIM_CHAT_SWITCHBOARD_PLAN.md`, `docs/BIMBY_IDEAS.md`,
`lib/ingest/README.md`, `components/Bim/README.md`.

## Status

| Step | What | Status |
|------|------|--------|
| 0 | Save, commit and push all uncommitted work | Done, on `main` (17cf876) |
| 1 | Read every BIM chat log, map how BIM is used | Done, `docs/BIM_CHAT_USAGE.md` (PR #56, on `main`) |
| 2 | Scorecard on real lines, stage timing per turn | Done, PR #57 (waiting for merge) |
| 3 | Fix the biggest failures, Telegram on the LLM path, many messages at once, learning loop | In progress |
| 4 | Widen the scenarios and the replies | **Planned** |
| 5 | Add the tools and BIMBIES the logs call for | **Planned** |

## Where the data lives

All of this is on the owner's Mac, under `~/brain2/data/` (gitignored). Never commit it.

- `data/bim-log-export/`: the export of every BIM log. `bim-chat.jsonl` (126 messages,
  Oct 30 to Nov 21), `telegram-feed.jsonl` (571 rows, Oct 14 to Nov 8),
  `bimby-chats.jsonl` (1,015 rows: ingest log, BIMBY chats, traces, verdicts),
  `flow-runs-summary.jsonl` (2,393 rows), the bench JSONs, `README.txt`, and
  `export.mjs` to re-run the export.
- `data/bim-log-export/real-lines.labelled.jsonl`: 514 labelled real lines. Each has
  `text`, `ts`, `source`, `expectedLane`, `expectedAction`, `notes`, `labelConfidence`,
  and what BIM did.
- `data/bim-scorecards/`: dated scorecards from `npm run bim:scorecard`.
- The BIM chat and BIMBY transcripts live only in the desktop app's localStorage. iPhone
  BIM chat stays on the phone and is not in the export.

The committed CI fixture is 41 paraphrased lines with made-up names. The repo is
public: paraphrase every example, no real names, places or private details.

## How to measure

- `npm run bim:scorecard`: replays the labelled lines through the real BIM chat path,
  saves a dated scorecard, and lists lines gained and lost since the last run.
- A vitest case runs the 41-line fixture with a floor, so CI fails on a drop.
- Each BIM chat turn records stage timings (router, lane, each model call, write, reply)
  and its real model call count in its Trace.
- Re-run the scorecard after every fix, and put before and after in the PR.

## Baselines (step 2, 508 real lines)

| | Right lane | No unwanted write |
|---|---|---|
| LLM off | 44% | 99% |
| LLM on | 32% | 98% |

- LLM on: p50 3.8 s, p95 27 s, worst 174 s. 21 turns over 30 s. About 2 model calls a turn.
- The NYC social line passes 0 of 6 social checks and finds 1 of 17 people.
- Slow turns come from model swapping. On a 32 GB Mac, the Stream BIMBY and Ask load
  `qwen3:30b-a3b`, which pushes the 3B and 14B out, and the next turn reloads them.

## Step 3: fix the biggest failures

In this order. One PR, re-scored after each item.

1. **Links are saved.** With LLM on, 42 of 72 bare reels went to the chat lane and were
   not saved. A bare link always files, whatever the router says.
2. **Keep the small models loaded.** Keep chat-path lanes off `qwen3:30b-a3b`. Keep the
   3B router loaded (`keep_alive`).
3. **Habits BIMBY with LLM off** calls no model. It took up to 33 s a turn.
4. **Statements are not questions.** "Spent $80 on …" went to Ask: 5 calls, about 45 s,
   then "I don't know". Money and activity statements file.
5. **Social lines that name many people.** Owner feedback, top priority. A long trip note
   naming about 17 friends and 2 new people became one note on one friend. It should:
   add every person, new ones too (how you know them, when you met, how you feel about
   them); store birthdays, the hangout, the event and its place, and moods; take the trip
   dates from flights or the knowledge graph; and ask follow-up questions (which show,
   who was there when, what you did). Scored on 6 checks in the fixture.
6. **Telegram on the LLM path.** Owner's ask. Telegram uses the same switchboard and the
   same LLM on/off setting and timeouts as BIM chat. Code routes first. Send a fast first
   reply, then edit it when the model finishes. Update the "never Telegram" line in
   `docs/BIM_CHAT_SWITCHBOARD_PLAN.md` and say why it changed.
7. **Many messages at once.** Owner's ask, BIM chat (desktop and iOS) and Telegram. The
   input never blocks. Each line is its own pending turn with its own reply, in send
   order. Code routes run at once; model turns run through a queue with bounded
   concurrency. No line is dropped, deduped or merged. Writes apply in send order. A
   failure marks only its own turn and can be retried. Test: 10 lines back to back give
   10 replies in order with no lost writes, plus a Telegram burst.
8. **The learning loop.** The owner resends instead of saying "no, …", so count a resend
   of a near-same line as "the first reply was wrong". Every correction, reject reason
   and resend becomes a taught example or skill the next run uses (`BIMBY_IDEAS.md` 8.1,
   `docs/SKILLRL_RESEARCH.md`). Check Ask answers in code (7.1).
9. **Wrong prefixes and pastes.** "grocery list:" asked for a mood, "Today I really
   need …" opened Today, "Stop feeling …" ran stop, "hi" dumped habits. A pasted recipe
   became 114 list items. See the usage map, section 5.

## Step 4: widen the scenarios and the replies

**Planned.** Owner's ask. Cover the lanes the usage map shows missing: activity and
day-stream lines ("starting dishes"), to-dos, intake, shopping and wants, habits in
words, feelings and venting, dreams, thoughts, photos, pastes. A code-only day-stream
grammar alone would have filed about 110 of the 201 plain logs. Each lane gets a real
reply: a short reaction, what was saved, and one or two follow-up questions where useful,
under a question budget. Each gets scorecard cases.

## Step 5: new tools and BIMBIES

**Planned.** Build what the logs show the owner reaching for. The list is in
`docs/BIM_CHAT_USAGE.md` sections 6 ("Asks to BIM itself") and 7 (fixes ranked).
Name each new one a BIMBY, give it a Blueprint in `lib/agents/`, and add it to `/info`.

## Rules for whoever picks this up

- Follow `CLAUDE.md`: update each touched folder's README, date changed sections, label
  unbuilt intent **Planned**.
- Own branch and PR per step. Never push to `main`. The owner merges.
- Never commit `data/`. Paraphrase every example from real logs.
- Re-run only failing tests while fixing. Run the scorecard before and after.
- Update the Status table above when a step changes.
