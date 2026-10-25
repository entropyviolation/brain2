import { describe, expect, it } from "vitest"
import {
  ageBandIndex,
  bandVerdict,
  biasStats,
  doneRateByPushes,
  estimateBarcode,
  goalPace,
  pertSummary,
  quantile,
  ratioBySize,
} from "./accuracy-stats"

describe("accuracy-stats", () => {
  it("interpolates quantiles", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([], 0.5)).toBe(0)
  })

  it("classifies a ratio against the band", () => {
    expect(bandVerdict(1.05, 10)).toBe("on")
    expect(bandVerdict(1.3, 10)).toBe("over")
    expect(bandVerdict(1.3, 30)).toBe("on")
    expect(bandVerdict(0.5, 10)).toBe("under")
  })

  it("groups barcode cells in time order", () => {
    const rows = estimateBarcode(
      [
        { ratio: 2, completedAt: new Date(2026, 0, 2), g: "a" },
        { ratio: 1, completedAt: new Date(2026, 0, 1), g: "a" },
        { ratio: 1, completedAt: new Date(2026, 0, 1), g: "b" },
      ],
      (p) => p.g,
      10,
    )
    expect(rows[0].group).toBe("a")
    expect(rows[0].cells.map((c) => c.verdict)).toEqual(["on", "over"])
    expect(rows[0].on).toBe(1)
  })

  it("takes the geometric mean of ratios", () => {
    const s = biasStats([0.5, 2])
    expect(s.geoMeanRatio).toBeCloseTo(1)
    expect(s.n).toBe(2)
    expect(biasStats([]).n).toBe(0)
  })

  it("bins ratios by estimate size", () => {
    const bins = ratioBySize([
      { estimated: 10, ratio: 2 },
      { estimated: 240, ratio: 0.8 },
    ])
    expect(bins[0].median).toBe(2)
    expect(bins[1].median).toBeNull()
    expect(bins[3].median).toBe(0.8)
  })

  it("counts PERT hits", () => {
    expect(
      pertSummary([
        { optimistic: 10, likely: 20, pessimistic: 40, actual: 30 },
        { optimistic: 10, likely: 20, pessimistic: 40, actual: 50 },
      ]),
    ).toEqual({ n: 2, inside: 1, past: 1, early: 0 })
  })

  it("bands ages and push buckets", () => {
    expect(ageBandIndex(3)).toBe(0)
    expect(ageBandIndex(400)).toBe(3)
    const rates = doneRateByPushes([
      { daysPushed: 0, completed: true },
      { daysPushed: 8, completed: false },
      { daysPushed: 8, completed: true },
    ])
    expect(rates[0].rate).toBe(1)
    expect(rates[3].rate).toBe(0.5)
    expect(rates[1].rate).toBeNull()
  })

  it("measures goal pace against a straight line", () => {
    const pace = goalPace(
      { target: 10, current: 2, createdAt: new Date(2026, 0, 1), deadline: new Date(2026, 0, 11) },
      new Date(2026, 0, 6),
    )
    expect(pace.elapsed).toBeCloseTo(0.5)
    expect(pace.gap).toBeCloseTo(-0.3)
    expect(pace.daysLeft).toBe(5)
    expect(pace.neededPerDay).toBeCloseTo(1.6)
    expect(goalPace({ target: 5, current: 1, createdAt: new Date() }).gap).toBeNull()
    const yearly = goalPace(
      { target: 12, current: 6, createdAt: new Date(2025, 5, 1), periodKind: "year" },
      new Date(2026, 6, 2),
    )
    expect(yearly.elapsed).toBeCloseTo(0.5, 1)
    expect(yearly.daysLeft).toBe(183)
  })
})
