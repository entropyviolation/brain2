import { describe, expect, it } from "vitest"
import {
  buildFolderTree,
  compareFolders,
  defaultExpandedFolderIds,
  flattenFolderTree,
  getFolderChildren,
  getRootFolders,
  sortFolders,
} from "@/lib/folder-tree"
import type { Folder } from "@/lib/types"

const folder = (partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder => ({
  createdAt: new Date(),
  listIds: [],
  ...partial,
})

describe("folder-tree", () => {
  it("sorts scheduled folders chronologically", () => {
    const folders = [
      folder({ id: "na-sched-d-2026-06-26", name: "Fri Jun 26", parentFolderId: "na-sched-w-2026-06-22_2026-06-28" }),
      folder({ id: "na-sched-d-2026-06-25", name: "Thu Jun 25", parentFolderId: "na-sched-w-2026-06-22_2026-06-28" }),
      folder({ id: "na-sched-w-2026-06-15_2026-06-21", name: "week of Jun 15, 2026", parentFolderId: "na-sched-m-2026-06" }),
      folder({ id: "na-sched-w-2026-06-22_2026-06-28", name: "week of Jun 22, 2026", parentFolderId: "na-sched-m-2026-06" }),
    ]
    const sorted = sortFolders(folders).map((f) => f.id)
    expect(sorted).toEqual([
      "na-sched-w-2026-06-15_2026-06-21",
      "na-sched-w-2026-06-22_2026-06-28",
      "na-sched-d-2026-06-25",
      "na-sched-d-2026-06-26",
    ])
  })

  it("returns only root folders", () => {
    const folders = [
      folder({ id: "f1", name: "Work" }),
      folder({ id: "f2", name: "Personal", parentFolderId: "f1" }),
      folder({ id: "na", name: "Next Actions" }),
      folder({ id: "na-scheduled", name: "Scheduled", parentFolderId: "na" }),
    ]
    expect(getRootFolders(folders).map((f) => f.id)).toEqual(["na", "f1"])
  })

  it("builds nested tree and respects expanded state", () => {
    const folders = [
      folder({ id: "na", name: "Next Actions" }),
      folder({ id: "na-scheduled", name: "Scheduled", parentFolderId: "na" }),
      folder({ id: "na-sched-y-2026", name: "2026", parentFolderId: "na-scheduled" }),
      folder({ id: "wanted", name: "wanted" }),
    ]
    const tree = buildFolderTree(folders)
    const collapsed = flattenFolderTree(tree, new Set())
    expect(collapsed.map((n) => n.folder.id)).toEqual(["na", "wanted"])

    const expanded = flattenFolderTree(tree, new Set(["na", "na-scheduled"]))
    expect(expanded.map((n) => n.folder.id)).toEqual(["na", "na-scheduled", "na-sched-y-2026", "wanted"])
  })

  it("auto-expands ancestors of active location", () => {
    const folders = [
      folder({ id: "na", name: "Next Actions" }),
      folder({ id: "na-scheduled", name: "Scheduled", parentFolderId: "na" }),
      folder({ id: "na-sched-w-2026-07-06_2026-07-12", name: "week of Jul 6, 2026", parentFolderId: "na-sched-m-2026-07" }),
      folder({ id: "na-sched-m-2026-07", name: "July 2026", parentFolderId: "na-sched-y-2026" }),
      folder({ id: "na-sched-y-2026", name: "2026", parentFolderId: "na-scheduled" }),
      folder({ id: "na-sched-d-2026-07-08", name: "Wed Jul 8", parentFolderId: "na-sched-w-2026-07-06_2026-07-12" }),
    ]
    const expanded = defaultExpandedFolderIds(folders, "na-sched-d-2026-07-08")
    expect(expanded.has("na")).toBe(true)
    expect(expanded.has("na-scheduled")).toBe(true)
    expect(expanded.has("na-sched-d-2026-07-08")).toBe(true)
  })

  it("orders user folders alphabetically after Next Actions", () => {
    const a = folder({ id: "f-wanted", name: "wanted" })
    const b = folder({ id: "folder-next-actions", name: "next actions" })
    const c = folder({ id: "f-clean", name: "cleaning" })
    expect(compareFolders(b, a)).toBeLessThan(0)
    expect(getFolderChildren([a, b, c], "missing")).toEqual([])
  })

  it("orders Module Lists after Next Actions and before user folders", () => {
    const wanted = folder({ id: "f-wanted", name: "wanted" })
    const next = folder({ id: "folder-next-actions", name: "next actions" })
    const modules = folder({ id: "folder-module-lists", name: "Module Lists" })
    expect(compareFolders(next, modules)).toBeLessThan(0)
    expect(compareFolders(modules, wanted)).toBeLessThan(0)
  })
})
