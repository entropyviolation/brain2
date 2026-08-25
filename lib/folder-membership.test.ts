import { describe, expect, it } from "vitest"
import type { Folder } from "@/lib/types"
import {
  foldersContainingEntry,
  foldersContainingList,
  formatWithinValue,
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
