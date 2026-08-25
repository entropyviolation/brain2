/**
 * lib/parse-event-text.ts — Unstructured event schedule parser
 *
 * Turns pasted itinerary / tour-schedule text into draft calendar events.
 * Recognizes month+year headers, "Month Dayth: Title" lines, undated
 * continuation lines (inherit the last date), times like "@ 2PM PST",
 * SHOW venue locations, and merges consecutive identical all-day titles
 * into multi-day events.
 */

import { toLocalCalendarDate } from "@/lib/date-utils"

export interface ParsedEventDraft {
  title: string
  date: Date
  /** Inclusive end of a multi-day all-day span; omitted for single-day events. */
  endDate?: Date
  startTime: string
  endTime: string
  isAllDay: boolean
  location?: string
  description?: string
  color?: string
  /** Original line(s) that produced this draft, for preview/debug. */
  sourceLine: string
}

export interface ParseEventTextOptions {
  /** Fallback year when no month header has set one yet. Defaults to now's year. */
  defaultYear?: number
  /** Reference "now" for defaultYear. Defaults to `new Date()`. */
  now?: Date
}

export interface ParseEventTextResult {
  events: ParsedEventDraft[]
  /** Lines that could not be interpreted (non-empty, unmatched, no date context). */
  skipped: string[]
}

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

const MONTH_HEADER_RE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s*$/i

const DATED_LINE_RE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?\s*:\s*(.*)$/i

/** Matches a clock time after @, not a venue name. */
const TIME_AT_RE = /@\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b(?:\s*([A-Z]{2,5}))?/i

const SHOW_LOCATION_RE = /^SHOW\s*-\s*(.+?)\s*@\s*(.+)$/i

const COLOR_BY_PREFIX: Array<{ match: RegExp; color: string }> = [
  { match: /^SHOW\b/i, color: "#e89b6c" },
  { match: /^MEETING\b/i, color: "#b89fbf" },
  { match: /^GOAL\b/i, color: "#8b7ecc" },
  { match: /^RECORDING\b/i, color: "#8cd4a5" },
  { match: /^HOLD\b/i, color: "#9fc2a5" },
  { match: /^DRIVE\b/i, color: "#5f756d" },
  { match: /^OFF\b/i, color: "#6b7280" },
]

function findFirstYearInText(text: string): number | undefined {
  const match = /\b((?:19|20)\d{2})\b/.exec(text)
  return match ? Number(match[1]) : undefined
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0")
}

function parseClockTime(hourRaw: string, minuteRaw: string | undefined, ampm: string): string {
  let hour = Number(hourRaw)
  const minute = minuteRaw ? Number(minuteRaw) : 0
  const upper = ampm.toUpperCase()
  if (upper === "PM" && hour < 12) hour += 12
  if (upper === "AM" && hour === 12) hour = 0
  return `${pad2(hour)}:${pad2(minute)}`
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const next = (h + 1) % 24
  return `${pad2(next)}:${pad2(m)}`
}

function colorForTitle(title: string): string {
  for (const { match, color } of COLOR_BY_PREFIX) {
    if (match.test(title)) return color
  }
  return "#8cd4a5"
}

function makeDate(year: number, monthIndex: number, day: number): Date | null {
  if (day < 1 || day > 31 || monthIndex < 0 || monthIndex > 11) return null
  const d = toLocalCalendarDate(new Date(year, monthIndex, day))
  // Reject overflow (e.g. Feb 31 → Mar 3)
  if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) return null
  return d
}

interface ExtractedBody {
  title: string
  startTime?: string
  endTime?: string
  isAllDay: boolean
  location?: string
  description?: string
}

function extractBody(raw: string): ExtractedBody {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { title: "", isAllDay: true }
  }

  const showMatch = SHOW_LOCATION_RE.exec(trimmed)
  if (showMatch) {
    const cityPart = showMatch[1].trim()
    const venue = showMatch[2].trim()
    const title = `SHOW - ${cityPart}`
    return {
      title,
      isAllDay: true,
      location: venue,
    }
  }

  const timeMatch = TIME_AT_RE.exec(trimmed)
  if (timeMatch) {
    const startTime = parseClockTime(timeMatch[1], timeMatch[2], timeMatch[3])
    const tz = timeMatch[4]?.toUpperCase()
    const title = trimmed
      .slice(0, timeMatch.index)
      .replace(/\s*[-–—]?\s*$/, "")
      .trim() || trimmed
    return {
      title,
      startTime,
      endTime: addOneHour(startTime),
      isAllDay: false,
      description: tz ? `Timezone: ${tz}` : undefined,
    }
  }

  return {
    title: trimmed,
    isAllDay: true,
  }
}

