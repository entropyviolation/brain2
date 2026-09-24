import { describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { defaultHabitGem } from "@/lib/habit-gems"
import { getDefaultHabits, useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"

describe("habits store gem assignment", () => {
  it("stamps a catalog gem on add and keeps a user-picked gem", () => {
    resetAllStores()
    useHabitsStore.getState().setTasks([])
    useHabitsStore.getState().addTask({ id: "lang-1", name: "Spanish", type: TaskType.BOOLEAN })
    useHabitsStore.getState().addTask({
      id: "lang-2",
      name: "French",
      type: TaskType.BOOLEAN,
      gem: "/gems-removebackground/gem.png",
    })
    const [first, second] = useHabitsStore.getState().tasks
    expect(GEM_PATHS).toContain(first.gem)
    expect(first.gem).not.toBe(defaultHabitGem("boolean"))
    expect(second.gem).toBe("/gems-removebackground/gem.png")
    const again = first.gem
    useHabitsStore.getState().updateTask({ ...first, name: "Spanish daily" })
    expect(useHabitsStore.getState().tasks.find((task) => task.id === "lang-1")?.gem).toBe(again)
  })

  it("assigns seed habits distinct catalog gems, not type slots", () => {
    const seeds = getDefaultHabits()
    const gems = seeds.map((task) => task.gem)
    expect(gems.every((gem) => typeof gem === "string" && GEM_PATHS.includes(gem))).toBe(true)
    const languageLike = seeds.filter((task) => /language|instrument/i.test(task.name))
    expect(languageLike).toHaveLength(2)
    expect(languageLike[0].gem).not.toBe(languageLike[1].gem)
    const booleans = seeds.filter((task) => task.type === TaskType.BOOLEAN)
    expect(new Set(booleans.map((task) => task.gem)).size).toBeGreaterThan(1)
    expect(getDefaultHabits().map((task) => task.gem)).toEqual(gems)
  })
})
