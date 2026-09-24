import { describe, expect, it } from "vitest"
import { getDefaultHabits } from "./habits-store"
import { TaskType } from "./types"

describe("fresh habit seed", () => {
  it("ships weekly and monthly examples covering yes/no, goal, text, and Tracking auto-fill", () => {
    const seeds = getDefaultHabits()
    const weekly = seeds.filter((task) => task.frequency === "weekly")
    const monthly = seeds.filter((task) => task.frequency === "monthly")
    const daily = seeds.filter((task) => (task.frequency ?? "daily") === "daily")

    expect(daily).toHaveLength(15)
    expect(weekly.map((task) => task.id)).toEqual([
      "task-w-review",
      "task-w-deep",
      "task-w-workout",
      "task-w-lesson",
    ])
    expect(monthly.map((task) => task.id)).toEqual([
      "task-m-bills",
      "task-m-book",
      "task-m-chores",
      "task-m-theme",
    ])

    expect(weekly.some((task) => task.type === TaskType.BOOLEAN)).toBe(true)
    expect(weekly.some((task) => task.type === TaskType.TEXT)).toBe(true)
    expect(weekly.find((task) => task.id === "task-w-deep")?.trackingLink?.tagIds).toEqual(["tag-work"])
    expect(weekly.find((task) => task.id === "task-w-workout")?.trackingLink?.threshold).toBe(30)

    expect(monthly.some((task) => task.type === TaskType.BOOLEAN)).toBe(true)
    expect(monthly.some((task) => task.type === TaskType.TEXT)).toBe(true)
    expect(monthly.find((task) => task.id === "task-m-chores")?.trackingLink?.tagIds).toEqual(["tag-cleaning"])
    expect(monthly.find((task) => task.id === "task-m-book")?.goal).toBe(1)
  })
})
