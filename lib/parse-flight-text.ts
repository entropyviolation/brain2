/**
 * lib/parse-flight-text.ts — Parse unstructured flight details pasted from
 * airline apps/sites (Volaris boarding passes, Google Flights, Kayak, etc.).
 */

export interface ParsedFlightSegment {
  flightNumber?: string
  airline?: string
  from?: string
  to?: string
  /** Display time e.g. "4:27 PM" */
  departDisplay?: string
  arriveDisplay?: string
  /** HH:mm 24h when parseable */
  departTime?: string
  arriveTime?: string
  /** YYYY-MM-DD when known from paste */
  departDate?: string
  arriveDate?: string
}

export interface ParsedLayover {
  label: string
  durationLabel?: string
  place?: string
  /** Suggested start time HH:mm (arrival of previous segment) */
  time?: string
}

export interface ParsedFlightDetails {
  fromCity?: string
  toCity?: string
  fromAirport?: string
  toAirport?: string
  durationLabel?: string
  stopsLabel?: string
  layoverLabel?: string
  layovers: ParsedLayover[]
  airline?: string
  flightNumber?: string
  /** All flight numbers found, e.g. ["Y4183", "Y43918"] */
  flightNumbers: string[]
  segments: ParsedFlightSegment[]
  /** PNR / reservation / confirmation code */
  confirmation?: string
  /** First departure date YYYY-MM-DD if parsed */
  departureDate?: string
  /** Human summary line */
  title: string
  /** Detail line: duration · stops · land time */
  detail: string
  /** First depart HH:mm if known */
  time?: string
  /** Raw paste preserved for re-edit */
  rawText: string
}

function to24h(h12: number, min: string, ampm: string): string {
  let h = h12 % 12
  if (/pm/i.test(ampm)) h += 12
  return `${String(h).padStart(2, "0")}:${min}`
}

/** Collapse NBSP / narrow NBSP / bullets so clock + date regexes match email pastes. */
export function normalizeFlightPaste(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[\u00a0\u202f\u2007\u2009\u200a\u2008]/g, " ")
    .replace(/[•·∙]/g, "•")
    .trim()
}

/** Parse "04:27 PM", "4:27pm", "16:27", "4:27" */
export function parseClockToken(raw: string): { display: string; hhmm: string } | null {
  const s = normalizeFlightPaste(raw).replace(/\s+/g, " ")
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\.?$/)
  if (m12) {
    const h = Number(m12[1])
    const min = m12[2]!
    const ampm = m12[3]!
    const hhmm = to24h(h, min, ampm)
    const h12 = h % 12 || 12
    return { display: `${h12}:${min} ${ampm.toUpperCase()}`, hhmm }
  }
  const m24 = s.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (m24) {
    const hhmm = `${m24[1]!.padStart(2, "0")}:${m24[2]}`
    let h = Number(m24[1])
    const min = m24[2]!
    const ampm = h >= 12 ? "PM" : "AM"
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    return { display: `${h}:${min} ${ampm}`, hhmm }
  }
  return null
}

/** Extract all clock tokens from a string (may have tabs / multiple times). */
export function extractClocks(raw: string): { display: string; hhmm: string }[] {
  const out: { display: string; hhmm: string }[] = []
  const s = normalizeFlightPaste(raw)
  const re = /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const token = m[3] ? `${m[1]}:${m[2]} ${m[3]}` : `${m[1]}:${m[2]}`
    const parsed = parseClockToken(token)
    if (parsed) out.push(parsed)
  }
  return out
}

function cleanPlace(s: string): string {
  return s
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\(([^)]+)\)\s*/g, (_, code) => (code ? ` (${String(code).trim()})` : ""))
    .trim()
}

function normalizeFlightNum(raw: string): string {
  return raw.replace(/[\s-]+/g, "").toUpperCase()
}

function formatDuration(h: number, m: number): string {
  if (h <= 0 && m <= 0) return ""
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
}

/** Prefer current year; if the month/day is >~2 months in the past, use next year. */
export function inferFlightYear(month: number, day: number, now = new Date()): number {
  const y = now.getFullYear()
  const candidate = new Date(y, month - 1, day, 12, 0, 0, 0)
  const floor = new Date(now)
  floor.setMonth(floor.getMonth() - 2)
  if (candidate < floor) return y + 1
  return y
}

