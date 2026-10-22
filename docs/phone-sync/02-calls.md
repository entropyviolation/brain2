# 02 · Calls

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`.

## Job

Read the call history the Mac receives from the iPhone, and pick up iOS call recordings.

## Owns

- `electron/call-history.js`: open `~/Library/Application Support/CallHistoryDB/CallHistory.storedata` read-only.
- `lib/phone-sync/calls.ts`: map rows to `call` records. Pure, tested.
- `lib/phone-sync/call-recordings.ts`: find iOS call-recording notes in the Apple Notes read (`electron/apple-notes.js` already exists; call it, do not edit it) and link each to its call by time.

## Read

- Table `ZCALLRECORD`: `ZADDRESS` (number), `ZNAME`, `ZDATE` (seconds since 2001-01-01), `ZDURATION`, `ZORIGINATED` (outgoing), `ZANSWERED`, `ZCALLTYPE` (phone, FaceTime audio/video), `ZUNIQUE_ID`.
- Id: `ZUNIQUE_ID`. Cursor: `ZDATE`.
- Missed calls are instants. Answered calls are intervals of `ZDURATION`.
- A call is company time for the matched person.

## Recording

iOS 18.1+ records calls from the Phone app. It announces the recording to everyone, and saves audio plus a transcript in Notes. There is no silent, automatic option on iPhone. Some US states need every party's consent. The Settings row says so.

## Needs on the Mac

Same Apple ID. FaceTime → Settings → Calls from iPhone on. Full Disk Access.

## Done

- Full history on first run, cursor after.
- A recorded call shows its transcript under the call.
