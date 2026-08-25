/**
 * lib/weather-client.ts — Open-Meteo weather + sunrise/sunset (browser, no API route)
 *
 * Forecast covers ~16 days; farther dates fall back to prior-year archive
 * (weather labeled "Typically …"). Sunrise/sunset use the same endpoints.
 */

import { resolveCityLabel } from "@/lib/city-search"

/** Minimal day shape for climate city resolution (avoids circular imports). */
export type ClimateDayInput = {
  date: string
  cityMode: "city" | "travel"
  city: string
  fromCity?: string
  toCity?: string
  climateCity?: string
  schedule: Array<{
    kind: string
    time?: string
    text: string
    flight?: {
      arrivalTime?: string
      segments?: Array<{ departTime?: string; arriveTime?: string }>
    }
  }>
}

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorms",
  96: "Thunderstorms",
  99: "Thunderstorms",
}

export type DayClimate = {
  weather: string
  /** Display e.g. "6:29 AM" */
  sunrise: string
  /** Display e.g. "5:59 PM" */
  sunset: string
  /** HH:mm 24h */
  sunriseHhmm: string
  sunsetHhmm: string
  cityName: string
  typical?: boolean
}

function weatherLabel(code: number | undefined, min?: number, max?: number, typical = false): string {
  const cond = code != null ? WMO[code] || "Weather" : "Weather"
  const prefix = typical ? "Typically " : ""
  if (min != null && max != null && Number.isFinite(min) && Number.isFinite(max)) {
    return `${prefix}${Math.round(min)}°–${Math.round(max)}°F, ${cond}`
  }
  if (max != null && Number.isFinite(max)) return `${prefix}${Math.round(max)}°F, ${cond}`
  return `${prefix}${cond}`
}

function queryCityName(city: string): string {
  const raw = city.trim()
  if (!raw) return ""
  const viaArrow = raw.includes("→") ? raw.split("→").pop()!.trim() : raw
  return viaArrow.split(",")[0]!.trim()
}

/** Format Open-Meteo "2026-07-20T06:29" → display + hhmm */
export function formatSunClock(isoLocal: string | undefined): { display: string; hhmm: string } | null {
  if (!isoLocal) return null
  const m = isoLocal.match(/T(\d{2}):(\d{2})/)
  if (!m) return null
  const hhmm = `${m[1]}:${m[2]}`
  let h = Number(m[1])
  const min = m[2]!
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return { display: `${h}:${min} ${ampm}`, hhmm }
}

export function minutesFromHhmm(hhmm: string): number {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return 0
  return Number(m[1]) * 60 + Number(m[2])
}

/** Overlap of [a0,a1) with [b0,b1) in minutes (0–1440 clock). */
export function overlapMinutes(a0: number, a1: number, b0: number, b1: number): number {
  const start = Math.max(a0, b0)
  const end = Math.min(a1, b1)
  return Math.max(0, end - start)
}

/**
 * Daylight minutes spent in a city given presence window and that city's sun.
 * Presence and sun are local clock times (itinerary convention).
 */
export function daylightMinutesPresent(
  sunriseHhmm: string,
  sunsetHhmm: string,
  presentFromHhmm: string,
  presentToHhmm: string,
): number {
  const sun0 = minutesFromHhmm(sunriseHhmm)
  const sun1 = minutesFromHhmm(sunsetHhmm)
  let p0 = minutesFromHhmm(presentFromHhmm)
  let p1 = minutesFromHhmm(presentToHhmm)
  if (p1 <= p0) p1 += 24 * 60 // overnight presence (rare for city split)
  // Cap presence to same calendar day for daylight calc
  p0 = Math.max(0, Math.min(p0, 24 * 60))
  p1 = Math.max(0, Math.min(p1, 24 * 60))
  if (sun1 <= sun0) return overlapMinutes(p0, p1, sun0, sun1 + 24 * 60)
  return overlapMinutes(p0, p1, sun0, sun1)
}

