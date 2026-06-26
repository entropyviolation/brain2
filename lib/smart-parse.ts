/**
 * lib/smart-parse.ts — Classical smart-capture parser (Feature 10, Worker J)
 *
 * A pure, deterministic, LLM-free parser that turns a free-text capture (e.g.
 * "Work: call dentist tomorrow at 3pm for 30m !!") into a structured suggestion
 * plus a set of highlight ranges the UI can paint over the raw input.
 *
 * It recognizes, using regex + `date-fns` date math only:
 *   - a leading `Category:` hint (or inline `cat:`/`category:`)
 *   - relative + absolute dates (today/tomorrow, weekdays, "in N days",
 *     "next week/month/year", ISO/`M/D[/Y]`, and month-name dates)
 *   - times (`at 3`, `3:30pm`, `15:00`, `noon`, `midnight`)
 *   - priority markers (`!`/`!!`/`!!!`, `urgent`, `asap`, `important`)
 *   - durations (`for 30m`, `2h`, `1.5 hours`)
 *
 * Nothing here mutates state or talks to a store — callers map the returned
 * `SmartSuggestion` onto a `Task`. `now` is injectable so tests stay
 * deterministic across machines/timezones.
 */
import { addDays, addMonths, addYears, startOfDay } from "date-fns"

export type SmartTokenType = "category" | "date" | "time" | "priority" | "duration"

/** A recognized span in the original input, for inline highlighting. */
export interface SmartHighlight {
  /** Inclusive start index into the original input. */
  start: number
  /** Exclusive end index into the original input. */
  end: number
  type: SmartTokenType
  /** The exact matched substring. */
  text: string
}

/** Structured fields extracted from the capture text. */
export interface SmartSuggestion {
  /** The input with all recognized tokens stripped + whitespace collapsed. */
  description: string
  /** Category-name hint (not an id) — callers resolve/create the category. */
  category?: string
  /** Local-midnight date for the recognized day, if any. */
  scheduledDate?: Date
  /** 24h "HH:mm" time-of-day, if any. */
  scheduledTime?: string
  /** 1-5 urgency, if a priority marker implied it. */
  urgency?: number
  /** 1-5 importance, if a priority marker implied it. */
  importance?: number
  /** Estimated duration in minutes, if recognized. */
  estimatedDuration?: number
}

export interface SmartParseResult {
  input: string
  suggestion: SmartSuggestion
  highlights: SmartHighlight[]
}

export interface SmartParseOptions {
  /** Reference "now" for relative dates. Defaults to `new Date()`. */
  now?: Date
}

