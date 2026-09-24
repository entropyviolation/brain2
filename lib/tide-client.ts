/**
 * lib/tide-client.ts — NOAA CO-OPS tides for the Home weather instrument
 *
 * Predictions + latest water level, cached 15 min. Station is the widget's
 * chosen beach when set, else nearest catalog coast for the city
 * (San Diego / Ocean Beach → La Jolla Scripps 9410230).
 */

import { TTL, cached } from "@/lib/api-cache"
import { geocodeCity } from "@/lib/weather-client"

export type TideStation = {
  id: string
  name: string
  place: string
  lat: number
  lng: number
}

/** Pacific-first catalog; nearest-coast fallback for other home cities. */
export const TIDE_STATIONS: TideStation[] = [
  { id: "9410230", name: "La Jolla (Scripps)", place: "La Jolla", lat: 32.8669, lng: -117.2571 },
  { id: "9410170", name: "San Diego Bay", place: "San Diego", lat: 32.7133, lng: -117.1733 },
  { id: "9410135", name: "Imperial Beach", place: "Imperial Beach", lat: 32.5794, lng: -117.135 },
  { id: "9410660", name: "Los Angeles", place: "San Pedro", lat: 33.72, lng: -118.2722 },
  { id: "9410840", name: "Santa Monica", place: "Santa Monica", lat: 34.0083, lng: -118.5 },
  { id: "9413450", name: "Santa Barbara", place: "Santa Barbara", lat: 34.4083, lng: -119.685 },
  { id: "9414290", name: "San Francisco", place: "San Francisco", lat: 37.8067, lng: -122.465 },
  { id: "9415020", name: "Point Reyes", place: "Point Reyes", lat: 37.9961, lng: -122.9767 },
  { id: "9418767", name: "Arena Cove", place: "Point Arena", lat: 38.9144, lng: -123.7111 },
  { id: "9419750", name: "Crescent City", place: "Crescent City", lat: 41.7456, lng: -124.1844 },
  { id: "9432780", name: "South Beach", place: "Newport, OR", lat: 44.625, lng: -124.045 },
  { id: "9447130", name: "Seattle", place: "Seattle", lat: 47.6019, lng: -122.3392 },
  { id: "1612340", name: "Honolulu", place: "Honolulu", lat: 21.3067, lng: -157.867 },
  { id: "9412110", name: "Port San Luis", place: "Avila Beach", lat: 35.1767, lng: -120.76 },
  { id: "8771450", name: "Galveston", place: "Galveston", lat: 29.31, lng: -94.7933 },
  { id: "8723214", name: "Virginia Key", place: "Miami", lat: 25.7314, lng: -80.1618 },
  { id: "8724580", name: "Key West", place: "Key West", lat: 24.5557, lng: -81.8079 },
  { id: "8518750", name: "The Battery", place: "New York", lat: 40.7006, lng: -74.0142 },
  { id: "8443970", name: "Boston", place: "Boston", lat: 42.3539, lng: -71.0503 },
  { id: "8574680", name: "Baltimore", place: "Baltimore", lat: 39.2667, lng: -76.5783 },
  { id: "8665530", name: "Charleston", place: "Charleston", lat: 32.7808, lng: -79.9236 },
]

const SCRIPPS = TIDE_STATIONS[0]!

export type TideExtreme = {
  kind: "H" | "L"
  heightFt: number
  timeLabel: string
  timeCompact: string
  stamp: string
}

export type HomeTide = {
  stationId: string
  stationName: string
  place: string
  heightFt?: number
  nextHigh?: TideExtreme
  nextLow?: TideExtreme
  extremes: TideExtreme[]
  hourlyFt: number[]
}

const CITY_STATION: Array<{ re: RegExp; id: string }> = [
  { re: /ocean beach|la jolla|pacific beach|mission beach|point loma|sunset cliffs/i, id: "9410230" },
  { re: /san diego|coronado/i, id: "9410230" },
  { re: /santa monica|venice/i, id: "9410840" },
  { re: /los angeles|san pedro|long beach/i, id: "9410660" },
  { re: /san francisco|oakland|alameda/i, id: "9414290" },
]

export function stationById(id: string): TideStation | undefined {
  return TIDE_STATIONS.find((s) => s.id === id)
}

export type CoastPick = {
  stationId: string
  beach: string
  stationName: string
  lat: number
  lng: number
}

