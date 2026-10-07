import { describe, expect, it } from "vitest"
import { GALAXY_DIAMETER_LY, SUN_GALACTIC_RADIUS_LY } from "./sky-galaxy"
import { AU_KM } from "./sky-observe"
import {
  OCEAN_BEACH,
  SCALE_CONTROLS,
  SCALE_DECADE_MS,
  SCALE_STOPS,
  SCALE_TOUR_MS,
  scaleCaptionFrame,
  scaleExponent,
  scaleGlyph,
  scaleMetres,
  scaleOnChart,
  scaleStopName,
  scaleZoomFactor,
  tourCaption,
  tourChartFactor,
  tourPlace,
} from "./sky-scale"
import { approachZoom, zoomFactor } from "./sky-zoom"
import { BODY_RADIUS_KM, MOON_DISTANCE_KM, MOON_RADIUS_KM, SUN_RADIUS_KM } from "./solar-system"

const LIGHT_YEAR_M = 299792.458 * 86400 * 365.25 * 1000
const AU_M = AU_KM * 1000

describe("powers of ten", () => {
  it("stops once on every decade from a proton to the observable universe", () => {
    expect(SCALE_STOPS).toHaveLength(43)
    expect(SCALE_STOPS.map(scaleExponent)).toEqual(Array.from({ length: 43 }, (_, i) => i - 16))
    expect(scaleExponent("proton")).toBe(-16)
    expect(scaleExponent("mouse")).toBe(-1)
    expect(scaleExponent("person")).toBe(0)
    expect(scaleExponent("seagull")).toBe(1)
    expect(scaleExponent("galaxy")).toBe(21)
    expect(scaleExponent("local-group")).toBe(23)
    expect(scaleExponent("universe")).toBe(26)
    expect(OCEAN_BEACH).toEqual({ latDeg: 32.75, lonDeg: -117.25 })
  })

  it("gives each object a real size in its decade", () => {
    const anchored = new Set(["seagull", "galaxy", "local-group"])
    for (const stop of SCALE_STOPS) {
      if (anchored.has(stop)) continue
      expect(Math.floor(Math.log10(scaleMetres(stop)))).toBe(scaleExponent(stop))
    }
    expect(scaleMetres("proton")).toBe(8.4e-16)
    expect(scaleMetres("mouse")).toBe(0.18)
    expect(scaleMetres("person")).toBe(1.7)
    expect(scaleMetres("seagull")).toBe(1.4)
    expect(scaleMetres("earth")).toBe(BODY_RADIUS_KM.earth * 2 * 1000)
    expect(scaleMetres("earth-moon")).toBe(MOON_DISTANCE_KM * 1000)
    expect(scaleMetres("sun")).toBe(SUN_RADIUS_KM * 2 * 1000)
    expect(scaleMetres("moon")).toBe(MOON_RADIUS_KM * 2 * 1000)
    expect(scaleMetres("earth-orbit")).toBe(AU_M)
    expect(scaleMetres("neptune")).toBe(30 * AU_M)
    expect(scaleMetres("proxima")).toBeCloseTo(4.24 * LIGHT_YEAR_M, 0)
    expect(scaleMetres("galaxy")).toBeCloseTo(GALAXY_DIAMETER_LY * LIGHT_YEAR_M, 0)
    expect(scaleMetres("galactic-center")).toBeCloseTo(SUN_GALACTIC_RADIUS_LY * LIGHT_YEAR_M, 0)
    expect(scaleStopName("mouse")).toBe("House mouse")
    expect(scaleStopName("seagull")).toBe("Western gull, Ocean Beach")
    expect(scaleStopName("galaxy")).toBe("Milky Way")
    expect(scaleStopName("universe")).toBe("Observable universe")
  })

  it("reuses chart factors inside the clamp and lifts the other decades outside it", () => {
    expect(scaleZoomFactor("earth-moon")).toBe(zoomFactor("moon"))
    expect(scaleZoomFactor("earth-orbit")).toBe(zoomFactor("earth"))
    expect(scaleZoomFactor("neptune")).toBe(1)
    expect(scaleZoomFactor("neptune")).toBe(zoomFactor("system"))
    expect(scaleZoomFactor("proxima")).toBe(zoomFactor("stars"))
    expect(scaleZoomFactor("galaxy")).toBe(zoomFactor("galaxy"))

    const sun = scaleZoomFactor("sun")
    expect(sun).toBeLessThan(zoomFactor("moon"))
    expect(sun).toBeGreaterThan(zoomFactor("earth"))

    const factors = SCALE_STOPS.map(scaleZoomFactor)
    for (let i = 1; i < factors.length; i++) expect(factors[i]).toBeLessThan(factors[i - 1])

    for (const stop of SCALE_STOPS) {
      const onChart = scaleExponent(stop) >= 8 && scaleExponent(stop) <= 21
      expect(scaleOnChart(stop)).toBe(onChart)
      expect(scaleCaptionFrame(stop)).toBe(!onChart)
    }
    expect(scaleZoomFactor("proton")).toBeGreaterThan(zoomFactor("moon"))
    expect(scaleZoomFactor("earth")).toBeGreaterThan(zoomFactor("moon"))
    expect(scaleZoomFactor("universe")).toBeLessThan(zoomFactor("galaxy"))
    expect(scaleGlyph("earth")).toBe("earth")
    expect(scaleGlyph("moon")).toBe("moon")
    expect(scaleGlyph("seagull")).toBe("gull")
    expect(scaleGlyph("mouse")).toBe("mouse")
    expect(scaleGlyph("galaxy")).toBeNull()
    expect(scaleGlyph("universe")).toBe("cosmos")
  })

  it("writes one original sentence per decade", () => {
    expect(tourCaption("proton")).toContain("0.84 fm")
    expect(tourCaption("mouse")).toContain("18 cm")
    expect(tourCaption("person")).toContain("1.7 m")
    expect(tourCaption("person")).toContain("32.75°N, 117.25°W")
    expect(tourCaption("seagull")).toMatch(/western gull/i)
    expect(tourCaption("seagull")).toContain("Ocean Beach")
    expect(tourCaption("seagull")).toContain("1.4 m")
    expect(tourCaption("seagull")).toContain("32.75°N, 117.25°W")
    expect(tourCaption("seagull")).toContain("not a map of the beach")
    expect(tourCaption("city")).toContain("50 km")
    expect(tourCaption("earth")).toContain(`${(BODY_RADIUS_KM.earth * 2).toLocaleString("en-US")} km`)
    expect(tourCaption("galaxy")).toContain("100,000 light years")
    expect(tourCaption("galaxy")).toContain("schematic")
    expect(tourCaption("local-group")).toContain("10 million light years")
    expect(tourCaption("universe")).toContain("46 billion light years")
    for (const stop of SCALE_STOPS) {
      const caption = tourCaption(stop)
      expect(caption.endsWith(".")).toBe(true)
      expect(caption.includes(". ")).toBe(false)
      expect(caption).not.toMatch(/Eames|Tallahassee|Boeke|Nikon/i)
    }
  })
})