interface Candidate {
  start: number
  end: number
  type: SmartTokenType
  category?: string
  date?: Date
  time?: string
  urgency?: number
  importance?: number
  duration?: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Build a local-midnight Date, rolling a no-year date forward if already past. */
function dayDate(year: number, monthIndex: number, day: number): Date {
  return startOfDay(new Date(year, monthIndex, day))
}

function rollForwardIfPast(date: Date, ref: Date): Date {
  return date.getTime() < startOfDay(ref).getTime() ? addYears(date, 1) : date
}

/**
 * Parse a free-text capture into a structured suggestion + highlight ranges.
 * Pure and deterministic for a fixed `options.now`.
 */
export function parseSmartCapture(input: string, options: SmartParseOptions = {}): SmartParseResult {
  const now = options.now ?? new Date()
  const today0 = startOfDay(now)
  const candidates: Candidate[] = []

  // --- Category: leading "Name: ..." prefix (letters/spaces only, no digits) ---
  const leadingCat = /^\s*([A-Za-z][A-Za-z &/_-]*?)\s*:\s+(?=\S)/.exec(input)
  if (leadingCat) {
    candidates.push({
      start: leadingCat.index,
      end: leadingCat.index + leadingCat[0].length,
      type: "category",
      category: leadingCat[1].trim(),
    })
  }
  // Inline "cat:Foo" / "category:Foo"
  for (const m of input.matchAll(/\b(?:category|cat)\s*:\s*([A-Za-z][\w&/-]*)/gi)) {
    candidates.push({
      start: m.index!,
      end: m.index! + m[0].length,
      type: "category",
      category: m[1].trim(),
    })
  }

  // --- Dates: today / tonight / tomorrow / yesterday ---
  for (const m of input.matchAll(/\b(today|tonight|tomorrow|tmrw|tmr|yesterday)\b/gi)) {
    const word = m[1].toLowerCase()
    let date = today0
    if (word === "tomorrow" || word === "tmrw" || word === "tmr") date = addDays(today0, 1)
    else if (word === "yesterday") date = addDays(today0, -1)
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Dates: weekdays, optionally prefixed with next/this/on/by ---
  const weekdayRe = /\b(?:(next|this|on|by)\s+)?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)\b/gi
  for (const m of input.matchAll(weekdayRe)) {
    const prefix = m[1]?.toLowerCase()
    const target = WEEKDAY_INDEX[m[2].toLowerCase()]
    if (target === undefined) continue
    let delta = (target - today0.getDay() + 7) % 7 // 0 = today
    if (prefix === "next") delta = delta === 0 ? 7 : delta + 7
    candidates.push({
      start: m.index!,
      end: m.index! + m[0].length,
      type: "date",
      date: addDays(today0, delta),
    })
  }

  // --- Dates: next week / month / year / weekend ---
  for (const m of input.matchAll(/\bnext\s+(week|weekend|month|year)\b/gi)) {
    const unit = m[1].toLowerCase()
    let date = today0
    if (unit === "week") date = addDays(today0, 7)
    else if (unit === "month") date = addMonths(today0, 1)
    else if (unit === "year") date = addYears(today0, 1)
    else if (unit === "weekend") {
      const delta = (6 - today0.getDay() + 7) % 7 || 7 // upcoming Saturday
      date = addDays(today0, delta)
    }
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Dates: "in N days/weeks/months/years" ---
  for (const m of input.matchAll(/\bin\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)\b/gi)) {
    const n = Number(m[1])
    const unit = m[2].toLowerCase()
    let date = today0
    if (unit.startsWith("day")) date = addDays(today0, n)
    else if (unit.startsWith("week")) date = addDays(today0, n * 7)
    else if (unit.startsWith("month")) date = addMonths(today0, n)
    else if (unit.startsWith("year")) date = addYears(today0, n)
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Dates: ISO YYYY-MM-DD ---
  for (const m of input.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date: dayDate(y, mo - 1, d) })
  }

