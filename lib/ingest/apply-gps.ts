/**
 * lib/ingest/apply-gps.ts — Phone GPS → Location blocks that stop at the sample
 *
 * A fix says where the phone was at that minute. It does not paint the rest of
 * the day. The same coordinates keep the current pen, so a reverse-geocoded
 * business name (the restaurant you just ordered from) cannot replace home
 * while you are still there. A Telegram venue pin is a shared place, not
 * presence. `gps-log:` replays lines the phone saved while it was offline.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { isInstant, type TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import { MINUTES_PER_DAY, minutesPastMidnight } from "./times"
import type { ApplyResult } from "./types"

const LAST_GPS_KEY = persistKey("last-gps")
const GPS_NOTE = "gps"
/** Same building, including a geocoder that names a nearby restaurant. */
const REUSE_METERS = 150
/** A short dropout still belongs to the place we last confirmed. */
const BRIDGE_MIN = 45
/** Isolated samples need enough minutes to show on a 15-minute grid. */
const MIN_BLOCK_MIN = 15
/** A fuzzier-than-this jump does not move you to a new place. */
const FUZZY_ACCURACY_M = 150

interface LastGpsFix {
  lat: number
  lon: number
  penId: string
  name: string
}

interface GpsSample {
  when: Date
  name?: string
  lat?: number
  lon?: number
  accuracyM?: number
}

function pensInLocation(): TrackPen[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
  return scope?.pens ?? []
}

function locationEntries(date: string): TimeEntry[] {
  return useTimeTrackingStore
    .getState()
    .entries.filter((entry) => entry.date === date && entry.scopeId === "location" && !isInstant(entry))
}

function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function readLastFix(): LastGpsFix | null {
  if (typeof window === "undefined") return null
  const raw = readAliasedLocal(LAST_GPS_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LastGpsFix
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lon === "number" &&
      typeof parsed.penId === "string" &&
      typeof parsed.name === "string"
    ) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

function writeLastFix(fix: LastGpsFix): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(LAST_GPS_KEY, JSON.stringify(fix))
}

function findExactPen(name: string): TrackPen | undefined {
  const wanted = name.trim().toLowerCase()
  return pensInLocation().find((p) => p.name.trim().toLowerCase() === wanted)
}

function createLocationPen(name: string): string {
  const existing = pensInLocation().length
  return useTimeTrackingStore.getState().addPen("location", {
    name,
    color: PEN_PALETTE[existing % PEN_PALETTE.length],
  })
}

const COORD_RE = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
const ACCURACY_RE = /(?:\u00b1|accuracy\s*:)\s*(\d+(?:\.\d+)?)\s*m?/i
const LOG_LINE_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?);(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?);(.*)$/

function payloadLines(payload: string): string[] {
  return payload
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseStamp(raw: string, fallback: Date): Date | null {
  const text = raw.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (iso) {
    const when = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4]),
      Number(iso[5]),
      Number(iso[6] ?? 0),
    )
    return Number.isNaN(when.getTime()) ? null : when
  }
  const clock = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (!clock) return null
  const when = new Date(fallback)
  when.setHours(Number(clock[1]), Number(clock[2]), 0, 0)
  return when
}

function isSharedPlace(payload: string): boolean {
  return payloadLines(payload).some((line) => line.toLowerCase() === "shared-place")
}

