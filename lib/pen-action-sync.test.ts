import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "./time-tracking-store"
import { taskRepository } from "./data/task-repository"
import { useTaskStore } from "./task-store"
import { countsInDone } from "./item-utils"
import { penActionLogId } from "./pen-action-format"
import { syncPenActions } from "./pen-action-sync"

const DAY = "2026-09-20"

beforeEach(() => {
  resetAllStores()
})

describe("pen action sync", () => {
  it("logs a Walking block into Done today from the default format", () => {
    const store = useTimeTrackingStore.getState()
    store.updatePen("activity", {
      ...store.scopes[0].pens.find((p) => p.id === "act-exercise")!,
      actionFormats: [{ id: "f1", template: "Went for a walk" }],
    })
    store.paintMinutes(DAY, "activity", 60, 75, "act-exercise")
    const [entry] = store.entriesFor(DAY, "activity")
    syncPenActions()
    const row = taskRepository.getById(penActionLogId(entry))
    expect(row?.description).toBe("Went for a walk")
    expect(row?.loggedAction).toBe(true)
    expect(row?.actualDuration).toBe(15)
    expect(countsInDone(row!, [])).toBe(true)
  })

  it("updates the row when duration or project changes, unless the user renamed it", () => {
    const store = useTimeTrackingStore.getState()
    store.updatePen("activity", {
      ...store.scopes[0].pens.find((p) => p.id === "act-work")!,
      actionFormats: [
        { id: "f-proj", template: "Worked on {project} for {hours} hours" },
        { id: "f-plain", template: "Worked" },
      ],
    })
    store.paintMinutes(DAY, "activity", 540, 600, "act-work")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))?.description).toBe("Worked")

    useTimeTrackingStore.getState().updateEntry(entry.id, { project: "Spanish", endMin: 660 })
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))?.description).toBe("Worked on Spanish for 2 hours")
    expect(taskRepository.getById(penActionLogId(entry))?.actualDuration).toBe(120)

    const existing = taskRepository.getById(penActionLogId(entry))!
    taskRepository.update({ ...existing, description: "crammed vocab", title: "crammed vocab" })
    useTimeTrackingStore.getState().updateEntry(entry.id, { project: "French" })
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))?.description).toBe("crammed vocab")
  })

  it("does not write tasks for a stroke when no pen has action formats", () => {
    const tasksBefore = useTaskStore.getState().tasks
    const update = vi.spyOn(taskRepository, "update")
    const add = vi.spyOn(taskRepository, "add")
    const remove = vi.spyOn(taskRepository, "remove")
    try {
      useTimeTrackingStore.getState().paintMinutes(DAY, "activity", 60, 75, "act-exercise")
      syncPenActions()
      expect(update).not.toHaveBeenCalled()
      expect(add).not.toHaveBeenCalled()
      expect(remove).not.toHaveBeenCalled()
      expect(useTaskStore.getState().tasks).toBe(tasksBefore)
    } finally {
      update.mockRestore()
      add.mockRestore()
      remove.mockRestore()
    }
  })

  it("still deletes the Done row after the pen's formats are cleared", () => {
    const store = useTimeTrackingStore.getState()
    const pen = store.scopes[0].pens.find((p) => p.id === "act-exercise")!
    store.updatePen("activity", {
      ...pen,
      actionFormats: [{ id: "f1", template: "Went for a walk" }],
    })
    store.paintMinutes(DAY, "activity", 60, 75, "act-exercise")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))).toBeTruthy()
    const painted = useTimeTrackingStore.getState()
    painted.updatePen("activity", {
      ...painted.scopes[0].pens.find((p) => p.id === "act-exercise")!,
      actionFormats: [],
    })
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))).toBeUndefined()
  })

  it("removes the Done row when the block is deleted", () => {
    const store = useTimeTrackingStore.getState()
    store.updatePen("activity", {
      ...store.scopes[0].pens.find((p) => p.id === "act-exercise")!,
      actionFormats: [{ id: "f1", template: "Went for a walk" }],
    })
    store.paintMinutes(DAY, "activity", 60, 75, "act-exercise")
    const [entry] = useTimeTrackingStore.getState().entriesFor(DAY, "activity")
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))).toBeTruthy()
    useTimeTrackingStore.getState().removeEntry(entry.id)
    syncPenActions()
    expect(taskRepository.getById(penActionLogId(entry))).toBeUndefined()
  })
})
