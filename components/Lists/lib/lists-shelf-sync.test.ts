import { describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import { sameFolderTree, sameListShelf, scheduleMaintenanceKey } from "./lists-shelf-sync"

const createdAt = new Date("2026-06-01T12:00:00")

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  const description = partial.description ?? partial.id
  const type = partial.type ?? "item"
  return {
    title: partial.title ?? description,
    description,
    type,
    stage: "clarified",
    createdAt,
    completed: false,
    lists: [],
    tags: [],
    links: [],
    subtasks: [],
    rewardValue: 0,
    ...(type === "task"
      ? {
          estimatedDuration: 30,
          cognitiveLoad: 2,
          urgency: 3,
          importance: 3,
          context: "",
          entropy: 0,
          allowPartialCompletion: false,
          minimumChunkSize: 15,
        }
      : {}),
    ...partial,
  }
}

function folder(partial: Partial<Folder> & Pick<Folder, "id">): Folder {
  return {
    name: partial.id,
    createdAt,
    listIds: [],
    ...partial,
  }
}

function list(partial: Partial<List> & Pick<List, "id" | "name">): List {
  return {
    color: "#336699",
    createdAt,
    scheduleable: false,
    ...partial,
  }
}

describe("lists shelf sync equality", () => {
  it("treats a wash as the same shelf, and ignores a title edit in the maintenance key", () => {
    const before = folder({ id: "trips", name: "Trips", parentFolderId: "home", listIds: ["pack", "maps"] })
    const washed = folder({ id: "trips", name: "Trips", parentFolderId: "home", listIds: ["pack", "maps"], color: "#112233" })
    expect(sameFolderTree([before], [washed])).toBe(true)
    expect(sameFolderTree([before], [before])).toBe(true)
    expect(sameFolderTree([before], [folder({ id: "trips", name: "Trips", listIds: ["maps", "pack"] })])).toBe(false)
    expect(sameFolderTree([before], [folder({ id: "trips", name: "Trips renamed", listIds: ["pack", "maps"] })])).toBe(false)

    const shelf = list({ id: "pack", name: "Pack", autoArchive: "completed" })
    expect(sameListShelf([shelf], [list({ id: "pack", name: "Pack", autoArchive: "completed" })])).toBe(true)
    expect(sameListShelf([shelf], [list({ id: "pack", name: "Pack", autoArchive: "missed" })])).toBe(false)
    expect(sameListShelf([shelf], [list({ id: "pack", name: "Packing" })])).toBe(false)

    const row = task({ id: "boots", description: "Boots", title: "Boots", lists: ["pack"] })
    const renamed = task({ id: "boots", description: "Hiking boots", title: "Hiking boots", lists: ["pack"] })
    expect(scheduleMaintenanceKey([row])).toBe(scheduleMaintenanceKey([renamed]))
    expect(scheduleMaintenanceKey([task({ id: "boots", lists: ["maps"] })])).not.toBe(scheduleMaintenanceKey([row]))
    expect(scheduleMaintenanceKey([task({ id: "boots", lists: ["pack"], completed: true })])).not.toBe(
      scheduleMaintenanceKey([row]),
    )
  })
})
