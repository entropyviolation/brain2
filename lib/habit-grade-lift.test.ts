/**
 * Grade-lift targets: yesterday raw daily completion, last week = prior full
 * calendar week's rail Week grade + Perfect output, signed deltas.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { getGradeLiftComparisonTargets, useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import {
  formatGradeLiftAverageCaption,
  formatGradeLiftDelta,
  formatGradeLiftYesterdayCaption,
} from "@/lib/habit-points"
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

  it("prior 7 and prior 30 expose today, the average, and the signed gap", () => {
    // Seven days at 40% (2 of 5), then today at 60% (3 of 5). The other 23 days in the 30 count as 0.
    for (let d = 20; d <= 26; d++) {
      const day = new Date(2026, 8, d)
      useHabitsStore.getState().updateCompletion("a", day, { completed: true })
      useHabitsStore.getState().updateCompletion("c", day, { completed: true })
    }
    useHabitsStore.getState().updateCompletion("a", today, { completed: true })
    useHabitsStore.getState().updateCompletion("b", today, { value: 10 })
    useHabitsStore.getState().updateCompletion("c", today, { completed: true })

    const targets = getGradeLiftComparisonTargets(today)
    expect(targets.todayRaw).toBe(60)
    expect(targets.prior7Average).toBe(40)
    expect(targets.prior7Delta).toBe(20)
    expect(formatGradeLiftAverageCaption("Prior 7 days", targets.prior7Average)).toBe("Prior 7 days — 40% average")
    expect(formatGradeLiftDelta(targets.prior7Delta)).toBe("+20")
    expect(targets.prior30Average).toBeCloseTo((7 * 40) / 30)
    expect(targets.prior30Delta).toBe(60 - Math.round((7 * 40) / 30))
    expect(formatGradeLiftAverageCaption("Prior 30 days", targets.prior30Average)).toMatch(/^Prior 30 days — \d+% average$/)
  })

  it("leaves the prior windows empty when no earlier day is logged", () => {
    const targets = getGradeLiftComparisonTargets(today)
    expect(targets.prior7Average).toBeNull()
    expect(targets.prior30Average).toBeNull()
    expect(targets.prior7Delta).toBeNull()
    expect(targets.prior30Delta).toBeNull()
    expect(formatGradeLiftAverageCaption("Prior 7 days", null)).toBe("No prior 7 days yet")
    expect(formatGradeLiftDelta(targets.prior7Delta)).toBe("—")
  })
})
