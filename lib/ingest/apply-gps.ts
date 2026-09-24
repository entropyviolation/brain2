/**
 * lib/ingest/apply-gps.ts — Live location pin / place name → location pen
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import { minutesPastMidnight } from "./times"
import { switchScopePen } from "./switch-scope"
import type { ApplyResult } from "./types"

const LAST_GPS_KEY = persistKey("last-gps")
const REUSE_METERS = 150

interface LastGpsFix {
  lat: number
  lon: number
  penId: string
  name: string
}

function pensInLocation(): TrackPen[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
  return scope?.pens ?? []
}

function coveringLocationPenId(now: Date): string | null {
  const date = formatLocalDateKey(now)
  const min = minutesPastMidnight(now)
  const entries = useTimeTrackingStore.getState().entriesFor(date, "location")
  const hit = entries.find((entry) => entry.startMin <= min && min < entry.endMin)
  return hit?.penId ?? null
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

function parseGpsPayload(payload: string): {
  lat?: number
  lon?: number
  name?: string
  accuracyM?: number
} {
  const lines = payload
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  let lat: number | undefined
  let lon: number | undefined
  let accuracyM: number | undefined
  const nameParts: string[] = []

  const coordRe = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/
  const accuracyRe = /(?:\u00b1|accuracy\s*:)\s*(\d+(?:\.\d+)?)\s*m?/i

  for (const line of lines) {
    const onlyAcc = /^(?:\u00b1\s*\d+(?:\.\d+)?\s*m?|accuracy\s*:\s*\d+(?:\.\d+)?(?:\s*m)?)$/i.test(
      line,
    )
    if (onlyAcc) {
      const m = line.match(accuracyRe)
      if (m) accuracyM = Number(m[1])
      continue
    }

    const coord = line.match(coordRe)
    if (coord && lat == null) {
      lat = Number(coord[1])
      lon = Number(coord[2])
      const rest = line.replace(coordRe, "").replace(accuracyRe, "").trim()
      if (rest) nameParts.push(rest)
      const accOnLine = line.match(accuracyRe)
      if (accOnLine) accuracyM = Number(accOnLine[1])
      continue
    }

    const cleaned = line.replace(accuracyRe, "").trim()
    if (cleaned) nameParts.push(cleaned)
    const acc = line.match(accuracyRe)
    if (acc) accuracyM = Number(acc[1])
  }

  if (lat == null) {
    const coord = payload.match(coordRe)
    if (coord) {
      lat = Number(coord[1])
      lon = Number(coord[2])
    }
  }
  if (accuracyM == null) {
    const acc = payload.match(accuracyRe)
    if (acc) accuracyM = Number(acc[1])
  }

  const name = nameParts.join(" ").trim() || undefined
  void accuracyM
  return { lat, lon, name, accuracyM }
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

function paintLocation(
  now: Date,
  penId: string,
  name: string,
  opts?: { quiet?: boolean; coords?: { lat: number; lon: number } },
): ApplyResult {
  const current = coveringLocationPenId(now)
  if (current === penId) {
    if (opts?.coords) writeLastFix({ ...opts.coords, penId, name })
    return {
      status: "ignored",
      kind: "gps" as ApplyResult["kind"],
      reply: undefined,
      summary: `Still at ${name}`,
    } as ApplyResult
  }

  const date = formatLocalDateKey(now)
  switchScopePen(date, "location", minutesPastMidnight(now), penId)
  if (opts?.coords) writeLastFix({ ...opts.coords, penId, name })

  if (opts?.quiet) {
    return {
      status: "ignored",
      kind: "gps" as ApplyResult["kind"],
      reply: undefined,
      summary: `Still at ${name}`,
    } as ApplyResult
  }

  return {
    status: "ok",
    kind: "gps" as ApplyResult["kind"],
    reply: `Location: ${name}`,
    summary: `GPS → ${name}`,
  } as ApplyResult
}

export function applyGps(payload: string, now = new Date()): ApplyResult {
  const trimmed = payload.trim()
  if (!trimmed) {
    return {
      status: "error",
      kind: "gps" as ApplyResult["kind"],
      reply: "Where? gps: Home or a Telegram location pin.",
    } as ApplyResult
  }

  const parsed = parseGpsPayload(trimmed)
  const hasCoords =
    parsed.lat != null &&
    parsed.lon != null &&
    Number.isFinite(parsed.lat) &&
    Number.isFinite(parsed.lon)

  if (parsed.name) {
    const existing = findExactPen(parsed.name)
    const penId = existing?.id ?? createLocationPen(parsed.name)
    const name = existing?.name ?? parsed.name
    return paintLocation(now, penId, name, {
      coords: hasCoords ? { lat: parsed.lat!, lon: parsed.lon! } : undefined,
    })
  }

  if (hasCoords) {
    const lat = parsed.lat!
    const lon = parsed.lon!
    const last = readLastFix()
    if (last && haversineMeters({ lat, lon }, last) <= REUSE_METERS) {
      const stillThere = pensInLocation().some((p) => p.id === last.penId)
      if (stillThere) {
        return paintLocation(now, last.penId, last.name, {
          quiet: true,
          coords: { lat, lon },
        })
      }
    }
    const name = `${lat.toFixed(3)},${lon.toFixed(3)}`
    const existing = findExactPen(name)
    const penId = existing?.id ?? createLocationPen(name)
    return paintLocation(now, penId, name, { coords: { lat, lon } })
  }

  return {
    status: "error",
    kind: "gps" as ApplyResult["kind"],
    reply: "Where? gps: Home or a Telegram location pin.",
  } as ApplyResult
}
