import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "./time-tracking-store"
import { taskRepository } from "./data/task-repository"
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
