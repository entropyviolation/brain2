/**
 * lib/flight-bimby/extract.ts — Read flights out of a pasted confirmation
 *
 * Pure and rules-only, so it is the same every time. Handles what real confirmation pages look
 * like once pasted: letters spaced for screen readers ("J F K", "A S 2 5"), a code glued to its
 * time ("SAN11:48am"), a label on one line and its value on the next, several flights in one
 * paste, and chatter on the same line as the last fact. It reads direction from the strongest
 * signal present ("Departs from X … arrives Y", then "(X) to (Y)", then code/time pairs, then
 * order) and never invents: what the paste does not say goes in `missing`.
 */
import { inferFlightYear, normalizeFlightPaste } from "@/lib/parse-flight-text"
import { airlineByCode, airlineInText } from "./airlines"
import { airportInfo, isKnownAirport, wallToUtc } from "./airports"
import type { ExtractResult, FlightDraft } from "./types"

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
const DATE_RE = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`, "i")
const DATE_DMY_RE = new RegExp(`\\b(\\d{1,2})\\s+${MONTH_RE}\\.?(?:,?\\s+(20\\d{2}))?\\b`, "i")
const CLOCK_SRC = "(\\d{1,2}):(\\d{2})\\s*([ap])\\.?m\\.?(?![a-z])"
const CLOCK24_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g

// ── cleaning ───────────────────────────────────────────────────────────────

/** Undo what a copy from a web page does to codes and times. */
export function cleanFlightPaste(raw: string): string {
  let t = normalizeFlightPaste(raw)
  // "J F K" / "A S 2 5" → "JFK" / "AS25", but only when the result is a code and not prose.
  t = t.replace(/\b(?:[A-Z0-9] ){2,5}[A-Z0-9]\b/g, (m) => {
    const joined = m.replace(/ /g, "")
    if (/^[A-Z]{3}$/.test(joined)) return joined
    if (/^[A-Z0-9]{2}\d{1,4}$/.test(joined) && airlineByCode(joined.slice(0, 2))) return joined
    return m
  })
  // "SAN11:48am" and "11:48amSAN" → a space between.
  t = t.replace(/\b([A-Z]{3})(?=\d{1,2}:\d{2})/g, "$1 ")
  t = t.replace(/(\d{1,2}:\d{2}\s*[ap]\.?m\.?)(?=[A-Z]{3}\b)/gi, "$1 ")
  return t
}

// ── small readers ──────────────────────────────────────────────────────────

const pad = (n: number | string) => String(n).padStart(2, "0")

function ymd(month: string, day: string, year: string | undefined, now: Date): string | null {
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase()) + 1
  const d = Number(day)
  if (!m || d < 1 || d > 31) return null
  return `${year ? Number(year) : inferFlightYear(m, d, now)}-${pad(m)}-${pad(d)}`
}

function readDate(line: string, now: Date): string | null {
  const iso = line.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = line.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/)
  if (us) return `${us[3]}-${pad(us[1]!)}-${pad(us[2]!)}`
  const md = line.match(DATE_RE)
  if (md) return ymd(md[1]!, md[2]!, md[3], now)
  const dm = line.match(DATE_DMY_RE)
  if (dm) return ymd(dm[2]!, dm[1]!, dm[3], now)
  return null
}

function to24(h: string, mi: string, ap: string): string {
  let hour = Number(h) % 12
  if (/p/i.test(ap)) hour += 12
  return `${pad(hour)}:${mi}`
}

function firstClock(s?: string): string | undefined {
  if (!s) return undefined
  const m = new RegExp(CLOCK_SRC, "i").exec(s)
  return m ? to24(m[1]!, m[2]!, m[3]!) : undefined
}

/** Clock times in order of appearance, repeats of a recent clock folded (a page prints each twice). */
function readClocks(text: string): string[] {
  const out: string[] = []
  const push = (v: string) => {
    if (!out.slice(-2).includes(v)) out.push(v)
  }
  const ampm = [...text.matchAll(new RegExp(CLOCK_SRC, "gi"))]
  if (ampm.length) {
    for (const m of ampm) push(to24(m[1]!, m[2]!, m[3]!))
    return out
  }
  for (const m of text.matchAll(CLOCK24_RE)) push(`${pad(m[1]!)}:${m[2]}`)
  return out
}

function readDuration(text: string): number | undefined {
  const m = text.match(/\b(\d{1,2})\s*h(?:rs?|ours?)?\s*(?:(\d{1,2})\s*m(?:in)?)?\b/i)
  if (!m) return undefined
  const mins = Number(m[1]) * 60 + Number(m[2] ?? 0)
  return mins >= 20 && mins <= 24 * 60 ? mins : undefined
}

// ── flight numbers ─────────────────────────────────────────────────────────

const FLIGHT_TOKEN_RE = /\b([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{1,4})\b/g

function flightNumbersIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(FLIGHT_TOKEN_RE)) {
    if (!airlineByCode(m[1]!)) continue
    const id = `${m[1]}${m[2]}`
    if (!out.includes(id)) out.push(id)
  }
  return out
}

function readFlightNumber(text: string): string | undefined {
  const labelled = text.match(/\bflight\s*(?:number|no\.?|#)?\s*:?\s*([A-Z][A-Z0-9]|[A-Z0-9][A-Z])\s?(\d{1,4})\b/)
  if (labelled && airlineByCode(labelled[1]!)) return `${labelled[1]}${labelled[2]}`
  return flightNumbersIn(text)[0]
}

// ── block splitting ────────────────────────────────────────────────────────

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000)

/**
 * Cut a paste into one chunk per flight. A new chunk starts at a date line when the chunk before it
 * already holds times, and either the new date is two or more days away or the lines after it name
 * a different flight number, and times follow. One flight that lands next morning stays one chunk.
 */
function splitBlocks(lines: string[], now: Date): string[][] {
  const blocks: string[][] = [[]]
  let date: string | null = null
  let clocks = 0
  let numbers: string[] = []
  lines.forEach((line, i) => {
    const d = readDate(line, now)
    if (d && date && d !== date && clocks >= 1) {
      const ahead = lines.slice(i, i + 14).join("\n")
      const farApart = Math.abs(dayNumber(d) - dayNumber(date)) >= 2
      const newNumber = numbers.length > 0 && flightNumbersIn(ahead).some((n) => !numbers.includes(n))
      if ((farApart || newNumber) && readClocks(ahead).length > 0) {
        blocks.push([])
        date = null
        clocks = 0
        numbers = []
      }
    }
    blocks[blocks.length - 1]!.push(line)
    if (d && !date) date = d
    clocks += readClocks(line).length
    for (const n of flightNumbersIn(line)) if (!numbers.includes(n)) numbers.push(n)
  })
  return blocks.filter((b) => b.join("").trim())
}

// ── one flight ─────────────────────────────────────────────────────────────

interface Route {
  from: string
  to: string
  departTime?: string
  arriveTime?: string
}

const AIR = "[A-Z]{3}"

/** Direction from the strongest signal present. */
function readRoute(text: string, clocks: string[]): Route | null {
  // 1. "Departs from JFK at 5:28 PM, arrives SAN at 8:45 PM"
  const dep = text.match(new RegExp(`depart(?:s|ing|ure)?\\s+(?:from\\s+)?(${AIR})\\b([^\\n]{0,40}?)(?:[,.;]\\s*|\\s+)arriv(?:es|ing|al)?\\s+(?:at\\s+|in\\s+)?(${AIR})\\b([^\\n]{0,40})`))
  if (dep && dep[1] !== dep[3]) {
    return { from: dep[1]!, to: dep[3]!, departTime: firstClock(dep[2]), arriveTime: firstClock(dep[4]) }
  }
  // 2. "New York-Kennedy (JFK) to San Diego, CA (SAN)" or "JFK → SAN"
  const to =
    text.match(new RegExp(`\\((${AIR})\\)\\s+(?:to|→|->)\\s+[^()\\n]{0,40}?\\((${AIR})\\)`)) ??
    text.match(new RegExp(`\\b(${AIR})\\s*(?:→|->|—|–|\\s+to)\\s*(${AIR})\\b`))
  if (to && to[1] !== to[2] && (/\(/.test(to[0]) || (isKnownAirport(to[1]!) && isKnownAirport(to[2]!)))) {
    return { from: to[1]!, to: to[2]!, departTime: clocks[0], arriveTime: clocks[1] }
  }
  // 3. A code beside a clock: "SAN 11:48am … JFK 8:13pm" or "5:28 pm JFK … 8:45 pm SAN". The first pair is takeoff.
  const pairs: string[] = []
  const pairRe = new RegExp(`\\b(${AIR})\\s+\\d{1,2}:\\d{2}\\s*[ap]\\.?m|\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?\\s+(${AIR})\\b`, "gi")
  for (const m of text.matchAll(pairRe)) {
    const code = (m[1] ?? m[2])!
    if (code === code.toUpperCase() && !pairs.includes(code)) pairs.push(code)
  }
  if (pairs.length >= 2) return { from: pairs[0]!, to: pairs[1]!, departTime: clocks[0], arriveTime: clocks[1] }
  // 4. Order of appearance: parenthesised codes, or codes in the airport table.
  const seen: string[] = []
  for (const m of text.matchAll(/\(([A-Z]{3})\)|\b([A-Z]{3})\b/g)) {
    const code = m[1] ?? m[2]!
    if ((m[1] || isKnownAirport(code)) && !seen.includes(code)) seen.push(code)
  }
  if (seen.length >= 2) return { from: seen[0]!, to: seen[1]!, departTime: clocks[0], arriveTime: clocks[1] }
  return null
}

// ── confirmation code ──────────────────────────────────────────────────────

const CONF_LABEL = /\b(?:confirmation|record\s+locator|booking|reservation|reference|pnr|conf)\s*(?:code|number|no\.?|#|id)?\s*[:#]?/i
const NOT_CODE = new Set(["CODE", "NUMBER", "ONLINE", "FLIGHT", "FLIGHTS", "BOOKED", "CONFIRMED", "DEPARTING", "ARRIVING"])
const codeOk = (c: string) => /[A-Z]/.test(c) && /^[A-Z0-9]{5,8}$/.test(c) && !NOT_CODE.has(c) && !isKnownAirport(c)

interface Confirmation {
  code?: string
  /** Text left on the same line after the code. */
  after?: string
  inferred?: boolean
}

function readConfirmation(lines: string[]): Confirmation {
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i]!.match(CONF_LABEL)
    if (!label) continue
    const rest = lines[i]!.slice(label.index! + label[0].length)
    const hit = rest.match(/\b([A-Z0-9]{5,8})\b/)
    if (hit && codeOk(hit[1]!)) return { code: hit[1], after: rest.slice(hit.index! + hit[1]!.length) }
    const next = lines.slice(i + 1, i + 3).find((l) => l.trim())
    const nextHit = next?.match(/^\s*([A-Z0-9]{5,8})\b/)
    if (nextHit && codeOk(nextHit[1]!)) return { code: nextHit[1], after: next!.slice(nextHit[0].length) }
  }
  // Alaska-style: the code follows the rewards number.
  for (const line of lines) {
    const m = line.match(/(?:rewards|mileage|frequent\s+flyer|atmos)[^\n]*?\b\d{6,}\s+([A-Z0-9]{6})\b(.*)$/i)
    if (m && codeOk(m[1]!)) return { code: m[1], after: m[2], inferred: true }
  }
  return {}
}

// ── the rest of a block ────────────────────────────────────────────────────

function readAirline(text: string, number?: string): string | undefined {
  const ctx = text.match(/(?:operated\s+by|booking\s+with|booked\s+with|flying\s+with|marketed\s+by)\s+([A-Za-z][A-Za-z ]{1,25})/i)
  if (ctx) {
    const named = airlineInText(ctx[1]!)
    if (named) return named.name
  }
  if (number) {
    const byCode = airlineByCode(number.slice(0, 2))
    if (byCode) return byCode.name
  }
  return airlineInText(text)?.name
}

function readNotes(text: string, conf: Confirmation): string[] {
  const notes: string[] = []
  const refund = text.match(/\b(non-?refundable|refundable)\b/i)?.[1]
  const way = text.match(/\b(one-way|round[- ]trip)\b/i)?.[1]
  if (refund || way) notes.push([refund, way].filter(Boolean).join(" ").toLowerCase())
  const fare = text.match(/\|\s*([A-Za-z][A-Za-z+ ]{2,18}(?:\([A-Z]\))?)\s*\|/)?.[1]?.trim()
  if (fare) notes.push(`Fare: ${fare}`)
  if (/no seats selected/i.test(text)) notes.push("No seat chosen yet. Seats are assigned at check-in.")
  const seat = text.match(/\bseats?\s*:?\s*(\d{1,2}[A-K])\b/i)?.[1]
  if (seat) notes.push(`Seat ${seat}`)
  if (conf.inferred) notes.push("Confirmation code read from the line after the rewards number.")
  return notes
}

function readCost(text: string): number | undefined {
  const m = text.match(/(?:total|paid|amount|fare)[^\n$]{0,30}\$\s?([\d,]+(?:\.\d{2})?)/i)
  return m ? Number(m[1]!.replace(/,/g, "")) : undefined
}

function addDay(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 1)
  return day.toISOString().slice(0, 10)
}

/** The arrival date: the day, in the arrival zone, whose wall clock lands the right length after takeoff. */
function arrivalDate(d: FlightDraft): string | undefined {
  if (!d.departDate || !d.departTime || !d.arriveTime) return undefined
  const a = airportInfo(d.from)
  const b = airportInfo(d.to)
  if (a && b) {
    const start = wallToUtc(d.departDate, d.departTime, a.tz)
    const guess = d.durationMinutes ? start + d.durationMinutes * 60_000 : undefined
    let best: { date: string; score: number } | undefined
    for (const shift of [-1, 0, 1, 2]) {
      const day = new Date(`${d.departDate}T12:00:00Z`)
      day.setUTCDate(day.getUTCDate() + shift)
      const date = day.toISOString().slice(0, 10)
      const end = wallToUtc(date, d.arriveTime, b.tz)
      if (end <= start) continue
      const score = guess !== undefined ? Math.abs(end - guess) : end - start
      if (!best || score < best.score) best = { date, score }
    }
    if (best) return best.date
  }
  return d.arriveTime < d.departTime ? addDay(d.departDate) : d.departDate
}

/** "New York-Kennedy (JFK)" → "New York". Only when the paste prints the city beside its code. */
function cityBeside(text: string, code?: string): string | undefined {
  if (!code) return undefined
  const m = text.match(new RegExp(`([A-Z][A-Za-z.' ]{2,24}?)(?:-[A-Z][A-Za-z]+)?(?:,\\s*[A-Z]{2})?\\s*\\(${code}\\)`))
  return m?.[1]?.trim()
}

/** What the paste did not say. Each is asked about or looked up, never made up. */
export function missingFields(d: FlightDraft): string[] {
  const out: string[] = []
  if (!d.from) out.push("from")
  if (!d.to) out.push("to")
  if (!d.departDate) out.push("date")
  if (!d.departTime) out.push("departure time")
  if (!d.arriveTime) out.push("arrival time")
  if (!d.flightNumber) out.push("flight number")
  if (!d.confirmation) out.push("confirmation code")
  return out
}

/** Recompute what depends on the other fields (arrival day, the missing list) after a fill. */
export function finishDraft(d: FlightDraft): FlightDraft {
  const next = { ...d }
  next.arriveDate = next.arriveDate ?? arrivalDate(next)
  next.missing = missingFields(next)
  return next
}

function readBlock(lines: string[], now: Date): { draft: FlightDraft; after?: string } | null {
  const text = lines.join("\n")
  const date = lines.map((l) => readDate(l, now)).find(Boolean) ?? undefined
  const clocks = readClocks(text)
  const route = readRoute(text, clocks)
  const number = readFlightNumber(text)
  const conf = readConfirmation(lines)
  // A flight needs a route, or a number plus a date that a lookup can finish.
  if (!route && !(number && date)) return null

  const draft: FlightDraft = {
    airline: readAirline(text, number),
    flightNumber: number,
    from: route?.from,
    to: route?.to,
    fromCity: airportInfo(route?.from)?.city ?? cityBeside(text, route?.from),
    toCity: airportInfo(route?.to)?.city ?? cityBeside(text, route?.to),
    departDate: date,
    departTime: route?.departTime ?? clocks[0],
    arriveTime: route?.arriveTime ?? clocks[1],
    confirmation: conf.code,
    durationMinutes: readDuration(text),
    miles: Number(text.match(/\b([\d,]{3,6})\s*miles\b/i)?.[1]?.replace(/,/g, "")) || undefined,
    cost: readCost(text),
    notes: readNotes(text, conf),
    missing: [],
  }
  draft.arriveDate = arrivalDate(draft)
  return { draft, after: conf.after }
}

// ── entry points ───────────────────────────────────────────────────────────

/** All the flights in a paste, plus any chatter left on the last fact's line. */
export function extractFlights(raw: string, now = new Date()): ExtractResult {
  const lines = cleanFlightPaste(raw).split("\n")
  const flights: FlightDraft[] = []
  let leftover = ""
  const blocks = splitBlocks(lines, now)
  blocks.forEach((block, i) => {
    const read = readBlock(block, now)
    if (!read) return
    const { draft, after } = read
    const strong = Boolean(draft.from && draft.to && (draft.departTime || draft.flightNumber || draft.confirmation))
    const lookable = Boolean(draft.flightNumber && draft.departDate)
    if (!strong && !lookable) return
    draft.missing = missingFields(draft)
    flights.push(draft)
    if (i === blocks.length - 1 && after) {
      const words = after.replace(/^\W+/, "").trim()
      if (words.split(/\s+/).length >= 3 && !/^(departing|arriving|depart|arrive)\b/i.test(words)) leftover = words
    }
  })
  return { flights, leftover }
}

/**
 * Cheap yes/no for the chat router: is this a flight confirmation, not a plan to book one?
 * "need to book flights but im stuck" has no route, clock or number, so it stays a plan.
 */
export function looksLikeFlightConfirmation(raw: string, now = new Date()): boolean {
  if (raw.length < 40) return false
  return extractFlights(raw, now).flights.length > 0
}
