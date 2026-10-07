/**
 * lib/sky-bodies.ts — Chart disks and true kilometres per pixel
 *
 * Readable radii for the heliocentric chart. Small worlds are exaggerated
 * so Mercury stays a visible disk. Planet disks saturate as the zoom factor
 * grows, and Jupiter stays well under the Sun. The Sun stays strictly larger
 * than Jupiter at every factor. At factor 1 it stays near 8.5–16 px so the
 * inner orbits stay clear. Earth-orbit and inner zooms keep it a modest
 * disk, about 24–48 px. A planet close-up caps it near 64 px.
 *
 * `trueBodyRadiusPx` is the real radius at a kilometres-per-pixel scale.
 * `kmPerPxForOrbit` builds that scale from an on-screen orbit. Pure: no
 * React, no storage, no second orbit. Radii come from `solar-system.ts`.
 */

import { AU_KM } from "./sky-observe"
import { BODY_RADIUS_KM, SUN_RADIUS_KM, type PlanetId } from "./solar-system"

/**
 * Sun radius at zoom factor 1. Midway in the 8.5–16 px chart sun, inside
 * Mercury's orbit on the unscaled √r map.
 */
const SUN_AT_ONE_PX = 12

/**
 * Power on (body radius / solar radius). 1 would be true scale: the Sun is
 * about ten Jupiters across and would cover the inner orbits. A lower power
 * keeps Mercury visible and the Sun a chart disk.
 */
const RADIUS_POWER = 0.32

/**
 * Planet disks approach this multiple of their factor-1 radius and stop.
 * The scale is 1 at factor 1. Jupiter's saturated disk stays well under
 * the Sun's close-up cap.
 */
const PLANET_DISK_CAP = 2.5

/**
 * Close-up Sun, in pixels. Earth-orbit and inner zooms stay a smaller disk.
 * The cap sits above Jupiter's saturated chart radius.
 */
const SUN_CAP_PX = 64

/** Non-finite or non-positive zoom is the unscaled chart. */
function finiteZoom(zoomFactor: number): number {
  if (!Number.isFinite(zoomFactor) || zoomFactor <= 0) return 1
  return zoomFactor
}

/** Compressed chart radius at factor 1. The Sun is `SUN_AT_ONE_PX`. */
function radiusAtFactorOne(radiusKm: number): number {
  return SUN_AT_ONE_PX * (radiusKm / SUN_RADIUS_KM) ** RADIUS_POWER
}

/**
 * Shared planet zoom. Factor 1 is 1. Below that, disks shrink with the
 * chart. Above it, the scale rises toward `PLANET_DISK_CAP` and never
 * passes it: `cap × z / (z + cap − 1)`.
 */
function planetDiskScale(zoom: number): number {
  if (zoom <= 1) return zoom
  return (PLANET_DISK_CAP * zoom) / (zoom + PLANET_DISK_CAP - 1)
}

/**
 * Sun disk. At factor 1 and below it shares the planet scale, so the
 * factor-1 order holds. Above factor 1 it rises toward `SUN_CAP_PX` and
 * never passes it: `cap × z / (z + cap / sunAtOne − 1)`.
 */
function sunDiskPx(zoom: number): number {
  const sunAtOne = radiusAtFactorOne(SUN_RADIUS_KM)
  if (zoom <= 1) return sunAtOne * planetDiskScale(zoom)
  return (SUN_CAP_PX * zoom) / (zoom + SUN_CAP_PX / sunAtOne - 1)
}

/**
 * Chart radius for the Sun or a planet.
 *
 * The Sun has its own cap so an inner-planet zoom stays a modest disk and a
 * close-up does not fill the glass. Planets share `planetDiskScale`. Both
 * paths keep the Sun strictly larger than Jupiter.
 */
export function displayBodyRadiusPx(id: "sun" | PlanetId, zoomFactor: number): number {
  const zoom = finiteZoom(zoomFactor)
  if (id === "sun") return sunDiskPx(zoom)
  return radiusAtFactorOne(BODY_RADIUS_KM[id]) * planetDiskScale(zoom)
}

/** Real radius in pixels. No exaggeration. */
export function trueBodyRadiusPx(radiusKm: number, kmPerPx: number): number {
  if (!(radiusKm >= 0) || !(kmPerPx > 0) || !Number.isFinite(radiusKm) || !Number.isFinite(kmPerPx)) {
    return 0
  }
  return radiusKm / kmPerPx
}

/**
 * Kilometres per pixel for an orbit drawn at `orbitRadiusPx`.
 * 1 AU = 149597870.7 km.
 */
export function kmPerPxForOrbit(orbitAu: number, orbitRadiusPx: number): number {
  if (!(orbitAu >= 0) || !(orbitRadiusPx > 0) || !Number.isFinite(orbitAu) || !Number.isFinite(orbitRadiusPx)) {
    return 0
  }
  return (orbitAu * AU_KM) / orbitRadiusPx
}
