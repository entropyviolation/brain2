import { describe, expect, it } from "vitest"
import { getWeekString } from "@/lib/date-utils"
import { TaskType } from "@/lib/types"
import { buildPeriodRitualStats } from "./period-ritual-stats"

const oct5 = new Date(2026, 9, 5, 12, 0, 0)

describe("period ritual stats", () => {
  it("compares points with the previous week and prices a habit never done", () => {
    const week = getWeekString(new Date(2026, 8, 28))
    const stats = buildPeriodRitualStats({
      period: "week",
      periodKey: week,
      now: oct5,
      tasks: [],
      lists: [],
      folders: [],
      habits: [{ id: "water", name: "Drink water", type: TaskType.BOOLEAN, frequency: "daily" }],
      weeklyData: {},
      points: [
        { date: "2026-09-30", points: 10, taskId: "a", taskDescription: "a" },
        { date: "2026-09-22", points: 4, taskId: "b", taskDescription: "b" },
      ],
      entries: [],
      scopes: [],
    })
    expect(stats.habitGrade.label).toBe("Week grade")
    expect(stats.points.current).toBe(10)
    expect(stats.points.previous).toBe(4)
    expect(stats.points.delta).toBe(6)
    expect(stats.habitsNever.map((habit) => habit.name)).toEqual(["Drink water"])
    expect(stats.missed.find((row) => row.id === "water")?.points).toBe(350)
    expect(stats.habitGrade.parts).toEqual([])
  })
})