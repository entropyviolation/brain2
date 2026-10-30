import { describe, expect, it } from "vitest"
import { TaskType, type Task, type WeeklyTask } from "@/lib/types"
import { habitDoneLogId } from "@/lib/habit-done-log"
import {
  isTaskCompletedOnDay,
  planGemChipTaskIds,
  planGemTokensForDay,
  sourceHabitIdFromTask,
} from "./plan-gem-day"

const DAY = new Date("2026-06-19T12:00:00")
const OTHER = new Date("2026-06-18T12:00:00")

function listTask(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "completed",
    createdAt: DAY,
    completed: true,
    completedDate: DAY,
    lists: [],
    ...partial,
  }
}

function habit(partial: Partial<WeeklyTask> & Pick<WeeklyTask, "id" | "name">): WeeklyTask {
  return {
    type: TaskType.BOOLEAN,
    frequency: "daily",
    gem: "/gems-removebackground/gem5.png",
    ...partial,
  }
}

describe("planGemTokensForDay", () => {
  it("maps a completed list item to its Lists orb and hides its chip", () => {
    const task = listTask({
      id: "write-brief",
      description: "Write brief",
      icon: "/orbs-removebackground/abc.png",
    })
    const tokens = planGemTokensForDay({ date: DAY, habits: [], weeklyData: {}, tasks: [task] })
    expect(tokens).toEqual([
      expect.objectContaining({
        kind: "task",
        title: "Write brief",
        src: "/orbs-removebackground/abc.png",
        openTaskId: "write-brief",
      }),
    ])
    expect(planGemChipTaskIds(tokens, [task], DAY).has("write-brief")).toBe(true)
  })

  it("maps a met daily habit to resolveTaskGem and not a second list orb", () => {
    const water = habit({ id: "water", name: "Drink water" })
    const done = listTask({
      id: habitDoneLogId("water", DAY),
      description: "Drink water",
      loggedAction: true,
      attributes: { sourceHabitId: "water" },
    })
    const tokens = planGemTokensForDay({
      date: DAY,
      habits: [water],
      weeklyData: { "2026-06-19": { water: { completed: true } } },
      tasks: [done],
    })
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({
      kind: "habit",
      title: "Drink water",
      src: "/gems-removebackground/gem5.png",
      openTaskId: done.id,
    })
  })

  it("still shows a daily habit gem when the done-log row is missing", () => {
    const stretch = habit({ id: "stretch", name: "Stretch", gem: "/gems-removebackground/gem6.png" })
    const tokens = planGemTokensForDay({
      date: DAY,
      habits: [stretch],
      weeklyData: { "2026-06-19": { stretch: { completed: true } } },
      tasks: [],
    })
    expect(tokens[0]).toMatchObject({
      kind: "habit",
      title: "Stretch",
      src: "/gems-removebackground/gem6.png",
      openTaskId: habitDoneLogId("stretch", DAY),
    })
  })

  it("ignores completions on other days and incomplete items", () => {
    const tokens = planGemTokensForDay({
      date: DAY,
      habits: [habit({ id: "water", name: "Drink water" })],
      weeklyData: { "2026-06-18": { water: { completed: true } } },
      tasks: [
        listTask({ id: "old", description: "Old", completedDate: OTHER }),
        listTask({ id: "open", description: "Open", completed: false, completedDate: undefined, stage: "scheduled" }),
      ],
    })
    expect(tokens).toEqual([])
  })

  it("parses habit-done ids when sourceHabitId is absent", () => {
    expect(sourceHabitIdFromTask({ id: habitDoneLogId("water", DAY), attributes: {} })).toBe("water")
    expect(isTaskCompletedOnDay({ completed: true, completedDate: DAY }, DAY)).toBe(true)
    expect(isTaskCompletedOnDay({ completed: true, completedDate: OTHER }, DAY)).toBe(false)
  })

  it("falls back to a stable Lists orb when the item has no custom icon", () => {
    const task = listTask({ id: "no-icon", description: "No icon" })
    const tokens = planGemTokensForDay({ date: DAY, habits: [], weeklyData: {}, tasks: [task] })
    expect(tokens[0]?.kind).toBe("task")
    expect(tokens[0]?.src).toMatch(/^\/orbs-removebackground\//)
  })
})
