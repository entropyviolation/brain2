import { describe, expect, it } from "vitest"
import { countPendingReviews, getPendingReviews } from "./pending-reviews"
import type { PeriodReview } from "./types"

describe("getPendingReviews", () => {
  const now = new Date("2026-06-20T12:00:00")

  it("marks all periods as needed when no reviews exist", () => {
    const pending = getPendingReviews([], now)
    expect(pending.day.needed).toBe(true)
    expect(pending.week.needed).toBe(true)
    expect(pending.month.needed).toBe(true)
  })

  it("marks a period done when a matching end review exists", () => {
    const reviews: PeriodReview[] = [
      {
        id: "day:2026-06-19",
        period: "day",
        periodKey: "2026-06-19",
        completedAt: now,
        summary: "",
        gratitude: [],
        nextPlans: "",
        reflections: {},
        resolvedTaskIds: [],
        pushedTaskIds: [],
      },
    ]
    const pending = getPendingReviews(reviews, now)
    expect(pending.day.needed).toBe(false)
    expect(pending.week.needed).toBe(true)
  })

  it("keeps end due when only a morning slice exists", () => {
    const reviews: PeriodReview[] = [
      {
        id: "day:2026-06-19",
        period: "day",
        periodKey: "2026-06-19",
        completedAt: now,
        summary: "",
        gratitude: [],
        nextPlans: "",
        reflections: {},
        resolvedTaskIds: [],
        pushedTaskIds: [],
        morning: { completed: true, wakeTime: "07:00" },
      },
    ]
    expect(getPendingReviews(reviews, now).day.needed).toBe(true)
  })
})

describe("countPendingReviews", () => {
  it("counts only periods still needed", () => {
    expect(countPendingReviews([], new Date("2026-06-20T12:00:00"))).toBe(5)
  })
})
