# LOG DOCS — the plan

_Last mapped: 2026-11-24_

Where Day Logs are going. What is built is in [`DAY_LOG.md`](DAY_LOG.md) and [`lib/day-log-bimby/README.md`](../lib/day-log-bimby/README.md). Everything below that is not built is marked **Planned**.

## The idea

Brain2 keeps a life in stores: Tracking rows, sleep, Health, texts, chat, plans. A **log** is the same life as a document a person can read, correct and keep. The two are one record in two forms:

- **Stores → log.** Every row becomes a line in the log, at its time, with its source.
- **Log → stores.** Every correction or addition in the log becomes a change to the rows, after the person accepts it.
- **Log → Brain2.** Logs are also data. BIM, the geniuses, Data and Home read them to answer, summarize and draw screens.

There is never a second truth. The stores hold the facts. The log holds the account of them, plus the person's own words, which win.

Logs nest by time: **Day Log → Week Log → Month Log → Season and Year Logs**, plus **span logs** for named stretches such as a trip ("New York Log"). A longer log is built from the shorter ones, not from raw rows again.

## 1. Log → Tracking: a correction changes the rows

**Built:** an amendment is kept word for word and rebuilds the log. It does not change Tracking.

**Planned:**

1. **An amendment proposes row changes.** "the call with mom was at 3, not 2" and "add: walked to the park ~6pm with Sam" go to the Tracking BIMBY (`lib/tracking-helper/`). Its `revise` route re-reads with `Correction: …`, and description-to-timeblock makes the blocks. The proposal shows as a card in the Day Log bar, with the same Accept / Neutral / Reject as the Report BIMBY card (`components/Bim/report-card.tsx`). Nothing changes until Accept.
2. **Accepted rows say where they came from.** `logSource: "day-log"` (a new `LogSource`). The amendment records which row ids it made or changed (`Amendment.appliedTo`) and shows as ✎ applied. The log rebuilds; the line it fixed now comes from the row, and the amendment stays as the person's words.
3. **Answering a gap fills it.** Section 12's gaps and questions get an answer box each. "What were you doing from 14:10 to 16:00?" → "library with Sam" → the same card, scoped to that stretch.
4. **Editing a line edits the row.** Each ledger row keeps the id of the row it came from (`Evidence.entryId`, plus the store it lives in). A hand edit to a line in the doc (a clock, a place, a name) is read back by diffing the doc against the last body written, and proposed as an edit to that row. Edits that touch only prose stay in the doc and are kept as a hand-edited copy, as today.
5. **Kinds beyond time blocks.** Mood ("I was anxious all morning" → mood rows), company, food (through the Food BIMBY), sleep ("went to bed at 1 actually" → the sleep log), places.

## 2. Tracking → Log: the log follows the rows within a minute

**Built:** today's log is rebuilt every hour, code only; yesterday is finished with the model after 04:00.

**Planned:**

1. **Dirty days.** A write to any store a Day Log reads marks that date dirty (subscribe to the stores, as `lib/start-hydrated-store-sync.ts` does). Dirty days are rebuilt by code within about a minute, debounced. The hourly tick stays as the backstop.
2. **Prose only where it changed.** Each narrative window keeps the hash of its ledger lines. A rebuild asks the model only for windows whose lines changed, and keeps the others. A small fix costs one call, not six.
3. **One writer.** The hub's window builds; other windows read. Records and the narrative cache move to the shared vault so every window shows the same version.

## 3. Seamless between the two

**Planned:**

