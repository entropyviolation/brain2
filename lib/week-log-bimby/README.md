# `lib/week-log-bimby/` — The Week Log BIMBY

_Last mapped: 2026-11-24_

A **BIMBY** that writes one detailed account of a week, Monday to Sunday, and files it in **Docs → LOG DOCS → WEEK LOGS**. It is built from the seven Day Logs ([`lib/day-log-bimby/`](../day-log-bimby/README.md)), not from a fresh read of every store. The plan it follows is [`docs/LOG_DOCS_PLAN.md`](../../docs/LOG_DOCS_PLAN.md) §4.

## How a log is built

1. **Fold** (`summarize.ts`, code). For each day: its ledger (`readDaySources` → `gatherDay`, the same rows the Day Log reads) and its Day Log prose from this device's cache (`cachedDayNarrative`). `summarizeDay` keeps what a week needs: time per activity, places, people (together, calls, texts), screens, wake and sleep, steps, kcal, moods, finished items, calendar, docs, own words, and the day's brief. Day citations ([E12]) are removed, since they point into one day's ledger. A day with no Day Log prose uses the code brief. Days after today are "not yet".
2. **Narrate** (`compose.ts`, local model, optional). One call. Each day is one capped block (brief, totals, two own-word lines, its amendments), so seven fit the 4,096-token context. The model writes the week's brief, how it felt and up to five questions. Week amendments are in the call and win.
3. **Render** (`render.ts`). 14 sections: the week in brief, at a glance (days on record, totals, averages, fullest and thinnest day), day by day (each day's brief, then its numbers and which Day Log it came from), where the time went (per activity, with each day's share), places (with days), people (with days and totals), screens, body, how I felt, own words (the three longest lines per day), plans and done, what I wrote, gaps and questions (days under 5 rows), amendments (the week's and each day's). Same house style as the Day Log.
4. **File** (`file.ts`). Code-built log first, then replaced when the prose is done. One doc per week: id `doc_weeklog_<monday>`, title `WEEK LOG · 2026-W48 · Nov 23–29`, folder `LOG DOCS/WEEK LOGS`, attribute `weekLogStart`, font **Karla**. Writes are stamped `agent · Week Log BIMBY`. Hand edits are kept as a copy before a rebuild, like Day Logs.

A build without the model keeps the week's last prose (kept in the record, so it also survives on another window) and says it is from an earlier build.

## Amending

Say it in your own words; it is kept word for word and the week is rebuilt.

- **In Docs**: the Week Log BIMBY bar above an open Week Log (`components/Docs/week-log-bar.tsx`). ✕ drops a kept amendment.
- **In BIM chat**: `week log: Tuesday I was home sick all day`, `last week's week log: the move took all of it`. Same lane as the Day Log (`day-log` in `lib/ingest/bim-lanes.ts`); `tryWeekLog` runs when `tryDayLog` passes.

**Planned:** an amendment that names a day is also filed on that Day Log (plan §4, "Amendments flow down").

## Automatic

`startWeekLogBimby` (`run.ts`), mounted beside the Day Log BIMBY in `hooks/use-day-log-bimby.ts`. Desktop only. Five minutes after the vault loads (two after the Day Log's first run), then hourly (`schedule.ts`), in one window only (`inOneWindow`, lock `brain2-week-log-tick`, 2026-11-24):

- **This week** is rebuilt with code only; its last prose is kept.
- **Last week** is finished with the model once it is over at Monday 04:00, or again when it was built before then or without prose.
- One older week (up to five back) with data and no log is built.

A week counts as having data when one of its days has 5 or more rows. `brain2-day-log-auto` = `off` stops both BIMBIES.

## Doors

- Docs: the **WEEK LOGS** folder home has a date picker (any day; its week is built) and **Build week log**. `LOG DOCS/WEEK LOGS` always shows.
- BIM chat: `week log`, `last week's week log`, `make my week log for nov 9`, `rebuild week log 2 weeks ago`. `self` answers "can you make a week log?".

## Store

`brain2-week-logs` (`store.ts`): `logs` (one record per built week: doc id, version, rows, hash, the last prose) and `amendments` (`date` is the week's Monday). Record-guarded in `lib/vault-guard.js` and in the backup (`lib/data/backup.ts`).

## Limits

- Day prose comes from this device's Day Log cache (21 days). On another device, or for older weeks, days use their code brief until their Day Log is rebuilt there.
- **Planned:** the week's written summary and songs from Data → Summary (`lib/period-summary.ts`, key `weekSummaryKey`); Month Logs built from Week Logs.

## Files

- `week.ts`: `weekStartKey`, `weekDays`, `isoWeek`, `weekLogTitle`, `weekLogStartOf`, `readWeek`, `readWeekLogAsk`, `WEEK_LOG_FOLDER`. Pure.
- `types.ts`: `DaySummary`, `WeekNarrative`, `WeekLogRecord`.
- `summarize.ts`: `summarizeDay`, `emptyDay`, `stripCitations`, `strongestWords`. Pure.
- `compose.ts`: `WEEK_SYSTEM`, `dayBlock`, `composeWeek`.
- `render.ts`: `renderWeekLog`, `codeWeekBrief`. Pure.
- `file.ts`: `fileWeekLog`, `weekHandEdited`.
- `schedule.ts`: `autoWeekPlan`. Pure.
- `store.ts`: `useWeekLogStore`.
- `run.ts`: `foldWeek`, `buildWeekLog`, `amendWeekLog`, `tryWeekLog`, `runWeekLogTick`, `startWeekLogBimby`.
- `week-log-bimby.test.ts`: week keys and ISO weeks, chat lines, folding a day, all 14 sections, a fake model, the schedule.

Test: `npx vitest run --exclude '.claude/**' lib/week-log-bimby`