/** Named beaches that share a NOAA station (Ocean Beach reads Scripps). */
export const BEACH_ALIASES: CoastPick[] = [
  { stationId: "9410230", beach: "Ocean Beach", stationName: "La Jolla (Scripps)", lat: 32.7493, lng: -117.252 },
  { stationId: "9410230", beach: "Mission Beach", stationName: "La Jolla (Scripps)", lat: 32.7706, lng: -117.2524 },
  { stationId: "9410230", beach: "Pacific Beach", stationName: "La Jolla (Scripps)", lat: 32.794, lng: -117.255 },
  { stationId: "9410230", beach: "La Jolla", stationName: "La Jolla (Scripps)", lat: 32.850, lng: -117.272 },
  { stationId: "9410170", beach: "Coronado", stationName: "San Diego Bay", lat: 32.685, lng: -117.183 },
  { stationId: "9410135", beach: "Imperial Beach", stationName: "Imperial Beach", lat: 32.5794, lng: -117.135 },
  { stationId: "9410840", beach: "Venice Beach", stationName: "Santa Monica", lat: 33.985, lng: -118.473 },
  { stationId: "9410840", beach: "Santa Monica", stationName: "Santa Monica", lat: 34.0083, lng: -118.5 },
  { stationId: "9410660", beach: "San Pedro", stationName: "Los Angeles", lat: 33.72, lng: -118.2722 },
  { stationId: "9414290", beach: "Ocean Beach SF", stationName: "San Francisco", lat: 37.759, lng: -122.511 },
  { stationId: "1612340", beach: "Waikiki", stationName: "Honolulu", lat: 21.276, lng: -157.827 },
  { stationId: "8723214", beach: "South Beach", stationName: "Virginia Key", lat: 25.782, lng: -80.132 },
]

function dist2(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat
  const dLng = (a.lng - b.lng) * Math.cos((a.lat * Math.PI) / 180)
  return dLat * dLat + dLng * dLng
}

/** Rough miles from squared-degree distance (good enough to rank coasts). */
export function coastMiles(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  return Math.sqrt(dist2(from, to)) * 69
}

export function coastPicksNear(lat: number, lng: number, maxMiles = 180): CoastPick[] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const here = { lat, lng }
  const seen = new Set<string>()
  const picks: Array<CoastPick & { miles: number }> = []
  const consider = (pick: CoastPick) => {
    const miles = coastMiles(here, pick)
    if (miles > maxMiles) return
    const key = `${pick.stationId}:${pick.beach}`
    if (seen.has(key)) return
    seen.add(key)
    picks.push({ ...pick, miles })
  }
  for (const alias of BEACH_ALIASES) consider(alias)
  for (const station of TIDE_STATIONS) {
    consider({
      stationId: station.id,
      beach: station.place,
      stationName: station.name,
      lat: station.lat,
      lng: station.lng,
    })
  }
  picks.sort((a, b) => a.miles - b.miles || a.beach.localeCompare(b.beach))
  return picks.slice(0, 10).map(({ miles: _m, ...pick }) => pick)
}

export function searchCoastPicks(query: string, near?: { lat: number; lng: number }): CoastPick[] {
  const q = query.trim().toLowerCase()
  const pool = near ? coastPicksNear(near.lat, near.lng, 400) : [
    ...BEACH_ALIASES,
    ...TIDE_STATIONS.map((s) => ({
      stationId: s.id,
      beach: s.place,
      stationName: s.name,
      lat: s.lat,
      lng: s.lng,
    })),
  ]
  if (q.length < 2) return pool.slice(0, 10)
  return pool.filter((p) => `${p.beach} ${p.stationName}`.toLowerCase().includes(q)).slice(0, 10)
}

export function pickTideStation(city: string, lat?: number, lng?: number): TideStation {
  const text = city.trim()
  for (const rule of CITY_STATION) {
    if (rule.re.test(text)) return stationById(rule.id) ?? SCRIPPS
  }
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    let best = SCRIPPS
    let bestD = Infinity
    const seen = new Set<string>()
    for (const station of TIDE_STATIONS) {
      if (seen.has(station.id)) continue
      seen.add(station.id)
      const d = dist2({ lat, lng }, station)
      if (d < bestD) {
        best = station
        bestD = d
      }
    }
    return best
  }
  return SCRIPPS
}

export function noaaStamp(date: string): string {
  return date.replace(/-/g, "")
}

export function shiftDateKey(date: string, days: number): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return date
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days))
  const y = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const d = String(dt.getUTCDate()).padStart(2, "0")
  return `${y}-${mo}-${d}`
}

export function formatTideClock(stamp: string): { label: string; compact: string } | null {
  const m = stamp.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return null
  let h = Number(m[4])
  const min = m[5]!
  const ampm = h >= 12 ? "PM" : "AM"
  const compactAmpm = h >= 12 ? "p" : "a"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return { label: `${h}:${min} ${ampm}`, compact: `${h}:${min}${compactAmpm}` }
}

