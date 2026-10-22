/**
 * lib/phone-sync/location.ts — iPhone location uploads to Location rows
 *
 * The iOS app (`ios/App/App/LocationPlugin.swift`) records significant moves
 * and visits, seals each batch, and posts it to the Oracle box. The hub opens
 * the batch (`location-drain.ts`) and lands it here.
 *
 * A closed visit (arrive and leave) is a block on Location, sliced at local
 * midnight. A visit with only one end is an instant ("arrived" / "left").
 * A significant move is an instant: it says where the phone was at that
 * minute, not that you stayed. Nothing between events is filled in.
 *
 * Pens follow `gps:` (`lib/ingest/apply-gps.ts`): a pen's own place first,
 * then a named repeated place, then a coordinate pen within 150 m, else a new
 * coordinate pen. A move with no known place goes on one "On the move" pen,
 * so a drive does not leave a trail of new pens.
 *
 * Ids come from the event itself, so a batch the phone re-sends writes nothing
 * new. Rows are exact: no `precision: "estimated"`.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import { lookupGpsPlaceName, recordGpsSample } from "@/lib/ingest/gps-places"
import { penForCoordinate } from "@/lib/pen-place"
import { fileNewGpsPen } from "@/lib/pen-place-actions"
import { phoneEntryId, phoneStamp } from "./ids"
import type { PhoneSyncSource } from "./types"
import type { ApplyPhoneResult } from "./write"

export const LOCATION_SOURCE: PhoneSyncSource = "location"
export const LOCATION_SCOPE_ID = "location"
/** Fixed id, so the hub and a desktop never make two. */
export const MOVING_PEN_ID = "phone-location-moving"
export const MOVING_PEN_NAME = "On the move"
/** Same building (matches `REUSE_METERS` in apply-gps.ts). */
const REUSE_METERS = 150
const MINUTES_PER_DAY = 1440
/** A visit longer than this many days is cut off; iOS does not report stays that long. */
const MAX_VISIT_DAYS = 14

export interface LocationPoint {
  type: "point"
  at: number
  lat: number
  lon: number
  accuracyM?: number
}

export interface LocationVisit {
  type: "visit"
  /** Missing when monitoring started during the visit. */
  arriveAt?: number
  /** Missing while you are still there. */
  departAt?: number
  lat: number
  lon: number
  accuracyM?: number
}

export type LocationEvent = LocationPoint | LocationVisit

export interface LocationBatch {
  device?: string
  sentAt?: number
  events: LocationEvent[]
}

// ── Parse ────────────────────────────────────────────────────────────────────

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined)
const validCoord = (lat?: number, lon?: number): boolean =>
  lat !== undefined && lon !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)

/**
 * The opened batch as the phone sends it:
 * `{ v: 1, kind: "location", device, sentAt, events: [{ type, at, lat, lon, acc, arriveAt, departAt }] }`.
 * Bad events are dropped. Returns null when it is not a location batch at all.
 */
export function parseLocationBatch(raw: unknown): LocationBatch | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  if (obj.kind !== "location" || !Array.isArray(obj.events)) return null
  const events: LocationEvent[] = []
  for (const item of obj.events) {
    if (!item || typeof item !== "object") continue
    const e = item as Record<string, unknown>
    const lat = num(e.lat)
    const lon = num(e.lon)
    if (!validCoord(lat, lon)) continue
    const acc = num(e.acc)
    const accuracyM = acc !== undefined && acc >= 0 ? acc : undefined
    if (e.type === "point") {
      const at = num(e.at)
      if (at === undefined) continue
      events.push({ type: "point", at, lat: lat!, lon: lon!, accuracyM })
    } else if (e.type === "visit") {
      const arriveAt = num(e.arriveAt)
      const departAt = num(e.departAt)
      if (arriveAt === undefined && departAt === undefined) continue
      if (arriveAt !== undefined && departAt !== undefined && departAt < arriveAt) continue
      events.push({ type: "visit", arriveAt, departAt, lat: lat!, lon: lon!, accuracyM })
    }
  }
  return {
    device: typeof obj.device === "string" ? obj.device : undefined,
    sentAt: num(obj.sentAt),
    events,
  }
}

// ── Pure conversion ──────────────────────────────────────────────────────────