function parseLog(payload: string): GpsSample[] {
  const samples: GpsSample[] = []
  for (const line of payloadLines(payload)) {
    const match = LOG_LINE_RE.exec(line)
    if (!match) continue
    const when = parseStamp(match[1], new Date())
    const lat = Number(match[2])
    const lon = Number(match[3])
    if (!when || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    const name = match[4].trim()
    samples.push({ when, lat, lon, name: name || undefined })
  }
  return samples
}

function parseGpsPayload(payload: string, fallback: Date): GpsSample | null {
  const lines = payloadLines(payload)
  let lat: number | undefined
  let lon: number | undefined
  let accuracyM: number | undefined
  let when = fallback
  const nameParts: string[] = []

  for (const line of lines) {
    const at = /^at:\s*(.+)$/i.exec(line)
    if (at) {
      const stamped = parseStamp(at[1], fallback)
      if (stamped) when = stamped
      continue
    }
    if (line.toLowerCase() === "shared-place") continue

    const onlyAcc = /^(?:\u00b1\s*\d+(?:\.\d+)?\s*m?|accuracy\s*:\s*\d+(?:\.\d+)?(?:\s*m)?)$/i.test(line)
    if (onlyAcc) {
      const match = line.match(ACCURACY_RE)
      if (match) accuracyM = Number(match[1])
      continue
    }

    const coord = line.match(COORD_RE)
    if (coord && lat == null) {
      lat = Number(coord[1])
      lon = Number(coord[2])
      const rest = line.replace(COORD_RE, "").replace(ACCURACY_RE, "").trim()
      if (rest) nameParts.push(rest)
      const accOnLine = line.match(ACCURACY_RE)
      if (accOnLine) accuracyM = Number(accOnLine[1])
      continue
    }

    const cleaned = line.replace(ACCURACY_RE, "").trim()
    if (cleaned) nameParts.push(cleaned)
    const acc = line.match(ACCURACY_RE)
    if (acc) accuracyM = Number(acc[1])
  }

  const name = nameParts.join(" ").trim() || undefined
  if (!name && (lat == null || lon == null)) return null
  return { when, name, lat, lon, accuracyM }
}

function coordsOf(sample: GpsSample): { lat: number; lon: number } | null {
  if (sample.lat == null || sample.lon == null) return null
  if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return null
  return { lat: sample.lat, lon: sample.lon }
}

/**
 * An open-until-midnight Location block is an assumption, not a stay.
 * A real sample ends that assumption at the sample. Blocks this module
 * writes carry the gps note and already stop at their own sample.
 */
function chopProjectedTail(date: string, keepUntil: number): void {
  const open = locationEntries(date).filter(
    (entry) => entry.notes !== GPS_NOTE && entry.endMin >= MINUTES_PER_DAY && entry.startMin < keepUntil,
  )
  for (const entry of open) {
    const nextEnd = Math.max(entry.startMin + 1, keepUntil)
    if (nextEnd < entry.endMin) {
      useTimeTrackingStore.getState().updateEntry(entry.id, { endMin: nextEnd })
    }
  }
}

function resolvePen(sample: GpsSample): { penId: string; name: string; coords: { lat: number; lon: number } | null } {
  const coords = coordsOf(sample)
  const last = readLastFix()
  if (coords && last && haversineMeters(coords, last) <= REUSE_METERS) {
    const stillThere = pensInLocation().some((pen) => pen.id === last.penId)
    if (stillThere) return { penId: last.penId, name: last.name, coords }
  }

  if (sample.name) {
    const existing = findExactPen(sample.name)
    const penId = existing?.id ?? createLocationPen(sample.name)
    return { penId, name: existing?.name ?? sample.name, coords }
  }

  const label = `${coords!.lat.toFixed(3)},${coords!.lon.toFixed(3)}`
  const existing = findExactPen(label)
  const penId = existing?.id ?? createLocationPen(label)
  return { penId, name: existing?.name ?? label, coords }
}

function fuzzyJump(sample: GpsSample, last: LastGpsFix | null): boolean {
  if (sample.accuracyM == null || sample.accuracyM <= FUZZY_ACCURACY_M) return false
  const coords = coordsOf(sample)
  if (!coords || !last) return false
  return haversineMeters(coords, last) > REUSE_METERS
}

type SampleResult = "painted" | "same"

function applySample(sample: GpsSample): SampleResult {
  const { penId, name, coords } = resolvePen(sample)
  const date = formatLocalDateKey(sample.when)
  const min = Math.min(Math.max(0, minutesPastMidnight(sample.when)), MINUTES_PER_DAY - 1)
  const end = Math.min(min + 1, MINUTES_PER_DAY)

  const covering = locationEntries(date).find((entry) => entry.startMin <= min && min < entry.endMin)
  if (covering?.penId === penId) {
    if (covering.notes === GPS_NOTE && covering.endMin > end) {
      useTimeTrackingStore.getState().updateEntry(covering.id, { endMin: end })
    }
    if (coords) writeLastFix({ ...coords, penId, name })
    return "same"
  }

  if (covering && covering.penId !== penId && (covering.notes === GPS_NOTE || covering.endMin >= MINUTES_PER_DAY)) {
    if (covering.startMin < min) {
      useTimeTrackingStore.getState().updateEntry(covering.id, { endMin: min })
    } else {
      useTimeTrackingStore.getState().removeEntry(covering.id)
    }
  }

  const samePen = locationEntries(date)
    .filter((entry) => entry.penId === penId && entry.endMin <= min && min - entry.endMin <= BRIDGE_MIN)
    .sort((a, b) => b.endMin - a.endMin)[0]
  if (samePen && min - samePen.endMin <= BRIDGE_MIN) {
    const target = Math.min(end, nextOccupancy(date, samePen.endMin, penId) ?? end)
    if (target > samePen.endMin) {
      useTimeTrackingStore.getState().updateEntry(samePen.id, { endMin: target, notes: GPS_NOTE })
    }
    if (coords) writeLastFix({ ...coords, penId, name })
    return "same"
  }

  const other = locationEntries(date)
    .filter((entry) => entry.notes === GPS_NOTE && entry.penId !== penId && entry.endMin <= min)
    .sort((a, b) => b.endMin - a.endMin)[0]
  if (other && min - other.endMin > 0 && min - other.endMin <= BRIDGE_MIN) {
    useTimeTrackingStore.getState().updateEntry(other.id, { endMin: min })
  }

  let start = Math.max(0, end - MIN_BLOCK_MIN)
  const floor = locationEntries(date)
    .filter((entry) => entry.endMin <= min)
    .reduce((latest, entry) => Math.max(latest, entry.endMin), 0)
  if (floor > start) start = floor
  if (start >= end) start = min
  if (start >= end) {
    if (coords) writeLastFix({ ...coords, penId, name })
    return "same"
  }

  useTimeTrackingStore.getState().paintMinutes(date, "location", start, end, penId, undefined, undefined, undefined, {
    notes: GPS_NOTE,
  })
  if (coords) writeLastFix({ ...coords, penId, name })
  return "painted"
}

function nextOccupancy(date: string, after: number, penId: string): number | null {
  const next = locationEntries(date)
    .filter((entry) => entry.penId !== penId && entry.startMin >= after)
    .sort((a, b) => a.startMin - b.startMin)[0]
  return next ? next.startMin : null
}

function samplesFrom(payload: string, fallback: Date): GpsSample[] {
  const logged = parseLog(payload)
  if (logged.length) return logged.sort((a, b) => a.when.getTime() - b.when.getTime())
  const one = parseGpsPayload(payload, fallback)
  return one ? [one] : []
}

export function applyGps(payload: string, now = new Date()): ApplyResult {
  const trimmed = payload.trim()
  if (!trimmed || isSharedPlace(trimmed)) {
    return {
      status: trimmed && isSharedPlace(trimmed) ? "ignored" : "error",
      kind: "gps",
      reply: trimmed && isSharedPlace(trimmed) ? undefined : "Where? gps: Home or a Telegram location pin.",
      summary: trimmed && isSharedPlace(trimmed) ? "Shared place, not where you are" : undefined,
    }
  }

  const samples = samplesFrom(trimmed, now)
  if (!samples.length) {
    return {
      status: "error",
      kind: "gps",
      reply: "Where? gps: Home or a Telegram location pin.",
    }
  }

  const applicable: GpsSample[] = []
  let rolling = readLastFix()
  for (const sample of samples) {
    if (fuzzyJump(sample, rolling)) continue
    applicable.push(sample)
    const coords = coordsOf(sample)
    if (coords) {
      rolling = {
        lat: coords.lat,
        lon: coords.lon,
        penId: rolling?.penId ?? "",
        name: rolling?.name || sample.name || "",
      }
    }
  }
  if (!applicable.length) {
    const last = readLastFix()
    return {
      status: "ignored",
      kind: "gps",
      summary: last ? `Fuzzy GPS, kept ${last.name}` : "Fuzzy GPS, ignored",
    }
  }

  const newest = applicable[applicable.length - 1]!
  const newestMin = Math.min(minutesPastMidnight(newest.when) + 1, MINUTES_PER_DAY)
  chopProjectedTail(formatLocalDateKey(newest.when), newestMin)

  let painted = 0
  let lastName = ""
  for (const sample of applicable) {
    const result = applySample(sample)
    if (result === "painted") painted += 1
    const resolved = readLastFix()
    lastName = resolved?.name || sample.name || lastName
  }

  const logged = parseLog(trimmed).length > 0
  if (painted === 0) {
    return {
      status: "ignored",
      kind: "gps",
      summary: logged ? `GPS log → ${applicable.length} points` : `Still at ${lastName}`,
    }
  }

  if (logged || applicable.length > 1) {
    return {
      status: "ok",
      kind: "gps",
      reply: `Location log: ${applicable.length} points`,
      summary: `GPS log → ${applicable.length} points`,
    }
  }

  return {
    status: "ok",
    kind: "gps",
    reply: `Location: ${lastName}`,
    summary: `GPS → ${lastName}`,
  }
}
