/**
 * lib/flight-lookup.ts — Client-side flight number → schedule (no Next API)
 *
 * Static export / Electron cannot use `/api/flight`. We normalize the flight
 * number, optionally hit Aviationstack when NEXT_PUBLIC_AVIATIONSTACK_API_KEY
 * is set (browser CORS permitting), otherwise build a clear editable estimate
 * adapted to the day's cities / departure airport.
 */
import type { ParsedFlightDetails } from "@/lib/parse-flight-text"
export type FlightLookupResult = {
  flightNumber: string
  airline: string
  fromAirport: string
  toAirport: string
  departureTime: string
  arrivalTime: string
  durationLabel: string
  title: string
  detail: string
  /** Arrival clock time HH:mm for "land in" lines */
  landTime?: string
  /** YYYY-MM-DD of arrival (may differ from departure for overnight) */
  arrivalDate?: string
  source: "aviationstack" | "estimate"
  notice?: string
}

export type FlightLookupContext = {
  /** Prefer this as departure airport (IATA). */
  fromAirport?: string
  /** Prefer this as arrival airport (IATA). */
  toAirport?: string
  /** City labels from the itinerary day to infer airports. */
  fromCity?: string
  toCity?: string
}

const AIRLINE_NAMES: Record<string, string> = {
  TP: "TAP Air Portugal",
  UA: "United Airlines",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  EK: "Emirates",
  QF: "Qantas",
  JQ: "Jetstar Airways",
  B6: "JetBlue",
  AS: "Alaska Airlines",
  WN: "Southwest Airlines",
  AC: "Air Canada",
  AM: "Aeroméxico",
  LA: "LATAM",
  IB: "Iberia",
  KL: "KLM",
  VS: "Virgin Atlantic",
  NK: "Spirit",
  F9: "Frontier",
  HA: "Hawaiian Airlines",
  SY: "Sun Country",
}

/** City / region name → primary IATA (lowercase keys). */
const CITY_AIRPORTS: Record<string, string> = {
  lisbon: "LIS",
  lisboa: "LIS",
  porto: "OPO",
  "san diego": "SAN",
  sandiego: "SAN",
  tijuana: "TIJ",
  lima: "LIM",
  cusco: "CUZ",
  cuzco: "CUZ",
  quito: "UIO",
  melbourne: "MEL",
  sydney: "SYD",
  honolulu: "HNL",
  "los angeles": "LAX",
  "new york": "JFK",
  nyc: "JFK",
  jfk: "JFK",
  "san francisco": "SFO",
  chicago: "ORD",
  miami: "MIA",
  dallas: "DFW",
  london: "LHR",
  paris: "CDG",
  frankfurt: "FRA",
  amsterdam: "AMS",
  madrid: "MAD",
  barcelona: "BCN",
  rome: "FCO",
  tokyo: "NRT",
  mexico: "MEX",
  "mexico city": "MEX",
  "ciudad de mexico": "MEX",
  "ciudad de méxico": "MEX",
  "ciudad de mexic": "MEX",
  cancun: "CUN",
  "cancún": "CUN",
  seattle: "SEA",
  boston: "BOS",
  denver: "DEN",
  atlanta: "ATL",
  toronto: "YYZ",
  vancouver: "YVR",
  auckland: "AKL",
  brisbane: "BNE",
  perth: "PER",
  sintra: "LIS",
}

/** Normalize "tp 204" / "TP-204" → "TP204" */
export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/[\s\-]/g, "").toUpperCase()
}

export function parseAirlineCode(flightNumber: string): { airlineCode: string; number: string } {
  const n = normalizeFlightNumber(flightNumber)
  const m = n.match(/^([A-Z]{2}|[A-Z]\d|\d[A-Z]|[A-Z]{3})(\d{1,4}[A-Z]?)$/i)
  if (!m) return { airlineCode: "", number: n }
  return { airlineCode: m[1]!.toUpperCase(), number: m[2]! }
}

