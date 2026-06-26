import { describe, it, expect } from "vitest"
import { computeStreak, periodIndex } from "@/lib/streaks"

describe("streaks", () => {
  it("returns zeros for no data", () => {
    const r = computeStreak([])
    expect(r).toEqual({ current: 0, longest: 0, lastDate: null, totalActivePeriods: 0 })
  })

  it("counts a current daily streak ending today", () => {
    const today = new Date(2026, 5, 23) // Jun 23 2026 (local)
    const r = computeStreak(["2026-06-21", "2026-06-22", "2026-06-23"], { today })
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
    expect(r.lastDate).toBe("2026-06-23")
    expect(r.totalActivePeriods).toBe(3)
  })

  it("keeps the current streak alive if yesterday is the last completion", () => {
    const today = new Date(2026, 5, 23)
    const r = computeStreak(["2026-06-21", "2026-06-22"], { today })
    expect(r.current).toBe(2)
  })

  it("resets the current streak when the last two periods were missed", () => {
    const today = new Date(2026, 5, 23)
    const r = computeStreak(["2026-06-19", "2026-06-20"], { today })
    expect(r.current).toBe(0)
    expect(r.longest).toBe(2)
  })

  it("finds the longest run separate from the current run", () => {
    const today = new Date(2026, 5, 23)
    const r = computeStreak(
      ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-22", "2026-06-23"],
      { today },
    )
    expect(r.longest).toBe(4)
    expect(r.current).toBe(2)
  })

  it("de-duplicates multiple completions in the same day", () => {
    const today = new Date(2026, 5, 23)
    const r = computeStreak(["2026-06-23", "2026-06-23", "2026-06-22"], { today })
    expect(r.current).toBe(2)
    expect(r.totalActivePeriods).toBe(2)
  })

  it("supports weekly streaks", () => {
    const today = new Date(2026, 5, 23) // a Tuesday
    // three consecutive weeks
    const r = computeStreak(["2026-06-09", "2026-06-16", "2026-06-23"], { today, unit: "week" })
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
  })

  it("supports monthly streaks", () => {
    const today = new Date(2026, 5, 15)
    const r = computeStreak(["2026-04-10", "2026-05-10", "2026-06-10"], { today, unit: "month" })
    expect(r.current).toBe(3)
  })

  it("ignores invalid date values", () => {
    const today = new Date(2026, 5, 23)
    const r = computeStreak(["not-a-date", "2026-06-23"], { today })
    expect(r.current).toBe(1)
    expect(r.totalActivePeriods).toBe(1)
  })

  it("periodIndex increments by one for consecutive days", () => {
    const a = periodIndex(new Date(2026, 5, 22), "day")
    const b = periodIndex(new Date(2026, 5, 23), "day")
    expect(b - a).toBe(1)
  })
})