export async function geocodeCity(city: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const name = queryCityName(city)
  if (!name) return null
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
    url.searchParams.set("name", name)
    url.searchParams.set("count", "5")
    url.searchParams.set("language", "en")
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = (await res.json()) as {
      results?: {
        latitude: number
        longitude: number
        name: string
        country?: string
        admin1?: string
        population?: number
      }[]
    }
    let results = data.results || []
    if (!results.length) return null
    const hint = city.includes(",")
      ? city
          .slice(city.indexOf(",") + 1)
          .trim()
          .toLowerCase()
      : ""
    if (hint) {
      results = [...results].sort((a, b) => {
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
    } else {
      results = [...results].sort((a, b) => (b.population || 0) - (a.population || 0))
    }
    const hit = results[0]!
    return { lat: hit.latitude, lng: hit.longitude, name: hit.name }
  } catch {
    return null
  }
}

type DailyWx = {
  time?: string[]
  weathercode?: number[]
  weather_code?: number[]
  temperature_2m_max?: number[]
  temperature_2m_min?: number[]
  sunrise?: string[]
  sunset?: string[]
}

function climateFromDaily(daily: DailyWx | undefined, date: string, cityName: string, typical = false): DayClimate | null {
  if (!daily?.time?.length) return null
  const idx = daily.time.indexOf(date)
  if (idx < 0) return null
  const code = daily.weathercode?.[idx] ?? daily.weather_code?.[idx]
  const max = daily.temperature_2m_max?.[idx]
  const min = daily.temperature_2m_min?.[idx]
  const sunUp = formatSunClock(daily.sunrise?.[idx])
  const sunDown = formatSunClock(daily.sunset?.[idx])
  if (code == null && max == null && min == null && !sunUp) return null
  return {
    weather: weatherLabel(code, min, max, typical),
    sunrise: sunUp?.display || "",
    sunset: sunDown?.display || "",
    sunriseHhmm: sunUp?.hhmm || "06:00",
    sunsetHhmm: sunDown?.hhmm || "18:00",
    cityName,
    typical,
  }
}

async function fetchDailyClimate(
  base: string,
  lat: number,
  lng: number,
  date: string,
  cityName: string,
  typical = false,
): Promise<DayClimate | null> {
  const url = new URL(base)
  url.searchParams.set("latitude", String(lat))
  url.searchParams.set("longitude", String(lng))
  url.searchParams.set(
    "daily",
    "weathercode,weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
  )
  url.searchParams.set("temperature_unit", "fahrenheit")
  url.searchParams.set("timezone", "auto")
  url.searchParams.set("start_date", date)
  url.searchParams.set("end_date", date)
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const data = (await res.json()) as { daily?: DailyWx; error?: boolean }
  if (data.error) return null
  return climateFromDaily(data.daily, date, cityName, typical)
}

function shiftYear(date: string, years: number): string | null {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1]) - years
  const md = `${m[2]}-${m[3]}`
  if (md === "02-29") {
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
    return `${y}-${leap ? "02-29" : "02-28"}`
  }
  return `${y}-${md}`
}