export function airportFromCity(city?: string): string {
  if (!city) return ""
  const raw = city.trim()
  if (/^[A-Z]{3}$/i.test(raw)) return raw.toUpperCase()
  const key = raw
    .split(",")[0]!
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  if (CITY_AIRPORTS[key]) return CITY_AIRPORTS[key]!
  // fuzzy: contains key
  for (const [name, code] of Object.entries(CITY_AIRPORTS)) {
    if (key.includes(name) || name.includes(key)) return code
  }
  return ""
}

export function durationBetween(dep?: string, arr?: string): string {
  if (!dep || !arr) return ""
  const a = new Date(dep)
  const b = new Date(arr)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return ""
  const mins = Math.round((b.getTime() - a.getTime()) / 60000)
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m flight`
  if (m === 0) return `${h}h flight`
  return `${h}h ${m}m flight`
}

export function formatClock(isoOrTime?: string): string {
  if (!isoOrTime) return ""
  const m = String(isoOrTime).match(/T?(\d{1,2}):(\d{2})/)
  if (!m) return ""
  let h = Number(m[1])
  const min = m[2]
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${ampm}`
}

export function dateKeyFromIso(iso?: string): string {
  if (!iso) return ""
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ""
}

export function buildFlightTitle(airline: string, flightNumber: string, from: string, to: string): string {
  const route = from && to ? `${from}–${to}` : from || to || ""
  return [airline, flightNumber, route].filter(Boolean).join(" ")
}

/** Detail line: duration + land time in airport (+ confirmation). */
export function buildFlightDetail(opts: {
  durationLabel?: string
  arrivalTime?: string
  toAirport?: string
  confirmation?: string
}): string {
  const land = formatClock(opts.arrivalTime)
  const landPart =
    land && opts.toAirport
      ? `land ${land} in ${opts.toAirport}`
      : land
        ? `land ${land}`
        : opts.toAirport
          ? `land in ${opts.toAirport}`
          : ""
  const conf = opts.confirmation ? `Confirmation: ${opts.confirmation}` : ""
  return [opts.durationLabel, landPart, conf].filter(Boolean).join(" · ")
}

function estimateFlight(flightNumber: string, date: string, ctx: FlightLookupContext = {}): FlightLookupResult {
  const n = normalizeFlightNumber(flightNumber)
  const { airlineCode, number } = parseAirlineCode(n)
  const code = airlineCode || "XX"
  const num = number || n
  const airline = AIRLINE_NAMES[code] || (airlineCode ? `${airlineCode} Airlines` : "Airline")

  let h = 0
  const seed = `${n}|${date}|${ctx.fromAirport || ""}|${ctx.fromCity || ""}`
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const depH = 6 + (h % 12)
  const depM = (h % 4) * 15
  // Long-haul bias when airports look intercontinental
  const fromGuess =
    (ctx.fromAirport || "").toUpperCase() ||
    airportFromCity(ctx.fromCity) ||
    ["JFK", "LAX", "SFO", "ORD", "MIA", "SAN", "DFW"][h % 7]!
  const toGuess =
    (ctx.toAirport || "").toUpperCase() ||
    airportFromCity(ctx.toCity) ||
    ["LIS", "LIM", "MEL", "CDG", "LHR", "TIJ", "CUN"][(h >>> 3) % 7]!

  const longHaul = fromGuess !== toGuess
  const durH = longHaul ? 5 + (h % 9) : 1 + (h % 3)
  const dep = `${date}T${String(depH).padStart(2, "0")}:${String(depM).padStart(2, "0")}:00`
  const arrDate = new Date(dep)
  arrDate.setHours(arrDate.getHours() + durH)
  const y = arrDate.getFullYear()
  const mo = String(arrDate.getMonth() + 1).padStart(2, "0")
  const d = String(arrDate.getDate()).padStart(2, "0")
  const hh = String(arrDate.getHours()).padStart(2, "0")
  const mm = String(arrDate.getMinutes()).padStart(2, "0")
  const arr = `${y}-${mo}-${d}T${hh}:${mm}:00`
  const durationLabel = durationBetween(dep, arr)
  const title = buildFlightTitle(airline, `${code}${num}`, fromGuess, toGuess)
  const detail = buildFlightDetail({
    durationLabel,
    arrivalTime: arr,
    toAirport: toGuess,
  })

  return {
    flightNumber: `${code}${num}`,
    airline,
    fromAirport: fromGuess,
    toAirport: toGuess,
    departureTime: dep,
    arrivalTime: arr,
    durationLabel,
    title,
    detail,
    landTime: `${hh}:${mm}`,
    arrivalDate: `${y}-${mo}-${d}`,
    source: "estimate",
    notice: "Estimated schedule adapted to this day — edit airports/times to match your ticket.",
  }
}

