import { describe, expect, it } from "vitest"
import { getDefaultHabits } from "./habits-store"
import { TaskType } from "./types"
import { effectiveCoverageLink, effectiveDailyFloorLink } from "./habit-completion-source"

describe("fresh habit seed", () => {
  it("ships weekly and monthly examples covering yes/no, goal, text, and Tracking auto-fill", () => {
    const seeds = getDefaultHabits()
    const weekly = seeds.filter((task) => task.frequency === "weekly")
    const monthly = seeds.filter((task) => task.frequency === "monthly")
    const daily = seeds.filter((task) => (task.frequency ?? "daily") === "daily")
    const season = seeds.filter((task) => task.frequency === "quarterly")

    expect(daily.length).toBeGreaterThanOrEqual(16)
    expect(weekly.map((task) => task.id)).toEqual(
      expect.arrayContaining([
        "task-w-review",
        "task-w-coverage",
        "task-w-daily-floor",
        "task-w-deep",
        "task-w-workout",
        "task-w-lesson",
      ]),
    )
    expect(monthly.map((task) => task.id)).toEqual(
      expect.arrayContaining(["task-m-bills", "task-m-coverage", "task-m-book", "task-m-chores", "task-m-theme"]),
    )
    expect(season.map((task) => task.id)).toContain("task-q-coverage")

    expect(weekly.some((task) => task.type === TaskType.BOOLEAN)).toBe(true)
    expect(weekly.some((task) => task.type === TaskType.TEXT)).toBe(true)
    expect(weekly.find((task) => task.id === "task-w-deep")?.trackingLink?.tagIds).toEqual(["tag-work"])
    expect(weekly.find((task) => task.id === "task-w-workout")?.trackingLink?.threshold).toBe(30)
    expect(effectiveCoverageLink(weekly.find((task) => task.id === "task-w-coverage")!)?.threshold).toBe(75)
    expect(effectiveDailyFloorLink(weekly.find((task) => task.id === "task-w-daily-floor")!)).toEqual({
      floorPercent: 0,
      enabled: true,
    })
    expect(effectiveCoverageLink(daily.find((task) => task.id === "task-d-coverage")!)?.threshold).toBe(75)
    expect(effectiveCoverageLink(monthly.find((task) => task.id === "task-m-coverage")!)?.threshold).toBe(75)
    expect(effectiveCoverageLink(season.find((task) => task.id === "task-q-coverage")!)?.threshold).toBe(75)

    expect(monthly.some((task) => task.type === TaskType.BOOLEAN)).toBe(true)
    expect(monthly.some((task) => task.type === TaskType.TEXT)).toBe(true)
    expect(monthly.find((task) => task.id === "task-m-chores")?.trackingLink?.tagIds).toEqual(["tag-cleaning"])
    expect(monthly.find((task) => task.id === "task-m-book")?.goal).toBe(1)
  })
})
