/**
 * lib/pen-place.ts — Where a Location pen is: an address, a zip, attached coordinates
 *
 * A Location pen can carry a place (`TrackPen.place`). None of it is
 * "counts as": a coordinate pair is another name for the same pen, not a
 * broader pen above it. When a GPS fix lands near one, the fix *is* that pen.
 *
 * - `address` + `lat`/`lng` + `parts`: picked from address search
 *   (`lib/geo-address.ts`). `parts` (neighborhood, city, state, country, …)
 *   files the pen under the view's level pens (`lib/pen-place-actions.ts`).
 * - `zip` (+ `zipLat`/`zipLng`, looked up once): a coarse area. A fix within
 *   `ZIP_RADIUS_M` of the zip's center matches when nothing finer does.
 * - `coords`: any number of attached points, each with an optional label and
 *   radius (default `PIN_RADIUS_M`).
 *
 * Matching (`penForCoordinate`): the nearest pin or coordinate within its
 * radius wins; then the nearest zip area. Pure; structural types only.
 */

export type AddressParts = {
  house?: string
  street?: string
  neighborhood?: string
  city?: string
  county?: string
  state?: string
  country?: string
  postcode?: string
}

export type PenCoord = {
  id: string
  lat: number
  lng: number
  label?: string
  /** Meters. Default `PIN_RADIUS_M`. */
  radiusM?: number
}

export type PenPlace = {
  address?: string
  lat?: number
  lng?: number
  parts?: AddressParts
  zip?: string
  zipLat?: number
  zipLng?: number
  coords?: PenCoord[]
}

/** Same building or lot, allowing for phone GPS drift. */
export const PIN_RADIUS_M = 120
/** A zip code is an area; its center stands in for it. */
export const ZIP_RADIUS_M = 3500

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

type PlacePen = { id: string; name: string; place?: PenPlace }

export type PlaceMatch = { penId: string; kind: "pin" | "coord" | "zip"; meters: number; label?: string }

/** Every point a pen answers to, with its radius. */
export function placePoints(place: PenPlace | undefined): { lat: number; lng: number; radiusM: number; kind: PlaceMatch["kind"]; label?: string }[] {
  if (!place) return []
  const out: { lat: number; lng: number; radiusM: number; kind: PlaceMatch["kind"]; label?: string }[] = []
  if (isFiniteCoord(place.lat, place.lng)) out.push({ lat: place.lat!, lng: place.lng!, radiusM: PIN_RADIUS_M, kind: "pin", label: place.address })
  for (const coord of place.coords ?? []) {
    if (isFiniteCoord(coord.lat, coord.lng)) out.push({ lat: coord.lat, lng: coord.lng, radiusM: coord.radiusM ?? PIN_RADIUS_M, kind: "coord", label: coord.label })
  }
  return out
}

export function isFiniteCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

/** The pen a fix belongs to: nearest pin or coordinate in range, else nearest zip area. */
export function penForCoordinate(pens: PlacePen[], lat: number, lng: number): PlaceMatch | null {
  let best: PlaceMatch | null = null
  for (const pen of pens) {
    for (const point of placePoints(pen.place)) {
      const meters = haversineMeters({ lat, lng }, point)
      if (meters > point.radiusM) continue
      if (!best || meters < best.meters) best = { penId: pen.id, kind: point.kind, meters, label: point.label }
    }
  }
  if (best) return best
  for (const pen of pens) {
    const place = pen.place
    if (!place?.zip || !isFiniteCoord(place.zipLat, place.zipLng)) continue
    const meters = haversineMeters({ lat, lng }, { lat: place.zipLat!, lng: place.zipLng! })
    if (meters > ZIP_RADIUS_M) continue
    if (!best || meters < best.meters) best = { penId: pen.id, kind: "zip", meters, label: place.zip }
  }
  return best
}

/** "37.7694, -122.4862" or "37.7694 -122.4862" → coords. */
export function parseCoordPair(text: string): { lat: number; lng: number } | null {
  const match = /(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/.exec(text.trim())
  if (!match) return null
  const lat = Number.parseFloat(match[1]!)
  const lng = Number.parseFloat(match[2]!)
  return isFiniteCoord(lat, lng) ? { lat, lng } : null
}

export function formatCoord(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function makeCoordId(): string {
  return `crd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** One line for the parts, broad last: Ocean Beach · San Diego · California · United States. */
export function partsLine(parts: AddressParts | undefined): string {
  if (!parts) return ""
  return [parts.neighborhood, parts.city, parts.state, parts.country].filter(Boolean).join(" · ")
}

/**
 * Which address part feeds a level, by the level's name. Lets a person's own
 * level names (Region, Province, Borough) file too.
 */
export function partForLevelName(levelName: string, parts: AddressParts): string | undefined {
  const name = levelName.trim().toLowerCase()
  if (/^(country|nation)$/.test(name)) return parts.country
  if (/^(state|province|region|prefecture)$/.test(name)) return parts.state
  if (/^(county|district county)$/.test(name)) return parts.county
  if (/^(city|town|village|municipality)$/.test(name)) return parts.city
  if (/^(neighborhood|neighbourhood|district|borough|area|suburb)$/.test(name)) return parts.neighborhood
  if (/^(zip|zip code|postal code|postcode)$/.test(name)) return parts.postcode
  return undefined
}
