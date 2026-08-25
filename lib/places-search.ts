/**
 * lib/places-search.ts — Google-style place autocomplete + geocode
 *
 * Uses Photon (Komoot/OSM) by default — works offline of API keys and with
 * static export. Optional Google Places when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is set.
 */

export interface PlaceSuggestion {
  id: string
  /** Short place name */
  name: string
  /** Full address-ish label */
  label: string
  address: string
  lat: number
  lng: number
  /** OSM value e.g. aerodrome, tourism, amenity */
  kind?: string
  /** Bounding box [west, north, east, south] when available */
  extent?: [number, number, number, number]
  source: "photon" | "google" | "nominatim"
  /** Optional photo URLs (Google Places media or Wikimedia). */
  photoUrls?: string[]
  /** Google place id when known (for photo refresh). */
  googlePlaceId?: string
}

function googleMapsKey(): string {
  if (typeof process === "undefined") return ""
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ||
    ""
  )
}

function formatPhotonLabel(props: {
  name?: string
  street?: string
  housenumber?: string
  city?: string
  state?: string
  country?: string
  district?: string
}): { name: string; address: string; label: string } {
  const name = (props.name || [props.housenumber, props.street].filter(Boolean).join(" ") || "Place").trim()
  const parts = [
    props.street && props.housenumber ? `${props.housenumber} ${props.street}` : props.street,
    props.district,
    props.city,
    props.state,
    props.country,
  ].filter(Boolean) as string[]
  // Avoid duplicating name in address when name is the street building
  const address = parts.filter((p) => p !== name).join(", ") || parts.join(", ")
  const label = address && !address.startsWith(name) ? `${name} — ${address}` : name + (address ? `, ${address}` : "")
  return { name, address: address || label, label }
}

async function searchPhoton(
  query: string,
  opts: { lat?: number; lng?: number; limit?: number; lang?: string } = {},
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = new URL("https://photon.komoot.io/api/")
  url.searchParams.set("q", q)
  url.searchParams.set("limit", String(opts.limit ?? 7))
  url.searchParams.set("lang", opts.lang ?? "en")
  if (opts.lat != null && opts.lng != null) {
    url.searchParams.set("lat", String(opts.lat))
    url.searchParams.set("lon", String(opts.lng))
  }
  const res = await fetch(url.toString())
  if (!res.ok) return []
  const data = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: [number, number] }
      properties?: {
        osm_id?: number
        osm_type?: string
        osm_value?: string
        name?: string
        street?: string
        housenumber?: string
        city?: string
        state?: string
        country?: string
        district?: string
        extent?: [number, number, number, number]
      }
    }[]
  }
  const out: PlaceSuggestion[] = []
  for (const f of data.features || []) {
    const coords = f.geometry?.coordinates
    const props = f.properties || {}
    if (!coords || coords.length < 2) continue
    const { name, address, label } = formatPhotonLabel(props)
    out.push({
      id: `photon-${props.osm_type || "n"}-${props.osm_id || `${coords[0]},${coords[1]}`}`,
      name,
      label,
      address,
      lat: coords[1]!,
      lng: coords[0]!,
      kind: props.osm_value,
      extent: props.extent,
      source: "photon",
    })
  }
  return out
}

/** Google Places Autocomplete (New) — only when API key is present. */
async function searchGooglePlaces(
  query: string,
  opts: { lat?: number; lng?: number; limit?: number } = {},
): Promise<PlaceSuggestion[]> {
  const key = googleMapsKey()
  if (!key || query.trim().length < 2) return []
  try {
    const body: Record<string, unknown> = {
      input: query.trim(),
      languageCode: "en",
    }
    if (opts.lat != null && opts.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: 40000,
        },
      }
    }
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string
          text?: { text?: string }
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }
        }
      }[]
    }
    const preds = (data.suggestions || [])
      .map((s) => s.placePrediction)
      .filter(Boolean)
      .slice(0, opts.limit ?? 7)

    const resolved: PlaceSuggestion[] = []
    for (const p of preds) {
      if (!p?.placeId) continue
      const details = await fetchGooglePlaceDetails(p.placeId, key)
      if (!details) continue
      const name = p.structuredFormat?.mainText?.text || details.name
      const secondary = p.structuredFormat?.secondaryText?.text || details.address
      resolved.push({
        id: `google-${p.placeId}`,
        name,
        label: secondary ? `${name} — ${secondary}` : name,
        address: details.address || secondary || name,
        lat: details.lat,
        lng: details.lng,
        source: "google",
        photoUrls: details.photoUrls,
        googlePlaceId: p.placeId,
      })
    }
    return resolved
  } catch {
    return []
  }
}

