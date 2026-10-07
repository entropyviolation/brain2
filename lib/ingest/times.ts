/**
 * lib/ingest/times.ts — Clock / duration / sleep-range parsing for ingest phrases
 *
 * Deterministic, LLM-free. `now` is injectable for tests.
 * `parseExpectedWhen` is the clock or US date for a log or switch line that
 * already expects one. Sleep, track windows, and inbox text do not use it.
 */
const MINUTES_PER_DAY = 1440

export function minutesPastMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** Morning key for a sleep log: before noon → today; otherwise tomorrow's morning. */
export function sleepMorningKey(now: Date): Date {
  if (now.getHours() < 12) return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return addLocalDays(now, 1)
}

const CLOCK_RE =
  /\b(?:noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(\d{3,4}))\b/i

/** Collapse dotted or spaced `a.m.` / `p.m.` so the clock regex can read the token. */
function normalizeClockToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/([ap])\s*\.?\s*m\s*\.?$/i, "$1m")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseClockToken(raw: string, assume?: "am" | "pm"): number | null {
  const text = normalizeClockToken(raw)
  if (!text) return null
  if (text === "noon") return 12 * 60
  if (text === "midnight") return 0

  const m = text.match(/^(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(\d{3,4}))$/)
  if (!m) return null

  let hour: number
  let minute: number
  let mer = (m[3] || assume || "").toLowerCase()

  if (m[4]) {
    const compact = m[4]
    if (compact.length === 3) {
      hour = Number(compact.slice(0, 1))
      minute = Number(compact.slice(1))
    } else {
      hour = Number(compact.slice(0, 2))
      minute = Number(compact.slice(2))
    }
  } else {
    hour = Number(m[1])
    minute = m[2] ? Number(m[2]) : 0
  }

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null

  if (mer === "am" || mer === "pm") {
    if (hour === 12) hour = 0
    if (mer === "pm") hour += 12
  } else if (hour > 24) {
    return null
  } else if (hour === 24 && minute === 0) {
    return 0
  }

  if (hour > 23) return null
  return hour * 60 + minute
}

/**
 * Clock token a log line, a switch line, or a tracking-note clock may peel.
 * A bare 1–2 digit hour is not a token, so `route 12` stays in the title.
 * `parseExpectedWhen` reads a token this pattern already isolated.
 * A bare clock (`1:00`, `18:37`) is military. `1pm` and `1:00 p.m.` are twelve-hour.
 */
export const EXPECTED_CLOCK_PATTERN =
  String.raw`(?:\d{1,2}(?:\s*:\s*\d{2})?\s*[ap]\s*\.?\s*m\s*\.?|\d{1,2}\s*:\s*\d{2}|\d{3,4}|noon|midnight)`

export interface ExpectedWhen {
  /** Local minute of day. Null when the text named a date and no clock. */
  minutes: number | null
  /** Local `YYYY-MM-DD` when the text named a US month/day/year. */
  date?: string
}

const US_DATE_TOKEN = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/

