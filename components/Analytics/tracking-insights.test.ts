import { describe, expect, it } from "vitest"
import { comparePenMinutes } from "./period-delta"
import { dayEdges, lengthStats, mirrorRows, paceOf, sizedSquares, squareSide } from "./tracking-insights"

const pen = (id: string, minutes: number) => ({ id, name: id, color: "#000", minutes })

describe("tracking-insights", () => {
  it("sizes squares per day against the one-day anchor", () => {
    const squares = sizedSquares([pen("a", 1440), pen("b", 4320), pen("z", 0)], 3, "day")
    expect(squares.map((s) => s.id)).toEqual(["b", "a"])
    expect(squares[0].days).toBe(1)
    expect(squareSide(4, 10)).toBe(20)
  })

  it("turns a window total into a pace", () => {
    const pace = paceOf(7 * 60, 7, 16, 10)
    expect(pace.perDay).toBe(60)
    expect(pace.perWeek).toBe(420)
    expect(pace.awakeShare).toBeCloseTo(60 / 960)
    expect(pace.horizonAwakeYears).toBeCloseTo(10 * (60 / 960))
  })

  it("filters, sorts and limits mirror rows", () => {
    const rows = comparePenMinutes([pen("Work", 100), pen("Walk", 30)], [pen("Work", 40), pen("Read", 90)])
    expect(mirrorRows(rows, { sort: "delta", limit: 2, query: "" }).map((r) => r.id)).toEqual(["Read", "Work"])
    expect(mirrorRows(rows, { sort: "name", limit: 9, query: "w" }).map((r) => r.id)).toEqual(["Walk", "Work"])
  })

  it("cuts block lengths at a threshold", () => {
    const stats = lengthStats([10, 20, 30, 90, 0], 30)
    expect(stats.n).toBe(4)
    expect(stats.median).toBe(25)
    expect(stats.longCount).toBe(2)
    expect(stats.longMinuteShare).toBeCloseTo(120 / 150)
  })

  it("finds day edges from lasting blocks only", () => {
    const edges = dayEdges(
      [
        { date: "d1", startMin: 480, endMin: 600 },
        { date: "d1", startMin: 1200, endMin: 1300 },
        { date: "d2", startMin: 600, endMin: 700 },
        { date: "d2", startMin: 300, endMin: 300, kind: "instant" },
        { date: "out", startMin: 0, endMin: 10 },
      ],
      ["d1", "d2"],
    )
    expect(edges.days).toBe(2)
    expect(edges.earliestFirst).toBe(480)
    expect(edges.latestLast).toBe(1300)
    expect(edges.medianSpan).toBe((820 + 100) / 2)
  })
})
