import { describe, expect, it } from "vitest"
import type { Folder } from "@/lib/types"
import {
  canFileListInFolder,
  diffListFolderMembership,
  directFolderIdsForList,
  fileListInFolderBlockReason,
  foldersContainingEntry,
  foldersContainingList,
  formatWithinValue,
  inheritedFoldersForList,
  selectableFoldersForList,
  visibleFolderMemberships,
} from "@/lib/folder-membership"

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

describe("foldersContainingList", () => {
  const folders = [
    folder({ id: "work", name: "Work", listIds: ["groceries", "tasks"] }),
    folder({ id: "home", name: "Home", listIds: ["groceries"] }),
    folder({ id: "empty", name: "Empty", listIds: [] }),
  ]

  it("returns every folder that references the list, sorted by name", () => {
    expect(foldersContainingList(folders, "groceries").map((f) => f.name)).toEqual(["Home", "Work"])
  })

  it("returns an empty list when the list is unfiled", () => {
    expect(foldersContainingList(folders, "orphan")).toEqual([])
  })
})

describe("foldersContainingEntry", () => {
  const folders = [
    folder({ id: "root", name: "Root", listIds: ["l1"] }),
    folder({ id: "child", name: "Child", parentFolderId: "root", listIds: [] }),
  ]

  it("uses ancestor folders for a nested folder", () => {
    expect(foldersContainingEntry({ kind: "folder", id: "child" }, folders).map((f) => f.name)).toEqual(["Root"])
  })

  it("uses list membership for a list", () => {
    expect(foldersContainingEntry({ kind: "list", id: "l1" }, folders).map((f) => f.id)).toEqual(["root"])
  })

  it("maps a folder All Items entry to that folder", () => {
    expect(foldersContainingEntry({ kind: "folder-all", id: "all-root" }, folders)).toEqual([])
    expect(foldersContainingEntry({ kind: "folder-all", id: "all-child" }, folders).map((f) => f.id)).toEqual(["child"])
  })
})

describe("formatWithinValue", () => {
  const containing = [
    folder({ id: "a", name: "Alpha" }),
    folder({ id: "b", name: "Beta" }),
  ]

  it("shows a count by default and names when requested", () => {
    expect(formatWithinValue(containing, false)).toBe("2")
    expect(formatWithinValue(containing, true)).toBe("Alpha, Beta")
    expect(formatWithinValue([], false)).toBe("0")
    expect(formatWithinValue([], true)).toBe("—")
  })
})

describe("direct vs inherited membership", () => {
  const folders = [
    folder({ id: "house", name: "House" }),
    folder({ id: "kitchen", name: "Kitchen", parentFolderId: "house", listIds: ["dishes"] }),
    folder({ id: "yard", name: "Yard", parentFolderId: "house" }),
    folder({ id: "studio", name: "Studio", listIds: ["dishes"] }),
  ]

  it("direct ids are only the folders that list the item", () => {
    expect(directFolderIdsForList(folders, "dishes")).toEqual(["kitchen", "studio"])
  })

  it("inherited ancestors exclude folders that are also direct", () => {
    const inherited = inheritedFoldersForList(folders, "dishes")
    expect(inherited.map((m) => m.folder.id)).toEqual(["house"])
    expect(inherited[0]?.kind).toBe("inherited")
    expect(inherited[0]?.viaFolderIds).toEqual(["kitchen"])
  })

  it("default visible membership is direct only", () => {
    expect(visibleFolderMemberships(folders, "dishes", false).map((m) => m.folder.id)).toEqual([
      "kitchen",
      "studio",
    ])
    expect(visibleFolderMemberships(folders, "dishes", false).every((m) => m.kind === "direct")).toBe(true)
  })

  it("show nested lists inherited ancestors without duplicating directs", () => {
    const visible = visibleFolderMemberships(folders, "dishes", true)
    expect(visible.map((m) => [m.folder.id, m.kind])).toEqual([
      ["kitchen", "direct"],
      ["studio", "direct"],
      ["house", "inherited"],
    ])
  })

  it("a parent that is also a direct filing stays direct, not inherited", () => {
    const houseAndKitchen = folders.map((f) =>
      f.id === "house" ? { ...f, listIds: ["dishes"] } : f,
    )
    const visible = visibleFolderMemberships(houseAndKitchen, "dishes", true)
    expect(visible.filter((m) => m.folder.id === "house").map((m) => m.kind)).toEqual(["direct"])
    expect(visible.filter((m) => m.kind === "inherited")).toEqual([])
  })
})

describe("cycle and filing guards", () => {
  const folders = [
    folder({ id: "kitchen", name: "Kitchen", listIds: ["dishes"] }),
    folder({ id: "na-sched-d-2026-09-21", name: "Mon Sep 21" }),
  ]

  it("rejects filing a list into a folder with the same id", () => {
    expect(fileListInFolderBlockReason(folders, "kitchen", "kitchen")).toBe("self")
    expect(canFileListInFolder(folders, "kitchen", "kitchen")).toBe(false)
  })

  it("rejects scheduled period folders and missing ids", () => {
    expect(fileListInFolderBlockReason(folders, "dishes", "na-sched-d-2026-09-21")).toBe("scheduled")
    expect(fileListInFolderBlockReason(folders, "dishes", "nope")).toBe("missing")
  })

  it("rejects virtual All Items lists", () => {
    expect(fileListInFolderBlockReason(folders, "__all-items__kitchen", "kitchen")).toBe("virtual-list")
  })

  it("selectable folders skip scheduled destinations", () => {
    expect(selectableFoldersForList(folders, "dishes").map((f) => f.id)).toEqual(["kitchen"])
  })

  it("diff add/remove uses only allowed folder ids", () => {
    expect(diffListFolderMembership(folders, "dishes", ["kitchen", "nope"])).toEqual({
      add: [],
      remove: [],
    })
    const extra = [...folders, folder({ id: "yard", name: "Yard" })]
    expect(diffListFolderMembership(extra, "dishes", ["yard"])).toEqual({
      add: ["yard"],
      remove: ["kitchen"],
    })
  })
})
