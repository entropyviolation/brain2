# Before BIMBY

_Last mapped: 2026-11-24_

A deadline is often an event, not a clock: "before Elijah gets home". Before this BIMBY, BIM chat lost those lines. "What I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready (45 minutes)." went to Inbox as one item, without the event. "what do i have to do before elijah gets home" had no "?", so when the router timed out it was logged. The time question was answered only by the model, and never with the list. Code only, no model: it answers at once with LLM on or off.

## What it reads

| You say | BIM does |
|---------|----------|
| "what I absolutely need to do before Elijah gets back: clean the house amap, shower and get ready (45 minutes)" | Each thing goes on To Do today, marked Required for the day, with the note `Before Elijah gets home.`. It is due by the event's clock when one was said today, and carries the minutes said. "amap" / "asap" raise priority. A thing that is already an open task updates that task instead of making a twin. One undo step |
| "before elijah gets home I need to change the sheets and put clothes away", "need to clean the house before elijah gets home" | Same |
| "Elijah gets home at 2pm" (a bare statement, when tasks were filed for it today) | Those tasks become due by 2pm |
| "what do i have to do before elijah gets home" (with or without "?") | The time left, when a clock was said today, then every thing said today: required ones numbered, "best case" ones under **If time**, finished ones under **Done**, and the minutes you gave against the minutes left |
| "how many minutes until elijah gets back?", "… and what do i have to do in the minutes" | Same answer. With no clock said, the line goes on to the router, and the list is added under the model's answer (or under the failed-lookup line) |

The event is an `Anchor`: subject plus what it does, folded so "gets back", "comes home" and "gets home" are one key (`elijah:home`). The list is read from two places, so a thing filed somewhere else is still found. First, tasks whose notes carry the event's note, or whose title says "before Elijah". Second, every line you sent today that names the event, read with `readMentions`. That covers a brain dump's sentence ("now im going to have to clean house before 2pmish when Elijah gets home") and the list sentences after it ("Bare minimum - …", "Best case maybe …"). Each line-read thing is matched to today's tasks by words in both directions, so a finished task shows as done.

The Dump BIMBY uses the same reads (`lib/dump-bimby/parse.ts`). A dump that names an event proposes each thing as `to do today: Change sheets by 2pm (before Elijah gets home)`.

## Flow

Lane `before` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), after `flight-file` and before `dump`. Skipped while a question is open. `withBefore` in `lib/ingest/bim-chat.ts` adds `beforeAppendix` under the router's answer and failed-lookup lines.

## Files

| File | Role |
|------|------|
| `parse.ts` (+ `.test.ts`) | Pure. `readAnchor`, `readAnchorClock` (a bare hour is the afternoon), `readItems`, `readFiling`, `readBeforeAsk`, `readMentions`, `spanWords`. Tests use the real lines from 2026-11-24 |
| `run.ts` (+ `.test.ts`) | `tryBefore` (the lane), `fileBefore` (the To Do writes), `itemsBefore`, `answerBefore`, `anchorClock`, `beforeAppendix`. The test replays the real morning |

## Limits

Rules only, and today only. An event said with no "before / until / till" ("when Elijah's home I want the house clean") is not read. A clock said only in a kept fact, not in a chat line, is not found. The live chat was not checked in the browser on 2026-11-24; the tests run the real messages.

**Planned:** read the event's clock from kept facts and Plan events too. Put the event itself on the day's Plan. The Passing BIMBY (`lib/passing-bimby/`) now notes the event and things said in passing ("spent a few hrs this morning building playlists") on the day's Tracking notes; turning those notes into Tracking blocks is still planned there.

Test: `npx vitest run lib/before-bimby`
