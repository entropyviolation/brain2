import { describe, expect, it } from "vitest"
import type { Folder } from "@/lib/types"
import { destinationFoldersForSelection, originFolderIdToUnlink, wouldCreateFolderCycle } from "@/lib/folder-selection"

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

describe("wouldCreateFolderCycle", () => {
  const folders = [
    folder({ id: "parent", name: "Parent" }),
    folder({ id: "child", name: "Child", parentFolderId: "parent" }),
    folder({ id: "other", name: "Other" }),
  ]

  it("detects moving a folder into itself", () => {
    expect(wouldCreateFolderCycle(folders, "parent", "parent")).toBe(true)
  })

  it("detects moving a folder into its descendant", () => {
    expect(wouldCreateFolderCycle(folders, "parent", "child")).toBe(true)
  })

  it("allows moving into an unrelated folder", () => {
    expect(wouldCreateFolderCycle(folders, "child", "other")).toBe(false)
  })
})

describe("destinationFoldersForSelection", () => {
  const folders = [
    folder({ id: "folder1", name: "folder1" }),
    folder({ id: "folder2", name: "folder2" }),
    folder({ id: "sub", name: "sub", parentFolderId: "folder1" }),
    folder({ id: "na-sched-d-2026-08-25", name: "Tue Aug 25" }),
  ]

  it("excludes scheduled folders and the current folder", () => {
    expect(
      destinationFoldersForSelection(folders, { currentFolderId: "folder1" }).map((f) => f.id),
    ).toEqual(["folder2", "sub"])
  })

  it("excludes selected folders and destinations that would cycle", () => {
    expect(
      destinationFoldersForSelection(folders, { selectedFolderIds: ["folder1"] }).map((f) => f.id),
    ).toEqual(["folder2"])
  })
})

describe("originFolderIdToUnlink", () => {
  it("unlinks the origin folder only when moving", () => {
    expect(originFolderIdToUnlink({ mode: "move", originFolderId: "folder1", isAll: false })).toBe("folder1")
    expect(originFolderIdToUnlink({ mode: "keep", originFolderId: "folder1", isAll: false })).toBeNull()
  })

  it("never unlinks when the origin is All", () => {
    expect(originFolderIdToUnlink({ mode: "move", originFolderId: "folder1", isAll: true })).toBeNull()
    expect(originFolderIdToUnlink({ mode: "move", originFolderId: null, isAll: true })).toBeNull()
  })
})
