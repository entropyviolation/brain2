/**
 * lib/inbox-transfer-log.ts — Inbox selection → Tracking log
 *
 * Each idea becomes one Text log instant (`applyTransferredLogLine`) at that
 * idea's own `createdAt` — the clock the inbox row already shows. This module
 * plans the lines. `lib/inbox-transfer-queue.ts` drops the inbox rows on the
 * click and writes the notes together after the click returns. A missing
 * clock never enters that queue. The synchronous helper below still removes a
 * row only after its own write returns ok.
 *
 * The tracking log stores a local minute, so 2:29:41 lands at 2:29, the same
 * minute as the row. A missing or invalid `createdAt` is not stamped with
 * now: that idea stays in the inbox.
 *
 * Text matches a `log:` note except clocks and durations inside the line stay
 * words. A leading `log:`, `log-`, or `log ` is stripped once, the same header
 * as message ingest. Smart-parse chips that left the title (`60m`, `15:00`)
 * are put back. A stored string that still has those tokens wins. Otherwise
 * the chip label is appended, time then duration, which is the chip row order.
 * The inbox default duration of 1 minute is not a chip and is not appended.
 * List names, urgency, and formatted dates are not invented back into the line.
 */
import { safeToDate } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"

/** Same first-line header as `parse-message.ts` (`log:`, `log-`, or `log `). */
const LOG_HEADER = /^(log)(?:\s*[:\-]\s*|\s+)([\s\S]*)$/i

/** Same duration token as smart-parse. The number is minutes, or hours when the unit starts with h. */
const DURATION_TOKEN = /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hrs?|hours?|h)\b/gi

export interface InboxLogSource {
  title?: string
  description?: string
  body?: string
  notes?: string
  taskDescription?: string
  estimatedDuration?: number
  scheduledTime?: string
}

/**
 * The inbox row clock. `null` when `createdAt` is missing or invalid.
 * Callers must not substitute the transfer time.
 */
export function inboxSubmissionTime(createdAt: Date | string | undefined): Date | null {
  return safeToDate(createdAt)
}

/** Strip one leading log header. `logical` stays. An empty payload stays empty. */
export function stripLeadingLogToken(text: string): string {
  const trimmed = text.trim()
  const breakAt = trimmed.indexOf("\n")
  const firstLine = (breakAt === -1 ? trimmed : trimmed.slice(0, breakAt)).trim()
  const rest = breakAt === -1 ? "" : trimmed.slice(breakAt + 1)
  const header = LOG_HEADER.exec(firstLine)
  if (!header) return trimmed
  return [header[2].trim(), rest].filter((part) => part.length > 0).join("\n").trim()
}

/**
 * The Tracking log title for one idea.
 * Prefers a stored string that still contains the clipped tokens.
 * Otherwise appends a missing `scheduledTime` and then `${minutes}m`.
 */
export function inboxLogLine(task: InboxLogSource): string {
  const shown = itemTitle(task).trim()
  const duration = clippedDurationMinutes(task.estimatedDuration)
  const time = task.scheduledTime?.trim() || null
  const stored = storedLineThatKeepsChips(task, shown, duration, time)
  const base = stripLeadingLogToken(stored ?? shown)
  return appendMissingChips(base, duration, time)
}

export interface InboxLogTransferResult {
  tasks: Task[]
  transferredIds: string[]
}

export interface PreparedInboxLog {
  task: Task
  line: string
  at: Date
}

/** Ideas in `ids` that can become a log line. Skips non-inbox, empty, and undated rows. */
export function prepareInboxLogTransfers(tasks: Task[], ids: readonly string[]): PreparedInboxLog[] {
  const want = new Set(ids)
  const ready: PreparedInboxLog[] = []
  for (const task of tasks) {
    if (!want.has(task.id) || task.stage !== "inbox" || task.completed) continue
    const at = inboxSubmissionTime(task.createdAt)
    if (!at) continue
    const line = inboxLogLine(task)
    if (!line) continue
    ready.push({ task, line, at })
  }
  return ready
}

