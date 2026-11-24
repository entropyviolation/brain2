# `lib/plan-bimby/` — The Plan BIMBY

_Last mapped: 2026-11-11_

A **BIMBY** (small, single-job sub-agent) that helps run a short-term plan. The person says it in one breath:
"Plan for rn: make more coffee, take another adderall, book ny flights (nowwww), then clean space for 15 min, then finish cds…".
It splits that into ordered tasks, asks the person to confirm and edit them, then turns them into a run list of play / pause / done rows.
It writes nothing until a row is played or finished. UI: `components/Lab/PlanBimby/PlanBimbyPanel.tsx`. It opens from three doors: route `/lab/plan-bimby`, the **Plan now** key on the Home Plan toolbar (`PlanBimbyDialog.tsx`), and the **Plan** tab of the iPhone shell (`MobileApp.tsx`). The panel is a chat shell: a header (chat icon, **PLAN BIMBY**, one key per kind of plan chat from `modes.ts`), a thread of bubbles (BIMBY greets, your words, BIMBY's confirm card or run list), and a composer pinned under it (Cmd/Ctrl-Enter sends; "Rules only" skips the model). **Right now** is built in the panel. **Today** is built as a BIM chat lane (see "Today" below); its panel key is still disabled. This week and Season are listed disabled for later. A new kind of plan chat adds a row to `modes.ts` and a thread in `PlanBimbyPanel.tsx`. Each row is dressed as a To Do task card (`plan-bimby.css` plus `task-card.css`: header strip, state lamp, house play / pause key, Done and Skip keycaps).

## Flow

SAY → SEGMENT (`parse.ts`, one model call) → LINK (`links.ts`, code) → SECOND LOOK (`lib/critic-bimby/`, code only) → CONFIRM (the person edits) → RUN (`run.ts`, `store.ts`) → EFFECTS (`apply.ts`).

- **Segment.** Schema-bound (`PLAN_SCHEMA`, `format` on Ollama) on the `extract` ladder, via `escalate`. It returns tasks in spoken order with `minutes`, `pace` (`urgent` / `steady` / `relaxed`), `paceNote` (their words), `subtasks` (each with `due` as spoken) and `remarks` (feelings and asides that are not tasks, shown so nothing is silently dropped). With no model, or when it finds nothing, `parseByRules` splits on commas, `then` and new lines.
- **Link.** `withLinks` fills `link` on items that have none, in this order: intake (`detectIntake`: a taking verb plus a known drink, drug or food word), flight (`detectFlight`: book/buy plus "flight"), then the best open task by name (`matchTasks`). A task match starts unconfirmed; the confirm screen shows it as "time on “Finish CDs”", and **Start plan** is the yes. Changing or clearing it there is the no.
- **Second look.** The panel runs `critiquePlan` on the read and puts it on `PlanDraft.critique`. A fail draws a strip with keys on the confirm card, a warn a chip on its row. Nothing is blocked, and what the person does is kept in the critic ledger. See `lib/critic-bimby/README.md`.
- **Run.** One item plays at a time; playing another pauses the first. Every closed play is a `Span`.
- **Effects.**
  - Intake link: finishing logs one intake row (`applyIntake` with `logSource` `plan-bimby`, labelled "the Plan BIMBY"), whose note says it was auto-created from that task. Reopening and finishing again does not log twice.
  - Task link (confirmed): each closed play appends a `timeLogs` slice (`plan-log-…` id, `activityLabel` "plan bimby") through `taskRepository`, like `focus-timer-log.ts`, and refreshes `actualDuration`. Plays under 30 s are ignored.
  - Flight link: the row shows a paste box. A confirmation (a full email, or just the code) goes through the Flight BIMBY (`lib/flight-bimby/`, which also adds the calendar event; a bare code still files the old plain item) into a Flight item (`FLIGHT_ATTR` fields, `booked` true) in the list that takes the Flight type, else a list with "flight" in its name, else a new "Upcoming flights" list. Filing finishes the row.

## Rules this BIMBY keeps

- **Never destroy.** It only adds: intake rows, time logs, flight items. It never edits or deletes an existing task's other fields.
- **Doubt becomes a choice.** An uncertain task match is a dropdown of candidates on the confirm screen, not a guess.
- **Planned.** A Blueprint adapter (`lib/agents/adapters/`) so the agent lab lists it; a Home / phone entry point (today only `/lab/plan-bimby`); linking a task that is an Operation to Working Now so Tracking is painted too; a pace-aware nudge when a row runs over its minutes; auto-completing a row from a matching habit or intake already logged.

## Files

- `types.ts`: `PlanItem`, `PlanLink`, `PlanDraft` (with `critique`), `Run`, `RunItem`.
- `parse.ts`: schema, prompt and example, `cleanPlan`, `parseByRules`, `parsePlan`.
- `links.ts`: `detectIntake`, `detectFlight`, `matchTasks`, `withLinks`.
- `run.ts`: `startRun`, `play`, `pause`, `complete`, `skip`, `reopen`, `toggleSub`, `elapsedMs`, `formatClock`.
- `apply.ts`: `logIntakeFor`, `logSpanOnTask`, `buildFlightTask`, `flightList`, `fileFlight`.
- `../../components/Lab/PlanBimby/`: `PlanBimbyPanel.tsx`, `PlanBimbyDialog.tsx`, `plan-bimby.css`.
- `modes.ts`: `PLAN_CHAT_MODES`, `modeById`.
- `store.ts`: `usePlanRunStore`, persisted as `brain2-plan-bimby-run`. When a row becomes done it calls `day/track.ts`, which does nothing for a row that is not a day plan's.
- `plan-bimby.test.ts`, `store.test.ts`.
- `day/`: the Today pipeline (below).

## Today: the day plan, made in BIM chat

_Last mapped: 2026-11-11_

"what I have to do for the rest of the day: order hairdye … asap, dye hair, bleach eyebrows, shave legs, pack (my stuff and elijahs) and plan outfits, finish foxtide stuff, and plan ny, and read marilyn text and reply. MUST be done is dye hair (and thus order hairdye) bleach eyebrows and pack, and text marilyn. and then foxtide stuff and planning ny is important as well." becomes a **day card** under BIM's reply (`components/Bim/day-card.tsx`). Nothing is written until **Put on To Do today** or **File and start**.

READ (`day/read.ts`, rules) → ESTIMATE (`day/estimate.ts`, `day/history.ts`) → ORDER and FIT (`day/schedule.ts`) → THINK (`day/llm.ts`, one model call, in the background) → ASK (`day/ask.ts`) → CONFIRM (the card, or changes said in chat: `day/tweak.ts`) → FILE and RUN (`day/apply.ts`) → TRACK (`day/track.ts`).

- **Read.** The first sentence is the list. Titles are the person's words. A later sentence that weighs things ("MUST be done is …", "… is important as well", "… can wait") sets the weight on the items it names: `must`, `important`, or `rest` (shown as "if time"). "X (and thus Y)" puts Y before X and gives Y the same weight. Brackets are steps ("my stuff", "elijahs") or an aside ("tights comes to mind"). "asap" marks urgent. A list whose things are mostly not doing words ("buy milk, eggs and bread") is not a day plan.
- **Estimate.** Strongest first: minutes said in the message, the median of your own similar finished work (completed tasks' `actualDuration` or time logs, Tracking Activity blocks, rows finished in earlier day plans), a rule of thumb, 30 min. Each estimate carries one sentence saying what it rests on, and the card shows the source as a chip. A typed time is `you` and is never overwritten.
- **Order and fit.** Built once: urgent, then must, important, the rest, in spoken order, with a waiting thing after what it waits on. After that the order is the person's. The rows are laid end to end from now to the end of the day (23:00, editable). The card says what the musts need, what everything needs, and what to let go of first when it does not fit. `realismLine` from follow-through is added to the reply when there are enough plans to say it.
- **Think.** With LLM on, the card appears at once from the rules and one schema-bound call on the `extract` ladder runs in the background. Per numbered item it gives minutes with a clause, a guess at why it matters, and a guess at what happens if not. It may name a missed task with the words it came from. Checks: an unknown number, minutes out of range, or a missed task whose words are not in the message is dropped. A model minute replaces only a rule of thumb or the default. A guessed reason is shown as "BIM's guess" and is filed only if the person keeps it. The result is merged by item id, so edits made meanwhile stay.
- **Ask.** One question per reply, for each must and then each important thing: why it matters today, resistance (0–4, one tap), what is in the way (only at resistance 3+), what happens if not (musts only). `skip` skips one, `stop asking` ends it. The answer is the person's words. `dreadLine` is added after a high resistance.
- **Changes in words.** While the plan is live (made today, not rejected), a chat line or the card's box can say: "pack will take 2 hours", "drop shave legs", "also call mom", "plan ny is a must", "foxtide first", "dye hair before pack", "why dye hair: …", "if I don't pack: …", "dreading pack", "until 11pm", "file the plan", "start the plan", "done dye hair", "starting foxtide". A line that names nothing on the plan is not a change and goes on to the rest of the chat.
- **File.** One undo step. Each thing becomes a task on To Do today (`createScheduledTodoTask`), or updates the open task with the same name when "use the task you already have" is ticked. It carries the estimate, steps, `why`, `consequences`, and a note. A must is marked Required for the day, an important one Prioritized. Text on an existing task is added to, never replaced. The same things become one intention in the follow-through ledger: one step each (`must` / `will` / `maybe`), with resistance and importance as a confirmed "before" feeling. Filing again adds only what is new.
- **Run.** **File and start** hands the rows to the run list above, each tied to its task (confirmed), so every play is logged as time on the task. The run list is drawn inside the card and is the same run the Plan tab shows.
- **Track.** When a row is finished (the Done key, or "done dye hair" in chat) the item keeps its real minutes, the ledger gets the action and the step is confirmed `done`, and the task is completed with that time. The real minutes feed the next estimate.

Why it left the plan: `modes.ts` planned Today as a second thread in the Plan BIMBY panel. It is a BIM chat lane instead, because the day is talked through over many messages and BIM chat already holds the conversation, the card pattern and the ledger. The run list is shared, so the panel still runs it.

Limits. The card has not been looked at in the running app; it is covered by a render test only. The model step has not been run live; tests cover the checks on its answers. Matching is by shared words, so "work on the app" will not find "BRAIN2". A weighing sentence that names a thing not on the list ("and text marilyn" when the list says "read marilyn text and reply") matches by words or is missed. An open question takes the next plain line as its answer; the reply shows what was noted and the card can undo it. Reopening a finished row does not un-complete the task. Resistance is kept in follow-through, not on the task (`resistanceReadings` uses another scale). The plan is per device (`localStorage` `bimchat-days`, last 20).

**Planned:** a web search step for an estimate nobody has history for (the app has no search tool yet); the model reading changes the rules miss; the Today key in the panel opening the same card; a nudge when a row runs past its estimate; delivery waits ("dye hair waits on the Walmart order arriving"); Telegram once the hub runs flows.

### Updates to the day (the Day update BIMBY)

_Last mapped: 2026-11-11_

While a plan is live, a long message that talks about it ("update on this plan- … like asking the neighbor if i can use their laundry key? … Scary thing. … did make the order … (update as of 7pm). add to my to do list make marilyn gift (orca) maybe do sewing fix sewing machine? … updated plan: -walmart incoming … 8:11 … (laundry key obtained)") is read **against the plan** (`day/update.ts`, rules only), not as a stream. `tryDay` checks it before a new plan and before the Stream BIMBY, which used to file each sentence as its own note (23 filings for that message).

It becomes a Report card (`components/Bim/report-card.tsx`) of changes, one effect each, under a reply that also points at the day card:

- **DAY add**: a new thing, with its weight, what it comes **before** or waits on, resistance, how it feels, a note, and "done at" when the same message says it got done. "like asking the neighbor …" right after a line about laundry is the way laundry can happen, so it comes before "do laundry". "do sewing fix sewing machine" is two things; the fix comes first. "gaining courage", "scary" set resistance 3 and "scared" on the thing just added. A flight or passport thing is a must. "maybe" is if-time.
- **DAY done**: a thing on the plan done at a minute, or **inside a window** when the minute is not known. "Still haven't really done anything … did make the order … (update as of 7pm)" marks the order done sometime between the last message and 19:00 (`doneWindow`).
- **DAY feel** / **DAY first**: resistance and words before an existing thing; "do key first".
- **FILE lines** for the rest, through the Stream BIMBY's writer: the "so far" stretch as one `track:` block from the last message to the "as of" time; `log:` events at their minute ("walmart order arrived at 19:36", "laundry key obtained at 20:11", "putting in dry shampoo …, now cutting hair" as est); `note:` for a rule for every day ("1 scary thing per day") and where a thing is ("passport: under the red boxes"); `note: mood:` for how it felt after; `shopping:` for a thing to get ("need to get a case for that thing" after "where's my passport" is a passport case).
- "updated plan:" lines restate the plan: only what is new is added ("shower", "oil up"); "walmart incoming" is a wait, not a task. Asides that name nothing and ask nothing ("get to the port at") are listed in "how I read it" as heard, not filed.

Clocks are read against the send time: "7:36" sent at 20:12 is 19:36 (`lib/stream-bimby/parse.ts`). The plan keeps `heardAt`, so the next "so far" starts at this message.

Accept (`day/update-apply.ts`, through `lib/report-bimby/apply.ts`) changes the plan. When the plan is already filed, an added thing is filed to To Do too, and a done thing is checked off there with `finishDayItem`, so To Do and follow-through agree.

The first message's "also i prob will have to do my laundry can you find out …?" now puts "do laundry" on the list (`splitAside`) and keeps the question as a remark. The reply says it is looking it up, and the Web BIMBY answers in a line under the day card, asking where home is first when it does not know (`components/Bim/README.md`, "Web questions").

Limits. Rules only, shaped on that day's messages; another person's phrasing will miss some changes, and what is missed is listed as heard. Not looked at in the running app; covered by `day/update.test.ts` and a render test in `components/Bim/day-card.test.tsx`.

**Planned:** a model pass that lists the same changes (checked against the plan and the words, like the stream's), with the rules filling what it skips; one accept for the whole card.

Files in `day/`: `types.ts`, `read.ts`, `estimate.ts`, `history.ts`, `schedule.ts`, `llm.ts`, `ask.ts`, `tweak.ts`, `store.ts` (`useDayPlanStore`, `liveDayPlan`), `apply.ts` (`fileDay`, `startDayRun`, `rejectDay`), `track.ts` (`finishDayItem`, `noteRunItemDone`), `run.ts` (`tryDay`, `buildDayPlan`, `reviseDay`), `update.ts` (`readDayUpdate`, `looksLikeDayUpdate`, `updateCard`), `update-apply.ts` (`applyDayEffect`), `day.test.ts`, `update.test.ts`.

Test: `npx vitest run --exclude '.claude/**' lib/plan-bimby components/Bim/day-card.test.tsx`
