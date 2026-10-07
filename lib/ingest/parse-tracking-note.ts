/**
 * lib/ingest/parse-tracking-note.ts — log / intake / switch / transit grammar
 *
 * One parser each. Times without a date sit on the send date in the process
 * timezone (the same local clock the rest of Brain2 uses — there is no
 * separate user-timezone setting). `at 3:30` is a point. `10m` / `10 min` on
 * a log means that duration just finished. Intake never grows a duration.
 * A trailing `loc: name` on a log is a Location pen. `est` / `estimated` / `~`
 * and `unknown` mark the clock on log, intake, and switch lines.
 */
import { parseClockToken } from "./times"

const CLOCK = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{3,4}|noon|midnight)`

/** Set only when the line said the clock was estimated or unknown. Omitted = exact. */
export type NoteClockCertainty = "estimated" | "unknown"

export interface PointNote {
  shape: "point"
  title: string
  at: Date
  /** Lines after the event line. The clock stays on the first line. */
  note?: string
  clockCertainty?: NoteClockCertainty
  /** Trailing `loc: name` on a `log:` line. A Location pen, not a second place system. */
  location?: string
}

export interface RangeNote {
  shape: "range"
  title: string
  start: Date
  end: Date
  note?: string
  clockCertainty?: NoteClockCertainty
  location?: string
}

export interface BoundNote {
  shape: "start" | "end"
  title: string
  at: Date
  note?: string
  clockCertainty?: NoteClockCertainty
  location?: string
}

export type LogNote = PointNote | RangeNote | BoundNote

export interface SwitchNote {
  from?: string
  to: string
  at: Date
  note?: string
  clockCertainty?: NoteClockCertainty
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

const CERTAINTY_TAIL = /^(.*\S)\s+(unknown|estimated|est\.?|~)\s*$/i

/**
 * Trailing certainty on a log or intake line.
 * `unknown`, `est` / `estimated`, or a lone `~`. A clock with no token stays exact.
 */
export function peelClockCertainty(text: string): { text: string; clockCertainty?: NoteClockCertainty } {
  const match = CERTAINTY_TAIL.exec(text.trim())
  if (!match) return { text }
  const token = match[2]!.toLowerCase().replace(/\./g, "")
  const clockCertainty: NoteClockCertainty = token === "unknown" ? "unknown" : "estimated"
  const title = match[1]!.trim()
  if (!title) return { text }
  return { text: title, clockCertainty }
}

/** `~` glued to a clock (`~3:30`, `at ~ 8:15`) marks that clock estimated. */
function peelTildeClocks(text: string): { text: string; estimated: boolean } {
  const re = new RegExp(String.raw`~\s*(${CLOCK})`, "gi")
  let estimated = false
  const next = text.replace(re, (_all, clock: string) => {
    estimated = true
    return clock
  })
  return { text: next, estimated }
}

function combineCertainty(
  word: NoteClockCertainty | undefined,
  tilde: boolean,
): NoteClockCertainty | undefined {
  if (word === "unknown") return "unknown"
  if (word === "estimated" || tilde) return "estimated"
  return undefined
}

function withCertainty<T extends { clockCertainty?: NoteClockCertainty }>(
  row: T,
  clockCertainty?: NoteClockCertainty,
): T {
  return clockCertainty ? { ...row, clockCertainty } : row
}

/** Trailing `loc: name` on a log line. The place is the last suffix, after the clock. */
const LOC_TAIL = /^(.*\S)\s+loc\s*[:：]\s*(\S(?:.*\S)?)\s*$/i

export function peelLogLocation(text: string): { text: string; location?: string } {
  const match = LOC_TAIL.exec(text.trim())
  if (!match) return { text }
  const title = match[1]!.trim()
  const location = match[2]!.trim()
  if (!title || !location) return { text }
  return { text: title, location }
}

function withLocation<T extends { location?: string }>(row: T, location?: string): T {
  return location ? { ...row, location } : row
}

function preferCertainty(
  first: NoteClockCertainty | undefined,
  second: NoteClockCertainty | undefined,
): NoteClockCertainty | undefined {
  if (first === "unknown" || second === "unknown") return "unknown"
  if (first === "estimated" || second === "estimated") return "estimated"
  return undefined
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
  const rawLine = split.line
  if (!rawLine) return null
  const note = split.note
  const leading = peelClockCertainty(rawLine)
  const located = peelLogLocation(leading.text)
  const trailing = peelClockCertainty(located.text)
  const tildes = peelTildeClocks(trailing.text)
  const text = tildes.text
  const clockCertainty = combineCertainty(preferCertainty(leading.clockCertainty, trailing.clockCertainty), tildes.estimated)
  const location = located.location
  if (!text) return null

  const bound = /^(start|end)\s+(.+)$/i.exec(text)
  if (bound) {
    const shape = bound[1]!.toLowerCase() === "start" ? "start" : "end"
    const rest = bound[2]!.trim()
    const timed = peelAtClock(rest) ?? peelTrailingClock(rest)
    return withLocation(
      withCertainty(
        withNote(
          {
            shape,
            title: timed?.title ?? rest,
            at: timed ? atClockOnDay(sent, timed.minutes) : sent,
          },
          note,
        ),
        clockCertainty,
      ),
      location,
    )
  }

  const range = peelRange(text)
  if (range) {
    const clocks = rangeOnSendDate(sent, range.startMin, range.endMin)
    return withLocation(
      withCertainty(withNote({ shape: "range", title: range.title, ...clocks }, note), clockCertainty),
      location,
    )
  }

  const duration = peelDuration(text)
  if (duration) {
    const end = sent
    const start = new Date(sent.getTime() - duration.minutes * 60_000)
    return withLocation(
      withCertainty(withNote({ shape: "range", title: duration.title, start, end }, note), clockCertainty),
      location,
    )
  }

  const at = peelAtClock(text) ?? peelTrailingClock(text)
  if (at) {
    return withLocation(
      withCertainty(
        withNote({ shape: "point", title: at.title, at: atClockOnDay(sent, at.minutes) }, note),
        clockCertainty,
      ),
      location,
    )
  }

  return withLocation(
    withCertainty(withNote({ shape: "point", title: text, at: sent }, note), clockCertainty),
    location,
  )
}

/**
 * Intake is a point. A following clock is honored. A duration word stays in
 * the title — intake does not invent a span.
 */
export function parseIntakePayload(payload: string, sent: Date): PointNote | null {
  const split = splitEventLine(payload)
  const rawLine = split.line
  if (!rawLine) return null
  const word = peelClockCertainty(rawLine)
  const tildes = peelTildeClocks(word.text)
  const text = tildes.text
  const clockCertainty = combineCertainty(word.clockCertainty, tildes.estimated)
  if (!text) return null
  const at = peelAtClock(text) ?? peelTrailingClock(text)
  if (at) {
    return withCertainty(
      withNote({ shape: "point", title: at.title, at: atClockOnDay(sent, at.minutes) }, split.note),
      clockCertainty,
    )
  }
  return withCertainty(withNote({ shape: "point", title: text, at: sent }, split.note), clockCertainty)
}

/**
 * `from:` / `to:` labels. Unlabeled text is `to`. Optional `at 3:30` or a
 * trailing clock; otherwise the send time.
 */
export function parseSwitchPayload(payload: string, sent: Date): SwitchNote | null {
  const split = splitEventLine(payload)
  let text = split.line
  if (!text) return null
  const word = peelClockCertainty(text)
  const tildes = peelTildeClocks(word.text)
  text = tildes.text
  const clockCertainty = combineCertainty(word.clockCertainty, tildes.estimated)
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
    return withCertainty(withNote({ from: from || undefined, to, at }, note), clockCertainty)
  }
  const toOnly = text.match(/^\s*to\s*:\s*([\s\S]+)$/i)
  if (toOnly) {
    const to = toOnly[1]!.trim()
    if (!to) return null
    return withCertainty(withNote({ to, at }, note), clockCertainty)
  }
  return withCertainty(withNote({ to: text, at }, note), clockCertainty)
}
