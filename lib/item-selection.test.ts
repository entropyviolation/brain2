import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import {
  addTaskToList,
  canMoveItemsFromOpenList,
  destinationListsForSelection,
  originListIdToUnlink,
  placeTaskInList,
  removeTaskFromList,
} from "./item-selection"

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
})

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  lists: [],
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
  ...partial,
})

describe("destinationListsForSelection", () => {
  const lists = [
    list("work", "Work"),
    list("home", "Home"),
    list("__all-items__folder1", "All Items"),
  ]

  it("excludes All Items lists and the current list, sorted by name", () => {
    expect(destinationListsForSelection(lists, { currentListId: "work" }).map((c) => c.id)).toEqual(["home"])
  })

  it("returns every real list when there is no current list", () => {
    expect(destinationListsForSelection(lists).map((c) => c.id)).toEqual(["home", "work"])
  })
})

describe("originListIdToUnlink", () => {
  it("unlinks the origin list only when moving is allowed", () => {
    expect(originListIdToUnlink({ mode: "move", originListId: "work", canMove: true })).toBe("work")
    expect(originListIdToUnlink({ mode: "keep", originListId: "work", canMove: true })).toBeNull()
    expect(originListIdToUnlink({ mode: "move", originListId: "work", canMove: false })).toBeNull()
  })
})

describe("canMoveItemsFromOpenList", () => {
  it("allows move only from a real owning list", () => {
    expect(canMoveItemsFromOpenList("work")).toBe(true)
    expect(canMoveItemsFromOpenList("__all-items__folder1")).toBe(false)
    expect(canMoveItemsFromOpenList(null)).toBe(false)
  })
})

describe("placeTaskInList", () => {
  const lists = [list("work", "Work"), list("home", "Home")]
  const folders = [folder({ id: "f1", name: "F1", listIds: ["work", "home"] })]

  it("adds the destination list without removing the origin when keeping", () => {
    const item = task({ id: "t1", description: "Task", lists: ["work"] })
    const next = placeTaskInList(item, "home", {
      mode: "keep",
      originListId: "work",
      canMove: true,
      lists,
      folders,
    })
    expect(next.lists).toEqual(expect.arrayContaining(["work", "home"]))
  })

  it("moves the item off the origin list", () => {
    const item = task({ id: "t1", description: "Task", lists: ["work"] })
    const next = placeTaskInList(item, "home", {
      mode: "move",
      originListId: "work",
      canMove: true,
      lists,
      folders,
    })
    expect(next.lists).toContain("home")
    expect(next.lists).not.toContain("work")
  })

  it("does not unlink the origin when move is not allowed", () => {
    const item = task({ id: "t1", description: "Task", lists: ["work"] })
    const next = placeTaskInList(item, "home", {
      mode: "move",
      originListId: "work",
      canMove: false,
      lists,
      folders,
    })
    expect(next.lists).toEqual(expect.arrayContaining(["work", "home"]))
  })
})

describe("addTaskToList / removeTaskFromList", () => {
  it("is a no-op when the item already belongs to the list", () => {
    const item = task({ id: "t1", description: "Task", lists: ["work"] })
    expect(addTaskToList(item, "work", []).lists).toEqual(["work"])
  })

  it("removes only the given list", () => {
    const item = task({ id: "t1", description: "Task", lists: ["work", "home"] })
    expect(removeTaskFromList(item, "work").lists).toEqual(["home"])
  })
})
