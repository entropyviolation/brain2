import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { countHabitDaysMetInWeek, fourPlusWeekMondayKeys, habitWeekStreakSummary } from "./habit-week-streaks"

const habit: WeeklyTask = { id: "h1", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
const weekA = new Date(2026, 8, 7) // Mon Sep 7
const weekB = new Date(2026, 8, 14) // Mon Sep 14

function markDays(weekStart: Date, days: number) {
  const data: Record<string, Record<string, { completed: boolean }>> = {}
  for (let i = 0; i < days; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    data[key] = { h1: { completed: true } }
  }
  return data
}

describe("habit week streaks (4+ days)", () => {
  it("counts completed days in a week", () => {
    expect(countHabitDaysMetInWeek(habit, markDays(weekB, 4), weekB)).toBe(4)
    expect(countHabitDaysMetInWeek(habit, markDays(weekB, 3), weekB)).toBe(3)
  })

  it("lists only weeks with 4+ hits", () => {
    const data = { ...markDays(weekA, 4), ...markDays(weekB, 3) }
    expect(fourPlusWeekMondayKeys(habit, data)).toEqual(["2026-09-07"])
  })

  it("computes a consecutive week streak when two 4+ weeks land back to back", () => {
    const data = { ...markDays(weekA, 4), ...markDays(weekB, 5) }
    const summary = habitWeekStreakSummary(habit, data, weekB, new Date(2026, 8, 17))
    expect(summary.thisWeekDays).toBe(5)
    expect(summary.thisWeekHit).toBe(true)
    expect(summary.current).toBe(2)
    expect(summary.longest).toBe(2)
  })
})
