import { describe, expect, it } from "vitest"
import {
  advanceSimMillis,
  clampRateIndex,
  clampViewWidthLog,
  formatPixelsPerSecond,
  motionKind,
  motionReadout,
  pixelsPerSecond,
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
})
