import { describe, expect, it } from "vitest"
import { acf, dailyMeans, fisherInterval, fitLine, intervalClearsZero, laggedCorrelation, rollingMean, summaryStats, whiteNoiseBand } from "./meta-math"

describe("meta-math", () => {
  it("fisherInterval brackets r and needs n ≥ 4", () => {
    expect(fisherInterval(0.5, 3)).toBeNull()
    const ci = fisherInterval(0.5, 30)!
    expect(ci.lo).toBeLessThan(0.5)
    expect(ci.hi).toBeGreaterThan(0.5)
    expect(ci.lo).toBeCloseTo(0.17, 1)
    expect(intervalClearsZero(0.5, 30)).toBe(true)
    expect(intervalClearsZero(0.2, 10)).toBe(false)
  })

  it("laggedCorrelation joins a(t) with b(t + lag)", () => {
    const days = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]
    const a = days.map((date, i) => ({ date, value: i }))
    const b = days.map((date, i) => ({ date, value: [5, 0, 1, 2, 3][i] }))
    const hit = laggedCorrelation(a, b, 1)
    expect(hit.n).toBe(4)
    expect(hit.r).toBeCloseTo(1, 6)
  })

  it("acf and the noise band", () => {
    const wave = Array.from({ length: 28 }, (_, i) => (i % 7 === 0 ? 10 : 0))
    const bars = acf(wave, 10)
    expect(bars[6].k).toBe(7)
    expect(bars[6].r).toBeGreaterThan(whiteNoiseBand(28))
  })

  it("rollingMean, summaryStats, fitLine", () => {
    expect(rollingMean([2, 4, 6], 2)).toEqual([2, 3, 5])
    expect(summaryStats([3, 1, 2])).toMatchObject({ n: 3, median: 2, min: 1, max: 3 })
    expect(summaryStats([])).toBeNull()
    expect(fitLine([0, 1, 2], [1, 3, 5])).toEqual({ slope: 2, intercept: 1 })
  })

  it("dailyMeans folds timestamps to one value per local day", () => {
    const keySet = new Set(["2026-02-03"])
    const out = dailyMeans(
      [
        { at: "2026-02-03T09:00:00", value: 40 },
        { at: "2026-02-03T21:00:00", value: 60 },
        { at: "2026-02-04T09:00:00", value: 90 },
        { at: "2026-02-03T10:00:00", value: undefined },
      ],
      keySet,
    )
    expect(out).toEqual([{ date: "2026-02-03", value: 50 }])
  })
})
