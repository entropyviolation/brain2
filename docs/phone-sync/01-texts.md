# 01 · Texts

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`.

Status: **built.** `_Last mapped: 2026-10-22_` The `attributedBody` decoder lives in `messages.ts`, not a separate `attributed-body.ts`. Tapbacks are skipped for now: `MessageRecord` has no field to attach them to. **Planned:** the one-line registration in `readers.ts` (the lead adds it).

## Job

Read every iMessage and SMS from the Mac's Messages database and return them as `MessageRecord`s. The core archives bodies and writes the vault ([`lib/phone-sync/README.md`](../../lib/phone-sync/README.md)).

## Owns

- `lib/phone-sync/messages-reader.ts` (Node only): a `PhoneReader` with `source: "messages"`. Open `~/Library/Messages/chat.db` read-only (`?mode=ro`, or copy it with its `-wal` first). Use the `sqlite3` CLI or `node:sqlite` so the hub needs no native build. Register it with one line in `lib/phone-sync/readers.ts`.
- `lib/phone-sync/messages.ts`: map rows to `MessageRecord`. Pure, tested.
- `lib/phone-sync/attributed-body.ts`: decode `message.attributedBody` (a typedstream blob) when `message.text` is null. Newer macOS stores many bodies only there.

## Read

- Tables: `message`, `handle`, `chat`, `chat_message_join`, `attachment`, `message_attachment_join`.
- Time: `message.date` is nanoseconds since 2001-01-01 UTC.
- Id (`sourceId`): `message.guid`. Cursor: `message.ROWID`, which only grows.
- Direction from `is_from_me`. Group chats from `chat.chat_identifier` and `display_name`.
- Tapbacks (`associated_message_type` 2000–3005) attach to their target, not as new messages.
- Attachments: store the path under `~/Library/Messages/Attachments/`; do not copy files in this wave.

## Needs on the Mac

Same Apple ID as the phone. Messages in iCloud on. iPhone → Settings → Messages → Text Message Forwarding → this Mac on (for green-bubble SMS). Full Disk Access for the app running the hub (Terminal or Brain2).

## Done

- Every run reads `WHERE ROWID > :cursor ORDER BY ROWID LIMIT 1000` and returns the last ROWID as the cursor. The first run starts at 0, so history comes in oldest first, one batch per tick, and the same cursor carries on into live sync. Nothing is skipped and nothing is read twice.
- The hub keeps working while history loads (one batch per tick).
- A missing Full Disk Access shows a clear Settings message, not a crash.
