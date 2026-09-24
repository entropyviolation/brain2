/**
 * lib/screentime/sync.ts — Paint ActivityWatch meaning onto the Screen Time scope
 *
 * Brain2 never becomes a window watcher. This module fetches AW events
 * (Electron `window.desktop.fetchScreenTime` or the localhost `/api/screentime`
 * hub), maps them to estimated blocks on the Screen Time scope, and replaces
 * only that day's `generatedBy.kind === "screentime"` stamps. Hand-painted
 * time survives. Activity / Location / Mood / Company are never written.
 * Fetch success with 0 blocks is honest (no usable AW events yet), not an error.
 */
"use client"

import { formatLocalDateKey } from "@/lib/date-utils"
import { mergeAdjacent, type TimeEntry } from "@/lib/time-entries"
import * as trackingStore from "@/lib/time-tracking-store"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { slugApp } from "./app-categories"
import { mapScreenTimeEvents, type AwEvent, type ScreenTimeInterval } from "./map-events"
import { loadScreenTimePrefs, saveScreenTimePrefs } from "./prefs"

export const SCREENTIME_HUB_PATH = "/api/screentime"
export const SCREENTIME_SCOPE_ID = "screentime"

export type FetchScreenTimeRequest = {
  url?: string
  startISO?: string
  endISO?: string
  mode?: "health" | "events"
  includeWeb?: boolean
}

export type FetchScreenTimeResult =
  | { ok: true; mode: "health"; reachable: true; hostname?: string; version?: string }
  | { ok: true; mode: "events"; windowEvents: AwEvent[]; afkEvents: AwEvent[]; webEvents: AwEvent[] }
  | { ok: false; error: string; code?: string }

export interface DesktopScreenTimeBridge {
  fetchScreenTime?: (req: FetchScreenTimeRequest) => Promise<FetchScreenTimeResult>
}

export interface FetchScreenTimeDeps {
  desktop?: DesktopScreenTimeBridge
  fetch?: typeof fetch
  location?: Pick<Location, "hostname">
}

type ScreenTimeStoreHelpers = {
  SCREENTIME_SCOPE_ID?: string
  findScreenTimeScope?: (scopes: TrackScope[]) => TrackScope | undefined
  isScreenTimeScope?: (scope: TrackScope) => boolean
  defaultScreenTimeScope?: () => TrackScope
  SCREENTIME_CATEGORY_PENS?: TrackPen[]
}

const storeHelpers = trackingStore as typeof trackingStore & ScreenTimeStoreHelpers

const ACTIVITY_SCOPE_ID = "activity"

const DEFAULT_CATEGORY_PENS: TrackPen[] = [
  { id: "st-cat-work", name: "Work", color: "#2563eb" },
  { id: "st-cat-communication", name: "Communication", color: "#ec4899" },
  { id: "st-cat-browsing", name: "Browsing", color: "#0ea5e9" },
  { id: "st-cat-media", name: "Media", color: "#8b5cf6" },
  { id: "st-cat-system", name: "System", color: "#64748b" },
  { id: "st-cat-other", name: "Other", color: "#f59e0b" },
]

const MAC_SCREENTIME_UNAVAILABLE =
  "ActivityWatch is read on this Mac. Open Brain2 at http://localhost:3000 or the desktop window, then try again."

export function appPenSlug(name: string): string {
  return slugApp(name)
}

export function getDesktopScreenTimeBridge(): DesktopScreenTimeBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: DesktopScreenTimeBridge }).desktop
}

export function isLocalScreenTimeHubOrigin(
  location: Pick<Location, "hostname"> | undefined = typeof window === "undefined" ? undefined : window.location,
): boolean {
  if (!location) return false
  const host = location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
}

function hashPenColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PEN_PALETTE[hash % PEN_PALETTE.length]
}

function scopeId(): string {
  return storeHelpers.SCREENTIME_SCOPE_ID ?? SCREENTIME_SCOPE_ID
}

function categoryPens(): TrackPen[] {
  return storeHelpers.SCREENTIME_CATEGORY_PENS ?? DEFAULT_CATEGORY_PENS
}

function defaultScope(): TrackScope {
  if (storeHelpers.defaultScreenTimeScope) return storeHelpers.defaultScreenTimeScope()
  return { id: scopeId(), name: "Screen Time", pens: categoryPens().map((pen) => ({ ...pen })) }
}

export function findScreenTimeScope(scopes: TrackScope[]): TrackScope | undefined {
  if (storeHelpers.findScreenTimeScope) return storeHelpers.findScreenTimeScope(scopes)
  const id = scopeId()
  return scopes.find((scope) => scope.id === id || /^screen time$/i.test(scope.name.trim()))
}

