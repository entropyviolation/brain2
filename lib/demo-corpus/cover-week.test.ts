import { describe, expect, it } from "vitest"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { dayPlanKey } from "@/lib/plan-text"
import { coverCurrentWeek } from "./cover-week"

describe("cover current week", () => {
  const now = new Date(2026, 8, 23, 9, 0, 0)

  it("puts one or two planned, tracked, and completed rows on every empty day", () => {
    const filled = coverCurrentWeek({
      now,
      tasks: [],
      entries: [],
      actions: [],
      planDayKeys: new Set(),
    })
    const today = formatLocalDateKey(now)
    for (const day of getWeekDates(getWeekStartDate(now))) {
      const key = formatLocalDateKey(day)
      expect(filled.plans[dayPlanKey(key)]).toBeTruthy()
      const agenda = filled.actions.filter((action) => action.date === key)
      const scheduled = filled.tasks.filter((task) => task.id.startsWith(`demo-cov-sched-${key}`))
      expect(agenda.length).toBeGreaterThanOrEqual(1)
      expect(agenda.length).toBeLessThanOrEqual(2)
      expect(scheduled.length).toBe(agenda.length)
      const tracked = filled.entries.filter((entry) => entry.date === key)
      expect(tracked.length).toBeGreaterThanOrEqual(1)
      expect(tracked.length).toBeLessThanOrEqual(2)
      const done = filled.tasks.filter((task) => task.id.startsWith(`demo-cov-done-${key}`))
      if (key <= today) {
        expect(done.length).toBeGreaterThanOrEqual(1)
        expect(done.length).toBeLessThanOrEqual(2)
      } else {
        expect(done).toHaveLength(0)
        expect(tracked.every((entry) => entry.precision === "estimated")).toBe(true)
      }
    }
  })

  it("does not add a second layer when the day already has each channel", () => {
    const once = coverCurrentWeek({
      now,
      tasks: [],
      entries: [],
      actions: [],
      planDayKeys: new Set(),
    })
    const twice = coverCurrentWeek({
      now,
      tasks: once.tasks,
      entries: once.entries,
      actions: once.actions,
      planDayKeys: new Set(
        Object.keys(once.plans)
          .filter((key) => key.startsWith("dayPlan-"))
          .map((key) => key.slice("dayPlan-".length)),
      ),
    })
    expect(twice.tasks).toHaveLength(0)
    expect(twice.entries).toHaveLength(0)
    expect(twice.actions).toHaveLength(0)
    expect(Object.keys(twice.plans)).toHaveLength(0)
  })
})
