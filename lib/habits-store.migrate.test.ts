import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_PERCENT_LED_TINT } from "@/lib/habit-led"
import { DEFAULT_GRADE_TUBE_COLOR, DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"
import {
  HABITS_STORE_PERSIST_VERSION,
  migrateHabitsState,
  useHabitsStore,
} from "@/lib/habits-store"
import { DEFAULT_WILLPOWER_PHYSICS } from "@/lib/willpower-physics"
import { TaskType } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import { writeAliasedLocal } from "@/lib/storage-keys"

const laundry = {
  id: "custom-laundry",
  name: "laundry",
  type: TaskType.BOOLEAN,
  rewardValue: 10,
}

const dance = {
  id: "custom-dance",
  name: "dance",
  type: TaskType.BOOLEAN,
  rewardValue: 15,
  gem: "/gems-removebackground/gem.png",
}

function v9State() {
  return {
    tasks: [laundry, { ...dance, gem: undefined }],
    categories: [{ id: "category-1", name: "Health", color: "#8cd4a5" }],
    weeklyData: {
      "2026-09-01": { "custom-laundry": { completed: true } },
    },
    weeklyHabitData: { "2026-W36": { "custom-dance": { completed: true } } },
    monthlyHabitData: {},
    gradeTolerance: 90,
    outputGradeTolerance: 85,
    accomplishmentThreshold: 80,
    accomplishmentBonus: 50,
    gradeUsePriority: false,
    outputUsePriority: false,
    goodDaysUsePriority: false,
    habitViewMode: "grid" as const,
    sortHabitsByPriorityFlag: false,
    willpowerImage: null,
    habitGems: {},
  }
}

describe("migrateHabitsState", () => {
  it("keeps v9 tasks and completions while filling v10–v18 keys", () => {
    const next = migrateHabitsState(v9State(), 9)
    expect(next.tasks.map((t) => t.id)).toEqual(["custom-laundry", "custom-dance"])
    expect(next.weeklyData["2026-09-01"]?.["custom-laundry"]?.completed).toBe(true)
    expect(next.weeklyHabitData["2026-W36"]?.["custom-dance"]?.completed).toBe(true)
    expect(next.habitSortMode).toBe("default")
    expect(next.percentLedTint).toBe(DEFAULT_PERCENT_LED_TINT)
    expect(next.habitDayView).toBe(false)
    expect(next.percentLoadingBar).toBe(true)
    expect(next.habitSmallLeds).toBe(true)
    expect(next.hideCompletedToday).toBe(false)
    expect(next.gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
    expect(next.outputGradeTubeColor).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
    expect(next.habitsControlPanelWidth).toBe(196)
    expect(next.willpowerPhysicsHud).toBe(false)
    expect(next.willpowerPhysics.g).toBeGreaterThan(0)
    expect(next.tasks.every((t) => typeof t.gem === "string" && t.gem.length > 0)).toBe(true)
  })

  it("pins a leftover control-panel width back to compact", () => {
    const next = migrateHabitsState({ ...v9State(), habitsControlPanelWidth: 316 }, 16)
    expect(next.habitsControlPanelWidth).toBe(196)
  })

  it("v18 resets leftover wild physics knobs and keeps later edits", () => {
    const reset = migrateHabitsState(
      { ...v9State(), willpowerPhysics: { ...DEFAULT_WILLPOWER_PHYSICS, stirSpeed: 900, chaos: 1 } },
      17,
    )
    expect(reset.willpowerPhysics.stirSpeed).toBe(DEFAULT_WILLPOWER_PHYSICS.stirSpeed)
    expect(reset.willpowerPhysics.chaos).toBe(DEFAULT_WILLPOWER_PHYSICS.chaos)
    const kept = migrateHabitsState(
      { ...v9State(), willpowerPhysics: { ...DEFAULT_WILLPOWER_PHYSICS, g: 400 } },
      18,
    )
    expect(kept.willpowerPhysics.g).toBe(400)
    expect(kept.habitsControlPanelWidth).toBe(196)
  })

  it("keeps v10 sort mode and does not empty tasks", () => {
    const next = migrateHabitsState(
      { ...v9State(), habitSortMode: "alphabetical", sortHabitsByPriorityFlag: false },
      10,
    )
    expect(next.tasks).toHaveLength(2)
    expect(next.habitSortMode).toBe("alphabetical")
    expect(next.sortHabitsByPriorityFlag).toBe(false)
  })

  it("keeps v13 gems and fills tube colors", () => {
    const next = migrateHabitsState(
      {
        ...v9State(),
        tasks: [laundry, dance],
        habitSortMode: "created",
        percentLedTint: "#49ff6a",
        habitDayView: true,
        percentLoadingBar: false,
      },
      13,
    )
    expect(next.tasks.find((t) => t.id === "custom-dance")?.gem).toBe("/gems-removebackground/gem.png")
    expect(next.habitDayView).toBe(true)
    expect(next.percentLoadingBar).toBe(false)
    expect(next.habitSmallLeds).toBe(true)
    expect(next.gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
    expect(next.outputGradeTubeColor).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
  })

  it("keeps present tube and LED colors across a version bump", () => {
    const next = migrateHabitsState(
      {
        ...v9State(),
        percentLedTint: "#ff00aa",
        gradeTubeColor: "#112233",
        outputGradeTubeColor: "#abcdef",
      },
      13,
    )
    expect(next.percentLedTint).toBe("#ff00aa")
    expect(next.gradeTubeColor).toBe("#112233")
    expect(next.outputGradeTubeColor).toBe("#abcdef")
  })

  it("keeps a v15 Small LEDs off preference", () => {
    const next = migrateHabitsState({ ...v9State(), habitSmallLeds: false }, 15)
    expect(next.habitSmallLeds).toBe(false)
    expect(next.tasks).toHaveLength(2)
  })

  it("does not invent an empty tasks array when the blob omitted tasks", () => {
    const next = migrateHabitsState({ weeklyData: { "2026-09-01": {} } }, 9)
    expect(next.tasks).toBeUndefined()
  })

  it("unwraps a persist wrapper and survives null input", () => {
    const wrapped = migrateHabitsState({ state: v9State(), version: 9 }, 9)
    expect(wrapped.tasks.map((t) => t.name)).toEqual(["laundry", "dance"])
    expect(() => migrateHabitsState(null, 9)).not.toThrow()
    expect(migrateHabitsState(null, 9).tasks).toBeUndefined()
  })
})

describe("habits store rehydrate from older persist versions", () => {
  beforeEach(() => {
    resetAllStores()
    sessionStorage.clear()
  })

  async function rehydrate(version: number, state: object) {
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({ state, version }),
    )
    await useHabitsStore.persist.rehydrate()
  }

  it("hydrates v9 JSON with custom tasks still present", async () => {
    await rehydrate(9, v9State())
    const { tasks, weeklyData, habitSortMode, percentLedTint } = useHabitsStore.getState()
    expect(tasks.map((t) => t.name)).toEqual(["laundry", "dance"])
    expect(weeklyData["2026-09-01"]?.["custom-laundry"]?.completed).toBe(true)
    expect(habitSortMode).toBe("default")
    expect(percentLedTint).toBe(DEFAULT_PERCENT_LED_TINT)
    expect(JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}").version).toBe(
      HABITS_STORE_PERSIST_VERSION,
    )
  })

  it("hydrates v10 JSON keeping sort and tasks", async () => {
    await rehydrate(10, { ...v9State(), habitSortMode: "priority", sortHabitsByPriorityFlag: true })
    expect(useHabitsStore.getState().tasks).toHaveLength(2)
    expect(useHabitsStore.getState().habitSortMode).toBe("priority")
  })

  it("hydrates v13 JSON keeping gems and completions", async () => {
    await rehydrate(13, {
      ...v9State(),
      tasks: [laundry, dance],
      habitDayView: false,
      percentLoadingBar: true,
    })
    const { tasks, weeklyHabitData, gradeTubeColor } = useHabitsStore.getState()
    expect(tasks.find((t) => t.id === "custom-dance")?.gem).toBe("/gems-removebackground/gem.png")
    expect(weeklyHabitData["2026-W36"]?.["custom-dance"]?.completed).toBe(true)
    expect(gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
  })

  it("hydrates v13 JSON without colors using later defaults", async () => {
    await rehydrate(13, {
      ...v9State(),
      tasks: [laundry, dance],
    })
    const { percentLedTint, gradeTubeColor, outputGradeTubeColor } = useHabitsStore.getState()
    expect(percentLedTint).toBe(DEFAULT_PERCENT_LED_TINT)
    expect(gradeTubeColor).toBe(DEFAULT_GRADE_TUBE_COLOR)
    expect(outputGradeTubeColor).toBe(DEFAULT_OUTPUT_TUBE_COLOR)
  })

  it("hydrates v13 JSON with colors and keeps them after the version bump", async () => {
    await rehydrate(13, {
      ...v9State(),
      percentLedTint: "#c0ffee",
      gradeTubeColor: "#aa11bb",
      outputGradeTubeColor: "#11ccdd",
    })
    const first = useHabitsStore.getState()
    expect(first.percentLedTint).toBe("#c0ffee")
    expect(first.gradeTubeColor).toBe("#aa11bb")
    expect(first.outputGradeTubeColor).toBe("#11ccdd")
    expect(JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}").version).toBe(
      HABITS_STORE_PERSIST_VERSION,
    )
  })

  it("does not revert colors on a simulated refresh", async () => {
    localStorage.removeItem("cogs-habit-led-tint")
    localStorage.removeItem("cogs-habit-grade-tube")
    localStorage.removeItem("cogs-habit-output-tube")
    await rehydrate(15, {
      ...v9State(),
      percentLedTint: "#ff00aa",
      gradeTubeColor: "#224466",
      outputGradeTubeColor: "#8866ff",
      appearanceRev: 2,
    })
    await useHabitsStore.persist.rehydrate()
    const again = useHabitsStore.getState()
    expect(again.percentLedTint).toBe("#ff00aa")
    expect(again.gradeTubeColor).toBe("#224466")
    expect(again.outputGradeTubeColor).toBe("#8866ff")
    const stored = JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string; gradeTubeColor?: string; outputGradeTubeColor?: string }
    }
    expect(stored.state?.percentLedTint).toBe("#ff00aa")
    expect(stored.state?.gradeTubeColor).toBe("#224466")
    expect(stored.state?.outputGradeTubeColor).toBe("#8866ff")
  })

  it("does not roll live LED tint back when a staler snapshot rehydrates", async () => {
    await rehydrate(15, {
      ...v9State(),
      percentLedTint: "#112233",
      gradeTubeColor: "#445566",
      outputGradeTubeColor: "#778899",
    })
    useHabitsStore.getState().setPercentLedTint("#ff00aa")
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({
        state: {
          ...v9State(),
          percentLedTint: "#49ff6a",
          gradeTubeColor: "#445566",
          outputGradeTubeColor: "#778899",
          appearanceRev: 0,
        },
        version: HABITS_STORE_PERSIST_VERSION,
      }),
    )
    await useHabitsStore.persist.rehydrate()
    expect(useHabitsStore.getState().percentLedTint).toBe("#ff00aa")
  })

  it("does not let a stale purple LED pin overwrite a newer blob tint on refresh", async () => {
    writeAliasedLocal("cogs-habit-led-tint", "#7e14ff")
    await rehydrate(15, {
      ...v9State(),
      percentLedTint: "#00cc88",
      appearanceRev: 3,
    })
    expect(useHabitsStore.getState().percentLedTint).toBe("#00cc88")
    expect(localStorage.getItem("cogs-habit-led-tint")).toBe("#00cc88")
  })

  it("keeps an LED tint picked before hydration finished", async () => {
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({
        state: { ...v9State(), percentLedTint: "#7e14ff", appearanceRev: 6 },
        version: HABITS_STORE_PERSIST_VERSION,
      }),
    )
    writeAliasedLocal("cogs-habit-led-tint", "#7e14ff")
    useHabitsStore.setState({ percentLedTint: DEFAULT_PERCENT_LED_TINT, appearanceRev: 0 })

    useHabitsStore.getState().setPercentLedTint("#00cc88")
    sessionStorage.clear()
    await useHabitsStore.persist.rehydrate()

    expect(useHabitsStore.getState().percentLedTint).toBe("#00cc88")
    expect(localStorage.getItem("cogs-habit-led-tint")).toBe("#00cc88")
  })

  it("does not roll a live LED tint back when a later snapshot rehydrates", async () => {
    await rehydrate(15, {
      ...v9State(),
      percentLedTint: "#7e14ff",
      appearanceRev: 2,
    })
    useHabitsStore.getState().setPercentLedTint("#00cc88")
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({
        state: {
          ...v9State(),
          percentLedTint: "#7e14ff",
          appearanceRev: 9,
        },
        version: HABITS_STORE_PERSIST_VERSION,
      }),
    )
    await useHabitsStore.persist.rehydrate()
    expect(useHabitsStore.getState().percentLedTint).toBe("#00cc88")
  })

  it("keeps a renamed habit and a typed completion when a staler snapshot rehydrates", async () => {
    await rehydrate(18, { ...v9State(), contentRev: 10 })
    const laundryTask = useHabitsStore.getState().tasks.find((t) => t.id === "custom-laundry")
    expect(laundryTask).toBeTruthy()
    useHabitsStore.getState().updateTask({ ...laundryTask!, name: "fold shirts" })
    useHabitsStore.getState().updateCompletion("custom-laundry", new Date(2026, 8, 2, 12), { completed: true })
    const liveRev = useHabitsStore.getState().contentRev
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({
        state: { ...v9State(), contentRev: liveRev - 1 },
        version: HABITS_STORE_PERSIST_VERSION,
      }),
    )
    await useHabitsStore.persist.rehydrate()
    const state = useHabitsStore.getState()
    expect(state.tasks.find((t) => t.id === "custom-laundry")?.name).toBe("fold shirts")
    expect(state.weeklyData["2026-09-02"]?.["custom-laundry"]?.completed).toBe(true)
    const stored = JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}") as {
      state?: { tasks?: { id: string; name: string }[]; weeklyData?: Record<string, Record<string, { completed?: boolean }>> }
    }
    expect(stored.state?.tasks?.find((t) => t.id === "custom-laundry")?.name).toBe("fold shirts")
    expect(stored.state?.weeklyData?.["2026-09-02"]?.["custom-laundry"]?.completed).toBe(true)
  })

  it("fills disk completions when a hollow live vault has a newer contentRev", async () => {
    await rehydrate(18, { ...v9State(), contentRev: 10 })
    expect(useHabitsStore.getState().weeklyData["2026-09-01"]?.["custom-laundry"]?.completed).toBe(true)
    useHabitsStore.setState({
      tasks: useHabitsStore.getState().tasks.map((t) => ({ ...t, id: `task-${t.id}` })),
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},
      contentRev: Date.now(),
    })
    writeAliasedLocal(
      "cogs-habits-store",
      JSON.stringify({
        state: { ...v9State(), contentRev: 10 },
        version: HABITS_STORE_PERSIST_VERSION,
      }),
    )
    await useHabitsStore.persist.rehydrate()
    const state = useHabitsStore.getState()
    expect(state.weeklyData["2026-09-01"]?.["custom-laundry"]?.completed).toBe(true)
    expect(state.weeklyHabitData["2026-W36"]?.["custom-dance"]?.completed).toBe(true)
    expect(state.tasks.find((t) => t.id === "custom-laundry")).toBeTruthy()
  })

  it("keeps hideCompletedToday across migrate", () => {
    const next = migrateHabitsState({ ...v9State(), hideCompletedToday: true }, 18)
    expect(next.hideCompletedToday).toBe(true)
  })

  it("starts the exemption wand off and with empty override books", () => {
    const next = migrateHabitsState(v9State(), 19)
    expect(next.exemptionWand).toBe(false)
    expect(next.habitExemptions).toEqual({ daily: {}, weekly: {}, monthly: {} })
  })
})

