/**
 * lib/capture-origin.ts — How an idea entered
 *
 * Set once at the capture door. The walk sheet reads `captureOriginView`.
 * Older rows with no stored door stay blank. `createdAt` is the arrival
 * clock and is left alone here.
 */
import { BIM_SHORT } from "@/lib/ingest/bim"
import type { CaptureOrigin, CaptureOriginKind, Task } from "@/lib/types"
import type { IncomingMessage } from "@/lib/ingest/types"

const KINDS: readonly CaptureOriginKind[] = [
  "telegram",
  "quick-add",
  "bulk-add",
  "notes",
  "iphone-notes",
  "reminder",
]

const LABELS: Record<CaptureOriginKind, string> = {
  telegram: BIM_SHORT,
  "quick-add": "Quick Add",
  "bulk-add": "Bulk Add",
  notes: "From notes",
  "iphone-notes": "Phone Notes",
  reminder: "Scheduled",
}

export interface CaptureOriginView {
  label: string
  detail?: string
}

function clean(value: string | undefined): string {
  return value?.trim() ?? ""
}

function isKind(value: unknown): value is CaptureOriginKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value)
}

export function isCaptureOrigin(value: unknown): value is CaptureOrigin {
  if (!value || typeof value !== "object") return false
  const origin = value as CaptureOrigin
  if (!isKind(origin.kind)) return false
  return origin.detail === undefined || typeof origin.detail === "string"
}

/** First stored origin wins. A later clarify, file, or edit cannot replace it. */
export function keptCaptureOrigin(
  prev: CaptureOrigin | undefined,
  next: CaptureOrigin | undefined,
): CaptureOrigin | undefined {
  if (isCaptureOrigin(prev)) return prev
  if (isCaptureOrigin(next)) return next
  return undefined
}

function joinDetail(parts: Array<string | undefined>): string | undefined {
  const detail = parts.map((part) => clean(part)).filter(Boolean).join(" · ")
  return detail || undefined
}

export function lineCaptureOrigin(kind: "quick-add" | "bulk-add", line: string): CaptureOrigin {
  const detail = clean(line)
  return detail ? { kind, detail } : { kind }
}

/**
 * BIM capture. A Telegram chat adds the sender and message id we were given.
 * Simulate has no chat, so the detail is the line alone.
 */
export function telegramCaptureOrigin(
  message: Pick<IncomingMessage, "source" | "telegramMessageId">,
  rawLine: string,
): CaptureOrigin {
  const parts: string[] = []
  if (message.source.channel === "telegram") {
    const username = clean(message.source.username).replace(/^@/, "")
    if (username) parts.push(`@${username}`)
    else if (clean(message.source.chatId)) parts.push(`chat ${clean(message.source.chatId)}`)
    if (message.telegramMessageId != null) parts.push(`message ${message.telegramMessageId}`)
  }
  parts.push(clean(rawLine))
  const detail = joinDetail(parts)
  return detail ? { kind: "telegram", detail } : { kind: "telegram" }
}

/** Mac From Notes or Phone Notes. `title` is the note, not the extracted line. */
export function notesCaptureOrigin(input: {
  kind: "notes" | "iphone-notes"
  title?: string
  folder?: string
}): CaptureOrigin {
  const detail = joinDetail([input.title, input.folder])
  return detail ? { kind: input.kind, detail } : { kind: input.kind }
}

/** A due reminder written into the Inbox. */
export function reminderCaptureOrigin(name: string, occurrenceKey: string): CaptureOrigin {
  const detail = joinDetail([name, occurrenceKey])
  return detail ? { kind: "reminder", detail } : { kind: "reminder" }
}

function storedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Doors that already wrote their own attributes, before `captureOrigin`.
 * Anything else stays unknown.
 */
function legacyCaptureOrigin(task: Pick<Task, "id" | "attributes" | "notes">): CaptureOrigin | undefined {
  const source = storedString(task.attributes?.source)
  if (source === "apple-notes" || source === "iphone-notes") {
    const folder = storedString(task.attributes?.appleNotesFolder)
    const account = storedString(task.attributes?.appleNotesAccount)
    return notesCaptureOrigin({
      kind: source === "iphone-notes" ? "iphone-notes" : "notes",
      folder: [folder, account].filter(Boolean).join(" · ") || undefined,
    })
  }
  if (
    task.id.startsWith("reminder-inbox-") &&
    typeof task.notes === "string" &&
    task.notes.startsWith("From reminder ")
  ) {
    return { kind: "reminder", detail: task.notes }
  }
  return undefined
}

/** Walk / clarify line. `null` when this idea has no stored door. */
export function captureOriginView(
  task: Pick<Task, "id" | "attributes" | "notes" | "captureOrigin">,
): CaptureOriginView | null {
  const origin = isCaptureOrigin(task.captureOrigin) ? task.captureOrigin : legacyCaptureOrigin(task)
  if (!origin) return null
  const detail = clean(origin.detail)
  return detail ? { label: LABELS[origin.kind], detail } : { label: LABELS[origin.kind] }
}
