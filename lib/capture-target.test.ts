import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { parseSmartCapture } from "@/lib/smart-parse"
import { buildCapturedTask, ensureCaptureTarget } from "./capture-target"

function mutators() {
  const s = useTaskStore.getState()
  return {
    lists: s.lists,
    folders: s.folders,
    addList: s.addList,
    addFolder: s.addFolder,
    addListToFolder: s.addListToFolder,
    updateList: s.updateList,
    updateFolder: s.updateFolder,
  }
}

describe("ensureCaptureTarget", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("creates a nested folder and list from a path", () => {
    const { suggestion } = parseSmartCapture(
      "next actions: eventually: go through and edit old three pages into a memoir or essay narrative; mine essays",
    )
    const target = ensureCaptureTarget(suggestion, mutators)
    const { lists, folders } = useTaskStore.getState()
    const folder = folders.find((f) => f.id === target.folder?.id)
    expect(folder?.name.toLowerCase()).toBe("next actions")
    expect(target.list?.name.toLowerCase()).toBe("eventually")
    expect(folder?.listIds).toContain(target.list?.id)
    expect(lists.some((l) => l.id === target.list?.id)).toBe(true)
  })

  it("files skip-inbox captures onto the list, not inbox", () => {
    const { suggestion } = parseSmartCapture("Groceries: Milk")
    const target = ensureCaptureTarget(suggestion, mutators)
    const task = buildCapturedTask({
      suggestion,
      fallbackText: "Groceries: Milk",
      sendToInbox: false,
      target,
      folders: useTaskStore.getState().folders,
    })
    expect(task.stage).not.toBe("inbox")
    expect(task.lists).toEqual(target.listIds)
    expect(task.description).toBe("Milk")
  })
})
