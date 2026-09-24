/**
 * lib/ingest/apply-pin.ts — Refresh the pinned grocery card
 *
 * The pin is how grocery reads survive a closed laptop: Telegram keeps the
 * last dump at the top of the chat even when nothing is polling.
 */
import { applyStatus } from "./apply-read"
import { groceryDumpText } from "./apply-grocery"
import type { ApplyResult } from "./types"

export function applyPin(now = new Date()): ApplyResult {
  const grocery = groceryDumpText()
  const status = applyStatus(now)
  const statusLine = status.status === "ok" ? firstLine(status.reply) : null
  if (!grocery) {
    return {
      status: "ok",
      kind: "pin",
      reply: [
        "Nothing to pin yet. Text groc milk to start a grocery list.",
        statusLine ? `Now: ${statusLine}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      summary: "Pin with no grocery list",
    }
  }
  const reply = statusLine ? `${grocery}\n\nNow: ${statusLine}` : grocery
  return {
    status: "ok",
    kind: "pin",
    reply,
    summary: "Pinned grocery",
    pinText: grocery,
  }
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? text.trim()
}
