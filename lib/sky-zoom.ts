/**
 * lib/sky-zoom.ts — Magnifier for the heliocentric √r chart
 *
 * Positions stay in astronomical units from `solar-system.ts`. There is no
 * second ephemeris, no React, and no storage. Factor 1 is today's framing
 * (`√r × 34`, tilt `0.72` on a 520×400 glass). The motion bar's view width
 * is kilometres across 1,000 px. It is not this factor.
 *
 * Magnification, high to low: moon, inner, earth, system, stars, galaxy.
 * `ZOOM_STOPS` is the label list, and that list is not the magnification order.
 * `orbitFitFactor` keeps one orbit inside the glass. `bodyCloseFactor` is the
 * double-click close-up. `approachZoom` flies between two factors in log space.
 */

import { AU_KM } from "./sky-observe"
import { MOON_DISTANCE_KM } from "./solar-system"

/** Screen radius = √(au) × this × factor. Same scale the chart uses today. */
const CHART_SCALE = 34
/** Vertical squeeze after the radius is taken. */
const CHART_TILT = 0.72
const VIEW_W = 520
const VIEW_H = 400

/**
 * Largest un-tilted screen radius that stays on the glass.
 * Half the width is 260 px. Half the height, undone by the tilt, is ~278 px.
 * A round orbit meets the left and right edges first.
 */
const GLASS_RADIUS_PX = Math.min(VIEW_W / 2, VIEW_H / 2 / CHART_TILT)

/**
 * Clear pixels inside the viewBox. The limb stays on the glass, not on the clip.
 * Width still binds: 260 − margin against (200 − margin) / 0.72.
 */
const ORBIT_MARGIN_PX = 16

/** A close-up is at least this many times the orbit fit, when the Moon stop allows. */
const CLOSE_MIN_RATIO = 4

/** One wheel notch of 100 px (a typical WheelEvent pixel step) is this ratio. */
const WHEEL_RATIO = 1.12
const WHEEL_NOTCH_PX = 100

/**
 * Round semi-major axes. JPL's table is 0.387, 0.723, 1.000, 1.524.
 * The inner stop uses all four: the closest one meets the glass.
 */
const MERCURY_AU = 0.39
const VENUS_AU = 0.72
const EARTH_AU = 1
const MARS_AU = 1.52

/** Julian-year light travel: c = 299792.458 km/s × 365.25 days. */
const LIGHT_YEAR_AU = (299792.458 * 86400 * 365.25) / AU_KM
/** Proxima Centauri, about 4.24 ly ≈ 268000 AU. A log step past Neptune. */
const PROXIMA_AU = 4.24 * LIGHT_YEAR_AU
/** Milky Way radius as a labeled scale, about 50,000 ly. Not a star catalog. */
const GALAXY_RADIUS_AU = 50_000 * LIGHT_YEAR_AU

/** 384400 km ≈ 0.00257 AU. The Earth–Moon center gap. */
const MOON_GAP_AU = MOON_DISTANCE_KM / AU_KM

export const ZOOM_STOPS = ["inner", "earth", "moon", "system", "stars", "galaxy"] as const

export type ZoomStop = (typeof ZOOM_STOPS)[number]

/** Factor that places a heliocentric distance on the glass limb. */
function limbFactor(au: number): number {
  return GLASS_RADIUS_PX / (Math.sqrt(au) * CHART_SCALE)
}

/**
 * Mercury–Mars, large enough that they leave the Sun on this glass.
 * Limb factors fall as distance grows, so the max is Mercury: it sits on
 * the limb, and Venus, Earth, and Mars sit farther out.
 */
function innerFactor(): number {
  return Math.max(...[MERCURY_AU, VENUS_AU, EARTH_AU, MARS_AU].map(limbFactor))
}

/**
 * Factor at which a radial Earth–Moon offset, at 1 AU, spans the glass.
 * √r compresses a gap out at Earth's orbit, so this is much larger than
 * placing 0.00257 AU from the Sun on the limb. The pair can then fill the view.
 */
function moonFactor(): number {
  const radial = Math.sqrt(EARTH_AU + MOON_GAP_AU) - Math.sqrt(EARTH_AU)
  return GLASS_RADIUS_PX / (CHART_SCALE * radial)
}

const FACTOR: Record<ZoomStop, number> = {
  inner: innerFactor(),
  earth: limbFactor(EARTH_AU),
  moon: moonFactor(),
  system: 1,
  stars: limbFactor(PROXIMA_AU),
  galaxy: limbFactor(GALAXY_RADIUS_AU),
}

const CAPTION: Record<ZoomStop, string> = {
  inner: "Inner planets",
  earth: "Earth orbit",
  moon: "Earth and Moon",
  system: "Solar system",
  stars: "Nearest stars",
  galaxy: "Milky Way (scale stop, not a catalog)",
}