/**
 * Write each selected inbox idea, then drop only the ids whose write returned
 * true. A throw, an empty line, a non-inbox row, or a missing `createdAt`
 * leaves that row alone. Other rows are not rewritten.
 */
export function transferInboxIdeasToLog(
  tasks: Task[],
  ids: readonly string[],
  write: (line: string, at: Date) => boolean,
): InboxLogTransferResult {
  const transferredIds: string[] = []
  for (const item of prepareInboxLogTransfers(tasks, ids)) {
    let ok = false
    try {
      ok = write(item.line, item.at) === true
    } catch {
      ok = false
    }
    if (ok) transferredIds.push(item.task.id)
  }
  if (transferredIds.length === 0) return { tasks, transferredIds }
  const gone = new Set(transferredIds)
  return {
    tasks: tasks.filter((task) => !gone.has(task.id)),
    transferredIds,
  }
}

/** Inbox captures default `estimatedDuration` to 1. The chip appears only above 1. */
function clippedDurationMinutes(value: number | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 1) return null
  return Math.round(value)
}

function textHasDuration(text: string, minutes: number): boolean {
  for (const match of text.matchAll(DURATION_TOKEN)) {
    const value = Number(match[1])
    const unit = (match[2] ?? "").toLowerCase()
    const got = unit.startsWith("h") ? Math.round(value * 60) : Math.round(value)
    if (got === minutes) return true
  }
  return false
}

function textHasScheduledTime(text: string, scheduled: string): boolean {
  if (text.toLowerCase().includes(scheduled.toLowerCase())) return true
  const match = /^(\d{2}):(\d{2})$/.exec(scheduled)
  if (!match) return false
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return false
  const h12 = hour % 12 || 12
  const mm = String(minute).padStart(2, "0")
  const mer = hour < 12 ? "a" : "p"
  const ampm = `${mer}\\.?m\\.?`
  if (new RegExp(`\\b${h12}:${mm}\\s*${ampm}\\b`, "i").test(text)) return true
  if (minute === 0 && new RegExp(`\\b${h12}\\s*${ampm}\\b`, "i").test(text)) return true
  const hourWord = String(hour)
  const atClock =
    minute === 0
      ? new RegExp(`\\bat\\s+${hourWord}\\b(?!\\s*:)`, "i")
      : new RegExp(`\\bat\\s+${hourWord}:${mm}\\b`, "i")
  if (atClock.test(text)) return true
  if (scheduled === "12:00" && /\bnoon\b/i.test(text)) return true
  if (scheduled === "00:00" && /\bmidnight\b/i.test(text)) return true
  return false
}

function lineKeepsChips(text: string, shown: string, duration: number | null, time: string | null): boolean {
  if (!text) return false
  if (shown && !text.includes(shown)) return false
  if (duration != null && !textHasDuration(text, duration)) return false
  if (time && !textHasScheduledTime(text, time)) return false
  return true
}

function storedLineThatKeepsChips(
  task: InboxLogSource,
  shown: string,
  duration: number | null,
  time: string | null,
): string | null {
  const titleLacksDuration = duration != null && !textHasDuration(shown, duration)
  const titleLacksTime = Boolean(time) && !textHasScheduledTime(shown, time ?? "")
  if (!titleLacksDuration && !titleLacksTime) return null
  const extras = [task.body, task.notes, task.taskDescription, task.description, task.title]
  const hits = extras
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value && value !== shown && lineKeepsChips(value, shown, duration, time))
  if (hits.length === 0) return null
  hits.sort((a, b) => a.length - b.length)
  return hits[0] ?? null
}

function appendMissingChips(base: string, duration: number | null, time: string | null): string {
  let line = base.trim()
  if (time && !textHasScheduledTime(line, time)) line = `${line} ${time}`.trim()
  if (duration != null && !textHasDuration(line, duration)) line = `${line} ${duration}m`.trim()
  return line
}