async function aviationstackLookup(
  flightNumber: string,
  date: string,
  key: string,
  ctx: FlightLookupContext,
): Promise<FlightLookupResult | null> {
  const n = normalizeFlightNumber(flightNumber)
  const { number } = parseAirlineCode(n)
  const tryUrls = [
    (() => {
      const u = new URL("https://api.aviationstack.com/v1/flights")
      u.searchParams.set("access_key", key)
      u.searchParams.set("flight_iata", n)
      u.searchParams.set("flight_date", date)
      if (ctx.fromAirport) u.searchParams.set("dep_iata", ctx.fromAirport.toUpperCase())
      u.searchParams.set("limit", "5")
      return u.toString()
    })(),
    (() => {
      const u = new URL("https://api.aviationstack.com/v1/flights")
      u.searchParams.set("access_key", key)
      u.searchParams.set("flight_number", number)
      u.searchParams.set("flight_date", date)
      u.searchParams.set("limit", "5")
      return u.toString()
    })(),
  ]

  for (const url of tryUrls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: Array<{
          flight?: { iata?: string }
          airline?: { name?: string }
          departure?: { iata?: string; scheduled?: string }
          arrival?: { iata?: string; scheduled?: string }
        }>
      }
      let rows = data.data ?? []
      if (ctx.fromAirport) {
        const pref = rows.filter(
          (r) => (r.departure?.iata || "").toUpperCase() === ctx.fromAirport!.toUpperCase(),
        )
        if (pref.length) rows = pref
      }
      const row = rows[0]
      if (!row) continue
      const fn = row.flight?.iata || n
      const dep = row.departure?.scheduled || ""
      const arr = row.arrival?.scheduled || ""
      const fromAirport = row.departure?.iata || ctx.fromAirport || ""
      const toAirport = row.arrival?.iata || ctx.toAirport || ""
      const airline = row.airline?.name || ""
      const durationLabel = durationBetween(dep, arr)
      const title = buildFlightTitle(airline, fn, fromAirport, toAirport)
      const detail = buildFlightDetail({ durationLabel, arrivalTime: arr, toAirport })
      const landM = String(arr).match(/T?(\d{2}):(\d{2})/)
      return {
        flightNumber: fn,
        airline,
        fromAirport,
        toAirport,
        departureTime: dep,
        arrivalTime: arr,
        durationLabel,
        title,
        detail,
        landTime: landM ? `${landM[1]}:${landM[2]}` : undefined,
        arrivalDate: dateKeyFromIso(arr),
        source: "aviationstack",
      }
    } catch {
      /* CORS or network */
    }
  }
  return null
}

/** Look up a flight for a given date; always returns a usable structured result. */
export async function lookupFlight(
  flightNumber: string,
  date: string,
  ctx: FlightLookupContext = {},
): Promise<FlightLookupResult> {
  const n = normalizeFlightNumber(flightNumber)
  if (!n) {
    return {
      ...estimateFlight("XX0", date, ctx),
      flightNumber: "",
      title: "",
      notice: "Enter a flight number like TP204 or UA961.",
      source: "estimate",
    }
  }

  const live = await lookupFlightLive(n, date, ctx)
  if (live) return live

  return estimateFlight(n, date, ctx)
}

function flightApiKey(): string {
  if (typeof process === "undefined") return ""
  return process.env.NEXT_PUBLIC_AVIATIONSTACK_API_KEY || process.env.NEXT_PUBLIC_FLIGHT_API_KEY || ""
}