/** Multiplier on today's chart scale. `system` is 1. */
export function zoomFactor(stop: ZoomStop): number {
  return FACTOR[stop]
}

/** Clamp into the closed range from the galaxy stop to the Moon stop. */
export function clampZoom(factor: number): number {
  if (Number.isNaN(factor)) return FACTOR.system
  return Math.min(FACTOR.moon, Math.max(FACTOR.galaxy, factor))
}

/**
 * Wheel zoom. Positive `deltaY` (DOM wheel-down) zooms out.
 * One 100 px notch multiplies or divides by 1.12. The result is clamped.
 */
export function zoomByWheel(factor: number, deltaY: number): number {
  if (!Number.isFinite(factor) || !Number.isFinite(deltaY)) return clampZoom(factor)
  const notches = -deltaY / WHEEL_NOTCH_PX
  return clampZoom(factor * WHEEL_RATIO ** notches)
}

/** Nearest labeled stop in log(factor). Out-of-range values sit on the nearer end. */
export function nearestStop(factor: number): ZoomStop {
  const target = Math.log(clampZoom(factor))
  let best: ZoomStop = "system"
  let bestDistance = Infinity
  for (const stop of ZOOM_STOPS) {
    const distance = Math.abs(target - Math.log(FACTOR[stop]))
    if (distance < bestDistance) {
      bestDistance = distance
      best = stop
    }
  }
  return best
}

/** Short label. The galaxy line is a scale stop, not a rendered catalog. */
export function stopCaption(stop: ZoomStop): string {
  return CAPTION[stop]
}

/**
 * Project heliocentric AU onto the glass. At factor 1 this is today's map:
 * r = hypot(x, y), pr = √r × 34 × factor, then tilt y by 0.72.
 * `cx` and `cy` are the Sun's screen position.
 */
export function chartPoint(
  xAu: number,
  yAu: number,
  factor: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const r = Math.hypot(xAu, yAu)
  const ang = Math.atan2(yAu, xAu)
  const pr = Math.sqrt(r) * CHART_SCALE * factor
  return {
    x: cx + Math.cos(ang) * pr,
    y: cy + Math.sin(ang) * pr * CHART_TILT,
  }
}

/** Largest on-screen orbit radius that clears `ORBIT_MARGIN_PX` on every side. */
function orbitReachPx(): number {
  const halfW = VIEW_W / 2 - ORBIT_MARGIN_PX
  const halfH = (VIEW_H / 2 - ORBIT_MARGIN_PX) / CHART_TILT
  return Math.min(halfW, halfH)
}

/**
 * Largest factor that keeps a circular heliocentric orbit of radius `au`
 * inside the 520×400 glass. The map is `chartPoint` (√r × 34 × factor,
 * tilt 0.72, Sun at 260, 200). Mercury fits larger than Neptune; Earth
 * larger than Jupiter.
 */
export function orbitFitFactor(au: number): number {
  if (!(au > 0) || !Number.isFinite(au)) return FACTOR.moon
  return orbitReachPx() / (Math.sqrt(au) * CHART_SCALE)
}

/**
 * Double-click close-up of a body on that orbit.
 *
 * The framed patch is one Moon-gap at 1 AU, which is the Moon stop, so an
 * Earth–Moon pair can read. Inside Earth's orbit the patch stays one Moon-gap.
 * Farther out it grows with the square of the distance, so a giant comes in
 * past its orbit fit and stays short of the Moon stop. Clamped from the
 * galaxy stop to the Moon stop. When the orbit fit is already that stop,
 * the close-up stays there.
 */
export function bodyCloseFactor(orbitAu: number): number {
  if (!(orbitAu > 0) || !Number.isFinite(orbitAu)) return FACTOR.moon
  const fit = orbitFitFactor(orbitAu)
  const span = MOON_GAP_AU * Math.max(orbitAu, 1) ** 2
  const radial = Math.sqrt(orbitAu + span) - Math.sqrt(orbitAu)
  const framed = radial > 0 ? GLASS_RADIUS_PX / (CHART_SCALE * radial) : FACTOR.moon
  return clampZoom(Math.max(framed, fit * CLOSE_MIN_RATIO))
}

/** Smoothstep. Zero slope at 0 and at 1. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

/**
 * Flight from `from` to `to`. `t` is 0..1, eased in log(factor), so a trip
 * from the solar system (1) to the inner planets or the Moon stop is visible
 * the whole way. `t` ≤ 0 returns `from`. `t` ≥ 1 returns `to`.
 */
export function approachZoom(from: number, to: number, t: number): number {
  if (!Number.isFinite(t) || t <= 0) return from
  if (t >= 1) return to
  const eased = easeInOut(t)
  if (!(from > 0) || !(to > 0) || !Number.isFinite(from) || !Number.isFinite(to)) {
    return from + (to - from) * eased
  }
  return Math.exp(Math.log(from) + (Math.log(to) - Math.log(from)) * eased)
}