- **Row → Tracking.** Each line's [E12] opens Tracking on that day with the block selected (an in-app link, `brain2://tracking/<date>#<entryId>`, handled by the Docs editor's link click).
- **Tracking → log.** The Tracking day view, Activity Log and the header now box get **Open Day Log** for the day on screen. The Day Log bar gets **Open in Tracking**.
- **Same day, everywhere.** Moving between days in one moves the other. Today each tab keeps its own day (Plan's is `components/Home/Plan/views/plan-period-nav.tsx`); this needs one shared selected day.
- **Live while open.** A rebuild while the doc is open reloads it unless you are typing (built), and marks the lines that changed since you last looked (**Planned**).

## 4. Period logs: week, month, season, year

_2026-11-24:_ **Week Logs are built** ([`lib/week-log-bimby/`](../lib/week-log-bimby/README.md)): folder, title and schedule as below, the seven days folded from each day's ledger and Day Log prose (not from a sidecar yet), one model call for the brief, the same bar and amend flow. Empty days are built anyway and listed as gaps. Month, Season and Year stay **Planned**. Each sits in its own folder under LOG DOCS:

| Log | Folder | Title | Built when |
| --- | --- | --- | --- |
| Week | `LOG DOCS/WEEK LOGS` | `WEEK LOG · 2026-W48 · Nov 23–29` | Monday 04:00, for the week before |
| Month | `LOG DOCS/MONTH LOGS` | `MONTH LOG · 2026-11 · November` | The 1st at 04:00 |
| Season | `LOG DOCS/SEASON LOGS` | `SEASON LOG · 2026 Fall` | When the season ends |
| Year | `LOG DOCS/YEAR LOGS` | `YEAR LOG · 2026` | Jan 1 |

Keys follow `lib/tracking-summaries.ts` (`weekSummaryKey`, `monthSummaryKeyFromDate`, `seasonSummaryKey`, `yearSummaryKey`), so a Week Log and the week's written summary and songs (`lib/period-summary.ts`) share one key.

**How a period log is built.** From the Day Logs, not raw rows. The local model has a 4,096-token context; a week of raw rows would not fit. Each Day Log's brief, totals and own-word lines are the input. A week is seven days; a month is four or five Week Logs; a year is twelve Month Logs. Totals (time per activity, places, people, calls, screen time, sleep, steps, kcal) are summed by code from the Day Logs' data (section 6), so they are exact.

**Sections.** The period in brief; at a glance (totals and averages, best and worst days); day by day (each day's brief, linked to its Day Log); places; people; screens; body; how I felt across it; in my own words (the strongest lines); plans and what got done; the period's summary and songs (from Data → Summary); gaps (days with little or no data); amendments.

**Amendments flow down** (**Planned**). An amendment to a Week Log that names a day ("Tuesday I was sick all day") is filed on that Day Log too, and offered as a Tracking change there.

## 5. Span logs: trips and named stretches

**Planned.** A **span log** covers any named stretch of days: a trip ("New York Log"), a project sprint, a hard week, an illness.

- **Folder** `LOG DOCS/TRIP LOGS` for trips, `LOG DOCS/SPAN LOGS` for the rest. Title `TRIP LOG · New York · 2026-11-02 → 11-09`.
- **Where spans come from:**
  - a Trip module item and its itinerary (`components/Modules/workspace/itinerary/`);
  - Flight items (`lib/flight-bimby/`): out and back flights bound a trip;
  - location: a run of days whose Location visits are far from home (the iPhone app's visits, `lib/ingest/gps-places.ts`), offered as "Looks like a trip: Nov 2–9, New York. Make a Trip Log?";
  - BIM chat: `new york log: nov 2–9`, `make a log for my sick week`.
- **Built when** the span ends, then refreshed when a day in it changes. A trip in progress has a live log.
- **Sections** as a period log, plus the plan against what happened (the itinerary's plan next to the days), the route (places in order), and the people met there.

## 6. Logs as data

**Planned.** Every log also has a data form, so Brain2 can read it without parsing the doc.

- **The sidecar.** Per log: the ledger rows (with `entryId` and source), totals, the narrative windows, questions, amendments (and what they applied to), and for period logs the child logs it was built from. Kept in IndexedDB beside the doc body (`lib/doc-persist.ts` pattern), keyed by log id, in the backup. The store record (`brain2-day-logs`) stays small and points at it.
- **Who reads it:**
  - **BIM chat and Ask.** "What did I do on Nov 3?", "when was I last in New York?", "how much did I sleep the week of the 20th?" read the log first: exact totals from the sidecar, the account from the prose, citations back to rows. `lib/bim-flow/vault-search.ts` gains a `logs` source; `lib/doc-retrieval/` indexes the prose.
  - **The geniuses** (`lib/geniuses/`) read their area through the week's log: days since the last step, how the week went in the person's words.
  - **Data → Summary** shows the Week and Month Log's at-a-glance beside the written summary, and drafts the summary from the log.
  - **Home.** "On this day" (a year ago, a month ago) from Day Logs; the current trip's log as a widget.
- **Screens drawn from logs.** A **Logs** view: a calendar of days shaded by how much is known, each opening its Day Log; weeks, months and trips as rows above. A trip page from its Trip Log: route, days, people, photos. These read the sidecars, not the stores, so they load fast and show the person's corrections.

## 7. Order of work

1. **Row ids in the ledger** (`Evidence.entryId`) and in-app links from [E12] to Tracking, and **Open Day Log** from Tracking. Small; makes everything else possible.
2. **Amendment → Tracking card** through the Tracking BIMBY, with `logSource: "day-log"` and `appliedTo`.
3. **Dirty-day rebuilds** and per-window prose reuse.
4. **The sidecar**, then BIM chat reading Day Logs.
5. **Week and Month Logs**, built from Day Log sidecars.
6. **Trip Logs**: from Flight items and trips first, then location-detected spans.
7. **Logs view**, On this day, trip page.
8. One writer; records and the cache in the shared vault.

## Open questions

- Should an accepted amendment remove its own line from section 13, or stay there marked applied? (Leaning: stay, marked applied, so the person's words are never lost.)
- A Week Log for a week with three empty days: build it anyway, with the empty days listed as gaps? (Leaning: yes.)
- How far apart may the edges of a trip be from the flights (late arrival, a day at an airport hotel)?
- Hand edits to prose in a period log: keep them as a copy, like Day Logs, or treat the period log as the person's to write once built?
