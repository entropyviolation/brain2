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
  | "now-capture"
  | "quicklists"
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
  | "night"
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
  | "thought-process"
  | "log-categories"
  | "event-trigger"
  | "intake"
  | "cycle"
  | "switch"
  | "switch-task"
  | "switch-objective"
  | "transit"
  | "habit-trigger"
  | "nfc"
  | "currently"
  | "stopped-activity"
  | "switched-to"
  | "menu"
  | "link"
  | "tell"
  | "unknown"

export interface IngestIntent {
  kind: IngestIntentKind
  /** Text after the verb, trimmed. For bulk, may contain newlines. */
  payload: string
  /** Original message (trimmed). */
  raw: string
  /**
   * `switch location:` — the view name before the colon.
   * Omitted on `switch:` means Activity. Not set on `st:` / `so:`.
   */
  scope?: string
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
  /** Telegram message_id when the update carried one. Always copied onto the log. */
  telegramMessageId?: number
  /**
   * Dedupe key for this Telegram update. `null` means both ids were missing
   * and the message was logged instead of applied.
   */
  dedupeKey?: string | null
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
  | "menu"
  | "media"

/** `today menu` / `week menu` / `month menu` / `season menu` (season is the quarter). */
export type MenuPeriod = "day" | "week" | "month" | "quarter"

export type MenuScreen =
  | "home"
  | "todo"
  | "todo-help"
  | "todo-add"
  | "todo-op"
  | "todo-detail"
  | "habits"
  | "habits-help"
  | "plan"
  | "plan-add"
  | "summary"
  | "summary-add"
  | "summary-replace"

/** Open phone menu. Steps advance in `lib/ingest/apply-menu.ts`. */
export interface MenuState {
  period: MenuPeriod
  periodKey: string
  /** ISO time the menu was opened; the period is read from it. */
  anchor: string
  screen: MenuScreen
  /** To-do numbers as shown: index + 1 is the number. */
  todoIds?: string[]
  /** Action waiting for its numbers (`todo-op`). */
  op?: number
  /** Task ids still to walk on `todo-detail`. */
  queue?: string[]
  queueTotal?: number
}

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
    flow: "morning" | "period" | "start" | "day" | "week" | "month" | "quarter" | "year"
    periodKey: string
    step: string
    draft: Record<string, unknown>
    /** Period / start reviews — which bucket is in progress. */
    period?: "day" | "week" | "month" | "quarter" | "year"
  }
  /** Bot message edited in place for this open ritual. Never a person's message id. */
  ritualCardMessageId?: number
  /** Open `today menu` (and week / month / season). Present when `kind` is `menu`. */
  menu?: MenuState
  /**
   * Held photo for "Journal, outfit, or log?". Attachment ids only.
   * The JPEG stays in IndexedDB. Never a data URL.
   */
  mediaHold?: {
    attachmentIds: string[]
    sentAt: string
    caption: string
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
   * Plain-text card to pin in the Telegram chat. Survives a closed laptop.
   * Grocery and to-do today are separate pins.
   */
  pinText?: string
  /** Which live pin this card replaces. Omitted means grocery. */
  pinKind?: "grocery" | "todo"
  /** Bot ritual card to edit instead of sending a new bubble. */
  ritualCardMessageId?: number
  /** Closed the open photo question. Other results leave that hold in place. */
  mediaSettled?: boolean
}

export interface ApplyClarify {
  status: "needs_clarify"
  reply: string
  kind: IngestIntentKind
  pending: PendingClarify
  /** Card to pin even while a duplicate question is open. */
  pinText?: string
  /** Which live pin this card replaces. Omitted means grocery. */
  pinKind?: "grocery" | "todo"
  /** Bot ritual card to edit instead of sending a new bubble. */
  ritualCardMessageId?: number
}

export interface ApplyIgnored {
  status: "ignored"
  reply?: string
  kind: IngestIntentKind
  summary?: string
  ritualCardMessageId?: number
}

export interface ApplyError {
  status: "error"
  reply: string
  kind: IngestIntentKind
  ritualCardMessageId?: number
  /** Closed the open photo question. Other results leave that hold in place. */
  mediaSettled?: boolean
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
  /** Telegram update_id. Retry key for the first delivery. Live Location re-applies per update. */
  telegramUpdateId?: number
  /** Live Location sample. Text edits stay on the original message id. */
  locationUpdate?: boolean
  /** `reply_to_message.message_id` when this text answers a specific chat message. */
  replyToMessageId?: number
  attachments?: IncomingAttachment[]
  /** Test / simulate seam: skip Tesseract and use this OCR blob. */
  ocrText?: string
  /**
   * Client id for `POST /api/scan`. The dedupe key is `msg:hub:scan:<id>`.
   * A retry with the same id does not log twice.
   */
  scanId?: string
}
