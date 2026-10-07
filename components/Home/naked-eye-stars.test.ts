import { describe, expect, it } from "vitest"
import {
  NAKED_EYE_LIMIT,
  NAKED_EYE_STARS,
  ORRERY_SKY,
  SKY_STAR_DOTS,
  eclipticOf,
  projectDirection,
  skyStarDots,
  starFill,
  starRadius,
} from "./naked-eye-stars"

function channels(fill: string): [number, number, number] {
  const n = Number.parseInt(fill.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function starNamed(name: string) {
  const star = NAKED_EYE_STARS.find((row) => row.name === name)
  expect(star, name).toBeTruthy()
  return star!
}

describe("naked-eye catalog", () => {
  it("keeps every Hipparcos star of visual magnitude 3.50 or brighter", () => {
    expect(NAKED_EYE_STARS).toHaveLength(288)
    expect(NAKED_EYE_LIMIT).toBe(3.5)
    const hips = NAKED_EYE_STARS.map((star) => star.hip)
    expect(new Set(hips).size).toBe(hips.length)
    expect(hips).toEqual([...hips].sort((a, b) => a - b))
    for (const star of NAKED_EYE_STARS) {
      expect(star.mag).toBeLessThanOrEqual(3.5)
      expect(star.ra).toBeGreaterThanOrEqual(0)
      expect(star.ra).toBeLessThan(360)
      expect(star.dec).toBeGreaterThanOrEqual(-90)
      expect(star.dec).toBeLessThanOrEqual(90)
    }
    expect(NAKED_EYE_STARS.some((star) => star.mag === 3.5)).toBe(true)
    expect(Math.min(...NAKED_EYE_STARS.map((star) => star.mag))).toBe(-1.44)
    expect(starNamed("Sirius").hip).toBe(32349)
    expect(starNamed("Sirius").mag).toBe(-1.44)
  })
})

describe("ecliptic projection", () => {
  it("uses the chart's mean ecliptic of J2000", () => {
    const equinox = eclipticOf(0, 0)
    expect(equinox.lon).toBeCloseTo(0, 6)
    expect(equinox.lat).toBeCloseTo(0, 6)
    expect(Math.hypot(equinox.x, equinox.y, equinox.z)).toBeCloseTo(1, 6)

    const east = eclipticOf(90, 0)
    expect(east.lon).toBeCloseTo(90, 4)
    expect(east.lat).toBeCloseTo(-23.4392911, 4)

    const pole = eclipticOf(0, 90)
    expect(pole.lon).toBeCloseTo(90, 4)
    expect(pole.lat).toBeCloseTo(90 - 23.4392911, 4)
  })

  it("places known stars on that ecliptic", () => {
    const sirius = starNamed("Sirius")
    const siriusEcl = eclipticOf(sirius.ra, sirius.dec)
    expect(siriusEcl.lon).toBeCloseTo(104.08, 1)
    expect(siriusEcl.lat).toBeCloseTo(-39.61, 1)

    const regulus = eclipticOf(starNamed("Regulus").ra, starNamed("Regulus").dec)
    expect(regulus.lon).toBeCloseTo(149.83, 1)
    expect(Math.abs(regulus.lat)).toBeLessThan(1)

    const polaris = eclipticOf(starNamed("Polaris").ra, starNamed("Polaris").dec)
    expect(polaris.lat).toBeGreaterThan(65)
    expect(polaris.lat).toBeLessThan(67)
  })

  it("draws directions on the glass, outside the √r orbits", () => {
    const neptunePx = Math.sqrt(30) * 34
    expect(ORRERY_SKY.limb).toBeGreaterThan(neptunePx)
    expect(ORRERY_SKY.tilt).toBe(0.72)

    const equinox = projectDirection(eclipticOf(0, 0))
    expect(equinox.x).toBeCloseTo(ORRERY_SKY.cx + ORRERY_SKY.limb, 5)
    expect(equinox.y).toBeCloseTo(ORRERY_SKY.cy, 5)

    const lon90 = projectDirection({ x: 0, y: 1, z: 0 })
    expect(lon90.x).toBeCloseTo(ORRERY_SKY.cx, 5)
    expect(lon90.y).toBeCloseTo(ORRERY_SKY.cy + ORRERY_SKY.limb * ORRERY_SKY.tilt, 5)

    const north = projectDirection({ x: 0, y: 0, z: 1 })
    expect(north.x).toBeCloseTo(ORRERY_SKY.cx, 5)
    expect(north.y).toBeCloseTo(ORRERY_SKY.cy - ORRERY_SKY.north, 5)
  })

  it("keeps the field on the glass, brighter dots larger, A stars the chart blue", () => {
    expect(SKY_STAR_DOTS).toHaveLength(NAKED_EYE_STARS.length)
    for (const dot of SKY_STAR_DOTS) {
      expect(dot.x).toBeGreaterThan(0)
      expect(dot.x).toBeLessThan(ORRERY_SKY.w)
      expect(dot.y).toBeGreaterThan(0)
      expect(dot.y).toBeLessThan(ORRERY_SKY.h)
      expect(dot.r).toBeGreaterThanOrEqual(0.5)
      expect(dot.r).toBeLessThanOrEqual(1.35)
      expect(dot.fill).toMatch(/^#[0-9a-f]{6}$/)
    }

    const again = skyStarDots()
    expect(again.map((dot) => [dot.hip, dot.x, dot.y, dot.r, dot.fill])).toEqual(
      SKY_STAR_DOTS.map((dot) => [dot.hip, dot.x, dot.y, dot.r, dot.fill]),
    )

    expect(starRadius(-1.44)).toBeGreaterThan(starRadius(0.03))
    expect(starRadius(0.03)).toBeGreaterThan(starRadius(3.5))
    expect(starFill(0)).toBe("#cfe8ff")
    const hot = channels(starFill(-0.3))
    const cool = channels(starFill(1.5))
    expect(cool[0]).toBeGreaterThan(hot[0])
    expect(hot[2]).toBeGreaterThan(cool[2])

    const sirius = SKY_STAR_DOTS.find((dot) => dot.name === "Sirius")!
    const vega = SKY_STAR_DOTS.find((dot) => dot.name === "Vega")!
    const polaris = SKY_STAR_DOTS.find((dot) => dot.name === "Polaris")!
    expect(sirius.y).toBeGreaterThan(ORRERY_SKY.cy)
    expect(vega.y).toBeLessThan(ORRERY_SKY.cy)
    expect(sirius.r).toBeGreaterThan(vega.r)
    expect(Math.hypot(polaris.x - ORRERY_SKY.cx, polaris.y - ORRERY_SKY.cy)).toBeGreaterThan(20)
  })
})