/** Stable id inside the location source. Same event, same id. */
export function locationSourceId(event: LocationEvent): string {
  if (event.type === "point") return `pt:${event.at}:${event.lat.toFixed(5)},${event.lon.toFixed(5)}`
  return `visit:${event.arriveAt ?? "-"}:${event.departAt ?? "-"}:${event.lat.toFixed(4)},${event.lon.toFixed(4)}`
}

export interface LocationTargets {
  scopeId: string
  penFor: (event: LocationEvent) => string
}

function localMinute(ms: number): { date: string; min: number; dayStart: number } {
  const d = new Date(ms)
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return { date: formatLocalDateKey(d), min: d.getHours() * 60 + d.getMinutes(), dayStart }
}

/** Wall-clock minute of `ms`, rounded up, so DST days line up with `localMinute`. */
function wallMinuteUp(ms: number): number {
  const d = new Date(ms)
  return d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)
}

const accText = (m?: number) => (m !== undefined ? ` ±${Math.round(m)} m` : "")

function instant(event: LocationEvent, at: number, title: string, t: LocationTargets): TimeEntry {
  const sourceId = locationSourceId(event)
  const { date, min } = localMinute(at)
  return {
    id: phoneEntryId(LOCATION_SOURCE, sourceId),
    date,
    scopeId: t.scopeId,
    penId: t.penFor(event),
    kind: "instant",
    startMin: min,
    endMin: min,
    title,
    generatedBy: phoneStamp(LOCATION_SOURCE, sourceId),
  }
}

function visitBlocks(event: LocationVisit & { arriveAt: number; departAt: number }, t: LocationTargets): TimeEntry[] {
  const sourceId = locationSourceId(event)
  const stamp = phoneStamp(LOCATION_SOURCE, sourceId)
  const penId = t.penFor(event)
  const spanId = phoneEntryId(LOCATION_SOURCE, sourceId)
  const out: TimeEntry[] = []
  let cursor = event.arriveAt
  let part = 0
  while (cursor < event.departAt && part < MAX_VISIT_DAYS) {
    const { date, min, dayStart } = localMinute(cursor)
    const day = new Date(dayStart)
    const nextMidnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
    const sliceEnd = Math.min(event.departAt, nextMidnight)
    let endMin = sliceEnd === nextMidnight ? MINUTES_PER_DAY : wallMinuteUp(sliceEnd)
    if (endMin <= min) endMin = min + 1
    out.push({
      id: phoneEntryId(LOCATION_SOURCE, sourceId, part),
      date,
      scopeId: t.scopeId,
      penId,
      startMin: min,
      endMin: Math.min(endMin, MINUTES_PER_DAY),
      title: "visit",
      spanId,
      generatedBy: stamp,
    })
    cursor = sliceEnd
    part++
  }
  // Arrive and leave in the same instant: still one minute on the grid.
  if (out.length === 0) {
    const { date, min } = localMinute(event.arriveAt)
    out.push({
      id: phoneEntryId(LOCATION_SOURCE, sourceId, 0),
      date,
      scopeId: t.scopeId,
      penId,
      startMin: Math.min(min, MINUTES_PER_DAY - 1),
      endMin: Math.min(min + 1, MINUTES_PER_DAY),
      title: "visit",
      spanId,
      generatedBy: stamp,
    })
  }
  return out
}

/** One event to its rows. Pure. */
export function locationEventToEntries(event: LocationEvent, t: LocationTargets): TimeEntry[] {
  if (event.type === "point") return [instant(event, event.at, `moved${accText(event.accuracyM)}`, t)]
  if (event.arriveAt !== undefined && event.departAt !== undefined) {
    return visitBlocks(event as LocationVisit & { arriveAt: number; departAt: number }, t)
  }
  if (event.arriveAt !== undefined) return [instant(event, event.arriveAt, "arrived", t)]
  return [instant(event, event.departAt!, "left", t)]
}

/** The first row's id: present means this event already landed. */
export function locationEventBaseId(event: LocationEvent): string {
  return phoneEntryId(LOCATION_SOURCE, locationSourceId(event))
}

