import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import { getFolderDescendantIds } from "@/lib/folder-tree"
import {
  filterTasksByHiddenFolderLists,
  folderAllItemsCategoryId,
  folderAllItemsList,
  buildFolderAllItemsList,
  buildGlobalAllItemsList,
  foldersInGlobalAllForFilter,
  listsInFolderForFilter,
  filterTasksByHiddenGlobalFolders,
  taskInFolder,
  isTaskUncategorizedGlobally,
  GLOBAL_ALL_ITEMS_LIST_ID,
  syncGlobalAllItemsList,
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

describe("folderAllItemsList / buildFolderAllItemsList", () => {
  it("builds the backing All Items record and finds it by folder id", () => {
    const f = folder([])
    const built = buildFolderAllItemsList(f)
    expect(built.id).toBe("__all-items__folder1")
    expect(built.name).toBe("All Items")
    expect(built.scheduleable).toBe(false)
    expect(folderAllItemsList([built], "folder1")?.id).toBe(built.id)
    expect(folderAllItemsList([], "folder1")).toBeUndefined()
  })
})

describe("global All backing list", () => {
  it("uses a stable id that is an All Items category, not a folder child", () => {
    const built = buildGlobalAllItemsList()
    expect(built.id).toBe("__all-items__root")
    expect(built.id).toBe(GLOBAL_ALL_ITEMS_LIST_ID)
    expect(built.name).toBe("All Items")
  })

  it("creates the record once and never files it on a folder", () => {
    const lists: List[] = []
    const added: List[] = []
    syncGlobalAllItemsList({
      lists,
      addList: (c) => {
        added.push(c)
        lists.push(c)
      },
    })
    syncGlobalAllItemsList({
      lists,
      addList: (c) => {
        added.push(c)
        lists.push(c)
      },
    })
    expect(added).toHaveLength(1)
    expect(lists.map((l) => l.id)).toEqual([GLOBAL_ALL_ITEMS_LIST_ID])
  })
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

  it("hides uncategorized items when asked", () => {
    expect(filterTasksByHiddenFolderLists(items, f, [], undefined, true).map((t) => t.id)).toEqual(["a", "b", "c"])
  })

  it("hides uncategorized items together with an unselected list", () => {
    expect(filterTasksByHiddenFolderLists(items, f, ["list-1"], undefined, true).map((t) => t.id)).toEqual(["b", "c"])
  })
})

describe("foldersInGlobalAllForFilter", () => {
  it("returns root folders and skips nested and auto period folders", () => {
    const folders: Folder[] = [
      { id: "work", name: "Work", createdAt: new Date(), listIds: [] },
      { id: "projects", name: "Projects", createdAt: new Date(), listIds: [], parentFolderId: "work" },
      { id: "home", name: "Home", createdAt: new Date(), listIds: [] },
      { id: "na-sched-y-2026", name: "2026", createdAt: new Date(), listIds: [] },
    ]
    expect(foldersInGlobalAllForFilter(folders).map((f) => f.id)).toEqual(["home", "work"])
  })
})

describe("filterTasksByHiddenGlobalFolders", () => {
  const work: Folder = { id: "work", name: "Work", createdAt: new Date(), listIds: ["__all-items__work", "work-list"] }
  const projects: Folder = {
    id: "projects",
    name: "Projects",
    createdAt: new Date(),
    listIds: ["__all-items__projects", "proj-list"],
    parentFolderId: "work",
  }
  const home: Folder = { id: "home", name: "Home", createdAt: new Date(), listIds: ["__all-items__home", "home-list"] }
  const folders = [work, projects, home]
  const items = [
    task("w", "work item", ["work-list"]),
    task("p", "project item", ["proj-list"]),
    task("h", "home item", ["home-list"]),
    task("loose", "loose item", ["other-list"]),
    task("both", "in work and home", ["work-list", "home-list"]),
  ]

  it("shows every item when nothing is hidden", () => {
    expect(filterTasksByHiddenGlobalFolders(items, folders, []).map((t) => t.id)).toEqual([
      "w",
      "p",
      "h",
      "loose",
      "both",
    ])
  })

  it("hides items that belong only to an unselected folder tree", () => {
    expect(filterTasksByHiddenGlobalFolders(items, folders, ["work"]).map((t) => t.id)).toEqual([
      "h",
      "loose",
      "both",
    ])
  })

  it("keeps an item visible if it also belongs to a selected folder", () => {
    expect(filterTasksByHiddenGlobalFolders(items, folders, ["home"]).map((t) => t.id)).toEqual([
      "w",
      "p",
      "loose",
      "both",
    ])
  })

  it("does not mutate tasks or their list membership", () => {
    const originalLists = items.map((t) => [...t.lists])
    filterTasksByHiddenGlobalFolders(items, folders, ["work"])
    expect(items.map((t) => t.lists)).toEqual(originalLists)
  })

  it("hides globally uncategorized items when asked", () => {
    const withLoose = [...items, task("pool", "folder pool", ["__all-items__home"])]
    expect(filterTasksByHiddenGlobalFolders(withLoose, folders, [], undefined, true).map((t) => t.id)).toEqual([
      "w",
      "p",
      "h",
      "loose",
      "both",
    ])
  })
})

describe("isTaskUncategorizedGlobally", () => {
  it("treats empty lists as uncategorized", () => {
    expect(isTaskUncategorizedGlobally(task("a", "loose", []))).toBe(true)
  })

  it("treats folder All Items pool membership as uncategorized", () => {
    expect(isTaskUncategorizedGlobally(task("a", "pool", [folderAllItemsCategoryId("folder1")]))).toBe(true)
  })

  it("treats a real list as categorized", () => {
    expect(isTaskUncategorizedGlobally(task("a", "filed", ["list-1"]))).toBe(false)
  })

  it("treats mixed All Items + real list as categorized", () => {
    expect(
      isTaskUncategorizedGlobally(task("a", "mixed", [folderAllItemsCategoryId("folder1"), "list-1"])),
    ).toBe(false)
  })
})

describe("filterTasksByHiddenGlobalFolders at scale", () => {
  // The first version asked every folder about every task. Keep that as the oracle.
  const naive = (tasks: Task[], folders: Folder[], hiddenIds: string[], categories: List[]) => {
    const hidden = new Set(hiddenIds)
    for (const id of hiddenIds) for (const d of getFolderDescendantIds(folders, id)) hidden.add(d)
    return tasks.filter((t) => {
      const inFolders = folders.filter((f) => taskInFolder(t, f, categories))
      if (inFolders.length === 0) return true
      return inFolders.some((f) => !hidden.has(f.id))
    })
  }

  it("matches the per-folder answer with nested lists and shared membership", () => {
    let seed = 7
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n)
    const lists: List[] = Array.from({ length: 40 }, (_, i) => ({
      ...list(`l${i}`, `l${i}`),
      parentListId: i >= 10 ? `l${rand(i)}` : undefined,
    }))
    const folders: Folder[] = Array.from({ length: 8 }, (_, i) => ({
      id: `f${i}`,
      name: `f${i}`,
      createdAt: new Date(),
      listIds: [`__all-items__f${i}`, `l${rand(10)}`, `l${rand(10)}`],
      parentFolderId: i > 3 ? `f${rand(4)}` : undefined,
    }))
    const tasks: Task[] = Array.from({ length: 600 }, (_, i) =>
      task(
        `t${i}`,
        `t${i}`,
        Array.from({ length: rand(4) }, () => (rand(8) === 0 ? `__all-items__f${rand(8)}` : `l${rand(44)}`)),
      ),
    )
    for (const hidden of [["f0"], ["f1", "f2"], ["f5"], ["f0", "f1", "f2", "f3"]]) {
      expect(filterTasksByHiddenGlobalFolders(tasks, folders, hidden, lists).map((t) => t.id)).toEqual(
        naive(tasks, folders, hidden, lists).map((t) => t.id),
      )
    }
  })

  it("stays fast on a vault of 25,000 items", () => {
    const lists: List[] = Array.from({ length: 300 }, (_, i) => ({
      ...list(`l${i}`, `l${i}`),
      parentListId: i >= 50 ? `l${i % 50}` : undefined,
    }))
    const folders: Folder[] = Array.from({ length: 260 }, (_, i) => ({
      id: `f${i}`,
      name: `f${i}`,
      createdAt: new Date(),
      listIds: [`__all-items__f${i}`, `l${i % 50}`],
    }))
    const tasks = Array.from({ length: 25000 }, (_, i) => task(`t${i}`, `t${i}`, [`l${i % 300}`]))
    const started = performance.now()
    filterTasksByHiddenGlobalFolders(tasks, folders, ["f1", "f2"], lists)
    expect(performance.now() - started).toBeLessThan(500)
  })
})
