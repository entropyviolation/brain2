# `lib/phone-sync/` — iPhone data into the vault

_Last mapped: 2026-10-25_

The shared core for automatic phone sync. Plan: [`docs/PHONE_SYNC_PLAN.md`](../../docs/PHONE_SYNC_PLAN.md). Agent briefs: [`docs/phone-sync/`](../../docs/phone-sync/README.md).

Status (_Last mapped: 2026-10-25_): the core, the Mac Messages and call-history readers, and the iOS location upload are built. The hub loads both readers and, when `BRAIN2_CAPTURE_BOX_URL` is set, starts the location drain. Settings → **Phone sync** (`components/Settings/PhoneSyncPanel.tsx`) lists every source, its permission, and the last run. Texts, calls, and location can be turned off (`enabled.json`); the hub reads that on the next tick. The panel reads the run log through loopback `/api/phone-sync` and does not show message bodies. Health, phone Screen Time, email, and DMs are listed and not built.

## Flow

```
reader.read(cursor) ─► records ─► archive.appendMessages (bodies, on disk)
                                 └► applyPhoneRecords (Tracking rows) ─► hub flushes the vault ─► cursor moves
```

`runner.ts` does that order on purpose: archive, then apply and flush to the vault, then cursor. A crash re-reads; it never skips.

## Files

| File | Job |
| --- | --- |
| `types.ts` | `MessageRecord`, `CallRecord`, `PhoneSyncRun`. Readers produce these. |
| `handles.ts` | One spelling per phone number (`+15551234567`) or email. Bare 10 digits get `+1`. |
| `people.ts` | Match a party to People I Know: saved phone/email first (`personProfile.phones` / `emails`), then the Contacts name through `resolveName`, else the number. |
| `ids.ts` | Entry id from the source id, and the stamp `generatedBy: { kind: "phone-sync", id: "<source>:<sourceId>" }`. |
| `to-entries.ts` | Texts → instants on iPhone Texts. Calls → intervals on iPhone Calls, sliced at midnight; missed calls are instants. Exact clocks. `mergePhoneEntries` skips ids already there or deleted. |
| `person-links.ts` | Phone number ↔ Person. Pure. `relinkPhonePens` names each iPhone Texts / Calls pen after the person whose saved number it is, and stamps `personId` + `handle` on it. App side: `lib/phone-person-links.ts`. Built 2026-10-23. |
| `write.ts` | `applyPhoneRecords`: the one door into the tracking store. Pen ids match the BIM `text:` / `call:` verbs (`iphone-text-<slug>`), so both share a person's pen. |
| `archive.ts` | Node only. `data/phone-sync/messages.jsonl` (full bodies, append-only, deduped), `cursors.json`, `runs.json` (last 200), `enabled.json` (a missing key stays on). |
| `runner.ts` | Reader registry and `runPhoneSync`. A reader error is logged and the cursor stays put. `enabled` returning false skips that reader and writes no run. |
| `status.ts` | The Settings row list (title, permission, which ones switch) and `latestRun`. No disk. |
| `readers.ts` | Node only. The list the hub runs. Each Wave 1 agent adds one line. |
| `calls.ts` | `ZCALLRECORD` row → `CallRecord`. Core Data time (seconds since 2001-01-01), service name, and the cursor `"<ZDATE>\|<ZUNIQUE_ID>"`. Any duration counts as answered. Pure. Built 2026-10-22. |
| `calls-reader.ts` | Node only. `callsReader`: opens `CallHistory.storedata` read-only (`node:sqlite` via `process.getBuiltinModule`), 1000 rows past the cursor. `BRAIN2_CALLS_DB` overrides the path. Loaded by `readers.ts`. |
| `messages.ts` | `chat.db` row → `MessageRecord`. Apple time (nanoseconds since 2001, or seconds on old rows), `attributedBody` typedstream → text, group members. Tapbacks and group events map to null. Pure. Built 2026-10-22. |
| `messages-reader.ts` | Node only. `messagesReader`: opens `~/Library/Messages/chat.db` read-only (`node:sqlite` via `process.getBuiltinModule`), 1000 rows past the ROWID cursor. Reads integers as bigints, since nanosecond dates pass 2^53. `BRAIN2_MESSAGES_DB` overrides the path. Needs Node 22.13+. Loaded by `readers.ts`. |
| `location.ts` | iPhone location batches → Location rows. A closed visit is a block, sliced at midnight; a half-known visit is an "arrived" / "left" instant; a significant move is a "moved ±N m" instant. Pens follow `gps:`; an unknown move goes on one fixed "On the move" pen (`phone-location-moving`). `applyLocationBatch` is its own door, since `types.ts` has no location record. Built 2026-10-22. |
| `location-drain.ts` | Node only. `startLocationDrain` pulls sealed batches from the Oracle box (`GET /uploads?kind=location`), opens them, applies, flushes, moves the `location` cursor, then acks that kind only. Started by the hub when `BRAIN2_CAPTURE_BOX_URL` is set. |

## Rules that keep it safe