function googlePhotoMediaUrl(photoName: string, key: string, maxHeightPx = 1200): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${maxHeightPx}&key=${encodeURIComponent(key)}`
}

function photosFromGooglePlace(
  photos: { name?: string }[] | undefined,
  key: string,
  limit = 12,
): string[] {
  const photoUrls: string[] = []
  for (const ph of (photos || []).slice(0, limit)) {
    if (!ph.name) continue
    photoUrls.push(googlePhotoMediaUrl(ph.name, key, 1200))
  }
  return photoUrls
}

async function fetchGooglePlaceDetails(
  placeId: string,
  key: string,
): Promise<{
  name: string
  address: string
  lat: number
  lng: number
  photoUrls?: string[]
} | null> {
  try {
    const id = placeId.replace(/^places\//, "")
    const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "displayName,formattedAddress,location,photos",
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      displayName?: { text?: string }
      formattedAddress?: string
      location?: { latitude?: number; longitude?: number }
      photos?: { name?: string }[]
    }
    const lat = data.location?.latitude
    const lng = data.location?.longitude
    if (lat == null || lng == null) return null
    const photoUrls = photosFromGooglePlace(data.photos, key, 12)
    return {
      name: data.displayName?.text || "Place",
      address: data.formattedAddress || "",
      lat,
      lng,
      photoUrls: photoUrls.length ? photoUrls : undefined,
    }
  } catch {
    return null
  }
}

/** Text Search (New) — best for venue + city when geocoding paste lines. */
async function searchGoogleText(
  query: string,
  opts: { lat?: number; lng?: number } = {},
): Promise<PlaceSuggestion | null> {
  const hits = await searchGoogleTextMany(query, { ...opts, limit: 1 })
  return hits[0] || null
}

/** Text Search returning several hits — better for thrift stores / niche POIs than autocomplete alone. */
async function searchGoogleTextMany(
  query: string,
  opts: { lat?: number; lng?: number; limit?: number } = {},
): Promise<PlaceSuggestion[]> {
  const key = googleMapsKey()
  if (!key || query.trim().length < 2) return []
  try {
    const limit = Math.min(Math.max(opts.limit ?? 5, 1), 8)
    const body: Record<string, unknown> = {
      textQuery: query.trim(),
      languageCode: "en",
      maxResultCount: limit,
    }
    if (opts.lat != null && opts.lng != null) {
      body.locationBias = {
        circle: {
          center: { latitude: opts.lat, longitude: opts.lng },
          radius: 50000,
        },
      }
    }
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.photos",
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      places?: {
        id?: string
        displayName?: { text?: string }
        formattedAddress?: string
        location?: { latitude?: number; longitude?: number }
        photos?: { name?: string }[]
      }[]
    }
    const out: PlaceSuggestion[] = []
    for (const place of data.places || []) {
      const lat = place.location?.latitude
      const lng = place.location?.longitude
      if (lat == null || lng == null) continue
      const name = place.displayName?.text || "Place"
      const address = place.formattedAddress || ""
      const photoUrls = photosFromGooglePlace(place.photos, key, 12)
      const id = place.id ? place.id.replace(/^places\//, "") : `${lat},${lng}`
      out.push({
        id: `google-${id}`,
        name,
        label: address ? `${name} — ${address}` : name,
        address,
        lat,
        lng,
        source: "google",
        photoUrls: photoUrls.length ? photoUrls : undefined,
        googlePlaceId: id,
      })
    }
    return out
  } catch {
    return []
  }
}

async function nominatimGeocode(
  query: string,
  opts: { lat?: number; lng?: number } = {},
): Promise<PlaceSuggestion | null> {
  const q = query.trim()
  if (q.length < 3) return null
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search")
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", "1")
    url.searchParams.set("q", q)
    if (opts.lat != null && opts.lng != null) {
      // viewbox around city (~0.35 deg ≈ 40km)
      const pad = 0.35
      url.searchParams.set(
        "viewbox",
        `${opts.lng - pad},${opts.lat + pad},${opts.lng + pad},${opts.lat - pad}`,
      )
      url.searchParams.set("bounded", "0")
    }
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "cogs-app/1.0 (trip itinerary places)",
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      lat?: string
      lon?: string
      display_name?: string
      place_id?: number
    }[]
    const hit = data[0]
    if (!hit?.lat || !hit?.lon) return null
    const lat = Number(hit.lat)
    const lng = Number(hit.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    const address = hit.display_name || q
    return {
      id: `nominatim-${hit.place_id || `${lat},${lng}`}`,
      name: q.split(",")[0]!.trim() || "Place",
      label: address,
      address,
      lat,
      lng,
      source: "nominatim",
    }
  } catch {
    return null
  }
}

/**
 * Resolve a pasted place line. Prefer address geocoding so pins keep the
 * restaurant/activity name even when OSM only knows the street.
 */
export async function resolvePlacePaste(
  parsed: { name: string; address?: string; raw: string },
  cityLabel: string,
  cityLat?: number,
  cityLng?: number,
): Promise<PlaceSuggestion | null> {
  const cityName = cityLabel.split(",")[0]!.trim()
  const displayName = parsed.name.trim()
  if (!displayName) return null

  const withName = (hit: PlaceSuggestion): PlaceSuggestion => ({
    ...hit,
    name: displayName,
    label: hit.address ? `${displayName} — ${hit.address}` : displayName,
  })

  // 1) Google Text search (name + address / city) — best photos + coords
  if (googleMapsKey()) {
    const queries = [
      parsed.address ? `${displayName}, ${parsed.address}` : null,
      `${displayName}, ${cityName}`,
      parsed.address || null,
    ].filter(Boolean) as string[]
    for (const q of queries) {
      const g = await searchGoogleText(q, { lat: cityLat, lng: cityLng })
      if (g) return withName(g)
    }
  }

  // 2) Geocode the street address first when present (most paste lines)
  if (parsed.address) {
    const addrQueries = [
      parsed.address,
      parsed.address.replace(/\s+\d{4,6}\b/g, ""), // drop postal codes that confuse Photon
      `${parsed.address.split(",")[0]}, ${cityName}`,
    ]
    for (const q of addrQueries) {
      const hits = await searchPhoton(q, { lat: cityLat, lng: cityLng, limit: 5 })
      const near = hits.filter((h) => {
        if (cityLat == null || cityLng == null) return true
        const d = (h.lat - cityLat) ** 2 + (h.lng - cityLng) ** 2
        return d < 0.35
      })
      if (near[0]) return withName({ ...near[0], address: parsed.address || near[0].address })
    }
    const nom = await nominatimGeocode(parsed.address, { lat: cityLat, lng: cityLng })
    if (nom) return withName({ ...nom, address: parsed.address })
  }

  // 3) Photon: venue name in city (known OSM POIs like airports / landmarks)
  {
    const hits = await searchPhoton(`${displayName}, ${cityName}`, {
      lat: cityLat,
      lng: cityLng,
      limit: 5,
    })
    const cityToken = cityName.toLowerCase()
    const ranked = hits
      .filter((h) => {
        if (cityLat == null || cityLng == null) return true
        const d = (h.lat - cityLat) ** 2 + (h.lng - cityLng) ** 2
        return d < 0.35
      })
      .sort((a, b) => {
        const score = (h: PlaceSuggestion) => {
          let s = 0
          if (h.name.toLowerCase() === displayName.toLowerCase()) s += 5
          if (h.name.toLowerCase().includes(displayName.toLowerCase().slice(0, 8))) s += 2
          if (h.address.toLowerCase().includes(cityToken)) s += 2
          if (h.kind && !/residential|street|highway/i.test(h.kind)) s += 1
          return s
        }
        return score(b) - score(a)
      })
    const exactish = ranked.find(
      (h) =>
        h.name.toLowerCase() === displayName.toLowerCase() ||
        displayName.toLowerCase().startsWith(h.name.toLowerCase()) ||
        h.name.toLowerCase().startsWith(displayName.toLowerCase()),
    )
    if (exactish) return withName(exactish)
  }

  // 4) Fall back to freeform resolve
  const fallback = await resolvePlaceInCity(
    parsed.address ? `${displayName}, ${parsed.address}` : displayName,
    cityLabel,
    cityLat,
    cityLng,
  )
  return fallback ? withName(fallback) : null
}

/**
 * Best-effort photos for a place (Google when keyed; otherwise Wikimedia).
 */
export async function fetchPlacePhotos(opts: {
  name: string
  address?: string
  cityLabel?: string
  lat?: number
  lng?: number
  googlePlaceId?: string
}): Promise<string[]> {
  const key = googleMapsKey()
  if (key) {
    if (opts.googlePlaceId) {
      const details = await fetchGooglePlaceDetails(opts.googlePlaceId, key)
      if (details?.photoUrls?.length) return details.photoUrls
    }
    const q = [opts.name, opts.address || opts.cityLabel].filter(Boolean).join(", ")
    const g = await searchGoogleText(q, { lat: opts.lat, lng: opts.lng })
    if (g?.photoUrls?.length) return g.photoUrls
  }

  // Wikimedia Commons — free, best-effort
  try {
    const search = [opts.name, opts.cityLabel?.split(",")[0]].filter(Boolean).join(" ")
    const url = new URL("https://commons.wikimedia.org/w/api.php")
    url.searchParams.set("action", "query")
    url.searchParams.set("generator", "search")
    url.searchParams.set("gsrsearch", search)
    url.searchParams.set("gsrlimit", "8")
    url.searchParams.set("gsrnamespace", "6")
    url.searchParams.set("prop", "imageinfo")
    url.searchParams.set("iiprop", "url")
    url.searchParams.set("iiurlwidth", "1280")
    url.searchParams.set("format", "json")
    url.searchParams.set("origin", "*")
    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> }
    }
    const pages = Object.values(data.query?.pages || {})
    const urls: string[] = []
    for (const p of pages) {
      const info = p.imageinfo?.[0]
      const u = info?.thumburl || info?.url
      if (u) urls.push(u)
    }
    return urls
  } catch {
    return []
  }
}

/**
 * Autocomplete suggestions biased to a city (lat/lng). Prefers Google when
 * configured; merges Text Search (better for niche POIs) with Autocomplete.
 */
export async function searchPlaces(
  query: string,
  opts: { cityLat?: number; cityLng?: number; cityLabel?: string; limit?: number } = {},
): Promise<PlaceSuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const cityShort = opts.cityLabel?.split(",")[0]?.trim() || ""
  const biased =
    cityShort && !q.toLowerCase().includes(cityShort.toLowerCase()) ? `${q}, ${cityShort}` : q
  const limit = opts.limit ?? 7

  if (googleMapsKey()) {
    const loc = { lat: opts.cityLat, lng: opts.cityLng }
    // Text search first for thrift stores / niche venues; autocomplete for typed names
    const [textHits, autoHits] = await Promise.all([
      searchGoogleTextMany(biased, { ...loc, limit }),
      searchGooglePlaces(biased, { ...loc, limit }),
    ])
    const seen = new Set<string>()
    const merged: PlaceSuggestion[] = []
    for (const hit of [...textHits, ...autoHits]) {
      const key = hit.googlePlaceId || `${hit.lat.toFixed(5)},${hit.lng.toFixed(5)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(hit)
      if (merged.length >= limit) break
    }
    if (merged.length) return merged
  }

  return searchPhoton(biased, {
    lat: opts.cityLat,
    lng: opts.cityLng,
    limit,
  })
}

