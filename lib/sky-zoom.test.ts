import { describe, expect, it } from "vitest"
import { AU_KM } from "./sky-observe"
import { MOON_DISTANCE_KM } from "./solar-system"
import {
  ZOOM_STOPS,
  approachZoom,
  bodyCloseFactor,
  chartPoint,
  clampZoom,
  nearestStop,
  orbitFitFactor,
  stopCaption,
  zoomByWheel,
  zoomFactor,
  type ZoomStop,
} from "./sky-zoom"

/** Same glass the chart uses: 520×400, scale 34, tilt 0.72. Sides bind first. */
const GLASS = Math.min(520 / 2, 400 / 2 / 0.72)
const SCALE = 34

const MERCURY_AU = 0.39
const VENUS_AU = 0.72
const EARTH_AU = 1
const MARS_AU = 1.52

function limbFactor(au: number): number {
  return GLASS / (Math.sqrt(au) * SCALE)
}

function screenRadius(au: number, factor: number): number {
  return Math.sqrt(au) * SCALE * factor
}

describe("zoom stops", () => {
  it("lists the labels, then magnifies moon, inner, earth, system, stars, galaxy", () => {
    expect(ZOOM_STOPS).toEqual(["inner", "earth", "moon", "system", "stars", "galaxy"])
    expect(zoomFactor("system")).toBe(1)

    const order: ZoomStop[] = ["moon", "inner", "earth", "system", "stars", "galaxy"]
    const factors = order.map(zoomFactor)
    expect(factors.every((factor) => Number.isFinite(factor) && factor > 0)).toBe(true)
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeLessThan(factors[i - 1])
    }
  })

  it("puts Mercury on the limb so Mercury through Mars leave the Sun", () => {
    const factor = zoomFactor("inner")
    expect(factor).toBeCloseTo(limbFactor(MERCURY_AU), 10)
    expect(screenRadius(MERCURY_AU, factor)).toBeCloseTo(GLASS, 8)

    const radii = [MERCURY_AU, VENUS_AU, EARTH_AU, MARS_AU].map((au) => screenRadius(au, factor))
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i] - radii[i - 1]).toBeGreaterThan(40)
    }
    expect(radii[0]).toBeGreaterThan(screenRadius(MERCURY_AU, 1) * 10)
  })

  it("frames 1 AU on the limb", () => {
    expect(zoomFactor("earth")).toBeCloseTo(limbFactor(1), 10)
    expect(screenRadius(1, zoomFactor("earth"))).toBeCloseTo(GLASS, 8)
    expect(zoomFactor("earth")).toBeCloseTo(260 / 34, 10)
  })

  it("frames the Earth–Moon gap at 1 AU so the pair can fill the glass", () => {
    const moonAu = MOON_DISTANCE_KM / AU_KM
    expect(moonAu).toBeCloseTo(0.00257, 5)
    const radial = Math.sqrt(1 + moonAu) - 1
    const factor = zoomFactor("moon")
    expect(factor).toBeCloseTo(GLASS / (SCALE * radial), 8)
    expect(SCALE * factor * radial).toBeCloseTo(GLASS, 6)
    expect(factor).toBeGreaterThan(limbFactor(moonAu))
  })

  it("frames Proxima, then the Milky Way radius, as zoom-out stops", () => {
    const lightYearAu = (299792.458 * 86400 * 365.25) / AU_KM
    const proximaAu = 4.24 * lightYearAu
    expect(proximaAu).toBeCloseTo(268000, -3)
    expect(zoomFactor("stars")).toBeCloseTo(limbFactor(proximaAu), 8)
    expect(screenRadius(proximaAu, zoomFactor("stars"))).toBeCloseTo(GLASS, 6)

    const galaxyAu = 50_000 * lightYearAu
    expect(zoomFactor("galaxy")).toBeCloseTo(limbFactor(galaxyAu), 8)
    expect(zoomFactor("galaxy")).toBeLessThan(zoomFactor("stars"))
    expect(zoomFactor("stars")).toBeLessThan(1)
  })

  it("names each stop, and calls the galaxy line a scale stop", () => {
    expect(stopCaption("inner")).toBe("Inner planets")
    expect(stopCaption("earth")).toBe("Earth orbit")
    expect(stopCaption("moon")).toBe("Earth and Moon")
    expect(stopCaption("system")).toBe("Solar system")
    expect(stopCaption("stars")).toBe("Nearest stars")
    expect(stopCaption("galaxy")).toBe("Milky Way (scale stop, not a catalog)")
  })
})

