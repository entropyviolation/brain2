import { describe, it, expect } from "vitest"
import {
  mean,
  stddev,
  linearRegression,
  trend,
  rollingSlope,
  pearson,
  alignSeries,
  correlate,
  detectChangePoints,
  countContextSwitches,
  contextSwitchSeries,
  contextSwitchValueSeries,
  normalizeSeries,
  type SeriesPoint,
} from "@/lib/metrics"

const series = (...vals: [string, number][]): SeriesPoint[] => vals.map(([date, value]) => ({ date, value }))

describe("metrics — basic stats", () => {
  it("mean and stddev", () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(mean([])).toBe(0)
    expect(stddev([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3))
    expect(stddev([5])).toBe(0)
  })

  it("normalizeSeries drops bad dates/values and sorts chronologically", () => {
    const norm = normalizeSeries(
      series(["2026-06-03", 3], ["2026-06-01", 1], ["not-a-date", 9], ["2026-06-02", 2]),
    )
    expect(norm.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"])
  })
})

describe("metrics — trend / regression", () => {
  it("fits a perfect line", () => {
    const fit = linearRegression([0, 1, 2, 3], [1, 3, 5, 7])
    expect(fit.slope).toBeCloseTo(2)
    expect(fit.intercept).toBeCloseTo(1)
    expect(fit.r2).toBeCloseTo(1)
  })

  it("slope is per-day even with irregular gaps", () => {
    // +2 per day, but logged on days 0, 2, 5.
    const t = trend(series(["2026-06-01", 0], ["2026-06-03", 4], ["2026-06-06", 10]))
    expect(t.slope).toBeCloseTo(2)
    expect(t.direction).toBe("rising")
    expect(t.totalChange).toBeCloseTo(10) // 2/day over a 5-day span
  })

  it("reports falling and flat directions", () => {
    expect(trend(series(["2026-06-01", 10], ["2026-06-02", 8], ["2026-06-03", 6])).direction).toBe("falling")
    expect(trend(series(["2026-06-01", 5], ["2026-06-02", 5], ["2026-06-03", 5])).direction).toBe("flat")
  })

  it("degenerate inputs", () => {
    expect(trend([]).n).toBe(0)
    expect(trend(series(["2026-06-01", 7])).intercept).toBe(7)
  })

  it("rollingSlope emits one slope per window position", () => {
    const s = series(
      ["2026-06-01", 1],
      ["2026-06-02", 2],
      ["2026-06-03", 3],
      ["2026-06-04", 10],
      ["2026-06-05", 20],
    )
    const rs = rollingSlope(s, 3)
    expect(rs.length).toBe(3)
    expect(rs[0].slope).toBeCloseTo(1)
    expect(rs[2].slope).toBeGreaterThan(rs[0].slope)
  })

  it("rollingSlope is empty when fewer points than window", () => {
    expect(rollingSlope(series(["2026-06-01", 1], ["2026-06-02", 2]), 7)).toEqual([])
  })
})

describe("metrics — correlation", () => {
  it("pearson is +1 / -1 for linear relationships", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1)
  })

  it("pearson handles constants and tiny inputs", () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0)
    expect(pearson([1], [1])).toBe(0)
  })

  it("alignSeries inner-joins by date", () => {
    const a = series(["2026-06-01", 1], ["2026-06-02", 2], ["2026-06-04", 4])
    const b = series(["2026-06-02", 20], ["2026-06-03", 30], ["2026-06-04", 40])
    const aligned = alignSeries(a, b)
    expect(aligned.dates).toEqual(["2026-06-02", "2026-06-04"])
    expect(aligned.a).toEqual([2, 4])
    expect(aligned.b).toEqual([20, 40])
  })

  it("correlate summarizes strength + direction over overlap", () => {
    const a = series(["2026-06-01", 1], ["2026-06-02", 2], ["2026-06-03", 3], ["2026-06-04", 4])
    const b = series(["2026-06-01", 2], ["2026-06-02", 4], ["2026-06-03", 6], ["2026-06-04", 8])
    const r = correlate(a, b, { a: "Sleep", b: "Mood" })
    expect(r.n).toBe(4)
    expect(r.r).toBeCloseTo(1)
    expect(r.strength).toBe("strong")
    expect(r.direction).toBe("positive")
    expect(r.insight).toMatch(/Sleep/)
  })

  it("correlate reports insufficient overlap", () => {
    const r = correlate(series(["2026-06-01", 1]), series(["2026-06-02", 2]))
    expect(r.n).toBe(0)
    expect(r.insight).toMatch(/Not enough overlapping/)
  })
})

describe("metrics — change-point detection", () => {
  it("finds a clear level shift", () => {
    // Flat ~1 for six days, then jumps to ~10.
    const s = series(
      ["2026-06-01", 1],
      ["2026-06-02", 1],
      ["2026-06-03", 1],
      ["2026-06-04", 10],
      ["2026-06-05", 10],
      ["2026-06-06", 10],
    )
    const cps = detectChangePoints(s, { window: 3, threshold: 2 })
    expect(cps.length).toBe(1)
    expect(cps[0].date).toBe("2026-06-04")
    expect(cps[0].delta).toBeCloseTo(9)
  })

  it("returns nothing for stable data", () => {
    const s = series(
      ["2026-06-01", 5],
      ["2026-06-02", 5],
      ["2026-06-03", 5],
      ["2026-06-04", 5],
      ["2026-06-05", 5],
      ["2026-06-06", 5],
    )
    expect(detectChangePoints(s, { window: 2 })).toEqual([])
  })

  it("returns nothing when too few points", () => {
    expect(detectChangePoints(series(["2026-06-01", 1], ["2026-06-02", 9]), { window: 3 })).toEqual([])
  })
})

describe("metrics — context switches", () => {
  it("counts transitions, collapsing repeats and skipping empties", () => {
    expect(countContextSwitches(["A", "A", "B", "B", "A"])).toBe(2)
    expect(countContextSwitches(["A", null, "A"])).toBe(0)
    expect(countContextSwitches(["A", null, "B"])).toBe(1)
    expect(countContextSwitches([null, "", undefined])).toBe(0)
  })

  it("builds a per-day series with distinct + active counts", () => {
    const days = [
      { date: "2026-06-02", sequence: ["A", "B", "A"] },
      { date: "2026-06-01", sequence: ["A", "A", null] },
    ]
    const pts = contextSwitchSeries(days)
    expect(pts.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-02"])
    expect(pts[0]).toMatchObject({ switches: 0, distinct: 1, active: 2 })
    expect(pts[1]).toMatchObject({ switches: 2, distinct: 2, active: 3 })
  })

  it("contextSwitchValueSeries maps switches to a value series", () => {
    const pts = contextSwitchSeries([{ date: "2026-06-01", sequence: ["A", "B"] }])
    expect(contextSwitchValueSeries(pts)).toEqual([{ date: "2026-06-01", value: 1 }])
  })
})
