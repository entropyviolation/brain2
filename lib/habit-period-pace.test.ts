import { describe, expect, it } from "vitest"
import { isCurrentHabitPeriod, loggedShareOfElapsed, periodElapsedFraction } from "./habit-period-pace"

describe("period pace", () => {
  const tuesdayNoon = new Date(2026, 9, 6, 12, 0, 0)

  it("hides a pace before the period has started", () => {
    expect(loggedShareOfElapsed(10, 0)).toBeNull()
    expect(periodElapsedFraction("daily", new Date(2026, 9, 7), tuesdayNoon)).toBe(0)
  })

  it("reads logged share of the time that has already passed", () => {
    const monday = new Date(2026, 9, 5, 8, 0, 0)
    expect(isCurrentHabitPeriod("weekly", monday, tuesdayNoon)).toBe(true)
    const elapsed = periodElapsedFraction("weekly", monday, tuesdayNoon)
    expect(elapsed).toBeCloseTo(1.5 / 7, 5)
    expect(loggedShareOfElapsed(10, elapsed)).toBeCloseTo(10 / (1.5 / 7), 4)
  })

  it("treats a finished week as fully elapsed", () => {
    const lastMonday = new Date(2026, 8, 28)
    expect(isCurrentHabitPeriod("weekly", lastMonday, tuesdayNoon)).toBe(false)
    expect(periodElapsedFraction("weekly", lastMonday, tuesdayNoon)).toBe(1)
  })
})