describe("clamp, wheel, and nearest stop", () => {
  it("clamps between the galaxy factor and the Moon factor", () => {
    expect(clampZoom(zoomFactor("galaxy"))).toBe(zoomFactor("galaxy"))
    expect(clampZoom(zoomFactor("moon"))).toBe(zoomFactor("moon"))
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0)).toBe(zoomFactor("galaxy"))
    expect(clampZoom(-4)).toBe(zoomFactor("galaxy"))
    expect(clampZoom(1e12)).toBe(zoomFactor("moon"))
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(zoomFactor("moon"))
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(zoomFactor("galaxy"))
    expect(clampZoom(Number.NaN)).toBe(1)
  })

  it("changes one wheel notch by 1.12× and clamps", () => {
    expect(zoomByWheel(1, -100)).toBeCloseTo(1.12, 10)
    expect(zoomByWheel(1, 100)).toBeCloseTo(1 / 1.12, 10)
    expect(zoomByWheel(1, -200)).toBeCloseTo(1.12 ** 2, 10)
    expect(zoomByWheel(1, 0)).toBe(1)
    expect(zoomByWheel(zoomFactor("moon"), -100)).toBe(zoomFactor("moon"))
    expect(zoomByWheel(zoomFactor("galaxy"), 100)).toBe(zoomFactor("galaxy"))
    expect(zoomByWheel(Number.NaN, -100)).toBe(1)
    expect(zoomByWheel(1, Number.NaN)).toBe(1)
  })

  it("picks the log-nearest stop, and the ends outside the range", () => {
    for (const stop of ZOOM_STOPS) {
      expect(nearestStop(zoomFactor(stop))).toBe(stop)
    }
    const earth = zoomFactor("earth")
    const midway = Math.sqrt(earth * zoomFactor("system"))
    expect(nearestStop(midway)).toBe("earth")
    expect(nearestStop(1e9)).toBe("moon")
    expect(nearestStop(1e-12)).toBe("galaxy")
    expect(nearestStop(Number.NaN)).toBe("system")
  })
})

describe("chart point", () => {
  it("matches today's map at factor 1", () => {
    expect(chartPoint(1, 0, 1, 260, 200)).toEqual({ x: 294, y: 200 })
    expect(chartPoint(0, 1, 1, 260, 200)).toEqual({ x: 260, y: 200 + 34 * 0.72 })
    expect(chartPoint(0, 0, 1, 260, 200)).toEqual({ x: 260, y: 200 })

    const pr = Math.sqrt(5) * 34
    const ang = Math.atan2(4, 3)
    expect(chartPoint(3, 4, 1, 260, 200)).toEqual({
      x: 260 + Math.cos(ang) * pr,
      y: 200 + Math.sin(ang) * pr * 0.72,
    })
  })

  it("multiplies the screen radius by the factor", () => {
    const once = chartPoint(1, 0, 1, 10, 20)
    const twice = chartPoint(1, 0, 2, 10, 20)
    expect(twice.x - 10).toBeCloseTo((once.x - 10) * 2, 10)
    expect(twice.y).toBe(20)
  })
})

const SUN = { x: 260, y: 200 }
const VIEW = { w: 520, h: 400 }

