import { describe, expect, it } from "vitest"
import { formatTickerChange, formatTickerDelta, pointsTicker, type TickerEntry } from "./points-ticker"

// Wednesday 14 Oct 2026; its week starts Monday 12 Oct.
const asOf = new Date(2026, 9, 14, 15, 0)

const entries: TickerEntry[] = [
  { date: "2026-10-14", points: 3 },
  { date: "2026-10-14", points: 1.5 },
  { date: "2026-10-13", points: 2 },
  { date: "2026-10-12", points: 4 }, // Monday: this week
  { date: "2026-10-11", points: 5 }, // Sunday: last week
  { date: "2026-10-05", points: 1 }, // last week's Monday
  { date: "2026-09-20", points: 10 },
  { date: "2026-08-01", points: 7 },
]

describe("pointsTicker", () => {
  it("compares today with yesterday over a 14-day chart", () => {
    const t = pointsTicker(entries, "day", asOf)
    expect(t.value).toBe(4.5)
    expect(t.previous).toBe(2)
    expect(t.delta).toBe(2.5)
    expect(t.changePct).toBe(125)
    expect(t.direction).toBe("up")
    expect(t.series).toHaveLength(14)
    expect(t.series.at(-1)).toBe(4.5)
  })

  it("weeks start Monday, like the points store", () => {
    const t = pointsTicker(entries, "week", asOf)
    expect(t.value).toBe(10.5) // Mon 4 + Tue 2 + Wed 4.5
    expect(t.previous).toBe(6) // Mon 5 Oct 1 + Sun 11 Oct 5
    expect(t.series).toHaveLength(12)
  })

  it("compares this month with last month", () => {
    const t = pointsTicker(entries, "month", asOf)
    expect(t.value).toBe(16.5)
    expect(t.previous).toBe(10)
    expect(t.series).toHaveLength(12)
    expect(t.series[t.series.length - 3]).toBe(7)
  })

  it("all time is a running total compared with 30 days ago", () => {
    const t = pointsTicker(entries, "all", asOf)
    expect(t.value).toBe(33.5)
    expect(t.previous).toBe(7) // through 14 Sep: only the August entry
    expect(t.series).toHaveLength(90)
    expect(t.series[0]).toBe(0) // window opens 17 Jul, before the 1 Aug entry
    expect([...t.series].sort((a, b) => a - b)).toEqual(t.series)
  })

  it("reports no percent when the previous period was zero", () => {
    const t = pointsTicker([{ date: "2026-10-14", points: 2 }], "day", asOf)
    expect(t.changePct).toBeNull()
    expect(formatTickerChange(t)).toBe("new")
    const empty = pointsTicker([], "week", asOf)
    expect(empty.direction).toBe("flat")
    expect(formatTickerChange(empty)).toBe("0%")
  })

  it("formats falls with a true minus sign", () => {
    const t = pointsTicker(entries, "day", new Date(2026, 9, 13, 12))
    expect(t.direction).toBe("down") // 2 vs Monday's 4
    expect(formatTickerChange(t)).toBe("−50%")
    expect(formatTickerDelta(t.delta)).toBe("−2")
  })
})
