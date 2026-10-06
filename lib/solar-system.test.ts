import { describe, expect, it } from "vitest"
import {
  BODY_RADIUS_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
  earthMoonRadii,
  planetPlaces,
  systemBodyRadiusPx,
} from "./solar-system"

describe("solar system places", () => {
  it("puts Earth near longitude 100° at J2000 and keeps the planets in order", () => {
    const places = planetPlaces(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)))
    const earth = places.find((p) => p.id === "earth")!
    expect(earth.longitude).toBeGreaterThan(98)
    expect(earth.longitude).toBeLessThan(104)
    expect(earth.fromEarth).toBe(0)
    expect(places.map((p) => p.id)).toEqual([
      "mercury",
      "venus",
      "earth",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
    ])
    const mercury = places.find((p) => p.id === "mercury")!
    const neptune = places.find((p) => p.id === "neptune")!
    expect(mercury.au).toBeLessThan(0.5)
    expect(neptune.au).toBeGreaterThan(29)
    expect(neptune.fromEarth).toBeGreaterThan(28)
  })

  it("draws planets at true relative size, and the Moon under a pixel on the wide chart", () => {
    expect(systemBodyRadiusPx(BODY_RADIUS_KM.jupiter)).toBeCloseTo(16, 5)
    expect(systemBodyRadiusPx(BODY_RADIUS_KM.earth)).toBeGreaterThan(1)
    expect(systemBodyRadiusPx(BODY_RADIUS_KM.earth)).toBeLessThan(2)
    expect(systemBodyRadiusPx(MOON_RADIUS_KM)).toBeLessThan(0.5)
    expect(systemBodyRadiusPx(SUN_RADIUS_KM)).toBeGreaterThan(100)
    const pair = earthMoonRadii(440)
    expect(pair.earth / pair.moon).toBeCloseTo(BODY_RADIUS_KM.earth / MOON_RADIUS_KM, 5)
    expect(pair.moon).toBeLessThan(2.1)
    expect(pair.earth).toBeGreaterThan(pair.moon * 3)
  })
})
