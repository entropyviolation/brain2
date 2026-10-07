import { describe, expect, it } from "vitest"
import {
  BODY_RADIUS_KM,
  MOON_DISTANCE_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
  planetPlaces,
  type PlanetId,
  type PlanetPlace,
} from "./solar-system"
import {
  AU_KM,
  AU_LIGHT_SECONDS,
  angularDiameterArcseconds,
  angularDiameterDegrees,
  apparentMagnitude,
  elongationDegrees,
  lightTimeMinutes,
  lightTimeSeconds,
  phaseAngleDegrees,
} from "./sky-observe"

function place(id: PlanetId, x: number, y: number, z = 0): PlanetPlace {
  return {
    id,
    name: id,
    color: "#000",
    au: Math.hypot(x, y, z),
    longitude: 0,
    latitude: 0,
    x,
    y,
    z,
    fromEarth: 0,
  }
}

describe("light time", () => {
  it("crosses 1 AU in 499 seconds, about 8.3 minutes", () => {
    expect(AU_LIGHT_SECONDS).toBe(499)
    expect(lightTimeSeconds(1)).toBe(499)
    expect(lightTimeMinutes(1)).toBeCloseTo(8.317, 3)
    expect(Number(lightTimeMinutes(1).toFixed(1))).toBe(8.3)
  })

  it("puts Jupiter at 5.850 AU about 48.7 minutes away", () => {
    expect(lightTimeSeconds(5.85)).toBeCloseTo(5.85 * 499, 8)
    expect(lightTimeMinutes(5.85)).toBeCloseTo(48.6525, 4)
    expect(Number(lightTimeMinutes(5.85).toFixed(1))).toBe(48.7)
  })

  it("puts the Moon-scale distance about 1.3 seconds away", () => {
    // 384_400 km ≈ 0.00257 AU. Light takes a little over one second.
    const moonAu = MOON_DISTANCE_KM / AU_KM
    expect(lightTimeSeconds(moonAu)).toBeCloseTo(1.282, 3)
    expect(Number(lightTimeSeconds(moonAu).toFixed(1))).toBe(1.3)
  })

  it("puts Neptune-scale 30 AU about 4.2 hours away", () => {
    // Neptune orbits near 30 AU. 30 × 499 s ≈ 4.16 hours.
    expect(lightTimeSeconds(30) / 3600).toBeCloseTo(4.158, 3)
    expect(Number((lightTimeSeconds(30) / 3600).toFixed(1))).toBe(4.2)
  })

  it("refuses a distance that is not a length", () => {
    expect(lightTimeSeconds(-1)).toBeNaN()
    expect(lightTimeSeconds(Number.NaN)).toBeNaN()
  })
})

describe("angular diameter", () => {
  it("gives the Moon about half a degree", () => {
    expect(angularDiameterDegrees(MOON_RADIUS_KM, MOON_DISTANCE_KM)).toBeCloseTo(0.518, 3)
  })

  it("gives the Sun about half a degree at 1 AU", () => {
    expect(angularDiameterDegrees(SUN_RADIUS_KM, AU_KM)).toBeCloseTo(0.533, 3)
  })

  it("gives Jupiter about 33 arcseconds at 5.850 AU", () => {
    const arcsec = angularDiameterArcseconds(BODY_RADIUS_KM.jupiter, 5.85 * AU_KM)
    expect(arcsec).toBeCloseTo(32.95, 1)
  })

  it("refuses a distance of zero", () => {
    expect(angularDiameterDegrees(1, 0)).toBeNaN()
  })
})

describe("elongation and apparent magnitude", () => {
  it("reads opposition as 180° and quadrature as 90°", () => {
    const earth = place("earth", 1, 0, 0)
    expect(elongationDegrees(earth, place("jupiter", 5.2, 0, 0))).toBeCloseTo(180, 6)
    expect(elongationDegrees(earth, place("mercury", 0.4, 0, 0))).toBeCloseTo(0, 6)
    expect(elongationDegrees(earth, place("mars", 1, 1.5, 0))).toBeCloseTo(90, 6)
  })

  it("matches the Sun–Earth–planet angle of the existing places", () => {
    const places = planetPlaces(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)))
    const earth = places.find((p) => p.id === "earth")!
    const jupiter = places.find((p) => p.id === "jupiter")!
    const sunDistance = earth.au
    const planetDistance = jupiter.au
    const fromEarth = jupiter.fromEarth
    const cos =
      (sunDistance * sunDistance + fromEarth * fromEarth - planetDistance * planetDistance) /
      (2 * sunDistance * fromEarth)
    const expected = (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
    expect(elongationDegrees(earth, jupiter)).toBeCloseTo(expected, 6)
    expect(apparentMagnitude(earth, earth)).toBeNull()
    expect(apparentMagnitude(jupiter, earth)).toEqual(expect.any(Number))
  })

  it("gives Jupiter about −2.7 at a flat opposition", () => {
    const earth = place("earth", 1, 0, 0)
    const jupiter = place("jupiter", 5.2, 0, 0)
    expect(phaseAngleDegrees(earth, jupiter)).toBeCloseTo(0, 6)
    // V(1,0) = −9.40, phase 0, r = 5.2 AU, Δ = 4.2 AU.
    expect(apparentMagnitude(jupiter, earth)).toBeCloseTo(-2.704, 3)
  })

  it("includes Mercury's phase polynomial at 45°", () => {
    const earth = place("earth", 1, 0, 0)
    const mercury = place("mercury", 0, 1, 0)
    expect(phaseAngleDegrees(earth, mercury)).toBeCloseTo(45, 6)
    expect(elongationDegrees(earth, mercury)).toBeCloseTo(45, 6)
    expect(apparentMagnitude(mercury, earth)).toBeCloseTo(1.672, 3)
  })
})
