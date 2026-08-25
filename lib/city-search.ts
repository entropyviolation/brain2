/**
 * lib/city-search.ts — City autocomplete via Open-Meteo geocoding
 *
 * Returns properly capitalized "City, Country" (or City, Region for US/CA/AU)
 * suggestions as the user types. Results are TTL-cached (`lib/api-cache.ts`).
 */

import { TTL, cached } from "@/lib/api-cache"

export interface CitySuggestion {
  /** Display label, e.g. "Lima, Peru" or "San Diego, California" */
  label: string
  name: string
  country?: string
  admin1?: string
  lat: number
  lng: number
  population?: number
}

const REGION_COUNTRIES = new Set(["United States", "Canada", "Australia"])

export function formatCityLabel(hit: {
  name: string
  country?: string
  admin1?: string
  feature_code?: string
}): string {
  const name = hit.name?.trim()
  if (!name) return ""
  const country = hit.country?.trim()
  const admin1 = hit.admin1?.trim()
  // US / Canada / Australia: City, State is the useful form
  if (country && REGION_COUNTRIES.has(country)) {
    if (admin1 && admin1 !== name) return `${name}, ${admin1}`
    return country ? `${name}, ${country}` : name
  }
  // Capitals / unique cities: City, Country
  if (country && country !== name) {
    // Drop redundant admin when it duplicates the city (Mexico City, Mexico City, Mexico)
    if (admin1 && admin1 !== name && admin1 !== country && hit.feature_code === "PPLA") {
      return `${name}, ${admin1}, ${country}`
    }
    return `${name}, ${country}`
  }
  return name
}

/** Title-case a free-typed fragment when geocode fails. */
export function titleCaseCity(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w
      if (w === w.toUpperCase() && w.length <= 3) return w // keep IATA-ish
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(" ")
}

/**
 * Search cities. Prefer the city name alone (Open-Meteo is picky about
 * "City Country" without a comma); if the query includes a comma, try both.
 */
export async function searchCities(query: string, limit = 6): Promise<CitySuggestion[]> {
  const q = query.trim()
  if (q.length < 2) return []
  return cached(`cities:${q}:${limit}`, TTL.CITY, () => searchCitiesUncached(q, limit))
}

async function searchCitiesUncached(q: string, limit: number): Promise<CitySuggestion[]> {
  const nameOnly = q.includes(",") ? q.split(",")[0]!.trim() : q
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.searchParams.set("name", nameOnly)
    url.searchParams.set("count", String(Math.min(limit * 2, 20)))
    url.searchParams.set("language", "en")
    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: {
        name: string
        latitude: number
        longitude: number
        country?: string
        admin1?: string
        population?: number
        feature_code?: string
      }[]
    }
    let results = data.results || []
    // If user typed a country hint, prefer matching country / admin1
    const hint = q.includes(",")
      ? q
          .slice(q.indexOf(",") + 1)
          .trim()
          .toLowerCase()
      : ""
    if (hint) {
      const scored = [...results].sort((a, b) => {
        const score = (r: (typeof results)[0]) => {
          const c = (r.country || "").toLowerCase()
          const a1 = (r.admin1 || "").toLowerCase()
          if (c === hint || a1 === hint) return 0
          if (c.startsWith(hint) || a1.startsWith(hint)) return 1
          if (c.includes(hint) || a1.includes(hint)) return 2
          return 3
        }
        return score(a) - score(b) || (b.population || 0) - (a.population || 0)
      })
      results = scored
    } else {
      results = [...results].sort((a, b) => (b.population || 0) - (a.population || 0))
    }

    const out: CitySuggestion[] = []
    const seen = new Set<string>()
    for (const hit of results) {
      const label = formatCityLabel(hit)
      if (!label || seen.has(label.toLowerCase())) continue
      seen.add(label.toLowerCase())
      out.push({
        label,
        name: hit.name,
        country: hit.country,
        admin1: hit.admin1,
        lat: hit.latitude,
        lng: hit.longitude,
        population: hit.population,
      })
      if (out.length >= limit) break
    }
    return out
  } catch {
    return []
  }
}

/** Resolve typed text to a canonical city label (best match or title-case). */
export async function resolveCityLabel(raw: string): Promise<string> {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  const hits = await searchCities(trimmed, 5)
  if (!hits.length) return titleCaseCity(trimmed)
  // Exact / prefix match on label or name
  const lower = trimmed.toLowerCase()
  const exact = hits.find(
    (h) =>
      h.label.toLowerCase() === lower ||
      h.name.toLowerCase() === lower ||
      h.label.toLowerCase().startsWith(lower),
  )
  return (exact || hits[0])!.label
}