function isOurStamp(entry: TimeEntry, date: string): boolean {
  const gen = entry.generatedBy as { kind?: string; id?: string } | undefined
  return gen?.kind === "screentime" && gen.id === date
}

function stamp(date: string): NonNullable<TimeEntry["generatedBy"]> {
  return { kind: "screentime", id: date } as NonNullable<TimeEntry["generatedBy"]>
}

function parseAwEvents(raw: unknown): AwEvent[] {
  if (!Array.isArray(raw)) return []
  const out: AwEvent[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const timestamp = typeof r.timestamp === "string" ? r.timestamp : ""
    const duration = typeof r.duration === "number" ? r.duration : Number(r.duration)
    if (!timestamp || !Number.isFinite(duration)) continue
    const data = r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : {}
    out.push({ timestamp, duration, data })
  }
  return out
}

function asHealth(result: FetchScreenTimeResult): FetchScreenTimeResult {
  if (!result.ok) return result
  if (result.mode === "health") return result
  return { ok: false, code: "parse", error: "ActivityWatch returned an unexpected health payload." }
}

function asEvents(result: FetchScreenTimeResult): FetchScreenTimeResult {
  if (!result.ok) return result
  if (result.mode !== "events") {
    return { ok: false, code: "parse", error: "ActivityWatch returned an unexpected events payload." }
  }
  return {
    ok: true,
    mode: "events",
    windowEvents: parseAwEvents(result.windowEvents),
    afkEvents: parseAwEvents(result.afkEvents),
    webEvents: parseAwEvents(result.webEvents),
  }
}

async function fetchScreenTimeViaHub(
  req: FetchScreenTimeRequest,
  deps: FetchScreenTimeDeps,
): Promise<FetchScreenTimeResult> {
  const fetchFn = deps.fetch ?? (typeof fetch === "function" ? fetch : undefined)
  if (!fetchFn) return { ok: false, code: "unavailable", error: MAC_SCREENTIME_UNAVAILABLE }
  try {
    if (req.mode === "health") {
      const res = await fetchFn(`${SCREENTIME_HUB_PATH}/health`, { method: "GET", headers: { Accept: "application/json" } })
      const result = (await res.json()) as FetchScreenTimeResult
      if (!result || typeof result !== "object") {
        return { ok: false, code: "parse", error: "ActivityWatch returned an unexpected payload." }
      }
      return asHealth(result)
    }
    const res = await fetchFn(SCREENTIME_HUB_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(req),
    })
    const result = (await res.json()) as FetchScreenTimeResult
    if (!result || typeof result !== "object") {
      return { ok: false, code: "parse", error: "ActivityWatch returned an unexpected payload." }
    }
    return asEvents(result)
  } catch {
    return { ok: false, code: "unavailable", error: MAC_SCREENTIME_UNAVAILABLE }
  }
}

export async function fetchScreenTime(
  req: FetchScreenTimeRequest = {},
  deps: FetchScreenTimeDeps = {},
): Promise<FetchScreenTimeResult> {
  const desktop = deps.desktop ?? getDesktopScreenTimeBridge()
  if (desktop?.fetchScreenTime) {
    try {
      const result = await desktop.fetchScreenTime(req)
      if (!result || typeof result !== "object") {
        return { ok: false, code: "parse", error: "ActivityWatch returned an unexpected payload." }
      }
      if (!result.ok) {
        return { ok: false, code: result.code, error: result.error || "Failed to read ActivityWatch." }
      }
      return req.mode === "health" ? asHealth(result) : asEvents(result)
    } catch (err) {
      return {
        ok: false,
        code: "desktop",
        error: err instanceof Error ? err.message : "Failed to read ActivityWatch.",
      }
    }
  }
  const location = deps.location ?? (typeof window === "undefined" ? undefined : window.location)
  if (!isLocalScreenTimeHubOrigin(location)) {
    return { ok: false, code: "unavailable", error: MAC_SCREENTIME_UNAVAILABLE }
  }
  return fetchScreenTimeViaHub(req, deps)
}

export function ensureScreenTimeScope(): TrackScope {
  const tracking = useTimeTrackingStore.getState()
  const existing = findScreenTimeScope(tracking.scopes)
  if (existing) {
    const missing = categoryPens().filter((pen) => !existing.pens.some((p) => p.id === pen.id))
    if (!missing.length) return existing
    const next: TrackScope = { ...existing, pens: [...existing.pens, ...missing] }
    useTimeTrackingStore.setState({
      scopes: tracking.scopes.map((scope) => (scope.id === existing.id ? next : scope)),
    })
    return next
  }
  const created = defaultScope()
  useTimeTrackingStore.setState({ scopes: [...tracking.scopes, created] })
  return created
}

