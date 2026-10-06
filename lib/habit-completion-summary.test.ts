/**
 * lib/habit-completion-summary.test.ts — Read-only habit standing
 */
import { describe, expect, it } from "vitest"
import { getWeekString } from "@/lib/date-utils"
import { summarizeHabitCompletions } from "@/lib/habit-completion-summary"
import { TaskType, type WeeklyTask } from "@/lib/types"

const habit: WeeklyTask = {
  id: "task-h",
  name: "post a tiktok",
  type: TaskType.BOOLEAN,
  frequency: "weekly",
  rewardValue: 10,
}

describe("summarizeHabitCompletions", () => {
  it("reads this period and recent met weeks without writing", () => {
    const now = new Date(2026, 9, 6)
    const past = getWeekString(new Date(2026, 8, 7))
    const current = getWeekString(now)
    const summary = summarizeHabitCompletions(
      habit,
      {
        weeklyData: {},
        weeklyHabitData: { [past]: { "task-h": { completed: true } } },
        monthlyHabitData: {},
        quarterlyHabitData: {},
      },
      now,
    )
    expect(summary.frequencyLabel).toBe("Weekly")
    expect(summary.goalLabel).toBe("Yes / No")
    expect(summary.periodLabel).toBe("This week")
    expect(summary.standing).toBe("Not done")
    expect(summary.recent.map((row) => row.key)).toEqual([past])
    expect(past).not.toBe(current)
  })

  it("states a goal habit's number against its goal", () => {
    const now = new Date(2026, 9, 6)
    const key = getWeekString(now)
    const summary = summarizeHabitCompletions(
      { ...habit, type: TaskType.GOAL, goal: 3, unit: "posts" },
      {
        weeklyData: {},
        weeklyHabitData: { [key]: { "task-h": { value: 1 } } },
        monthlyHabitData: {},
        quarterlyHabitData: {},
      },
      now,
    )
    expect(summary.goalLabel).toBe("3 posts")
    expect(summary.standing).toBe("1 of 3 posts — not there yet")
    expect(summary.recent).toEqual([])
  })
})