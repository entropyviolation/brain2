# 02 · Calls

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`.

## Status

_Last mapped: 2026-10-22_

**Built:** `lib/phone-sync/calls.ts` and `lib/phone-sync/calls-reader.ts`, with tests. The reader reads `ZCALLRECORD` read-only through `node:sqlite` (`process.getBuiltinModule`, so bundlers leave it alone), 1000 rows a run. `BRAIN2_CALLS_DB` points it at another file.

- An outgoing call often keeps `ZANSWERED` at 0 after it connects. Any `ZDURATION` above 0 counts as answered.
- `service` is `phone`, `facetime-audio`, `facetime-video`, or the VoIP app's bundle id from `ZSERVICE_PROVIDER`. `ZNAME`, `ZCALLTYPE` and `ZSERVICE_PROVIDER` are read only when the table has them.

- `lib/phone-sync/readers.ts` loads `callsReader`, so the hub runs it.
- Calls count as time together. `personTimePenIds` (`lib/people-i-know.ts`) adds the person's `iphone-call-<slug>` pen, and `personMinuteMasks` (`lib/person-time.ts`) counts iPhone Calls intervals on it. The pen is keyed by name, so a rename starts a new pen and two people with one name share one.

**Planned:**

- `lib/phone-sync/call-recordings.ts`.

## Job

Read the call history the Mac receives from the iPhone, and pick up iOS call recordings.

## Owns

- `lib/phone-sync/calls-reader.ts` (Node only): a `PhoneReader` with `source: "calls"`. Open `~/Library/Application Support/CallHistoryDB/CallHistory.storedata` read-only. Register it with one line in `lib/phone-sync/readers.ts`.
- `lib/phone-sync/calls.ts`: map rows to `CallRecord`. Pure, tested. Company time for the matched person is this agent's job, through the existing Company pipelines (`lib/people-i-know.ts`).
- `lib/phone-sync/call-recordings.ts`: find iOS call-recording notes in the Apple Notes read (`electron/apple-notes.js` already exists; call it, do not edit it) and link each to its call by time.

## Read

- Table `ZCALLRECORD`: `ZADDRESS` (number), `ZNAME`, `ZDATE` (seconds since 2001-01-01), `ZDURATION`, `ZORIGINATED` (outgoing), `ZANSWERED`, `ZCALLTYPE` (phone, FaceTime audio/video), `ZUNIQUE_ID`.
- Id (`sourceId`): `ZUNIQUE_ID`. Cursor: the pair `(ZDATE, ZUNIQUE_ID)`, stored as `"<ZDATE>|<ZUNIQUE_ID>"`. Read `WHERE ZDATE > :d OR (ZDATE = :d AND ZUNIQUE_ID > :id) ORDER BY ZDATE, ZUNIQUE_ID`, so two calls with the same timestamp are neither skipped nor read twice.
- Missed calls are instants. Answered calls are intervals of `ZDURATION`.
- A call is company time for the matched person.

## Recording

iOS 18.1+ records calls from the Phone app. It announces the recording to everyone, and saves audio plus a transcript in Notes. There is no silent, automatic option on iPhone. Some US states need every party's consent. The Settings row says so.

## Needs on the Mac

Same Apple ID. FaceTime → Settings → Calls from iPhone on. Full Disk Access.

## Done

- Full history on first run, cursor after.
- A recorded call shows its transcript under the call.
