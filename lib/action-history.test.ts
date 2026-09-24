/**
 * Last-action undo: paint, erase, batch fill, redo, and silence.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  canRedo,
  canUndo,
  peekUndoLabel,
  redoLastAction,
  resetActionHistory,
  runAsAction,
  undoLastAction,
  withoutUndo,
} from "./action-history"
import { useTimeTrackingStore } from "./time-tracking-store"
import { useSleepStore } from "./sleep-store"
import { useHabitsStore } from "./habits-store"
import { TaskType } from "./types"

const DAY = "2026-09-17"

beforeEach(() => {
  resetAllStores()
  resetActionHistory()
})

describe("action history", () => {
  it("undoes a painted block", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(peekUndoLabel()).toBe("paint")
    expect(undoLastAction()).toBe(true)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })

  it("redoes the undone paint", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    undoLastAction()
    expect(canRedo()).toBe(true)
    expect(redoLastAction()).toBe(true)
    expect(useTimeTrackingStore.getState().entries[0]).toMatchObject({
      startMin: 540,
      endMin: 600,
      penId: "act-work",
    })
  })

  it("undoes an erase back to the painted block", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 660, "act-work")
    store.paintMinutes(DAY, "activity", 570, 600, null)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(2)
    undoLastAction()
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(useTimeTrackingStore.getState().entries[0]).toMatchObject({ startMin: 540, endMin: 660 })
  })

  it("collapses a burst of paints into one undo step", () => {
    runAsAction("fill days", () => {
      const store = useTimeTrackingStore.getState()
      store.paintMinutes(DAY, "activity", 540, 600, "act-work")
      store.paintMinutes("2026-09-18", "activity", 540, 600, "act-work")
    })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(2)
    expect(peekUndoLabel()).toBe("fill days")
    undoLastAction()
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(canUndo()).toBe(false)
  })

  it("does not record silenced writes", () => {
    withoutUndo(() => {
      useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    })
    expect(canUndo()).toBe(false)
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
  })

  it("restores a logged night together with its derived blocks", () => {
    useSleepStore.getState().setBedtime(DAY, -30, "definite")
    useSleepStore.getState().setWakeTime(DAY, 420, "definite")
    expect(useSleepStore.getState().nights[DAY]?.wokeMin).toBe(420)
    undoLastAction()
    expect(useSleepStore.getState().nights[DAY]?.wokeMin).toBeUndefined()
    expect(useSleepStore.getState().nights[DAY]?.sleptMin).toBe(-30)
    undoLastAction()
    expect(useSleepStore.getState().nights[DAY]).toBeUndefined()
  })

  it("undoes a habit completion", () => {
    useHabitsStore.getState().setTasks([{ id: "h-water", name: "Water", type: TaskType.BOOLEAN, rewardValue: 10 }])
    useHabitsStore.getState().updateCompletion("h-water", new Date(2026, 8, 17), { completed: true })
    expect(useHabitsStore.getState().weeklyData[DAY]?.["h-water"]).toBeTruthy()
    undoLastAction()
    expect(useHabitsStore.getState().weeklyData[DAY]?.["h-water"]).toBeUndefined()
  })

  it("returns false when there is nothing to undo", () => {
    expect(undoLastAction()).toBe(false)
    expect(redoLastAction()).toBe(false)
  })

  it("clears redo after a new action", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    undoLastAction()
    store.paintMinutes(DAY, "activity", 600, 660, "act-rest")
    expect(canRedo()).toBe(false)
    expect(useTimeTrackingStore.getState().entries[0].penId).toBe("act-rest")
  })
})
