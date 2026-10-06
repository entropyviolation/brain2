/**
 * lib/ingest/parse-tracking-note.ts — log / intake / switch / transit grammar
 *
 * One parser each. Times without a date sit on the send date in the process
 * timezone (the same local clock the rest of Brain2 uses — there is no
 * separate user-timezone setting). `at 3:30` is a point. `10m` / `10 min` on
 * a log means that duration just finished. Intake never grows a duration.
 */
import { parseClockToken } from "./times"

const CLOCK = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}|noon|midnight)`

export interface PointNote {
  shape: "point"
  title: string
  at: Date
  /** Lines after the event line. The clock stays on the first line. */
  note?: string
}

export interface RangeNote {
  shape: "range"
  title: string
  start: Date
  end: Date
  note?: string
}

export interface BoundNote {
  shape: "start" | "end"
  title: string
  at: Date
  note?: string
}

export type LogNote = PointNote | RangeNote | BoundNote

export interface SwitchNote {
  from?: string
  to: string
  at: Date
  note?: string
}

/**
 * First line is the event. Later lines are the note.
 * A leading `note:` on those lines is the label, not part of the text.
 * A note with no event line becomes the line.
 */
export function splitEventLine(payload: string): { line: string; note?: string } {
  const text = payload.replace(/\r\n/g, "\n").trim()
  if (!text) return { line: "" }
  const breakAt = text.indexOf("\n")
  if (breakAt === -1) return { line: text }
  const line = text.slice(0, breakAt).trim()
  const note = text
    .slice(breakAt + 1)
    .trim()
    .replace(/^(?:notes?|n)\s*[:：]\s*/i, "")
    .trim()
  if (!line && note) return { line: note }
  return { line, note: note || undefined }
}

function withNote<T extends { note?: string }>(row: T, note?: string): T {
  return note ? { ...row, note } : row
}

export function atClockOnDay(sent: Date, minutes: number): Date {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return new Date(sent.getFullYear(), sent.getMonth(), sent.getDate(), hour, minute, 0, 0)
}

function clockMinutes(raw: string): number | null {
  return parseClockToken(raw.trim())
}

/** Trailing clock. A bare integer is not a clock (`route 12` stays in the title). */
function peelTrailingClock(text: string): { title: string; minutes: number } | null {
  const match = text.match(new RegExp(String.raw`^(.*\S)\s+(${CLOCK})\s*$`, "i"))
  if (!match) return null
  const token = match[2]!.trim()
  if (!/[:ap]|noon|midnight/i.test(token) && !/^\d{3,4}$/.test(token)) return null
  const minutes = clockMinutes(token)
  if (minutes == null) return null
  const title = match[1]!.trim()
  if (!title) return null
  return { title, minutes }
}

function peelAtClock(text: string): { title: string; minutes: number } | null {
  const match = text.match(new RegExp(String.raw`^(.*\S)\s+at\s+(${CLOCK})\s*$`, "i"))
  if (!match) return null
  const minutes = clockMinutes(match[2]!)
  if (minutes == null) return null
  const title = match[1]!.trim()
  if (!title) return null
  return { title, minutes }
}

function peelRange(text: string): { title: string; startMin: number; endMin: number } | null {
  const match = text.match(new RegExp(String.raw`^(.*\S)\s+(${CLOCK})\s*[-–—]\s*(${CLOCK})\s*$`, "i"))
  if (!match) return null
  const startMin = clockMinutes(match[2]!)
  const endMin = clockMinutes(match[3]!)
  if (startMin == null || endMin == null) return null
  const title = match[1]!.trim()
  if (!title) return null
  return { title, startMin, endMin }
}

function peelDuration(text: string): { title: string; minutes: number } | null {
  const match = text.match(/^(.*\S)\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m)\s*$/i)
  if (!match) return null
  const minutes = Number(match[2])
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  const title = match[1]!.trim()
  if (!title) return null
  return { title, minutes }
}

function rangeOnSendDate(sent: Date, startMin: number, endMin: number): { start: Date; end: Date } {
  const start = atClockOnDay(sent, startMin)
  let end = atClockOnDay(sent, endMin)
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

/** `log:` payload. Empty text is an error for the caller. */
export function parseLogPayload(payload: string, sent: Date): LogNote | null {
  const split = splitEventLine(payload)
  const text = split.line
  if (!text) return null
  const note = split.note

  const bound = /^(start|end)\s+(.+)$/i.exec(text)
  if (bound) {
    const shape = bound[1]!.toLowerCase() === "start" ? "start" : "end"
    const rest = bound[2]!.trim()
    const timed = peelAtClock(rest) ?? peelTrailingClock(rest)
    return withNote(
      {
        shape,
        title: timed?.title ?? rest,
        at: timed ? atClockOnDay(sent, timed.minutes) : sent,
      },
      note,
    )
  }

  const range = peelRange(text)
  if (range) {
    const clocks = rangeOnSendDate(sent, range.startMin, range.endMin)
    return withNote({ shape: "range", title: range.title, ...clocks }, note)
  }

  const duration = peelDuration(text)
  if (duration) {
    const end = sent
    const start = new Date(sent.getTime() - duration.minutes * 60_000)
    return withNote({ shape: "range", title: duration.title, start, end }, note)
  }

  const at = peelAtClock(text) ?? peelTrailingClock(text)
  if (at) return withNote({ shape: "point", title: at.title, at: atClockOnDay(sent, at.minutes) }, note)

  return withNote({ shape: "point", title: text, at: sent }, note)
}

/**
 * Intake is a point. A following clock is honored. A duration word stays in
 * the title — intake does not invent a span.
 */
export function parseIntakePayload(payload: string, sent: Date): PointNote | null {
  const split = splitEventLine(payload)
  const text = split.line
  if (!text) return null
  const at = peelAtClock(text) ?? peelTrailingClock(text)
  if (at) return withNote({ shape: "point", title: at.title, at: atClockOnDay(sent, at.minutes) }, split.note)
  return withNote({ shape: "point", title: text, at: sent }, split.note)
}

/**
 * `from:` / `to:` labels. Unlabeled text is `to`. Optional `at 3:30` or a
 * trailing clock; otherwise the send time.
 */
export function parseSwitchPayload(payload: string, sent: Date): SwitchNote | null {
  const split = splitEventLine(payload)
  let text = split.line
  if (!text) return null
  let at = sent
  const timed = peelAtClock(text) ?? peelTrailingClock(text)
  if (timed) {
    text = timed.title
    at = atClockOnDay(sent, timed.minutes)
  }
  const note = split.note
  const fromTo = text.match(/^\s*from\s*:\s*([\s\S]*?)\s+to\s*:\s*([\s\S]+)$/i)
  if (fromTo) {
    const from = fromTo[1]!.trim()
    const to = fromTo[2]!.trim()
    if (!to) return null
    return withNote({ from: from || undefined, to, at }, note)
  }
  const toOnly = text.match(/^\s*to\s*:\s*([\s\S]+)$/i)
  if (toOnly) {
    const to = toOnly[1]!.trim()
    if (!to) return null
    return withNote({ to, at }, note)
  }
  return withNote({ to: text, at }, note)
}
