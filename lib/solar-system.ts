/**
 * lib/solar-system.ts — Heliocentric places of the eight planets
 *
 * Keplerian elements from the JPL approximate-position table (epoch J2000,
 * valid across the years this app is used). The frame is the mean ecliptic
 * of J2000. Good to a fraction of a degree for a chart, not a spacecraft.
 */

export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"

export type PlanetPlace = {
  id: PlanetId
  name: string
  /** Heliocentric distance, AU. */
  au: number
  /** Ecliptic longitude, degrees 0–360. */
  longitude: number
  /** Ecliptic latitude, degrees. */
  latitude: number
  /** Heliocentric ecliptic coordinates, AU. */
  x: number
  y: number
  z: number
  /** Distance from Earth, AU. Earth is 0. */
  fromEarth: number
  color: string
}

type Element = {
  id: PlanetId
  name: string
  color: string
  /** a, e, I, L, varpi, node — value then rate per century. */
  a: [number, number]
  e: [number, number]
  I: [number, number]
  L: [number, number]
  w: [number, number]
  N: [number, number]
  /** Extra mean-anomaly terms for the outer planets: b, c, s, f. */
  extra?: { b: number; c: number; s: number; f: number }
}

const PLANETS: Element[] = [
  { id: "mercury", name: "Mercury", color: "#d9d0c4", a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], w: [77.45779628, 0.16047689], N: [48.33076593, -0.12534081] },
  { id: "venus", name: "Venus", color: "#e7d7a4", a: [0.72333566, 0.0000039], e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889], L: [181.9790995, 58517.81538729], w: [131.60246718, 0.00268329], N: [76.67984255, -0.27769418] },
  { id: "earth", name: "Earth", color: "#7ec8e3", a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], N: [0, 0] },
  { id: "mars", name: "Mars", color: "#d4724a", a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882], I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], w: [-23.94362959, 0.44441088], N: [49.55953891, -0.29257343] },
  { id: "jupiter", name: "Jupiter", color: "#e0b56a", a: [5.202887, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], w: [14.72847983, 0.21252668], N: [100.47390909, 0.20469106], extra: { b: -0.00012452, c: 0.0606406, s: -0.35635438, f: 38.35125 } },
  { id: "saturn", name: "Saturn", color: "#ecd3a1", a: [9.53667594, -0.0012506], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609], L: [49.95424423, 1222.49362201], w: [92.59887831, -0.41897216], N: [113.66242448, -0.28867794], extra: { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125 } },
  { id: "uranus", name: "Uranus", color: "#8fd4cf", a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], w: [170.9542763, 0.40805281], N: [74.01692503, 0.04240589], extra: { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025 } },
  { id: "neptune", name: "Neptune", color: "#5b7fd6", a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], w: [44.96476227, -0.32241464], N: [131.78422574, -0.00508664], extra: { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025 } },
]

const DEG = Math.PI / 180
const J2000 = 2451545.0

function wrap360(deg: number): number {
  const x = deg % 360
  return x < 0 ? x + 360 : x
}

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5
}

function eccentricAnomaly(mean: number, e: number): number {
  let E = mean
  for (let i = 0; i < 12; i++) {
    const d = E - e * Math.sin(E) - mean
    E -= d / (1 - e * Math.cos(E))
  }
  return E
}

function placeOf(el: Element, T: number): Omit<PlanetPlace, "fromEarth"> {
  const a = el.a[0] + el.a[1] * T
  const e = el.e[0] + el.e[1] * T
  const I = (el.I[0] + el.I[1] * T) * DEG
  const node = (el.N[0] + el.N[1] * T) * DEG
  const varpi = (el.w[0] + el.w[1] * T) * DEG
  let L = el.L[0] + el.L[1] * T
  let M = (L - (el.w[0] + el.w[1] * T)) * DEG
  if (el.extra) {
    const fT = el.extra.f * T
    M += (el.extra.b * T * T + el.extra.c * Math.cos(fT) + el.extra.s * Math.sin(fT)) * DEG
  }
  M = Math.atan2(Math.sin(M), Math.cos(M))
  const E = eccentricAnomaly(M, e)
  const xv = a * (Math.cos(E) - e)
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const v = Math.atan2(yv, xv)
  const r = Math.hypot(xv, yv)
  const arg = varpi - node + v
  const x = r * (Math.cos(node) * Math.cos(arg) - Math.sin(node) * Math.sin(arg) * Math.cos(I))
  const y = r * (Math.sin(node) * Math.cos(arg) + Math.cos(node) * Math.sin(arg) * Math.cos(I))
  const z = r * Math.sin(arg) * Math.sin(I)
  const au = Math.hypot(x, y, z)
  return {
    id: el.id,
    name: el.name,
    color: el.color,
    au,
    longitude: wrap360(Math.atan2(y, x) / DEG),
    latitude: Math.atan2(z, Math.hypot(x, y)) / DEG,
    x,
    y,
    z,
  }
}

