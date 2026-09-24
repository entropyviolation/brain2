/**
 * lib/ingest/parse-bulk.ts — Bulk Add buckets for message ingest
 *
 * Same header rule as Quick/Bulk Add: a line that `parsePathHeader` accepts
 * starts a new folder+list bucket; following lines are items.
 *
 * `before 9/12:` (or any other date the capture parser knows) is not a list.
 * It stamps every following item in the message as due that day until another
 * `before` date. `before elijah gets home:` stays a list name.
 */
import { parsePathHeader, parseSmartCapture } from "@/lib/smart-parse"

export interface BulkBucket {
  folderPath: string[]
  listName: string
  lines: string[]
  /** Local midnight. Following items must be done before this day. */
  dueBefore?: Date
}

const BEFORE_RE = /^before\s+(.+)$/i

function splitLines(text: string): string[] {
  return String(text || "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function stripItemBullet(line: string): string {
  return line.replace(/^[-*•]\s+/, "").trim()
}

/**
 * A header whose whole name is a calendar day: `before 9/12:`, `before Friday:`,
 * `before Sept 12:`. Anything with leftover words (`before elijah gets home:`)
 * is a list name, not a due date.
 */
export function parseDueBeforeHeader(line: string, now = new Date()): Date | null {
  const trimmed = line.trim()
  if (!/[:：]\s*$/.test(trimmed)) return null
  const inner = trimmed.replace(/[:：]\s*$/, "").trim()
  const match = BEFORE_RE.exec(inner)
  if (!match) return null
  const rest = match[1].trim()
  if (!rest) return null
  const { suggestion } = parseSmartCapture(rest, { now })
  if (!suggestion.scheduledDate || suggestion.description) return null
  return suggestion.scheduledDate
}

/** True when a multi-line message is a list dump (header, then items). */
export function looksLikeListDump(text: string, now = new Date()): boolean {
  const lines = splitLines(text)
  if (lines.length < 2) return false
  let header = false
  let item = false
  for (const line of lines) {
    if (parseDueBeforeHeader(line, now) || parsePathHeader(line)) header = true
    else item = true
  }
  return header && item
}

export function parseBulkBuckets(text: string, now = new Date()): BulkBucket[] {
  const lines = splitLines(text)
  const buckets: BulkBucket[] = []
  let dueBefore: Date | undefined
  let current: BulkBucket = { folderPath: [], listName: "General", lines: [] }

  const flush = () => {
    if (current.lines.length === 0) return
    buckets.push(current)
  }

  for (const line of lines) {
    const due = parseDueBeforeHeader(line, now)
    if (due) {
      flush()
      dueBefore = due
      current = { ...current, lines: [], dueBefore }
      continue
    }
    const header = parsePathHeader(line)
    if (header) {
      flush()
      current = {
        folderPath: header.folderPath,
        listName: header.listName,
        lines: [],
        dueBefore,
      }
    } else {
      const item = stripItemBullet(line)
      if (!item) continue
      current.lines.push(item)
      if (dueBefore) current.dueBefore = dueBefore
    }
  }
  flush()
  return buckets
}