function draftFromBody(body: ExtractedBody, date: Date, sourceLine: string): ParsedEventDraft | null {
  const title = body.title.trim()
  if (!title) return null

  return {
    title,
    date,
    startTime: body.isAllDay ? "00:00" : (body.startTime ?? "09:00"),
    endTime: body.isAllDay ? "23:59" : (body.endTime ?? "10:00"),
    isAllDay: body.isAllDay,
    location: body.location,
    description: body.description,
    color: colorForTitle(title),
    sourceLine,
  }
}

const DAY_MS = 24 * 60 * 60 * 1000

function calendarDayIndex(date: Date): number {
  const d = toLocalCalendarDate(date)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS
}

function mergeKey(event: ParsedEventDraft): string {
  return `${event.title.toLowerCase()}\0${(event.location ?? "").toLowerCase()}`
}

/**
 * Collapse consecutive all-day events that share the same title (and location)
 * into a single multi-day span with `endDate`. Timed events are left alone.
 * Same-day extras (e.g. a meeting under a trip day) stay separate.
 */
export function mergeConsecutiveAllDayEvents(events: ParsedEventDraft[]): ParsedEventDraft[] {
  const timed: ParsedEventDraft[] = []
  const allDay: ParsedEventDraft[] = []

  for (const event of events) {
    if (event.isAllDay) allDay.push(event)
    else timed.push(event)
  }

  allDay.sort((a, b) => {
    const byDate = calendarDayIndex(a.date) - calendarDayIndex(b.date)
    if (byDate !== 0) return byDate
    return a.title.localeCompare(b.title)
  })

  const byKey = new Map<string, ParsedEventDraft[]>()
  for (const event of allDay) {
    const key = mergeKey(event)
    const list = byKey.get(key)
    if (list) list.push(event)
    else byKey.set(key, [event])
  }

  const merged: ParsedEventDraft[] = []
  for (const group of byKey.values()) {
    let run: ParsedEventDraft | null = null
    for (const event of group) {
      if (!run) {
        run = { ...event }
        continue
      }
      const prevEnd = run.endDate ?? run.date
      const gap = calendarDayIndex(event.date) - calendarDayIndex(prevEnd)
      if (gap === 1) {
        run = {
          ...run,
          endDate: event.date,
          sourceLine: `${run.sourceLine}\n${event.sourceLine}`,
        }
      } else {
        merged.push(run)
        run = { ...event }
      }
    }
    if (run) merged.push(run)
  }

  return [...merged, ...timed].sort((a, b) => {
    const byDate = calendarDayIndex(a.date) - calendarDayIndex(b.date)
    if (byDate !== 0) return byDate
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

/**
 * Parse unstructured schedule text into draft events.
 *
 * Supports:
 * - `August 2026` month headers (set year/month context)
 * - `July 10th: DRIVE DAY` dated entries
 * - Undated continuation lines under the last dated day
 * - `@ 2PM PST` times and `SHOW - City @ Venue` locations
 * - Consecutive identical all-day titles → one multi-day event (`endDate`)
 */
export function parseEventText(text: string, options: ParseEventTextOptions = {}): ParseEventTextResult {
  const now = options.now ?? new Date()
  const scannedYear = findFirstYearInText(text)
  let year = options.defaultYear ?? scannedYear ?? now.getFullYear()

  let currentDate: Date | null = null
  const events: ParsedEventDraft[] = []
  const skipped: string[] = []

  const lines = text.replace(/\r\n/g, "\n").split("\n")

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const headerMatch = MONTH_HEADER_RE.exec(line)
    if (headerMatch) {
      year = Number(headerMatch[2])
      continue
    }

    const datedMatch = DATED_LINE_RE.exec(line)
    if (datedMatch) {
      const monthIndex = MONTHS[datedMatch[1].toLowerCase()]
      const day = Number(datedMatch[2])
      const rest = datedMatch[3].trim()
      const date = makeDate(year, monthIndex, day)
      if (!date) {
        skipped.push(line)
        continue
      }
      currentDate = date
      if (!rest) continue
      const draft = draftFromBody(extractBody(rest), date, line)
      if (draft) events.push(draft)
      else skipped.push(line)
      continue
    }

    // Continuation / undated line under the last known date
    if (currentDate) {
      const draft = draftFromBody(extractBody(line), currentDate, line)
      if (draft) events.push(draft)
      else skipped.push(line)
      continue
    }

    skipped.push(line)
  }

  return { events: mergeConsecutiveAllDayEvents(events), skipped }
}
