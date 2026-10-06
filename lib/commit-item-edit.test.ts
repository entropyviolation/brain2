import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { addItemMutationListener, registerItemMutationDispatcher, type ItemMutationEvent } from "@/lib/workflow-hooks"
import {
  ITEM_ACTIVITY_STORAGE_KEY,
  listItemActivity,
  resetItemActivity,
} from "@/lib/item-activity"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { syncSleepNight } from "@/lib/sleep-sync"
import { stopWorkingOnOperation } from "@/lib/operation-work-session"
import * as actionHistory from "@/lib/action-history"
import { usePointsStore } from "@/lib/points-store"
import { applyLinkedEffects, commitItemEdit } from "@/lib/commit-item-edit"
import type { Task } from "@/lib/types"

vi.mock("@/lib/habit-tracking-sync", () => ({
  syncTrackedHabits: vi.fn(),
}))

vi.mock("@/lib/sleep-sync", () => ({
  syncSleepNight: vi.fn(),
}))

vi.mock("@/lib/operation-work-session", () => ({
  stopWorkingOnOperation: vi.fn(),
}))

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "a",
    description: "Old name",
    title: "Old name",
    stage: "list",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    completed: false,
    lists: [],
    ...overrides,
  }
}

describe("commitItemEdit", () => {
  beforeEach(() => {
    resetAllStores()
    resetItemActivity()
    registerItemMutationDispatcher(null)
    vi.mocked(syncTrackedHabits).mockClear()
    vi.mocked(syncSleepNight).mockClear()
    vi.mocked(stopWorkingOnOperation).mockClear()
  })

  it("stores an unknown attribute key and records previous and next on the mutation and the activity line", () => {
    taskRepository.add(task({ attributes: { palmarosa: "rose", kept: "yes" } }))
    const events: ItemMutationEvent[] = []
    const unsubscribe = addItemMutationListener((event) => events.push(event))

    try {
      commitItemEdit("a", { palmarosa: "cedar" }, "ingest")

      const stored = taskRepository.getById("a")
      expect(stored?.attributes).toEqual({ palmarosa: "cedar", kept: "yes" })
      expect(stored).not.toHaveProperty("palmarosa")

      expect(events).toHaveLength(1)
      expect(events[0].patch).toEqual({ palmarosa: "cedar" })
      expect(events[0].changedAttrs).toContain("palmarosa")

      const [line] = listItemActivity("a")
      expect(line.source).toBe("ingest")
      expect(line.at).toEqual(expect.any(String))
      expect(line.changes).toEqual([
        expect.objectContaining({ field: "palmarosa", from: "rose", to: "cedar" }),
      ])
    } finally {
      unsubscribe()
    }
  })

  it("succeeds with no order tag, and an older line with no order still loads", () => {
    taskRepository.add(task())
    commitItemEdit("a", { title: "Still old", description: "Still old" }, "detail")

    const [line] = listItemActivity("a")
    expect(line.order).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(line, "order")).toBe(false)
    expect(line.source).toBe("detail")

    const legacy = {
      old: [
        {
          id: "act-old",
          itemId: "old",
          at: "2020-01-01T00:00:00.000Z",
          summary: "Name: A → B",
          changes: [{ field: "title", label: "Name", from: "A", to: "B" }],
        },
      ],
    }
    localStorage.setItem(ITEM_ACTIVITY_STORAGE_KEY, JSON.stringify(legacy))
    const [older] = listItemActivity("old")
    expect(older.summary).toBe("Name: A → B")
    expect(older.order).toBeUndefined()
    expect(older.changes[0]).toMatchObject({ from: "A", to: "B" })
  })

  it("does not run linked effects on a rename, and applyLinkedEffects reaches them only when asked", () => {
    taskRepository.add(task())
    const undo = vi.spyOn(actionHistory, "rememberWorld")
    const points = vi.spyOn(usePointsStore.getState(), "addPoints")

    commitItemEdit("a", { title: "New name", description: "New name" }, "detail")

    expect(taskRepository.getById("a")?.title).toBe("New name")
    expect(syncTrackedHabits).not.toHaveBeenCalled()
    expect(syncSleepNight).not.toHaveBeenCalled()
    expect(stopWorkingOnOperation).not.toHaveBeenCalled()
    expect(undo).not.toHaveBeenCalled()
    expect(points).not.toHaveBeenCalled()

    applyLinkedEffects({ kind: "habit", dateKeys: ["2026-10-06"] })
    expect(syncTrackedHabits).toHaveBeenCalledTimes(1)
    expect(syncTrackedHabits).toHaveBeenCalledWith(["2026-10-06"])
    expect(syncSleepNight).not.toHaveBeenCalled()
    expect(stopWorkingOnOperation).not.toHaveBeenCalled()

    const morning = new Date("2026-10-06T12:00:00.000Z")
    applyLinkedEffects({ kind: "night", date: "2026-10-06", now: morning })
    expect(syncSleepNight).toHaveBeenCalledTimes(1)
    expect(syncSleepNight).toHaveBeenCalledWith("2026-10-06", morning)

    applyLinkedEffects({ kind: "session", now: morning })
    expect(stopWorkingOnOperation).toHaveBeenCalledTimes(1)
    expect(stopWorkingOnOperation).toHaveBeenCalledWith(morning)

    undo.mockRestore()
    points.mockRestore()
  })

  it("stores an order tag when one is given", () => {
    taskRepository.add(task())
    commitItemEdit("a", { notes: "from the grid" }, "tracking", "observed")
    const [line] = listItemActivity("a")
    expect(line.order).toBe("observed")
    expect(line.changes[0]).toMatchObject({ field: "notes", to: "from the grid" })
  })
})
