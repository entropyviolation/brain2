/**
 * lib/trip-itinerary.ts — Self-contained trip itinerary (not list-backed)
 *
 * Days are generated from start/end dates and stored on the module config.
 * Schedule rows (plans, notes, flights) live on each day — not as Tasks/lists.
 */
import { formatItineraryDateLabel, flightDurationLabel } from "@/lib/itinerary-assemble"
import { dayPlanKey, getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { airportFromCity, buildFlightDetail, buildFlightTitle, formatClock } from "@/lib/flight-lookup"

export type TripCityMode = "city" | "travel"

export type TripScheduleKind = "plan" | "note" | "flight"

export interface TripFlightSegment {
  flightNumber?: string
  airline?: string
  from?: string
  to?: string
  departDisplay?: string
  arriveDisplay?: string
  departTime?: string
  arriveTime?: string
}

export interface TripFlightInfo {
  flightNumber: string
  airline?: string
  fromAirport?: string
  toAirport?: string
  fromCity?: string
  toCity?: string
  /** ISO or local datetime string */
  departureTime?: string
  arrivalTime?: string
  durationLabel?: string
  confirmation?: string
  stopsLabel?: string
  layoverLabel?: string
  segments?: TripFlightSegment[]
  /** Original pasted text — editable / re-parseable */
  rawText?: string
  /** Formatted title for display */
  title?: string
  detail?: string
}

export interface TripScheduleEntry {
  id: string
  kind: TripScheduleKind
  /** HH:mm (24h) — set on plans/flights; omitted for freeform notes */
  time?: string
  /** Plan text, note text, or flight summary line */
  text: string
  flight?: TripFlightInfo
}

export interface TripItineraryDay {
  date: string
  cityMode: TripCityMode
  /** Single-city label, e.g. "Lima, Peru" */
  city: string
  /** Travel day: San Diego */
  fromCity?: string
  /** Travel day: Lima, Peru */
  toCity?: string
  /** Freeform day note shown in meta / schedule */
  dayNote?: string
  sleepName?: string
  sleepAddress?: string
  schedule: TripScheduleEntry[]
  /** Cached weather label from API */
  weather?: string
  weatherFetchedAt?: string
  /** City used for weather / sunrise / sunset (majority daylight on travel days) */
  climateCity?: string
  /** Display e.g. "6:29 AM" */
  sunrise?: string
  /** Display e.g. "5:59 PM" */
  sunset?: string
}

export interface TripItineraryData {
  startDate: string
  endDate: string
  days: TripItineraryDay[]
  /**
   * Optional city applied to every day (operations / single-base plans).
   * When set via “Apply to all days”, each day’s city fields are filled.
   */
  globalCity?: string
  /**
   * Whether sleep / stay rows are shown and synced to the Activities map.
   * Default true when omitted.
   */
  showSleep?: boolean
  /**
   * Accent color for dates, notes, and related highlights (CSS hex).
   * Default crimson `#8b1a1a`.
   */
  accentColor?: string
}

/** Default itinerary accent (dates, notes, highlights). */
export const DEFAULT_ITINERARY_ACCENT = "#8b1a1a"

/** Sleep rows are on by default (trip itineraries). */
export function itineraryShowsSleep(data: TripItineraryData | undefined | null): boolean {
  return data?.showSleep !== false
}

/** Resolved accent color for the printable itinerary document. */
export function itineraryAccentColor(data: TripItineraryData | undefined | null): string {
  const c = data?.accentColor?.trim()
  if (c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) {
    if (c.length === 4) {
      const [, a, b, d] = c
      return `#${a}${a}${b}${b}${d}${d}`.toLowerCase()
    }
    return c.toLowerCase()
  }
  return DEFAULT_ITINERARY_ACCENT
}

/** Apply a single city to every day (city mode, clears A→B travel fields). */
export function applyGlobalCity(
  data: TripItineraryData,
  city: string,
): TripItineraryData {
  const c = city.trim()
  return {
    ...data,
    globalCity: c || undefined,
    days: data.days.map((d) => ({
      ...d,
      cityMode: "city" as const,
      city: c,
      fromCity: undefined,
      toCity: undefined,
      climateCity: undefined,
      weather: undefined,
      sunrise: undefined,
      sunset: undefined,
      weatherFetchedAt: undefined,
    })),
  }
}

export function genTripId(prefix = "itin"): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** Inclusive list of YYYY-MM-DD from start through end. */
export function dateRangeInclusive(startDate: string, endDate: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return []
  if (startDate > endDate) return []
  const out: string[] = []
  const cur = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  while (cur <= end) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, "0")
    const d = String(cur.getDate()).padStart(2, "0")
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export function cityLabel(day: TripItineraryDay): string {
  if (day.cityMode === "travel") {
    const from = (day.fromCity || "").trim()
    const to = (day.toCity || "").trim()
    if (from && to) return `${from} → ${to}`
    return from || to || day.city || ""
  }
  return (day.city || "").trim()
}

/** @deprecated use weatherCityQuery from weather-client (supports climateCity + majority daylight) */
export function weatherCityQuery(day: TripItineraryDay): string {
  if (day.climateCity) return day.climateCity
  if (day.cityMode === "travel") {
    return (day.toCity || day.fromCity || day.city || "").trim()
  }
  return (day.city || "").trim()
}

/**
 * Rebuild day list for a new date range, preserving schedule/city data for
 * dates that still exist.
 */
export function rebuildDaysForRange(
  startDate: string,
  endDate: string,
  previous: TripItineraryDay[] = [],
  opts?: { globalCity?: string },
): TripItineraryDay[] {
  const prev = new Map(previous.map((d) => [d.date, d]))
  const fallbackCity = (opts?.globalCity || "").trim()
  return dateRangeInclusive(startDate, endDate).map((date) => {
    const existing = prev.get(date)
    if (existing) return { ...existing, date }
    return {
      date,
      cityMode: "city" as const,
      city: fallbackCity,
      schedule: [],
    }
  })
}

export function emptyTripItinerary(
  startDate: string,
  endDate: string,
  opts?: { globalCity?: string; showSleep?: boolean },
): TripItineraryData {
  return {
    startDate,
    endDate,
    globalCity: opts?.globalCity?.trim() || undefined,
    showSleep: opts?.showSleep,
    days: rebuildDaysForRange(startDate, endDate, [], { globalCity: opts?.globalCity }),
  }
}

export function formatScheduleTime(time?: string): string {
  if (!time) return ""
  const m = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return time
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${ampm}`
}

/** Short airport/city code for compact leg lines (TIJ, MEL, or city name). */
export function shortPlaceCode(place?: string, fallbackAirport?: string): string {
  if (fallbackAirport && /^[A-Za-z]{3}$/.test(fallbackAirport.trim())) {
    return fallbackAirport.trim().toUpperCase()
  }
  const raw = (place || "").trim()
  if (!raw) return ""
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase()
  const paren = raw.match(/\(([A-Za-z]{3,4})\)/)
  if (paren) return paren[1]!.toUpperCase()
  const fromMap = airportFromCity(raw)
  if (fromMap) return fromMap
  return raw.split(",")[0]!.trim()
}

/**
 * Compact leg line: "Jetstar JQ945 CNS-MEL 3h20m"
 */
export function formatFlightLegLine(opts: {
  airline?: string
  flightNumber?: string
  from?: string
  to?: string
  fromAirport?: string
  toAirport?: string
  departTime?: string
  arriveTime?: string
  durationLabel?: string
  confirmation?: string
}): string {
  const airline = (opts.airline || "").replace(/\s+/g, " ").trim()
  // Prefer short carrier name (first word) when long
  const carrier =
    airline && airline.length > 18 ? airline.split(/\s+/)[0]! : airline
  const num = (opts.flightNumber || "").replace(/\s+/g, "").toUpperCase()
  const from = shortPlaceCode(opts.from, opts.fromAirport)
  const to = shortPlaceCode(opts.to, opts.toAirport)
  const route = from && to ? `${from}-${to}` : from || to || ""
  let dur = (opts.durationLabel || "").replace(/\s*flight$/i, "").replace(/\s+/g, "")
  if (!dur && opts.departTime && opts.arriveTime) {
    // Build fake ISO on same day for duration helper
    const label = flightDurationLabel(
      `2000-01-01T${opts.departTime}:00`,
      opts.arriveTime < opts.departTime
        ? `2000-01-02T${opts.arriveTime}:00`
        : `2000-01-01T${opts.arriveTime}:00`,
    )
    dur = (label || "").replace(/\s*flight$/i, "").replace(/\s+/g, "")
  }
  const head = [carrier, num].filter(Boolean).join(" ")
  return [head, route, dur].filter(Boolean).join(" ")
}

/** "Arrive in Melbourne, ~2 hr layover · Conf OBGTNV" */
export function formatLayoverLine(opts: {
  place?: string
  durationLabel?: string
  confirmation?: string
}): string {
  const place = (opts.place || "connection").replace(/\s*\([^)]*\)\s*$/, "").trim()
  let dur = (opts.durationLabel || "").replace(/\s+/g, " ").trim()
  // normalize "1h 10m" → "~1h 10m"
  if (dur && !dur.startsWith("~")) dur = `~${dur}`
  const mid = dur ? `Arrive in ${place}, ${dur} layover` : `Arrive in ${place}, layover`
  return opts.confirmation ? `${mid} · Conf ${opts.confirmation}` : mid
}

export function formatFlightEntry(info: TripFlightInfo): { text: string; detail: string; time?: string } {
  // Single-leg compact title when we have enough structure
  const segs = info.segments || []
  if (segs.length <= 1) {
    const seg = segs[0]
    const compact = formatFlightLegLine({
      airline: info.airline || seg?.airline,
      flightNumber: info.flightNumber || seg?.flightNumber,
      from: seg?.from || info.fromCity,
      to: seg?.to || info.toCity,
      fromAirport: info.fromAirport,
      toAirport: info.toAirport,
      departTime: seg?.departTime,
      arriveTime: seg?.arriveTime,
      durationLabel: info.durationLabel,
    })
    const duration =
      info.durationLabel || flightDurationLabel(info.departureTime, info.arrivalTime)
    const detail = [
      seg?.departDisplay && seg?.arriveDisplay ? `${seg.departDisplay} → ${seg.arriveDisplay}` : "",
      info.confirmation ? `Conf ${info.confirmation}` : "",
      !seg && duration ? duration : "",
    ]
      .filter(Boolean)
      .join(" · ")
    const time = info.departureTime
      ? (() => {
          const m = String(info.departureTime).match(/T?(\d{2}):(\d{2})/)
          return m ? `${m[1]}:${m[2]}` : undefined
        })()
      : seg?.departTime
    return {
      text: info.title || compact || buildFlightTitle(info.airline || "", info.flightNumber || "", info.fromAirport || "", info.toAirport || "") || "Flight",
      detail: info.detail || detail,
      time,
    }
  }

  // Multi-leg stored as one entry — title is overview; UI expands chunks
  const airline = info.airline || ""
  const num = info.flightNumber || ""
  const route =
    info.fromCity && info.toCity
      ? `${info.fromCity} → ${info.toCity}`
      : info.fromAirport && info.toAirport
        ? `${info.fromAirport}–${info.toAirport}`
        : ""
  const text =
    info.title ||
    [airline && num ? `${airline} ${num}` : num || airline, route].filter(Boolean).join(" · ") ||
    "Flight"

  const duration =
    info.durationLabel || flightDurationLabel(info.departureTime, info.arrivalTime)

  let detail = info.detail || ""
  if (!detail) {
    detail = [
      duration,
      info.stopsLabel,
      info.layoverLabel,
      info.confirmation ? `Conf ${info.confirmation}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  } else if (info.confirmation && !detail.includes(info.confirmation)) {
    detail = `${detail} · Conf ${info.confirmation}`
  }

  const time = info.departureTime
    ? (() => {
        const m = String(info.departureTime).match(/T?(\d{2}):(\d{2})/)
        return m ? `${m[1]}:${m[2]}` : undefined
      })()
    : undefined
  return { text, detail, time }
}