/** "Mon , 27Jul2026" / "Jul 29, 2026" / "Wed, Jul 29" / "2026-07-27" → YYYY-MM-DD */
export function parseFlightDate(raw: string, now = new Date()): string | null {
  const s = normalizeFlightPaste(raw)
  const iso = s.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const compact = s.match(/\b(\d{1,2})\s*([A-Za-z]{3,9})\s*(20\d{2})\b/)
  if (compact) {
    const mm = MONTHS[compact[2]!.toLowerCase()]
    if (mm) return `${compact[3]}-${mm}-${compact[1]!.padStart(2, "0")}`
  }

  // "Jul 29, 2026" / "July 29 2026"
  const mdY = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s*(20\d{2})\b/)
  if (mdY) {
    const mm = MONTHS[mdY[1]!.toLowerCase()]
    if (mm) return `${mdY[3]}-${mm}-${mdY[2]!.padStart(2, "0")}`
  }

  // "Mon, 27 Jul 2026" / "Wed, Jul 29, 2026"
  const dayFirst = s.match(
    /\b(?:[A-Za-z]{3,9}\s*,?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\s*(20\d{2})\b/,
  )
  if (dayFirst) {
    const mm = MONTHS[dayFirst[2]!.toLowerCase()]
    if (mm) return `${dayFirst[3]}-${mm}-${dayFirst[1]!.padStart(2, "0")}`
  }
  const weekdayMdY = s.match(
    /\b[A-Za-z]{3,9}\s*,?\s+([A-Za-z]{3,9})\s+(\d{1,2})(?:,)?\s*(20\d{2})\b/,
  )
  if (weekdayMdY) {
    const mm = MONTHS[weekdayMdY[1]!.toLowerCase()]
    if (mm) return `${weekdayMdY[3]}-${mm}-${weekdayMdY[2]!.padStart(2, "0")}`
  }

  // "Wed, Jul 29" / "Jul 29" (no year)
  const noYear =
    s.match(/\b(?:[A-Za-z]{3,9}\s*,?\s+)?([A-Za-z]{3,9})\s+(\d{1,2})\b/) ||
    s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\b/)
  if (noYear) {
    const a = noYear[1]!
    const b = noYear[2]!
    const monthToken = /[A-Za-z]/.test(a) ? a : b
    const dayToken = /[A-Za-z]/.test(a) ? b : a
    const mm = MONTHS[monthToken.toLowerCase()]
    const day = Number(dayToken)
    if (mm && day >= 1 && day <= 31) {
      const year = inferFlightYear(Number(mm), day, now)
      return `${year}-${mm}-${String(day).padStart(2, "0")}`
    }
  }

  return null
}

