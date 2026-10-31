/**
 * lib/log-entry-source.ts — Where a discrete log row came from
 *
 * `logSource` is the door that wrote the row. Older rows omit it. The label
 * then reads `generatedBy` (an NFC stamp, a phone-sync stamp, or a text-message
 * stamp) and otherwise says the source is unknown.
 */
import type { LogSource, TimeEntry } from "@/lib/time-entries"
import { ITEM_WRITE_CLIENT_LABEL } from "@/lib/item-write-source"

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

const CLIENT_PLACE: Record<string, string> = { electron: "Electron", ios: "iOS", web: "the web app" }

/**
 * “Created by …” line for the block editor. A stored `createdBy` wins; older
 * rows read `generatedBy` and `logSource`, else say the creator was not recorded.
 */
export function resolveCreatedByLabel(
  entry: Pick<TimeEntry, "createdBy" | "logSource" | "generatedBy" | "notes">,
): string {
  const by = entry.createdBy
  const place = by?.client ? CLIENT_PLACE[by.client] ?? ITEM_WRITE_CLIENT_LABEL[by.client] : undefined
  const on = place ? ` on ${place}` : ""
  if (by?.surface === "bim") return `Created automatically from BIM chat input${on}`
  if (by?.surface === "llm-suggestion" || entry.generatedBy?.kind === "llm") {
    return `Suggested by the LLM, confirmed by you${on}`
  }
  if (by?.surface === "user") return `Created by you${on}`
  const generated = entry.generatedBy?.kind
  if (generated === "sleep") return "Created automatically from the sleep log"
  if (generated === "screentime") return "Created automatically from Screen Time"
  const door = resolveLogSourceLabel(entry)
  if (door !== "Unknown source") return `Created automatically from ${door}`
  return "Creator not recorded (made before this was tracked)"
}
