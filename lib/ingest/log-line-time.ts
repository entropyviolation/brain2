/**
 * lib/ingest/log-line-time.ts — Clocks and US dates on log and switch lines
 *
 * A clock with no am/pm is military time: `12:04` is noon, `18:37` is 6:37pm,
 * `1:00` is 1:00am. `1pm`, `1:00pm`, `1 PM`, `1:00 PM`, and `1:00 p.m.` are
 * 13:00. Spaces and dots in the meridian are ignored. `7/4/26` and `7/4/2026`
 * are July 4, 2026 (month/day/year).
 *
 * Token meaning is `parseExpectedWhen` in `times.ts`. This file only peels a
 * suffix off a log or switch line. A bare integer is not a clock. Inbox
 * capture, sleep, and other text fields do not use this peel.
 */
import { EXPECTED_CLOCK_PATTERN, parseExpectedWhen } from "./times"

function onSendDate(sent: Date, minutes: number): Date {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(sent.getFullYear(), sent.getMonth(), sent.getDate(), hour, minute, 0, 0)
}

/** Same token as `EXPECTED_CLOCK_PATTERN`. A bare integer is not a clock. */
export const LOG_CLOCK_SRC = EXPECTED_CLOCK_PATTERN

const DATE_SRC = String.raw`\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})`

/**
 * Liberal log-line clock → minutes past midnight.
 * No meridian means military time. Returns null when the token is not a clock.
 */
export function parseLogClockToken(raw: string): number | null {
  const when = parseExpectedWhen(raw)
  if (!when || when.minutes == null || when.date) return null
  return when.minutes
}

/** A 1–2 digit token is not a clock. `1:00` and `1pm` are. A date beside a bare hour is not either. */
function remainderIsBareHour(text: string): boolean {
  const parts = text
    .split(/\s+/)
    .filter((part) => part && !/^at$/i.test(part) && !/^\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2})$/.test(part))
  return parts.length > 0 && parts.every((part) => /^\d{1,2}$/.test(part))
}

/** Drop a structural `at` so the remainder is a clock, a US date, or both. */
function stripWhenAt(text: string): string {
  return text
    .replace(/^at\s+/i, "")
    .replace(/(\d{1,2}\/\d{1,2}\/(?:\d{4}|\d{2}))\s+at\s+/i, "$1 ")
    .replace(/\s+at\s+(?=(?:\d|noon\b|midnight\b))/i, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * A whole remainder: empty (send time), a clock, `at` a clock, a US date,
 * or a date plus a clock. Meaning is `parseExpectedWhen`. A bare integer is
 * not a clock, even though that function would read a peeled `1`.
 * A date with no clock keeps the send time's hour and minute on that day.
 */
export function parseLogWhen(rest: string, sent: Date): Date | null {
  const text = rest.trim().replace(/\s+/g, " ")
  if (!text) return new Date(sent.getTime())
  if (remainderIsBareHour(text)) return null
  const expected = parseExpectedWhen(stripWhenAt(text))
  if (!expected) return null
  const minutes = expected.minutes == null ? sent.getHours() * 60 + sent.getMinutes() : expected.minutes
  if (expected.date) {
    const [year, month, day] = expected.date.split("-").map(Number)
    return new Date(year!, month! - 1, day!, Math.floor(minutes / 60), minutes % 60, 0, 0)
  }
  return onSendDate(sent, minutes)
}

/** Suffix date/time on a free-form log line. The title keeps its own spacing. */
export function peelLogLineWhen(text: string, sent: Date): { title: string; at: Date } | null {
  const source = text.trim()
  if (!source) return null

  const dateClock = new RegExp(
    String.raw`^(.*\S)\s+(${DATE_SRC})(?:\s+at)?\s+(${LOG_CLOCK_SRC})$`,
    "i",
  ).exec(source)
  if (dateClock) {
    const at = parseLogWhen(`${dateClock[2]} ${dateClock[3]}`, sent)
    const title = dateClock[1]!.trim()
    if (at && title) return { title, at }
  }

  const atClock = new RegExp(String.raw`^(.*\S)\s+at\s+(${LOG_CLOCK_SRC})$`, "i").exec(source)
  if (atClock) {
    const at = parseLogWhen(`at ${atClock[2]}`, sent)
    const title = atClock[1]!.trim()
    if (at && title) return { title, at }
  }

  const clock = new RegExp(String.raw`^(.*\S)\s+(${LOG_CLOCK_SRC})$`, "i").exec(source)
  if (clock) {
    const at = parseLogWhen(clock[2]!, sent)
    const title = clock[1]!.trim()
    if (at && title) return { title, at }
  }

  const atThenDate = new RegExp(
    String.raw`^(.*\S)\s+at\s+(${LOG_CLOCK_SRC})\s+(${DATE_SRC})$`,
    "i",
  ).exec(source)
  if (atThenDate) {
    const at = parseLogWhen(`${atThenDate[2]} ${atThenDate[3]}`, sent)
    const title = atThenDate[1]!.trim()
    if (at && title) return { title, at }
  }

  const clockThenDate = new RegExp(
    String.raw`^(.*\S)\s+(${LOG_CLOCK_SRC})\s+(${DATE_SRC})$`,
    "i",
  ).exec(source)
  if (clockThenDate) {
    const at = parseLogWhen(`${clockThenDate[2]} ${clockThenDate[3]}`, sent)
    const title = clockThenDate[1]!.trim()
    if (at && title) return { title, at }
  }

  const dateOnly = new RegExp(String.raw`^(.*\S)\s+(${DATE_SRC})$`, "i").exec(source)
  if (dateOnly) {
    const at = parseLogWhen(dateOnly[2]!, sent)
    const title = dateOnly[1]!.trim()
    if (at && title) return { title, at }
  }

  return null
}

/** `7:30 - 7:45` and `1:00 p.m. - 2:00 p.m.` on a log line. */
export function peelLogRange(text: string): { title: string; startMin: number; endMin: number } | null {
  const match = text.match(
    new RegExp(String.raw`^(.*\S)\s+(${LOG_CLOCK_SRC})\s*[-–—]\s*(${LOG_CLOCK_SRC})\s*$`, "i"),
  )
  if (!match) return null
  const startMin = parseLogClockToken(match[2]!)
  const endMin = parseLogClockToken(match[3]!)
  if (startMin == null || endMin == null) return null
  const title = match[1]!.trim()
  if (!title) return null
  return { title, startMin, endMin }
}
