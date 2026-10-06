import { describe, expect, it, vi } from "vitest"
import {
  isAutoScheduledPeriodFolder,
  periodTodoListName,
  syncScheduledFolderHierarchy,
  syncNextActionsSmartLists,
  tasksForNaSmartList,
  periodLedgerListId,
  tasksForPeriodLedgerList,
  tasksForPeriodTodoList,
} from "@/lib/scheduled-lists-sync"
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
      addList: (list: List) => {
        lists.push(list)
      },
      deleteList: (id: string) => {
        const i = lists.findIndex((list) => list.id === id)
        if (i >= 0) lists.splice(i, 1)
      },
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
    expect(lists.map((list) => list.name)).toEqual(
      expect.arrayContaining(["To do 2026", "To do July 2026", "To do 7/6-7/12", "To do 7/8"]),
    )
    const weekList = lists.find((list) => list.name === "To do 7/6-7/12")
    expect(weekList).toBeTruthy()
    expect(folders.find((f) => f.listIds.includes(weekList!.id))?.id.startsWith("na-sched-w-")).toBe(true)
    expect(tasksForPeriodTodoList(weekList!.id, tasks).map((task) => task.id)).toEqual(["t1"])
    expect(periodTodoListName("week", "2026-08-31_2026-09-06")).toBe("To do 8/31-9/6")
  })

  it("puts Done and Undone next to To do, matching that period", () => {
    const folders: Folder[] = [
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: [] },
    ]
    const lists: List[] = []
    const mut = {
      lists,
      folders,
      addList: (list: List) => {
        lists.push(list)
      },
      updateList: (list: List) => {
        const i = lists.findIndex((item) => item.id === list.id)
        if (i >= 0) lists[i] = list
      },
      deleteList: () => {},
      addFolder: (folder: Folder) => {
        folders.push(folder)
      },
      updateFolder: (folder: Folder) => {
        const i = folders.findIndex((item) => item.id === folder.id)
        if (i >= 0) folders[i] = folder
      },
      deleteFolder: () => {},
    }
    const day = "2026-07-08"
    const tasks: Task[] = [
      {
        id: "open",
        description: "Still that day",
        stage: "list",
        type: "task",
        completed: false,
        scheduledDate: new Date(2026, 6, 8, 12),
        lists: [],
        createdAt: new Date(),
      },
      {
        id: "finished",
        description: "Finished that day",
        stage: "list",
        type: "task",
        completed: true,
        completedDate: new Date(2026, 6, 8, 18),
        lists: [],
        createdAt: new Date(),
      },
      {
        id: "left",
        description: "Missed the day",
        stage: "list",
        type: "task",
        completed: false,
        scheduledDate: new Date(2026, 6, 9, 12),
        schedulePlacements: [{ period: "day", value: day }],
        lists: [],
        createdAt: new Date(),
      },
    ]

    syncScheduledFolderHierarchy(tasks, mut)

    const todoId = periodLedgerListId("todo", "day", day)
    const doneId = periodLedgerListId("done", "day", day)
    const undoneId = periodLedgerListId("undone", "day", day)
    expect(lists.map((list) => list.id)).toEqual(expect.arrayContaining([todoId, doneId, undoneId]))
    expect(lists.find((list) => list.id === doneId)?.name).toBe("Done 7/8")
    expect(lists.find((list) => list.id === undoneId)?.name).toBe("Undone 7/8")
    expect(lists.some((list) => list.id === periodLedgerListId("undone", "year", "2026"))).toBe(false)
    expect(tasksForPeriodLedgerList(todoId, tasks, folders).map((task) => task.id)).toEqual([])
    expect(tasksForPeriodLedgerList(doneId, tasks, folders).map((task) => task.id)).toEqual(["finished"])
    expect(tasksForPeriodLedgerList(undoneId, tasks, folders).map((task) => task.id)).toEqual(["open", "left"])
  })

  it("files a date-only scheduled day on that calendar day", () => {
    const folders: Folder[] = [
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: [] },
    ]
    const lists: List[] = []
    const mut = {
      lists,
      folders,
      addList: (list: List) => {
        lists.push(list)
      },
      updateList: () => {},
      deleteList: () => {},
      addFolder: (folder: Folder) => {
        folders.push(folder)
      },
      updateFolder: (folder: Folder) => {
        const i = folders.findIndex((item) => item.id === folder.id)
        if (i >= 0) folders[i] = folder
      },
      deleteFolder: () => {},
    }
    const tasks: Task[] = [
      {
        id: "s",
        description: "String day",
        stage: "list",
        completed: false,
        scheduledDate: "2026-07-08",
        lists: [],
        createdAt: new Date(),
      },
    ]
    syncScheduledFolderHierarchy(tasks, mut)
    expect(lists.some((list) => list.id === periodLedgerListId("todo", "day", "2026-07-08"))).toBe(true)
    expect(lists.some((list) => list.id === periodLedgerListId("todo", "day", "2026-07-07"))).toBe(false)
    expect(tasksForPeriodLedgerList(periodLedgerListId("undone", "day", "2026-07-08"), tasks, folders).map((t) => t.id)).toEqual(["s"])
  })

  it("keeps a cross-month week under its Monday and does not rewrite it on the next pass", () => {
    const folders: Folder[] = [
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: [] },
    ]
    const lists: List[] = []
    let folderWrites = 0
    let listWrites = 0
    const mut = {
      lists,
      folders,
      addList: (list: List) => {
        lists.push(list)
        listWrites += 1
      },
      updateList: (list: List) => {
        listWrites += 1
        const i = lists.findIndex((item) => item.id === list.id)
        if (i >= 0) lists[i] = list
      },
      deleteList: (id: string) => {
        listWrites += 1
        const i = lists.findIndex((list) => list.id === id)
        if (i >= 0) lists.splice(i, 1)
      },
      addFolder: (folder: Folder) => {
        folders.push(folder)
        folderWrites += 1
      },
      updateFolder: (folder: Folder) => {
        folderWrites += 1
        const i = folders.findIndex((item) => item.id === folder.id)
        if (i >= 0) folders[i] = folder
      },
      deleteFolder: (id: string) => {
        folderWrites += 1
        const i = folders.findIndex((folder) => folder.id === id)
        if (i >= 0) folders.splice(i, 1)
      },
    }
    const tasks: Task[] = [
      {
        id: "sun",
        description: "Sunday in the next month",
        stage: "list",
        completed: false,
        scheduledDate: new Date(2026, 8, 6, 12),
        lists: [],
        createdAt: new Date(),
      },
    ]

    syncScheduledFolderHierarchy(tasks, mut)
    const week = folders.find((folder) => folder.id.startsWith("na-sched-w-"))
    expect(week?.id).toBe("na-sched-w-2026-08-31_2026-09-06")
    expect(week?.parentFolderId).toBe("na-sched-m-2026-08")
    expect(folders.find((folder) => folder.id === "na-sched-d-2026-09-06")?.parentFolderId).toBe(week?.id)

    folderWrites = 0
    listWrites = 0
    syncScheduledFolderHierarchy(tasks, mut)
    expect(folderWrites).toBe(0)
    expect(listWrites).toBe(0)
    expect(folders.find((folder) => folder.id === week?.id)?.parentFolderId).toBe("na-sched-m-2026-08")
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
    expect(lists.find((l) => l.id === "na-smart-daily")?.scheduleable).toBe(false)
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
