/**
 * lib/transit-time.ts — Travel minutes between two coordinates at a time of day
 *
 * Google Routes API (needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; without it every
 * answer is `undefined` and no tile is suggested). Asks for public transit
 * first, then driving with traffic. Google only prices departures that have
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
export const transitEnabled = () => !!apiKey()

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

/** Minutes to travel, or `undefined` when unknown (no key, no route, offline). */
export async function travelMinutes(from: Pt, to: Pt, date: string, departMin: number): Promise<number | undefined> {
  if (!transitEnabled() || typeof window === "undefined") return undefined
  load()
  const depart = departureFor(date, departMin)
  const key = `${r4(from.lat)},${r4(from.lng)}>${r4(to.lat)},${r4(to.lng)}@${depart.getDay()}-${Math.floor(departMin / 15)}`
  if (memo.has(key)) return memo.get(key) ?? undefined
  try {
    const minutes = (await route(from, to, "TRANSIT", depart)) ?? (await route(from, to, "DRIVE", depart))
    memo.set(key, minutes)
    save()
    return minutes ?? undefined
  } catch {
    return undefined
  }
}
