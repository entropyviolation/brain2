/**
 * lib/trip-directions.ts — Distance / directions between two map points
 *
 * Road distance via OSRM (free). Walking duration is computed from distance at a
 * realistic walking pace — the public OSRM demo returns car speeds for every
 * profile, so we never trust its foot/bike durations. Driving uses OSRM car
 * duration. Transit opens Google Maps (optional Directions API if keyed).
 */

import { TTL, cached } from "@/lib/api-cache"

export type TravelMode = "walking" | "transit" | "driving"

export interface RouteEstimate {
  mode: TravelMode
  distanceMeters: number
  durationSeconds: number
  distanceLabel: string
  durationLabel: string
  source: "osrm" | "google" | "link" | "estimate"
  /** Google Maps directions URL (always available) */
  mapsUrl: string
}

/** Typical urban walking pace (~5 km/h). */
export const WALKING_SPEED_MPS = 5000 / 3600

function googleMapsKey(): string {
  if (typeof process === "undefined") return ""
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  const miles = meters / 1609.344
  if (km < 10) return `${km.toFixed(1)} km (${miles.toFixed(1)} mi)`
  return `${Math.round(km)} km (${miles.toFixed(1)} mi)`
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}m` : `${h}h`
}

/** Walking time from road (or straight-line) distance. */
export function walkingDurationSeconds(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0
  return distanceMeters / WALKING_SPEED_MPS
}

export function googleMapsDirectionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: mode,
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

async function osrmRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  profile: "foot" | "car",
): Promise<{ distance: number; duration: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      code?: string
      routes?: { distance: number; duration: number }[]
    }
    if (data.code !== "Ok" || !data.routes?.[0]) return null
    return { distance: data.routes[0].distance, duration: data.routes[0].duration }
  } catch {
    return null
  }
}

async function googleDirections(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
): Promise<{ distance: number; duration: number } | null> {
  const key = googleMapsKey()
  if (!key) return null
  try {
    const params = new URLSearchParams({
      origin: `${from.lat},${from.lng}`,
      destination: `${to.lat},${to.lng}`,
      mode: mode === "transit" ? "transit" : mode === "walking" ? "walking" : "driving",
      key,
    })
    // Note: may hit CORS in browser; fail soft to OSRM / link
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      status?: string
      routes?: { legs?: { distance?: { value?: number }; duration?: { value?: number } }[] }[]
    }
    const leg = data.routes?.[0]?.legs?.[0]
    if (data.status !== "OK" || !leg?.distance?.value || !leg.duration?.value) return null
    return { distance: leg.distance.value, duration: leg.duration.value }
  } catch {
    return null
  }
}

export async function estimateRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
): Promise<RouteEstimate> {
  const key = `route:${mode}:${from.lat.toFixed(5)},${from.lng.toFixed(5)}:${to.lat.toFixed(5)},${to.lng.toFixed(5)}`
  return cached(key, TTL.ROUTE, () => estimateRouteUncached(from, to, mode))
}

async function estimateRouteUncached(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode,
): Promise<RouteEstimate> {
  const mapsUrl = googleMapsDirectionsUrl(from, to, mode)

  if (mode === "transit") {
    const g = await googleDirections(from, to, "transit")
    if (g) {
      return {
        mode,
        distanceMeters: g.distance,
        durationSeconds: g.duration,
        distanceLabel: formatDistance(g.distance),
        durationLabel: formatDuration(g.duration),
        source: "google",
        mapsUrl,
      }
    }
    const straight = haversineMeters(from, to)
    return {
      mode,
      distanceMeters: straight,
      durationSeconds: 0,
      distanceLabel: `~${formatDistance(straight)} straight-line`,
      durationLabel: "See Google Maps",
      source: "link",
      mapsUrl,
    }
  }

  // Prefer Google when available (accurate walking + driving).
  const g = await googleDirections(from, to, mode)
  if (g) {
    return {
      mode,
      distanceMeters: g.distance,
      durationSeconds: g.duration,
      distanceLabel: formatDistance(g.distance),
      durationLabel: formatDuration(g.duration),
      source: "google",
      mapsUrl,
    }
  }

  // OSRM for road distance. Public demo ignores foot profile for duration —
  // always use car geometry for distance, then pace walking ourselves.
  const osrm = await osrmRoute(from, to, "car")
  if (osrm) {
    if (mode === "walking") {
      const durationSeconds = walkingDurationSeconds(osrm.distance)
      return {
        mode,
        distanceMeters: osrm.distance,
        durationSeconds,
        distanceLabel: formatDistance(osrm.distance),
        durationLabel: formatDuration(durationSeconds),
        source: "estimate",
        mapsUrl,
      }
    }
    return {
      mode,
      distanceMeters: osrm.distance,
      durationSeconds: osrm.duration,
      distanceLabel: formatDistance(osrm.distance),
      durationLabel: formatDuration(osrm.duration),
      source: "osrm",
      mapsUrl,
    }
  }

  const straight = haversineMeters(from, to)
  if (mode === "walking") {
    const durationSeconds = walkingDurationSeconds(straight)
    return {
      mode,
      distanceMeters: straight,
      durationSeconds,
      distanceLabel: `~${formatDistance(straight)} straight-line`,
      durationLabel: formatDuration(durationSeconds),
      source: "estimate",
      mapsUrl,
    }
  }

  return {
    mode,
    distanceMeters: straight,
    durationSeconds: 0,
    distanceLabel: `~${formatDistance(straight)} straight-line`,
    durationLabel: "See Google Maps",
    source: "link",
    mapsUrl,
  }
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
