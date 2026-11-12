/**
 * lib/ingest/phone-undo.ts — Undo the last named text write for one chat
 *
 * The phone has no action-history hotkey. `undo` reverts the last text write
 * this chat recorded, and only when that write is still the top of the stack.
 * Anything else is left alone. An open ritual is not rewound.
 */
import { peekUndoLabel, undoLastAction } from "@/lib/action-history"
import type { ApplyResult, IngestChannel, IngestIntentKind } from "./types"

const lastWrite = new Map<string, string>()

const NOT_A_WRITE = new Set<IngestIntentKind>([
  "help",
  "ping",
  "info",
  "read",
  "lists",
  "folders",
  "inbox",
  "search",
  "today",
  "habits",
  "status",
  "quicklists",
  "count",
  "tags",
  "read-plan",
  "read-plans",
  "log-categories",
  "reviews",
  "ops",
  "pair",
  "unknown",
  "cancel",
])

/** True for a kind that changes something (a log, a capture, a habit mark), false for a readout such as `ping` or `today`. */
export function isWriteKind(kind: IngestIntentKind): boolean {
  return !NOT_A_WRITE.has(kind)
}

export const UNNAMED_UNDO = "I can't name the last text write for this chat, so nothing was undone."

function chatKey(channel: IngestChannel, chatId: string): string {
  return `${channel}:${chatId}`
}

export function isUndoCommand(raw: string): boolean {
  return /^(\/undo|undo)$/i.test(raw.trim())
}

export function notePhoneWrite(channel: IngestChannel, chatId: string, label: string): void {
  lastWrite.set(chatKey(channel, chatId), label)
}

export function phoneWriteIsNamed(channel: IngestChannel, chatId: string, label: string): boolean {
  return lastWrite.get(chatKey(channel, chatId)) === label && peekUndoLabel() === label
}

/** Drop a snapshot that was only a read, so it does not cover the last real write. */
export function isReplayableWrite(result: ApplyResult): boolean {
  if (result.status !== "ok" && result.status !== "needs_clarify") return false
  return !NOT_A_WRITE.has(result.kind)
}

export function undoNamedPhoneWrite(channel: IngestChannel, chatId: string): ApplyResult {
  const label = lastWrite.get(chatKey(channel, chatId))
  if (!label || peekUndoLabel() !== label) {
    return { status: "ok", kind: "unknown", reply: UNNAMED_UNDO, summary: "Undo unnamed" }
  }
  if (!undoLastAction()) {
    return { status: "ok", kind: "unknown", reply: UNNAMED_UNDO, summary: "Undo unnamed" }
  }
  lastWrite.delete(chatKey(channel, chatId))
  return { status: "ok", kind: "unknown", reply: `Undid ${label}.`, summary: `Undid ${label}` }
}

export function resetPhoneUndoForTests(): void {
  lastWrite.clear()
}
