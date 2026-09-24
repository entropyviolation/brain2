import { describe, expect, it } from "vitest"
import {
  addDays,
  clampRange,
  daysInRange,
  indexScopeEntriesByDate,
  infiniteCellStep,
  mondayOf,
  prefixHeights,
  restoreScrollAfterPrepend,
  startOfDay,
  stripItems,
  visibleSlice,
} from "./infinite-window"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { TimeEntry } from "@/lib/time-entries"

const WED = new Date(2026, 8, 16)

describe("infinite-window", () => {
  it("keeps a frozen origin — shifting the selected day is not this helper's job", () => {
    const days = daysInRange(WED, 2, 1)
    expect(days.map((d) => d.getDate())).toEqual([14, 15, 16, 17])
    expect(startOfDay(WED).getHours()).toBe(0)
  })

  it("groups week bands on Mondays without duplicating a day", () => {
    const days = daysInRange(WED, 1, 1)
    const items = stripItems(days, "week")
    const bands = items.filter((i) => i.kind === "band")
    expect(bands).toHaveLength(1)
    expect(bands[0]?.kind === "band" && formatLocalDateKey(bands[0].date)).toBe(
      formatLocalDateKey(mondayOf(WED)),
    )
    expect(items.filter((i) => i.kind === "day")).toHaveLength(3)
    expect(mondayOf(WED).getDay()).toBe(1)
  })

  it("caps 1m/5m cells at 15m so a row is 96 nodes, not 1440", () => {
    expect(infiniteCellStep(1)).toBe(15)
    expect(infiniteCellStep(5)).toBe(15)
    expect(infiniteCellStep(10)).toBe(15)
    expect(infiniteCellStep(15)).toBe(15)
    expect(infiniteCellStep(30)).toBe(30)
  })

  it("windows by scroll without depending on the selected date", () => {
    const days = daysInRange(WED, 10, 10)
    const items = stripItems(days, "day")
    const prefix = prefixHeights(items, 36, 18)
    const slice = visibleSlice(prefix, 36 * 8, 200, 0)
    expect(slice.start).toBe(8)
    expect(slice.end).toBeGreaterThan(slice.start)
    expect(items[slice.start]?.kind).toBe("day")
  })

  it("restores scrollTop by the height prepended so the sentinel cannot loop", () => {
    expect(restoreScrollAfterPrepend(800, 1400, 40)).toBe(640)
  })

  it("indexes entries once by date so a windowed paint is O(visible), not O(days × all)", () => {
    const entries: TimeEntry[] = [
      { id: "a", date: "2026-09-16", scopeId: "activity", penId: "act-work", startMin: 0, endMin: 60 },
      { id: "b", date: "2026-09-16", scopeId: "location", penId: "loc-home", startMin: 0, endMin: 60 },
      { id: "c", date: "2026-09-17", scopeId: "activity", penId: "act-rest", startMin: 60, endMin: 120 },
    ]
    const byDate = indexScopeEntriesByDate(entries, "activity")
    expect(byDate.get("2026-09-16")).toHaveLength(1)
    expect(byDate.get("2026-09-17")?.[0].penId).toBe("act-rest")
    expect(byDate.get("2026-09-16")?.[0].scopeId).toBe("activity")
  })

  it("adds days from a stable origin", () => {
    expect(addDays(WED, -14).getDate()).toBe(2)
  })

  it("clamps preload so the observer cannot run away", () => {
    expect(clampRange(9999, 9999, "day")).toEqual({ before: 400, after: 90 })
    expect(clampRange(1, 1, "week")).toEqual({ before: 21, after: 14 })
  })
})
