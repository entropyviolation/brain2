import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import {
  filterTasksByHiddenFolderLists,
  folderAllItemsCategoryId,
  listsInFolderForFilter,
} from "@/lib/folder-all-items"

const folder = (listIds: string[]): Folder => ({
  id: "folder1",
  name: "folder1",
  createdAt: new Date(),
  listIds,
})

const list = (id: string, name: string): List => ({
  id,
  name,
  color: "#3B82F6",
  description: "",
  createdAt: new Date(),
  order: 0,
})

const task = (id: string, description: string, lists: string[]): Task => ({
  id,
  description,
  lists,
  stage: "list",
  completed: false,
  createdAt: new Date(),
  urgency: 1,
  importance: 1,
})

describe("listsInFolderForFilter", () => {
  it("returns every list in the folder except All Items, in folder order", () => {
    const allId = folderAllItemsCategoryId("folder1")
    const lists = [list("list-2", "list 2"), list("list-1", "list 1"), list(allId, "All Items")]
    expect(listsInFolderForFilter(folder([allId, "list-1", "list-2"]), lists).map((c) => c.id)).toEqual([
      "list-1",
      "list-2",
    ])
  })

  it("skips ids with no matching list", () => {
    expect(listsInFolderForFilter(folder(["missing", "list-1"]), [list("list-1", "list 1")]).map((c) => c.id)).toEqual([
      "list-1",
    ])
  })
})

describe("filterTasksByHiddenFolderLists", () => {
  const allId = folderAllItemsCategoryId("folder1")
  const f = folder([allId, "list-1", "list-2"])
  const items = [
    task("a", "item a", ["list-1"]),
    task("b", "item b", ["list-2"]),
    task("c", "item c", ["list-2"]),
    task("u", "uncategorized", [allId]),
  ]

  it("shows every item when nothing is hidden", () => {
    expect(filterTasksByHiddenFolderLists(items, f, []).map((t) => t.id)).toEqual(["a", "b", "c", "u"])
  })

  it("hides items that belong only to an unselected list", () => {
    expect(filterTasksByHiddenFolderLists(items, f, ["list-1"]).map((t) => t.id)).toEqual(["b", "c", "u"])
  })

  it("keeps an item visible if it also belongs to a selected list", () => {
    const overlap = [...items, task("ab", "in both", ["list-1", "list-2"])]
    expect(filterTasksByHiddenFolderLists(overlap, f, ["list-1"]).map((t) => t.id)).toEqual(["b", "c", "u", "ab"])
  })

  it("does not mutate tasks or their list membership", () => {
    const originalLists = items.map((t) => [...t.lists])
    filterTasksByHiddenFolderLists(items, f, ["list-2"])
    expect(items.map((t) => t.lists)).toEqual(originalLists)
  })
})
