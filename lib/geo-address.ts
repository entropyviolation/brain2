/**
 * lib/geo-address.ts — Address search, reverse lookup, and zip lookup with parts
 *
 * The itinerary search (`lib/places-search.ts`) returns one formatted address
 * string. Filing a Location pen under its Neighborhood, City, State, and
 * Country needs the parts, so this asks Photon (OSM, keyless, the app's
 * default place search) for structured results:
 *
 * - `searchAddresses(query, near?)` — Photon `/api`, biased near a point.
 *   When a Google Places key is set (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), the
 *   itinerary's Google results are offered first and their parts come from a
 *   Photon reverse lookup of the picked point.
 * - `reverseGeocode(lat, lng)` — Photon `/reverse`: the parts for a fix.
 * - `geocodeZip(zip, countryCode?)` — Nominatim `postalcode=` search: the zip's
 *   center plus its city / state / country.
 *
 * Results are cached through `lib/api-cache.ts`. Every call fails soft (empty
 * or null) so a pen editor never breaks offline.
 */
import { cached, TTL } from "@/lib/api-cache"
import { searchPlaces } from "@/lib/places-search"
import type { AddressParts } from "@/lib/pen-place"

export type AddressSuggestion = {
  id: string
  /** Short name: the place or the street line. */
  name: string
  /** Full line for display and storage. */
  label: string
  lat: number
  lng: number
  parts: AddressParts
  source: "photon" | "google"
}

type PhotonProps = {
  osm_id?: number
  osm_type?: string
  name?: string
  housenumber?: string
  street?: string
  postcode?: string
  district?: string
  locality?: string
  city?: string
  county?: string
  state?: string
  country?: string
}

type PhotonFeature = { geometry?: { coordinates?: [number, number] }; properties?: PhotonProps }

function partsFromPhoton(p: PhotonProps): AddressParts {
  return clean({
    house: p.housenumber,
    street: p.street,
    neighborhood: p.district || p.locality,
    city: p.city,
    county: p.county,
    state: p.state,
    country: p.country,
    postcode: p.postcode,
  })
}

function clean(parts: AddressParts): AddressParts {
  const out: AddressParts = {}
  for (const [key, value] of Object.entries(parts) as [keyof AddressParts, string | undefined][]) {
    const v = value?.trim()
    if (v) out[key] = v
  }
  return out
}

function labelFor(p: PhotonProps): string {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ")
  const head = p.name && p.name !== p.street ? p.name : ""
  return [head, street, p.district || p.locality, p.city, p.state, p.postcode, p.country]
    .filter((part, i, all) => part && all.indexOf(part) === i)
    .join(", ")
}

function fromFeature(feature: PhotonFeature, i: number): AddressSuggestion | null {
  const coords = feature.geometry?.coordinates
  const p = feature.properties ?? {}
  if (!coords) return null
  const [lng, lat] = coords
  const street = [p.housenumber, p.street].filter(Boolean).join(" ")
  return {
    id: `photon-${p.osm_type ?? "x"}-${p.osm_id ?? i}`,
    name: p.name || street || p.city || p.state || p.country || "Place",
    label: labelFor(p),
    lat,
    lng,
    parts: partsFromPhoton(p),
    source: "photon",
  }
}

async function getJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(url, headers ? { headers } : undefined)
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function searchAddresses(
  query: string,
  near?: { lat: number; lng: number } | null,
  limit = 6,
): Promise<AddressSuggestion[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const bias = near ? `&lat=${near.lat.toFixed(3)}&lon=${near.lng.toFixed(3)}` : ""
  const photonPromise = cached(`addr:${q}:${bias}`, TTL.PLACE, async () => {
    const data = await getJson<{ features?: PhotonFeature[] }>(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en${bias}`,
    )
    return (data?.features ?? []).map(fromFeature).filter((s): s is AddressSuggestion => s !== null)
  })
  const hasGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY)
  if (!hasGoogle) return photonPromise
  const [photon, google] = await Promise.all([
    photonPromise,
    searchPlaces(q, near ? { cityLat: near.lat, cityLng: near.lng, limit: 4 } : { limit: 4 }).catch(() => []),
  ])
  const fromGoogle: AddressSuggestion[] = google
    .filter((place) => place.source === "google")
    .map((place) => ({
      id: `google-${place.googlePlaceId ?? place.id}`,
      name: place.name,
      label: place.address || place.label,
      lat: place.lat,
      lng: place.lng,
      parts: {},
      source: "google" as const,
    }))
  return [...fromGoogle, ...photon].slice(0, limit + 2)
}

/** Parts for a point. Null when the lookup fails. */
export async function reverseGeocode(lat: number, lng: number): Promise<AddressSuggestion | null> {
  const key = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`
  return cached(key, TTL.PLACE, async () => {
    const data = await getJson<{ features?: PhotonFeature[] }>(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`,
    )
    const feature = data?.features?.[0]
    return feature ? fromFeature(feature, 0) : null
  })
}

/** Fill a suggestion's parts (a Google pick has none) from a reverse lookup. */
export async function withParts(suggestion: AddressSuggestion): Promise<AddressSuggestion> {
  if (Object.keys(suggestion.parts).length) return suggestion
  const reverse = await reverseGeocode(suggestion.lat, suggestion.lng)
  return reverse ? { ...suggestion, parts: reverse.parts } : suggestion
}

type NominatimHit = {
  lat?: string
  lon?: string
  display_name?: string
  address?: Record<string, string>
}

/** A zip's center and the places it sits in. */
export async function geocodeZip(
  zip: string,
  countryCode?: string,
): Promise<{ lat: number; lng: number; parts: AddressParts; label: string } | null> {
  const z = zip.trim()
  if (!z) return null
  const country = countryCode ? `&countrycodes=${encodeURIComponent(countryCode)}` : ""
  return cached(`zip:${z}:${country}`, TTL.PLACE, async () => {
    const hits = await getJson<NominatimHit[]>(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&postalcode=${encodeURIComponent(z)}${country}`,
      { "User-Agent": "Brain2/1.0 (tracking places)" },
    )
    const hit = hits?.[0]
    if (!hit?.lat || !hit.lon) return null
    const a = hit.address ?? {}
    return {
      lat: Number.parseFloat(hit.lat),
      lng: Number.parseFloat(hit.lon),
      label: hit.display_name ?? z,
      parts: clean({
        neighborhood: a.suburb || a.neighbourhood || a.city_district,
        city: a.city || a.town || a.village || a.municipality,
        county: a.county,
        state: a.state,
        country: a.country,
        postcode: a.postcode || z,
      }),
    }
  })
}
