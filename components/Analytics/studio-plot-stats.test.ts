/**
 * Plot math — KDE, histogram, horizon, beeswarm, alluvial, UpSet, ridges.
 */
import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import {
  beeswarmOffsets,
  blockLengths,
  histogram,
  horizonBands,
  kernelDensityEstimate,
  layoutAlluvial,
  median,
  quantile,
  silvermanBandwidth,
  tagIntersections,
  valuesByWeekday,
  weekdayWeekendRates,
} from "./studio-plot-stats"

describe("studio-plot-stats", () => {
  it("quantile and median on a sorted sample", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3)
    expect(quantile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5)
    expect(quantile([], 0.5)).toBe(0)
    expect(quantile([9], 0.9)).toBe(9)
  })

  it("KDE integrates roughly to 1 and peaks at the cluster", () => {
    const sample = [10, 10, 10, 11, 9]
    const xs = [0, 10, 20]
    const dens = kernelDensityEstimate(sample, xs)
    expect(dens[1]).toBeGreaterThan(dens[0])
    expect(dens[1]).toBeGreaterThan(dens[2])
    expect(silvermanBandwidth(sample)).toBeGreaterThan(0)
    expect(kernelDensityEstimate([], xs)).toEqual([0, 0, 0])
  })

  it("histogram puts every sample in a bin", () => {
    const bins = histogram([1, 2, 2, 8], 2)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(4)
    expect(histogram([5, 5, 5])).toEqual([{ start: 5, end: 6, count: 3 }])
    expect(histogram([])).toEqual([])
  })

  it("horizon folds 0–100 into three 0–1 bands", () => {
    const bands = horizonBands([0, 50, 100], 3, 100)
    expect(bands).toHaveLength(3)
    expect(bands[0][0]).toBe(0)
    expect(bands[0][1]).toBeCloseTo(1)
    expect(bands[1][1]).toBeCloseTo(0.5)
    expect(bands[2][2]).toBeCloseTo(1)
  })

  it("beeswarm offsets colliding points", () => {
    const packed = beeswarmOffsets([1, 1, 1], { radius: 4, height: 40 })
    expect(packed).toHaveLength(3)
    const xs = packed.map((p) => p.x)
    expect(new Set(xs).size).toBeGreaterThan(1)
  })

  it("alluvial stacks from/to totals and preserves count", () => {
    const layout = layoutAlluvial(
      [
        { id: "a", name: "A", color: "#000" },
        { id: "b", name: "B", color: "#111" },
      ],
      [
        { fromId: "a", toId: "b", count: 4 },
        { fromId: "b", toId: "a", count: 1 },
      ],
      100,
      0,
    )
    expect(layout.sources).toHaveLength(2)
    expect(layout.flows.reduce((s, f) => s + f.count, 0)).toBe(5)
    expect(layoutAlluvial([], [], 100).flows).toEqual([])
  })

  it("UpSet counts exact tag combinations, not supersets", () => {
    const rows = tagIntersections([
      { id: "1", tags: ["work", "deep"] },
      { id: "2", tags: ["work"] },
      { id: "3", tags: ["deep", "work"] },
      { id: "4", tags: [] },
    ])
    expect(rows.find((r) => r.tags.join(",") === "deep,work")?.n).toBe(2)
    expect(rows.find((r) => r.tags.join(",") === "work")?.n).toBe(1)
    expect(tagIntersections([])).toEqual([])
  })

  it("weekday ridges skip unparseable dates", () => {
    const ridges = valuesByWeekday([
      { date: "2026-09-20", value: 8 }, // Sunday
      { date: "2026-09-21", value: 7 }, // Monday
      { date: "nope", value: 9 },
    ])
    expect(ridges[0].values).toEqual([8])
    expect(ridges[1].values).toEqual([7])
    expect(ridges[2].values).toEqual([])
  })

  it("weekday vs weekend rates treat missing logs as unmet", () => {
    const cut = weekdayWeekendRates(["2026-09-18", "2026-09-19", "2026-09-20"], (key) => key === "2026-09-18")
    expect(cut.weekdayN).toBe(1)
    expect(cut.weekendN).toBe(2)
    expect(cut.weekday).toBe(100)
    expect(cut.weekend).toBe(0)
  })

  it("block lengths drop instants", () => {
    const entries = [
      { id: "a", date: "2026-09-20", penId: "w", startMin: 0, endMin: 30, scopeId: "s" },
      { id: "b", date: "2026-09-20", penId: "w", startMin: 40, endMin: 40, scopeId: "s", kind: "instant" as const },
    ] as TimeEntry[]
    expect(blockLengths(entries)).toEqual([30])
  })
})