describe("habit content writes", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("keeps details the edit did not mention and stamps contentRev", () => {
    useHabitsStore.getState().setTasks([
      {
        id: "h",
        name: "Water",
        type: TaskType.BOOLEAN,
        rewardValue: 10,
        categoryId: "health",
        frequency: "daily",
      },
    ])
    const before = useHabitsStore.getState().contentRev
    const current = useHabitsStore.getState().tasks[0]
    useHabitsStore.getState().updateTask({ ...current, name: "Water more" })
    const next = useHabitsStore.getState().tasks[0]
    expect(next.name).toBe("Water more")
    expect(next.categoryId).toBe("health")
    expect(useHabitsStore.getState().contentRev).toBeGreaterThan(before)
  })

  it("merges a completion patch onto the cell already stored", () => {
    useHabitsStore.getState().setTasks([
      {
        id: "h",
        name: "Pages",
        type: TaskType.GOAL,
        goal: 3,
        unit: "pages",
        rewardValue: 10,
        frequency: "daily",
      },
    ])
    const day = new Date(2026, 8, 2, 12)
    useHabitsStore.getState().updateCompletion("h", day, { value: 2, goal: 3, trackedValue: 1, manualValue: 1 })
    useHabitsStore.getState().updateCompletion("h", day, { value: 4, goal: 3 })
    const cell = useHabitsStore.getState().weeklyData["2026-09-02"]?.h
    expect(cell?.value).toBe(4)
    expect(cell?.trackedValue).toBe(1)
    expect(cell?.completed).toBe(true)
  })
})