/**
 * Geocode a freeform name + address (for manual edit). Updates pin when possible.
 */
function scrubPlaceText(s: string): string {
  // Strip BOM / zero-width chars that paste from mail/docs into addresses
  return s.replace(/[\u200B-\u200D\uFEFF]/g, "").trim()
}

export async function geocodeNameAddress(
  name: string,
  address: string,
  opts: { cityLabel?: string; cityLat?: number; cityLng?: number } = {},
): Promise<PlaceSuggestion | null> {
  const nameQ = scrubPlaceText(name)
  const addrQ = scrubPlaceText(address)
  if (!nameQ && !addrQ) return null
  const cityShort = opts.cityLabel?.split(",")[0]?.trim() || ""
  const addressLooksPrecise =
    addrQ.length >= 8 &&
    (/\d/.test(addrQ) ||
      /\b(av\.?|avenida|jr\.?|jir[oó]n|calle|street|st\.|road|rd\.|blvd|plaza|paseo)\b/i.test(addrQ))

  // Prefer the typed address for pin placement when it looks like a real street address
  const queries = (
    addressLooksPrecise
      ? [addrQ, [nameQ, addrQ].filter(Boolean).join(", "), [addrQ, cityShort].filter(Boolean).join(", "), nameQ]
      : [[nameQ, addrQ].filter(Boolean).join(", "), [nameQ, cityShort].filter(Boolean).join(", "), addrQ, nameQ]
  ).filter((q, i, arr) => q.length >= 3 && arr.indexOf(q) === i)

  for (const q of queries) {
    if (googleMapsKey()) {
      const g = await searchGoogleText(q, { lat: opts.cityLat, lng: opts.cityLng })
      if (g) {
        return {
          ...g,
          name: nameQ || g.name,
          address: addrQ || g.address,
          label: addrQ ? `${nameQ || g.name} — ${addrQ}` : g.label,
        }
      }
    }
    const n = await nominatimGeocode(q, { lat: opts.cityLat, lng: opts.cityLng })
    if (n) {
      return {
        ...n,
        name: nameQ || n.name,
        address: addrQ || n.address,
        label: addrQ ? `${nameQ || n.name} — ${addrQ}` : n.label,
      }
    }
  }
  return null
}

