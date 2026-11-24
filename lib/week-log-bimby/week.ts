/**
 * lib/week-log-bimby/week.ts — Weeks: keys, titles, and reading a week out of words
 *
 * A week runs Monday to Sunday (`lib/date-utils.ts` `getWeekStartDate`), and is
 * keyed by its Monday (`YYYY-MM-DD`). The title carries the ISO week number,
 * as `docs/LOG_DOCS_PLAN.md` §4 set out: `WEEK LOG · 2026-W48 · Nov 23–29`. Pure.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { readDay } from "@/lib/day-log-bimby/amend"

export const WEEK_LOG_FOLDER = "LOG DOCS/WEEK LOGS"

export const weekLogDocId = (start: string): string => `doc_weeklog_${start}`

/** The attribute that marks a doc as a Week Log, holding its Monday. */
export const WEEK_LOG_ATTR = "weekLogStart"

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

/** The Monday of the week holding `date`. */
export function weekStartKey(date: string): string {
  const d = parse(date)
  const back = (d.getDay() + 6) % 7
  return formatLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back))
}

export function addDays(date: string, n: number): string {
  const d = parse(date)
  return formatLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

/** The seven days of the week starting `start`, Monday first. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** ISO 8601 week, `2026-W48`: the week belongs to the year its Thursday is in. */
export function isoWeek(start: string): string {
  const thu = parse(addDays(weekStartKey(start), 3))
  const jan1 = new Date(thu.getFullYear(), 0, 1)
  const dayOfYear = Math.round((thu.getTime() - jan1.getTime()) / 86_400_000) + 1
  return `${thu.getFullYear()}-W${String(1 + Math.floor((dayOfYear - 1) / 7)).padStart(2, "0")}`
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** `Nov 23–29`, or `Nov 30–Dec 6` across a month. */
export function weekRangeLabel(start: string): string {
  const a = parse(start)
  const b = parse(addDays(start, 6))
  return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}` : `${MON[a.getMonth()]} ${a.getDate()}–${MON[b.getMonth()]} ${b.getDate()}`
}

/** `WEEK LOG · 2026-W48 · Nov 23–29`. Sorts by week in the Docs list. */
export function weekLogTitle(start: string): string {
  return `WEEK LOG · ${isoWeek(start)} · ${weekRangeLabel(start)}`
}

export function weekdayName(date: string): string {
  return parse(date).toLocaleDateString("en-US", { weekday: "long" })
}

export function shortDay(date: string): string {
  const d = parse(date)
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${MON[d.getMonth()]} ${d.getDate()}`
}

/** The Monday a doc is the Week Log of, or null. */
export function weekLogStartOf(doc: { id: string; attributes?: Record<string, unknown> }): string | null {
  const raw = doc.attributes?.[WEEK_LOG_ATTR]
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = /^doc_weeklog_(\d{4}-\d{2}-\d{2})$/.exec(doc.id)
  return m ? m[1]! : null
}

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

/**
 * A week named in words, as its Monday, or null. Reads this week, last week,
 * the week before last, N weeks ago, and any day `readDay` reads ("week of nov 16").
 */
export function readWeek(text: string, now = new Date()): string | null {
  const t = text.toLowerCase()
  const thisWeek = weekStartKey(formatLocalDateKey(now))
  if (/\bweek before last\b/.test(t)) return addDays(thisWeek, -14)
  if (/\b(?:last|previous|past)\s+week'?s?\b/.test(t)) return addDays(thisWeek, -7)
  if (/\bthis\s+week'?s?\b|\bcurrent\s+week\b/.test(t)) return thisWeek
  const ago = /\b(\d{1,2}|one|two|three|four|five|six)\s+weeks?\s+ago\b/.exec(t)
  if (ago) return addDays(thisWeek, -7 * (Number(ago[1]) || NUM[ago[1]!] || 1))
  const day = readDay(t, now)
  return day ? weekStartKey(day) : null
}

/** What a BIM chat line asks of the Week Log BIMBY, or null when it is not for it. */
export type WeekLogAsk = { kind: "build"; start: string } | { kind: "amend"; start: string; text: string }

const LOG_WORDS = String.raw`(?:week\s*log|weekly\s+log)`
const VERB = String.raw`(?:make|build|write|create|generate|do|rebuild|redo|update|refresh|run|start)`

export function readWeekLogAsk(line: string, now = new Date()): WeekLogAsk | null {
  const text = line.trim()
  const current = weekStartKey(formatLocalDateKey(now))
  // "week log: I was sick tuesday" / "last week's week log: add the trip to Ojai" / "amend my week log - …"
  const amend = new RegExp(String.raw`^(?:(?:amend|correct|fix|update|add\s+to|edit)\s+)?(?:my\s+|the\s+)?(?:([^:]{0,40}?)\s+)?${LOG_WORDS}(?:\s+(?:for\s+)?([^:]{0,40}?))?\s*(?::|\s[-–—]\s)\s*(.+)$`, "is").exec(text)
  if (amend && amend[3]?.trim()) {
    return { kind: "amend", start: readWeek(`${amend[1] ?? ""} ${amend[2] ?? ""}`, now) ?? current, text: amend[3].trim() }
  }
  const build = new RegExp(String.raw`^(?:please\s+)?(?:${VERB}\s+)?(?:me\s+)?(?:a\s+|my\s+|the\s+)?(?:([^?]{0,40}?)\s+)?${LOG_WORDS}(?:\s+(?:for\s+)?(.{0,40}?))?\s*[.!?]*$`, "i").exec(text)
  if (build) {
    const named = `${build[1] ?? ""} ${build[2] ?? ""}`
    if (!new RegExp(String.raw`^(?:please\s+)?${VERB}\b`, "i").test(text) && named.trim() && !readWeek(named, now)) return null
    return { kind: "build", start: readWeek(named, now) ?? current }
  }
  return null
}
