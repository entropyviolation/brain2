/**
 * lib/phone-sync/calls-reader.ts — Read the Mac's call history
 *
 * Node only. Opens `CallHistory.storedata` read-only with `node:sqlite` and
 * reads up to `CALLS_PAGE` rows past the cursor, in the order the Mac stored
 * them (`Z_PK`), so a call synced late is still read. The first run
 * starts from the beginning; each run after catches up one page at a time.
 * Needs macOS, "Calls from iPhone" on, and Full Disk Access for the hub.
 * `BRAIN2_CALLS_DB` points at another file (tests). Rows map in `calls.ts`.
 */
import os from "node:os"
import path from "node:path"
import { decodeCallCursor, encodeCallCursor, rowToCallRecord, type CallHistoryRow } from "./calls"
import type { PhoneReader } from "./runner"
import type { CallRecord } from "./types"
import { brain2Env } from "@/lib/brain2-env.mjs"

export const CALLS_PAGE = 1000

export function callHistoryPath(env: Record<string, string | undefined> = process.env): string {
  return (
    brain2Env("CALLS_DB", env) ||
    path.join(os.homedir(), "Library", "Application Support", "CallHistoryDB", "CallHistory.storedata")
  )
}

/** Columns every version has, then ones some versions lack. */
const BASE_COLUMNS = ["ZUNIQUE_ID", "ZDATE", "ZDURATION", "ZORIGINATED", "ZANSWERED", "ZADDRESS"]
const OPTIONAL_COLUMNS = ["ZNAME", "ZCALLTYPE", "ZSERVICE_PROVIDER"]

type Db = import("node:sqlite").DatabaseSync

function openCallHistory(file: string): Db {
  const custom = Boolean(brain2Env("CALLS_DB"))
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
  const columns = ["Z_PK", ...BASE_COLUMNS, ...OPTIONAL_COLUMNS.filter((c) => have.has(c))].join(", ")
  let from = decodeCallCursor(cursor)
  // A rebuilt file starts its keys over: read it all again.
  const top = (db.prepare("SELECT MAX(Z_PK) AS top FROM ZCALLRECORD").get() as { top: number | null }).top ?? 0
  if (from && from.pk > top) from = undefined
  // Rows with no id are left out before LIMIT, so one can never become the cursor.
  const valid = "ZDATE IS NOT NULL AND ZUNIQUE_ID IS NOT NULL AND ZUNIQUE_ID <> ''"
  const where = from ? `WHERE ${valid} AND Z_PK > :pk` : `WHERE ${valid}`
  const sql = `SELECT ${columns} FROM ZCALLRECORD ${where} ORDER BY Z_PK LIMIT :limit`
  const params: Record<string, number> = from ? { pk: from.pk, limit } : { limit }
  const rows = db.prepare(sql).all(params) as unknown as CallHistoryRow[]
  const records: CallRecord[] = []
  for (const row of rows) {
    const record = rowToCallRecord(row)
    if (record) records.push(record)
  }
  const last = rows[rows.length - 1]
  // No new rows: keep the cursor as it was.
  return { records, cursor: last ? encodeCallCursor({ pk: Number(last.Z_PK) }) : cursor }
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