type NoaaPred = { t?: string; v?: string; type?: string }
type NoaaLevel = { t?: string; v?: string }

export function parseHomeTide(
  station: TideStation,
  preds: NoaaPred[] | undefined,
  hourly: NoaaPred[] | undefined,
  level: NoaaLevel[] | undefined,
  afterStamp: string,
): HomeTide | null {
  const extremes: TideExtreme[] = []
  for (const row of preds ?? []) {
    if (!row.t || row.v == null) continue
    const kind = row.type === "L" ? "L" : row.type === "H" ? "H" : null
    if (!kind) continue
    const heightFt = Number(row.v)
    const clock = formatTideClock(row.t)
    if (!Number.isFinite(heightFt) || !clock) continue
    extremes.push({
      kind,
      heightFt: Math.round(heightFt * 10) / 10,
      timeLabel: clock.label,
      timeCompact: clock.compact,
      stamp: row.t,
    })
  }
  if (!extremes.length) return null

  const nextHigh = extremes.find((e) => e.kind === "H" && e.stamp >= afterStamp)
  const nextLow = extremes.find((e) => e.kind === "L" && e.stamp >= afterStamp)

  const hourlyFt: number[] = []
  for (const row of hourly ?? []) {
    if (row.v == null) continue
    const n = Number(row.v)
    if (Number.isFinite(n)) hourlyFt.push(n)
  }

  let heightFt: number | undefined
  const latest = level?.[level.length - 1]
  if (latest?.v != null) {
    const n = Number(latest.v)
    if (Number.isFinite(n)) heightFt = Math.round(n * 10) / 10
  } else if (hourlyFt.length) {
    heightFt = Math.round(hourlyFt[Math.min(hourlyFt.length - 1, Math.floor(hourlyFt.length / 2))]! * 10) / 10
  }

  return {
    stationId: station.id,
    stationName: station.name,
    place: station.place,
    heightFt,
    nextHigh,
    nextLow,
    extremes,
    hourlyFt,
  }
}

function noaaUrl(params: Record<string, string>): string {
  const url = new URL("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter")
  url.searchParams.set("application", "brain2")
  url.searchParams.set("format", "json")
  url.searchParams.set("time_zone", "lst_ldt")
  url.searchParams.set("units", "english")
  url.searchParams.set("datum", "MLLW")
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

async function noaaJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function afterStampFor(date: string): string {
  const today = new Date()
  const y = today.getFullYear()
  const mo = String(today.getMonth() + 1).padStart(2, "0")
  const d = String(today.getDate()).padStart(2, "0")
  const todayKey = `${y}-${mo}-${d}`
  if (date !== todayKey) return `${date} 00:00`
  const hh = String(today.getHours()).padStart(2, "0")
  const mm = String(today.getMinutes()).padStart(2, "0")
  return `${date} ${hh}:${mm}`
}

/** NOAA CO-OPS high/low + current height for a city or pinned station (cached 15 min). */
export async function fetchHomeTide(
  city: string,
  date: string,
  stationId?: string | null,
): Promise<HomeTide | null> {
  if (!city.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const pin = stationId?.trim() || ""
  return cached(`tide:${pin || city.trim()}:${date}`, TTL.TIDE, () =>
    fetchHomeTideUncached(city, date, pin || undefined),
  )
}

async function fetchHomeTideUncached(
  city: string,
  date: string,
  stationId?: string,
): Promise<HomeTide | null> {
  const pinned = stationId ? stationById(stationId) : undefined
  const geo = pinned ? null : await geocodeCity(city)
  const station = pinned ?? pickTideStation(city, geo?.lat, geo?.lng)
  const begin = noaaStamp(date)
  const end = noaaStamp(shiftDateKey(date, 1))
  const [hilo, hourly, level] = await Promise.all([
    noaaJson<{ predictions?: NoaaPred[] }>(
      noaaUrl({
        product: "predictions",
        interval: "hilo",
        station: station.id,
        begin_date: begin,
        end_date: end,
      }),
    ),
    noaaJson<{ predictions?: NoaaPred[] }>(
      noaaUrl({
        product: "predictions",
        interval: "h",
        station: station.id,
        begin_date: begin,
        end_date: begin,
      }),
    ),
    noaaJson<{ data?: NoaaLevel[] }>(
      noaaUrl({
        product: "water_level",
        date: "latest",
        station: station.id,
      }),
    ),
  ])
  return parseHomeTide(station, hilo?.predictions, hourly?.predictions, level?.data, afterStampFor(date))
}
