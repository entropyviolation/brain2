/**
 * lib/screentime/map-events.ts — ActivityWatch events → local calendar intervals
 *
 * Pure. Window events ∩ not-afk only; AFK gaps stay untracked. Pieces shorter
 * than `minDurationSec` are dropped. Browser windows may become domain child
 * pens when a web-watcher event overlaps. Split at local midnight, then merge
 * adjacent same-pen slices. This is not a TimeEntry yet — no scope, no stamp.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { MINUTES_PER_DAY } from "@/lib/time-entries"
import {
  appPenId,
  categoryForApp,
  domainFromUrl,
  domainPenId,
  isBrowserApp,
  slugApp,
} from "./app-categories"

export interface AwEvent {
  timestamp: string
  duration: number
  data: Record<string, unknown>
}

export interface ScreenTimeInterval {
  date: string
  startMin: number
  endMin: number
  app: string
  title?: string
  domain?: string
  categoryId: string
  penId: string
  parentPenId: string
  penName: string
}

export interface MapScreenTimeOptions {
  minDurationSec?: number
  includeWebWatcher?: boolean
}

interface MsRange {
  startMs: number
  endMs: number
}

interface LabeledRange extends MsRange {
  app: string
  title?: string
  domain?: string
}

const DEFAULT_MIN_SEC = 15

function eventApp(data: Record<string, unknown>): string {
  return typeof data.app === "string" ? data.app.trim() : ""
}

function eventTitle(data: Record<string, unknown>): string | undefined {
  return typeof data.title === "string" && data.title.trim() ? data.title.trim() : undefined
}

function eventStatus(data: Record<string, unknown>): string | undefined {
  return typeof data.status === "string" ? data.status : undefined
}

function eventUrl(data: Record<string, unknown>): string {
  return typeof data.url === "string" ? data.url : ""
}

function toRange(event: AwEvent): MsRange | null {
  const startMs = Date.parse(event.timestamp)
  const duration = Number(event.duration)
  if (!Number.isFinite(startMs) || !Number.isFinite(duration) || duration <= 0) return null
  return { startMs, endMs: startMs + duration * 1000 }
}

function intersectRange(a: MsRange, b: MsRange): MsRange | null {
  const startMs = Math.max(a.startMs, b.startMs)
  const endMs = Math.min(a.endMs, b.endMs)
  return endMs > startMs ? { startMs, endMs } : null
}

function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(value)))
}

/** Local calendar day + minutes past midnight for an instant. */
export function msToLocalDateMin(ms: number): { date: string; min: number } {
  const d = new Date(ms)
  return {
    date: formatLocalDateKey(d),
    min: clampMinute(d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60_000),
  }
}

function minutesFromMidnight(ms: number, mode: "start" | "end"): number {
  const d = new Date(ms)
  const whole = d.getHours() * 60 + d.getMinutes()
  const frac = d.getSeconds() > 0 || d.getMilliseconds() > 0
  if (mode === "end" && frac) return clampMinute(whole + 1)
  return clampMinute(whole)
}

/** Split a half-open `[startMs, endMs)` at local midnights. End is exclusive, 0–1440. */
export function splitLocalDays(startMs: number, endMs: number): { date: string; startMin: number; endMin: number }[] {
  if (endMs <= startMs) return []
  const slices: { date: string; startMin: number; endMin: number }[] = []
  let cursor = startMs
  while (cursor < endMs) {
    const day = new Date(cursor)
    const midnightNext = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    const sliceEnd = Math.min(endMs, midnightNext)
    const startMin = minutesFromMidnight(cursor, "start")
    const endMin = sliceEnd >= midnightNext ? MINUTES_PER_DAY : minutesFromMidnight(sliceEnd, "end")
    const lo = clampMinute(startMin)
    let hi = clampMinute(endMin)
    if (hi <= lo && sliceEnd > cursor) hi = Math.min(MINUTES_PER_DAY, lo + 1)
    if (hi > lo) slices.push({ date: formatLocalDateKey(day), startMin: lo, endMin: hi })
    cursor = sliceEnd
  }
  return slices
}

function notAfkWindows(afkEvents: AwEvent[]): MsRange[] {
  const windows: MsRange[] = []
  for (const event of afkEvents) {
    if (eventStatus(event.data) !== "not-afk") continue
    const range = toRange(event)
    if (range) windows.push(range)
  }
  return windows.sort((a, b) => a.startMs - b.startMs)
}