/**
 * Expand a multi-segment flight into timeline chunks:
 * depart leg → arrive/layover → depart leg → …
 */
export function expandFlightScheduleChunks(entry: TripScheduleEntry): Array<{
  key: string
  time?: string
  kind: "flight-leg" | "layover"
  text: string
  detail?: string
}> {
  const segs = entry.flight?.segments || []
  if (segs.length < 2) return []
  const conf = entry.flight?.confirmation
  const out: Array<{
    key: string
    time?: string
    kind: "flight-leg" | "layover"
    text: string
    detail?: string
  }> = []

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!
    const dur = flightDurationLabel(
      seg.departTime ? `2000-01-01T${seg.departTime}:00` : undefined,
      seg.arriveTime
        ? `${seg.departTime && seg.arriveTime < seg.departTime ? "2000-01-02" : "2000-01-01"}T${seg.arriveTime}:00`
        : undefined,
    )
    out.push({
      key: `${entry.id}-leg-${i}`,
      time: seg.departTime,
      kind: "flight-leg",
      text: formatFlightLegLine({
        airline: seg.airline || entry.flight?.airline,
        flightNumber: seg.flightNumber,
        from: seg.from,
        to: seg.to,
        departTime: seg.departTime,
        arriveTime: seg.arriveTime,
        durationLabel: dur,
      }),
      detail:
        seg.departDisplay && seg.arriveDisplay
          ? `${seg.departDisplay} → ${seg.arriveDisplay}${conf && i === 0 ? ` · Conf ${conf}` : ""}`
          : conf && i === 0
            ? `Conf ${conf}`
            : undefined,
    })

    if (i < segs.length - 1) {
      const next = segs[i + 1]!
      const place = seg.to || next.from || "connection"
      // duration between arrive and next depart if both known
      let layDur = entry.flight?.layoverLabel?.replace(/layover.*/i, "").trim()
      if (!layDur && seg.arriveTime && next.departTime) {
        const label = flightDurationLabel(
          `2000-01-01T${seg.arriveTime}:00`,
          next.departTime < seg.arriveTime
            ? `2000-01-02T${next.departTime}:00`
            : `2000-01-01T${next.departTime}:00`,
        )
        layDur = (label || "").replace(/\s*flight$/i, "").trim()
      }
      out.push({
        key: `${entry.id}-lay-${i}`,
        time: seg.arriveTime,
        kind: "layover",
        text: formatLayoverLine({
          place,
          durationLabel: layDur || entry.flight?.layoverLabel,
          confirmation: conf,
        }),
      })
    }
  }
  return out
}

