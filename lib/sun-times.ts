/**
 * lib/sun-times.ts — Sunrise / sunset for a calendar day at a pin
 *
 * Tracking, Plan, and Sleep analytics ask "what was the sun on **this** date",
 * not "what is it today". Times are computed from latitude, longitude, and a
 * local `YYYY-MM-DD` (NOAA / SunCalc geometry). A separate persist cache
 * (`sun-times-store.ts`) remembers the first result per day so a later lookup
 * cannot stamp today's clock onto last week.
 *
 * Polar days with no rise or set return `null` rather than a fake noon.
 */

export const SAN_DIEGO_COORDS = { lat: 32.7157, lng: -117.1611 } as const

export type DaySunTimes = {
  date: string
  lat: number
  lng: number
  sunriseMinutes: number
  sunsetMinutes: number
  sunriseHhmm: string
  sunsetHhmm: string
  sunriseLabel: string
  sunsetLabel: string
}

const rad = Math.PI / 180
const dayMs = 86_400_000
const J1970 = 2_440_588
const J2000 = 2_451_545
const e = rad * 23.4397
const J0 = 0.0009
/** Geometric centre of the sun, plus refraction — civil sunrise/sunset. */
const SUNSET_ANGLE = -0.833 * rad

export function roundSunCoord(n: number): number {
  return Math.round(n * 10_000) / 10_000
}

/** Cache key: calendar day + pin. Same day at a new pin is a different slot. */
export function sunCacheKey(date: string, lat: number, lng: number): string {
  return `${date}|${roundSunCoord(lat).toFixed(4)}|${roundSunCoord(lng).toFixed(4)}`
}

export function hhmmFromMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

export function sunClockLabel(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h24 = Math.floor(m / 60)
  const min = m % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 || 12
  return `${h12}:${String(min).padStart(2, "0")} ${period}`
}

function toJulian(date: Date): number {
  return date.getTime() / dayMs - 0.5 + J1970
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * dayMs)
}

function toDays(date: Date): number {
  return toJulian(date) - J2000
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l))
}

function declination(l: number, b: number): number {
  return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
}

function solarMeanAnomaly(d: number): number {
  return rad * (357.5291 + 0.98560028 * d)
}

function eclipticLongitude(M: number): number {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const P = rad * 102.9372
  return M + C + P + Math.PI
}

function julianCycle(d: number, lw: number): number {
  return Math.round(d - J0 - lw / (2 * Math.PI))
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return J0 + (Ht + lw) / (2 * Math.PI) + n
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
}

function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)))
}

function getSetJ(
  h: number,
  lw: number,
  phi: number,
  dec: number,
  n: number,
  M: number,
  L: number,
): number {
  const w = hourAngle(h, phi, dec)
  const a = approxTransit(w, lw, n)
  return solarTransitJ(a, M, L)
}

function localNoon(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const d = Number(date.slice(8, 10))
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function minutesOnClock(when: Date): number {
  return when.getHours() * 60 + when.getMinutes()
}

function pack(date: string, lat: number, lng: number, rise: Date, set: Date): DaySunTimes {
  const sunriseMinutes = minutesOnClock(rise)
  const sunsetMinutes = minutesOnClock(set)
  return {
    date,
    lat: roundSunCoord(lat),
    lng: roundSunCoord(lng),
    sunriseMinutes,
    sunsetMinutes,
    sunriseHhmm: hhmmFromMinutes(sunriseMinutes),
    sunsetHhmm: hhmmFromMinutes(sunsetMinutes),
    sunriseLabel: sunClockLabel(sunriseMinutes),
    sunsetLabel: sunClockLabel(sunsetMinutes),
  }
}

/**
 * Astronomical sunrise and sunset for `date` at `lat`/`lng`, in the
 * environment's local timezone. Pure: does not read a store or `new Date()`
 * except to build that calendar day's noon.
 */
export function computeDaySun(date: string, lat: number, lng: number): DaySunTimes | null {
  const noon = localNoon(date)
  if (!noon || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const lw = rad * -lng
  const phi = rad * lat
  const d = toDays(noon)
  const n = julianCycle(d, lw)
  const ds = approxTransit(0, lw, n)
  const M = solarMeanAnomaly(ds)
  const L = eclipticLongitude(M)
  const dec = declination(L, 0)
  const Jnoon = solarTransitJ(ds, M, L)
  const Jset = getSetJ(SUNSET_ANGLE, lw, phi, dec, n, M, L)
  const Jrise = Jnoon - (Jset - Jnoon)
  if (!Number.isFinite(Jrise) || !Number.isFinite(Jset)) return null

  return pack(date, lat, lng, fromJulian(Jrise), fromJulian(Jset))
}
