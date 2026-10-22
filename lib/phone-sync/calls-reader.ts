/**
 * lib/phone-sync/calls-reader.ts — Read the Mac's call history
 *
 * Node only. Opens `CallHistory.storedata` read-only with `node:sqlite` and
 * reads up to `CALLS_PAGE` rows past the cursor, oldest first. The first run
 * starts from the beginning; each run after catches up one page at a time.
 * Needs macOS, "Calls from iPhone" on, and Full Disk Access for the hub.
 * `COGS_CALLS_DB` points at another file (tests). Rows map in `calls.ts`.
 */
import os from "node:os"
import path from "node:path"
import { decodeCallCursor, encodeCallCursor, rowToCallRecord, type CallHistoryRow } from "./calls"
import type { PhoneReader } from "./runner"
import type { CallRecord } from "./types"

export const CALLS_PAGE = 1000

export function callHistoryPath(env: Record<string, string | undefined> = process.env): string {
  return (
    env.COGS_CALLS_DB ||
    path.join(os.homedir(), "Library", "Application Support", "CallHistoryDB", "CallHistory.storedata")
  )
}

/** Columns every version has, then ones some versions lack. */
const BASE_COLUMNS = ["ZUNIQUE_ID", "ZDATE", "ZDURATION", "ZORIGINATED", "ZANSWERED", "ZADDRESS"]
const OPTIONAL_COLUMNS = ["ZNAME", "ZCALLTYPE", "ZSERVICE_PROVIDER"]

type Db = import("node:sqlite").DatabaseSync

function openCallHistory(file: string): Db {
  const custom = Boolean(process.env.COGS_CALLS_DB)
  if (!custom && process.platform !== "darwin") {
    throw new Error("Call history needs macOS: it is read from the Mac's CallHistory.storedata.")
  }
  // getBuiltinModule, not import(): bundlers (vitest's jsdom run, Next) try to pack "node:sqlite".
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite")
  try {
    return new DatabaseSync(file, { readOnly: true })
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Cannot open call history at ${file} (${why}). Give the hub Full Disk Access in System Settings → Privacy & Security, and turn on FaceTime → Settings → Calls from iPhone.`,
    )
  }
}

/** Read one page past `cursor`. Exported for tests. */
export function readCallPage(db: Db, cursor: string | undefined, limit = CALLS_PAGE): { records: CallRecord[]; cursor?: string } {
  const have = new Set((db.prepare("PRAGMA table_info(ZCALLRECORD)").all() as { name: string }[]).map((c) => c.name))
  if (have.size === 0) throw new Error("Call history has no ZCALLRECORD table. Is this CallHistory.storedata?")
  const columns = [...BASE_COLUMNS, ...OPTIONAL_COLUMNS.filter((c) => have.has(c))].join(", ")
  const from = decodeCallCursor(cursor)
  // Rows with no id are left out before LIMIT, so one can never become the cursor.
  const valid = "ZDATE IS NOT NULL AND ZUNIQUE_ID IS NOT NULL AND ZUNIQUE_ID <> ''"
  const where = from ? `WHERE ${valid} AND (ZDATE > :d OR (ZDATE = :d AND ZUNIQUE_ID > :u))` : `WHERE ${valid}`
  const sql = `SELECT ${columns} FROM ZCALLRECORD ${where} ORDER BY ZDATE, ZUNIQUE_ID LIMIT :limit`
  const params: Record<string, number | string> = from ? { d: from.date, u: from.uniqueId, limit } : { limit }
  const rows = db.prepare(sql).all(params) as unknown as CallHistoryRow[]
  const records: CallRecord[] = []
  for (const row of rows) {
    const record = rowToCallRecord(row)
    if (record) records.push(record)
  }
  const last = rows[rows.length - 1]
  // No new rows: keep the cursor as it was.
  return { records, cursor: last ? encodeCallCursor({ date: last.ZDATE, uniqueId: String(last.ZUNIQUE_ID) }) : cursor }
}

export const callsReader: PhoneReader = {
  source: "calls",
  async read(cursor) {
    const db = openCallHistory(callHistoryPath())
    try {
      return readCallPage(db, cursor)
    } finally {
      db.close()
    }
  },
}
