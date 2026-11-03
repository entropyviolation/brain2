import { describe, expect, it } from "vitest"
import {
  NAKED_EYE_BRIGHT_COUNT,
  NAKED_EYE_BRIGHT_LIMIT,
  NAKED_EYE_COUNT,
  NAKED_EYE_LIMIT,
  NAKED_EYE_STARS,
  ORRERY_SKY,
  SKY_STAR_DOTS,
  STAR_BY_HIP,
  STAR_NAMES_BY_HIP,
  colorIndex,
  eclipticLongitudeGap,
  eclipticOf,
  nearestNamedStars,
  projectDirection,
  skyStarDots,
  starCross,
  starFill,
  starLabel,
  starOpacity,
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
  it("keeps the bright 288 and extends the field to magnitude 5.00", () => {
    expect(NAKED_EYE_LIMIT).toBe(5)
    expect(NAKED_EYE_COUNT).toBe(1625)
    expect(NAKED_EYE_STARS).toHaveLength(1625)
    expect(NAKED_EYE_BRIGHT_LIMIT).toBe(3.5)
    expect(NAKED_EYE_BRIGHT_COUNT).toBe(288)

    const hips = NAKED_EYE_STARS.map((star) => star.hip)
    expect(new Set(hips).size).toBe(hips.length)
    expect(hips).toEqual([...hips].sort((a, b) => a - b))

    const bright = NAKED_EYE_STARS.filter((star) => star.mag <= 3.5)
    expect(bright).toHaveLength(288)
    let hipSum = 0
    let place = 0
    for (const star of NAKED_EYE_STARS) {
      expect(star.mag).toBeLessThanOrEqual(5)
      expect(star.ra).toBeGreaterThanOrEqual(0)
      expect(star.ra).toBeLessThan(360)
      expect(star.dec).toBeGreaterThanOrEqual(-90)
      expect(star.dec).toBeLessThanOrEqual(90)
      expect(STAR_BY_HIP.get(star.hip)).toBe(star)
      if (star.mag <= 3.5) {
        expect(star.bv).not.toBeNull()
        hipSum += star.hip
        place += Math.round(star.ra * 10000)
        place += Math.round(star.dec * 10000)
        place += Math.round(star.mag * 100)
        place += Math.round(star.bv! * 1000)
      }
    }
    expect(hipSum).toBe(16687426)
    expect(place).toBe(497893654)
    expect(NAKED_EYE_STARS.some((star) => star.mag > 3.5)).toBe(true)
    expect(NAKED_EYE_STARS.some((star) => star.mag === 5)).toBe(true)
    expect(Math.min(...NAKED_EYE_STARS.map((star) => star.mag))).toBe(-1.44)

    const sirius = starNamed("Sirius")
    expect(sirius.hip).toBe(32349)
    expect(sirius.mag).toBe(-1.44)
    expect(sirius.ra).toBe(101.2872)
    expect(sirius.dec).toBe(-16.7161)
    expect(sirius.bv).toBe(0.009)
  })

  it("looks proper names up by Hipparcos id", () => {
    expect(Object.keys(STAR_NAMES_BY_HIP)).toHaveLength(397)
    expect(STAR_NAMES_BY_HIP[32349]).toBe("Sirius")
    expect(STAR_NAMES_BY_HIP[27989]).toBe("Betelgeuse")
    expect(STAR_NAMES_BY_HIP[91262]).toBe("Vega")
    expect(STAR_NAMES_BY_HIP[11767]).toBe("Polaris")
    expect(STAR_BY_HIP.get(71683)?.name).toBe("Alpha Centauri")

    for (const [hip, name] of Object.entries(STAR_NAMES_BY_HIP)) {
      const star = STAR_BY_HIP.get(Number(hip))
      expect(star?.name).toBe(name)
      expect(name.length).toBeGreaterThan(0)
    }
    const named = NAKED_EYE_STARS.filter((star) => star.name)
    expect(named).toHaveLength(397)
    const blank = NAKED_EYE_STARS.find((star) => !star.name)
    expect(blank).toBeTruthy()
    expect(starLabel(blank!)).toMatch(new RegExp(`^HIP ${blank!.hip} · V `))

    const bare = STAR_BY_HIP.get(26220)!
    expect(bare.bv).toBeNull()
    expect(bare.spect).toBe("O7")
    expect(bare.name).toBe("")
    expect(starLabel(bare)).toBe("HIP 26220 · V 4.98 · O7")
    expect(starLabel(starNamed("Sirius"))).toContain("Sirius · V -1.44 · B−V 0.009")
    expect(starLabel(starNamed("Vega"))).toMatch(/^Vega · V /)
    expect(starLabel(starNamed("Polaris"))).toMatch(/B−V /)
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

  it("sizes and colors each star from its magnitude and B−V", () => {
    expect(SKY_STAR_DOTS).toHaveLength(NAKED_EYE_STARS.length)
    for (const dot of SKY_STAR_DOTS) {
      expect(dot.x).toBeGreaterThan(0)
      expect(dot.x).toBeLessThan(ORRERY_SKY.w)
      expect(dot.y).toBeGreaterThan(0)
      expect(dot.y).toBeLessThan(ORRERY_SKY.h)
      expect(dot.r).toBe(starRadius(dot.mag))
      expect(dot.opacity).toBe(starOpacity(dot.mag))
      expect(dot.cross).toBe(starCross(dot.mag))
      expect(dot.fill).toBe(starFill(colorIndex(dot.bv, dot.spect)))
      expect(dot.fill).toMatch(/^#[0-9a-f]{6}$/)
      expect(dot.label).toContain(`V ${dot.mag.toFixed(2)}`)
      if (dot.mag < 1) expect(dot.cross).toBeGreaterThan(dot.r)
      else expect(dot.cross).toBe(0)
    }

    const again = skyStarDots()
    expect(again.map((dot) => [dot.hip, dot.x, dot.y, dot.r, dot.fill, dot.label])).toEqual(
      SKY_STAR_DOTS.map((dot) => [dot.hip, dot.x, dot.y, dot.r, dot.fill, dot.label]),
    )

    expect(starRadius(-1.44)).toBeGreaterThan(starRadius(0))
    expect(starRadius(0)).toBeGreaterThan(starRadius(1))
    expect(starRadius(1)).toBeGreaterThan(starRadius(3.5))
    expect(starRadius(3.5)).toBeGreaterThan(starRadius(5))
    expect(starRadius(5)).toBeGreaterThanOrEqual(0.4)
    expect(starRadius(-1.44)).toBeLessThanOrEqual(2.5)
    expect(starOpacity(-1.44)).toBeGreaterThan(starOpacity(3.5))
    expect(starOpacity(3.5)).toBeGreaterThan(starOpacity(5))
    expect(starOpacity(5)).toBeGreaterThan(0.2)
    expect(starOpacity(-1.44)).toBeLessThanOrEqual(1)
    expect(starCross(0.98)).toBeGreaterThan(0)
    expect(starCross(1)).toBe(0)

    const spiked = SKY_STAR_DOTS.filter((dot) => dot.cross > 0)
    expect(spiked.length).toBeGreaterThan(8)
    expect(spiked.length).toBeLessThan(25)

    const hot = channels(starFill(-0.33))
    const white = channels(starFill(0))
    const warm = channels(starFill(0.65))
    const orange = channels(starFill(1.15))
    const red = channels(starFill(1.6))
    expect(starFill(0)).not.toBe("#cfe8ff")
    expect(hot[2]).toBeGreaterThan(hot[1])
    expect(hot[1]).toBeGreaterThan(hot[0])
    expect(hot[0]).toBeGreaterThan(140)
    expect(hot[2]).toBeGreaterThan(240)
    expect(Math.min(...white)).toBeGreaterThan(180)
    expect(Math.max(...white) - Math.min(...white)).toBeLessThan(80)
    expect(warm[0]).toBeGreaterThanOrEqual(warm[1])
    expect(warm[1]).toBeGreaterThan(warm[2])
    expect(warm[2]).toBeGreaterThan(180)
    expect(orange[0]).toBeGreaterThan(orange[1])
    expect(orange[1]).toBeGreaterThan(orange[2])
    expect(orange[2]).toBeLessThan(190)
    expect(red[0]).toBeGreaterThan(red[1])
    expect(red[1]).toBeGreaterThan(red[2])
    expect(red[1]).toBeLessThan(orange[1])
    expect(red[2]).toBeLessThan(orange[2])
    expect(red[2]).toBeLessThan(120)

    const fromClass = channels(starFill(colorIndex(null, "M2III")))
    const fromHotClass = channels(starFill(colorIndex(null, "O7")))
    expect(fromClass[0]).toBeGreaterThan(fromHotClass[0])
    expect(fromHotClass[2]).toBeGreaterThan(fromClass[2])
    expect(colorIndex(0.2, "M2III")).toBe(0.2)

    const sirius = SKY_STAR_DOTS.find((dot) => dot.name === "Sirius")!
    const siriusRow = starNamed("Sirius")
    expect(sirius.lon).toBeCloseTo(eclipticOf(siriusRow.ra, siriusRow.dec).lon, 6)
    const vega = SKY_STAR_DOTS.find((dot) => dot.name === "Vega")!
    const polaris = SKY_STAR_DOTS.find((dot) => dot.name === "Polaris")!
    expect(sirius.y).toBeGreaterThan(ORRERY_SKY.cy)
    expect(vega.y).toBeLessThan(ORRERY_SKY.cy)
    expect(sirius.r).toBeGreaterThan(vega.r)
    expect(sirius.cross).toBeGreaterThan(0)
    expect(Math.hypot(polaris.x - ORRERY_SKY.cx, polaris.y - ORRERY_SKY.cy)).toBeGreaterThan(20)
  })
})

describe("stars near a planet longitude", () => {
  it("measures near as the shortest ecliptic-longitude arc", () => {
    expect(eclipticLongitudeGap(0, 0)).toBe(0)
    expect(eclipticLongitudeGap(10, 350)).toBeCloseTo(20, 6)
    expect(eclipticLongitudeGap(359.5, 0.5)).toBeCloseTo(1, 6)
    expect(eclipticLongitudeGap(0, 180)).toBeCloseTo(180, 6)
    expect(eclipticLongitudeGap(400, -10)).toBeCloseTo(50, 6)

    const sirius = starNamed("Sirius")
    const lon = eclipticOf(sirius.ra, sirius.dec).lon
    const nearest = nearestNamedStars(lon)
    expect(nearest).toHaveLength(5)
    expect(nearest[0]).toMatchObject({ hip: sirius.hip, name: "Sirius" })
    expect(nearest[0].gap).toBeLessThan(1e-6)
    for (let i = 1; i < nearest.length; i++) {
      expect(nearest[i].name.length).toBeGreaterThan(0)
      expect(nearest[i].gap).toBeGreaterThanOrEqual(nearest[i - 1].gap)
      expect(nearest[i].gap).toBeLessThanOrEqual(180)
    }

    const all = nearestNamedStars(lon, 1000)
    expect(all).toHaveLength(397)
    expect(all.every((star) => star.name.length > 0)).toBe(true)
    expect(all.some((star) => star.hip === 26220)).toBe(false)
    expect(all[0].gap).toBeLessThanOrEqual(all[all.length - 1].gap)

    const opposite = nearestNamedStars(lon + 180, 1)
    expect(opposite[0].name).not.toBe("Sirius")
    expect(Number.isFinite(nearestNamedStars(Number.NaN).length)).toBe(true)
    expect(nearestNamedStars(Number.NaN)).toEqual([])
  })
})
