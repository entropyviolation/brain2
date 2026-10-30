/**
 * lib/log-entry-source.ts — Where a discrete log row came from
 *
 * `logSource` is the door that wrote the row. Older rows omit it. The label
 * then reads `generatedBy` (an NFC stamp, a phone-sync stamp, or a text-message
 * stamp) and otherwise says the source is unknown.
 */
import type { LogSource, TimeEntry } from "@/lib/time-entries"

const LABEL: Record<LogSource, string> = {
  "tracking-composer": "Tracking log",
  "tracking-shelf-now": "the list",
  "now-popup": "Now",
  bim: "BIM",
  "quick-add": "quick add",
  "inbox-transfer": "Inbox",
  "telegram-feed": "Telegram",
  nfc: "NFC",
  "phone-sync": "phone sync",
  "statement-import": "a statement",
}

/** Phrase after “Added from ”. Always a string, including old rows. */
export function resolveLogSourceLabel(
  entry: Pick<TimeEntry, "logSource" | "generatedBy" | "notes">,
): string {
  if (entry.logSource && LABEL[entry.logSource]) return LABEL[entry.logSource]
  return inferLogSourceLabel(entry)
}

function inferLogSourceLabel(entry: Pick<TimeEntry, "generatedBy" | "notes">): string {
  const generated = entry.generatedBy
  const id = generated?.id ?? ""
  if (id.startsWith("nfc:")) return LABEL.nfc
  if (generated?.kind === "phone-sync") return LABEL["phone-sync"]
  const notes = entry.notes ?? ""
  if (generated?.kind === "text" || /from text message at\b/i.test(notes) || /from text pipeline/i.test(notes)) {
    return LABEL.bim
  }
  return "Unknown source"
}
