# Stream BIMBY

_Last mapped: 2026-11-10_

Brain2's direction: a continuous stream of thought, minute by minute, on plans and exact actions, with BIM easing the job of getting it down. One BIM chat message that runs through a day ("8:17 hit dab pen", "8:17 - 9:15 doing dishes", "coffee at around 9:15 add to drinks tracking", "add to inbox: …", a pasted link, "gonna eat …", a feeling) becomes a **plan card** of filings. Each filing is one line the BIM executor already runs, so an accepted line lands in the same store as if typed. **Nothing is filed until Accept.**

## Model stage (LLM on)

_2026-11-10:_ with LLM on (the default), `llm.ts` asks the crew's extract ladder (`lib/bim-flow/chat-models.ts`, `crew.ts`) to list the filings: route, payload, 24-hour time, end (activity only), `est`, the source sentence, and a reason. The model never writes the grammar line; `lineFor` builds it, so there is one place for the executor's forms. Each answer is checked against the text:

- a route not on the list, an empty payload, or a `source` that is not in the text is dropped;
- a time that is not HH:MM is taken from the piece the source falls in;
- a link needs a web address in its payload; an activity takes its end from its window in the text, else it becomes a note; a leading count is dropped from a food or drink;
- every piece the model did not cover is filed by the rules (`withCoverage`), so nothing typed is dropped.

No model reachable, or none gives a usable answer in 300 s, means the rules read the stream, and the trace says so. The chat line and the card's route chip name the model used.

## Follow-through

_2026-11-09:_ the same read also fills the follow-through ledger (`lib/follow-through/README.md`): plans split into steps, actions, and feelings on their scales. `tryStream` starts that model read beside the filings read (`startFollowRead`) and, once the filings are known, calls `finishFollow`. Proposed plan-to-outcome links (LINK) and read feelings (FEEL) are added at the end of the card, and the chat reply ends with one gap question as tap choices. If that step fails, the filings card is unchanged and the trace says why.

## Flow

`sendToBim` (`lib/ingest/bim-chat.ts`) calls `tryStream` after the handoff, ask-back, and flight lanes (so a pasted booking is still a flight) and before the tell, fact, and report lanes. `looksLikeStream` is true for an "add to …" directive or three or more lines with two clocks. `tryStream` (`run.ts`) builds the plan, keeps it in `useReportStore` (`bimchat-reports`), and returns a chat line with `reportId`. The console and phone draw `components/Bim/report-card.tsx` under it, as for the Report BIMBY.

Accept on a `line` effect (`lib/report-bimby/apply.ts` → `apply.ts` here) sends the field `line` to `ingestIncomingAsync`. A line that would open a question is not left in chat: the question is dropped and the filing fails with the reason.

## Files

| File | Role |
|------|------|
| `parse.ts` | Pure, rules only. `segments` (lines, then sentences), `readClock` (24-hour; "1:57 pm" is 13:57; a bare 1–6 is afternoon; "since 817" only after since/at/around/from), `classify` (one piece → one filing), `buildStreamPlan` (the whole stream → `ReportPlan`). Tests: `parse.test.ts` |
| `apply.ts` | Accept for one `line` effect, through the executor |
| `llm.ts` | Model stage: `STREAM_SYSTEM`, `STREAM_SCHEMA`, `filingsFromModel` (the checks), `withCoverage` (rules backfill), `readWithModel` (crew ladder). Tests: `llm.test.ts` |
| `run.ts` | `tryStream` (async, takes `{ llm }`), the chat door. Writes only the plan to the store |

## Filing rules, in order

| Piece says | Filed as | Route label |
|------------|----------|-------------|
| `add to inbox: …` (or `add to shopping list: …`, `add to to do list - …`, `add to links - <url>`) | `inbox:` / `shopping:` / `to do today:` / the URL | Inbox, Shopping list, To Do today, Links |
| trailing `add to food / drinks / counts tracking` | `intake food:` / `intake drink:` / `log:` at the piece's time | Tracking food, drinks, counts |
| a link | the URL | Links |
| two clocks, `8:17 - 9:15 doing …` | `track: <activity> 08:17-09:15` | Tracking activity |
| `hit` / `once` / `again` with `dab pen` | `log: dab pen at 08:17` | Tracking counts |
| past `ate` / `drank` / `had` / `made` with a food or drink word | `intake food:` / `intake drink:` | Tracking food / drinks |
| all capitals, or starts "call / remind / buy …" | `to do today: …` | To Do today |
| future words (gonna, going to, maybe, then, will, need to …) | `note: planned: … at …`, kept with its time | Notes plan |
| a feeling word (proud, positive, happy, feel …) | `note: mood: … at …` | Notes mood |
| an activity with no end time | `note: …` (not guessed into a block) | Notes |
| nothing matched | `note: …` | Notes |

A piece with no time takes the time of the piece above it (`current`), or the send time when none is said yet. The card says which. A window's end becomes the time for the pieces after it. Identical lines are proposed once.

## Limits

Times are the ones the text states. A line with no clock inherits the one above it, which can be wrong when the stream is out of order; the card shows the reason, and the line is editable. The model's reasons are its own and can be wrong; each line is still a checked proposal. Cards are not undoable as one step: each accepted line is its own write.

_Live check (2026-11-10):_ `qwen2.5:14b-instruct` read the sample day in 180 s: 13 filings kept, none dropped, one piece backfilled. Its activities lost their end times and the samosa carried a count; both are fixed in the checks (tests cover them), but not re-run live. `qwen3:30b-a3b` has not been run.

**Planned:** one undo step for a whole accepted card; drug intake and phone-screen lines from a stream.

Test: `npx vitest run lib/stream-bimby` (the model call itself is not in tests; `llm.test.ts` covers the checks on its answers)