/**
 * Best-guess geocode for a freeform place name in a city context.
 * Tries city-biased search; returns top hit.
 */
export async function resolvePlaceInCity(
  name: string,
  cityLabel: string,
  cityLat?: number,
  cityLng?: number,
): Promise<PlaceSuggestion | null> {
  const hits = await searchPlaces(name, {
    cityLabel,
    cityLat,
    cityLng,
    limit: 5,
  })
  if (!hits.length) return null
  // Prefer hits whose address/city mentions the trip city
  const cityToken = cityLabel.split(",")[0]!.trim().toLowerCase()
  const ranked = [...hits].sort((a, b) => {
    const score = (h: PlaceSuggestion) => {
      let s = 0
      if (h.label.toLowerCase().includes(cityToken)) s += 3
      if (h.address.toLowerCase().includes(cityToken)) s += 2
      if (h.name.toLowerCase() === name.trim().toLowerCase()) s += 4
      if (h.kind === "aerodrome" && /airport/i.test(name)) s += 5
      return s
    }
    return score(b) - score(a)
  })
  return ranked[0] || null
}

/** Find the main airport near a city. */
export async function findCityAirport(
  cityLabel: string,
  cityLat: number,
  cityLng: number,
): Promise<PlaceSuggestion | null> {
  const cityName = cityLabel.split(",")[0]!.trim()
  const queries = [`${cityName} airport`, `${cityName} international airport`]
  for (const q of queries) {
    const hits = await searchPhoton(q, { lat: cityLat, lng: cityLng, limit: 8 })
    const aerodromes = hits.filter((h) => h.kind === "aerodrome" || /airport|aeropuerto|aéroport/i.test(h.name))
    const pool = aerodromes.length ? aerodromes : hits
    if (!pool.length) continue
    // Nearest to city center
    const withDist = pool.map((h) => ({
      h,
      d: (h.lat - cityLat) ** 2 + (h.lng - cityLng) ** 2,
    }))
    withDist.sort((a, b) => a.d - b.d)
    const best = withDist[0]!.h
    // Reject if absurdly far (> ~80km roughly 0.7 deg)
    if (withDist[0]!.d > 0.5) continue
    return best
  }
  return null
}

