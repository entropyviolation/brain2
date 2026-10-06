import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import {
  applyDuplicateFolderPlan,
  applyDuplicateListPlan,
  disambiguatedCopyName,
  isAutoCreatedFolder,
  isAutoCreatedList,
  parseBulkCreateNames,
  planDuplicateFolder,
  planDuplicateList,
} from "@/lib/lists-duplicate"

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date("2026-01-01"),
  listIds: [],
  ...partial,
})

const list = (partial: Partial<List> & Pick<List, "id" | "name">): List => ({
  color: "#3B82F6",
  createdAt: new Date("2026-01-01"),
  order: 0,
  ...partial,
})

const task = (partial: Partial<Task> & Pick<Task, "id" | "description" | "lists">): Task => ({
  stage: "list",
  createdAt: new Date("2026-01-01"),
  completed: false,
  ...partial,
})

describe("parseBulkCreateNames", () => {
  it("trims, drops blanks, keeps order", () => {
    expect(parseBulkCreateNames("  Alpha \n\nBeta\n  \nGamma  ")).toEqual(["Alpha", "Beta", "Gamma"])
  })
})

describe("disambiguatedCopyName", () => {
  it("uses Name copy then Name copy 2", () => {
    expect(disambiguatedCopyName("Books", [])).toBe("Books copy")
    expect(disambiguatedCopyName("Books", ["Books copy"])).toBe("Books copy 2")
    expect(disambiguatedCopyName("Books", ["Books copy", "Books copy 2"])).toBe("Books copy 3")
  })
})

describe("auto labels", () => {
  it("marks module and scheduled folders", () => {
    expect(isAutoCreatedFolder(folder({ id: "f1", name: "X", createdByModuleId: "trip" }))).toBe(true)
    expect(isAutoCreatedFolder(folder({ id: "na-sched-d-2026-01-01", name: "Day" }))).toBe(true)
    expect(isAutoCreatedFolder(folder({ id: "books", name: "Books" }))).toBe(false)
  })

  it("marks module and All Items lists", () => {
    expect(isAutoCreatedList(list({ id: "l1", name: "X", createdByModuleId: "tidy" }))).toBe(true)
    expect(isAutoCreatedList(list({ id: "__all-items__books", name: "All Items" }))).toBe(true)
    expect(isAutoCreatedList(list({ id: "reading", name: "Reading" }))).toBe(false)
  })
})

describe("planDuplicateList", () => {
  const folders = [folder({ id: "books", name: "Books", listIds: ["reading"] })]
  const lists = [list({ id: "reading", name: "Reading", color: "#ef4444", icon: "/orbs/1.png" })]
  const tasks = [
    task({ id: "t1", description: "Dune", lists: ["reading"] }),
    task({ id: "t2", description: "Other", lists: ["elsewhere"] }),
  ]

  it("settings only copies config into an empty list", () => {
    const plan = planDuplicateList(lists[0], { scope: "settings", lists, folders, tasks })
    expect(plan.list.name).toBe("Reading copy")
    expect(plan.list.color).toBe("#ef4444")
    expect(plan.list.icon).toBe("/orbs/1.png")
    expect(plan.list.createdByModuleId).toBeUndefined()
    expect(plan.folderIds).toEqual(["books"])
    expect(plan.tasks).toEqual([])
  })

  it("settings and contents clones items onto the new list only", () => {
    const plan = planDuplicateList(lists[0], {
      scope: "settings_and_contents",
      lists,
      folders,
      tasks,
    })
    expect(plan.tasks).toHaveLength(1)
    expect(plan.tasks[0].description).toBe("Dune")
    expect(plan.tasks[0].id).not.toBe("t1")
    expect(plan.tasks[0].lists).toEqual([plan.list.id])
  })
})

describe("planDuplicateFolder", () => {
  const folders = [
    folder({ id: "root", name: "Root" }),
    folder({ id: "books", name: "Books", parentFolderId: "root", listIds: ["reading"], color: "#00f" }),
    folder({ id: "nested", name: "Nested", parentFolderId: "books", listIds: [] }),
  ]
  const lists = [list({ id: "reading", name: "Reading" })]
  const tasks = [task({ id: "t1", description: "Dune", lists: ["reading"] })]

  it("settings only makes an empty sibling folder", () => {
    const plan = planDuplicateFolder(folders[1], {
      scope: "settings",
      folders,
      lists,
      tasks,
    })
    expect(plan.folder.name).toBe("Books copy")
    expect(plan.folder.parentFolderId).toBe("root")
    expect(plan.folder.listIds).toEqual([])
    expect(plan.folder.color).toBe("#00f")
    expect(plan.folder.createdByModuleId).toBeUndefined()
    expect(plan.childFolders).toEqual([])
    expect(plan.lists).toEqual([])
  })

  it("settings and contents duplicates nested folders and lists", () => {
    const plan = planDuplicateFolder(folders[1], {
      scope: "settings_and_contents",
      folders,
      lists,
      tasks,
    })
    expect(plan.childFolders).toHaveLength(1)
    expect(plan.childFolders[0].folder.name).toBe("Nested copy")
    expect(plan.childFolders[0].folder.parentFolderId).toBe(plan.folder.id)
    expect(plan.lists).toHaveLength(1)
    expect(plan.lists[0].list.name).toBe("Reading copy")
    expect(plan.lists[0].folderIds).toEqual([plan.folder.id])
    expect(plan.lists[0].tasks).toHaveLength(1)
  })

  it("apply helpers write new records without aliasing ids", () => {
    const addedFolders: Folder[] = []
    const addedLists: List[] = []
    const addedTasks: Task[] = []
    const filings: Array<[string, string]> = []
    const plan = planDuplicateFolder(folders[1], {
      scope: "settings_and_contents",
      folders,
      lists,
      tasks,
    })
    applyDuplicateFolderPlan(plan, {
      addFolder: (f) => addedFolders.push(f),
      addList: (l) => addedLists.push(l),
      addListToFolder: (fid, lid) => filings.push([fid, lid]),
      addTask: (t) => addedTasks.push(t),
    })
    expect(addedFolders.map((f) => f.id)).not.toContain("books")
    expect(addedLists[0].id).not.toBe("reading")
    expect(addedTasks[0].id).not.toBe("t1")
    expect(filings[0][0]).toBe(plan.folder.id)

    const listPlan = planDuplicateList(lists[0], {
      scope: "settings",
      lists,
      folders,
      tasks,
    })
    applyDuplicateListPlan(listPlan, {
      addList: (l) => addedLists.push(l),
      addListToFolder: (fid, lid) => filings.push([fid, lid]),
      addTask: (t) => addedTasks.push(t),
    })
    expect(addedLists.at(-1)?.name).toBe("Reading copy")
  })
})