/** Two-digit years match switch lines: 00–69 → 2000s, 70–99 → 1900s. `26` is 2026. */
function parseLocalUsDate(raw: string): string | null {
  const match = US_DATE_TOKEN.exec(raw.trim())
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const yearText = match[3]!
  const year =
    yearText.length === 4 ? Number(yearText) : Number(yearText) >= 70 ? 1900 + Number(yearText) : 2000 + Number(yearText)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const probe = new Date(year, month - 1, day)
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function clockBesideDate(text: string): { minutes: number; date: string } | null {
  const dateFirst = /^(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\s+(.+)$/.exec(text)
  const clockFirst = dateFirst ? null : /^(.+?)\s+(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))$/.exec(text)
  const dateToken = dateFirst?.[1] ?? clockFirst?.[2]
  const clockToken = (dateFirst?.[2] ?? clockFirst?.[1] ?? "").trim()
  if (!dateToken || !clockToken) return null
  const date = parseLocalUsDate(dateToken)
  const minutes = parseClockToken(clockToken)
  if (!date || minutes == null) return null
  return { minutes, date }
}

/**
 * Log lines, switch lines, and tracking-note clocks that already expect a clock or a
 * date should call `parseExpectedWhen`. A bare clock is military (`1:00` is 01:00).
 * A date alone does not invent a clock (`minutes` stays null). Ordinary sentences
 * return null — call this only on a token a log, switch, or tracking-note line already peeled.
 * A bare integer is not peeled, so this function is not how `route 12` becomes a clock.
 */
export function parseExpectedWhen(raw: string): ExpectedWhen | null {
  const text = raw.trim().replace(/\s+/g, " ")
  if (!text) return null
  const dateOnly = parseLocalUsDate(text)
  if (dateOnly) return { minutes: null, date: dateOnly }
  if (!text.includes("/")) {
    const minutes = parseClockToken(text)
    return minutes == null ? null : { minutes }
  }
  const both = clockBesideDate(text)
  if (!both) return null
  return { minutes: both.minutes, date: both.date }
}

/**
 * First clock in a sleep range: 8–11 without am/pm is evening (PM).
 * 12 without am/pm is midnight. 1–5 is late night (AM).
 */
export function parseBedClock(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase()
  if (/\b(am|pm)\b/.test(trimmed) || /noon|midnight/.test(trimmed)) {
    return parseClockToken(trimmed)
  }
  const compact = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (compact) {
    const hour = Number(compact[1])
    if (hour >= 8 && hour <= 11) return parseClockToken(trimmed, "pm")
    if (hour === 12) return 0
    if (hour >= 1 && hour <= 5) return parseClockToken(trimmed, "am")
  }
  return parseClockToken(trimmed)
}

export function parseWakeClock(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase()
  if (/\b(am|pm)\b/.test(trimmed) || /noon|midnight/.test(trimmed)) {
    return parseClockToken(trimmed)
  }
  const compact = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (compact) {
    const hour = Number(compact[1])
    if (hour >= 1 && hour <= 11) return parseClockToken(trimmed, "am")
    if (hour === 12) return 12 * 60
  }
  return parseClockToken(trimmed)
}

const DURATION_RE = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i

export function parseDurationMinutes(text: string): number | null {
  const m = text.match(DURATION_RE)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  const unit = m[2].toLowerCase()
  if (unit.startsWith("h")) return Math.round(n * 60)
  return Math.round(n)
}

export function parseSleepRange(payload: string): { sleptMin: number; wokeMin: number } | null {
  const parts = payload.split(/\s*(?:-|–|—|to)\s*/i).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null
  const bed = parseBedClock(parts[0])
  const wake = parseWakeClock(parts[1])
  if (bed == null || wake == null) return null
  let sleptMin = bed
  // Night that crosses midnight: store bedtime as minutes before the morning
  // midnight (negative), matching lib/sleep-log.ts.
  if (sleptMin >= wake) sleptMin = sleptMin - MINUTES_PER_DAY
  return { sleptMin, wokeMin: wake }
}

export interface TrackWindow {
  startMin: number
  endMin: number
  /** When the window started on the previous local day. */
  previousDay?: boolean
}

/**
 * Parse `30m`, `9-11`, `from 9 to 9:30`. Duration without clocks = ending at `now`.
 */
export function parseTrackWindow(payload: string, now: Date): TrackWindow | null {
  const duration = parseDurationMinutes(payload)
  const rangeParts = payload.split(/\s*(?:-|–|—|to)\s*/i).map((p) => p.trim()).filter(Boolean)
  if (rangeParts.length === 2) {
    const start = parseClockToken(stripLeadingFrom(rangeParts[0]))
    const end = parseClockToken(rangeParts[1])
    if (start != null && end != null && end !== start) {
      if (end > start) return { startMin: start, endMin: end }
      return { startMin: start, endMin: MINUTES_PER_DAY }
    }
  }

  if (duration != null) {
    const nowMin = minutesPastMidnight(now)
    const start = nowMin - duration
    if (start >= 0) return { startMin: start, endMin: nowMin || 1 }
    return {
      startMin: MINUTES_PER_DAY + start,
      endMin: MINUTES_PER_DAY,
      previousDay: true,
    }
  }

  return null
}

function stripLeadingFrom(text: string): string {
  return text.replace(/^from\s+/i, "").trim()
}

export function findClockTokens(text: string): string[] {
  const out: string[] = []
  const re = new RegExp(CLOCK_RE, "gi")
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) out.push(m[0])
  return out
}

export { MINUTES_PER_DAY }