/**
 * Create a Screen Time app/domain pen with a stable id. Existing pens keep
 * the user's name, parent, and color — only the first create writes those.
 */
export function ensureAppPen(opts: { id: string; name: string; parentId: string; color?: string }): string {
  const id = opts.id.trim()
  if (!id) return id
  const scope = ensureScreenTimeScope()
  if (scope.pens.some((pen) => pen.id === id)) return id

  const pen: TrackPen = {
    id,
    name: opts.name.trim() || id,
    color: opts.color ?? hashPenColor(id),
    parentId: opts.parentId,
    lastUsedAt: Date.now(),
  }
  useTimeTrackingStore.setState((state) => ({
    scopes: state.scopes.map((row) => (row.id === scope.id ? { ...row, pens: [...row.pens, pen] } : row)),
  }))
  return id
}

function screenTimeEntryId(date: string, startMin: number, endMin: number, penId: string): string {
  return `st-te-${date}-${startMin}-${endMin}-${penId}`
}

/**
 * Replace one day's Screen Time stamps. Hand-painted blocks (no stamp, or
 * another kind) stay. Same-shape re-runs keep ids so editors do not flicker.
 */
export function applyScreenTimeEntries(entries: TimeEntry[], date: string, derived: TimeEntry[]): TimeEntry[] {
  const safe = derived.filter((entry) => entry.scopeId !== ACTIVITY_SCOPE_ID)
  const existing = entries.filter((entry) => isOurStamp(entry, date))
  const sameShape =
    safe.length === existing.length &&
    safe.every((interval) =>
      existing.some(
        (entry) =>
          entry.date === interval.date &&
          entry.startMin === interval.startMin &&
          entry.endMin === interval.endMin &&
          entry.scopeId === interval.scopeId &&
          entry.penId === interval.penId,
      ),
    )
  if (sameShape) return entries

  const without = entries.filter((entry) => !isOurStamp(entry, date))
  const stamped = safe.map((entry) => {
    const prev = existing.find(
      (row) =>
        row.date === entry.date &&
        row.startMin === entry.startMin &&
        row.endMin === entry.endMin &&
        row.penId === entry.penId,
    )
    return prev ? { ...entry, id: prev.id } : entry
  })
  let next = [...without, ...stamped]
  const scopeIdForDay = stamped[0]?.scopeId ?? findScreenTimeScope(useTimeTrackingStore.getState().scopes)?.id ?? scopeId()
  next = mergeAdjacent(next, date, scopeIdForDay)
  return next
}

/** Inclusive local lookback, oldest first. Default 14 days including today. */
export function screenTimeLookbackDates(lookbackDays: number, now = new Date()): string[] {
  const days = Math.max(1, Math.round(lookbackDays))
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    keys.push(formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))
  }
  return keys
}

