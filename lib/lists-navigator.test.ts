import { describe, expect, it } from "vitest"
import type { Folder, List } from "@/lib/types"
import { compareFolders } from "@/lib/folder-tree"
import { buildGridEntries } from "@/lib/lists-grid-entries"
import {
  insertionIndex,
  navContainer,
  navSnapshot,
  placeNavItems,
  removeNavFolder,
  removeNavList,
  rowDropZone,
  searchNav,
  type NavPlace,
} from "@/lib/lists-navigator"

function list(partial: Partial<List> & Pick<List, "id" | "name">): List {
  return {
    color: "#3B82F6",
    createdAt: new Date("2026-01-01"),
    ...partial,
  }
}

function folder(partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder {
  return {
    createdAt: new Date("2026-01-01"),
    listIds: [],
    ...partial,
  }
}

const root: NavPlace = { kind: "root" }

describe("navContainer", () => {
  const folders = [
    folder({ id: "work", name: "Work" }),
    folder({ id: "q1", name: "Q1", parentFolderId: "work" }),
    folder({ id: "home", name: "Home" }),
  ]
  const lists = [
    list({ id: "errands", name: "Errands", order: 1 }),
    list({ id: "packed", name: "Packed", order: 0 }),
    list({ id: "nested", name: "Nested", parentListId: "errands" }),
  ]
  const filed = [
    folder({ id: "work", name: "Work", listIds: ["packed", "errands"] }),
    folder({ id: "home", name: "Home" }),
  ]

  it("puts root folders first, then unfiled lists in list order", () => {
    expect(navContainer(lists, folders, root).map((ref) => ref.id)).toEqual(["home", "work", "packed", "errands"])
  })

  it("hides filed lists and sublists from the library desk", () => {
    const ids = navContainer(lists, filed, root).map((ref) => ref.id)
    expect(ids).toEqual(["home", "work"])
    expect(navContainer(lists, filed, { kind: "list", id: "errands" }).map((ref) => ref.id)).toEqual(["nested"])
  })

  it("orders a folder as child folders, then listIds", () => {
    expect(navContainer(lists, filed, { kind: "folder", id: "work" }).map((ref) => ref.id)).toEqual([
      "packed",
      "errands",
    ])
  })

  it("follows contentsOrder when the folder has one", () => {
    const mixed = [
      folder({
        id: "work",
        name: "Work",
        listIds: ["errands", "packed"],
        contentsOrder: ["list:errands", "folder:q1", "list:packed"],
      }),
      folder({ id: "q1", name: "Q1", parentFolderId: "work" }),
    ]
    expect(navContainer(lists, mixed, { kind: "folder", id: "work" }).map((ref) => ref.id)).toEqual([
      "errands",
      "q1",
      "packed",
    ])
  })

  it("orders sublists by List.order", () => {
    const kids = [
      list({ id: "parent", name: "Parent" }),
      list({ id: "b", name: "B", parentListId: "parent", order: 1 }),
      list({ id: "a", name: "A", parentListId: "parent", order: 0 }),
    ]
    expect(navContainer(kids, [], { kind: "list", id: "parent" }).map((ref) => ref.id)).toEqual(["a", "b"])
  })
})

describe("placeNavItems", () => {
  it("reorders inside the library and remembers that order", () => {
    const lists = [list({ id: "alpha", name: "Alpha" }), list({ id: "beta", name: "Beta" })]
    const folders = [folder({ id: "work", name: "Work" })]
    const next = placeNavItems(lists, folders, [{ kind: "list", id: "beta" }], root, root, 0)
    expect(navContainer(next.lists, next.folders, root).map((ref) => ref.id)).toEqual(["beta", "work", "alpha"])
    expect(next.lists.find((item) => item.id === "beta")?.order).toBe(0)
    expect(next.folders.find((item) => item.id === "work")?.order).toBe(1)
  })

  it("keeps a multi-selection in its original order", () => {
    const lists = [
      list({ id: "a", name: "A", order: 0 }),
      list({ id: "b", name: "B", order: 1 }),
      list({ id: "c", name: "C", order: 2 }),
      list({ id: "d", name: "D", order: 3 }),
    ]
    const next = placeNavItems(
      lists,
      [],
      [
        { kind: "list", id: "c" },
        { kind: "list", id: "a" },
      ],
      root,
      root,
      4,
    )
    expect(navContainer(next.lists, next.folders, root).map((ref) => ref.id)).toEqual(["b", "d", "a", "c"])
  })

  it("files a list into a folder at the drop index and takes it off the desk", () => {
    const lists = [list({ id: "alpha", name: "Alpha" }), list({ id: "beta", name: "Beta" })]
    const folders = [folder({ id: "work", name: "Work", listIds: ["beta"] })]
    const next = placeNavItems(lists, folders, [{ kind: "list", id: "alpha" }], root, { kind: "folder", id: "work" }, 0)
    expect(navContainer(next.lists, next.folders, { kind: "folder", id: "work" }).map((ref) => ref.id)).toEqual([
      "alpha",
      "beta",
    ])
    expect(navContainer(next.lists, next.folders, root).map((ref) => ref.id)).toEqual(["work"])
  })

  it("moves a list from one folder to another and leaves a third membership", () => {
    const lists = [list({ id: "alpha", name: "Alpha" })]
    const folders = [
      folder({ id: "a", name: "A", listIds: ["alpha"] }),
      folder({ id: "b", name: "B", listIds: ["kept"] }),
      folder({ id: "c", name: "C", listIds: ["alpha"] }),
    ]
    const listsWithKept = [...lists, list({ id: "kept", name: "Kept" })]
    const next = placeNavItems(
      listsWithKept,
      folders,
      [{ kind: "list", id: "alpha" }],
      { kind: "folder", id: "a" },
      { kind: "folder", id: "b" },
      1,
    )
    expect(next.folders.find((item) => item.id === "a")?.listIds).not.toContain("alpha")
    expect(next.folders.find((item) => item.id === "b")?.listIds).toEqual(["kept", "alpha"])
    expect(next.folders.find((item) => item.id === "c")?.listIds).toContain("alpha")
  })

  it("puts a list on the library desk and clears every folder", () => {
    const lists = [list({ id: "alpha", name: "Alpha", parentListId: "parent" }), list({ id: "parent", name: "Parent" })]
    const folders = [folder({ id: "work", name: "Work", listIds: ["alpha"], contentsOrder: ["list:alpha"] })]
    const next = placeNavItems(
      lists,
      folders,
      [{ kind: "list", id: "alpha" }],
      { kind: "folder", id: "work" },
      root,
      0,
    )
    expect(next.folders.find((item) => item.id === "work")?.listIds).toEqual([])
    expect(next.lists.find((item) => item.id === "alpha")?.parentListId).toBeUndefined()
    expect(navContainer(next.lists, next.folders, root).map((ref) => ref.id)[0]).toBe("alpha")
  })

  it("nests a list under another list", () => {
    const lists = [list({ id: "parent", name: "Parent" }), list({ id: "child", name: "Child" })]
    const next = placeNavItems(lists, [], [{ kind: "list", id: "child" }], root, { kind: "list", id: "parent" }, 0)
    expect(next.lists.find((item) => item.id === "child")?.parentListId).toBe("parent")
    expect(navContainer(next.lists, next.folders, { kind: "list", id: "parent" }).map((ref) => ref.id)).toEqual([
      "child",
    ])
  })

  it("refuses to file a folder into a list or into its own child", () => {
    const folders = [
      folder({ id: "work", name: "Work" }),
      folder({ id: "q1", name: "Q1", parentFolderId: "work" }),
    ]
    const lists = [list({ id: "alpha", name: "Alpha" })]
    const intoList = placeNavItems(lists, folders, [{ kind: "folder", id: "work" }], root, { kind: "list", id: "alpha" }, 0)
    expect(intoList.folders).toBe(folders)
    const intoChild = placeNavItems(
      lists,
      folders,
      [{ kind: "folder", id: "work" }],
      root,
      { kind: "folder", id: "q1" },
      0,
    )
    expect(intoChild.folders).toBe(folders)
  })

  it("reparents a folder and does not change the arrays when the drop is a no-op", () => {
    const folders = [folder({ id: "work", name: "Work" }), folder({ id: "home", name: "Home" })]
    const moved = placeNavItems([], folders, [{ kind: "folder", id: "home" }], root, { kind: "folder", id: "work" }, 0)
    expect(moved.folders.find((item) => item.id === "home")?.parentFolderId).toBe("work")
    expect(navContainer(moved.lists, moved.folders, { kind: "folder", id: "work" }).map((ref) => ref.id)).toEqual([
      "home",
    ])
    const same = placeNavItems([], folders, [{ kind: "folder", id: "home" }], root, root, 1)
    expect(same.folders).toBe(folders)
  })
})

describe("search and removal", () => {
  it("finds a list in each folder that holds it", () => {
    const lists = [list({ id: "alpha", name: "Alpha shopping" })]
    const folders = [
      folder({ id: "work", name: "Work", listIds: ["alpha"] }),
      folder({ id: "home", name: "Home", listIds: ["alpha"] }),
    ]
    const hits = searchNav(lists, folders, "shop", "all")
    expect(hits.map((hit) => hit.path).sort()).toEqual(["Library / Home", "Library / Work"])
    expect(searchNav(lists, folders, "shop", "folders")).toEqual([])
  })

  it("drops a deleted list from folders and reparents its children", () => {
    const lists = [
      list({ id: "parent", name: "Parent", parentListId: "root-list" }),
      list({ id: "root-list", name: "Root" }),
      list({ id: "child", name: "Child", parentListId: "parent" }),
    ]
    const folders = [folder({ id: "work", name: "Work", listIds: ["parent"], contentsOrder: ["list:parent"] })]
    const next = removeNavList(lists, folders, "parent")
    expect(next.lists.map((item) => item.id)).not.toContain("parent")
    expect(next.lists.find((item) => item.id === "child")?.parentListId).toBe("root-list")
    expect(next.folders[0].listIds).toEqual([])
  })

  it("lifts child folders onto the desk when their parent is removed", () => {
    const folders = [
      folder({ id: "work", name: "Work" }),
      folder({ id: "q1", name: "Q1", parentFolderId: "work" }),
    ]
    const next = removeNavFolder(folders, "work")
    expect(next.map((item) => item.id)).toEqual(["q1"])
    expect(next[0].parentFolderId).toBeUndefined()
  })

  it("snapshots arrangement only", () => {
    const lists = [list({ id: "b", name: "B", order: 1 }), list({ id: "a", name: "A", order: 0 })]
    expect(navSnapshot(lists, [])).toBe(navSnapshot([...lists].reverse(), []))
  })
})

describe("pointer zones", () => {
  it("uses the middle of a row as into, and the edges as reorder", () => {
    expect(rowDropZone(10, 0, 100, true)).toBe("before")
    expect(rowDropZone(50, 0, 100, true)).toBe("into")
    expect(rowDropZone(90, 0, 100, true)).toBe("after")
    expect(rowDropZone(50, 0, 100, false)).toBe("after")
  })

  it("maps a filtered gap onto the full order", () => {
    const full = [
      { kind: "folder" as const, id: "a" },
      { kind: "list" as const, id: "b" },
      { kind: "folder" as const, id: "c" },
    ]
    const visible = [full[0], full[2]]
    expect(insertionIndex(full, visible, 1, "before")).toBe(2)
    expect(insertionIndex(full, visible, 0, "after")).toBe(1)
  })
})

describe("folder order in the file manager", () => {
  it("lets an arranged folder sort ahead of the name order", () => {
    const later = folder({ id: "a", name: "Alpha", order: 2 })
    const sooner = folder({ id: "z", name: "Zulu", order: 0 })
    expect(compareFolders(sooner, later)).toBeLessThan(0)
  })

  it("paints a folder's contentsOrder after All Items", () => {
    const folders = [
      folder({
        id: "work",
        name: "Work",
        listIds: ["beta", "alpha"],
        contentsOrder: ["list:beta", "list:alpha"],
      }),
    ]
    const categories = [list({ id: "alpha", name: "Alpha" }), list({ id: "beta", name: "Beta" })]
    const ids = buildGridEntries({
      isHome: false,
      isAll: false,
      currentFolder: folders[0],
      folders,
      categories,
      homePinned: [],
      showSmartLists: false,
      allTasks: [],
      getSmartTasks: () => [],
      getTasksForCategory: () => [],
      countForFolder: () => 0,
    }).map((entry) => entry.id)
    expect(ids).toEqual(["all-work", "beta", "alpha"])
  })
})
