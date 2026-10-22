# 01 · Texts

_Last mapped: 2026-10-22_

**Wave 1.** Needs `00-core.md`.

## Job

Read every iMessage and SMS from the Mac's Messages database and hand them to `applyPhoneRecords`.

## Owns

- `electron/messages-db.js`: open `~/Library/Messages/chat.db` read-only (`?mode=ro`, copy the `-wal` too or open with `immutable=1`). Use `better-sqlite3` or the `sqlite3` CLI, whichever the hub can load.
- `lib/phone-sync/messages.ts`: map rows to `message` records. Pure, tested.
- `lib/phone-sync/attributed-body.ts`: decode `message.attributedBody` (a typedstream blob) when `message.text` is null. Newer macOS stores many bodies only there.

## Read

- Tables: `message`, `handle`, `chat`, `chat_message_join`, `attachment`, `message_attachment_join`.
- Time: `message.date` is nanoseconds since 2001-01-01 UTC.
- Id: `message.guid`. Cursor: `message.ROWID`.
- Direction from `is_from_me`. Group chats from `chat.chat_identifier` and `display_name`.
- Tapbacks (`associated_message_type` 2000–3005) attach to their target, not as new messages.
- Attachments: store the path under `~/Library/Messages/Attachments/`; do not copy files in this wave.

## Needs on the Mac

Same Apple ID as the phone. Messages in iCloud on. iPhone → Settings → Messages → Text Message Forwarding → this Mac on (for green-bubble SMS). Full Disk Access for the app running the hub (Terminal or Brain2).

## Done

- A first run imports full history, newest first, in batches of 1,000, without freezing the UI.
- Each later run reads only rows past the cursor.
- A missing Full Disk Access shows a clear Settings message, not a crash.
