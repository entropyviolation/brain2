import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  habitCreatedAtMs,
  migrateHabitSortMode,
  parseHabitSortMode,
  sortHabits,
} from "./habit-sort"

const stretch: WeeklyTask = { id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, frequency: "daily" }
const water: WeeklyTask = { id: "water", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
const zen: WeeklyTask = { id: "zen", name: "Zen", type: TaskType.BOOLEAN, frequency: "daily" }

describe("parseHabitSortMode / migrateHabitSortMode", () => {
  it("accepts the five named modes", () => {
    expect(parseHabitSortMode("alphabetical")).toBe("alphabetical")
    expect(parseHabitSortMode("nope")).toBeNull()
  })

  it("migrates the old priority boolean", () => {
    expect(migrateHabitSortMode({ sortHabitsByPriorityFlag: true })).toBe("priority")
    expect(migrateHabitSortMode({ sortHabitsByPriorityFlag: false })).toBe("default")
    expect(migrateHabitSortMode({ habitSortMode: "created", sortHabitsByPriorityFlag: true })).toBe("created")
  })
})

describe("habitCreatedAtMs", () => {
  it("prefers createdAt, then stamped ids, then index", () => {
    expect(habitCreatedAtMs({ ...stretch, createdAt: "2026-01-02T00:00:00.000Z" }, 9)).toBe(
      new Date("2026-01-02T00:00:00.000Z").getTime(),
    )
    expect(habitCreatedAtMs({ ...stretch, id: "task-1700000000000" }, 3)).toBe(1700000000000)
    expect(habitCreatedAtMs({ ...stretch, id: "task-1" }, 4)).toBe(4)
  })
})

describe("sortHabits", () => {
  const asOf = new Date(2026, 8, 16)
  const empty = { data: {}, asOf, frequency: "daily" as const, completionPercent: () => 0 }

  it("keeps store order for default", () => {
    expect(sortHabits([stretch, water], "default", empty).map((t) => t.id)).toEqual(["stretch", "water"])
  })

  it("flips alphabetical when descending", () => {
    expect(
      sortHabits([zen, stretch, water], "alphabetical", { ...empty, descending: true }).map((t) => t.id),
    ).toEqual(["zen", "water", "stretch"])
  })

  it("sorts alphabetical by name", () => {
    expect(sortHabits([zen, stretch, water], "alphabetical", empty).map((t) => t.id)).toEqual([
      "stretch",
      "water",
      "zen",
    ])
  })

  it("sorts date created newest first", () => {
    const older = { ...stretch, createdAt: "2024-01-01T00:00:00.000Z" }
    const newer = { ...water, createdAt: "2026-06-01T00:00:00.000Z" }
    expect(sortHabits([older, newer], "created", empty).map((t) => t.id)).toEqual(["water", "stretch"])
  })

  it("sorts by priority weight (pin first)", () => {
    const pinned = { ...water, priorityPinned: true }
    expect(sortHabits([stretch, pinned], "priority", empty).map((t) => t.id)).toEqual(["water", "stretch"])
  })

  it("sorts by weekly completion percent descending", () => {
    const week = [new Date(2026, 8, 14)]
    const key = formatLocalDateKey(week[0])
    const data = { [key]: { water: { completed: true } } }
    const pct = (id: string) => (id === "water" ? 100 : 0)
    expect(
      sortHabits([stretch, water], "weeklyCompletion", {
        data,
        asOf,
        frequency: "daily",
        completionPercent: pct,
      }).map((t) => t.id),
    ).toEqual(["water", "stretch"])
  })
})