/** Eight planets, Mercury through Neptune, Earth included. */
export function planetPlaces(date: Date): PlanetPlace[] {
  const T = (julianDay(date) - J2000) / 36525
  const raw = PLANETS.map((el) => placeOf(el, T))
  const earth = raw.find((p) => p.id === "earth")!
  return raw.map((p) => ({
    ...p,
    fromEarth: p.id === "earth" ? 0 : Math.hypot(p.x - earth.x, p.y - earth.y, p.z - earth.z),
  }))
}

/** Sample one orbit in the ecliptic, AU. `steps` points, closed by the caller. */
export function orbitSamples(id: PlanetId, date: Date, steps = 90): { x: number; y: number }[] {
  const el = PLANETS.find((p) => p.id === id)!
  const T = (julianDay(date) - J2000) / 36525
  const a = el.a[0] + el.a[1] * T
  const e = el.e[0] + el.e[1] * T
  const I = (el.I[0] + el.I[1] * T) * DEG
  const node = (el.N[0] + el.N[1] * T) * DEG
  const varpi = (el.w[0] + el.w[1] * T) * DEG
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const E = (i / steps) * Math.PI * 2
    const xv = a * (Math.cos(E) - e)
    const yv = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E)
    const v = Math.atan2(yv, xv)
    const r = Math.hypot(xv, yv)
    const arg = varpi - node + v
    pts.push({
      x: r * (Math.cos(node) * Math.cos(arg) - Math.sin(node) * Math.sin(arg) * Math.cos(I)),
      y: r * (Math.sin(node) * Math.cos(arg) + Math.cos(node) * Math.sin(arg) * Math.cos(I)),
    })
  }
  return pts
}

/** Mean body radii, kilometres. */
export const BODY_RADIUS_KM: Record<PlanetId, number> = {
  mercury: 2439.7,
  venus: 6051.8,
  earth: 6371,
  mars: 3389.5,
  jupiter: 69911,
  saturn: 58232,
  uranus: 25362,
  neptune: 24622,
}

export const MOON_RADIUS_KM = 1737.4
export const MOON_DISTANCE_KM = 384400
export const SUN_RADIUS_KM = 695700

/** Wide-chart Jupiter radius. Every other body uses the same kilometres per pixel. */
export const SYSTEM_JUPITER_PX = 16

export function systemBodyRadiusPx(km: number): number {
  return (SYSTEM_JUPITER_PX * km) / BODY_RADIUS_KM.jupiter
}

/** Earth and Moon radii when the gap between their centers is `separationPx`. */
export function earthMoonRadii(separationPx: number): { earth: number; moon: number } {
  return {
    earth: (separationPx * BODY_RADIUS_KM.earth) / MOON_DISTANCE_KM,
    moon: (separationPx * MOON_RADIUS_KM) / MOON_DISTANCE_KM,
  }
}

/** Saturn's rings, in units of Saturn's mean radius. Inner is the C ring, outer the A ring. */
export const SATURN_RING = { inner: 74658 / 58232, outer: 136775 / 58232 }

export function formatAu(au: number): string {
  if (au >= 10) return `${au.toFixed(2)} AU`
  return `${au.toFixed(3)} AU`
}

export function formatDeg(deg: number): string {
  const sign = deg < 0 ? "−" : ""
  return `${sign}${Math.abs(deg).toFixed(1)}°`
}
