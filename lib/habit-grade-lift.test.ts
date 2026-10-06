/**
 * Grade-lift targets: yesterday raw daily completion, last week = prior full
 * calendar week's rail Week grade + Perfect output, signed deltas.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getGradeLiftComparisonTargets, useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { formatGradeLiftDelta, formatGradeLiftYesterdayCaption } from "@/lib/habit-points"
import { rawDayCompletionPercent } from "@/lib/habit-accomplishment"

describe("getGradeLiftComparisonTargets", () => {
  const today = new Date(2026, 8, 27) // Sunday
  const yesterday = new Date(2026, 8, 26)

  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "a", name: "A", type: TaskType.BOOLEAN, frequency: "daily" },
      { id: "b", name: "B", type: TaskType.GOAL, goal: 10, frequency: "daily" },
      { id: "c", name: "C", type: TaskType.BOOLEAN, frequency: "daily" },
      { id: "d", name: "D", type: TaskType.BOOLEAN, frequency: "daily" },
      { id: "e", name: "E", type: TaskType.BOOLEAN, frequency: "daily" },
    ])
  })

  it("yesterday is raw daily completion with partial credit (not week grade)", () => {
    // Two of five habits done → 40%. A 4/10 goal would count as 0.4, not 0 or 1.
    useHabitsStore.getState().updateCompletion("a", yesterday, { completed: true })
    useHabitsStore.getState().updateCompletion("c", yesterday, { completed: true })

    const tasks = useHabitsStore.getState().tasks
    const weeklyData = useHabitsStore.getState().weeklyData
    expect(rawDayCompletionPercent(tasks, weeklyData, yesterday)).toBe(40)

    useHabitsStore.getState().updateCompletion("b", yesterday, { value: 4 })
    expect(rawDayCompletionPercent(useHabitsStore.getState().tasks, useHabitsStore.getState().weeklyData, yesterday)).toBe(
      48,
    )

    // Back to 40% for the caption target (two full booleans only).
    useHabitsStore.getState().updateCompletion("b", yesterday, { value: 0 })
    const targets = getGradeLiftComparisonTargets(today)
    expect(targets.yesterdayRaw).toBe(40)
    expect(formatGradeLiftYesterdayCaption(targets.yesterdayRaw)).toBe("Yesterday — 40% daily completion")
  })

  it("last week uses the prior full calendar week, not this week", () => {
    // Fill last week (Mon 14 – Sun 20); leave this week empty.
    for (let d = 14; d <= 20; d++) {
      const day = new Date(2026, 8, d)
      useHabitsStore.getState().updateCompletion("a", day, { completed: true })
      useHabitsStore.getState().updateCompletion("b", day, { value: 5 })
      useHabitsStore.getState().updateCompletion("c", day, { completed: true })
    }
    const targets = getGradeLiftComparisonTargets(today)
    expect(targets.lastWeek).not.toBeNull()
    expect(targets.thisWeek).not.toBeNull()
    expect(targets.lastWeek!.week).toBeGreaterThan(targets.thisWeek!.week)
    expect(targets.lastWeekDeltas).not.toBeNull()
    expect(targets.lastWeekDeltas!.week).toBeLessThan(0)
    expect(formatGradeLiftDelta(targets.lastWeekDeltas!.week).startsWith("−")).toBe(true)
  })

  it("yesterday delta is signed today − yesterday", () => {
    useHabitsStore.getState().updateCompletion("a", yesterday, { completed: true })
    useHabitsStore.getState().updateCompletion("c", yesterday, { completed: true })
    useHabitsStore.getState().updateCompletion("a", today, { completed: true })
    useHabitsStore.getState().updateCompletion("b", today, { value: 10 })
    useHabitsStore.getState().updateCompletion("c", today, { completed: true })
    const targets = getGradeLiftComparisonTargets(today)
    expect(targets.yesterdayRaw).toBe(40)
    expect(targets.todayRaw).toBe(60)
    expect(targets.yesterdayDelta).toBe(20)
    expect(formatGradeLiftDelta(targets.yesterdayDelta)).toBe("+20")
  })
})
