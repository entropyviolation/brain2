import { describe, expect, it } from "vitest"
import type { PeriodReview } from "@/lib/types"
import { nightCarryForMorning } from "./ritual-carry"

function night(partial: Partial<PeriodReview> & { periodKey: string }): PeriodReview {
  return {
    id: `day:${partial.periodKey}`,
    period: "day",
    completedAt: new Date(2026, 9, 4, 22, 0, 0),
    summary: "",
    gratitude: [],
    nextPlans: "",
    reflections: {},
    resolvedTaskIds: [],
    pushedTaskIds: [],
    ...partial,
  }
}

describe("night carry into the next morning", () => {
  const oct5 = new Date(2026, 9, 5, 8, 0, 0)

  it("reads the previous night's reminder and what matters most", () => {
    const carry = nightCarryForMorning(
      [
        night({
          periodKey: "2026-10-04",
          wakeReminder: "  water the fern  ",
          tomorrowMatters: "the letter",
          tomorrowFocusGoalIds: ["goal-read"],
        }),
      ],
      oct5,
    )
    expect(carry.nightKey).toBe("2026-10-04")
    expect(carry.wakeReminder).toBe("water the fern")
    expect(carry.tomorrowMatters).toBe("the letter")
    expect(carry.focusGoalIds).toEqual(["goal-read"])
  })

  it("is empty when the night left those fields blank", () => {
    const carry = nightCarryForMorning([night({ periodKey: "2026-10-04", wakeReminder: "  " })], oct5)
    expect(carry.wakeReminder).toBe("")
    expect(carry.tomorrowMatters).toBe("")
    expect(carry.focusGoalIds).toEqual([])
  })
})
