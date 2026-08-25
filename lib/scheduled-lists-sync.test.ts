import { describe, expect, it, vi } from "vitest"
import { isAutoScheduledPeriodFolder, syncScheduledFolderHierarchy } from "@/lib/scheduled-lists-sync"
import type { Folder, List, Task } from "@/lib/types"

describe("scheduled-lists-sync", () => {
  it("identifies auto scheduled period folders", () => {
    expect(isAutoScheduledPeriodFolder("na-sched-d-2026-07-08")).toBe(true)
    expect(isAutoScheduledPeriodFolder("na-scheduled")).toBe(false)
    expect(isAutoScheduledPeriodFolder("folder-next-actions")).toBe(false)
  })

  it("creates nested folders with chronological labels and removes stale ones", () => {
    const folders: Folder[] = [
      {
        id: "folder-next-actions",
        name: "Next Actions",
        createdAt: new Date(),
        listIds: [],
      },
      {
        id: "na-sched-d-2026-01-01",
        name: "Old day",
        createdAt: new Date(),
        listIds: [],
        parentFolderId: "na-scheduled",
      },
    ]
    const lists: List[] = []
    const deleted: string[] = []

    const mut = {
      lists,
      folders,
      addList: vi.fn(),
      updateList: vi.fn(),
      addFolder: (f: Folder) => {
        folders.push(f)
      },
      updateFolder: (f: Folder) => {
        const i = folders.findIndex((x) => x.id === f.id)
        if (i >= 0) folders[i] = f
      },
      deleteFolder: (id: string) => {
        deleted.push(id)
        const i = folders.findIndex((f) => f.id === id)
        if (i >= 0) folders.splice(i, 1)
      },
    }

    const tasks: Task[] = [
      {
        id: "t1",
        description: "Task",
        completed: false,
        scheduledDate: new Date("2026-07-08T12:00:00"),
        lists: [],
        createdAt: new Date(),
      } as Task,
    ]

    syncScheduledFolderHierarchy(tasks, mut)

    expect(folders.some((f) => f.id === "na-scheduled")).toBe(true)
    expect(folders.some((f) => f.id === "na-sched-d-2026-07-08")).toBe(true)
    expect(deleted).toContain("na-sched-d-2026-01-01")
    expect(folders.find((f) => f.id === "na-sched-m-2026-07")?.name).toBe("July 2026")
    expect(folders.find((f) => f.id.startsWith("na-sched-w-"))?.name).toMatch(/week of Jul \d+, 2026/)
  })
})
