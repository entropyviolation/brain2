import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { parseSmartCapture } from "@/lib/smart-parse"
import { folderAllItemsCategoryId } from "@/lib/folder-all-items"
import { buildCapturedTask, ensureCaptureTarget, previewCapturePath } from "./capture-target"

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
    expect(target.list?.scheduleable).toBe(false)
  })

  it("leaves a new list out of the Scheduler even inside a sent folder", () => {
    const { addFolder } = useTaskStore.getState()
    addFolder({
      id: "folder-work",
      name: "Work",
      createdAt: new Date(),
      listIds: [],
      scheduleable: true,
    })
    const { suggestion } = parseSmartCapture("Work: Groceries: Milk")
    const target = ensureCaptureTarget(suggestion, mutators)
    expect(target.folder?.scheduleable).toBe(true)
    expect(target.list?.name).toBe("Groceries")
    expect(target.list?.scheduleable).toBe(false)
    expect(useTaskStore.getState().lists.find((l) => l.id === target.list?.id)?.scheduleable).toBe(false)
  })

  it("files brain2 onto the list named brain2, not brain", () => {
    const { addList } = useTaskStore.getState()
    addList({
      id: "list-brain",
      name: "brain",
      color: "#000",
      createdAt: new Date(),
    })
    addList({
      id: "list-brain2",
      name: "brain2",
      color: "#111",
      createdAt: new Date(),
    })
    const { suggestion } = parseSmartCapture("brain2: finish the report")
    const target = ensureCaptureTarget(suggestion, mutators)
    expect(target.list?.id).toBe("list-brain2")
    expect(target.list?.name).toBe("brain2")
    const task = buildCapturedTask({
      suggestion,
      fallbackText: "brain2: finish the report",
      sendToInbox: true,
      target,
      folders: useTaskStore.getState().folders,
    })
    expect(task.description).toBe("finish the report")
    expect(task.lists).toEqual(["list-brain2"])
    expect(task.stage).toBe("inbox")
    expect(useTaskStore.getState().lists.some((list) => list.name === "brain" && list.id !== "list-brain")).toBe(false)
  })

  it("files folder: all: item on that folder's All Items, not a list named all", () => {
    const { addFolder } = useTaskStore.getState()
    addFolder({
      id: "folder-na",
      name: "Next Actions",
      createdAt: new Date(),
      listIds: [],
      scheduleable: false,
    })
    const { suggestion } = parseSmartCapture("next actions: all: buy milk")
    const target = ensureCaptureTarget(suggestion, mutators)
    const allId = folderAllItemsCategoryId("folder-na")
    expect(target.folder?.id).toBe("folder-na")
    expect(target.listIds).toEqual([allId])
    expect(target.list?.name).toBe("All Items")
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "all" && !list.id.startsWith("__all-items__"))).toBe(false)
    const task = buildCapturedTask({
      suggestion,
      fallbackText: "next actions: all: buy milk",
      sendToInbox: true,
      target,
      folders: useTaskStore.getState().folders,
    })
    expect(task.description).toBe("buy milk")
    expect(task.lists).toEqual([allId])
    expect(task.stage).toBe("inbox")
  })

  it("files a new folder's all items pool when the folder does not exist yet", () => {
    const { suggestion } = parseSmartCapture("Kitchen: All Items: oats")
    const target = ensureCaptureTarget(suggestion, mutators)
    expect(target.folder?.name).toBe("Kitchen")
    expect(target.listIds).toEqual([folderAllItemsCategoryId(target.folder!.id)])
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "all items" && list.id === target.list?.id)).toBe(true)
    expect(useTaskStore.getState().lists.some((list) => list.name.toLowerCase() === "all items" && !list.id.startsWith("__all-items__"))).toBe(false)
  })

  it("files the leaf folder when the path is nested", () => {
    const { suggestion } = parseSmartCapture("life: writing: all: draft chapter two")
    const target = ensureCaptureTarget(suggestion, mutators)
    const writing = useTaskStore.getState().folders.find((folder) => folder.name === "writing")
    expect(target.folder?.id).toBe(writing?.id)
    expect(target.listIds).toEqual([folderAllItemsCategoryId(writing!.id)])
  })

  it("still creates a list named all when no folder is named", () => {
    const { suggestion } = parseSmartCapture("all: buy milk")
    const target = ensureCaptureTarget(suggestion, mutators)
    expect(target.list?.name).toBe("all")
    expect(target.listIds).toEqual([target.list!.id])
    expect(target.list?.id.startsWith("__all-items__")).toBe(false)
  })

  it("previews folder: all: as All Items", () => {
    const { suggestion } = parseSmartCapture("next actions: all: buy milk")
    const preview = previewCapturePath(
      suggestion.folderPath,
      suggestion.category,
      useTaskStore.getState().folders,
      useTaskStore.getState().lists,
    )
    expect(preview.list).toEqual({ name: "All Items", exists: true })
  })

  it("keeps an existing sent list sent when the shorthand names it", () => {
    const { addList } = useTaskStore.getState()
    addList({
      id: "list-todo",
      name: "to do",
      color: "#16a34a",
      createdAt: new Date(),
      scheduleable: true,
    })
    const { suggestion } = parseSmartCapture("to do: call dentist")
    const target = ensureCaptureTarget(suggestion, mutators)
    expect(target.list?.id).toBe("list-todo")
    expect(target.list?.scheduleable).toBe(true)
  })
})
