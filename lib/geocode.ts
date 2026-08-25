/**
 * lib/geocode.ts — Client geocoding via Open-Meteo (works with output: export)
 */
export interface GeocodeResult {
  lat: number
  lng: number
  displayName: string
}

/** @deprecated kept for tests — Open-Meteo URL shape */
export function geocodeApiUrl(query: string, city?: string): string {
  const q = city ? `${query}, ${city}` : query
  const params = new URLSearchParams({ name: q, count: "1" })
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`
}

/** Geocode a place name; returns null on failure / empty. */
export async function geocodePlace(query: string, city?: string): Promise<GeocodeResult | null> {
  const trimmed = query.trim()
  if (!trimmed) return null
  const q = city ? `${trimmed}, ${city}` : trimmed
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.searchParams.set("name", q)
    url.searchParams.set("count", "1")
    url.searchParams.set("language", "en")
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }[]
    }
    const hit = data.results?.[0]
    if (!hit) return null
    const displayName = [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ")
    return { lat: hit.latitude, lng: hit.longitude, displayName: displayName || trimmed }
  } catch {
    return null
  }
}

export function parseCoord(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}
