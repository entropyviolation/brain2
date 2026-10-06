import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import {
  comfortBand,
  comfortRatio,
  daysLeftInPeriod,
  daysLeftLabel,
  formatComfortRatio,
  futureDaysInPeriod,
  hoursLeftBeforeDayEnd,
  hoursLeftInPeriod,
  hoursLeftUntilMidnight,
  patchTodoCommitment,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  tasksWithCommitment,
  workingHoursLeft,
  withTodoCommitment,
} from "./todo-commitment"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.id,
    stage: "scheduled",
    createdAt: new Date("2026-06-01T12:00:00"),
    completed: false,
    lists: [],
    ...partial,
  }
}

/** Saturday 20 Jun 2026, noon local. Week is Mon 15–Sun 21. June has 30 days. */
const noon = new Date(2026, 5, 20, 12, 0, 0)

describe("todo commitment marks", () => {
  it("sets required and prioritized independently and drops a cleared mark", () => {
    const base = task({ id: "a" })
    const required = patchTodoCommitment(base, "week", "2026-06-15_2026-06-21", { required: true })
    expect(taskIsRequired(required, "week", "2026-06-15_2026-06-21")).toBe(true)
    expect(taskIsPrioritized(required, "week", "2026-06-15_2026-06-21")).toBe(false)

    const both = patchTodoCommitment(required, "week", "2026-06-15_2026-06-21", { prioritized: true })
    expect(taskIsRequired(both, "week", "2026-06-15_2026-06-21")).toBe(true)
    expect(taskIsPrioritized(both, "week", "2026-06-15_2026-06-21")).toBe(true)

    const cleared = withTodoCommitment(both, "week", "2026-06-15_2026-06-21", {
      required: false,
      prioritized: false,
    })
    expect(cleared.todoMarks).toBeUndefined()
    expect(cleared).not.toBe(base)
  })

  it("leaves the same task when the mark does not change", () => {
    const base = task({ id: "a" })
    expect(patchTodoCommitment(base, "day", "2026-06-20", { required: false })).toBe(base)
  })

  it("treats a morning priority id as prioritized for that day", () => {
    const base = task({ id: "a" })
    expect(taskIsPrioritized(base, "day", "2026-06-20", ["a"])).toBe(true)
    expect(taskIsPrioritized(base, "week", "2026-06-15_2026-06-21", ["a"])).toBe(false)
  })

  it("writes marks only for the tasks in scope", () => {
    const tasks = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })]
    const changed = tasksWithCommitment(tasks, "month", "2026-06", ["a", "b"], ["a"], ["b"])
    expect(changed.map((t) => t.id)).toEqual(["a", "b"])
    expect(taskIsRequired(changed[0], "month", "2026-06")).toBe(true)
    expect(taskIsPrioritized(changed[1], "month", "2026-06")).toBe(true)
  })
})

describe("period load", () => {
  it("counts days left through the end of the week and month, including today", () => {
    expect(daysLeftInPeriod("week", noon, noon)).toBe(2)
    expect(daysLeftLabel("week", noon, noon)).toBe("2 days left in week")
    expect(daysLeftInPeriod("month", noon, noon)).toBe(11)
    expect(daysLeftLabel("month", noon, noon)).toBe("11 days left in month")
    expect(daysLeftLabel("day", noon, noon)).toBe("Today")

    const sunday = new Date(2026, 5, 21, 9, 0, 0)
    expect(daysLeftLabel("week", sunday, sunday)).toBe("1 day left in week")
    expect(daysLeftInPeriod("week", new Date(2026, 5, 8, 12), noon)).toBe(0)
  })

  it("adds future days × 10 to the hours left today before 11pm", () => {
    expect(hoursLeftBeforeDayEnd(noon)).toBe(11)
    expect(futureDaysInPeriod("week", noon, noon)).toBe(1)
    expect(workingHoursLeft("week", noon, noon)).toBe(21)
    expect(workingHoursLeft("day", noon, noon)).toBe(11)
    expect(futureDaysInPeriod("day", noon, noon)).toBe(0)

    const late = new Date(2026, 5, 20, 23, 30, 0)
    expect(hoursLeftBeforeDayEnd(late)).toBe(0)
    expect(workingHoursLeft("day", late, late)).toBe(0)

    const nextWeek = new Date(2026, 5, 22, 12, 0, 0)
    expect(workingHoursLeft("week", nextWeek, noon)).toBe(70)

    expect(hoursLeftUntilMidnight(noon)).toBe(12)
    expect(hoursLeftInPeriod("day", noon, noon)).toBe(12)
    expect(hoursLeftInPeriod("week", noon, noon)).toBe(36)
    expect(hoursLeftUntilMidnight(late)).toBe(0.5)
    expect(hoursLeftInPeriod("day", late, late)).toBe(0.5)
    expect(hoursLeftInPeriod("week", nextWeek, noon)).toBe(168)
  })

  it("filters estimated time and bands comfort", () => {
    const tasks = [
      task({ id: "req", estimatedDuration: 60, todoMarks: [{ period: "week", periodKey: "2026-06-15_2026-06-21", required: true }] }),
      task({ id: "pri", estimatedDuration: 30, todoMarks: [{ period: "week", periodKey: "2026-06-15_2026-06-21", prioritized: true }] }),
      task({ id: "plain", estimatedDuration: 15 }),
      task({ id: "blank", todoMarks: [{ period: "week", periodKey: "2026-06-15_2026-06-21", required: true }] }),
    ]
    const todos = tasks.map((t) => ({ id: t.id, estimatedDuration: t.estimatedDuration }))
    const key = "2026-06-15_2026-06-21"
    expect(summedEstimate(todos, tasks, "week", key, "all").minutes).toBe(105)
    expect(summedEstimate(todos, tasks, "week", key, "required")).toEqual({
      minutes: 60,
      included: 2,
      unestimated: 1,
    })
    expect(summedEstimate(todos, tasks, "week", key, "required-prioritized").minutes).toBe(90)

    const rolled = task({
      id: "roll",
      estimatedDuration: 10,
      subtasks: [
        { id: "a", description: "A", completed: false, estimatedDuration: 25 },
        {
          id: "b",
          description: "B",
          completed: false,
          estimatedDuration: 5,
          subtasks: [{ id: "c", description: "C", completed: false, estimatedDuration: 40 }],
        },
      ],
    })
    expect(summedEstimate([{ id: "roll" }], [rolled], "week", key, "all").minutes).toBe(65)

    expect(comfortBand(comfortRatio(30, 2))).toBe("manageable")
    expect(comfortRatio(60, 2)).toBe(1)
    expect(comfortBand(1)).toBe("overfilled")
    expect(comfortBand(10)).toBe("overfilled")
    expect(comfortBand(comfortRatio(600, 1))).toBe("behind")
    expect(comfortBand(comfortRatio(60, 0))).toBe("behind")
    expect(comfortRatio(0, 0)).toBe(0)
    expect(formatComfortRatio(Number.POSITIVE_INFINITY)).toBe("∞")
  })
})