/** Rebuild title + detail after user edits airports / times / confirmation. */
export function refreshFlightDisplay(info: TripFlightInfo): TripFlightInfo {
  if (info.rawText || (info.segments && info.segments.length > 0)) {
    const formatted = formatFlightEntry(info)
    return {
      ...info,
      title: info.title || formatted.text,
      detail: info.detail || formatted.detail,
      durationLabel:
        info.durationLabel || flightDurationLabel(info.departureTime, info.arrivalTime) || "",
    }
  }
  const duration =
    flightDurationLabel(info.departureTime, info.arrivalTime) || info.durationLabel || ""
  const title = buildFlightTitle(
    info.airline || "",
    info.flightNumber || "",
    info.fromAirport || "",
    info.toAirport || "",
  )
  const detail = buildFlightDetail({
    durationLabel: duration,
    arrivalTime: info.arrivalTime,
    toAirport: info.toAirport || info.toCity,
    confirmation: info.confirmation,
  })
  return { ...info, durationLabel: duration, title, detail }
}

export { formatClock }

/** Unique city names from itinerary days (for Activities map chips). */
export function citiesFromTripItinerary(data: TripItineraryData | undefined | null): string[] {
  if (!data?.days?.length) return []
  const set = new Set<string>()
  for (const d of data.days) {
    if (d.cityMode === "travel") {
      const from = (d.fromCity || "").split(",")[0]?.trim()
      const to = (d.toCity || "").split(",")[0]?.trim()
      if (from) set.add(from)
      if (to) set.add(to)
    } else {
      const c = (d.city || "").split(",")[0]?.trim()
      if (c) set.add(c)
    }
  }
  return [...set]
}

