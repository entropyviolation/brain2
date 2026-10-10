/**
 * lib/ingest/gps-places.ts — Names for coordinates that keep showing up
 *
 * Phone GPS still paints Location pens (`apply-gps.ts`). This file only
 * remembers the fixes and the names given to places that repeat. It is not
 * a second location grid and it does not put latitude on a time entry.
 *
 * A cluster is grown in time order. A new fix joins the nearest cluster
 * whose centroid is within `GPS_CLUSTER_RADIUS_M` (80 meters — a short
 * block, so a doorway groups and the shop across the street stays its own
 * pin). The centroid is the mean of the fixes already in that cluster.
 * A place is "repeated" once it holds more than one fix. Naming it stores
 * that centroid. The next fix inside 80 meters of a named centroid uses
 * that name as the Location pen. An unnamed cluster still tracks; the pen
 * stays the coordinate label.
 */
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

/** Nearby fixes are one place. See the file comment. */
export const GPS_CLUSTER_RADIUS_M = 80

const MAX_SAMPLES = 400
const SAMPLES_NAME = "gps-place-samples"
const NAMES_NAME = "gps-place-names"

interface GpsSample {
  lat: number
  lon: number
  at: number
}

interface StoredName {
  name: string
  lat: number
  lon: number
}

export interface GpsPlace {
  lat: number
  lon: number
  count: number
  /** Empty until the person names this cluster. */
  name: string
}

const listeners = new Set<() => void>()
let snapshot: GpsPlace[] = []
let snapshotFresh = false
const emptySnapshot: GpsPlace[] = []

function emit(): void {
  snapshotFresh = false
  for (const listener of listeners) listener()
}

export function subscribeGpsPlaces(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getGpsPlacesSnapshot(): GpsPlace[] {
  if (!snapshotFresh) {
    snapshot = repeatedGpsPlaces()
    snapshotFresh = true
  }
  return snapshot
}

export function getGpsPlacesServerSnapshot(): GpsPlace[] {
  return emptySnapshot
}

function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function readJson<T>(name: string): T | null {
  if (typeof window === "undefined") return null
  const raw = readAliasedLocal(persistKey(name))
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(name: string, value: unknown): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(persistKey(name), JSON.stringify(value))
}

function readSamples(): GpsSample[] {
  const parsed = readJson<GpsSample[]>(SAMPLES_NAME)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (row) =>
      row &&
      typeof row.lat === "number" &&
      typeof row.lon === "number" &&
      typeof row.at === "number" &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lon),
  )
}

function readNames(): StoredName[] {
  const parsed = readJson<StoredName[]>(NAMES_NAME)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (row) =>
      row &&
      typeof row.name === "string" &&
      row.name.trim() &&
      typeof row.lat === "number" &&
      typeof row.lon === "number",
  )
}

function centroid(points: GpsSample[]): { lat: number; lon: number } {
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length
  const lon = points.reduce((sum, point) => sum + point.lon, 0) / points.length
  return { lat, lon }
}

interface Cluster {
  points: GpsSample[]
}

/** Clusters in time order. Includes one-visit clusters. */
export function clusterGpsSamples(samples: readonly GpsSample[]): { lat: number; lon: number; count: number }[] {
  const ordered = [...samples].sort((a, b) => a.at - b.at || a.lat - b.lat || a.lon - b.lon)
  const groups: Cluster[] = []
  for (const sample of ordered) {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < groups.length; i++) {
      const d = haversineMeters(sample, centroid(groups[i]!.points))
      if (d <= GPS_CLUSTER_RADIUS_M && d < bestD) {
        best = i
        bestD = d
      }
    }
    if (best >= 0) groups[best]!.points.push(sample)
    else groups.push({ points: [sample] })
  }
  return groups.map((group) => ({ ...centroid(group.points), count: group.points.length }))
}

function nameFor(cluster: { lat: number; lon: number }, names: StoredName[]): string {
  let best = ""
  let bestD = Infinity
  for (const place of names) {
    const d = haversineMeters(cluster, place)
    if (d <= GPS_CLUSTER_RADIUS_M && d < bestD) {
      best = place.name
      bestD = d
    }
  }
  return best
}

/** Places seen more than once, named or not. */
export function repeatedGpsPlaces(): GpsPlace[] {
  return clusterGpsSamples(readSamples())
    .filter((cluster) => cluster.count > 1)
    .map((cluster) => ({ ...cluster, name: nameFor(cluster, readNames()) }))
}

/** The person's name when this fix sits in a named cluster. */
export function lookupGpsPlaceName(lat: number, lon: number): string | null {
  const names = readNames()
  let best: StoredName | null = null
  let bestD = Infinity
  for (const place of names) {
    const d = haversineMeters({ lat, lon }, place)
    if (d <= GPS_CLUSTER_RADIUS_M && d < bestD) {
      best = place
      bestD = d
    }
  }
  return best?.name ?? null
}

/** Remember a fix. Live Location calls this from the same write as the last fix. */
export function recordGpsSample(lat: number, lon: number, at = Date.now()): void {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return
  const next = [...readSamples(), { lat, lon, at }].slice(-MAX_SAMPLES)
  writeJson(SAMPLES_NAME, next)
  emit()
}

/**
 * Name the repeated cluster whose centroid is `anchor`, or clear that name
 * when `name` is blank. The anchor is stored as the place.
 */
export function setGpsPlaceName(anchor: { lat: number; lon: number }, name: string): void {
  const trimmed = name.trim()
  const kept = readNames().filter((place) => haversineMeters(place, anchor) > GPS_CLUSTER_RADIUS_M)
  if (trimmed) kept.push({ name: trimmed, lat: anchor.lat, lon: anchor.lon })
  writeJson(NAMES_NAME, kept)
  emit()
}

export function resetGpsPlacesForTests(): void {
  if (typeof window !== "undefined") {
    writeJson(SAMPLES_NAME, [])
    writeJson(NAMES_NAME, [])
  }
  snapshot = []
  snapshotFresh = true
  emit()
}
