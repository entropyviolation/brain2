import { describe, expect, it } from "vitest"
import { biggestMoves, projectRate, quadrantOf, quantile, rollingMean, runContinuation, runsOver, shareAtMost, type DayMark } from "./behavior-stats"

const marks = (s: string): ((k: string) => DayMark) => {
  const map: Record<string, DayMark> = { x: "met", p: "partial", ".": "missed", e: "exempt" }
  return (k) => map[s[Number(k)]]
}
const days = (n: number) => Array.from({ length: n }, (_, i) => String(i))

describe("runsOver", () => {
  it("splits on misses, bridges exempt days, marks the last run open", () => {
    const runs = runsOver(days(8), marks("xx.xexx."))
    expect(runs.map((r) => r.length)).toEqual([2, 3])
    expect(runs[1]).toMatchObject({ start: "3", end: "6", open: false })
    expect(runsOver(days(3), marks(".xx"))[0].open).toBe(true)
  })
  it("counts partial only when asked", () => {
    expect(runsOver(days(3), marks("xpx")).map((r) => r.length)).toEqual([1, 1])
    expect(runsOver(days(3), marks("xpx"), true).map((r) => r.length)).toEqual([3])
  })
})

describe("runContinuation", () => {
  it("treats open runs as censored", () => {
    const rows = runContinuation([
      { start: "a", end: "a", length: 1, open: false },
      { start: "b", end: "c", length: 2, open: false },
      { start: "d", end: "e", length: 2, open: true },
    ])
    expect(rows[0]).toMatchObject({ k: 1, atRisk: 3, broke: 1 })
    expect(rows[0].goOn).toBeCloseTo(2 / 3)
    expect(rows[1]).toMatchObject({ k: 2, atRisk: 2, broke: 1, goOn: 0 })
  })
})

describe("small stats", () => {
  it("quantile and CDF", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([], 0.5)).toBeNull()
    expect(shareAtMost([1, 2, 3, 4], 2)).toBe(0.5)
  })
  it("rolling mean", () => {
    expect(rollingMean([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7])
  })
  it("biggest moves", () => {
    const m = biggestMoves([0, 50, 20, 100], 1)
    expect(m.rises[0]).toEqual({ i: 3, delta: 80 })
    expect(m.falls[0]).toEqual({ i: 2, delta: -30 })
  })
  it("projects a rate and the perfect days to a target", () => {
    const p = projectRate(5, 10, 2, 1, 5, 0.8)
    expect(p.now).toBe(0.5)
    expect(p.projected).toBe(0.75)
    // (0.8·10 − 5) / (2 · 0.2) = 7.5 → 8 days
    expect(p.perfectDays).toBe(8)
  })
  it("quadrants", () => {
    expect(quadrantOf(1, 9, 5, 5)).toBe("quick-win")
    expect(quadrantOf(9, 9, 5, 5)).toBe("slow-reward")
    expect(quadrantOf(9, 1, 5, 5)).toBe("slow-small")
    expect(quadrantOf(1, 1, 5, 5)).toBe("fast-small")
  })
})
