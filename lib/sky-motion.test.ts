import { describe, expect, it } from "vitest"
import { orbitSamples, planetPlaces } from "./solar-system"
import {
  advanceSimMillis,
  chartAnchorAfterWidget,
  chartClockAt,
  clampRateIndex,
  clampViewWidthLog,
  earthSpinDegrees,
  formatPixelsPerSecond,
  motionKind,
  motionReadout,
  pixelsPerSecond,
  SIDEREAL_DAY_SEC,
  stepChartClock,
  TIME_RATES,
  timeRateAt,
  viewWidthKm,
} from "./sky-motion"

describe("sky motion", () => {
  it("maps the time-rate slider from real time through one year per second", () => {
    expect(TIME_RATES.map((rate) => rate.label)).toEqual([
      "real time",
      "1 min per second",
      "1 hour per second",
      "1 day per second",
      "1 week per second",
      "1 month per second",
      "1 year per second",
    ])
    expect(timeRateAt(0)).toEqual({ seconds: 1, label: "real time" })
    expect(timeRateAt(2).seconds).toBe(3600)
    expect(timeRateAt(6).seconds).toBe(31557600)
    expect(clampRateIndex(-3)).toBe(0)
    expect(clampRateIndex(99)).toBe(6)
    expect(clampRateIndex("nope")).toBe(0)
  })

  it("treats view width as 10 to the power of the slider", () => {
    expect(viewWidthKm(3.5)).toBeCloseTo(3162.277, 2)
    expect(viewWidthKm(4.4)).toBeCloseTo(25118.86, 1)
    expect(clampViewWidthLog(0)).toBe(3)
    expect(clampViewWidthLog(12)).toBe(10)
    expect(clampViewWidthLog(4.43)).toBe(4.45)
    expect(clampViewWidthLog("nope")).toBe(3.5)
  })

  it("matches the 25,119 km real-time readout", () => {
    const readout = motionReadout(4.4, 0)
    expect(readout.viewWidthLabel).toBe("25,119 km")
    expect(readout.rateLabel).toBe("real time")
    expect(readout.scaleLabel).toBe("About 2.0 x Earth diameter")
    expect(readout.lightLabel).toBe("Light crosses this in 0.1 s")
    expect(readout.rows.map((row) => [row.name, row.speedLabel, row.pxLabel, row.motionLabel])).toEqual([
      ["Point on Earth equator", "0.465 km/s", "0.019 px/s", "frozen"],
      ["Moon around Earth", "1.022 km/s", "0.041 px/s", "frozen"],
      ["Neptune around Sun", "5.43 km/s", "0.22 px/s", "barely moving"],
      ["ISS around Earth", "7.66 km/s", "0.30 px/s", "barely moving"],
      ["Jupiter around Sun", "13.06 km/s", "0.52 px/s", "barely moving"],
      ["Voyager 1 vs Sun", "16.9 km/s", "0.67 px/s", "barely moving"],
      ["Earth around Sun", "29.78 km/s", "1.2 px/s", "visible motion"],
      ["Light", "299,792 km/s", "11,935 px/s", "too fast to follow"],
    ])
    expect(readout.visibleCount).toBe(1)
    expect(readout.summary).toBe(
      "1 of 8 objects show visible motion on a 1,000 px wide view at this zoom and rate.",
    )
  })

  it("speeds every row by the time rate and labels the bands", () => {
    const width = viewWidthKm(4.4)
    const earth = pixelsPerSecond(29.78, 60, width)
    expect(earth).toBeCloseTo(1.185 * 60, 1)
    expect(motionKind(0.049)).toBe("frozen")
    expect(motionKind(0.05)).toBe("barely")
    expect(motionKind(0.99)).toBe("barely")
    expect(motionKind(1)).toBe("visible")
    expect(motionKind(599)).toBe("visible")
    expect(motionKind(600)).toBe("fast")
    expect(formatPixelsPerSecond(11935)).toBe("11,935 px/s")
    const day = motionReadout(4.4, 3)
    expect(day.multiplier).toBe(86400)
    expect(day.rows.find((row) => row.id === "earth")!.kind).toBe("fast")
  })

  it("advances the chart clock by the rate, and caps a stalled frame at 0.1 s", () => {
    const start = Date.UTC(2026, 9, 6, 12, 0, 0)
    expect(advanceSimMillis(start, 0.05, 86400) - start).toBe(0.05 * 86400 * 1000)
    expect(advanceSimMillis(start, 1, 86400) - start).toBe(0.1 * 86400 * 1000)
    expect(advanceSimMillis(start, 2, 1) - start).toBe(100)
    expect(advanceSimMillis(start, -5, 3600)).toBe(start)
  })

  it("moves Jupiter through a long arc at one year per second and does not rewind", () => {
    const anchor = new Date(2026, 9, 6, 12, 0, 0, 0).getTime()
    const year = timeRateAt(6).seconds
    const startLon = longitudeAt(anchor, "jupiter")
    let clock = chartClockAt(anchor)
    const seen: number[] = []
    for (let frame = 0; frame < 40; frame++) {
      const widgetMs = anchor + frame * 60_000
      const held = chartAnchorAfterWidget(clock.anchorMs, widgetMs, true)
      expect(held.restarted).toBe(false)
      clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: year })
      seen.push(longitudeAt(clock.shownMs, "jupiter"))
    }
    const mid = seen[19]!
    const end = seen[39]!
    expect(separation(startLon, mid)).toBeGreaterThan(20)
    expect(separation(startLon, end)).toBeGreaterThan(separation(startLon, mid))
    expect(clock.anchorMs).toBe(anchor)
    expect(clock.shownMs - anchor).toBeGreaterThan(3 * 365.25 * 86400000)
    expect(nearestOrbitAu("jupiter", clock.shownMs)).toBeLessThan(0.08)
    expect(nearestOrbitAu("saturn", clock.shownMs)).toBeLessThan(0.15)
  })

  it("leaves a same-day widget tick alone, and restarts on a new widget day, Now, or real time", () => {
    const anchor = new Date(2026, 9, 6, 12, 0, 0, 0).getTime()
    const year = timeRateAt(6).seconds
    expect(chartAnchorAfterWidget(anchor, anchor + 60_000, true)).toEqual({ anchorMs: anchor, restarted: false })
    expect(chartAnchorAfterWidget(anchor, anchor + 60_000, false)).toEqual({ anchorMs: anchor, restarted: false })

    let clock = chartClockAt(anchor)
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: year })
    const moved = clock.shownMs
    const nextDay = new Date(2026, 9, 7, 12, 0, 0, 0).getTime()
    const day = chartAnchorAfterWidget(clock.anchorMs, nextDay, true)
    expect(day).toEqual({ anchorMs: nextDay, restarted: true })
    clock = stepChartClock(clock, { dtRealSec: 0, multiplier: year, restartAnchorMs: day.anchorMs })
    expect(clock.shownMs).toBe(nextDay)

    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: year })
    const picked = new Date(2001, 0, 1, 0, 0, 0, 0).getTime()
    clock = stepChartClock(clock, { dtRealSec: 0, multiplier: year, restartAnchorMs: picked })
    expect(clock.anchorMs).toBe(picked)
    expect(clock.shownMs).toBe(picked)

    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: year })
    expect(clock.shownMs).toBeGreaterThan(picked)
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: year, paused: true })
    const frozen = clock.shownMs
    expect(frozen).toBeGreaterThan(picked)
    clock = stepChartClock(clock, { dtRealSec: 0.5, multiplier: year, paused: true })
    expect(clock.shownMs).toBe(frozen)
    expect(clock.anchorMs).toBe(picked)

    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: 1 })
    expect(clock.anchorMs).toBe(picked)
    expect(clock.shownMs).toBe(picked)
    expect(moved).toBeGreaterThan(anchor)
  })

  it("runs the same clock backward, and pause holds either direction", () => {
    const anchor = new Date(2026, 9, 6, 12, 0, 0, 0).getTime()
    const day = timeRateAt(3).seconds
    let clock = chartClockAt(anchor)
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: day, direction: -1 })
    expect(clock.anchorMs).toBe(anchor)
    expect(clock.shownMs).toBeLessThan(anchor)
    const backed = clock.shownMs
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: day, direction: -1, paused: true })
    expect(clock.shownMs).toBe(backed)
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: day, direction: -1 })
    expect(clock.shownMs).toBeLessThan(backed)
    const beforeForward = clock.shownMs
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: day })
    expect(clock.shownMs).toBeGreaterThan(beforeForward)
    clock = stepChartClock(clock, { dtRealSec: 0.1, multiplier: 1 })
    expect(clock.shownMs).toBe(clock.anchorMs)
  })

  it("turns Earth once per sidereal day, including backward", () => {
    expect(SIDEREAL_DAY_SEC).toBe(86164.0905)
    expect(earthSpinDegrees(0)).toBe(0)
    expect(earthSpinDegrees(SIDEREAL_DAY_SEC * 1000)).toBeCloseTo(0, 6)
    expect(earthSpinDegrees(SIDEREAL_DAY_SEC * 500)).toBeCloseTo(180, 5)
    expect(earthSpinDegrees(-SIDEREAL_DAY_SEC * 250)).toBeCloseTo(270, 5)
    const later = earthSpinDegrees(SIDEREAL_DAY_SEC * 100)
    const earlier = earthSpinDegrees(SIDEREAL_DAY_SEC * 100 - SIDEREAL_DAY_SEC * 50)
    expect(later).toBeCloseTo(36, 5)
    expect(earlier).toBeCloseTo(18, 5)
  })
})

function longitudeAt(ms: number, id: "jupiter" | "saturn"): number {
  return planetPlaces(new Date(ms)).find((planet) => planet.id === id)!.longitude
}

function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function nearestOrbitAu(id: "jupiter" | "saturn", ms: number): number {
  const place = planetPlaces(new Date(ms)).find((planet) => planet.id === id)!
  const samples = orbitSamples(id, new Date(ms), 360)
  let best = Infinity
  for (const pt of samples) {
    const d = Math.hypot(pt.x - place.x, pt.y - place.y)
    if (d < best) best = d
  }
  return best
}