/**
 * Push this day's schedule into Home → Plan day text (merge, don't wipe).
 */
export function syncDayToHomePlan(day: TripItineraryDay): void {
  if (typeof window === "undefined") return
  const label = formatItineraryDateLabel(day.date)
  const city = cityLabel(day)
  const lines: string[] = [`# Trip — ${label}${city ? ` · ${city}` : ""}`]
  if (day.dayNote?.trim()) lines.push(day.dayNote.trim())
  const sorted = [...day.schedule].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
  for (const e of sorted) {
    if (e.kind === "note") {
      lines.push(e.text)
      continue
    }
    if (e.kind === "flight" && e.flight) {
      const f = formatFlightEntry({ ...e.flight, confirmation: e.flight.confirmation })
      const t = formatScheduleTime(e.time || f.time)
      lines.push([t, f.text, f.detail].filter(Boolean).join(" — "))
      continue
    }
    const t = formatScheduleTime(e.time)
    lines.push([t, e.text].filter(Boolean).join(" "))
  }
  if (day.sleepName) {
    lines.push(`Sleep: ${day.sleepName}${day.sleepAddress ? ` · ${day.sleepAddress}` : ""}`)
  }
  const block = lines.join("\n")
  const existing = getStoredPlanText("day", day.date) || ""
  const marker = "<!-- trip-itinerary -->"
  let next: string
  if (existing.includes(marker)) {
    next = existing.replace(
      new RegExp(`${marker}[\\s\\S]*?(?=${marker}|$)`),
      `${marker}\n${block}\n`,
    )
  } else {
    next = existing.trim() ? `${existing.trim()}\n\n${marker}\n${block}\n` : `${marker}\n${block}\n`
  }
  saveStoredPlanText("day", day.date, next)
}

export { formatItineraryDateLabel, dayPlanKey }
