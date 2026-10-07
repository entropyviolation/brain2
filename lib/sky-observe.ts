/**
 * lib/sky-observe.ts — Light-time, angular size, elongation, magnitude
 *
 * Pure geometry on the heliocentric places from `solar-system.ts`.
 * No second orbit, no React, no storage. Not wired into the Moon chart:
 * `motionReadout` in `sky-motion.ts` remains the readout of view width and rate.
 */

import type { PlanetId, PlanetPlace } from "./solar-system"

/**
 * Seconds for light to travel one astronomical unit.
 * 1 AU ≈ 499 s ≈ 8.3 minutes.
 */
export const AU_LIGHT_SECONDS = 499

/** IAU astronomical unit, kilometres. Mixes a kilometre radius with an AU distance. */
export const AU_KM = 149_597_870.7

const RAD_TO_DEG = 180 / Math.PI

/** Heliocentric ecliptic coordinates, astronomical units. The Sun is the origin. */
export type HeliocentricAu = {
  x: number
  y: number
  z: number
}

/**
 * Visual magnitude at 1 AU from the Sun and 1 AU from the observer, phase 0,
 * plus Meeus's polynomial in the phase angle (degrees). Saturn's ring opening
 * is left out, so Saturn is the globe term only. These are not orbital elements.
 */
const VISUAL_MAGNITUDE: Record<
  Exclude<PlanetId, "earth">,
  { v10: number; phase: readonly number[] }
> = {
  mercury: { v10: -0.42, phase: [0.038, -0.000273, 0.000002] },
  venus: { v10: -4.4, phase: [0.0009, 0.000239, -0.00000065] },
  mars: { v10: -1.52, phase: [0.016] },
  jupiter: { v10: -9.4, phase: [0.005] },
  saturn: { v10: -8.88, phase: [0.044] },
  uranus: { v10: -7.19, phase: [] },
  neptune: { v10: -6.87, phase: [] },
}

function finitePoint(point: HeliocentricAu): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)
}

function angleDegrees(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const a = Math.hypot(ax, ay, az)
  const b = Math.hypot(bx, by, bz)
  if (a === 0 || b === 0) return Number.NaN
  const cos = (ax * bx + ay * by + az * bz) / (a * b)
  return Math.acos(Math.min(1, Math.max(-1, cos))) * RAD_TO_DEG
}

function phaseCorrection(phaseDeg: number, coeffs: readonly number[]): number {
  let power = phaseDeg
  let sum = 0
  for (const coeff of coeffs) {
    sum += coeff * power
    power *= phaseDeg
  }
  return sum
}

/** Light-travel time in seconds for a distance given in astronomical units. */
export function lightTimeSeconds(distanceAu: number): number {
  if (!Number.isFinite(distanceAu) || distanceAu < 0) return Number.NaN
  return distanceAu * AU_LIGHT_SECONDS
}

/** Light-travel time in minutes for a distance given in astronomical units. */
export function lightTimeMinutes(distanceAu: number): number {
  return lightTimeSeconds(distanceAu) / 60
}

/**
 * Full angular diameter in radians.
 * `radius` and `distance` are the same unit (both kilometres, or both AU).
 */
export function angularDiameterRadians(radius: number, distance: number): number {
  if (!Number.isFinite(radius) || !Number.isFinite(distance) || radius < 0 || distance <= 0) {
    return Number.NaN
  }
  return 2 * Math.atan(radius / distance)
}

/** Full angular diameter in degrees. Same unit rule as `angularDiameterRadians`. */
export function angularDiameterDegrees(radius: number, distance: number): number {
  return angularDiameterRadians(radius, distance) * RAD_TO_DEG
}

/** Full angular diameter in arcseconds. Same unit rule as `angularDiameterRadians`. */
export function angularDiameterArcseconds(radius: number, distance: number): number {
  return angularDiameterDegrees(radius, distance) * 3600
}

/**
 * Sun–observer–body angle in degrees (elongation).
 * Coordinates are heliocentric; the Sun is the origin.
 */
export function elongationDegrees(observer: HeliocentricAu, body: HeliocentricAu): number {
  if (!finitePoint(observer) || !finitePoint(body)) return Number.NaN
  return angleDegrees(
    -observer.x,
    -observer.y,
    -observer.z,
    body.x - observer.x,
    body.y - observer.y,
    body.z - observer.z,
  )
}

/**
 * Sun–body–observer angle in degrees (phase angle).
 * This is the angle the magnitude polynomial takes.
 */
export function phaseAngleDegrees(observer: HeliocentricAu, body: HeliocentricAu): number {
  if (!finitePoint(observer) || !finitePoint(body)) return Number.NaN
  return angleDegrees(
    -body.x,
    -body.y,
    -body.z,
    observer.x - body.x,
    observer.y - body.y,
    observer.z - body.z,
  )
}

/**
 * Apparent visual magnitude of a planet seen from `observer`.
 * Distances come from the places; Earth has no magnitude of itself.
 * Returns null when the body is Earth or the distance is zero.
 */
export function apparentMagnitude(body: PlanetPlace, observer: PlanetPlace): number | null {
  if (body.id === "earth") return null
  if (!finitePoint(body) || !finitePoint(observer)) return null
  const r = Math.hypot(body.x, body.y, body.z)
  const delta = Math.hypot(body.x - observer.x, body.y - observer.y, body.z - observer.z)
  if (r === 0 || delta === 0) return null
  const phase = phaseAngleDegrees(observer, body)
  if (!Number.isFinite(phase)) return null
  const row = VISUAL_MAGNITUDE[body.id]
  return row.v10 + 5 * Math.log10(r * delta) + phaseCorrection(phase, row.phase)
}
