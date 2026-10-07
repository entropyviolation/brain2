/**
 * lib/ingest/parse-tracking-note.ts — log / intake / switch / transit grammar
 *
 * One parser each. Times without a date sit on the send date in the process
 * timezone (the same local clock the rest of Brain2 uses — there is no
 * separate user-timezone setting). `at 3:30` is a point. `10m` / `10 min` on
 * a log means that duration just finished. Intake never grows a duration.
 * A trailing `loc: name` on a log is a Location pen. `est` / `estimated` / `~`
 * and `unknown` mark the clock on log, intake, and switch lines.
 * Log lines, switch lines, thought-process lines, and tracking-note clocks peel
 * one clock token and read it with `parseExpectedWhen`. A bare integer is not
 * a clock. A bare clock is military. `1:00 p.m.` is 13:00. Log, switch, and
 * thought-process lines also take a US date (`7/4/26`). Ordinary inbox text
 * does not.
 */
import { matchSavedLogKeyword } from "@/lib/log-keywords"
import { LOG_CLOCK_SRC, parseLogWhen, peelLogLineWhen, peelLogRange } from "./log-line-time"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { parseExpectedWhen } from "./times"

const CLOCK = LOG_CLOCK_SRC

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
  const when = parseExpectedWhen(raw.trim())
  if (!when || when.minutes == null || when.date) return null
  return when.minutes
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

/**
 * `log:` / `log` payload. Empty text is an error for the caller.
 * `keywords` is the saved list. Longest phrase wins when the remainder is a
 * log-line date/time or empty. No match keeps the free-form title.
 */
