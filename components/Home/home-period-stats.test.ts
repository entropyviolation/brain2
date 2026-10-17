import { describe, expect, it } from "vitest"
import { homePeriodStatsOf } from "@/components/Home/home-period-stats"
import { getWeekString } from "@/lib/date-utils"
import { TaskType, type Task, type WeeklyTask } from "@/lib/types"

const date = new Date(2026, 9, 14, 12)
const week = getWeekString(date)

function task(id: string, title: string, extra: Partial<Task>): Task {
  return { id, title, description: title, createdAt: date, completed: false, stage: "clarified", lists: [], ...extra } as Task
}

describe("homePeriodStatsOf remaining lists", () => {
  const tasks = [
    task("w-open", "Call the bank", { scheduledWeek: week }),
    task("w-done", "Pay rent", { scheduledWeek: week, completed: true }),
    task("m-open", "Book dentist", { scheduledMonth: "2026-10" }),
    task("hidden", "Hidden", { scheduledWeek: week, hiddenFromTodo: true }),
  ]
  const habits = [
    { id: "h-run", name: "Run 3x", type: TaskType.BOOLEAN, frequency: "weekly" },
    { id: "h-read", name: "  ", type: TaskType.BOOLEAN, frequency: "weekly" },
    { id: "h-month", name: "Deep clean", type: TaskType.BOOLEAN, frequency: "monthly" },
  ] as WeeklyTask[]
  const weekly = { [week]: { "h-run": { completed: true } } } as never

  it("lists the week's open to-dos and undone weekly habits", () => {
    const stats = homePeriodStatsOf("week", date, tasks, habits, weekly, {}, {} as never)
    expect(stats.todo).toMatchObject({ completed: 1, total: 3 })
    expect(stats.remainingTodos.map((t) => t.id)).toEqual(["w-open", "m-open"])
    expect(stats.remainingHabits).toEqual([{ id: "h-read", title: "Untitled habit" }])
  })

  it("lists the month's open to-dos and undone monthly habits", () => {
    const stats = homePeriodStatsOf("month", date, tasks, habits, weekly, {}, {} as never)
    expect(stats.remainingTodos.map((t) => t.title)).toEqual(["Call the bank", "Book dentist"])
    expect(stats.remainingHabits.map((h) => h.title)).toEqual(["Deep clean"])
  })
})