describe("orbit fit", () => {
  it("zooms Mercury past Neptune, and Earth past Jupiter", () => {
    expect(orbitFitFactor(0.39)).toBeGreaterThan(orbitFitFactor(30))
    expect(orbitFitFactor(1)).toBeGreaterThan(orbitFitFactor(5.2))
    expect(orbitFitFactor(0.39)).toBeGreaterThan(orbitFitFactor(1))
    expect(orbitFitFactor(5.2)).toBeGreaterThan(orbitFitFactor(30))
  })

  it("lands (au, 0) inside the viewBox with a small margin, and keeps the orbit on the glass", () => {
    for (const au of [0.39, 1, 5.2, 30]) {
      const factor = orbitFitFactor(au)
      const right = chartPoint(au, 0, factor, SUN.x, SUN.y)
      const margin = VIEW.w - right.x
      expect(right.y).toBeCloseTo(SUN.y, 8)
      expect(margin).toBeGreaterThan(8)
      expect(margin).toBeLessThan(32)

      for (const turn of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const p = chartPoint(au * Math.cos(turn), au * Math.sin(turn), factor, SUN.x, SUN.y)
        expect(p.x).toBeGreaterThan(8)
        expect(p.x).toBeLessThan(VIEW.w - 8)
        expect(p.y).toBeGreaterThan(8)
        expect(p.y).toBeLessThan(VIEW.h - 8)
      }

      const clipped = chartPoint(au, 0, factor * 1.2, SUN.x, SUN.y)
      expect(clipped.x).toBeGreaterThan(VIEW.w)
    }
  })
})

describe("body close-up", () => {
  it("puts Earth on the Moon stop, and a giant between its orbit fit and that stop", () => {
    const moon = zoomFactor("moon")
    expect(bodyCloseFactor(1)).toBe(moon)
    expect(bodyCloseFactor(1)).toBeGreaterThan(1000)
    expect(bodyCloseFactor(1)).toBeGreaterThan(orbitFitFactor(1) * 100)

    for (const au of [5.2, 30]) {
      const close = bodyCloseFactor(au)
      const fit = orbitFitFactor(au)
      expect(close).toBeGreaterThan(fit * 10)
      expect(close).toBeLessThan(moon)
      expect(close).toBe(clampZoom(close))
    }
    expect(bodyCloseFactor(5.2)).toBeLessThan(moon / 4)
    expect(bodyCloseFactor(30)).toBeLessThan(bodyCloseFactor(5.2))
  })

  it("stays above the orbit fit and inside the clamp for the eight distances", () => {
    for (const au of [0.39, 0.72, 1, 1.52, 5.2, 9.5, 19.2, 30]) {
      const close = bodyCloseFactor(au)
      expect(close).toBeGreaterThan(orbitFitFactor(au))
      expect(close).toBe(clampZoom(close))
    }
  })
})

describe("approach zoom", () => {
  it("eases in log space from the system to the inner planets and the Moon", () => {
    const inner = zoomFactor("inner")
    const moon = zoomFactor("moon")
    expect(approachZoom(1, inner, 0)).toBe(1)
    expect(approachZoom(1, inner, 1)).toBe(inner)
    expect(approachZoom(1, moon, 0)).toBe(1)
    expect(approachZoom(1, moon, 1)).toBe(moon)
    expect(approachZoom(1, moon, -0.2)).toBe(1)
    expect(approachZoom(1, moon, 1.4)).toBe(moon)

    for (const target of [inner, moon]) {
      const mid = approachZoom(1, target, 0.5)
      expect(mid).toBeCloseTo(Math.sqrt(target), 8)
      expect(mid).toBeGreaterThan(2)
      expect(mid).toBeLessThan(target)

      const logs = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.log(approachZoom(1, target, t)))
      const steps = [logs[1] - logs[0], logs[2] - logs[1], logs[3] - logs[2], logs[4] - logs[3]]
      expect(steps[1]).toBeGreaterThan(steps[0])
      expect(steps[2]).toBeGreaterThan(steps[3])
      expect(steps[0]).toBeCloseTo(steps[3], 8)

      let previous = 0
      for (let i = 1; i <= 8; i++) {
        const next = approachZoom(1, target, i / 8)
        expect(next).toBeGreaterThan(previous)
        previous = next
      }
    }
  })
})