/** Split "Tijuana		Mexico City" / "Tijuana → Lima, Peru" into from/to. */
function splitRoutePair(line: string): { from: string; to: string } | null {
  const cleaned = line.replace(/\t+/g, "\t").trim()
  if (
    /^(flight|operated|layover|wait|departure|arrival|check|this is not|volaris reservation|stops?|total)/i.test(
      cleaned,
    )
  ) {
    return null
  }
  if (/check-?in|boarding|reservation|through the/i.test(cleaned)) return null

  // Tab-separated cities (Volaris boarding pass) — highest confidence
  if (cleaned.includes("\t")) {
    const parts = cleaned
      .split("\t")
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 2 && parts[0]!.length < 60 && parts[1]!.length < 60) {
      return { from: cleanPlace(parts[0]!), to: cleanPlace(parts[1]!) }
    }
  }

  // "City to City" / arrow with spaces (not Check-in)
  const m =
    cleaned.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40}?)\s+to\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40})$/i) ||
    cleaned.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40}?)\s+[→–—]\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40})$/) ||
    cleaned.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40}?)\s{2,}([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .',-]{1,40})$/)
  if (!m) return null
  const a = cleanPlace(m[1]!)
  const b = cleanPlace(m[2]!)
  if (!a || !b || a.length > 50 || b.length > 50) return null
  if (/^\d/.test(a) || /duration|stop|flight|operated|layover|wait|total|boarding/i.test(cleaned)) return null
  if (/^\d+\s*stops?$/i.test(a) || /^stops?$/i.test(b)) return null
  return { from: a, to: b }
}

/**
 * "Operated by: Y4 Volaris México	183" → { airline, flightNumber }
 * "Operated by Volaris Mexico" + nearby "Flight Y4 183"
 */
export function parseOperatedByLine(line: string): { airline?: string; flightNumber?: string } | null {
  const m = line.match(/^operated\s+by\s*:?\s*(.+)$/i)
  if (!m) return null
  const rest = m[1]!.trim()
  // Y4 Volaris México	183  OR  Y4 Volaris México 183
  const withNum = rest.match(
    /^([A-Z0-9]{1,3})\s+(.+?)[\t ]+(\d{1,5})\s*$/i,
  )
  if (withNum) {
    const code = withNum[1]!.toUpperCase()
    const name = withNum[2]!.replace(/\t+/g, " ").trim()
    const num = withNum[3]!
    return {
      airline: name || code,
      flightNumber: normalizeFlightNum(`${code}${num}`),
    }
  }
  // Just airline name
  return { airline: rest.replace(/\t+/g, " ").trim() }
}

function extractConfirmation(text: string, lines: string[]): string | undefined {
  const labeled = text.match(
    /(?:reservation\s+code|confirmation(?:\s+(?:code|number|#))?|record\s*locator|booking\s+ref(?:erence)?|PNR)\s*:?\s*([A-Z0-9]{5,8})\b/i,
  )
  if (labeled) return labeled[1]!.toUpperCase()

  // Standalone PNR on its own line after a reservation header
  for (let i = 0; i < lines.length; i++) {
    if (/reservation\s+code|confirmation|record\s*locator|booking\s+ref|PNR/i.test(lines[i]!)) {
      // Same line: "Confirmation GWRYAK"
      const same = lines[i]!.match(
        /(?:reservation\s+code|confirmation(?:\s+(?:code|number|#))?|record\s*locator|booking\s+ref(?:erence)?|PNR)\s*:?\s*([A-Z0-9]{5,8})\b/i,
      )
      if (same) return same[1]!.toUpperCase()
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const cand = lines[j]!.replace(/\s+/g, "")
        if (/^[A-Z0-9]{5,8}$/i.test(cand) && !/^(DEPARTURE|ARRIVAL|FLIGHT|STOPS)$/i.test(cand)) {
          return cand.toUpperCase()
        }
      }
    }
  }
  return undefined
}

function extractIataCodes(lines: string[]): string[] {
  const codes: string[] = []
  for (const line of lines) {
    const t = line.trim()
    let code: string | undefined
    if (/^[A-Z]{3}$/.test(t)) code = t
    else {
      const paren = t.match(/^\(([A-Z]{3})\)$/i) || t.match(/\(([A-Z]{3})\)\s*$/i)
      if (paren) code = paren[1]!.toUpperCase()
    }
    if (code && !codes.includes(code)) codes.push(code)
  }
  return codes
}

function extractIataPair(lines: string[]): { from?: string; to?: string; codes: string[] } {
  const codes = extractIataCodes(lines)
  if (codes.length >= 2) return { from: codes[0], to: codes[codes.length - 1], codes }
  if (codes.length === 1) return { from: codes[0], codes }
  return { codes }
}

/** Standalone flight numbers like LA2069 / TP 204 (not order ids like LA0452387WWPA). */
export function extractFlightNumbers(text: string): string[] {
  const out: string[] = []
  // Airline codes are letter-led (LA, Y4, TP) — exclude digit-led \d[A-Z] so "1h 10m" ≠ flight
  const re = /\b([A-Z]{2}|[A-Z]\d)\s*-?\s*(\d{2,4}[A-Z]?)\b/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const code = m[1]!.toUpperCase()
    const digits = m[2]!
    // "PM 11:05" / "AM 10:52" — clock residue, not a flight number
    if ((code === "AM" || code === "PM") && /:\d{2}/.test(text.slice(m.index, m.index + m[0].length + 3))) {
      continue
    }
    if (code === "AM" || code === "PM") {
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 3)
      if (after.startsWith(":")) continue
    }
    const num = normalizeFlightNum(`${code}${digits}`)
    if (num.length > 8) continue
    if (/^\d/.test(num)) continue
    if (/H\d+M$/i.test(num)) continue
    if (!out.includes(num)) out.push(num)
  }
  return out
}

function extractAirlineName(lines: string[]): string | undefined {
  for (const line of lines) {
    const t = line.trim()
    if (/^(operated|flight|confirmation|reservation|order|total|duration)/i.test(t)) continue
    if (/^[A-Z]{3}$/.test(t)) continue
    if (/^\d/.test(t)) continue
    const air = t.match(/^([A-Za-z][A-Za-z0-9 .&'-]{1,40}?)\s+Airlines?\s*$/i)
    if (air) return air[0]!.replace(/\s+/g, " ").trim()
    if (/^LATAM(\s+Airlines?)?$/i.test(t)) return "LATAM Airlines"
    if (/^Volaris(\s+Mexico)?$/i.test(t)) return t.replace(/\s+/g, " ").trim()
  }
  return undefined
}

function isIataLine(line: string): string | null {
  const t = line.trim()
  if (/^[A-Z]{3}$/.test(t)) return t
  const p = t.match(/^\(([A-Z]{3})\)$/i)
  return p ? p[1]!.toUpperCase() : null
}

function isDurationOnlyLine(line: string): string | null {
  const m = line
    .trim()
    .match(/^(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?$/i)
  if (!m) return null
  return formatDuration(Number(m[1]), Number(m[2] || 0))
}

/**
 * Google Flights-style sandwich:
 * LIM / 7:25 PM / 1h 25m / CUZ / 8:50 PM
 */
function tryParseIataTimeSandwich(
  lines: string[],
  departureDate?: string,
): { segment: ParsedFlightSegment; durationLabel?: string; fromAirport: string; toAirport: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const fromCode = isIataLine(lines[i]!)
    if (!fromCode) continue
    let j = i + 1
    if (j >= lines.length) continue
    const depClocks = extractClocks(lines[j]!)
    if (depClocks.length !== 1) continue
    j++
    let durationLabel: string | undefined
    if (j < lines.length) {
      const dur = isDurationOnlyLine(lines[j]!)
      if (dur) {
        durationLabel = dur
        j++
      }
    }
    if (j >= lines.length) continue
    const toCode = isIataLine(lines[j]!)
    if (!toCode) continue
    j++
    if (j >= lines.length) continue
    const arrClocks = extractClocks(lines[j]!)
    if (arrClocks.length !== 1) continue
    const dep = depClocks[0]!
    const arr = arrClocks[0]!
    const overnight = arr.hhmm < dep.hhmm
    return {
      fromAirport: fromCode,
      toAirport: toCode,
      durationLabel,
      segment: {
        from: fromCode,
        to: toCode,
        departDisplay: dep.display,
        arriveDisplay: arr.display,
        departTime: dep.hhmm,
        arriveTime: arr.hhmm,
        departDate: departureDate,
        arriveDate: overnight && departureDate ? addDays(departureDate, 1) : departureDate,
      },
    }
  }
  return null
}

/**
 * LATAM / airline email blocks:
 * Jul 29, 2026 / 7:25 PM / Lima / (LIM) / LA2069 / …
 */
function tryParseCityCodeBlocks(
  lines: string[],
): {
  segments: ParsedFlightSegment[]
  fromCity?: string
  toCity?: string
  fromAirport?: string
  toAirport?: string
  departureDate?: string
  flightNumbers: string[]
} | null {
  type Block = {
    date?: string
    time?: { display: string; hhmm: string }
    city?: string
    airport?: string
    flightNumber?: string
  }
  const blocks: Block[] = []
  let cur: Block = {}

  const flush = () => {
    if (cur.time || cur.city || cur.airport) {
      blocks.push(cur)
      cur = {}
    }
  }

  for (const line of lines) {
    const t = line.trim()
    if (
      /^(hi |hello|please|manage|order number|can’t|can't|view in|we recommend|travel itinerary|attachments|to me|based on|correct\?)/i.test(
        t,
      )
    ) {
      continue
    }
    const d = parseFlightDate(t)
    if (d && !extractClocks(t).length && t.length < 40) {
      if (cur.time || cur.city) flush()
      cur.date = d
      continue
    }
    const clocks = extractClocks(t)
    if (clocks.length === 1 && t.length < 20) {
      if (cur.time) flush()
      cur.time = clocks[0]
      continue
    }
    // Only parenthetical (LIM) — bare UIO/MEX/TIJ lists are handled elsewhere
    const paren = t.match(/^\(([A-Z]{3})\)$/i)
    if (paren) {
      cur.airport = paren[1]!.toUpperCase()
      continue
    }
    const fn = t.match(/^([A-Z]{2}|[A-Z]\d)\s*-?\s*(\d{2,4}[A-Z]?)$/i)
    if (fn) {
      cur.flightNumber = normalizeFlightNum(`${fn[1]}${fn[2]}`)
      flush()
      continue
    }
    if (
      /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]{1,40}$/.test(t) &&
      !/^(flight|operated|confirmation|reservation|latam|airlines?|departure|arrival|to me|thanks|regards)\b/i.test(
        t,
      ) &&
      t.split(/\s+/).length <= 4
    ) {
      if (cur.city && cur.time) flush()
      cur.city = cleanPlace(t)
      continue
    }
  }
  flush()

  if (blocks.length < 2) return null
  // Require at least one (IATA) code so Volaris time/city lists don't collapse to one leg
  if (!blocks.some((b) => b.airport)) return null

  // Pair as depart/arrive (and further legs when present)
  const flightNumbers: string[] = []
  const segments: ParsedFlightSegment[] = []
  for (let bi = 0; bi + 1 < blocks.length; bi += 2) {
    const dep = blocks[bi]!
    const arr = blocks[bi + 1]!
    if (!dep.time || !arr.time) continue
    const overnight = arr.time.hhmm < dep.time.hhmm
    const departureDate = dep.date || arr.date
    if (dep.flightNumber) flightNumbers.push(dep.flightNumber)
    if (arr.flightNumber && !flightNumbers.includes(arr.flightNumber)) {
      flightNumbers.push(arr.flightNumber)
    }
    segments.push({
      from: dep.city || dep.airport,
      to: arr.city || arr.airport,
      departDisplay: dep.time.display,
      arriveDisplay: arr.time.display,
      departTime: dep.time.hhmm,
      arriveTime: arr.time.hhmm,
      departDate: departureDate,
      arriveDate: overnight && departureDate ? addDays(departureDate, 1) : departureDate,
      flightNumber: dep.flightNumber || flightNumbers[segments.length],
    })
  }
  if (!segments.length) return null

  const first = blocks[0]!
  const last = blocks[blocks.length - 1]!
  return {
    segments,
    fromCity: first.city,
    toCity: last.city,
    fromAirport: first.airport,
    toAirport: last.airport,
    departureDate: first.date || segments[0]?.departDate,
    flightNumbers,
  }
}

/**
 * Parse pasted flight details into structured itinerary fields.
 * Handles Volaris boarding-pass layout, Google Flights summaries, and airline emails.
 */
export function parseFlightText(raw: string): ParsedFlightDetails {
  const text = normalizeFlightPaste(raw)
  const empty: ParsedFlightDetails = {
    flightNumbers: [],
    segments: [],
    layovers: [],
    title: "",
    detail: "",
    rawText: text,
  }
  if (!text) return empty

  // Keep tabs for Volaris city pairs; only trim ends of lines
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+$/g, "").replace(/^\s+/g, ""))
    .filter((l) => l.length > 0)

  let fromCity: string | undefined
  let toCity: string | undefined
  let durationLabel: string | undefined
  let stopsLabel: string | undefined
  let layoverLabel: string | undefined
  let airline: string | undefined
  let departureDate: string | undefined
  const flightNumbers: string[] = []
  const layovers: ParsedLayover[] = []
  const segments: ParsedFlightSegment[] = []

  const confirmation = extractConfirmation(text, lines)
  const iata = extractIataPair(lines)
  let fromAirport = iata.from
  let toAirport = iata.to
  const iataCodes = iata.codes

  airline = extractAirlineName(lines)

  // Overall route: prefer "Tijuana		Lima, Peru" / "Tijuana to Lima"
  for (const line of lines) {
    if (/^DEPARTURE|^ARRIVAL|^Flight|^Operated|^Layover|^THIS IS NOT/i.test(line)) continue
    const pair = splitRoutePair(line)
    if (pair && !fromCity) {
      fromCity = pair.from
      toCity = pair.to
      break
    }
  }

  // Duration — labeled total first; never steal layover/wait durations
  const labeledDur = text.match(
    /(?:total\s+)?(?:flight\s+)?duration[:\s]*(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i,
  )
  if (labeledDur) {
    durationLabel = formatDuration(Number(labeledDur[1]), Number(labeledDur[2] || 0))
  } else {
    for (const line of lines) {
      if (/layover|wait\s+of/i.test(line)) continue
      const only = isDurationOnlyLine(line)
      if (only) {
        durationLabel = only
        break
      }
    }
  }

  // Stops: "1 Stops" / "1 Stop, Mexico City"
  const stopMatch = text.match(/(\d+)\s*stops?\b(?:\s*[,:]?\s*([^\n]+))?/i) || text.match(/\b(non-?stop|direct)\b/i)
  if (stopMatch) {
    if (/non|direct/i.test(stopMatch[0])) {
      stopsLabel = "Nonstop"
    } else {
      const n = stopMatch[1]
      let where = (stopMatch[2] || "").replace(/\s+/g, " ").trim()
      if (/^(tij|lim|mex|[A-Z]{3})$/i.test(where) || where.length < 2) where = ""
      stopsLabel = where ? `${n} stop${n === "1" ? "" : "s"}, ${where}` : `${n} stop${n === "1" ? "" : "s"}`
    }
  }

  // Date: prefer itinerary / DEPARTURE section; skip email "…ago" headers
  const itineraryDates: string[] = []
  let inItinerary = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (/^DEPARTURE$/i.test(line) || /travel itinerary/i.test(line)) inItinerary = true
    if (/\bago\b/i.test(line)) continue
    if (/^DEPARTURE$/i.test(line)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const d = parseFlightDate(lines[j]!)
        if (d) {
          itineraryDates.push(d)
          break
        }
      }
      continue
    }
    const d = parseFlightDate(line)
    if (!d) continue
    if (inItinerary) itineraryDates.push(d)
    else if (!departureDate) departureDate = d
  }
  if (itineraryDates.length) departureDate = itineraryDates[0]

  // Collect explicit flight numbers early (LA2069, Flight Y4 183, etc.)
  for (const num of extractFlightNumbers(text)) {
    if (!flightNumbers.includes(num)) flightNumbers.push(num)
  }

  // ---- Segment walk: Volaris style (two times, then CityA\\tCityB, then Operated by) ----
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!

    // Layover lines — prefer "… layover in Place" before looser "wait of"
    const lay =
      line.match(
        /(?:layover\s+of|wait\s+of)\s+(\d+\s*h(?:ours?)?(?:\s*\d+\s*m(?:in(?:utes?)?)?)?)\s*(?:layover\s+)?(?:in\s+(.+))?/i,
      ) ||
      line.match(/(\d+\s*h(?:ours?)?\s*(?:\d+\s*m(?:in(?:utes?)?)?)?)\s*layover(?:\s+in\s+(.+))?/i)
    if (lay) {
      const dur = lay[1]!.replace(/\s+/g, " ").trim()
      const place = (lay[2] || "").replace(/\s+/g, " ").trim().replace(/\.$/, "") || undefined
      const label = place ? `${dur} layover in ${place}` : `${dur} layover`
      layovers.push({
        label,
        durationLabel: dur,
        place,
        time: segments[segments.length - 1]?.arriveTime,
      })
      if (!layoverLabel) layoverLabel = label
      i++
      continue
    }

    const op = parseOperatedByLine(line)
    if (op) {
      if (op.airline && !airline) airline = op.airline.replace(/^[A-Z0-9]{1,3}\s+/, "") || op.airline
      if (op.airline && segments.length) {
        const last = segments[segments.length - 1]!
        if (!last.airline) last.airline = op.airline.replace(/^[A-Z0-9]{1,3}\s+/, "") || op.airline
      }
      if (op.flightNumber) {
        if (!flightNumbers.includes(op.flightNumber)) flightNumbers.push(op.flightNumber)
        if (segments.length) {
          const last = segments[segments.length - 1]!
          if (!last.flightNumber) last.flightNumber = op.flightNumber
        }
      }
      i++
      continue
    }

    // Classic "Flight Y4 183"
    const fnLine = line.match(/^flight\s*:?\s*([A-Z0-9]{1,3})\s*[- ]?\s*(\d{1,5})\s*$/i)
    if (fnLine) {
      const num = normalizeFlightNum(`${fnLine[1]}${fnLine[2]}`)
      if (!flightNumbers.includes(num)) flightNumbers.push(num)
      if (segments.length && !segments[segments.length - 1]!.flightNumber) {
        segments[segments.length - 1]!.flightNumber = num
      }
      i++
      continue
    }

    // Collect clocks starting at this line
    const clocksHere = extractClocks(line)
    if (clocksHere.length === 0) {
      i++
      continue
    }

    // Gather clocks from this + following short lines until we have 2, then look for route pair
    const clocks = [...clocksHere]
    let j = i + 1
    while (clocks.length < 2 && j < lines.length) {
      const more = extractClocks(lines[j]!)
      if (more.length) {
        clocks.push(...more)
        j++
      } else if (/^(DEPARTURE|ARRIVAL|Flight|Operated|Layover|THIS IS NOT)/i.test(lines[j]!)) {
        break
      } else if (parseFlightDate(lines[j]!)) {
        j++
      } else {
        break
      }
    }

    if (clocks.length >= 2) {
      // Find route pair on upcoming lines
      let pair: { from: string; to: string } | null = null
      let k = j
      while (k < Math.min(j + 5, lines.length)) {
        if (/^(Flight|Operated|Layover|DEPARTURE|ARRIVAL)/i.test(lines[k]!)) break
        pair = splitRoutePair(lines[k]!)
        if (pair) {
          k++
          break
        }
        // Skip "Jorge Chavez" airport names that aren't pairs
        k++
      }
      const dep = clocks[0]!
      const arr = clocks[1]!
      const overnight = arr.hhmm < dep.hhmm
      const seg: ParsedFlightSegment = {
        from: pair?.from,
        to: pair?.to,
        departDisplay: dep.display,
        arriveDisplay: arr.display,
        departTime: dep.hhmm,
        arriveTime: arr.hhmm,
        departDate: departureDate,
        arriveDate: overnight && departureDate ? addDays(departureDate, 1) : departureDate,
        airline,
        flightNumber: flightNumbers[segments.length],
      }
      segments.push(seg)
      // Advance past clocks + pair; operated-by may follow
      i = Math.max(j, pair ? k : j)
      continue
    }

    i++
  }

  // Google Flights IATA sandwich when segment walk missed structured airports
  if (segments.length === 0 || (!fromAirport && !toAirport)) {
    const sandwich = tryParseIataTimeSandwich(lines, departureDate)
    if (sandwich) {
      if (segments.length === 0) {
        sandwich.segment.airline = airline
        sandwich.segment.flightNumber = flightNumbers[0]
        segments.push(sandwich.segment)
      } else if (segments.length === 1) {
        const s0 = segments[0]!
        if (!s0.from) s0.from = sandwich.segment.from
        if (!s0.to) s0.to = sandwich.segment.to
        if (!s0.departTime) {
          s0.departTime = sandwich.segment.departTime
          s0.departDisplay = sandwich.segment.departDisplay
        }
        if (!s0.arriveTime) {
          s0.arriveTime = sandwich.segment.arriveTime
          s0.arriveDisplay = sandwich.segment.arriveDisplay
        }
      }
      if (!fromAirport) fromAirport = sandwich.fromAirport
      if (!toAirport) toAirport = sandwich.toAirport
      if (!durationLabel && sandwich.durationLabel) durationLabel = sandwich.durationLabel
    }
  }

  // LATAM-style city / (CODE) email blocks — only when classic segment walk found nothing
  // and paste has parenthetical IATA (avoids mangling Aeroméxico/Volaris time+city lists)
  if (segments.length === 0) {
    const blocks = tryParseCityCodeBlocks(lines)
    if (blocks) {
      segments.push(...blocks.segments)
      if (!fromCity && blocks.fromCity) fromCity = blocks.fromCity
      if (!toCity && blocks.toCity) toCity = blocks.toCity
      if (!fromAirport && blocks.fromAirport) fromAirport = blocks.fromAirport
      if (!toAirport && blocks.toAirport) toAirport = blocks.toAirport
      if (!departureDate && blocks.departureDate) departureDate = blocks.departureDate
      for (const n of blocks.flightNumbers) {
        if (!flightNumbers.includes(n)) flightNumbers.push(n)
      }
    }
  }

  // Fallback: classic alternate time/place pairing if no segments yet
  if (segments.length === 0) {
    type ClockHit = { display: string; hhmm: string; place?: string }
    const clocks: ClockHit[] = []
    for (let li = 0; li < lines.length; li++) {
      const clockList = extractClocks(lines[li]!)
      if (!clockList.length) continue
      for (const clock of clockList) {
        let place: string | undefined
        for (let j = li + 1; j < Math.min(li + 3, lines.length); j++) {
          const next = lines[j]!
          if (extractClocks(next).length) break
          if (/^(flight|operated|wait|total|duration|layover|departure|arrival)/i.test(next)) break
          const pair = splitRoutePair(next)
          if (pair) {
            place = pair.from
            break
          }
          if (!/^[A-Z]{3}$/.test(next.trim()) && !/^\([A-Z]{3}\)$/i.test(next.trim())) {
            place = cleanPlace(next)
            break
          }
        }
        clocks.push({ ...clock, place })
      }
    }
    for (let ci = 0; ci + 1 < clocks.length; ci += 2) {
      const dep = clocks[ci]!
      const arr = clocks[ci + 1]!
      segments.push({
        from: dep.place,
        to: arr.place,
        departDisplay: dep.display,
        arriveDisplay: arr.display,
        departTime: dep.hhmm,
        arriveTime: arr.hhmm,
        departDate: departureDate,
        flightNumber: flightNumbers[segments.length],
        airline,
      })
    }
  }

  // Attach orphan flight numbers to segments in order
  for (let si = 0; si < segments.length; si++) {
    if (!segments[si]!.flightNumber && flightNumbers[si]) {
      segments[si]!.flightNumber = flightNumbers[si]
    }
  }
  // Rebuild flightNumbers from segments if richer
  for (const s of segments) {
    if (s.flightNumber && !flightNumbers.includes(s.flightNumber)) flightNumbers.push(s.flightNumber)
  }

  if (!fromCity && segments[0]?.from && !/^[A-Z]{3}$/.test(segments[0].from)) {
    fromCity = segments[0].from
  }
  if (!toCity && segments.length) {
    const last = segments[segments.length - 1]!
    if (last.to && !/^[A-Z]{3}$/.test(last.to)) toCity = last.to
  }
  // Clean "Lima, Peru" style
  if (toCity) toCity = toCity.replace(/\s+/g, " ").trim()
  if (fromCity) fromCity = fromCity.replace(/\s+/g, " ").trim()

  // Prefer city names on segments when we only had IATA
  if (segments[0]) {
    if (fromCity && (!segments[0].from || /^[A-Z]{3}$/.test(segments[0].from))) {
      segments[0].from = fromCity
    }
    const last = segments[segments.length - 1]!
    if (toCity && (!last.to || /^[A-Z]{3}$/.test(last.to))) {
      last.to = toCity
    }
  }

  // Chain multi-leg endpoints: leg0.to ↔ leg1.from so middle cities aren't lost
  chainSegmentEndpoints(segments, fromCity, toCity, fromAirport, toAirport)

  // When paste lists N+1 airport codes for N legs (UIO, MEX, TIJ), fill missing endpoints only
  if (segments.length >= 1 && iataCodes.length >= segments.length + 1) {
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si]!
      if (!seg.from) seg.from = iataCodes[si]
      if (!seg.to) seg.to = iataCodes[si + 1]
    }
    fromAirport = iataCodes[0]
    toAirport = iataCodes[iataCodes.length - 1]
  }

  if (!airline && segments.find((s) => s.airline)) {
    airline = segments.find((s) => s.airline)!.airline
  }
  for (const s of segments) {
    if (!s.airline && airline) s.airline = airline
  }

  // Fill layover times from previous segment arrival
  for (let li = 0; li < layovers.length; li++) {
    if (!layovers[li]!.time && segments[li]?.arriveTime) {
      layovers[li]!.time = segments[li]!.arriveTime
    }
  }
  if (!layoverLabel && layovers[0]) layoverLabel = layovers[0].label

  // Duration from segment times when paste omitted it
  if (!durationLabel && segments.length === 1) {
    const s0 = segments[0]!
    if (s0.departTime && s0.arriveTime) {
      const [dh, dm] = s0.departTime.split(":").map(Number)
      const [ah, am] = s0.arriveTime.split(":").map(Number)
      let mins = ah! * 60 + am! - (dh! * 60 + dm!)
      if (mins < 0) mins += 24 * 60
      durationLabel = formatDuration(Math.floor(mins / 60), mins % 60)
    }
  }

  const primaryFn = flightNumbers[0] || segments[0]?.flightNumber || ""
  const routeLabel =
    fromCity && toCity
      ? `${fromCity} → ${toCity}`
      : fromAirport && toAirport
        ? `${fromAirport}–${toAirport}`
        : fromCity || toCity || ""
  const fnLabel = flightNumbers.length > 1 ? flightNumbers.join(" / ") : primaryFn
  const carrier = airline || ""
  const title = [carrier && fnLabel ? `${carrier} ${fnLabel}` : fnLabel || carrier, routeLabel]
    .filter(Boolean)
    .join(" · ")

  const land = segments.length ? segments[segments.length - 1]!.arriveDisplay : undefined
  const landPlace = toCity || toAirport || segments[segments.length - 1]?.to
  const depDisp = segments[0]?.departDisplay
  const fromLabel = fromAirport || fromCity || segments[0]?.from

  const detailParts = [
    durationLabel && segments.length <= 1 ? `${durationLabel} flight` : durationLabel ? `${durationLabel} total` : "",
    fromLabel && depDisp && land && landPlace && segments.length <= 1
      ? `Takeoff ${fromLabel} ${depDisp} → Land ${landPlace} ${land}`
      : segments.length > 1
        ? ""
        : land && landPlace
          ? `land ${land} in ${landPlace}`
          : land
            ? `land ${land}`
            : "",
    stopsLabel || "",
    layoverLabel || "",
    confirmation ? `Conf ${confirmation}` : "",
  ].filter(Boolean)

  return {
    fromCity,
    toCity,
    fromAirport,
    toAirport,
    durationLabel: durationLabel ? `${durationLabel.replace(/\s*flight$/i, "")} flight` : undefined,
    stopsLabel,
    layoverLabel,
    layovers,
    airline,
    flightNumber: primaryFn,
    flightNumbers,
    segments,
    confirmation,
    departureDate,
    title: title || "Flight",
    detail: detailParts.join(" · "),
    time: segments[0]?.departTime,
    rawText: text,
  }
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Fill missing from/to on each leg using neighbors + overall route so
 * leg 2 isn't left blank (UI would otherwise fall back to overall origin→dest).
 */
export function chainSegmentEndpoints(
  segments: ParsedFlightSegment[],
  fromCity?: string,
  toCity?: string,
  fromAirport?: string,
  toAirport?: string,
): void {
  if (!segments.length) return

  if (!segments[0]!.from) segments[0]!.from = fromCity || fromAirport
  const lastIdx = segments.length - 1
  if (!segments[lastIdx]!.to) segments[lastIdx]!.to = toCity || toAirport

  for (let i = 0; i < segments.length - 1; i++) {
    const a = segments[i]!
    const b = segments[i + 1]!
    if (!a.to && b.from) a.to = b.from
    if (!b.from && a.to) b.from = a.to
  }

  // Single known connection airport (overall from/to differ from first/last cities)
  if (segments.length === 2 && fromAirport && toAirport && fromAirport !== toAirport) {
    const a = segments[0]!
    const b = segments[1]!
    // If first leg has origin but no dest, and second has dest but no origin — use leftover IATA as hub
    if (a.from && !a.to && b.to && !b.from) {
      // Prefer an explicit middle code when paste listed 3 airports
      // Otherwise leave for UI airportFromCity; still avoid copying overall endpoints onto both legs
    }
  }
}

/** Build a multi-line schedule body from parsed details (for freeform edit). */
export function formatParsedFlightBody(p: ParsedFlightDetails): string {
  const lines: string[] = []
  if (p.fromCity && p.toCity) lines.push(`${p.fromCity} → ${p.toCity}`)
  if (p.confirmation) lines.push(`Confirmation: ${p.confirmation}`)
  if (p.segments.length) {
    for (const s of p.segments) {
      const bits = [
        s.flightNumber,
        s.airline && !s.flightNumber ? s.airline : "",
        s.from && s.to ? `${s.from} → ${s.to}` : s.from || s.to || "",
        s.departDisplay && s.arriveDisplay
          ? `${s.departDisplay} – ${s.arriveDisplay}`
          : s.departDisplay || s.arriveDisplay || "",
      ].filter(Boolean)
      lines.push(bits.join(" · "))
    }
  } else if (p.flightNumber) {
    lines.push([p.airline, p.flightNumber].filter(Boolean).join(" "))
  }
  return lines.join("\n") || p.title
}
