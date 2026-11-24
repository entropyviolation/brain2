# `lib/day-log-bimby/` — The Day Log BIMBY

_Last mapped: 2026-11-24_

A **BIMBY** (small, single-job sub-agent) that writes one exact, detailed account of a day — the **Day Log** (the "masterlog") — from every source Brain2 has, and files it in **Docs → LOG DOCS → DAY LOGS**. The standard it writes to is [`docs/DAY_LOG.md`](../../docs/DAY_LOG.md).

Why it exists: a day's facts were spread over a dozen places (Tracking views, iPhone location and Health, calls and texts, Screen Time, food, BIM chat, Telegram, day notes, docs, plans). Nothing put them in one place, in order, with times.

## How a log is built

1. **Read** (`sources.ts`, code). Every store, for one date, into `DaySources`. Secret rows stay out unless secrets are shown in chat.
2. **Gather** (`gather.ts`, code). One ledger of `Evidence` rows, in clock order, untimed rows last, numbered E1, E2, … Each row says its source, its clock (or none), what happened, the person's own words verbatim when it holds them, and whether a machine recorded it or the time is a guess. A Telegram line that BIM chat already holds is not counted twice. A texting or calling short code ("65161", verification codes) is a service, not a person, so it is left out of the people count.
3. **Narrate** (`compose.ts`, local model, optional). The model runs at a fixed 4,096-token context, so the timed ledger is cut into **windows** (the five parts of the day, cut again past 6,000 characters). Texts fold into one line per person and Screen Time into one line per app, so a day of hundreds of texts still fits. Each window is one call that writes that stretch in first person, citing rows as [E12]. A last call writes the brief, how I felt, and up to five questions for the gaps. Citations to rows that do not exist are removed. Amendments are in every call and win.
4. **Render** (`render.ts`, code). The 14 standard sections. Every time, number and list comes from the ledger, so they are exact with the model off. Own words are marked ❝ ❞ and quoted in full in section 9.
5. **File** (`file.ts`). The complete code-built log is filed **before** the model starts, then replaced when the prose is done. _2026-11-24:_ a dev-server reload mid-way dropped a whole build when nothing was filed until the model finished. Doc writes are stamped `agent · Day Log BIMBY`.
    One doc per day, id `doc_daylog_<date>`, title `DAY LOG · 2026-11-24 · Tuesday`, folder `LOG DOCS/DAY LOGS`, attribute `dayLogDate`. A fixed id means two windows building the same day write one doc.
    The doc font is **Karla** (`LOG_DOC_FONT`). _2026-11-24:_ it replaced Merriweather; every other style stays. On load, `karlaOnLogDocs` moves Day Logs, their hand-edited copies and Week Logs still on Merriweather to Karla; a font picked by hand is left alone.

## Amending

Say it in your own words; it is kept word for word (`amend.ts`, `store.ts`) and the day is rebuilt.

- **In Docs**: the Day Log BIMBY bar above an open Day Log (`components/Docs/day-log-bar.tsx`). Type a correction, an addition or a note; the bar shows the exchange and rebuilds. ✕ on a kept amendment drops it from the next rebuild.
- **In BIM chat**: `day log yesterday: the call with mom was at 3` or `amend today's day log: add walked 20 min at 8am`. Lane `day-log` (`lib/ingest/bim-lanes.ts`).

Code sorts each one (`correction` when it starts "no", "actually", "it was", "wasn't", "remove"…; `addition` for "add", "also", "forgot"…; else `note`) and reads a clock out of it (`detectClock`), so it also shows in the hour-by-hour list as ✎. The model is told amendments win over every other row.

**Planned:** an amendment that also fixes the Tracking row it corrects (through the Tracking BIMBY), as a card to accept; answer boxes on the gaps; a hand edit to a line proposed as an edit to its row. See [`docs/LOG_DOCS_PLAN.md`](../../docs/LOG_DOCS_PLAN.md) §1.

## Hand edits are never lost

The doc is ordinary text and can be edited. The record keeps a hash of the words last written (markup ignored). If the words changed, an automatic run leaves the doc alone, and a manual rebuild first saves the edited doc as `… · hand-edited copy <time>` in the same folder.

## Automatic

`startDayLogBimby` (`run.ts`), mounted by `hooks/use-day-log-bimby.ts` from `app/page.tsx`. Desktop only; the phone is not a writer. Three minutes after the vault loads, then every hour (`schedule.ts`):