/** Today and yesterday — callers who want the live edge pass this as `dates`. */
export function screenTimeOngoingDates(now = new Date()): string[] {
  return screenTimeLookbackDates(2, now)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function ensurePensFor(interval: ScreenTimeInterval): void {
  if (interval.domain && interval.parentPenId.startsWith("st-app-")) {
    ensureAppPen({ id: interval.parentPenId, name: interval.app, parentId: interval.categoryId })
    ensureAppPen({ id: interval.penId, name: interval.penName, parentId: interval.parentPenId })
    return
  }
  ensureAppPen({ id: interval.penId, name: interval.penName, parentId: interval.parentPenId })
}

function entriesFromIntervals(
  intervals: ScreenTimeInterval[],
  scopeIdValue: string,
  storeWindowTitles: boolean,
): TimeEntry[] {
  const out: TimeEntry[] = []
  for (const interval of intervals) {
    if (interval.endMin <= interval.startMin) continue
    ensurePensFor(interval)
    const entry: TimeEntry = {
      id: screenTimeEntryId(interval.date, interval.startMin, interval.endMin, interval.penId),
      date: interval.date,
      scopeId: scopeIdValue,
      penId: interval.penId,
      startMin: interval.startMin,
      endMin: interval.endMin,
      generatedBy: stamp(interval.date),
      precision: "estimated",
    }
    if (storeWindowTitles && interval.title) entry.title = interval.title
    out.push(entry)
  }
  return out
}

export interface ScreenTimeSyncCounts {
  days: number
  blocks: number
  windowEvents: number
  afkEvents: number
  notAfkEvents: number
}

export type ScreenTimeSyncResult =
  | ({ ok: true; note: string } & ScreenTimeSyncCounts)
  | ({ ok: false; error: string; note: string } & ScreenTimeSyncCounts)

const EMPTY_COUNTS: ScreenTimeSyncCounts = {
  days: 0,
  blocks: 0,
  windowEvents: 0,
  afkEvents: 0,
  notAfkEvents: 0,
}

function notAfkCount(events: AwEvent[]): number {
  return events.filter((event) => event.data.status === "not-afk").length
}

/**
 * Settings last-success copy. `ok` + 0 blocks is not a failure — distinguish
 * "AW had nothing yet" from "events arrived but mapping dropped them".
 */
export function describeScreenTimeSync(
  result: Partial<ScreenTimeSyncCounts> & { ok: boolean; error?: string; minDurationSec?: number },
): string {
  if (!result.ok) return result.error || "Sync failed."
  const blocks = result.blocks ?? 0
  const days = result.days ?? 0
  const windows = result.windowEvents ?? 0
  const min = result.minDurationSec ?? 15
  if (blocks > 0) {
    return `Painted ${blocks} block(s) across ${days} day(s). Keep ActivityWatch running so the next sync can add more.`
  }
  if (windows === 0) {
    return "ActivityWatch is reachable but has no recorded windows yet. It only stores time from when the watchers run — it cannot import Apple Screen Time or anything from before install. Keep it running, then Sync now after using the Mac."
  }
  return `ActivityWatch had ${windows} window event(s), but none became blocks (away from the keyboard, or shorter than ${min}s). Keep it running and sync again after using the Mac.`
}

export async function syncScreenTime(
  options: {
    now?: Date
    dates?: string[]
    lookbackDays?: number
  } = {},
  deps: FetchScreenTimeDeps = {},
): Promise<ScreenTimeSyncResult> {
  const now = options.now ?? new Date()
  const prefs = loadScreenTimePrefs()
  const lookbackDays = options.lookbackDays ?? prefs.lookbackDays
  const dates = options.dates?.length ? options.dates : screenTimeLookbackDates(lookbackDays, now)
  const scope = ensureScreenTimeScope()

  const first = startOfLocalDay(
    dates.length
      ? new Date(`${dates[0]}T00:00:00`)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - (lookbackDays - 1)),
  )
  const lastKey = dates[dates.length - 1] ?? formatLocalDateKey(now)
  const last = new Date(`${lastKey}T00:00:00`)
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 2)

  const fetched = await fetchScreenTime(
    {
      url: prefs.url,
      startISO: first.toISOString(),
      endISO: end.toISOString(),
      mode: "events",
      includeWeb: prefs.includeWebWatcher,
    },
    deps,
  )

  if (!fetched.ok) {
    const note = fetched.error
    saveScreenTimePrefs({ lastError: fetched.error, lastSyncNote: note })
    return { ok: false, error: fetched.error, note, ...EMPTY_COUNTS }
  }
  if (fetched.mode !== "events") {
    const error = "ActivityWatch returned an unexpected events payload."
    saveScreenTimePrefs({ lastError: error, lastSyncNote: error })
    return { ok: false, error, note: error, ...EMPTY_COUNTS }
  }

  const intervals = mapScreenTimeEvents(fetched.windowEvents, fetched.afkEvents, fetched.webEvents, {
    minDurationSec: prefs.minDurationSec,
    includeWebWatcher: prefs.includeWebWatcher,
  }).filter((interval) => dates.includes(interval.date))

  const byDate = new Map<string, ScreenTimeInterval[]>()
  for (const date of dates) byDate.set(date, [])
  for (const interval of intervals) {
    const list = byDate.get(interval.date)
    if (list) list.push(interval)
  }

  let entries = useTimeTrackingStore.getState().entries
  let blocks = 0
  for (const date of dates) {
    const derived = entriesFromIntervals(byDate.get(date) ?? [], scope.id, prefs.storeWindowTitles)
    blocks += derived.length
    entries = applyScreenTimeEntries(entries, date, derived)
  }
  useTimeTrackingStore.setState({ entries })
  const counts: ScreenTimeSyncCounts = {
    days: dates.length,
    blocks,
    windowEvents: fetched.windowEvents.length,
    afkEvents: fetched.afkEvents.length,
    notAfkEvents: notAfkCount(fetched.afkEvents),
  }
  const note = describeScreenTimeSync({ ok: true, ...counts, minDurationSec: prefs.minDurationSec })
  saveScreenTimePrefs({ lastSuccessAt: now.toISOString(), lastError: undefined, lastSyncNote: note })

  return { ok: true, note, ...counts }
}
