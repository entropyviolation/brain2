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
import { startHabitCoverageSync, syncHabitCoverageLinks } from "./habit-coverage-sync"
import { syncSleepNight, useSleepSync } from "./sleep-sync"
import { persistKey } from "./storage-keys"
import { renderHook } from "@testing-library/react"
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

  it("does not pop a second step when a subscriber undoes during the restore", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    store.paintMinutes(DAY, "activity", 600, 660, "act-rest")
    const stop = useTimeTrackingStore.subscribe(() => {
      undoLastAction()
    })
    expect(undoLastAction()).toBe(true)
    stop()
    expect(useTimeTrackingStore.getState().entries).toHaveLength(1)
    expect(useTimeTrackingStore.getState().entries[0].penId).toBe("act-work")
  })

  it("tombstones an undone block so a stale rehydrate cannot paint it back", async () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const id = useTimeTrackingStore.getState().entries[0]?.id
    expect(id).toBeTruthy()
    undoLastAction()
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
    expect(useTimeTrackingStore.getState().removedEntryIds).toContain(id)

    const key = persistKey("timegrid-store")
    const raw = localStorage.getItem(key)
    const parsed = JSON.parse(raw ?? "{}") as {
      state?: { entries?: unknown[]; removedEntryIds?: string[] }
      version?: number
    }
    const stale = {
      ...parsed,
      state: {
        ...(parsed.state ?? {}),
        entries: [
          ...(Array.isArray(parsed.state?.entries) ? parsed.state.entries : []),
          {
            id,
            date: DAY,
            scopeId: "activity",
            penId: "act-work",
            startMin: 540,
            endMin: 600,
          },
        ],
        removedEntryIds: [],
      },
    }
    localStorage.setItem(key, JSON.stringify(stale))
    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().entries.find((entry) => entry.id === id)).toBeUndefined()
  })

  it("strips a tombstoned entry when a later write pastes it back", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const entry = useTimeTrackingStore.getState().entries[0]
    undoLastAction()
    useTimeTrackingStore.setState((state) => ({ entries: [...state.entries, entry] }))
    expect(useTimeTrackingStore.getState().entries.find((item) => item.id === entry.id)).toBeUndefined()
    expect(useTimeTrackingStore.getState().removedEntryIds).toContain(entry.id)
  })

  it("redoes the block and drops its tombstone", () => {
    useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
    const id = useTimeTrackingStore.getState().entries[0]?.id
    undoLastAction()
    expect(redoLastAction()).toBe(true)
    const state = useTimeTrackingStore.getState()
    expect(state.entries.map((entry) => entry.id)).toContain(id)
    expect(state.removedEntryIds).not.toContain(id)
  })

  it("leaves the block gone after coverage and sleep sync run", async () => {
    const habit = {
      id: "cov-undo",
      name: "Log the day",
      type: TaskType.BOOLEAN,
      frequency: "daily" as const,
      coverageLink: { threshold: 1, enabled: true },
    }
    useHabitsStore.setState({ tasks: [habit] })
    const stop = startHabitCoverageSync()
    try {
      renderHook(() => useSleepSync())
      useSleepStore.getState().setBedtime(DAY, -30, "definite")
      useSleepStore.getState().setWakeTime(DAY, 420, "definite")
      useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 540, 600, "act-work")
      expect(peekUndoLabel()).toBe("paint")
      const painted = useTimeTrackingStore.getState().entries.find((entry) => entry.penId === "act-work")
      expect(painted).toBeTruthy()
      undoLastAction()
      syncHabitCoverageLinks()
      syncSleepNight(DAY)
      await Promise.resolve()
      expect(useTimeTrackingStore.getState().entries.find((entry) => entry.id === painted?.id)).toBeUndefined()
      expect(peekUndoLabel()).not.toBe("paint")
    } finally {
      stop()
    }
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