/** Full day climate (weather + sun) for a city + date. */
export async function fetchDayClimate(city: string, date: string): Promise<DayClimate | null> {
  if (!city.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const geo = await geocodeCity(city)
  if (!geo) return null

  try {
    const forecast = await fetchDailyClimate(
      "https://api.open-meteo.com/v1/forecast",
      geo.lat,
      geo.lng,
      date,
      geo.name,
    )
    if (forecast) return forecast

    const archive = await fetchDailyClimate(
      "https://archive-api.open-meteo.com/v1/archive",
      geo.lat,
      geo.lng,
      date,
      geo.name,
    )
    if (archive) return archive

    for (const yearsBack of [1, 2, 3]) {
      const past = shiftYear(date, yearsBack)
      if (!past) continue
      const typical = await fetchDailyClimate(
        "https://archive-api.open-meteo.com/v1/archive",
        geo.lat,
        geo.lng,
        past,
        geo.name,
        true,
      )
      if (typical) {
        // Sun times from prior year are still useful as approximate for the calendar day
        return typical
      }
    }
    return null
  } catch {
    return null
  }
}

/** @deprecated prefer fetchDayClimate — kept for existing callers/tests */
export async function fetchWeatherForCityDate(city: string, date: string): Promise<string | null> {
  const c = await fetchDayClimate(city, date)
  return c?.weather ?? null
}

export async function fetchWeatherForResolvedCity(
  city: string,
  date: string,
): Promise<{ label: string | null; resolvedCity: string }> {
  const resolvedCity = (await resolveCityLabel(city)) || city.trim()
  const label = await fetchWeatherForCityDate(resolvedCity, date)
  return { label, resolvedCity }
}

/**
 * Infer when the traveler leaves the origin / arrives at the destination
 * on a travel day (from flights, land notes, arrive notes).
 */
export function inferTravelPresenceWindows(day: ClimateDayInput): {
  leaveOriginHhmm: string
  arriveDestHhmm: string
} {
  const schedule = day.schedule || []
  const departs: string[] = []
  const arrives: string[] = []

  for (const e of schedule) {
    if (e.kind === "flight" && e.flight) {
      const segs = e.flight.segments?.length ? e.flight.segments : null
      if (segs) {
        for (const seg of segs) {
          if (seg.departTime) departs.push(seg.departTime)
          if (seg.arriveTime) arrives.push(seg.arriveTime)
        }
      } else if (e.time) {
        departs.push(e.time)
      }
      const arrM = String(e.flight.arrivalTime || "").match(/T?(\d{2}):(\d{2})/)
      if (arrM) arrives.push(`${arrM[1]}:${arrM[2]}`)
    }
    if (e.kind === "plan" || e.kind === "note") {
      if (/^land in|^arrive /i.test(e.text || "") && e.time) arrives.push(e.time)
    }
  }

  departs.sort()
  arrives.sort()
  // Default: leave mid-morning, arrive late afternoon (typical long-haul)
  const leaveOriginHhmm = departs[0] || "10:00"
  let arriveDestHhmm = arrives[arrives.length - 1] || departs[departs.length - 1] || "16:00"

  // Overnight arrival (arrive clock < leave clock): destination presence is next day —
  // only count same-calendar-day arrivals for this day's daylight split.
  if (minutesFromHhmm(arriveDestHhmm) < minutesFromHhmm(leaveOriginHhmm)) {
    const sameDay = arrives.filter((a) => minutesFromHhmm(a) >= minutesFromHhmm(leaveOriginHhmm))
    arriveDestHhmm = sameDay.length ? sameDay[sameDay.length - 1]! : "23:59"
  }

  return { leaveOriginHhmm, arriveDestHhmm }
}

/**
 * Pick the city where the traveler spends the majority of daylight hours
 * (overlap of presence with sunrise–sunset). Tie → destination.
 */
export async function pickMajorityDaylightCity(
  fromCity: string,
  toCity: string,
  date: string,
  leaveOriginHhmm: string,
  arriveDestHhmm: string,
): Promise<{ city: string; fromDaylightMin: number; toDaylightMin: number }> {
  const [fromClim, toClim] = await Promise.all([
    fetchDayClimate(fromCity, date),
    fetchDayClimate(toCity, date),
  ])

  const fromMin = fromClim
    ? daylightMinutesPresent(fromClim.sunriseHhmm, fromClim.sunsetHhmm, "00:00", leaveOriginHhmm)
    : 0
  const toMin = toClim
    ? daylightMinutesPresent(toClim.sunriseHhmm, toClim.sunsetHhmm, arriveDestHhmm, "23:59")
    : 0

  if (toMin > fromMin) return { city: toCity, fromDaylightMin: fromMin, toDaylightMin: toMin }
  if (fromMin > toMin) return { city: fromCity, fromDaylightMin: fromMin, toDaylightMin: toMin }
  // Tie or missing sun → prefer destination
  return { city: toCity || fromCity, fromDaylightMin: fromMin, toDaylightMin: toMin }
}

/** City used for weather / sunrise / sunset on a day. */
export async function resolveClimateCity(day: ClimateDayInput): Promise<string> {
  if (day.cityMode !== "travel") {
    return (day.city || "").trim()
  }
  const from = (day.fromCity || "").trim()
  const to = (day.toCity || "").trim()
  if (from && to) {
    const { leaveOriginHhmm, arriveDestHhmm } = inferTravelPresenceWindows(day)
    const pick = await pickMajorityDaylightCity(from, to, day.date, leaveOriginHhmm, arriveDestHhmm)
    return pick.city
  }
  return to || from || (day.city || "").trim()
}

export function weatherCityQuery(day: ClimateDayInput): string {
  if (day.climateCity) return day.climateCity
  if (day.cityMode === "travel") {
    return (day.toCity || day.fromCity || day.city || "").trim()
  }
  return (day.city || "").trim()
}

/** Fetch climate for the correct city (majority daylight on travel days). */
export async function fetchClimateForItineraryDay(
  day: ClimateDayInput,
): Promise<(DayClimate & { climateCity: string }) | null> {
  const city = await resolveClimateCity(day)
  if (!city) return null
  const climate = await fetchDayClimate(city, day.date)
  if (!climate) return null
  return { ...climate, climateCity: city }
}
