# 00 · Sync core

_Last mapped: 2026-10-22_

**Wave 0.** Lands before every other agent starts.

**Status: built 2026-10-22** except the Settings panel (**Planned**, after Wave 1 so it has readers to show). As built: [`lib/phone-sync/README.md`](../../lib/phone-sync/README.md). Two changes from the brief below: message bodies live in `data/phone-sync/messages.jsonl`, not a persist key (localStorage is ~5 MB for every key together); and `lib/vault-guard.js` needed no edit, because tracking entries already union by id and the stamp id is per record.

## Job

The shared plumbing every source uses: record types, ids, stamps, people matching, the vault write, the run log, and the Settings panel.

## Owns

- `lib/phone-sync/types.ts`: `PhoneRecord` union (`message`, `call`, `location`, `health-sample`, `health-day`, `screen`, `email`), each with `sourceId`, `source`, `at`, optional `endAt`.
- `lib/phone-sync/write.ts`: one `applyPhoneRecords(records)` that writes into the existing stores. Texts reuse the `iphone-texts` scope and calls the `iphone-calls` scope (`lib/ingest/apply-phone-life.ts` shows the shapes). Location reuses `applyGps` paths (`lib/ingest/apply-gps.ts`).
- `lib/phone-sync/seen.ts`: the cursor per source (last `ROWID`, last call date, last sample date) plus a seen-id set, kept in the persist hub so the Mac and desktop agree.
- `lib/phone-sync/people.ts`: match a phone number, email or handle to People I Know. Normalize numbers to E.164. Unknown handles become a pen named by the Contacts name if present, else the number.
- `lib/phone-sync/log.ts`: a run log (source, started, records read, written, skipped, error) shown in Settings.
- Settings → **Phone sync** panel: one row per source with on/off, last run, count, and the permission it needs (for example "Full Disk Access").
- Shared edits: `lib/vault-guard.js` (union phone-sync records by `sourceId`), `scripts/phone-hub.ts` (a `syncLoop` that runs each enabled Mac reader every 60 s), `scripts/capture-box.mjs` (a sealed `POST /upload` for the phone app; see `03-location.md`).

## Message storage

Message bodies are kept (decided 2026-10-22). A message is a vault record with body, thread id, direction, and attachment paths. It also paints an `iphone-texts` instant so Tracking and Analytics see it. Full bodies live on disk in `data/phone-sync/messages.jsonl`, not in a persist key (see the status note above), so they do not bloat the tracking store or the ~5 MB localStorage.

## Done

- Feeding the same fixture batch twice writes once.
- A hub push from a desktop that never saw a record does not drop it.
- Settings shows each source and its last run.
