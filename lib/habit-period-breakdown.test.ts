import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { periodBreakdownTitles } from "./habit-period-breakdown"

const period = { key: "2026-10-09", date: new Date(2026, 9, 9) }
const tasks: WeeklyTask[] = [
  { id: "water", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" },
  { id: "pages", name: "Pages", type: TaskType.BOOLEAN, frequency: "daily" },
]
const data = {
  "2026-10-09": {
    water: { completed: true },
    pages: { completed: false },
  },
}

describe("periodBreakdownTitles", () => {
  it("lists both titles, then only the complete one, then only the open one", () => {
    const input = { tasks, period, data }
    expect(periodBreakdownTitles(input)).toEqual(["Water", "Pages"])
    expect(periodBreakdownTitles(input, "completed")).toEqual(["Water"])
    expect(periodBreakdownTitles(input, "open")).toEqual(["Pages"])
  })
})
