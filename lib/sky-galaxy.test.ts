import { describe, expect, it } from "vitest"
import {
  GALACTIC_EQUATOR,
  GALAXY_BULGE_THICKNESS_LY,
  GALAXY_DIAMETER_LY,
  GALAXY_DISK_THICKNESS_LY,
  GALAXY_GLASS,
  SUN_GALACTIC_RADIUS_LY,
  dustLanes,
  eclipticOfRaDec,
  galacticAscendingNode,
  galacticCenter,
  galacticCenterOnGlass,
  galacticEquator,
  galacticLatitude,
  galaxyBandAngle,
  galaxySchematicLayout,
  orionSpur,
  schematicToGlass,
  showGalaxySchematic,
  spiralArms,
  sunRadiusFraction,
} from "./sky-galaxy"

function nearest(points: readonly { x: number; y: number }[], at: { x: number; y: number }): number {
  let best = Infinity
  for (const point of points) best = Math.min(best, Math.hypot(point.x - at.x, point.y - at.y))
  return best
}

describe("milky way disk", () => {
  it("is a thin 100,000 ly disk with the Sun in the Orion spur", () => {
    expect(GALAXY_DIAMETER_LY).toBe(100_000)
    expect(GALAXY_DISK_THICKNESS_LY).toBe(1_000)
    expect(GALAXY_BULGE_THICKNESS_LY).toBeGreaterThan(GALAXY_DISK_THICKNESS_LY)
    expect(SUN_GALACTIC_RADIUS_LY).toBe(27_000)
    expect(sunRadiusFraction()).toBeCloseTo(0.54, 5)
    expect(sunRadiusFraction()).toBeGreaterThan(0.4)
    expect(sunRadiusFraction()).toBeLessThan(0.7)
  })
})

describe("galactic plane on the ecliptic", () => {
  it("tilts about 60.2° and crosses at the J2000 ascending node", () => {
    expect(galaxyBandAngle).toBeCloseTo(60.2, 1)
    expect(galacticAscendingNode).toBeCloseTo(270.02, 1)
    expect(galacticAscendingNode).toBeGreaterThan(180)
  })

  it("puts the galactic center toward Sagittarius, near the plane", () => {
    expect(galacticCenter.lon).toBeGreaterThan(255)
    expect(galacticCenter.lon).toBeLessThan(280)
    expect(Math.abs(galacticCenter.lat)).toBeLessThan(12)
    expect(Math.abs(galacticLatitude(266.405, -28.936172))).toBeLessThan(0.01)
  })

  it("threads the Hipparcos plane and leaves the high stars off it", () => {
    expect(Math.abs(galacticLatitude(310.358, 45.28))).toBeLessThan(3)
    expect(Math.abs(galacticLatitude(186.65, -63.099))).toBeLessThan(1)
    expect(Math.abs(galacticLatitude(279.235, 38.784))).toBeGreaterThan(15)
    expect(Math.abs(galacticLatitude(213.915, 19.182))).toBeGreaterThan(50)
  })
})

describe("band on the star glass", () => {
  it("draws a closed equator inside the glass", () => {
    expect(GALACTIC_EQUATOR.length).toBeGreaterThan(60)
    const first = GALACTIC_EQUATOR[0]
    const last = GALACTIC_EQUATOR[GALACTIC_EQUATOR.length - 1]
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1)
    for (const point of GALACTIC_EQUATOR) {
      expect(point.x).toBeGreaterThan(80)
      expect(point.x).toBeLessThan(440)
      expect(point.y).toBeGreaterThan(0)
      expect(point.y).toBeLessThan(400)
    }
  })

  it("passes the galactic center and the in-plane stars", () => {
    const center = galacticCenterOnGlass()
    expect(nearest(GALACTIC_EQUATOR, center)).toBeLessThan(8)
    const deneb = schematicPoint(310.358, 45.28)
    const acrux = schematicPoint(186.65, -63.099)
    expect(nearest(GALACTIC_EQUATOR, deneb)).toBeLessThan(14)
    expect(nearest(GALACTIC_EQUATOR, acrux)).toBeLessThan(8)
    expect(Math.abs(galacticLatitude(279.235, 38.784))).toBeGreaterThan(15)
  })

  it("samples the same curve at a coarser step", () => {
    const coarse = galacticEquator(36)
    expect(coarse).toHaveLength(37)
    expect(nearest(GALACTIC_EQUATOR, coarse[10])).toBeLessThan(2)
  })
})

describe("face-on schematic", () => {
  it("keeps the Sun at the chart center and the galactic center offset toward Sagittarius", () => {
    const layout = galaxySchematicLayout()
    expect(layout.sun).toEqual({ x: 260, y: 200 })
    expect(layout.radius).toBe(96)
    const gap = Math.hypot(layout.center.x - layout.sun.x, layout.center.y - layout.sun.y)
    expect(gap).toBeCloseTo(layout.sunFraction * layout.radius, 4)
    expect(layout.center.y).toBeLessThan(layout.sun.y)
    const sky = galacticCenterOnGlass()
    const along = (sky.x - layout.sun.x) * (layout.center.x - layout.sun.x) + (sky.y - layout.sun.y) * (layout.center.y - layout.sun.y)
    expect(along).toBeGreaterThan(0)
  })

  it("leaves a gap between the Sun and the major arms, with the spur beside it", () => {
    const sun = { x: sunRadiusFraction(), y: 0 }
    const arms = spiralArms()
    expect(arms).toHaveLength(4)
    expect(nearest(arms.flat(), sun)).toBeGreaterThan(0.05)
    expect(nearest(orionSpur(), sun)).toBeLessThan(0.06)
    expect(dustLanes()).toHaveLength(4)
    const dust = dustLanes()[0][40]
    const arm = arms[0][40]
    expect(Math.hypot(dust.x, dust.y)).toBeLessThan(Math.hypot(arm.x, arm.y))
  })

  it("places the labeled Sun on the glass at that radius", () => {
    const layout = galaxySchematicLayout()
    const sun = schematicToGlass({ x: sunRadiusFraction(), y: 0 }, layout)
    expect(sun.x).toBeCloseTo(layout.sun.x, 4)
    expect(sun.y).toBeCloseTo(layout.sun.y, 4)
    const rim = schematicToGlass({ x: 1, y: 0 }, layout)
    expect(Math.hypot(rim.x - layout.center.x, rim.y - layout.center.y)).toBeCloseTo(layout.radius, 4)
  })
})

describe("schematic hook", () => {
  it("opens for the galaxy zoom and the powers-of-ten Milky Way step", () => {
    expect(showGalaxySchematic("galaxy")).toBe(true)
    expect(showGalaxySchematic("stars")).toBe(false)
    expect(showGalaxySchematic("system")).toBe(false)
    expect(showGalaxySchematic(null)).toBe(false)
  })
})

function schematicPoint(ra: number, dec: number): { x: number; y: number } {
  const dir = eclipticOfRaDec(ra, dec)
  return {
    x: GALAXY_GLASS.cx + dir.x * GALAXY_GLASS.limb,
    y: GALAXY_GLASS.cy + dir.y * GALAXY_GLASS.limb * GALAXY_GLASS.tilt - dir.z * GALAXY_GLASS.north,
  }
}
