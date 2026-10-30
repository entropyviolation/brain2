import { describe, expect, it } from "vitest"
import { addDays, dayBounds, daysThrough, exportFileName, localDayKey, nextClose, safeProfile, yesterdayKey } from "./export-day.mjs"

describe("chrome history day window", () => {
  it("uses the local calendar day, including just after midnight", () => {
    const justAfter = new Date(2026, 9, 27, 0, 5, 0, 0).getTime()
    expect(localDayKey(justAfter)).toBe("2026-10-27")
    expect(yesterdayKey(justAfter)).toBe("2026-10-26")
    const bounds = dayBounds("2026-10-26")
    expect(bounds.start).toBe(new Date(2026, 9, 26).getTime())
    expect(bounds.end).toBe(new Date(2026, 9, 27).getTime())
    expect(bounds.start).toBeLessThan(justAfter)
    expect(justAfter).toBeGreaterThanOrEqual(bounds.end)
  })

  it("lists missed days and stops when nothing is missing", () => {
    expect(daysThrough("2026-10-24", "2026-10-26")).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"])
    expect(daysThrough("2026-10-27", "2026-10-26")).toEqual([])
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
  })

  it("schedules the next 12:05am and names the download", () => {
    const afternoon = new Date(2026, 9, 26, 15, 0, 0, 0).getTime()
    expect(nextClose(afternoon)).toBe(new Date(2026, 9, 27, 0, 5, 0, 0).getTime())
    const early = new Date(2026, 9, 27, 0, 1, 0, 0).getTime()
    expect(nextClose(early)).toBe(new Date(2026, 9, 27, 0, 5, 0, 0).getTime())
    expect(safeProfile("Work/laptop")).toBe("Work laptop")
    expect(exportFileName("Work", "2026-10-26")).toBe("Brain2 Chrome/Work 2026-10-26.json")
  })
})