function clipToNotAfk(range: MsRange, notAfk: MsRange[]): MsRange[] {
  const pieces: MsRange[] = []
  for (const window of notAfk) {
    const hit = intersectRange(range, window)
    if (hit) pieces.push(hit)
  }
  return pieces
}

function webPieces(webEvents: AwEvent[], range: MsRange): { startMs: number; endMs: number; domain: string }[] {
  const pieces: { startMs: number; endMs: number; domain: string }[] = []
  for (const event of webEvents) {
    const span = toRange(event)
    if (!span) continue
    const hit = intersectRange(range, span)
    if (!hit) continue
    const domain = domainFromUrl(eventUrl(event.data))
    if (!domain) continue
    pieces.push({ ...hit, domain })
  }
  return pieces.sort((a, b) => a.startMs - b.startMs)
}

function assignDomain(range: LabeledRange, webEvents: AwEvent[], includeWeb: boolean): LabeledRange[] {
  if (!includeWeb || !isBrowserApp(range.app)) return [range]
  const pieces = webPieces(webEvents, range)
  if (!pieces.length) return [range]

  const out: LabeledRange[] = []
  let cursor = range.startMs
  for (const piece of pieces) {
    if (piece.startMs > cursor) {
      out.push({ ...range, startMs: cursor, endMs: piece.startMs, domain: undefined })
    }
    const startMs = Math.max(cursor, piece.startMs)
    if (piece.endMs > startMs) {
      out.push({ ...range, startMs, endMs: piece.endMs, domain: piece.domain })
      cursor = piece.endMs
    }
  }
  if (cursor < range.endMs) out.push({ ...range, startMs: cursor, endMs: range.endMs, domain: undefined })
  return out
}

function toInterval(app: string, title: string | undefined, domain: string | undefined, slice: { date: string; startMin: number; endMin: number }): ScreenTimeInterval {
  const category = categoryForApp(app)
  const browserSlug = slugApp(app)
  const appId = appPenId(browserSlug)
  if (domain && isBrowserApp(app)) {
    return {
      ...slice,
      app,
      title,
      domain,
      categoryId: category.id,
      penId: domainPenId(browserSlug, slugApp(domain)),
      parentPenId: appId,
      penName: domain,
    }
  }
  return {
    ...slice,
    app,
    title,
    categoryId: category.id,
    penId: appId,
    parentPenId: category.id,
    penName: app,
  }
}

function mergeSamePen(intervals: ScreenTimeInterval[]): ScreenTimeInterval[] {
  const sorted = [...intervals].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.penId.localeCompare(b.penId))
  const merged: ScreenTimeInterval[] = []
  for (const interval of sorted) {
    const previous = merged[merged.length - 1]
    if (
      previous &&
      previous.date === interval.date &&
      previous.penId === interval.penId &&
      previous.parentPenId === interval.parentPenId &&
      interval.startMin <= previous.endMin
    ) {
      previous.endMin = Math.max(previous.endMin, interval.endMin)
      if (!previous.title && interval.title) previous.title = interval.title
      continue
    }
    merged.push({ ...interval })
  }
  return merged
}

/**
 * ActivityWatch window / AFK / optional web events → local-day intervals.
 * Empty app names are ignored. Missing AFK status is not "not-afk".
 */
export function mapScreenTimeEvents(
  windowEvents: AwEvent[],
  afkEvents: AwEvent[],
  webEvents: AwEvent[] = [],
  options: MapScreenTimeOptions = {},
): ScreenTimeInterval[] {
  const minDurationSec = options.minDurationSec ?? DEFAULT_MIN_SEC
  const includeWebWatcher = options.includeWebWatcher ?? true
  const notAfk = notAfkWindows(afkEvents)
  const labeled: LabeledRange[] = []

  for (const event of windowEvents) {
    const app = eventApp(event.data)
    if (!app) continue
    const range = toRange(event)
    if (!range) continue
    const title = eventTitle(event.data)
    for (const clipped of clipToNotAfk(range, notAfk)) {
      const seconds = (clipped.endMs - clipped.startMs) / 1000
      if (seconds < minDurationSec) continue
      for (const piece of assignDomain({ ...clipped, app, title }, webEvents, includeWebWatcher)) {
        labeled.push(piece)
      }
    }
  }

  const intervals: ScreenTimeInterval[] = []
  for (const piece of labeled) {
    for (const slice of splitLocalDays(piece.startMs, piece.endMs)) {
      intervals.push(toInterval(piece.app, piece.title, piece.domain, slice))
    }
  }
  return mergeSamePen(intervals)
}
