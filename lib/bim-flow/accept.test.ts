import { beforeEach, describe, expect, it } from "vitest"
import { undoLastAction } from "@/lib/action-history"
import { getDefaultHabits, useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { TaskType } from "@/lib/types"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"
import { acceptSuggestion, acceptedBlockStamp, dayPieces } from "./accept"
import type { Suggestion } from "./suggestions"

describe("dayPieces", () => {
  it("keeps a same-day block whole", () => {
    expect(dayPieces(new Date(2026, 9, 29, 10).toISOString(), new Date(2026, 9, 29, 11, 30).toISOString())).toEqual([{ date: "2026-10-29", startMin: 600, endMin: 690 }])
  })
  it("splits a block over midnight", () => {
    expect(dayPieces(new Date(2026, 9, 29, 23).toISOString(), new Date(2026, 9, 30, 1).toISOString())).toEqual([
      { date: "2026-10-29", startMin: 1380, endMin: 1440 },
      { date: "2026-10-30", startMin: 0, endMin: 60 },
    ])
  })
})

const base = (over: Partial<Suggestion>): Suggestion => ({
  id: "s1",
  kind: "timeblock",
  title: "Dishes",
  detail: "",
  at: new Date(2026, 9, 29, 10).toISOString(),
  source: "bim",
  why: "said so",
  evidence: [],
  ...over,
})

const activity = () => useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "activity")

describe("acceptSuggestion", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
  })

  it("paints a block over midnight as two stamped Activity rows, undone in one step", () => {
    const s = base({ at: new Date(2026, 9, 29, 23).toISOString(), end: new Date(2026, 9, 30, 1).toISOString(), estimated: true })
    expect(acceptSuggestion(s).ok).toBe(true)
    const rows = activity()
    expect(rows.map((e) => [e.date, e.startMin, e.endMin])).toEqual([
      ["2026-10-29", 1380, 1440],
      ["2026-10-30", 0, 60],
    ])
    for (const e of rows) {
      expect(e.generatedBy).toEqual(acceptedBlockStamp("s1"))
      expect(e.precision).toBe("estimated")
      expect(e.notes).toContain("Suggested by BIM flow")
    }
    expect(undoLastAction()).toBe(true)
    expect(activity()).toHaveLength(0)
  })

  it("refuses a block whose time was painted since", () => {
    const s = base({ end: new Date(2026, 9, 29, 11).toISOString() })
    expect(acceptSuggestion(s).ok).toBe(true)
    const again = acceptSuggestion({ ...s, id: "s2" })
    expect(again.ok).toBe(false)
    expect(activity()).toHaveLength(1)
  })

  it("adds an item through Quick Add", () => {
    const before = useTaskStore.getState().tasks.length
    const r = acceptSuggestion(base({ kind: "item", title: "buy lemons" }))
    expect(r.ok).toBe(true)
    const added = useTaskStore.getState().tasks.slice(before)
    expect(added.map((t) => t.title)).toContain("buy lemons")
  })

  it("marks a habit done on the suggestion's day", () => {
    const habit = useHabitsStore.getState().tasks.find((t) => t.type === TaskType.BOOLEAN)
    expect(habit).toBeTruthy()
    const r = acceptSuggestion(base({ kind: "habit", title: habit!.name, habitId: habit!.id }))
    expect(r.ok).toBe(true)
    expect(useHabitsStore.getState().weeklyData["2026-10-29"]?.[habit!.id]?.completed).toBe(true)
  })

  it("refuses a habit that no longer exists", () => {
    expect(acceptSuggestion(base({ kind: "habit", habitId: "gone" })).ok).toBe(false)
  })
})
