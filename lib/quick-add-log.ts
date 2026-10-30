/**
 * lib/quick-add-log.ts — Quick Add `log:` and `thought process:` are the tracking log
 *
 * A leading `log:` / `log-` / `log ` or `thought process:` / `tp:` on the
 * single-line Quick Add field uses the same write as the Telegram bot
 * (`applyDiscreteLog`, `applyThoughtProcess`, and `log categories` when that
 * is what the line is). That write also files the Log or Thought Process list
 * under the Tracking folder. It never becomes an Inbox task or a brand-new
 * list named from the prefix. Plain mode and a path such as `folder: log: item`
 * stay capture.
 */
import { applyDiscreteLog, applyLogCategories, applyThoughtProcess } from "@/lib/ingest/apply-discrete-event"
import { parseMessage } from "@/lib/ingest/parse-message"
import type { ApplyResult, IngestIntent } from "@/lib/ingest/types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

/** Leading log command, same door as the bot. `logic:` and `folder: log:` do not match. */
const LOG_START = /^log(?:\s*[:：\-]\s*|\s+)/i
/** Leading thought process. Colon required, same as the bot. `folder: thought process:` does not match. */
const THOUGHT_START = /^(?:thought\s+process|tp)\s*[:：]/i

export function quickAddLogIntent(text: string, plain = false): IngestIntent | null {
  if (plain) return null
  const trimmed = text.trim()
  if (!trimmed || (!LOG_START.test(trimmed) && !THOUGHT_START.test(trimmed))) return null
  const intent = parseMessage(trimmed)
  if (intent.kind === "event-log" || intent.kind === "thought-process" || intent.kind === "log-categories") {
    return intent
  }
  return null
}

/** Write the line the way the bot would. Does not create an Inbox task. */
export function applyQuickAddLog(intent: IngestIntent, now = new Date()): ApplyResult {
  const result =
    intent.kind === "thought-process"
      ? applyThoughtProcess(intent.payload, now)
      : intent.kind === "log-categories"
        ? applyLogCategories()
        : applyDiscreteLog(intent.payload, now)
  if (result.status === "ok") {
    const store = useTimeTrackingStore.getState()
    for (const id of result.itemIds ?? []) store.updateEntry(id, { logSource: "quick-add" })
  }
  return result
}
