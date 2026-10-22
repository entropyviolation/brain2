/**
 * lib/phone-sync/calls.ts — Mac call history rows to CallRecords
 *
 * The Mac keeps the iPhone's calls in `CallHistory.storedata`, table
 * `ZCALLRECORD` (Core Data). `ZDATE` is float seconds since 2001-01-01 UTC.
 * The id is `ZUNIQUE_ID`. The cursor is the pair `(ZDATE, ZUNIQUE_ID)` as
 * `"<ZDATE>|<ZUNIQUE_ID>"`, so two calls with one timestamp are neither
 * skipped nor read twice. The reader is `calls-reader.ts`. Pure.
 * Brief: docs/phone-sync/02-calls.md.
 */
import type { CallRecord } from "./types"

/** 2001-01-01T00:00:00Z in epoch ms. Core Data counts from here. */
export const CORE_DATA_EPOCH_MS = Date.UTC(2001, 0, 1)

export function coreDataToMs(seconds: number): number {
  return Math.round(CORE_DATA_EPOCH_MS + seconds * 1000)
}

export function msToCoreData(ms: number): number {
  return (ms - CORE_DATA_EPOCH_MS) / 1000
}

/** One `ZCALLRECORD` row, only the columns the reader selects. */
export interface CallHistoryRow {
  ZUNIQUE_ID: string
  ZDATE: number
  ZDURATION?: number | null
  ZORIGINATED?: number | null
  ZANSWERED?: number | null
  /** Text, or a blob of UTF-8 on some macOS versions. */
  ZADDRESS?: string | Uint8Array | null
  ZNAME?: string | null
  ZCALLTYPE?: number | null
  ZSERVICE_PROVIDER?: string | null
}

/** `ZCALLTYPE` values seen in the wild. */
const CALL_TYPES: Record<number, string> = { 1: "phone", 8: "facetime-video", 16: "facetime-audio" }

/** Known `ZSERVICE_PROVIDER` bundle ids. Anything else is a CallKit VoIP app, kept as named. */
const PROVIDERS: Record<string, string> = {
  "com.apple.telephony": "phone",
  "com.apple.facetime": "facetime",
}

function text(value: string | Uint8Array | null | undefined): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return new TextDecoder().decode(value).replace(/\0+$/, "").trim()
}

/**
 * phone, facetime-audio, facetime-video, or the VoIP app's bundle id.
 * FaceTime's provider says FaceTime; the call type says audio or video.
 */
export function callService(row: Pick<CallHistoryRow, "ZCALLTYPE" | "ZSERVICE_PROVIDER">): string | undefined {
  const byType = row.ZCALLTYPE != null ? CALL_TYPES[row.ZCALLTYPE] : undefined
  const provider = text(row.ZSERVICE_PROVIDER)
  if (!provider) return byType
  const known = PROVIDERS[provider.toLowerCase()]
  if (known === "facetime") return byType?.startsWith("facetime") ? byType : "facetime-audio"
  if (known) return known
  return provider
}

/**
 * Map one row. Outgoing calls often keep `ZANSWERED` at 0 even when they
 * connected, so any duration counts as answered. A row with no id or date
 * gives null.
 */
export function rowToCallRecord(row: CallHistoryRow): CallRecord | null {
  const sourceId = text(row.ZUNIQUE_ID)
  if (!sourceId || typeof row.ZDATE !== "number" || !Number.isFinite(row.ZDATE)) return null
  const duration = Math.max(0, Math.round(Number(row.ZDURATION) || 0))
  const answered = row.ZANSWERED === 1 || duration > 0
  const name = text(row.ZNAME)
  const service = callService(row)
  const record: CallRecord = {
    type: "call",
    source: "calls",
    sourceId,
    at: coreDataToMs(row.ZDATE),
    direction: row.ZORIGINATED === 1 ? "out" : "in",
    party: name ? { handle: text(row.ZADDRESS), displayName: name } : { handle: text(row.ZADDRESS) },
    durationSec: answered ? duration : 0,
    answered,
  }
  if (service) record.service = service
  return record
}

export interface CallCursor {
  date: number
  uniqueId: string
}

/** `"<ZDATE>|<ZUNIQUE_ID>"`. A JS number prints back to the same double. */
export function encodeCallCursor(cursor: CallCursor): string {
  return `${cursor.date}|${cursor.uniqueId}`
}

/** Undefined for a missing or broken cursor, so the reader starts over (re-reads write nothing new). */
export function decodeCallCursor(raw: string | undefined): CallCursor | undefined {
  if (!raw) return undefined
  const bar = raw.indexOf("|")
  if (bar <= 0) return undefined
  const date = Number(raw.slice(0, bar))
  if (!Number.isFinite(date)) return undefined
  return { date, uniqueId: raw.slice(bar + 1) }
}
