/**
 * lib/transit-time.ts — Travel minutes between two coordinates at a time of day
 *
 * Driving time from OSRM (OpenStreetMap, free, no key). OSRM prices an empty road,
 * so the free-flow answer is cached per trip and then scaled by `trafficFactor`
 * for the weekday and clock time (rush hour, nights). With
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set it asks Google Routes instead: driving
 * with traffic first, then public transit. Google only prices departures that have
 * not happened yet, so a past block is asked about the same weekday and clock
 * time in the coming week: the typical trip, not that day's. Answers are kept
 * in memory and `localStorage` so a block is priced once.
 */

const KEY_STORE = "brain2-transit-minutes"
const KEEP_MS = 30 * 24 * 60 * 60 * 1000

type Pt = { lat: number; lng: number }
const memo = new Map<string, number | null>()
let loaded = false

const apiKey = () => (typeof process === "undefined" ? "" : process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "")
/** OSRM needs no key, so pricing works in any browser. */
export const transitEnabled = () => typeof window !== "undefined"

function load() {
  if (loaded) return
  loaded = true
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_STORE) ?? "{}") as Record<string, [number | null, number]>
    for (const [k, [v, at]] of Object.entries(raw)) if (Date.now() - at < KEEP_MS) memo.set(k, v)
  } catch {
    /* cache only */
  }
}
function save() {
  try {
    const out: Record<string, [number | null, number]> = {}
    memo.forEach((v, k) => (out[k] = [v, Date.now()]))
    localStorage.setItem(KEY_STORE, JSON.stringify(out))
  } catch {
    /* cache only */
  }
}

/** The next moment that falls on `date`'s weekday at `minute`, never in the past. */
export function departureFor(date: string, minute: number, now: Date = new Date()): Date {
  const d = new Date(`${date}T00:00:00`)
  d.setMinutes(minute)
  while (d.getTime() <= now.getTime() + 60_000) d.setDate(d.getDate() + 7)
  return d
}

const r4 = (n: number) => n.toFixed(4)

/**
 * Typical slowdown over OSRM's empty-road time at a weekday and minute: ~1.15 for
 * lights and parking on a quiet road, up to ~1.6 in weekday rush hours, ~1.3 on
 * weekend afternoons, and no extra at night. An estimate, not live traffic.
 */
export function trafficFactor(day: number, minute: number): number {
  const h = (((minute % 1440) + 1440) % 1440) / 60
  const weekend = day === 0 || day === 6
  const bump = (center: number, width: number, peak: number) => Math.max(0, 1 - Math.abs(h - center) / width) * peak
  if (weekend) return 1.15 + bump(14, 4, 0.15)
  return 1.15 + Math.max(bump(8, 1.75, 0.45), bump(17.25, 2.25, 0.45)) + bump(12.5, 1.5, 0.1)
}

async function route(from: Pt, to: Pt, mode: "TRANSIT" | "DRIVE", depart: Date): Promise<number | null> {
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": "routes.duration" },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: mode,
      departureTime: depart.toISOString(),
      ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { routes?: { duration?: string }[] }
  const secs = parseInt(json.routes?.[0]?.duration ?? "", 10)
  return Number.isFinite(secs) ? Math.ceil(secs / 60) : null
}

async function osrmDrive(from: Pt, to: Pt): Promise<number | null> {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`)
  if (!res.ok) return null
  const json = (await res.json()) as { routes?: { duration?: number }[] }
  const secs = json.routes?.[0]?.duration
  return typeof secs === "number" && Number.isFinite(secs) ? secs / 60 : null
}

/** Minutes to travel, or `undefined` when unknown (no key, no route, offline). */
export async function travelMinutes(from: Pt, to: Pt, date: string, departMin: number): Promise<number | undefined> {
  if (!transitEnabled() || typeof window === "undefined") return undefined
  load()
  const depart = departureFor(date, departMin)
  const od = `${r4(from.lat)},${r4(from.lng)}>${r4(to.lat)},${r4(to.lng)}`
  if (!apiKey()) {
    // Free-flow time is the same all day; only the factor depends on when you leave.
    const flowKey = `o2:${od}`
    try {
      let flow = memo.get(flowKey)
      if (flow === undefined) {
        flow = await osrmDrive(from, to)
        memo.set(flowKey, flow)
        save()
      }
      return flow == null ? undefined : Math.max(1, Math.round(flow * trafficFactor(depart.getDay(), departMin)))
    } catch {
      return undefined
    }
  }
  const key = `g:${od}@${depart.getDay()}-${Math.floor(departMin / 15)}`
  if (memo.has(key)) return memo.get(key) ?? undefined
  try {
    const minutes = (await route(from, to, "DRIVE", depart)) ?? (await route(from, to, "TRANSIT", depart))
    memo.set(key, minutes)
    save()
    return minutes ?? undefined
  } catch {
    return undefined
  }
}