/** Live Aviationstack lookup only (no invented estimate). Returns null if no key / miss. */
export async function lookupFlightLive(
  flightNumber: string,
  date: string,
  ctx: FlightLookupContext = {},
): Promise<FlightLookupResult | null> {
  const n = normalizeFlightNumber(flightNumber)
  if (!n) return null
  const key = flightApiKey()
  if (!key) return null
  return aviationstackLookup(n, date, key, ctx)
}

function clockFromIso(iso?: string): string | undefined {
  if (!iso) return undefined
  const m = String(iso).match(/T(\d{2}):(\d{2})/)
  return m ? `${m[1]}:${m[2]}` : undefined
}

function displayFromHhmm(hhmm?: string): string | undefined {
  if (!hhmm) return undefined
  const m = hhmm.match(/^(\d{2}):(\d{2})$/)
  if (!m) return hhmm
  let h = Number(m[1])
  const min = m[2]!
  const ampm = h >= 12 ? "PM" : "AM"
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${ampm}`
}

/**
 * Fill IATA / duration gaps from city map and segment clocks (no network).
 */
export function fillFlightGapsFromLocal(parsed: ParsedFlightDetails): ParsedFlightDetails {
  const next = {
    ...parsed,
    segments: parsed.segments.map((s) => ({ ...s })),
    flightNumbers: [...parsed.flightNumbers],
  }

  if (!next.fromAirport) {
    next.fromAirport =
      airportFromCity(next.fromCity) ||
      airportFromCity(next.segments[0]?.from) ||
      undefined
  }
  if (!next.toAirport) {
    const last = next.segments[next.segments.length - 1]
    next.toAirport =
      airportFromCity(next.toCity) || airportFromCity(last?.to) || undefined
  }

  if (!next.airline && next.flightNumber) {
    const { airlineCode } = parseAirlineCode(next.flightNumber)
    if (airlineCode && AIRLINE_NAMES[airlineCode]) next.airline = AIRLINE_NAMES[airlineCode]
  }

  for (const seg of next.segments) {
    if (!seg.airline && next.airline) seg.airline = next.airline
    if (!seg.flightNumber && next.flightNumber) seg.flightNumber = next.flightNumber
  }

  if (!next.durationLabel && next.segments.length === 1) {
    const s0 = next.segments[0]!
    if (s0.departTime && s0.arriveTime) {
      const label = durationBetween(
        `2000-01-01T${s0.departTime}:00`,
        s0.arriveTime < s0.departTime
          ? `2000-01-02T${s0.arriveTime}:00`
          : `2000-01-01T${s0.arriveTime}:00`,
      )
      if (label) next.durationLabel = label
    }
  }

  return next
}

/**
 * Fill gaps in pasted flight details with live Aviationstack data when available.
 * Paste wins for times, confirmation, and cities already present — API only
 * adds missing airline names, IATA codes, and missing schedule times.
 */
export async function enrichParsedFlightWithApi(
  parsed: ParsedFlightDetails,
): Promise<{
  parsed: ParsedFlightDetails
  enrichedLegs: number
  source: "aviationstack" | "paste-only"
}> {
  const filled = fillFlightGapsFromLocal(parsed)
  const key = flightApiKey()
  if (!key) {
    return { parsed: filled, enrichedLegs: 0, source: "paste-only" }
  }

  const next = {
    ...filled,
    segments: filled.segments.map((s) => ({ ...s })),
    flightNumbers: [...filled.flightNumbers],
  }
  let enrichedLegs = 0

  for (let i = 0; i < next.segments.length; i++) {
    const seg = next.segments[i]!
    const fn = seg.flightNumber || next.flightNumbers[i] || next.flightNumber
    if (!fn) continue
    const date = seg.departDate || next.departureDate
    if (!date) continue

    const fromHint =
      (seg.from && /^[A-Z]{3}$/i.test(seg.from) ? seg.from : undefined) ||
      next.fromAirport ||
      undefined
    const toHint =
      (seg.to && /^[A-Z]{3}$/i.test(seg.to) ? seg.to : undefined) || next.toAirport || undefined

    const live = await lookupFlightLive(fn, date, {
      fromAirport: fromHint,
      toAirport: toHint,
      fromCity: seg.from || next.fromCity,
      toCity: seg.to || next.toCity,
    })
    if (!live) continue

    enrichedLegs++
    if (!seg.airline && live.airline) seg.airline = live.airline
    if (!next.airline && live.airline) next.airline = live.airline

    // Prefer real IATA codes when paste only has city names
    if (live.fromAirport && (!seg.from || seg.from.length > 4)) {
      // keep city name in from; stash IATA on parsed airports
      if (!next.fromAirport && i === 0) next.fromAirport = live.fromAirport
    } else if (live.fromAirport && !next.fromAirport && i === 0) {
      next.fromAirport = live.fromAirport
    }
    if (live.toAirport) {
      if (i === next.segments.length - 1 && !next.toAirport) next.toAirport = live.toAirport
    }

    // Only fill missing times from API (boarding pass times win)
    if (!seg.departTime) {
      const t = clockFromIso(live.departureTime)
      if (t) {
        seg.departTime = t
        seg.departDisplay = displayFromHhmm(t)
      }
    }
    if (!seg.arriveTime) {
      const t = clockFromIso(live.arrivalTime)
      if (t) {
        seg.arriveTime = t
        seg.arriveDisplay = displayFromHhmm(t)
      }
    }
    if (!seg.flightNumber && live.flightNumber) {
      seg.flightNumber = live.flightNumber
      if (!next.flightNumbers.includes(live.flightNumber)) next.flightNumbers.push(live.flightNumber)
    }
    if (!next.durationLabel && live.durationLabel && next.segments.length === 1) {
      next.durationLabel = live.durationLabel
    }
  }

  // Single flight number, no segments yet — try one lookup to build a segment
  if (!next.segments.length && (next.flightNumber || next.flightNumbers[0])) {
    const fn = next.flightNumber || next.flightNumbers[0]!
    const date = next.departureDate
    if (date) {
      const live = await lookupFlightLive(fn, date, {
        fromAirport: next.fromAirport,
        toAirport: next.toAirport,
        fromCity: next.fromCity,
        toCity: next.toCity,
      })
      if (live) {
        enrichedLegs++
        const dep = clockFromIso(live.departureTime)
        const arr = clockFromIso(live.arrivalTime)
        next.segments.push({
          flightNumber: live.flightNumber || fn,
          airline: live.airline || next.airline,
          from: next.fromCity || live.fromAirport,
          to: next.toCity || live.toAirport,
          departTime: dep,
          arriveTime: arr,
          departDisplay: displayFromHhmm(dep),
          arriveDisplay: displayFromHhmm(arr),
          departDate: date,
          arriveDate: live.arrivalDate || date,
        })
        if (!next.airline && live.airline) next.airline = live.airline
        if (!next.fromAirport && live.fromAirport) next.fromAirport = live.fromAirport
        if (!next.toAirport && live.toAirport) next.toAirport = live.toAirport
        if (!next.durationLabel && live.durationLabel) next.durationLabel = live.durationLabel
        if (!next.time && dep) next.time = dep
      }
    }
  }

  // Refresh detail line if we filled gaps
  if (enrichedLegs > 0) {
    const land = next.segments[next.segments.length - 1]?.arriveDisplay
    const landPlace = next.toCity || next.segments[next.segments.length - 1]?.to
    next.detail = [
      next.durationLabel ? next.durationLabel.replace(/ flight$/, "") + " total" : "",
      next.stopsLabel || "",
      next.layoverLabel || "",
      next.confirmation ? `Conf ${next.confirmation}` : "",
      land && landPlace ? `land ${land} in ${landPlace}` : land ? `land ${land}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }

  return {
    parsed: next,
    enrichedLegs,
    source: enrichedLegs > 0 ? "aviationstack" : "paste-only",
  }
}
