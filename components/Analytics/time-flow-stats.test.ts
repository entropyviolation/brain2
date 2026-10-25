import { describe, expect, it } from "vitest"
import {
  circularClock,
  debriefPoints,
  kindRhythms,
  operationNeglect,
  penFlows,
  returnLoops,
  switchDays,
  wakingRate,
  weekdayMeans,
} from "./time-flow-stats"

describe("time-flow-stats", () => {
  it("penFlows: net, exit bits and predictability", () => {
    const pens = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const cells = [
      { fromId: "a", toId: "b", count: 2, p: 0.5 },
      { fromId: "a", toId: "c", count: 2, p: 0.5 },
      { fromId: "b", toId: "a", count: 3, p: 1 },
    ]
    const [a, b, c] = penFlows(pens, cells)
    expect(a).toMatchObject({ outCount: 4, inCount: 3, net: -1, exitBits: 1, predictability: 0 })
    expect(b).toMatchObject({ exitBits: 0, predictability: 1 })
    expect(c).toMatchObject({ outCount: 0, inCount: 2, predictability: null })
  })

  it("switchDays lists days for one from → to pair", () => {
    const e = (id: string, date: string, penId: string, s: number) => ({ id, date, scopeId: "s", penId, startMin: s, endMin: s + 30 })
    const entries = [e("1", "2026-10-01", "a", 0), e("2", "2026-10-01", "b", 30), e("3", "2026-10-01", "a", 60), e("4", "2026-10-01", "b", 90), e("5", "2026-10-02", "b", 0), e("6", "2026-10-02", "a", 30)]
    expect(switchDays(entries, ["2026-10-01", "2026-10-02"], "s", "a", "b")).toEqual([{ date: "2026-10-01", count: 2 }])
  })

  it("returnLoops counts A→B→A per day", () => {
    const r = returnLoops([["a", "b", "a", "b"], ["a", "c", "d"]])
    expect(r.windows).toBe(3)
    expect(r.loops).toEqual([
      { aId: "a", bId: "b", count: 1 },
      { aId: "b", bId: "a", count: 1 },
    ])
    expect(r.rate).toBeCloseTo(2 / 3)
  })

  it("wakingRate wraps past midnight", () => {
    const hours = Array(24).fill(0)
    hours[23] = 2
    hours[0] = 2
    expect(wakingRate(hours, 2, 22, 2)).toEqual({ hours: 4, perHour: 0.5 })
    expect(wakingRate(hours, 1, 0, 0).hours).toBe(24)
  })

  it("weekdayMeans counts quiet days as 0", () => {
    const m = weekdayMeans(new Map([["2026-10-19", 4]]), ["2026-10-19", "2026-10-26", "2026-10-20"])
    expect(m[0]).toBe(2)
    expect(m[1]).toBe(0)
  })

  it("circularClock averages across midnight", () => {
    const c = circularClock([1420, 20])!
    expect(c.meanMin === 0 || c.meanMin === 1440).toBe(true)
    expect(c.r).toBeGreaterThan(0.99)
    expect(circularClock([])).toBeNull()
    expect(circularClock([0, 720])!.r).toBeLessThan(0.01)
  })

  it("kindRhythms keeps unknown clocks out of gaps and clocks", () => {
    const [row] = kindRhythms([
      { date: "2026-10-01", startMin: 480, kindKey: "coffee" },
      { date: "2026-10-01", startMin: 600, kindKey: "coffee", clockCertainty: "estimated" },
      { date: "2026-10-02", startMin: 0, kindKey: "coffee", clockCertainty: "unknown" },
    ])
    expect(row).toMatchObject({ count: 3, exact: 1, estimated: 1, unknown: 1, medianGapH: 2 })
    expect(row.clock?.meanMin).toBe(540)
  })

  it("debriefPoints needs both scores in 1–10", () => {
    const pts = debriefPoints([
      { id: "1", operationId: "o", ratings: { morale: 7, execution: 4 }, hoursLogged: 3 },
      { id: "2", operationId: "o", ratings: { morale: 7 } },
      { id: "3", operationId: "o", ratings: { morale: 11, execution: 4 } },
    ])
    expect(pts).toEqual([{ id: "1", operationId: "o", morale: 7, execution: 4, hours: 3 }])
  })

  it("operationNeglect sorts never-logged first, then longest quiet", () => {
    const rows = operationNeglect(
      [
        { id: "x", timeLogs: [{ date: "2026-10-20", durationMinutes: 30 }] },
        { id: "y", timeLogs: [{ date: "2026-10-01", durationMinutes: 10 }] },
        { id: "z" },
      ],
      new Set(["2026-10-20"]),
      "2026-10-23",
    )
    expect(rows.map((r) => r.id)).toEqual(["z", "y", "x"])
    expect(rows[2]).toMatchObject({ daysSince: 3, windowMin: 30 })
  })
})