  // --- Dates: M/D or M/D/YYYY ---
  for (const m of input.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) {
    const mo = Number(m[1]), d = Number(m[2])
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue
    let year: number
    let date: Date
    if (m[3]) {
      year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
      date = dayDate(year, mo - 1, d)
    } else {
      date = rollForwardIfPast(dayDate(now.getFullYear(), mo - 1, d), now)
    }
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Dates: month-name + day (Jan 5 / January 5th, 2027) ---
  const monthDayRe = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi
  for (const m of input.matchAll(monthDayRe)) {
    const mo = MONTH_INDEX[m[1].slice(0, 3).toLowerCase()]
    const d = Number(m[2])
    if (mo === undefined || d < 1 || d > 31) continue
    const date = m[3]
      ? dayDate(Number(m[3]), mo, d)
      : rollForwardIfPast(dayDate(now.getFullYear(), mo, d), now)
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Dates: day + month-name (5 Jan / 5th of March) ---
  const dayMonthRe = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:,?\s+(\d{4}))?\b/gi
  for (const m of input.matchAll(dayMonthRe)) {
    const d = Number(m[1])
    const mo = MONTH_INDEX[m[2].slice(0, 3).toLowerCase()]
    if (mo === undefined || d < 1 || d > 31) continue
    const date = m[3]
      ? dayDate(Number(m[3]), mo, d)
      : rollForwardIfPast(dayDate(now.getFullYear(), mo, d), now)
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "date", date })
  }

  // --- Times: 12h (optionally "at") "3pm", "at 3:30 pm" ---
  for (const m of input.matchAll(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi)) {
    let hour = Number(m[1])
    const minute = m[2] ? Number(m[2]) : 0
    if (hour < 1 || hour > 12 || minute > 59) continue
    if (m[3].toLowerCase() === "pm" && hour !== 12) hour += 12
    if (m[3].toLowerCase() === "am" && hour === 12) hour = 0
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "time", time: `${pad2(hour)}:${pad2(minute)}` })
  }

  // --- Times: "at 15" / "at 9:30" (24h, requires the "at" anchor) ---
  for (const m of input.matchAll(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/gi)) {
    const hour = Number(m[1])
    const minute = m[2] ? Number(m[2]) : 0
    if (hour > 23 || minute > 59) continue
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "time", time: `${pad2(hour)}:${pad2(minute)}` })
  }

  // --- Times: bare 24h "15:00" ---
  for (const m of input.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) {
    const hour = Number(m[1])
    const minute = Number(m[2])
    if (hour > 23 || minute > 59) continue
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "time", time: `${pad2(hour)}:${pad2(minute)}` })
  }

  // --- Times: noon / midnight ---
  for (const m of input.matchAll(/\b(noon|midnight)\b/gi)) {
    candidates.push({
      start: m.index!,
      end: m.index! + m[0].length,
      type: "time",
      time: m[1].toLowerCase() === "noon" ? "12:00" : "00:00",
    })
  }

  // --- Priority: bang markers (standalone tokens only) ---
  for (const m of input.matchAll(/(^|\s)(!{1,3})(?=\s|$)/g)) {
    const bangs = m[2].length
    const start = m.index! + m[1].length
    const cand: Candidate = { start, end: start + bangs, type: "priority" }
    if (bangs >= 3) { cand.urgency = 5; cand.importance = 5 }
    else if (bangs === 2) cand.importance = 5
    else cand.importance = 4
    candidates.push(cand)
  }

  // --- Priority: words ---
  for (const m of input.matchAll(/\b(urgent|asap|important)\b/gi)) {
    const word = m[1].toLowerCase()
    const cand: Candidate = { start: m.index!, end: m.index! + m[0].length, type: "priority" }
    if (word === "important") cand.importance = 5
    else cand.urgency = 5
    candidates.push(cand)
  }

  // --- Duration: "for 30m", "2h", "1.5 hours" ---
  for (const m of input.matchAll(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(mins?|minutes?|m|hrs?|hours?|h)\b/gi)) {
    const value = Number(m[1])
    const unit = m[2].toLowerCase()
    const minutes = unit.startsWith("h") ? Math.round(value * 60) : Math.round(value)
    if (minutes <= 0) continue
    candidates.push({ start: m.index!, end: m.index! + m[0].length, type: "duration", duration: minutes })
  }

  // --- Resolve overlaps: earliest start wins; ties → longest span ---
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const selected: Candidate[] = []
  let lastEnd = -1
  for (const c of candidates) {
    if (c.start >= lastEnd) {
      selected.push(c)
      lastEnd = c.end
    }
  }

  // --- Fold selected candidates into a suggestion (first-wins per field) ---
  const suggestion: SmartSuggestion = { description: "" }
  for (const c of selected) {
    if (c.category && suggestion.category === undefined) suggestion.category = c.category
    if (c.date && suggestion.scheduledDate === undefined) suggestion.scheduledDate = c.date
    if (c.time && suggestion.scheduledTime === undefined) suggestion.scheduledTime = c.time
    if (c.duration && suggestion.estimatedDuration === undefined) suggestion.estimatedDuration = c.duration
    if (c.urgency) suggestion.urgency = Math.max(suggestion.urgency ?? 0, c.urgency)
    if (c.importance) suggestion.importance = Math.max(suggestion.importance ?? 0, c.importance)
  }

  // --- Build cleaned description by excising selected ranges ---
  let kept = ""
  let cursor = 0
  for (const c of selected) {
    kept += input.slice(cursor, c.start)
    kept += " "
    cursor = c.end
  }
  kept += input.slice(cursor)
  suggestion.description = kept
    .replace(/\s+/g, " ")
    .replace(/^[\s:,\-]+|[\s:,\-]+$/g, "")
    .trim()

  const highlights: SmartHighlight[] = selected.map((c) => ({
    start: c.start,
    end: c.end,
    type: c.type,
    text: input.slice(c.start, c.end),
  }))

  return { input, suggestion, highlights }
}
