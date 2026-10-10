import { describe, expect, it } from "vitest"
import type { Folder } from "@/lib/types"
import { folderAllItemsCategoryId } from "@/lib/folder-all-items"
import { folderAllSearchTargets, parseFolderAllQuery } from "@/lib/folder-all-query"

function folder(id: string, name: string): Folder {
  return { id, name, createdAt: new Date(), listIds: [] }
}

describe("parseFolderAllQuery", () => {
  it("reads both phrasings, a tight colon, and all items", () => {
    expect(parseFolderAllQuery("cleaning: all")).toBe("cleaning")
    expect(parseFolderAllQuery("cleaning:all")).toBe("cleaning")
    expect(parseFolderAllQuery("Cleaning : All")).toBe("Cleaning")
    expect(parseFolderAllQuery("all cleaning")).toBe("cleaning")
    expect(parseFolderAllQuery("ALL Cleaning")).toBe("Cleaning")
    expect(parseFolderAllQuery("all items cleaning")).toBe("cleaning")
    expect(parseFolderAllQuery("spring cleaning: all")).toBe("spring cleaning")
    expect(parseFolderAllQuery("all spring cleaning")).toBe("spring cleaning")
  })

  it("leaves a bare all for ordinary list search", () => {
    expect(parseFolderAllQuery("all")).toBeNull()
    expect(parseFolderAllQuery("all items")).toBeNull()
    expect(parseFolderAllQuery("")).toBeNull()
    expect(parseFolderAllQuery("groceries")).toBeNull()
  })
})

describe("folderAllSearchTargets", () => {
  const folders = [
    folder("clean", "Cleaning"),
    folder("spring", "Spring Cleaning"),
    folder("east", "Cleaning East"),
    folder("west", "Cleaning West"),
    folder("sched", "Today"),
  ]
  folders[4].id = "na-sched-d-2026-10-10"

  it("resolves cleaning: all and all cleaning to that folder's All Items id", () => {
    for (const query of ["cleaning: all", "cleaning:all", "all cleaning", "all items cleaning"]) {
      const hit = folderAllSearchTargets(query, folders)
      expect(hit.kind).toBe("all")
      expect(hit.targets.map((target) => target.folderId)).toEqual(["clean"])
      expect(hit.targets[0]?.listId).toBe(folderAllItemsCategoryId("clean"))
    }
  })

  it("keeps a multi-word folder name", () => {
    const hit = folderAllSearchTargets("all spring cleaning", folders)
    expect(hit.targets.map((target) => target.folderId)).toEqual(["spring"])
    expect(folderAllSearchTargets("spring cleaning: all", folders).targets.map((target) => target.folderId)).toEqual([
      "spring",
    ])
  })

  it("returns every close folder instead of picking one", () => {
    const hit = folderAllSearchTargets("all clean", folders)
    expect(hit.kind).toBe("all")
    expect(hit.targets.map((target) => target.folderId).sort()).toEqual(["clean", "east", "west"])
  })

  it("does not collapse two folders that share a name", () => {
    const twins = [folder("a", "Cleaning"), folder("b", "Cleaning")]
    const hit = folderAllSearchTargets("cleaning: all", twins)
    expect(hit.targets.map((target) => target.folderId).sort()).toEqual(["a", "b"])
  })

  it("offers All for one unambiguous folder name, and not for a bare all", () => {
    expect(folderAllSearchTargets("cleaning", folders).targets.map((target) => target.folderId)).toEqual(["clean"])
    expect(folderAllSearchTargets("all", folders)).toEqual({ kind: "none", targets: [] })
    expect(folderAllSearchTargets("", folders).kind).toBe("none")
  })

  it("skips scheduled period folders", () => {
    const only = [folder("na-sched-d-2026-10-10", "Today")]
    expect(folderAllSearchTargets("today: all", only).targets).toEqual([])
  })
})
