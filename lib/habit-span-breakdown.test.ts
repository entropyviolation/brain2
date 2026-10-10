import { describe, expect, it } from "vitest"
import { formatLocalDateKey, getDayOfWeek } from "./date-utils"
import { habitSpanBreakdown } from "./habit-span-breakdown"
import { TaskType, type WeeklyTask } from "./types"

const read: WeeklyTask = { id: "read", name: "Read", type: TaskType.BOOLEAN, frequency: "daily" }

/** Monday 5 Oct 2026 through Sunday 11 Oct. */
const week = Array.from({ length: 7 }, (_, index) => new Date(2026, 9, 5 + index))
const columns = week.map((date) => ({
  key: formatLocalDateKey(date),
  title: `${getDayOfWeek(date).substring(0, 3)} ${date.getMonth() + 1}/${date.getDate()}`,
  date,
}))

const twoDays = {
  "2026-10-05": { read: { completed: true } },
  "2026-10-06": { read: { completed: true } },
}

describe("habitSpanBreakdown", () => {
  it("exposes a running figure and a total that can differ while the week is in progress", () => {
    const result = habitSpanBreakdown({
      task: read,
      data: twoDays,
      columns,
      unit: "day",
      asOf: new Date(2026, 9, 7),
    })

    expect(result.inProgress).toBe(true)
    expect(result.running).toBeCloseTo((2 / 3) * 100)
    expect(result.total).toBeCloseTo((2 / 7) * 100)
    expect(result.running).not.toBe(result.total)
    expect(result.columns.map((column) => column.title)).toEqual([
      "Mon 10/5",
      "Tue 10/6",
      "Wed 10/7",
      "Thu 10/8",
      "Fri 10/9",
      "Sat 10/10",
      "Sun 10/11",
    ])
    expect(result.columns.filter((column) => column.started).map((column) => column.title)).toEqual([
      "Mon 10/5",
      "Tue 10/6",
      "Wed 10/7",
    ])
    expect(result.columns.every((column) => column.amount == null)).toBe(true)
  })

  it("lists each day's cell amount for a goal habit, including a day over the target, and leaves a yes/no habit unnamed by a number", () => {
    const log: WeeklyTask = {
      id: "log",
      name: "log 70% of day",
      type: TaskType.GOAL,
      goal: 70,
      frequency: "daily",
    }
    const result = habitSpanBreakdown({
      task: log,
      data: {
        "2026-10-05": { log: { value: 80.6, goal: 70 } },
        "2026-10-06": { log: { value: 98.2, goal: 70 } },
        "2026-10-07": { log: { value: 32.2, goal: 70 } },
        "2026-10-09": { log: { value: 76.1, goal: 70 } },
      },
      columns,
      unit: "day",
      asOf: new Date(2026, 9, 9),
    })

    expect(result.inProgress).toBe(true)
    expect(result.running).not.toBeNull()
    expect(result.total).not.toBeNull()
    expect(result.columns.map((column) => column.amount)).toEqual([
      "80.6/70",
      "98.2/70",
      "32.2/70",
      "/70",
      "76.1/70",
      "/70",
      "/70",
    ])
    expect(result.columns.find((column) => column.title === "Tue 10/6")?.amount).toBe("98.2/70")

    const lamp = habitSpanBreakdown({
      task: read,
      data: twoDays,
      columns,
      unit: "day",
      asOf: new Date(2026, 9, 9),
    })
    expect(lamp.columns.every((column) => column.amount == null)).toBe(true)
  })

  it("a finished span exposes the total and does not pretend there is a separate running value", () => {
    const result = habitSpanBreakdown({
      task: read,
      data: twoDays,
      columns,
      unit: "day",
      asOf: new Date(2026, 9, 12),
    })

    expect(result.inProgress).toBe(false)
    expect(result.running).toBeNull()
    expect(result.total).toBeCloseTo((2 / 7) * 100)
    expect(result.running).not.toBe(result.total)
  })
})
