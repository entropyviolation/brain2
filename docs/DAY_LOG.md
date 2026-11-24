# Day Log — the standard

_Last mapped: 2026-11-24_

Where this is going (two-way with Tracking, Week / Month / Trip logs, logs as data Brain2 reads): [`LOG_DOCS_PLAN.md`](LOG_DOCS_PLAN.md).

One document per day, in **Docs → LOG DOCS → DAY LOGS**, written by the Day Log BIMBY (`lib/day-log-bimby/`). It is the full account of what happened: at what time, where, with whom, for how long, and how I felt. Every Day Log follows this standard, so any two days read the same way.

## Name

`DAY LOG · YYYY-MM-DD · Weekday` — for example `DAY LOG · 2026-11-24 · Tuesday`. The date first, so the folder sorts by day. One doc per day (id `doc_daylog_YYYY-MM-DD`).

## Marks

| Mark | Means |
| --- | --- |
| ❝ ❞ | My own words, verbatim. Never reworded. |
| ✎ | An amendment I gave. It wins over every other row. |
| ⚙ | Recorded automatically (phone sync, Screen Time, Health, location). |
| ~ | The time is estimated. |
| [E12] | Row 12 of the ledger at the end. Every claim in the prose cites its rows. |

## Sections, in this order

1. **The day in brief.** 3–6 sentences, first person.
2. **At a glance.** Woke, to sleep, activity tracked, untracked time, steps / distance / active energy / heart rate, places, people, calls and minutes, texts sent and received, Mac and iPhone screen time, food kcal, mood readings, items finished.
3. **Hour by hour.** Night 00–06, Morning 06–12, Afternoon 12–17, Evening 17–21, Late night 21–24. Under each: the narrative for that stretch, then every row with its exact time, then that stretch's top screens. Then rows with no clock time.
4. **Where I was.** Every location block in order.
5. **Who I was with and talked to.** Per person: time together, calls, texts (count, first and last time, each text).
6. **Screens.** Mac and iPhone totals, top apps.
7. **Body.** Sleep, Health, exercise and walks, food (with kcal from the Food book), intake.
8. **How I felt.** Only from mood rows and my own words. Empty when nothing says.
9. **In my own words.** Every verbatim line: BIM chat, Telegram, log items, row notes, the day note, docs.
10. **Plans and what got done.** Day plans, calendar events, finished items.
11. **What I wrote.** Docs started or edited.
12. **Gaps and open questions.** Every stretch of 30 minutes or more with no Activity, and the model's questions.
13. **Amendments.** Every one, word for word, with when and where I said it.
14. **Ledger.** Every row the log was built from, numbered.

## Sources, and how each one gets in

Every source lands in a store first; the Day Log BIMBY only reads. To get more into a Day Log, get it into one of these.

| Source | How it arrives | Store |
| --- | --- | --- |
| Activity, Company, Mood, any Tracking view | Paint, the Tracking composer, NFC, BIM verbs (`log:`, `mood:`), the Tracking Helper | `useTimeTrackingStore` |
| Location | iPhone app (`LocationPlugin.swift`): visits and moves, automatic | Location view |
| Apple Health | iPhone app, on open and every 5 minutes while open; walks found in steps | `useHealthImportStore`, Activity, sleep log |
| Sleep | Sleep log, Health import, "going to bed" / "woke up" in BIM | `useSleepStore` |
| Phone calls, texts | The Mac hub reads Call History and Messages every minute | iPhone Calls / Texts views |
| Screen Time | Mac ActivityWatch sync; iPhone Screen Time view | Screen Time views |
| Food | Food BIMBY in BIM chat; Tracking → Food | Intake rows + Food book plates |
| BIM chat | Every line you send, every conversation kept | `useBimChatStore` |
| Telegram | Every message BIM receives | `useTelegramFeedStore` |
| Day note | Tracking day note | `dayNotes` |
| Docs | Any doc started or edited that day (Day Logs left out) | task store + IndexedDB |
| Plans | Day plans made in BIM chat; calendar events | `useDayPlanStore`, `useEventStore` |
| Done | Items completed that day | task store |
| Photos | Photos filed on the day | `useDayPhotosStore` |
| Amendments | The Day Log BIMBY bar, or `day log <day>: …` in BIM chat | `useDayLogStore` |

**Planned:** browser history, weather, Spotify listening, photo captions, full text bodies from the hub archive.

## Rules the model follows

The prompt is `WINDOW_SYSTEM` and `DAY_SYSTEM` in `lib/day-log-bimby/compose.ts`. In short:

1. Only the numbered evidence. No invented event, person, place, time or feeling. When rows disagree, say both.
2. Amendments win.
3. Clock order, exact `HH:MM` times and durations; `~` for guesses.
4. Where, with whom, screens, food, feelings.
5. Cite rows after each sentence.
6. First person, plain past tense, no praise, no advice. Quote my words in curly quotes.
7. Name gaps in one short sentence.
8. Every row appears, except screen time, which may be summed.

With LLM mode off, the doc is complete except for the prose: sections 1 (a code brief), 3's paragraphs, 8's paragraph and 12's questions.

## When it runs

- Today: refreshed every hour (code only).
- Yesterday: finished with the model after 04:00.
- Missing days in the last week: up to two per hour.
- Any day, any time: **Build day log** in the DAY LOGS folder, **Rebuild** on the doc, or `day log <day>` in BIM chat.

A doc edited by hand is never overwritten without a copy: the edited version is saved beside it first.
