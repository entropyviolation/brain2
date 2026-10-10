/**
 * lib/ingest/apply-pin.ts — Refresh the pinned grocery card
 *
 * The pin is how grocery reads survive a closed laptop: Telegram keeps the
 * last card at the top of the chat even when nothing is polling. That card
 * is the same text as the reply, including other open shopping-list counts.
 * `pin todo` pins today's Home → To Do list instead, as its own card.
 */
import { applyStatus } from "./apply-read"
import { groceryCardText } from "./apply-grocery"
import { applyTodoPin } from "./apply-todos"
import type { ApplyResult } from "./types"

export function applyPin(now = new Date(), payload = ""): ApplyResult {
  if (/^(todo|to-do|to do|today|to do today)$/i.test(payload.trim())) return applyTodoPin(now)
  const grocery = groceryCardText()
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
    pinText: reply,
  }
}

function firstLine(text: string): string {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? text.trim()
}
