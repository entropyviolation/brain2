/**
 * lib/ingest/types.ts — Shared types for phone-message ingest
 *
 * Channel-agnostic: Telegram is the first adapter. A command is verb + payload;
 * the executor maps it onto existing store writes. See docs/MESSAGE_INGEST.md.
 */

export type IngestChannel = "telegram" | "simulate" | "hub"

export type IngestIntentKind =
  | "capture"
  | "bulk"
  | "habit"
  | "location"
  | "track"
  | "iphone-screen"
  | "iphone-call"
  | "iphone-text"
  | "mood"
  | "sleep"
  | "start"
  | "stop"
  | "help"
  | "info"
  | "read"
  | "lists"
  | "folders"
  | "inbox"
  | "search"
  | "today"
  | "habits"
  | "status"
  | "ops"
  | "count"
  | "tags"
  | "plan"
  | "plan-now"
  | "read-plan"
  | "read-plans"
  | "do"
  | "todo-today"
  | "read-todo-today"
  | "morning"
  | "reviews"
  | "review"
  | "cancel"
  | "gps"
  | "ping"
  | "grocery"
  | "needed"
  | "bought"
  | "note"
  | "iphone-notes"
  | "pin"
  | "receipt"
  | "journal"
  | "pdf"
  | "inventory"
  | "pair"
  | "event-log"
  | "event-trigger"
  | "habit-trigger"
  | "currently"
  | "stopped-activity"
  | "switched-to"
  | "unknown"

export interface IngestIntent {
  kind: IngestIntentKind
  /** Text after the verb, trimmed. For bulk, may contain newlines. */
  payload: string
  /** Original message (trimmed). */
  raw: string
}

export interface IngestSource {
  channel: IngestChannel
  /** Telegram chat id (or "simulate" / hub id). */
  chatId: string
  /** Telegram user id when known. */
  userId?: string
  username?: string
  isGroup?: boolean
}

export type IngestEventStatus = "applied" | "clarify" | "ignored" | "error"

export interface IngestEvent {
  id: string
  at: string
  channel: IngestChannel
  chatId: string
  userId?: string
  /** Telegram @name when known, so a refused sender can be paired by sight. */
  username?: string
  raw: string
  kind: IngestIntentKind
  status: IngestEventStatus
  summary: string
  itemIds?: string[]
}

export interface NameCandidate {
  id: string
  name: string
  score: number
}

export type PendingClarifyKind =
  | "location"
  | "habit"
  | "track"
  | "start"
  | "mood"
  | "read"
  | "bought"
  | "receipt"
  | "ritual"
  | "duplicate"

export interface PendingClarify {
  kind: PendingClarifyKind
  query: string
  candidates: NameCandidate[]
  /** If set, reply `new` creates this pen name. */
  createName?: string
  scopeId?: string
  /** Rest of the original payload after the name (habit value, track window). */
  remainder?: string
  createdAt: string
  /**
   * Text morning review / period review. Present when `kind` is `ritual`.
   * Steps advance in `lib/ingest/apply-ritual.ts`.
   */
  ritual?: {
    flow: "morning" | "period" | "day" | "week" | "month" | "quarter" | "year"
    periodKey: string
    step: string
    draft: Record<string, unknown>
    /** Period reviews only — which bucket is in progress. */
    period?: "day" | "week" | "month" | "quarter" | "year"
  }
  /**
   * Open lines the phone just skipped because an identical item is already
   * on the list. `see` peeks, `again` adds another, `dismiss` leaves them.
   */
  duplicateAdd?: {
    /** Reply fragment for the lines that did land, so dismiss can repeat it. */
    addedReply: string
    entries: DuplicateAddEntry[]
  }
}

export interface DuplicateAddEntry {
  listId: string
  listName: string
  line: string
  dueBefore?: string
  existingId: string
  existingName: string
}

export interface ApplyOk {
  status: "ok"
  reply: string
  kind: IngestIntentKind
  summary: string
  itemIds?: string[]
  /**
   * Plain-text card to pin in the Telegram chat (grocery dump). Survives a
   * closed laptop so a store trip can read the last snapshot.
   */
  pinText?: string
}

export interface ApplyClarify {
  status: "needs_clarify"
  reply: string
  kind: IngestIntentKind
  pending: PendingClarify
  /** Grocery card to pin even while a duplicate question is open. */
  pinText?: string
}

export interface ApplyIgnored {
  status: "ignored"
  reply?: string
  kind: IngestIntentKind
  summary?: string
}

export interface ApplyError {
  status: "error"
  reply: string
  kind: IngestIntentKind
}

export type ApplyResult = ApplyOk | ApplyClarify | ApplyIgnored | ApplyError

export interface IncomingAttachment {
  kind: "photo" | "pdf" | "voice" | "audio"
  mime: string
  name: string
  dataUrl: string
  mediaGroupId?: string
}

export interface IncomingMessage {
  source: IngestSource
  text: string
  receivedAt: string
  telegramMessageId?: number
  /** Telegram update_id — preferred dedupe key for webhook retries. */
  telegramUpdateId?: number
  attachments?: IncomingAttachment[]
  /** Test / simulate seam: skip Tesseract and use this OCR blob. */
  ocrText?: string
}
