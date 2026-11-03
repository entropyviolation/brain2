/**
 * lib/ingest/telegram-feed.ts — Pure model for the Telegram feed
 *
 * The feed is the one list of *every* text a paired chat sent BIM, whatever
 * the executor then did with it (event, link, capture, clarify, error). It is
 * not routing. A row never creates a tracking block, Inbox task, or habit
 * write; those still come from the verb paths. The feed only remembers that
 * the message arrived, when it was sent, and what BIM said it did.
 *
 * Rows are keyed by chat + Telegram message id, so a retry, a webhook replay,
 * and a backfill from the ingest log all land on the same row.
 */
import type { IncomingMessage, IngestEvent, IngestEventStatus } from "./types"

/** Shelf a person chose for a text, from the Telegram detail. */
export type TelegramFeedShelf = "event" | "food" | "drink" | "drug" | "thought"

export interface TelegramFeedOutcome {
  kind: string
  status: IngestEventStatus
  summary: string
  /** Tracking entry this text was filed as. Set when the write landed, or when someone classifies it. */
  entryId?: string
  /** Shelf chosen in the Telegram detail. Omitted until then. The text stays in the feed either way. */
  shelf?: TelegramFeedShelf
}

export interface TelegramFeedRow {
  id: string
  /** Send time (Telegram `message.date`), ISO. */
  at: string
  chatId: string
  /** What was sent. Attachment-only messages read `(1 scan)`. */
  text: string
  messageId?: number
  updateId?: number
  attachments?: number
  /** What BIM did with it. Filled after routing; missing means still routing or the process stopped mid-way. */
  outcome?: TelegramFeedOutcome
  /** When the feed first saw it, ISO. */
  recordedAt: string
  origin: "live" | "ingest-log"
}

export const MAX_FEED_ROWS = 20000

export function feedRowId(input: {
  chatId: string
  messageId?: number
  updateId?: number
  fallback: string
}): string {
  if (input.messageId != null) return `tg:${input.chatId}:${input.messageId}`
  if (input.updateId != null) return `tgu:${input.updateId}`
  return `tgx:${input.fallback}`
}

function attachmentText(count: number): string {
  return count > 0 ? `(${count} scan)` : ""
}

/** A message the feed should hold, or null (Live Location pings, empty, simulate). */
export function feedRowFromIncoming(message: IncomingMessage, now = new Date()): TelegramFeedRow | null {
  if (message.source.channel === "simulate") return null
  if (message.locationUpdate) return null
  const attachments = message.attachments?.length ?? 0
  const text = (message.text ?? "").replace(/^﻿/, "").trim() || attachmentText(attachments)
  if (!text) return null
  const at = message.receivedAt && !Number.isNaN(Date.parse(message.receivedAt)) ? message.receivedAt : now.toISOString()
  const chatId = String(message.source.chatId)
  return {
    id: feedRowId({
      chatId,
      messageId: message.telegramMessageId,
      updateId: message.telegramUpdateId,
      fallback: `${chatId}:${at}:${text.slice(0, 24)}`,
    }),
    at,
    chatId,
    text,
    ...(message.telegramMessageId != null ? { messageId: message.telegramMessageId } : {}),
    ...(message.telegramUpdateId != null ? { updateId: message.telegramUpdateId } : {}),
    ...(attachments > 0 ? { attachments } : {}),
    recordedAt: now.toISOString(),
    origin: "live",
  }
}

/** Ingest log line → feed row, for the backfill. Refusals from unpaired senders are not the person's texts. */
export function feedRowFromIngestEvent(event: IngestEvent, unpairedSummary: string): TelegramFeedRow | null {
  if (event.channel === "simulate") return null
  if (event.status === "ignored" && event.summary === unpairedSummary) return null
  const text = (event.raw ?? "").trim()
  if (!text) return null
  const chatId = String(event.chatId)
  return {
    id: feedRowId({
      chatId,
      messageId: event.telegramMessageId,
      fallback: event.id,
    }),
    at: event.at,
    chatId,
    text,
    ...(event.telegramMessageId != null ? { messageId: event.telegramMessageId } : {}),
    outcome: { kind: event.kind, status: event.status, summary: event.summary },
    recordedAt: event.at,
    origin: "ingest-log",
  }
}

/** Add rows that are not there yet. A held row keeps its text and gains an outcome it lacked. */
export function mergeFeedRows(existing: TelegramFeedRow[], incoming: TelegramFeedRow[]): TelegramFeedRow[] {
  const byId = new Map<string, TelegramFeedRow>()
  for (const row of existing) byId.set(row.id, row)
  let changed = false
  for (const row of incoming) {
    const held = byId.get(row.id)
    if (!held) {
      byId.set(row.id, row)
      changed = true
    } else if (!held.outcome && row.outcome) {
      byId.set(row.id, { ...held, outcome: row.outcome })
      changed = true
    }
  }
  if (!changed) return existing
  const rows = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at))
  return rows.length > MAX_FEED_ROWS ? rows.slice(rows.length - MAX_FEED_ROWS) : rows
}

/** Where BIM put it, in a few words, for the muted tail of a feed row. */
export function feedOutcomeLabel(outcome: TelegramFeedOutcome | undefined): string {
  if (!outcome) return "received"
  if (outcome.status === "error") return "error"
  if (outcome.status === "clarify") return "asked you"
  if (outcome.status === "ignored") return "ignored"
  switch (outcome.kind) {
    case "link":
      return "→ Inbox link"
    case "event-log":
      return "→ Event"
    case "capture":
      return "→ Inbox"
    case "thought-process":
      return "→ Thought"
    case "journal":
      return "→ Docs"
    default:
      return `→ ${outcome.kind}`
  }
}

function sentDate(row: Pick<TelegramFeedRow, "at">): Date {
  return new Date(row.at)
}

/** Local day the text was sent (`YYYY-MM-DD`), the same key the Tracking log uses. */
export function feedRowDayKey(row: Pick<TelegramFeedRow, "at">): string {
  const d = sentDate(row)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Local minute of the day (0–1439) the text was sent. */
export function feedRowMinute(row: Pick<TelegramFeedRow, "at">): number {
  const d = sentDate(row)
  return d.getHours() * 60 + d.getMinutes()
}

/** Rows sent on the given local days, oldest first. */
export function feedRowsForDays(rows: readonly TelegramFeedRow[], dayKeys: ReadonlySet<string>): TelegramFeedRow[] {
  return rows.filter((row) => dayKeys.has(feedRowDayKey(row))).sort((a, b) => a.at.localeCompare(b.at))
}
