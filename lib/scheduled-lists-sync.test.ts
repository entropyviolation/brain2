import { describe, expect, it, vi } from "vitest"
import { isAutoScheduledPeriodFolder, syncScheduledFolderHierarchy, syncNextActionsSmartLists, tasksForNaSmartList } from "@/lib/scheduled-lists-sync"
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
        stage: "list",
        completed: false,
        scheduledDate: new Date("2026-07-08T12:00:00"),
        lists: [],
        createdAt: new Date(),
      },
    ]

    syncScheduledFolderHierarchy(tasks, mut)

    expect(folders.some((f) => f.id === "na-scheduled")).toBe(true)
    expect(folders.some((f) => f.id === "na-sched-d-2026-07-08")).toBe(true)
    expect(deleted).toContain("na-sched-d-2026-01-01")
    expect(folders.find((f) => f.id === "na-sched-m-2026-07")?.name).toBe("July 2026")
    expect(folders.find((f) => f.id.startsWith("na-sched-w-"))?.name).toMatch(/week of Jul \d+, 2026/)
  })
})

describe("Next Actions archive auto-lists", () => {
  it("creates Completed and Missed Opportunities lists in Next Actions", () => {
    const folders: Folder[] = [
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: [] },
    ]
    const lists: List[] = []
    const mut = {
      lists,
      folders,
      addList: (c: List) => {
        lists.push(c)
      },
      updateList: vi.fn(),
      addFolder: vi.fn(),
      updateFolder: (f: Folder) => {
        const i = folders.findIndex((x) => x.id === f.id)
        if (i >= 0) folders[i] = f
      },
    }
    syncNextActionsSmartLists(mut)
    expect(lists.map((l) => l.id)).toEqual(
      expect.arrayContaining(["na-smart-daily", "na-smart-weekly", "na-smart-monthly", "na-smart-completed", "na-smart-missed"]),
    )
    expect(lists.find((l) => l.id === "na-smart-completed")?.autoArchive).toBe("completed")
    expect(lists.find((l) => l.id === "na-smart-missed")?.name).toBe("Missed Opportunities")
    expect(folders[0].listIds).toEqual(
      expect.arrayContaining(["na-smart-completed", "na-smart-missed"]),
    )
  })

  it("reuses a same-named Completed list already in Next Actions", () => {
    const folders: Folder[] = [
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: ["user-done"] },
    ]
    const lists: List[] = [
      { id: "user-done", name: "Completed", color: "#111", createdAt: new Date() },
    ]
    const mut = {
      lists,
      folders,
      addList: (c: List) => {
        lists.push(c)
      },
      updateList: (c: List) => {
        const i = lists.findIndex((x) => x.id === c.id)
        if (i >= 0) lists[i] = c
      },
      addFolder: vi.fn(),
      updateFolder: (f: Folder) => {
        const i = folders.findIndex((x) => x.id === f.id)
        if (i >= 0) folders[i] = f
      },
    }
    syncNextActionsSmartLists(mut)
    expect(lists.filter((l) => l.name === "Completed")).toHaveLength(1)
    expect(lists.find((l) => l.id === "user-done")?.autoArchive).toBe("completed")
    expect(lists.some((l) => l.id === "na-smart-completed")).toBe(false)
  })

  it("period To Do smart lists still filter by schedule", () => {
    const now = new Date("2026-09-21T12:00:00")
    const tasks: Task[] = [
      {
        id: "open",
        description: "Open",
        stage: "scheduled",
        completed: false,
        lists: [],
        createdAt: now,
        scheduledDate: now,
      },
      {
        id: "done",
        description: "Done",
        stage: "completed",
        completed: true,
        status: "done",
        lists: ["na-smart-completed"],
        createdAt: now,
        completedDate: now,
      },
    ]
    expect(tasksForNaSmartList("na-smart-daily", tasks, now).map((t) => t.id)).toEqual(["open"])
    expect(tasksForNaSmartList("na-smart-completed", tasks, now)).toEqual([])
  })
})
