/**
 * lib/phone-sync/messages.ts — Mac Messages rows to MessageRecords
 *
 * The pure half of the texts reader (`messages-reader.ts` does the SQLite).
 * Three jobs: Apple time to epoch ms, the `attributedBody` blob to plain text,
 * and one joined `chat.db` row to a `MessageRecord`. Tapbacks and group events
 * (renames, joins) are not messages and map to null. Brief:
 * docs/phone-sync/01-texts.md. Pure.
 */
import type { MessageRecord, PhoneParty } from "./types"

/** 2001-01-01T00:00:00Z, the Apple (Core Data) epoch, in Unix ms. */
export const APPLE_EPOCH_MS = 978_307_200_000

/**
 * `message.date` to epoch ms. Modern macOS stores nanoseconds since 2001;
 * rows from before High Sierra store seconds. Anything past 1e12 is nanoseconds
 * (seconds would be the year 33,000).
 */
export function appleDateToMs(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return APPLE_EPOCH_MS
  if (typeof value === "bigint") {
    const abs = value < BigInt(0) ? -value : value
    return abs >= BigInt(1e12) ? APPLE_EPOCH_MS + Number(value / BigInt(1e6)) : APPLE_EPOCH_MS + Number(value) * 1000
  }
  if (!Number.isFinite(value)) return APPLE_EPOCH_MS
  return Math.abs(value) >= 1e12 ? APPLE_EPOCH_MS + Math.round(value / 1e6) : APPLE_EPOCH_MS + Math.round(value * 1000)
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder("utf-8", { fatal: false })

function indexOfBytes(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

/**
 * Plain text out of an `attributedBody` blob (an NSAttributedString in
 * Apple's typedstream format). The string payload follows the "NSString" class
 * name: a few class-chain bytes, then "+" (0x2B), then a length, then UTF-8.
 * The length is one byte, or 0x81 + 2 bytes LE, or 0x82 + 4 bytes LE.
 * Returns undefined when the blob holds no string.
 */
export function decodeAttributedBody(blob: Uint8Array | null | undefined): string | undefined {
  if (!blob || blob.length === 0) return undefined
  let at = -1
  for (const marker of ["NSString", "NSMutableString"]) {
    const m = textEncoder.encode(marker)
    const i = indexOfBytes(blob, m)
    if (i >= 0) {
      at = i + m.length
      break
    }
  }
  if (at < 0) return undefined
  // The "+" sits a few bytes past the class name (01 94 84 01 2B in practice).
  let plus = -1
  for (let i = at; i < Math.min(blob.length, at + 16); i++) {
    if (blob[i] === 0x2b) {
      plus = i
      break
    }
  }
  if (plus < 0) return undefined
  let p = plus + 1
  if (p >= blob.length) return undefined
  let len = blob[p]
  p += 1
  if (len === 0x81) {
    if (p + 2 > blob.length) return undefined
    len = blob[p] | (blob[p + 1] << 8)
    p += 2
  } else if (len === 0x82) {
    if (p + 4 > blob.length) return undefined
    len = (blob[p] | (blob[p + 1] << 8) | (blob[p + 2] << 16) | (blob[p + 3] << 24)) >>> 0
    p += 4
  }
  if (p + len > blob.length) return undefined
  return textDecoder.decode(blob.subarray(p, p + len))
}

/** One `message` row joined to its handle, chat, chat members and attachments. */
export interface MessageRow {
  rowid: number
  guid: string
  text: string | null
  attributedBody: Uint8Array | null
  date: number | bigint | null
  isFromMe: number
  /** iMessage, SMS, RCS. */
  service: string | null
  /** `handle.id` for `message.handle_id`: the sender, or the other side of a 1:1. */
  handle: string | null
  associatedMessageType: number | null
  /** Non-zero for group events (rename, join, leave). */
  itemType: number | null
  chatIdentifier: string | null
  chatGuid: string | null
  chatDisplayName: string | null
  /** `handle.id` of every chat member (chat_handle_join). */
  members: string[]
  /** `attachment.filename`, as stored (`~/Library/Messages/Attachments/…`). */
  attachments: string[]
}

/** Tapbacks, sticker reactions and edits point at another message. */
export function isTapback(row: Pick<MessageRow, "associatedMessageType">): boolean {
  return !!row.associatedMessageType
}

/** U+FFFC marks where an attachment sits in the text. */
function cleanBody(text: string): string {
  return text.replace(/￼/g, "").trim()
}

export function messageBody(row: Pick<MessageRow, "text" | "attributedBody">): string {
  if (row.text != null && row.text !== "") return cleanBody(row.text)
  return cleanBody(decodeAttributedBody(row.attributedBody) ?? "")
}

/** A row to a record, or null for tapbacks, group events and empty rows. */
export function rowToMessage(row: MessageRow): MessageRecord | null {
  if (isTapback(row)) return null
  if (row.itemType) return null
  const body = messageBody(row)
  const attachments = row.attachments.filter(Boolean)
  if (!body && attachments.length === 0) return null

  const direction = row.isFromMe ? "out" : "in"
  const members = row.members.filter(Boolean)
  const group = members.length > 1
  const partyHandle =
    (direction === "out" && group ? members[0] : row.handle) || row.handle || members[0] || row.chatIdentifier || ""
  const party: PhoneParty = { handle: partyHandle }
  const others = group ? members.filter((m) => m !== partyHandle) : []

  const record: MessageRecord = {
    type: "message",
    source: "messages",
    sourceId: row.guid,
    at: appleDateToMs(row.date),
    direction,
    party,
    threadId: row.chatIdentifier || row.chatGuid || partyHandle,
    body,
  }
  if (others.length) record.members = others.map((handle) => ({ handle }))
  if (row.chatDisplayName) record.threadName = row.chatDisplayName
  if (row.service) record.service = row.service
  if (attachments.length) record.attachments = attachments
  return record
}
