/**
 * lib/lists-helper/dates.ts — Read a spoken date or span ("friday", "Dec 25", "this week") (pure, code only)
 *
 * Days are local calendar days, written as `YYYY-MM-DD` keys so a tool call stays plain data and a plan's
 * signature does not move with the clock. A span has an inclusive first and last day. Nothing here guesses:
 * a phrase that fits no shape returns null and the parser says so.
 */

export interface DaySpan {
  from: string
  to: string
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

const pad = (n: number) => String(n).padStart(2, "0")
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function prettyDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** A day by its key, or null when the key is not a real date. */
function valid(y: number, m: number, d: number): Date | null {
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

/** A month and day with no year: this year, or next year when this year's has already gone by. */
function monthDay(m: number, d: number, today: Date, year?: number): Date | null {
  if (year) return valid(year, m, d)
  const mine = valid(today.getFullYear(), m, d)
  if (mine && mine >= today) return mine
  return valid(today.getFullYear() + 1, m, d) ?? mine
}

const clean = (s: string) => s.toLowerCase().replace(/[.,!?]+$/g, "").replace(/\s+/g, " ").trim()

/** One day: "today", "tomorrow", "friday", "in 3 days", "Dec 25", "12/25/2026", "2026-12-25", "end of the month". */
export function parseDay(raw: string, now: Date): Date | null {
  const s = clean(raw).replace(/^(on|by|the)\s+/, "")
  const today = midnight(now)
  if (!s) return null
  if (s === "now" || s === "today") return today
  if (s === "tomorrow") return addDays(today, 1)
  if (s === "yesterday") return addDays(today, -1)

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (iso) return valid(+iso[1]!, +iso[2]!, +iso[3]!)

  const us = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(s)
  if (us) {
    const y = us[3] ? (us[3].length === 2 ? 2000 + +us[3] : +us[3]) : undefined
    return monthDay(+us[1]!, +us[2]!, today, y)
  }

  const named = /^(?:([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?|(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+))(?:,?\s+(\d{4}))?$/.exec(s)
  if (named) {
    const monthWord = (named[1] ?? named[4])!
    const m = MONTHS.indexOf(monthWord.slice(0, 3))
    if (m >= 0 && monthWord.length >= 3) return monthDay(m + 1, +(named[2] ?? named[3])!, today, named[5] ? +named[5] : undefined)
  }

  const inN = /^in (\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (day|week|month)s?$/.exec(s)
  if (inN) {
    const n = /^\d+$/.test(inN[1]!) ? +inN[1]! : ["", "a", "an", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].indexOf(inN[1]!) || 1
    if (inN[2] === "day") return addDays(today, n)
    if (inN[2] === "week") return addDays(today, n * 7)
    return new Date(today.getFullYear(), today.getMonth() + n, today.getDate())
  }

  const end = /^end of (?:the |this |next )?(week|month|year)$/.exec(s)
  if (end) {
    const next = /next/.test(s)
    if (end[1] === "week") return weekAround(addDays(today, next ? 7 : 0))[1]
    if (end[1] === "month") return new Date(today.getFullYear(), today.getMonth() + (next ? 2 : 1), 0)
    return new Date(today.getFullYear() + (next ? 1 : 0), 11, 31)
  }

  const wd = /^(?:(this|next|coming)\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/.exec(s)
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]!)
    let ahead = (target - today.getDay() + 7) % 7
    if (wd[1] === "next" && ahead === 0) ahead = 7
    return addDays(today, ahead)
  }
  return null
}

/** Monday to Sunday around a day. */
function weekAround(d: Date): [Date, Date] {
  const back = (d.getDay() + 6) % 7
  const start = addDays(d, -back)
  return [start, addDays(start, 6)]
}

function spanOf(s: string, now: Date): DaySpan | null {
  const today = midnight(now)
  const k = dayKey
  switch (s) {
    case "this week": {
      const [a, b] = weekAround(today)
      return { from: k(a), to: k(b) }
    }
    case "next week": {
      const [a, b] = weekAround(addDays(today, 7))
      return { from: k(a), to: k(b) }
    }
    case "this month":
      return { from: k(new Date(today.getFullYear(), today.getMonth(), 1)), to: k(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }
    case "next month":
      return { from: k(new Date(today.getFullYear(), today.getMonth() + 1, 1)), to: k(new Date(today.getFullYear(), today.getMonth() + 2, 0)) }
    case "this year":
      return { from: k(new Date(today.getFullYear(), 0, 1)), to: k(new Date(today.getFullYear(), 11, 31)) }
  }
  const nextN = /^(?:in )?(?:the )?next (\d+) (day|week|month)s?$/.exec(s)
  if (nextN) {
    const n = +nextN[1]!
    const to = nextN[2] === "day" ? addDays(today, n) : nextN[2] === "week" ? addDays(today, n * 7) : new Date(today.getFullYear(), today.getMonth() + n, today.getDate())
    return { from: k(today), to: k(to) }
  }
  return null
}

/** A phrase that names one span ("this week") or one day. */
export function parseSpan(raw: string, now: Date): DaySpan | null {
  const s = clean(raw).replace(/^(on|by|the|within)\s+/, "")
  const span = spanOf(s, now)
  if (span) return span
  const day = parseDay(s, now)
  return day ? { from: dayKey(day), to: dayKey(day) } : null
}

/** What was asked about the due date, in a tool call's own terms. */
export interface DueFilter {
  /** First day, inclusive. Omitted = no lower bound. */
  from?: string
  /** Last day, inclusive. Omitted = no upper bound. */
  to?: string
  /** The words, shown back to the person. */
  label: string
}

/**
 * The due clause of a line, or null when the line says nothing about being due. `error` carries a phrase that
 * was about being due but could not be read, so the helper can say which words it did not understand.
 */
export function parseDueClause(text: string, now: Date): { due: DueFilter } | { error: string } | null {
  const t = text.replace(/[“”"]/g, "")
  if (/\boverdue\b|\bpast due\b/i.test(t)) return { due: { to: dayKey(addDays(midnight(now), -1)), label: "overdue" } }

  const range = /\bdue\s+(?:from\s+)?(.+?)\s+(?:until|till|through|thru|to|and)\s+(.+?)(?=\s+(?:that|which|but|and|who|with|in|from|not)\b|[?.!]*$)/i.exec(t)
  if (range) {
    const a = parseSpan(range[1]!, now)
    const b = parseSpan(range[2]!, now)
    if (!a) return { error: `I couldn't read "${range[1]!.trim()}" as a date.` }
    if (!b) return { error: `I couldn't read "${range[2]!.trim()}" as a date.` }
    if (b.to < a.from) return { error: `"${range[2]!.trim()}" comes before "${range[1]!.trim()}".` }
    return { due: { from: a.from, to: b.to, label: `${range[1]!.trim()} – ${range[2]!.trim()}` } }
  }

  const upTo = /\bdue\s+(?:by|before|until|till|within|in the next)\s+(.+?)(?=\s+(?:that|which|but|and|who|with|in|from|not)\b|[?.!]*$)/i.exec(t)
  if (upTo) {
    const within = /\bwithin\b|\bin the next\b/i.test(upTo[0]!)
    const span = within ? parseSpan(`next ${upTo[1]!.replace(/^next\s+/i, "")}`, now) ?? parseSpan(upTo[1]!, now) : parseSpan(upTo[1]!, now)
    if (!span) return { error: `I couldn't read "${upTo[1]!.trim()}" as a date.` }
    return { due: { to: span.to, label: `by ${upTo[1]!.trim()}` } }
  }

  const after = /\bdue\s+(?:after|from)\s+(.+?)(?=\s+(?:that|which|but|and|who|with|in|not)\b|[?.!]*$)/i.exec(t)
  if (after) {
    const span = parseSpan(after[1]!, now)
    if (!span) return { error: `I couldn't read "${after[1]!.trim()}" as a date.` }
    return { due: { from: span.from, label: `from ${after[1]!.trim()}` } }
  }

  const on = /\bdue\s+(?:on\s+|in\s+)?(.+?)(?=\s+(?:that|which|but|and|who|with|from|not)\b|[?.!]*$)/i.exec(t)
  if (on) {
    const span = parseSpan(on[1]!, now)
    if (!span) return { error: `I couldn't read "${on[1]!.trim()}" as a date.` }
    return { due: { from: span.from, to: span.to, label: on[1]!.trim() } }
  }
  return null
}
