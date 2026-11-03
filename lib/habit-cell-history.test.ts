/**
 * lib/habit-cell-history.test.ts — Cell change log: describe, append, cap, store writes.
 */
import { beforeEach, describe, expect, it } from "vitest"
import {
  HABIT_CELL_HISTORY_LIMIT,
  appendCellChange,
  describeCellChange,
  resolveCellSource,
  withCellHistory,
} from "@/lib/habit-cell-history"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type HabitCellChange, type WeeklyTask } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

const yesNo: WeeklyTask = { id: "yn", name: "water plants", type: TaskType.BOOLEAN, frequency: "daily" }
const goal: WeeklyTask = { id: "g", name: "read", type: TaskType.GOAL, goal: 10, frequency: "weekly" }
const at = new Date("2026-11-02T10:00:00.000Z")

describe("describeCellChange", () => {
  it("logs the reading moving", () => {
    expect(describeCellChange(yesNo, undefined, { completed: true }, "manual-desktop", at)).toEqual({
      at: "2026-11-02T10:00:00.000Z",
      source: "manual-desktop",
      from: false,
      to: true,
    })
    expect(describeCellChange(goal, { value: 3 }, { value: 5 }, "auto-tracking", at)?.to).toBe(5)
  })

  it("logs a missed mark with the reason, and skips a write that changes nothing", () => {
    const change = describeCellChange(yesNo, {}, { missedOpportunity: true, missReason: "rain" }, "wand", at)
    expect(change).toMatchObject({ from: false, to: true, note: "missed: rain", source: "wand" })
    expect(describeCellChange(yesNo, { completed: true }, { completed: true, updatedAt: 9 }, "wand", at)).toBeNull()
  })

  it("a missed-op patch with no source is the wand", () => {
    expect(resolveCellSource({ missedOpportunity: true })).toBe("wand")
    expect(resolveCellSource({ completed: true })).toBe("manual-desktop")
    expect(resolveCellSource({ completed: true }, "llm-suggestion")).toBe("llm-suggestion")
  })
})

describe("history cap", () => {
  it("keeps only the newest entries", () => {
    let list: HabitCellChange[] | undefined
    for (let i = 0; i < HABIT_CELL_HISTORY_LIMIT + 5; i++) {
      list = appendCellChange(list, { at: String(i), source: "auto-link", to: i })
    }
    expect(list).toHaveLength(HABIT_CELL_HISTORY_LIMIT)
    expect(list?.[0].to).toBe(5)
    expect(list?.at(-1)?.to).toBe(HABIT_CELL_HISTORY_LIMIT + 4)
  })

  it("carries the previous history when nothing changed", () => {
    const prev = { completed: true, changes: [{ at: "x", source: "wand" as const, to: true }] }
    expect(withCellHistory(yesNo, prev, { completed: true }, "wand", at).changes).toEqual(prev.changes)
  })
})

describe("store writes", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([yesNo, goal])
  })

  it("appends on every write with its source", () => {
    const day = new Date(2026, 10, 2)
    const store = useHabitsStore.getState()
    store.updateCompletion("yn", day, { completed: true })
    store.updateCompletion("yn", day, { completed: false }, "llm-suggestion")
    store.updateCompletion("yn", day, { missedOpportunity: true, missReason: "away" })
    const cell = useHabitsStore.getState().weeklyData["2026-11-02"].yn
    expect(cell.changes?.map((c) => [c.source, c.to])).toEqual([
      ["manual-desktop", true],
      ["llm-suggestion", false],
      ["wand", true],
    ])
    expect(cell.changes?.[2].note).toBe("missed: away")
  })

  it("the exemption wand logs on the period cell", () => {
    useHabitsStore.getState().setHabitExemption("daily", "2026-11-03", "yn", true)
    const cell = useHabitsStore.getState().weeklyData["2026-11-03"]?.yn
    expect(cell?.changes).toEqual([expect.objectContaining({ source: "wand", from: false, to: true, note: "exempt" })])
  })

  it("weekly writes log too", () => {
    useHabitsStore.getState().updateWeeklyHabitCompletion("g", new Date(2026, 10, 2), { value: 4 }, "auto-link")
    const book = useHabitsStore.getState().weeklyHabitData
    const cell = Object.values(book)[0]?.g
    expect(cell?.changes?.[0]).toMatchObject({ source: "auto-link", from: null, to: 4 })
  })
})