export function parseLogPayload(payload: string, sent: Date, keywords: readonly string[] = []): LogNote | null {
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

  const saved = matchSavedLogKeyword(text, keywords, (rest) => parseLogWhen(rest, sent) != null)
  if (saved) {
    const at = parseLogWhen(saved.rest, sent)
    if (at) {
      return withLocation(
        withCertainty(withNote({ shape: "point", title: saved.phrase, at }, note), clockCertainty),
        location,
      )
    }
  }

  const bound = /^(start|end)\s+(.+)$/i.exec(text)
  if (bound) {
    const shape = bound[1]!.toLowerCase() === "start" ? "start" : "end"
    const rest = bound[2]!.trim()
    const timed = peelLogLineWhen(rest, sent)
    return withLocation(
      withCertainty(
        withNote(
          {
            shape,
            title: timed?.title ?? rest,
            at: timed ? timed.at : sent,
          },
          note,
        ),
        clockCertainty,
      ),
      location,
    )
  }

  const range = peelLogRange(text)
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

  const when = peelLogLineWhen(text, sent)
  if (when) {
    return withLocation(
      withCertainty(withNote({ shape: "point", title: when.title, at: when.at }, note), clockCertainty),
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
 * A thought process is one point. The first line is the crystallized thought.
 * Later lines are the note. Clocks are the log-line peel (`parseExpectedWhen`):
 * send time when no clock is named, military when the clock is bare, `1pm` /
 * `1:00 PM` / `1:00 p.m.` at 13:00, and `7/4/26` as July 4, 2026. No range,
 * no saved keyword, no `loc:`.
 */
export function parseThoughtPayload(payload: string, sent: Date): PointNote | null {
  const split = splitEventLine(payload)
  const rawLine = split.line
  if (!rawLine) return null
  const word = peelClockCertainty(rawLine)
  const tildes = peelTildeClocks(word.text)
  const text = tildes.text.trim()
  const clockCertainty = combineCertainty(word.clockCertainty, tildes.estimated)
  if (!text) return null
  const when = peelLogLineWhen(text, sent)
  if (when) {
    return withCertainty(withNote({ shape: "point", title: when.title, at: when.at }, split.note), clockCertainty)
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
  const fromToWords = text.match(/^\s*from\s+(.+?)\s+to\s+(.+)$/i)
  if (fromToWords) {
    const from = fromToWords[1]!.trim()
    const to = fromToWords[2]!.trim()
    if (!to) return null
    return withCertainty(withNote({ from: from || undefined, to, at }, note), clockCertainty)
  }
  const toWord = text.match(/^\s*to\s+(.+)$/i)
  if (toWord) {
    const to = toWord[1]!.trim()
    if (!to) return null
    return withCertainty(withNote({ to, at }, note), clockCertainty)
  }
  return withCertainty(withNote({ to: text, at }, note), clockCertainty)
}

export interface SwitchCommand extends SwitchNote {
  /** Scope id when the line named a real view. Omitted means Activity. */
  scope?: string
}

/**
 * `switch:` payload. Scope word, then labeled `from:` / `to:`, or a bare
 * destination after the scope. The clock and date peel is the log-line peel:
 * `parseExpectedWhen` reads the token. A bare integer is not a clock.
 * Optional `7/4/26` or `7/4/2026` is month/day/year. This reader is only for
 * switch lines.
 */
export function parseSwitchCommand(payload: string, sent: Date): SwitchCommand | null {
  const split = splitEventLine(payload)
  let text = split.line
  if (!text) return null
  const word = peelClockCertainty(text)
  const tildes = peelTildeClocks(word.text)
  text = tildes.text
  const clockCertainty = combineCertainty(word.clockCertainty, tildes.estimated)
  if (!text) return null
  const when = peelSwitchWhen(text, sent)
  text = when.text.trim()
  if (!text) return null
  let scope: string | undefined
  let endsText = text
  if (!/^(?:from|to)(?=\s|:)/i.test(text)) {
    const peeled = peelScopePrefix(text)
    if (peeled) {
      scope = peeled.scopeId
      endsText = peeled.rest
    }
  }
  const ends = parseSwitchEnds(endsText)
  if (!ends) return null
  return withCertainty(
    withNote({ ...ends, at: when.at, ...(scope ? { scope } : {}) }, split.note),
    clockCertainty,
  )
}

function peelSwitchWhen(text: string, sent: Date): { text: string; at: Date } {
  const peeled = peelLogLineWhen(text, sent)
  if (!peeled) return { text, at: sent }
  return { text: peeled.title, at: peeled.at }
}

function peelScopePrefix(text: string): { scopeId: string; rest: string } | null {
  const labels: { id: string; label: string }[] = []
  for (const scope of useTimeTrackingStore.getState().scopes) {
    const name = scope.name.trim()
    if (name) labels.push({ id: scope.id, label: name })
    if (scope.id && scope.id.toLowerCase() !== name.toLowerCase()) labels.push({ id: scope.id, label: scope.id })
  }
  labels.sort((a, b) => b.label.length - a.label.length)
  for (const row of labels) {
    const match = new RegExp(`^${escapeRegExp(row.label)}(?:\\s+|$)`, "i").exec(text)
    if (!match) continue
    return { scopeId: row.id, rest: text.slice(match[0].length).trim() }
  }
  return null
}

function parseSwitchEnds(text: string): { from?: string; to: string } | null {
  const labeled = text.match(/^\s*from\s*:\s*([\s\S]*?)\s+to\s*:\s*([\s\S]+)$/i)
  if (labeled) {
    const to = labeled[2]!.trim()
    if (!to) return null
    const from = labeled[1]!.trim()
    return { from: from || undefined, to }
  }
  const toLabeled = text.match(/^\s*to\s*:\s*([\s\S]+)$/i)
  if (toLabeled) {
    const to = toLabeled[1]!.trim()
    if (!to) return null
    return { to }
  }
  const words = text.match(/^\s*from\s+(.+?)\s+to\s+(.+)$/i)
  if (words) {
    const to = words[2]!.trim()
    if (!to) return null
    const from = words[1]!.trim()
    return { from: from || undefined, to }
  }
  const toWord = text.match(/^\s*to\s+(.+)$/i)
  if (toWord) {
    const to = toWord[1]!.trim()
    if (!to) return null
    return { to }
  }
  const bare = text.trim()
  if (!bare) return null
  return { to: bare }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