export interface CityMapRegion {
  lat: number
  lng: number
  /** [west, south, east, north] for Leaflet */
  bounds: [[number, number], [number, number]]
  /** Optional polygon ring [lat, lng][] */
  polygon?: [number, number][]
  label: string
}

/** City center + padded bounds for map framing. */
export async function fetchCityRegion(cityLabel: string): Promise<CityMapRegion | null> {
  const cityName = cityLabel.trim()
  if (!cityName) return null
  const hits = await searchPhoton(cityName, { limit: 5 })
  const cityHit =
    hits.find((h) => h.kind === "city" || h.kind === "town" || h.kind === "municipality") ||
    hits.find((h) => h.extent) ||
    hits[0]
  if (!cityHit) return null

  let west: number, east: number, south: number, north: number
  if (cityHit.extent) {
    ;[west, north, east, south] = cityHit.extent
  } else {
    // ~8km pad if no extent
    const pad = 0.08
    west = cityHit.lng - pad
    east = cityHit.lng + pad
    south = cityHit.lat - pad
    north = cityHit.lat + pad
  }
  // Pad so the city isn't edge-to-edge; expand tiny downtown extents to metro-ish
  const latSpan = Math.max(north - south, 0.12)
  const lngSpan = Math.max(east - west, 0.12)
  const padLat = latSpan * 0.45
  const padLng = lngSpan * 0.45
  const midLat = (north + south) / 2
  const midLng = (east + west) / 2
  west = midLng - lngSpan / 2 - padLng
  east = midLng + lngSpan / 2 + padLng
  south = midLat - latSpan / 2 - padLat
  north = midLat + latSpan / 2 + padLat

  const polygon: [number, number][] = [
    [south, west],
    [south, east],
    [north, east],
    [north, west],
  ]

  return {
    lat: cityHit.lat,
    lng: cityHit.lng,
    bounds: [
      [south, west],
      [north, east],
    ],
    polygon,
    label: cityHit.label || cityName,
  }
}
