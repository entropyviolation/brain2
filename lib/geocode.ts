/**
 * lib/geocode.ts — Coordinate parsing + Open-Meteo URL helper
 *
 * Place/city geocoding lives in `city-search.ts` (cached Open-Meteo search).
 * This module keeps the tiny parse helper used by the trip map, plus the
 * documented URL builder used by tests.
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

export function parseCoord(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}