describe("scale tour", () => {
  it("dwells about four seconds on each decade, proton first and the universe last", () => {
    expect(SCALE_DECADE_MS).toBe(4000)
    expect(SCALE_TOUR_MS).toBe(SCALE_STOPS.length * SCALE_DECADE_MS)
    expect(SCALE_CONTROLS).toEqual(["Pause", "Play", "Slower", "Faster", "Previous", "Next"])
    expect(tourPlace(0).stop).toBe("proton")
    expect(tourPlace(1).stop).toBe("universe")
    expect(tourPlace(Number.NaN).stop).toBe("proton")
    expect(tourPlace(1 / SCALE_STOPS.length).stop).toBe("carbon")
    for (let i = 0; i < SCALE_STOPS.length; i++) {
      expect(tourPlace(i / SCALE_STOPS.length).stop).toBe(SCALE_STOPS[i])
    }
    expect(tourChartFactor(0)).toBe(zoomFactor("moon"))
    expect(tourChartFactor(1)).toBe(zoomFactor("galaxy"))
  })

  it("eases with approachZoom inside the clamp and holds the clamp outside it", () => {
    const n = SCALE_STOPS.length
    const at = (stop: (typeof SCALE_STOPS)[number], blend = 0) =>
      (SCALE_STOPS.indexOf(stop) + blend) / n

    expect(tourPlace(at("earth")).stop).toBe("earth")
    expect(tourChartFactor(at("earth", 0.5))).toBe(zoomFactor("moon"))
    expect(tourChartFactor(at("earth-moon"))).toBe(zoomFactor("moon"))
    expect(tourChartFactor(at("earth-orbit"))).toBe(zoomFactor("earth"))
    expect(tourChartFactor(at("earth-orbit", 0.5))).toBeCloseTo(
      approachZoom(zoomFactor("earth"), zoomFactor("system"), 0.5),
      8,
    )
    expect(tourChartFactor(at("neptune"))).toBe(1)
    expect(tourChartFactor(at("neptune", 0.5))).toBeCloseTo(approachZoom(1, scaleZoomFactor("heliopause"), 0.5), 8)
    expect(tourChartFactor(at("proxima"))).toBe(zoomFactor("stars"))
    expect(tourChartFactor(at("galaxy", 0.5))).toBeCloseTo(zoomFactor("galaxy"), 8)
  })
})
