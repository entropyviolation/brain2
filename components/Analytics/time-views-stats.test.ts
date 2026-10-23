import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { coverCount, effectiveCount, entropyByDayType, penTiles, topShare, weekPenGrid } from "./time-views-stats"

function block(date: string, penId: string, startMin: number, endMin: number): TimeEntry {
  return { id: `${date}-${penId}-${startMin}`, date, scopeId: "s", penId, startMin, endMin } as TimeEntry
}

describe("time-views-stats", () => {
  it("coverCount counts the largest totals needed to reach a share", () => {
    expect(coverCount([60, 30, 10], 0.8)).toBe(2)
    expect(coverCount([60, 30, 10], 0.5)).toBe(1)
    expect(coverCount([60, 30, 10], 1)).toBe(3)
    expect(coverCount([0, 0], 0.8)).toBe(0)
  })

  it("effectiveCount and topShare", () => {
    expect(effectiveCount(0)).toBe(1)
    expect(effectiveCount(2)).toBe(4)
    expect(topShare([30, 10])).toBe(0.75)
    expect(topShare([])).toBe(0)
  })

  it("weekPenGrid slices the window into 7-day rings", () => {
    const keys = Array.from({ length: 9 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`)
    const grid = weekPenGrid([block("2026-01-01", "a", 0, 60), block("2026-01-08", "a", 0, 30), block("2026-01-02", "b", 0, 10)], keys)
    expect(grid.weeks).toEqual(["2026-01-01", "2026-01-08"])
    expect(grid.pens.map((p) => p.id)).toEqual(["a", "b"])
    expect(grid.cells).toEqual([
      [60, 10],
      [30, 0],
    ])
    expect(grid.max).toBe(60)
  })

  it("penTiles counts blocks, days and dates", () => {
    const tiles = penTiles([block("2026-01-01", "a", 0, 60), block("2026-01-03", "a", 0, 30), block("2026-01-03", "a", 60, 90)])
    expect(tiles[0]).toEqual({ penId: "a", minutes: 120, blocks: 3, days: 2, first: "2026-01-01", last: "2026-01-03" })
  })

  it("entropyByDayType skips empty days", () => {
    // 2026-01-03 is a Saturday, 2026-01-05 a Monday.
    const cut = entropyByDayType([
      { date: "2026-01-03", entropy: 1, minutes: 10 },
      { date: "2026-01-05", entropy: 2, minutes: 10 },
      { date: "2026-01-06", entropy: 0, minutes: 0 },
    ])
    expect(cut).toEqual({ weekday: 2, weekend: 1 })
  })
})
