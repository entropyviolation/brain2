/**
 * lib/day-log-bimby/amend.ts — Amendments, and reading a day out of words
 *
 * An amendment is kept word for word. Code only sorts it (correction, addition,
 * note) and reads a clock out of it, so the doc can place it in the hour-by-hour
 * list. The model is told amendments win over every other row. Pure.
 */

import { detectClock } from "@/lib/doc-selection/detect-clock"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { Amendment } from "./types"

const CORRECTION = /^(?:no\b|nope\b|actually\b|wrong\b|that'?s wrong|not\b|wasn'?t\b|i wasn'?t\b|i didn'?t\b|didn'?t\b|correction\b|correct(?:ion)?:|fix\b|change\b|it was\b|remove\b|delete\b|drop\b|the .{1,60}? was (?:at|from|with|actually|really)\b)/i
const ADDITION = /^(?:add\b|also\b|and also\b|plus\b|forgot\b|i forgot\b|missing\b|you missed\b|then\b|after that\b|before that\b)/i

export function amendmentKind(text: string): Amendment["kind"] {
  const t = text.trim()
  if (CORRECTION.test(t)) return "correction"
  if (ADDITION.test(t)) return "addition"
  return "note"
}

export function makeAmendment(date: string, text: string, via: Amendment["via"], now = new Date()): Amendment {
  const words = text.trim()
  const clock = detectClock(words)
  const atMin = clock ? Number(clock.time.slice(0, 2)) * 60 + Number(clock.time.slice(3, 5)) : undefined
  return {
    id: `amend-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date,
    at: now.toISOString(),
    text: words,
    kind: amendmentKind(words),
    ...(atMin !== undefined ? { atMin } : {}),
    via,
  }
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

/**
 * A day named in words, as `YYYY-MM-DD`, or null. Reads today, yesterday, the
 * day before yesterday, N days ago, a weekday (the latest one before today,
 * "last monday" too), `2026-11-24`, `11/24`, `nov 24`, `24 nov`.
 */
export function readDay(text: string, now = new Date()): string | null {
  const t = text.toLowerCase()
  const at = (offset: number) => formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  if (/\bday before yesterday\b/.test(t)) return at(-2)
  if (/\byesterday'?s?\b|\blast night\b/.test(t)) return at(-1)
  if (/\btoday'?s?\b|\btonight\b|\bthis morning\b/.test(t)) return at(0)
  const ago = /\b(\d{1,2}|two|three|four|five|six)\s+days?\s+ago\b/.exec(t)
  if (ago) {
    const n = Number(ago[1]) || ["", "", "two", "three", "four", "five", "six"].indexOf(ago[1]!)
    if (n > 0) return at(-n)
  }
  const wd = new RegExp(`\\b(?:last\\s+|on\\s+)?(${WEEKDAYS.join("|")})\\b`).exec(t)
  if (wd) {
    const want = WEEKDAYS.indexOf(wd[1]!)
    let back = (now.getDay() - want + 7) % 7
    if (back === 0) back = 7
    return at(-back)
  }
  const slash = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t)
  if (slash) {
    const year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : now.getFullYear()
    return formatLocalDateKey(new Date(year, Number(slash[1]) - 1, Number(slash[2])))
  }
  const named = new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*\\b`).exec(t)
  if (named) {
    const mon = MONTHS.indexOf((named[1] ?? named[4])!)
    const day = Number(named[2] ?? named[3])
    let d = new Date(now.getFullYear(), mon, day)
    if (+d > +now + 86_400_000) d = new Date(now.getFullYear() - 1, mon, day)
    return formatLocalDateKey(d)
  }
  return null
}

/** What a BIM chat line asks of the Day Log BIMBY, or null when it is not for it. */
export type DayLogAsk = { kind: "build"; date: string } | { kind: "amend"; date: string; text: string }

const LOG_WORDS = String.raw`(?:master\s*log|day\s*log|daylog|daily\s+log)`

export function readDayLogAsk(line: string, now = new Date()): DayLogAsk | null {
  const text = line.trim()
  // "day log yesterday: the call with mom was at 3" / "amend today's day log: …" / "correct my masterlog for monday - …"
  const amend = new RegExp(String.raw`^(?:(?:amend|correct|fix|update|add\s+to|edit)\s+)?(?:my\s+|the\s+)?(?:([^:]{0,40}?)\s+)?${LOG_WORDS}(?:\s+(?:for\s+)?([^:]{0,40}?))?\s*(?::|\s[-–—]\s)\s*(.+)$`, "is").exec(text)
  if (amend && amend[3]?.trim()) {
    const named = `${amend[1] ?? ""} ${amend[2] ?? ""}`
    return { kind: "amend", date: readDay(named, now) ?? formatLocalDateKey(now), text: amend[3].trim() }
  }
  const build = new RegExp(String.raw`^(?:please\s+)?(?:(?:make|build|write|create|generate|do|rebuild|redo|update|refresh|run|start)\s+)?(?:me\s+)?(?:a\s+|my\s+|the\s+)?(?:([^?]{0,40}?)\s+)?${LOG_WORDS}(?:\s+(?:for\s+)?(.{0,40}?))?\s*[.!?]*$`, "i").exec(text)
  if (build) {
    const named = `${build[1] ?? ""} ${build[2] ?? ""}`
    // Without a verb, only the bare name or a day name with it: "day log", "yesterday's day log".
    if (!/^(?:please\s+)?(?:make|build|write|create|generate|do|rebuild|redo|update|refresh|run|start)\b/i.test(text) && named.trim() && !readDay(named, now)) return null
    return { kind: "build", date: readDay(named, now) ?? formatLocalDateKey(now) }
  }
  return null
}
