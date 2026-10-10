/**
 * lib/quick-add-log.ts — Quick Add `log:` is the tracking log, not a list
 *
 * A leading `log:` / `log-` / `log ` on the single-line Quick Add field uses
 * the same write as the Telegram bot (`applyDiscreteLog`, and `log: tp:` /
 * `log categories` when that is what the line is). It never becomes an Inbox
 * task or a list named log. Plain mode and a path such as `folder: log: item`
 * stay capture.
 */
import { applyDiscreteLog, applyLogCategories, applyThoughtProcess } from "@/lib/ingest/apply-discrete-event"
import { parseMessage } from "@/lib/ingest/parse-message"
import type { ApplyResult, IngestIntent } from "@/lib/ingest/types"

/** Leading log command, same door as the bot. `logic:` and `folder: log:` do not match. */
const LOG_START = /^log(?:\s*[:：\-]\s*|\s+)/i

export function quickAddLogIntent(text: string, plain = false): IngestIntent | null {
  if (plain) return null
  const trimmed = text.trim()
  if (!trimmed || !LOG_START.test(trimmed)) return null
  const intent = parseMessage(trimmed)
  if (intent.kind === "event-log" || intent.kind === "thought-process" || intent.kind === "log-categories") {
    return intent
  }
  return null
}

/** Write the line the way the bot would. Does not create an Inbox task. */
export function applyQuickAddLog(intent: IngestIntent, now = new Date()): ApplyResult {
  if (intent.kind === "thought-process") return applyThoughtProcess(intent.payload, now)
  if (intent.kind === "log-categories") return applyLogCategories()
  return applyDiscreteLog(intent.payload, now)
}
