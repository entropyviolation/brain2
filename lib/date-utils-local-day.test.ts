import { describe, expect, it } from "vitest"
import { isPastLocalCalendarDay, startOfLocalToday, toLocalCalendarDate } from "./date-utils"

describe("startOfLocalToday / isPastLocalCalendarDay", () => {
  const now = new Date(2026, 8, 21, 15, 30)

  it("startOfLocalToday is local midnight of now, not a selected date", () => {
    expect(startOfLocalToday(now)).toEqual(toLocalCalendarDate(now))
    expect(startOfLocalToday(now).getHours()).toBe(0)
  })

  it("treats days before local today as past and today as not past", () => {
    expect(isPastLocalCalendarDay(new Date(2026, 8, 20, 23, 59), now)).toBe(true)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 21, 0, 0), now)).toBe(false)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22, 0, 0), now)).toBe(false)
  })

  it("does not use a later selected day as the past cutoff", () => {
    const selected = new Date(2026, 8, 25, 12)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22), selected)).toBe(true)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22), now)).toBe(false)
  })
})
