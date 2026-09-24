import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { usePointsStore } from "@/lib/points-store"
import type { Task } from "@/lib/types"
import {
  SCHEDULE_POINTS,
  creditSchedulePlacement,
  earnsSchedulePoint,
  periodBucketKey,
  scheduleCreditLabel,
  targetPeriodBucketKey,
} from "@/lib/schedule-credit"

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  description: "Plan retreat",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("schedule-credit", () => {
  beforeEach(() => resetAllStores())

  it("builds period bucket keys from the stored schedule level", () => {
    expect(periodBucketKey(task())).toBeNull()
    expect(periodBucketKey(task({ scheduledYear: "2026" }))).toBe("year:2026")
    expect(periodBucketKey(task({ scheduledMonth: "2026-09" }))).toBe("month:2026-09")
    expect(periodBucketKey(task({ scheduledWeek: "2026-09-21_2026-09-27" }))).toBe(
      "week:2026-09-21_2026-09-27",
    )
    expect(periodBucketKey(task({ scheduledDate: new Date(2026, 8, 23) }))).toBe("day:2026-09-23")
  })

  it("maps drop targets to the same key shape", () => {
    expect(targetPeriodBucketKey("always", "")).toBeNull()
    expect(targetPeriodBucketKey("year", "2026")).toBe("year:2026")
    expect(targetPeriodBucketKey("month", "2026-09")).toBe("month:2026-09")
    expect(targetPeriodBucketKey("week", "2026-09-21_2026-09-27")).toBe("week:2026-09-21_2026-09-27")
    expect(targetPeriodBucketKey("day", "2026-09-23")).toBe("day:2026-09-23")
  })

  it("earns a point for a new or changed period, not the same bucket", () => {
    const bare = task()
    expect(earnsSchedulePoint(bare, "year", "2026")).toBe(true)
    expect(earnsSchedulePoint(bare, "always", "")).toBe(false)

    const year = task({ scheduledYear: "2026" })
    expect(earnsSchedulePoint(year, "year", "2026")).toBe(false)
    expect(earnsSchedulePoint(year, "month", "2026-09")).toBe(true)
    expect(earnsSchedulePoint(year, "day", "2026-09-23")).toBe(true)

    const day = task({ scheduledDate: new Date(2026, 8, 23) })
    expect(earnsSchedulePoint(day, "day", "2026-09-23")).toBe(false)
    expect(earnsSchedulePoint(day, "day", "2026-09-24")).toBe(true)
  })

  it("credits one point with a scheduled reason string", () => {
    expect(scheduleCreditLabel("Plan retreat")).toBe("Plan retreat scheduled")
    creditSchedulePlacement("t1", "Plan retreat")
    const entry = usePointsStore.getState().pointsHistory.find((e) => e.taskId === "t1")
    expect(entry?.points).toBe(SCHEDULE_POINTS)
    expect(entry?.taskDescription).toBe("Plan retreat scheduled")
  })
})
