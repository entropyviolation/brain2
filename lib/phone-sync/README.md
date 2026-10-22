# `lib/phone-sync/` — iPhone data into the vault

_Last mapped: 2026-10-22_

The shared core for automatic phone sync. Plan: [`docs/PHONE_SYNC_PLAN.md`](../../docs/PHONE_SYNC_PLAN.md). Agent briefs: [`docs/phone-sync/`](../../docs/phone-sync/README.md).

Status: Wave 0 (this core) is built. No reader is registered yet, so the hub runs nothing. **Planned:** the Mac Messages and call-history readers (Wave 1), the iOS location upload, and the Settings → Phone sync panel.

## Flow

```
reader.read(cursor) ─► records ─► archive.appendMessages (bodies, on disk)
                                 └► applyPhoneRecords (Tracking rows) ─► cursor moves ─► hub flushes the vault
```

`runner.ts` does that order on purpose: archive, then vault, then cursor. A crash re-reads; it never skips.

## Files

| File | Job |
| --- | --- |
| `types.ts` | `MessageRecord`, `CallRecord`, `PhoneSyncRun`. Readers produce these. |
| `handles.ts` | One spelling per phone number (`+15551234567`) or email. Bare 10 digits get `+1`. |
| `people.ts` | Match a party to People I Know: saved phone/email first (`personProfile.phones` / `emails`), then the Contacts name through `resolveName`, else the number. |
| `ids.ts` | Entry id from the source id, and the stamp `generatedBy: { kind: "phone-sync", id: "<source>:<sourceId>" }`. |
| `to-entries.ts` | Texts → instants on iPhone Texts. Calls → intervals on iPhone Calls, sliced at midnight; missed calls are instants. Exact clocks. `mergePhoneEntries` skips ids already there or deleted. |
| `write.ts` | `applyPhoneRecords`: the one door into the tracking store. Pen ids match the BIM `text:` / `call:` verbs (`iphone-text-<slug>`), so both share a person's pen. |
| `archive.ts` | Node only. `data/phone-sync/messages.jsonl` (full bodies, append-only, deduped), `cursors.json`, `runs.json` (last 200). |
| `runner.ts` | Reader registry and `runPhoneSync`. A reader error is logged and the cursor stays put. |
| `readers.ts` | Node only. The list the hub runs. Each Wave 1 agent adds one line. |

## Rules that keep it safe

- **Bodies stay out of localStorage.** The origin holds ~5 MB for every key together. Tracking rows keep a 120-character preview; the full body is in the archive. `data/` is in the nightly backup, which is encrypted ([`docs/BIM_BACKUP.md`](../../docs/BIM_BACKUP.md)).
- **The stamp id is per record.** `lib/vault-guard.js` drops rows of a generated batch that a fresher snapshot left out. A per-day or per-source batch would let a desktop that saw fewer texts delete the rest.
- **Deleted stays deleted.** A row in `removedEntryIds` is never written again.
- **Synced rows are exact.** No `precision: "estimated"`. The BIM verbs stay estimated.

## Hub

`scripts/phone-hub.ts` → `startPhoneSync()` loads `readers.ts`, and with at least one reader runs every `COGS_PHONE_SYNC_SECONDS` (default 60, minimum 15). It logs each run and calls `flushVault` after a run that wrote rows.
