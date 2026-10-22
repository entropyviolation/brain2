/**
 * lib/phone-sync/messages-reader.ts — Read the Mac's Messages database
 *
 * Node only (the phone hub). Opens `~/Library/Messages/chat.db` read-only with
 * `node:sqlite`, so the hub needs no native build. Each run reads the next
 * 1000 rows past the cursor (`message.ROWID`, which only grows), oldest first.
 * The first run starts at 0, so history loads one batch per tick and the same
 * cursor carries on into live sync. Mapping lives in `messages.ts`.
 * `COGS_MESSAGES_DB` points it at another file (tests).
 * Brief: docs/phone-sync/01-texts.md.
 */
import os from "node:os"
import path from "node:path"
import type { DatabaseSync } from "node:sqlite"
import { rowToMessage, type MessageRow } from "./messages"
import type { PhoneReader } from "./runner"
import type { MessageRecord } from "./types"

export const MESSAGES_BATCH = 1000

export function messagesDbPath(): string {
  return process.env.COGS_MESSAGES_DB || path.join(os.homedir(), "Library", "Messages", "chat.db")
}

const FULL_DISK_ACCESS =
  "Give Full Disk Access to the app running the hub (System Settings → Privacy & Security → Full Disk Access), then restart it."

async function openDb(file: string): Promise<DatabaseSync> {
  if (process.platform !== "darwin" && !process.env.COGS_MESSAGES_DB) {
    throw new Error("Texts sync needs a Mac: it reads ~/Library/Messages/chat.db.")
  }
  // getBuiltinModule, not import: bundlers (vite, Electron builds) choke on node:sqlite.
  const Database = process.getBuiltinModule?.("node:sqlite")?.DatabaseSync
  // readOnly landed in 22.12; older builds may ignore it and open chat.db read-write.
  const [major, minor] = process.versions.node.split(".").map(Number)
  if (!Database || major! < 22 || (major === 22 && minor! < 13)) {
    throw new Error("Texts sync needs Node 22.13 or newer (node:sqlite with a read-only open).")
  }
  try {
    return new Database(file, { readOnly: true })
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    throw new Error(`Cannot open the Messages database at ${file} (${why}). ${FULL_DISK_ACCESS}`)
  }
}

interface RawRow {
  rowid: number
  guid: string
  text: string | null
  attributedBody: Uint8Array | null
  date: bigint | null
  isFromMe: number | null
  service: string | null
  handle: string | null
  associatedMessageType: number | null
  itemType: number | null
  chatId: number | null
  chatIdentifier: string | null
  chatGuid: string | null
  chatDisplayName: string | null
}

const BATCH_SQL = `
  SELECT m.ROWID AS rowid, m.guid AS guid, m.text AS text, m.attributedBody AS attributedBody,
         m.date AS date, m.is_from_me AS isFromMe, m.service AS service, h.id AS handle,
         m.associated_message_type AS associatedMessageType, m.item_type AS itemType,
         c.ROWID AS chatId, c.chat_identifier AS chatIdentifier, c.guid AS chatGuid,
         c.display_name AS chatDisplayName
  FROM message m
  LEFT JOIN handle h ON h.ROWID = m.handle_id
  LEFT JOIN chat c ON c.ROWID = (SELECT cmj.chat_id FROM chat_message_join cmj WHERE cmj.message_id = m.ROWID LIMIT 1)
  WHERE m.ROWID > ?
  ORDER BY m.ROWID
  LIMIT ?`

function groupBy(rows: { key: number; value: string | null }[]): Map<number, string[]> {
  const out = new Map<number, string[]>()
  for (const { key, value } of rows) {
    if (!value) continue
    const list = out.get(key) ?? []
    list.push(value)
    out.set(key, list)
  }
  return out
}

/** Read one batch past `cursor`. Exported for tests; the hub uses `messagesReader`. */
export async function readMessagesBatch(
  cursor: string | undefined,
  file = messagesDbPath(),
  limit = MESSAGES_BATCH,
): Promise<{ records: MessageRecord[]; cursor?: string }> {
  const after = Number(cursor ?? 0) || 0
  const db = await openDb(file)
  try {
    // message.date in nanoseconds passes 2^53, and node:sqlite throws on it
    // unless integers come back as bigints. Everything but the date is small.
    const batch = db.prepare(BATCH_SQL)
    batch.setReadBigInts(true)
    const rows = (batch.all(after, limit) as Record<string, unknown>[]).map(
      (raw) =>
        Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k, typeof v === "bigint" && k !== "date" ? Number(v) : v]),
        ) as unknown as RawRow,
    )
    if (rows.length === 0) return { records: [], cursor }

    const ids = rows.map((r) => r.rowid)
    const chatIds = [...new Set(rows.map((r) => r.chatId).filter((id): id is number => id != null))]
    const marks = (n: number) => Array.from({ length: n }, () => "?").join(",")

    const attachments = groupBy(
      db
        .prepare(
          `SELECT maj.message_id AS key, a.filename AS value
           FROM message_attachment_join maj JOIN attachment a ON a.ROWID = maj.attachment_id
           WHERE maj.message_id IN (${marks(ids.length)}) ORDER BY maj.message_id, a.ROWID`,
        )
        .all(...ids) as unknown as { key: number; value: string | null }[],
    )
    const members = chatIds.length
      ? groupBy(
          db
            .prepare(
              `SELECT chj.chat_id AS key, h.id AS value
               FROM chat_handle_join chj JOIN handle h ON h.ROWID = chj.handle_id
               WHERE chj.chat_id IN (${marks(chatIds.length)}) ORDER BY chj.chat_id, h.ROWID`,
            )
            .all(...chatIds) as unknown as { key: number; value: string | null }[],
        )
      : new Map<number, string[]>()

    const records: MessageRecord[] = []
    for (const r of rows) {
      const row: MessageRow = {
        rowid: r.rowid,
        guid: r.guid,
        text: r.text,
        attributedBody: r.attributedBody,
        date: r.date,
        isFromMe: r.isFromMe ?? 0,
        service: r.service,
        handle: r.handle,
        associatedMessageType: r.associatedMessageType,
        itemType: r.itemType,
        chatIdentifier: r.chatIdentifier,
        chatGuid: r.chatGuid,
        chatDisplayName: r.chatDisplayName,
        members: r.chatId != null ? (members.get(r.chatId) ?? []) : [],
        attachments: attachments.get(r.rowid) ?? [],
      }
      const record = rowToMessage(row)
      if (record) records.push(record)
    }
    // The cursor is the last row read, kept or not, so tapbacks are not re-read.
    return { records, cursor: String(rows[rows.length - 1].rowid) }
  } finally {
    db.close()
  }
}

export const messagesReader: PhoneReader = {
  source: "messages",
  read: (cursor) => readMessagesBatch(cursor),
}