- **Bodies stay out of localStorage.** The origin holds ~5 MB for every key together. Tracking rows keep a 120-character preview; the full body is in the archive. `data/` is in the nightly backup, which is encrypted ([`docs/BIM_BACKUP.md`](../../docs/BIM_BACKUP.md)).
- **The stamp id is per record.** `lib/vault-guard.js` drops rows of a generated batch that a fresher snapshot left out. A per-day or per-source batch would let a desktop that saw fewer texts delete the rest.
- **Deleted stays deleted.** A row in `removedEntryIds` is never written again.
- **Synced rows are exact.** No `precision: "estimated"`. The BIM verbs stay estimated.

## Location

_Last mapped: 2026-10-22_

Brief: [`docs/phone-sync/03-location.md`](../../docs/phone-sync/03-location.md).

```
LocationPlugin.swift ─► queue file on the phone ─► seal ─► POST /upload (Oracle, scripts/capture-upload.mjs)
                                                         └► location-drain.ts ─► applyLocationBatch ─► flushTracking ─► ack
```

- Location does not go through `runner.ts`: `PhoneRecord` has no location type and `applyPhoneRecords` writes only texts and calls. The drain keeps its cursor and run log in the same `archive.ts` files, under the `location` source.
- Ids come from the event (`pt:<ms>:<lat>,<lon>`, `visit:<arrive>:<leave>:<lat>,<lon>`), so a batch the phone re-sends writes nothing new.
- The arrival and the closed visit are two events with two ids. iOS reports both, so a visit you left shows an "arrived" instant plus the block.
- Visit blocks are added beside existing Location blocks, not painted over them. A hand-made block in the same minutes stays, and the two overlap.
- A new visit feeds the repeated-place clusters (`lib/ingest/gps-places.ts`). Moves do not; they are too coarse.

## Hub

`scripts/phone-hub.ts` → `startPhoneSync()` loads `readers.ts`, and with at least one reader runs every `BRAIN2_PHONE_SYNC_SECONDS` (default 60, minimum 15). Each tick keeps reading while a source still returns rows, so the first run catches up in one go. It logs each run and calls `flushTracking` after a run that wrote rows. A source whose `enabled.json` entry is `false` is skipped for that tick. The location drain uses the same file: off means it waits and does not pull.

_Last mapped: 2026-10-22_ Texts older than `BRAIN2_PHONE_SYNC_TEXT_DAYS` (default 30; `0` keeps every text out) stay in the disk archive only and do not become Tracking rows (`inTrackWindow` in `write.ts`). Tracking lives in localStorage, and one Mac had 302k texts back to 2018. Calls always count.

_Last mapped: 2026-10-22_ **Hub storage.** `scripts/phone-hub.mjs` loads `phone-hub-polyfill.mjs` natively, and `phone-hub.ts` loads it again through jiti. That makes two module copies. `fillLocalStorage` and `dumpLocalStorage` must use the installed `globalThis.localStorage`; before this fix, the stores started empty and nothing the hub wrote reached the vault. Each sync pass also calls `rehydrateFromDisk()` first, so app edits made in between are not refused by the vault guard.

_Last mapped: 2026-10-22_ **Tracking key only.** Phone sync and the location drain flush through `flushTracking()`, which pushes only the Tracking persist key (`timegrid-store`). The hub fills every store from disk, and a full dump would send its copy of stores the app changed in the meantime. The vault guard refused those (tasks, points, baby-animals) on the first run with the dev app open. Telegram ingest still flushes every key, since it can touch several stores.

## People links

_Last mapped: 2026-10-23_

The link is the number saved on the Person. Numbers live in the Person type's **Phone Number** attribute (`attributes.phone`, type `phone`, several allowed), mirrored to `personProfile.phones`; emails in `personProfile.emails`. `personPhoneNumbers` (`lib/people-i-know.ts`) reads the attribute first. A Person type saved before the attribute existed gets it on load (`withPersonPhoneAttribute`).

- **Ways in.** Person detail → Phone numbers / Emails (suggests numbers no one has yet), or the Phone Number attribute in any list or table. Pen settings → Person, on iPhone Texts and iPhone Calls pens. Analytics → Texts → a relationship page → Person in Brain2 (link, unlink, or create a new person with the chat's numbers). All end in `lib/phone-person-links.ts`. `lib/people-sync-runner.ts` renames the pens on every task or scope change, so an edit anywhere reaches them.
- **One number, one person.** Linking a number takes it off anyone else.
- **Pens are renamed, not merged.** A linked pen keeps its id and its rows; it gets the person's name, `personId`, and its `handle`. Nothing is re-written, so the hub's union by id has nothing to fight. A person with an old name pen and a number pen shows two pens with one name.
- **Renames keep one pen.** `penFor` in `write.ts` picks the pen linked to the matched person before the name-derived id, and each sync renames linked pens. `personTimePenIds(person, scopes)` counts every linked call pen.
- **Unlink.** Taking the number off the person unlinks the pen and gives it the number as its name again. A pen Contacts named, with no number, can be linked by hand (pen and its text/call twin); its name follows the person.
- A pen matched by Contacts name only is not stamped with the number, since the name does not prove it.
