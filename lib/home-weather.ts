/**
 * lib/home-weather.ts — Home weather instrument copy + widget place
 *
 * Glance math stays in `home-widgets.ts`. This file writes the human
 * sentences, rain plate, advisories, and sanitizes the persisted pin
 * (`brain2-home-weather`) so the widget city/beach is not Settings home city.
 */

import { persistKey } from "@/lib/storage-keys"

export const HOME_WEATHER_STORAGE_KEY = persistKey("home-weather")

export type HomeWeatherPlace = {
  cityQuery: string
  cityName: string
  lat: number | null
  lng: number | null
  stationId: string | null
  beachLabel: string | null
}

export const EMPTY_HOME_WEATHER_PLACE: HomeWeatherPlace = {
  cityQuery: "",
  cityName: "",
  lat: null,
  lng: null,
  stationId: null,
  beachLabel: null,
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = value.trim()
  return t ? t : null
}

export function sanitizeHomeWeatherPlace(raw: unknown): HomeWeatherPlace {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    cityQuery: textOrNull(src.cityQuery) ?? "",
    cityName: textOrNull(src.cityName) ?? "",
    lat: finiteOrNull(src.lat),
    lng: finiteOrNull(src.lng),
    stationId: textOrNull(src.stationId),
    beachLabel: textOrNull(src.beachLabel),
  }
}

/** Widget city: last pin, else Settings home city. */
export function resolveWeatherCity(place: HomeWeatherPlace, settingsHomeCity: string): string {
  return place.cityQuery.trim() || place.cityName.trim() || settingsHomeCity.trim()
}

export function weatherWeekday(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ""
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()] ?? ""
}

/** Dedicated rain plate — never bury the chance in a facts mash. */
export function weatherRainCopy(precipChance: number | undefined): string {
  if (precipChance == null || !Number.isFinite(precipChance)) return "Rain chance unknown"
  const n = Math.max(0, Math.min(100, Math.round(precipChance)))
  if (n <= 10) return `Dry — only ${n}% chance of rain`
  if (n <= 30) return `Slight rain chance ${n}%`
  if (n <= 50) return `Rain chance ${n}%`
  return `Likely rain — ${n}% chance`
}

export type WeatherAdvisoryInput = {
  weatherCode?: number
  windMph?: number
  gustMph?: number
  uvIndex?: number
  visibilityMi?: number
  humidity?: number
  precipChance?: number
}

export function weatherAdvisories(input: WeatherAdvisoryInput): string[] {
  const out: string[] = []
  const code = input.weatherCode ?? 0
  if (code >= 95) out.push("Thunderstorm / lightning risk")
  else if (code >= 80 && (input.precipChance ?? 0) >= 40) out.push("Showers likely")
  const gust = input.gustMph
  const wind = input.windMph
  if (gust != null && gust >= 40) out.push(`Wind advisory — gusts ${gust} mph`)
  else if (wind != null && wind >= 25) out.push(`Breezy — ${wind} mph`)
  if (input.uvIndex != null && input.uvIndex >= 8) out.push(`High UV ${input.uvIndex} — cover up`)
  else if (input.uvIndex != null && input.uvIndex >= 6) out.push(`UV ${input.uvIndex} — strong sun`)
  if (input.visibilityMi != null && input.visibilityMi < 1) out.push("Low visibility")
  if (input.humidity != null && input.humidity >= 90 && (code === 45 || code === 48)) {
    out.push("Fog — humidity high")
  }
  return out
}

export type WeatherStoryInput = {
  city: string
  condition: string
  typical?: boolean
  glance: string
  precipChance?: number
  humidity?: number
  uvIndex?: number
  visibilityMi?: number
  apparentF?: number
  tempF?: number
  windMph?: number
  beachLabel?: string | null
}

/** Short human paragraph for the detail face — words, not a number dump. */
export function weatherHumanForecast(input: WeatherStoryInput): string {
  const city = (input.city || "this coast").trim()
  const where = input.beachLabel?.trim() ? `${input.beachLabel.trim()} near ${city}` : city
  const cond = (input.condition || "Weather").trim()
  const head = input.typical ? `Typically ${cond.toLowerCase()} around ${where}.` : `${cond} around ${where}.`
  const glance = input.glance.includes("·") ? input.glance.split("·").slice(1).join("·").trim() : ""
  const later = glance ? ` ${glance.charAt(0).toUpperCase()}${glance.slice(1)}.` : ""
  const rain = weatherRainCopy(input.precipChance)
  const feel =
    input.apparentF != null && input.tempF != null && Math.abs(input.apparentF - input.tempF) >= 3
      ? ` Feels like ${input.apparentF}°.`
      : ""
  const humid = input.humidity != null ? ` Humidity ${input.humidity}%.` : ""
  const uv = input.uvIndex != null ? ` UV index ${input.uvIndex}.` : ""
  const vis = input.visibilityMi != null ? ` Visibility ${input.visibilityMi} mi.` : ""
  const wind = input.windMph != null ? ` Wind ${input.windMph} mph.` : ""
  return `${head}${later} ${rain}.${feel}${humid}${uv}${vis}${wind}`.replace(/\s+/g, " ").trim()
}