- **Today** is rebuilt with code only. The day's last narrative is kept from this device's cache (`brain2-day-log-narratives`, 21 days), marked as from an earlier build.
- **Yesterday** is finished with the model once it is over at 04:00 (a late night still belongs to it), or again when it was built before then or without prose.
- Up to **two** of the last eight days with five or more rows and no log are built.

Every desktop window runs it, not only one: the fixed doc id keeps one doc per day, but each window keeps its own records and narrative cache, so versions can differ between windows. **Planned:** one writer (the hub's window), like the phone-sync hub.

The model runs only when BIM's LLM mode is on. _2026-11-24:_ its calls are background calls: a BIM chat call in any window cuts the running one, and it starts over once chat has been quiet for 20 s (`lib/bim-flow/ollama.ts`). Before, a chat question waited behind a 100 s window and timed out. Only one background call runs at a time across windows, and the automatic tick runs in one window only (`inOneWindow`, `navigator.locks` `brain2-day-log-tick`); every window used to write the same logs. `brain2-day-log-auto` = `off` in localStorage stops the automatic runs.

## Where it goes

**Week Logs** are built from these Day Logs by the Week Log BIMBY ([`lib/week-log-bimby/`](../week-log-bimby/README.md)), which reads `cachedDayNarrative` and shares `logModelFor`. The roadmap is [`docs/LOG_DOCS_PLAN.md`](../../docs/LOG_DOCS_PLAN.md). In short (all **Planned**): logs and Tracking stay one record in two forms (an accepted amendment changes the rows; a row change rebuilds the log within a minute, re-asking the model only for the stretch that changed; [E12] opens the row in Tracking and Tracking opens the Day Log). Month, Season and Year Logs are built from the Day Logs, and Trip / span logs ("New York Log") from Flight items, trips and location. Every log gets a data sidecar that BIM chat, the geniuses, Data and Home read, and a Logs view draws from.

## Doors

- Docs: the **DAY LOGS** folder home has a date picker and **Build day log**; an open Day Log has the bar (**Rebuild**, the amend box). `LOG DOCS` and `LOG DOCS/DAY LOGS` always show in the folder list, nested.
- BIM chat: `day log`, `yesterday's day log`, `make my masterlog for monday`, `rebuild day log 11/20`. `self` answers "can you make a day log?".

## Store

`brain2-day-logs` (`store.ts`): `logs` (one record per built day: doc id, version, rows, whether narrated, the hash) and `amendments`. Record-guarded in `lib/vault-guard.js` and in the backup (`lib/data/backup.ts`).

## Limits

- Docs bodies live in this device's IndexedDB; the task store carries the first 8,000 characters. On another device a Day Log shows that preview until a rebuild there.
- Texts are 120-character previews (the full bodies stay in the hub's archive).
- **Planned:** browser history (it is in IndexedDB on the desktop, not in the stores read here), weather, Spotify listening, and photos' captions.

## Files

- `types.ts`: `DaySources`, `Evidence`, `Amendment`, `DayNarrative`, `DayLogRecord`.
- `sources.ts`: `readDaySources`. Client only.
- `gather.ts`: `gatherDay`, `untrackedRuns`, `coveredMinutes`, clock helpers. Pure.
- `compose.ts`: `windowsOf`, `windowLedger`, `WINDOW_SYSTEM`, `DAY_SYSTEM`, `checkCitations`, `composeNarrative`.
- `render.ts`: `renderDayLog`, `codeBrief`, `dayLogTitle`, `DAY_LOG_FOLDER`. Pure.
- `file.ts`: `fileDayLog`, `handEdited`, `textHash`, `dayLogDocId`, `dayLogDateOf`, `LOG_DOC_FONT`, `karlaOnLogDocs`.
- `amend.ts`: `makeAmendment`, `amendmentKind`, `readDay`, `readDayLogAsk`. Pure.
- `schedule.ts`: `autoPlan`. Pure.
- `store.ts`: `useDayLogStore`.
- `run.ts`: `buildDayLog`, `amendDayLog`, `tryDayLog`, `runDayLogTick`, `startDayLogBimby`, `cachedDayNarrative`, `logModelFor`.
- `day-log-bimby.test.ts`: a full day of every source, windows under the cap, citation checks, a fake model, all 14 sections, the chat lines, the schedule.

Test: `npx vitest run lib/day-log-bimby`
