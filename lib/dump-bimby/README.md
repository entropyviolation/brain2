# Dump BIMBY

_Last mapped: 2026-11-24_

A brain dump is one long BIM chat message, with no clocks, that says many things at once: plans, a deadline, a dose, something on the way, a note to BIM about BIM, and feelings. Before this BIMBY, such a message went through every lane, past the grammar lane (which skips lines over 200 characters), and was logged whole as one line. Now it becomes a **plan card**. **Nothing is filed until Accept.**

## What the card proposes

| Read | Card row | Accept does |
|------|----------|-------------|
| A plan that an open task is already about ("book arkansas tickets", and a task "Arkansas tickets") | `amend` (AMEND) | Raises priority, puts it on today's To Do, sets a deadline when one was said, adds a dated note with the words. One undo step |
| A new plan said as ASAP, right now, or "before 2pm" | `line`: `to do today: Clean entire house by 2pm` | Files it through the executor |
| A new plan with no day | `line`: `inbox: Make a christmas list` | Same |
| A plan said before an event ("going to have to clean house before 2pmish when Elijah gets home"), and the list sentences after it ("Bare minimum - change sheets, …", "Best case …") | `line`: `to do today: Change sheets by 2pm (before Elijah gets home)`; a best-case thing adds `, if time` | Same. The reads are the Before BIMBY's (`lib/before-bimby/`), so "what do I have to do before Elijah gets home" finds them |
| A plan that waits on something ("need 2.5 and balls to call cap") | the plan, with `(needs 2.5 and balls first)` | Same |
| "send hannah and mary lou and emily shad mail" | one row per person | Same |
| "and lucas/shelby thank u note and necklace" right after a plan | takes that plan's verb ("Send …") | Same |
| A dose said in passing ("took one of my last ones", with the drug named in the sentence) | `line`: `intake drug: adderall` | Same |
| "elijah has a refill on the way" | `line`: `note: waiting on: …` | Same |
| Words to BIM about BIM ("you shouldn't log so much") | `line`: `brain2: BIM feedback: …` | Files it on the brain2 list, not your log |
| Everything else | one `log:` line | Optional. Reject it to keep only the plans |
| Each thought pattern (`lib/thought-patterns/`) | `pattern` (PATTERN), last on the card | Confirms it in the ledger, with your note. Reject marks it wrong |

The evidence for every plan is the sentence it came from. When you said the same plan on earlier days (BIM chat and Telegram lines, `lib/habit-helper/logs.ts`), the row says which days. Two or more earlier days is a **recurring intention**, which is also a thought pattern on the card.

## Flow

Lane `dump` in `CHAT_LANES` (`lib/ingest/bim-lanes.ts`), after `flight-file`, before the food, money, day and stream lanes, so a long dump is not taken by a lane that reads only one part of it. Skipped while a question is open. Code only, no model: it answers at once with LLM on or off. The same lane answers "what are my thought patterns?" (also "this week", "today") from the ledger.

`looksLikeDump`: 160 characters or more, fewer than two clocks, no "add to" (that is a stream), and at least two plan leads ("need to", "gotta", "have to", "must", …) or sentences that start with a step verb.

## Files

| File | Role |
|------|------|
| `parse.ts` (+ `.test.ts`) | Pure. `looksLikeDump`, `readDump`: sentences, then parts split before "and need to" / "also <verb>"; urgency (ASAP, !!!, right now, before a clock); a lone "ASAP!!!!" marks the plan before it; gates; one row per person; dose; on the way; feedback; the rest. The test uses the real dump from 2026-11-24 |
| `match.ts` | Pure. `matchTask` (content words, step verbs left out; a tie matches nothing), `priorMentions` (earlier days, one per day, the last 2 minutes left out) |
| `run.ts` (+ `.test.ts`) | `buildDumpPlan` (pure apart from ids) and `tryDump` (reads open tasks and earlier lines, keeps pattern reads as proposed, puts the plan in `useReportStore`) |
| `apply.ts` | Accept for `amend` and `pattern`; Reject for `pattern`. `line` rows use the Stream BIMBY's writer |

## Limits

Rules only. "Going to have to" is one lead (before 2026-11-24 it was read as "going to" and the plan was lost). A plan said with no lead and no step verb ("arkansas tickets!!") is not read as a plan; it goes to the log row. A plan that names a task in other words ("flights to arkansas" vs a task "Arkansas tickets") is not matched and becomes a new row. Names in a split are capitalized; names elsewhere stay as typed. The live chat was not checked in the browser on 2026-11-24 (the pane was hidden); the tests run the real message.

**Planned:** a model pass for phrasing the rules miss, checked against the text like the Stream BIMBY's; matching against follow-through steps and Plan events, not only tasks; a "done" read ("booked the arkansas tickets") that proposes closing the task; counting "only N left" into Inventory.

Test: `npx vitest run lib/dump-bimby`