// ── Store ────────────────────────────────────────────────────────────────────

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const COORD_LABEL_RE = /^(-?\d+\.\d+),(-?\d+\.\d+)$/
const coordLabel = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`

function locationPens(): TrackPen[] {
  return useTimeTrackingStore.getState().scopes.find((s) => s.id === LOCATION_SCOPE_ID)?.pens ?? []
}

function findPenByName(name: string): TrackPen | undefined {
  const wanted = name.trim().toLowerCase()
  return locationPens().find((p) => p.name.trim().toLowerCase() === wanted)
}

/** A known pen for this coordinate, without making one. Same order as `gps:`. */
export function knownLocationPen(lat: number, lon: number): string | null {
  const pens = locationPens()
  const placed = penForCoordinate(pens, lat, lon)
  if (placed && pens.some((p) => p.id === placed.penId)) return placed.penId
  const named = lookupGpsPlaceName(lat, lon)
  if (named) {
    const pen = findPenByName(named)
    if (pen) return pen.id
  }
  let best: { id: string; d: number } | null = null
  for (const pen of pens) {
    const m = COORD_LABEL_RE.exec(pen.name.trim())
    if (!m) continue
    const d = haversineMeters({ lat, lon }, { lat: Number(m[1]), lon: Number(m[2]) })
    if (d <= REUSE_METERS && (!best || d < best.d)) best = { id: pen.id, d }
  }
  return best?.id ?? null
}

function addLocationPen(name: string): string {
  return useTimeTrackingStore.getState().addPen(LOCATION_SCOPE_ID, {
    name,
    color: PEN_PALETTE[locationPens().length % PEN_PALETTE.length],
  })
}

/** A visit always gets a place pen: known, a named cluster, or a new coordinate pen. */
function visitPen(lat: number, lon: number): string {
  const known = knownLocationPen(lat, lon)
  if (known) return known
  const named = lookupGpsPlaceName(lat, lon)
  if (named) return addLocationPen(named)
  const penId = addLocationPen(coordLabel(lat, lon))
  // Like gps: pin it, look up the address, file it under its city pens.
  if (penId && process.env.NODE_ENV !== "test") void fileNewGpsPen(penId, lat, lon)
  return penId
}

function ensureMovingPen(): string {
  const state = useTimeTrackingStore.getState()
  const scope = state.scopes.find((s) => s.id === LOCATION_SCOPE_ID)
  if (scope && !scope.pens.some((p) => p.id === MOVING_PEN_ID)) {
    const pen: TrackPen = { id: MOVING_PEN_ID, name: MOVING_PEN_NAME, color: PEN_PALETTE[0], lastUsedAt: Date.now() }
    useTimeTrackingStore.setState({
      scopes: state.scopes.map((s) => (s.id === LOCATION_SCOPE_ID ? { ...s, pens: [...s.pens, pen] } : s)),
    })
  }
  return MOVING_PEN_ID
}

/**
 * Land a batch in the tracking store. Events already written, or deleted by
 * the person, are skipped before any pen is made. A new visit also feeds the
 * repeated-place clusters (`gps-places.ts`), so naming a place works the same.
 */
export function applyLocationBatch(batch: LocationBatch): ApplyPhoneResult {
  const read = batch.events.length
  if (read === 0) return { read: 0, written: 0, skipped: 0 }
  const start = useTimeTrackingStore.getState()
  if (!start.scopes.some((s) => s.id === LOCATION_SCOPE_ID)) throw new Error("no Location scope")

  const have = new Set(start.entries.map((e) => e.id))
  for (const id of start.removedEntryIds ?? []) have.add(id)
  const seen = new Set<string>()
  const fresh: LocationEvent[] = []
  for (const event of batch.events) {
    const base = locationEventBaseId(event)
    if (have.has(base) || seen.has(base)) continue
    seen.add(base)
    fresh.push(event)
  }
  if (fresh.length === 0) return { read, written: 0, skipped: read }

  const pens = new Map<LocationEvent, string>()
  for (const event of fresh) {
    const known = knownLocationPen(event.lat, event.lon)
    pens.set(event, known ?? (event.type === "visit" ? visitPen(event.lat, event.lon) : ensureMovingPen()))
  }
  const targets: LocationTargets = { scopeId: LOCATION_SCOPE_ID, penFor: (e) => pens.get(e)! }
  const incoming = fresh.flatMap((event) => locationEventToEntries(event, targets))

  const state = useTimeTrackingStore.getState()
  const ids = new Set(state.entries.map((e) => e.id))
  for (const id of state.removedEntryIds ?? []) ids.add(id)
  const add = incoming.filter((e) => !ids.has(e.id))
  if (add.length) useTimeTrackingStore.setState({ entries: [...state.entries, ...add] })

  for (const event of fresh) {
    if (event.type === "visit") recordGpsSample(event.lat, event.lon, event.arriveAt ?? event.departAt)
  }
  return { read, written: add.length, skipped: read - fresh.length }
}
