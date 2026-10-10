import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { applyHabitOrder, mergeVisibleOrder, pointerBeforeId, reorderIdList } from "./habit-order"

const daily = (id: string): WeeklyTask => ({ id, name: id, type: TaskType.BOOLEAN, frequency: "daily" })
const weekly = (id: string): WeeklyTask => ({ id, name: id, type: TaskType.BOOLEAN, frequency: "weekly" })

describe("applyHabitOrder", () => {
  it("rewrites one frequency and leaves the other rows and no completion map", () => {
    const tasks = [daily("a"), weekly("w"), daily("b")]
    const next = applyHabitOrder(tasks, "daily", ["b", "a"])
    expect(next.map((task) => task.id)).toEqual(["b", "w", "a"])
    expect(next[1]).toBe(tasks[1])
  })
})

describe("reorderIdList", () => {
  it("moves an id before another, or to the end", () => {
    expect(reorderIdList(["a", "b", "c"], "a", "c")).toEqual(["b", "a", "c"])
    expect(reorderIdList(["a", "b", "c"], "a", null)).toEqual(["b", "c", "a"])
    expect(pointerBeforeId(
      [
        { id: "a", top: 0, height: 40 },
        { id: "b", top: 40, height: 40 },
      ],
      "a",
      70,
    )).toBeNull()
  })

  it("keeps hidden ids in place when the visible order changes", () => {
    expect(mergeVisibleOrder(["a", "hidden", "b"], ["b", "a"])).toEqual(["b", "hidden", "a"])
  })
})
