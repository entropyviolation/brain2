import { describe, expect, it } from "vitest"
import { AU_KM } from "./sky-observe"
import { BODY_RADIUS_KM, SUN_RADIUS_KM, type PlanetId } from "./solar-system"
import { displayBodyRadiusPx, kmPerPxForOrbit, trueBodyRadiusPx } from "./sky-bodies"

const PLANETS: PlanetId[] = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
]

/** Factors the chart actually reaches, including Earth-orbit, inner, and the Moon stop. */
const FACTORS = [1, 7.2, 7.18, 12, 100, 6000]

describe("display disks", () => {
  it("keeps the Sun strictly larger than Jupiter at every chart factor", () => {
    for (const factor of FACTORS) {
      expect(displayBodyRadiusPx("sun", factor)).toBeGreaterThan(displayBodyRadiusPx("jupiter", factor))
    }
    for (let i = -4; i <= 6; i++) {
      const factor = 10 ** i
      expect(displayBodyRadiusPx("sun", factor)).toBeGreaterThan(displayBodyRadiusPx("jupiter", factor))
    }
  })

  it("draws the factor-1 Sun inside the 8.5–16 px band, clear of the inner orbits", () => {
    const sun = displayBodyRadiusPx("sun", 1)
    expect(sun).toBeGreaterThanOrEqual(8.5)
    expect(sun).toBeLessThanOrEqual(16)
    expect(sun).toBeCloseTo(12, 8)
  })

  it("exaggerates Mercury enough to see, and keeps true size order", () => {
    const mercury = displayBodyRadiusPx("mercury", 1)
    const sun = displayBodyRadiusPx("sun", 1)
    expect(mercury).toBeGreaterThan(1.5)
    expect(mercury / sun).toBeGreaterThan(BODY_RADIUS_KM.mercury / SUN_RADIUS_KM)
    const order = [...PLANETS].sort((a, b) => BODY_RADIUS_KM[a] - BODY_RADIUS_KM[b])
    for (let i = 1; i < order.length; i++) {
      expect(displayBodyRadiusPx(order[i]!, 1)).toBeGreaterThan(displayBodyRadiusPx(order[i - 1]!, 1))
    }
    expect(displayBodyRadiusPx("sun", 1)).toBeGreaterThan(displayBodyRadiusPx("jupiter", 1))
  })

  it("caps Jupiter instead of letting the disk grow with the zoom factor", () => {
    const atOne = displayBodyRadiusPx("jupiter", 1)
    const atEarth = displayBodyRadiusPx("jupiter", 7.18)
    const atHundred = displayBodyRadiusPx("jupiter", 100)
    const atMillion = displayBodyRadiusPx("jupiter", 1e6)
    expect(atEarth).toBeGreaterThan(atOne)
    expect(atHundred).toBeGreaterThan(atEarth)
    expect(atHundred).toBeLessThan(atOne * 4)
    expect(atMillion).toBeLessThan(atOne * 4)
    expect(atMillion / atHundred).toBeLessThan(1.05)
    expect(atEarth).toBeLessThan(atOne * 7.18)
    for (const id of PLANETS) {
      expect(displayBodyRadiusPx(id, 1e6)).toBeLessThan(displayBodyRadiusPx(id, 1) * 4)
    }
    for (const factor of [7.2, 12, 100, 6000]) {
      expect(displayBodyRadiusPx("jupiter", factor)).toBeLessThan(24)
      expect(displayBodyRadiusPx("jupiter", factor)).toBeLessThan(displayBodyRadiusPx("sun", factor) / 2)
    }
  })

  it("lets the Sun grow more gently than the zoom factor", () => {
    const atOne = displayBodyRadiusPx("sun", 1)
    const atEarth = displayBodyRadiusPx("sun", 7.18)
    const atHundred = displayBodyRadiusPx("sun", 100)
    expect(atEarth).toBeGreaterThan(atOne)
    expect(atHundred).toBeGreaterThan(atEarth)
    expect(atEarth / atOne).toBeLessThan(4)
    expect(atHundred / atOne).toBeLessThan(7.18)
    expect(atHundred).toBeLessThanOrEqual(64)
  })

  it("keeps the Sun a modest disk at inner zooms and caps the close-up", () => {
    for (const factor of [7.2, 12]) {
      const sun = displayBodyRadiusPx("sun", factor)
      expect(sun).toBeGreaterThanOrEqual(24)
      expect(sun).toBeLessThanOrEqual(48)
    }
    for (const factor of [100, 600, 6000]) {
      const sun = displayBodyRadiusPx("sun", factor)
      expect(sun).toBeGreaterThan(56)
      expect(sun).toBeLessThanOrEqual(64)
    }
    const capped = displayBodyRadiusPx("sun", 1e6)
    expect(capped).toBeGreaterThan(63)
    expect(capped).toBeLessThanOrEqual(64)
  })

  it("treats a bad zoom factor as the unscaled chart", () => {
    const sun = displayBodyRadiusPx("sun", 1)
    const jupiter = displayBodyRadiusPx("jupiter", 1)
    for (const factor of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(displayBodyRadiusPx("sun", factor)).toBeCloseTo(sun, 8)
      expect(displayBodyRadiusPx("jupiter", factor)).toBeCloseTo(jupiter, 8)
    }
  })
})

describe("true scale", () => {
  it("turns an on-screen orbit into kilometres per pixel", () => {
    expect(kmPerPxForOrbit(1, 34)).toBeCloseTo(AU_KM / 34, 6)
    expect(kmPerPxForOrbit(1, 244)).toBeCloseTo(149_597_870.7 / 244, 6)
    expect(kmPerPxForOrbit(5.2, 100)).toBeCloseTo((5.2 * AU_KM) / 100, 6)
    expect(AU_KM).toBe(149_597_870.7)
  })

  it("draws real radii with no exaggeration", () => {
    const kmPerPx = kmPerPxForOrbit(1, 244)
    const sun = trueBodyRadiusPx(SUN_RADIUS_KM, kmPerPx)
    const jupiter = trueBodyRadiusPx(BODY_RADIUS_KM.jupiter, kmPerPx)
    const mercury = trueBodyRadiusPx(BODY_RADIUS_KM.mercury, kmPerPx)
    expect(sun / jupiter).toBeCloseTo(SUN_RADIUS_KM / BODY_RADIUS_KM.jupiter, 8)
    expect(mercury / jupiter).toBeCloseTo(BODY_RADIUS_KM.mercury / BODY_RADIUS_KM.jupiter, 8)
    expect(sun).toBeGreaterThan(jupiter * 9)
    expect(sun).toBeCloseTo(SUN_RADIUS_KM / kmPerPx, 8)
  })

  it("returns 0 when the scale is not a positive length", () => {
    expect(trueBodyRadiusPx(SUN_RADIUS_KM, 0)).toBe(0)
    expect(trueBodyRadiusPx(-1, 10)).toBe(0)
    expect(kmPerPxForOrbit(1, 0)).toBe(0)
    expect(kmPerPxForOrbit(-1, 34)).toBe(0)
    expect(trueBodyRadiusPx(Number.NaN, 10)).toBe(0)
  })
})
