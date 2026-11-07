/**
 * lib/flight-bimby/airports.ts — IATA code → city + IANA time zone
 *
 * A confirmation prints each time in the local clock of its airport, so the real length of a flight
 * needs both zones. This table covers the airports people actually fly from; an unknown code is
 * never guessed (the length is then left blank and the event uses the printed clocks).
 * Pure: no store, no network.
 */

export interface AirportInfo {
  city: string
  tz: string
}

const E = "America/New_York"
const C = "America/Chicago"
const M = "America/Denver"
const P = "America/Los_Angeles"

export const AIRPORTS: Record<string, AirportInfo> = {
  // US East
  JFK: { city: "New York", tz: E }, LGA: { city: "New York", tz: E }, EWR: { city: "Newark", tz: E },
  BOS: { city: "Boston", tz: E }, PHL: { city: "Philadelphia", tz: E }, BWI: { city: "Baltimore", tz: E },
  DCA: { city: "Washington", tz: E }, IAD: { city: "Washington", tz: E }, CLT: { city: "Charlotte", tz: E },
  RDU: { city: "Raleigh", tz: E }, ATL: { city: "Atlanta", tz: E }, MIA: { city: "Miami", tz: E },
  FLL: { city: "Fort Lauderdale", tz: E }, MCO: { city: "Orlando", tz: E }, TPA: { city: "Tampa", tz: E },
  JAX: { city: "Jacksonville", tz: E }, PBI: { city: "West Palm Beach", tz: E }, RSW: { city: "Fort Myers", tz: E },
  PIT: { city: "Pittsburgh", tz: E }, CLE: { city: "Cleveland", tz: E }, CMH: { city: "Columbus", tz: E },
  DTW: { city: "Detroit", tz: E }, BUF: { city: "Buffalo", tz: E }, ROC: { city: "Rochester", tz: E },
  SYR: { city: "Syracuse", tz: E }, ALB: { city: "Albany", tz: E }, PVD: { city: "Providence", tz: E },
  BDL: { city: "Hartford", tz: E }, PWM: { city: "Portland", tz: E }, BTV: { city: "Burlington", tz: E },
  CHS: { city: "Charleston", tz: E }, SAV: { city: "Savannah", tz: E }, RIC: { city: "Richmond", tz: E },
  ORF: { city: "Norfolk", tz: E }, IND: { city: "Indianapolis", tz: E }, CVG: { city: "Cincinnati", tz: E },
  SDF: { city: "Louisville", tz: E }, SJU: { city: "San Juan", tz: "America/Puerto_Rico" },
  // US Central
  ORD: { city: "Chicago", tz: C }, MDW: { city: "Chicago", tz: C }, DFW: { city: "Dallas", tz: C },
  DAL: { city: "Dallas", tz: C }, IAH: { city: "Houston", tz: C }, HOU: { city: "Houston", tz: C },
  AUS: { city: "Austin", tz: C }, SAT: { city: "San Antonio", tz: C }, MSY: { city: "New Orleans", tz: C },
  BNA: { city: "Nashville", tz: C }, MEM: { city: "Memphis", tz: C }, STL: { city: "St. Louis", tz: C },
  MCI: { city: "Kansas City", tz: C }, MSP: { city: "Minneapolis", tz: C }, MKE: { city: "Milwaukee", tz: C },
  OMA: { city: "Omaha", tz: C }, OKC: { city: "Oklahoma City", tz: C }, TUL: { city: "Tulsa", tz: C },
  BHM: { city: "Birmingham", tz: C }, LIT: { city: "Little Rock", tz: C },
  // US Mountain
  DEN: { city: "Denver", tz: M }, SLC: { city: "Salt Lake City", tz: M }, ABQ: { city: "Albuquerque", tz: M },
  BOI: { city: "Boise", tz: M }, PHX: { city: "Phoenix", tz: "America/Phoenix" }, TUS: { city: "Tucson", tz: "America/Phoenix" },
  ELP: { city: "El Paso", tz: M }, BZN: { city: "Bozeman", tz: M }, JAC: { city: "Jackson", tz: M },
  // US Pacific
  LAX: { city: "Los Angeles", tz: P }, SAN: { city: "San Diego", tz: P }, SFO: { city: "San Francisco", tz: P },
  OAK: { city: "Oakland", tz: P }, SJC: { city: "San Jose", tz: P }, SMF: { city: "Sacramento", tz: P },
  BUR: { city: "Burbank", tz: P }, LGB: { city: "Long Beach", tz: P }, SNA: { city: "Orange County", tz: P },
  ONT: { city: "Ontario", tz: P }, PSP: { city: "Palm Springs", tz: P }, SBA: { city: "Santa Barbara", tz: P },
  SEA: { city: "Seattle", tz: P }, PDX: { city: "Portland", tz: P }, LAS: { city: "Las Vegas", tz: P },
  RNO: { city: "Reno", tz: P }, GEG: { city: "Spokane", tz: P },
  // US other
  ANC: { city: "Anchorage", tz: "America/Anchorage" }, HNL: { city: "Honolulu", tz: "Pacific/Honolulu" },
  OGG: { city: "Maui", tz: "Pacific/Honolulu" }, KOA: { city: "Kona", tz: "Pacific/Honolulu" }, LIH: { city: "Kauai", tz: "Pacific/Honolulu" },
  // Canada / Mexico / Caribbean
  YYZ: { city: "Toronto", tz: E }, YUL: { city: "Montreal", tz: E }, YOW: { city: "Ottawa", tz: E },
  YVR: { city: "Vancouver", tz: P }, YYC: { city: "Calgary", tz: M }, YEG: { city: "Edmonton", tz: M },
  YWG: { city: "Winnipeg", tz: C }, YHZ: { city: "Halifax", tz: "America/Halifax" },
  MEX: { city: "Mexico City", tz: "America/Mexico_City" }, GDL: { city: "Guadalajara", tz: "America/Mexico_City" },
  CUN: { city: "Cancun", tz: "America/Cancun" }, SJD: { city: "Los Cabos", tz: M }, PVR: { city: "Puerto Vallarta", tz: "America/Mexico_City" },
  TIJ: { city: "Tijuana", tz: P }, NAS: { city: "Nassau", tz: E }, MBJ: { city: "Montego Bay", tz: "America/Jamaica" },
  PUJ: { city: "Punta Cana", tz: "America/Santo_Domingo" }, SJO: { city: "San Jose", tz: "America/Costa_Rica" },
  PTY: { city: "Panama City", tz: "America/Panama" }, BOG: { city: "Bogota", tz: "America/Bogota" },
  LIM: { city: "Lima", tz: "America/Lima" }, GRU: { city: "Sao Paulo", tz: "America/Sao_Paulo" },
  EZE: { city: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" }, SCL: { city: "Santiago", tz: "America/Santiago" },
  // Europe
  LHR: { city: "London", tz: "Europe/London" }, LGW: { city: "London", tz: "Europe/London" }, STN: { city: "London", tz: "Europe/London" },
  DUB: { city: "Dublin", tz: "Europe/Dublin" }, EDI: { city: "Edinburgh", tz: "Europe/London" },
  CDG: { city: "Paris", tz: "Europe/Paris" }, ORY: { city: "Paris", tz: "Europe/Paris" }, AMS: { city: "Amsterdam", tz: "Europe/Amsterdam" },
  BRU: { city: "Brussels", tz: "Europe/Brussels" }, FRA: { city: "Frankfurt", tz: "Europe/Berlin" }, MUC: { city: "Munich", tz: "Europe/Berlin" },
  BER: { city: "Berlin", tz: "Europe/Berlin" }, ZRH: { city: "Zurich", tz: "Europe/Zurich" }, GVA: { city: "Geneva", tz: "Europe/Zurich" },
  VIE: { city: "Vienna", tz: "Europe/Vienna" }, PRG: { city: "Prague", tz: "Europe/Prague" }, BUD: { city: "Budapest", tz: "Europe/Budapest" },
  WAW: { city: "Warsaw", tz: "Europe/Warsaw" }, CPH: { city: "Copenhagen", tz: "Europe/Copenhagen" }, ARN: { city: "Stockholm", tz: "Europe/Stockholm" },
  OSL: { city: "Oslo", tz: "Europe/Oslo" }, HEL: { city: "Helsinki", tz: "Europe/Helsinki" }, KEF: { city: "Reykjavik", tz: "Atlantic/Reykjavik" },
  MAD: { city: "Madrid", tz: "Europe/Madrid" }, BCN: { city: "Barcelona", tz: "Europe/Madrid" }, LIS: { city: "Lisbon", tz: "Europe/Lisbon" },
  OPO: { city: "Porto", tz: "Europe/Lisbon" }, FCO: { city: "Rome", tz: "Europe/Rome" }, MXP: { city: "Milan", tz: "Europe/Rome" },
  VCE: { city: "Venice", tz: "Europe/Rome" }, ATH: { city: "Athens", tz: "Europe/Athens" }, IST: { city: "Istanbul", tz: "Europe/Istanbul" },
  // Middle East / Asia / Oceania / Africa
  DXB: { city: "Dubai", tz: "Asia/Dubai" }, DOH: { city: "Doha", tz: "Asia/Qatar" }, TLV: { city: "Tel Aviv", tz: "Asia/Jerusalem" },
  DEL: { city: "Delhi", tz: "Asia/Kolkata" }, BOM: { city: "Mumbai", tz: "Asia/Kolkata" }, BKK: { city: "Bangkok", tz: "Asia/Bangkok" },
  SIN: { city: "Singapore", tz: "Asia/Singapore" }, HKG: { city: "Hong Kong", tz: "Asia/Hong_Kong" }, PEK: { city: "Beijing", tz: "Asia/Shanghai" },
  PVG: { city: "Shanghai", tz: "Asia/Shanghai" }, ICN: { city: "Seoul", tz: "Asia/Seoul" }, NRT: { city: "Tokyo", tz: "Asia/Tokyo" },
  HND: { city: "Tokyo", tz: "Asia/Tokyo" }, KIX: { city: "Osaka", tz: "Asia/Tokyo" }, TPE: { city: "Taipei", tz: "Asia/Taipei" },
  SYD: { city: "Sydney", tz: "Australia/Sydney" }, MEL: { city: "Melbourne", tz: "Australia/Melbourne" }, AKL: { city: "Auckland", tz: "Pacific/Auckland" },
  JNB: { city: "Johannesburg", tz: "Africa/Johannesburg" }, CAI: { city: "Cairo", tz: "Africa/Cairo" }, CMN: { city: "Casablanca", tz: "Africa/Casablanca" },
}

export function airportInfo(code?: string): AirportInfo | undefined {
  return code ? AIRPORTS[code.toUpperCase()] : undefined
}

export function isKnownAirport(code: string): boolean {
  return Boolean(AIRPORTS[code.toUpperCase()])
}

/** City name → code, for "San Diego" with no code beside it. First table entry per city wins. */
export function airportForCity(city?: string): string | undefined {
  if (!city) return undefined
  const key = city.split(",")[0]!.trim().toLowerCase()
  if (!key) return undefined
  for (const [code, info] of Object.entries(AIRPORTS)) if (info.city.toLowerCase() === key) return code
  return undefined
}

// ── zone math ──────────────────────────────────────────────────────────────

/** Offset (ms, zone minus UTC) of `tz` at the instant `utcMs`. */
function offsetAt(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs))
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - Math.floor(utcMs / 1000) * 1000
}

/** The UTC instant of a wall clock (`YYYY-MM-DD` + `HH:mm`) in `tz`. */
export function wallToUtc(date: string, hhmm: string, tz: string): number {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = hhmm.split(":").map(Number)
  const guess = Date.UTC(y!, mo! - 1, d!, h, mi)
  const first = guess - offsetAt(tz, guess)
  return guess - offsetAt(tz, first)
}

/** The wall clock (`date`, `hhmm`) of a UTC instant in `tz`. */
export function utcToWall(utcMs: number, tz: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(utcMs))
  const g = (t: string) => parts.find((p) => p.type === t)!.value
  return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` }
}
