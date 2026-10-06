import { describe, it, expect } from "vitest"
import { migrateCategoryToList, migrateStripKanbanListDisplays } from "@/lib/task-store"
import {
  migrateTasksToItems,
  migrateModulePlatform,
  migrateTitleAsFieldOfRecord,
  migrateHonestItemTypes,
  migrateLegacyStageStatus,
  migrateScheduleableOptIn,
  migrateModuleListsOutOfScheduler,
  migratePastAssignmentsToUndone,
  migrateUtcMidnightScheduleDates,
} from "@/lib/migrations"
import { countsInDone, isTaskItem } from "@/lib/item-utils"
import type { Folder } from "@/lib/types"

/**
 * v9 category→list migration: a pre-v9 persisted payload keys lists/folders/tasks
 * with the legacy `category` vocabulary. `migrateCategoryToList` rewrites those
 * keys to the new `list` vocabulary in place so old localStorage data and backups
 * keep loading without data loss.
 */
describe("task-store v9 migrateCategoryToList", () => {
  const legacyPayload = () => ({
    tasks: [
      { id: "t1", description: "Read book", category: "list", categories: ["reading", "tobuy"] },
      { id: "t2", description: "Inbox item", category: "inbox", categories: [] },
    ],
    categories: [
      { id: "reading", name: "Reading", color: "#fff" },
      { id: "tobuy", name: "Books to Buy", color: "#000", parentCategoryId: "reading" },
    ],
    folders: [{ id: "f1", name: "Books", categoryIds: ["reading", "tobuy"] }],
  })

  it("renames state.categories → state.lists and drops the legacy key", () => {
    const migrated = migrateCategoryToList(legacyPayload())
    expect(migrated).not.toHaveProperty("categories")
    expect(Array.isArray(migrated.lists)).toBe(true)
    expect(migrated.lists.map((l: any) => l.id)).toEqual(["reading", "tobuy"])
  })

  it("renames List.parentCategoryId → parentListId", () => {
    const migrated = migrateCategoryToList(legacyPayload())
    const tobuy = migrated.lists.find((l: any) => l.id === "tobuy")
    expect(tobuy).not.toHaveProperty("parentCategoryId")
    expect(tobuy.parentListId).toBe("reading")
    // Lists without a parent stay clean (no undefined parentListId key).
    const reading = migrated.lists.find((l: any) => l.id === "reading")
    expect(reading).not.toHaveProperty("parentListId")
  })

  it("renames Folder.categoryIds → listIds", () => {
    const migrated = migrateCategoryToList(legacyPayload())
    expect(migrated.folders[0]).not.toHaveProperty("categoryIds")
    expect(migrated.folders[0].listIds).toEqual(["reading", "tobuy"])
  })

  it("renames Task.category → stage and Task.categories → lists", () => {
    const migrated = migrateCategoryToList(legacyPayload())
    const t1 = migrated.tasks.find((t: any) => t.id === "t1")
    expect(t1).not.toHaveProperty("category")
    expect(t1).not.toHaveProperty("categories")
    expect(t1.stage).toBe("list")
    expect(t1.lists).toEqual(["reading", "tobuy"])
    const t2 = migrated.tasks.find((t: any) => t.id === "t2")
    expect(t2.stage).toBe("inbox")
    expect(t2.lists).toEqual([])
  })

  it("is defensive against partial / non-object input", () => {
    expect(migrateCategoryToList(undefined)).toBeUndefined()
    expect(migrateCategoryToList(null)).toBeNull()
    // A payload missing arrays should not throw and should leave keys absent.
    expect(migrateCategoryToList({})).toEqual({})
  })

  it("preserves already-migrated (v9) payloads as a no-op", () => {
    const v9 = {
      tasks: [{ id: "t1", description: "x", stage: "list", lists: ["reading"] }],
      lists: [{ id: "reading", name: "Reading", color: "#fff" }],
      folders: [{ id: "f1", name: "Books", listIds: ["reading"] }],
    }
    expect(migrateCategoryToList(v9)).toEqual(v9)
  })
})

describe("task-store v10 migrateStripKanbanListDisplays", () => {
  it("removes kanban from enabledDisplays and drops the field when nothing remains", () => {
    const migrated = migrateStripKanbanListDisplays({
      lists: [
        { id: "a", enabledDisplays: ["default", "kanban", "spreadsheet"] },
        { id: "b", enabledDisplays: ["kanban"] },
        { id: "c", name: "plain" },
      ],
    })
    expect(migrated.lists[0].enabledDisplays).toEqual(["default", "spreadsheet"])
    expect(migrated.lists[1]).not.toHaveProperty("enabledDisplays")
    expect(migrated.lists[2]).toEqual({ id: "c", name: "plain" })
  })

  it("is a no-op when lists are missing", () => {
    expect(migrateStripKanbanListDisplays({ folders: [] })).toEqual({ folders: [] })
    expect(migrateStripKanbanListDisplays(null)).toBeNull()
  })
})

/**
 * Pre-v7 vault shape: no `type`, legacy category/categories keys, a mix of
 * inbox / furniture / operation / Next Actions rows. Round-trip through the
 * same named steps the persist hook runs (v7→v13) without deleting description.
 */
function legacyVaultBlob() {
  return {
    tasks: [
      { id: "inbox-1", description: "Call dentist", category: "inbox", categories: [] },
      { id: "rug-1", description: "big area rug", category: "list", categories: ["furniture"] },
      {
        id: "op-1",
        description: "Kitchen remodel",
        type: "operation",
        category: "list",
        categories: ["ops"],
      },
      { id: "na-1", description: "Write intro", category: "clarified", categories: ["na-today"] },
    ],
    categories: [
      { id: "furniture", name: "Furniture", color: "#fff" },
      { id: "ops", name: "Operations", color: "#000" },
      { id: "na-today", name: "Today", color: "#0f0" },
    ],
    folders: [
      { id: "folder-next-actions", name: "Next Actions", categoryIds: ["na-today"] },
      { id: "folder-home", name: "Home", categoryIds: ["furniture"] },
    ],
  }
}

function migrateLegacyVault(blob: ReturnType<typeof legacyVaultBlob>) {
  let state: any = blob
  state = migrateTasksToItems(state)
  state = migrateModulePlatform(state)
  state = migrateCategoryToList(state)
  state = migrateStripKanbanListDisplays(state)
  state = migrateTitleAsFieldOfRecord(state)
  state = migrateHonestItemTypes(state)
  state = migrateLegacyStageStatus(state)
  return state
}

describe("persist v7–v13 round-trip of a real-looking vault", () => {
  it("infers type without dropping description or rewriting explicit types", () => {
    const result = migrateLegacyVault(legacyVaultBlob())
    const byId = Object.fromEntries(result.tasks.map((t: { id: string }) => [t.id, t]))

    expect(byId["inbox-1"].type).toBe("task")
    expect(byId["inbox-1"].description).toBe("Call dentist")
    expect(byId["inbox-1"].stage).toBe("inbox")

    expect(byId["rug-1"].type).toBe("item")
    expect(byId["rug-1"].description).toBe("big area rug")
    expect(byId["rug-1"].lists).toEqual(["furniture"])

    expect(byId["op-1"].type).toBe("operation")
    expect(byId["op-1"].description).toBe("Kitchen remodel")

    expect(byId["na-1"].type).toBe("task")
    expect(byId["na-1"].description).toBe("Write intro")
  })

  it("keeps To-Do Done on tasks and logged-actions, not on furniture", () => {
    const result = migrateLegacyVault(legacyVaultBlob())
    const folders = result.folders as Folder[]
    const rug = result.tasks.find((t: { id: string }) => t.id === "rug-1")
    const na = result.tasks.find((t: { id: string }) => t.id === "na-1")
    expect(isTaskItem(rug, folders)).toBe(false)
    expect(isTaskItem(na, folders)).toBe(true)
    expect(countsInDone({ ...rug, completed: true }, folders)).toBe(false)
    expect(countsInDone({ ...na, completed: true }, folders)).toBe(true)
  })
})

describe("task-store v14 migrateScheduleableOptIn", () => {
  it("turns folder defaults off and leaves lists that were already schedulable", () => {
    const next = migrateScheduleableOptIn({
      folders: [
        { id: "work", name: "Work", scheduleable: true },
        { id: "reading", name: "Reading", scheduleable: false },
      ],
      lists: [
        { id: "desk", name: "Desk", scheduleable: true },
        { id: "books", name: "Books" },
        { id: "__all-items__work", name: "All Items", scheduleable: true },
      ],
    })
    expect(next.folders.map((f) => (f as { scheduleable?: boolean }).scheduleable)).toEqual([false, false])
    expect(next.lists.map((l) => (l as { id: string; scheduleable?: boolean }).scheduleable)).toEqual([
      true,
      undefined,
      false,
    ])
  })
})

describe("task-store v15 migrateModuleListsOutOfScheduler", () => {
  it("turns off module-created lists and leaves a list someone already sent", () => {
    const next = migrateModuleListsOutOfScheduler({
      lists: [
        { id: "itinerary", name: "Cusco", createdByModuleId: "trip", scheduleable: true },
        { id: "desk", name: "Desk", scheduleable: true },
        { id: "already", name: "Quiet", createdByModuleId: "trip", scheduleable: false },
      ],
    })
    expect(next.lists.map((l) => (l as { scheduleable?: boolean }).scheduleable)).toEqual([false, true, false])
  })
})

describe("task-store v16 migratePastAssignmentsToUndone", () => {
  it("records a past live week and leaves the schedule field", () => {
    const now = new Date(2026, 8, 26, 12)
    const next = migratePastAssignmentsToUndone(
      {
        tasks: [
          {
            id: "old",
            completed: false,
            scheduledWeek: "2026-09-14_2026-09-20",
            description: "old",
            createdAt: now,
          },
          {
            id: "now",
            completed: false,
            scheduledWeek: "2026-09-21_2026-09-27",
            description: "now",
            createdAt: now,
          },
          {
            id: "done",
            completed: true,
            scheduledWeek: "2026-09-07_2026-09-13",
            description: "done",
            createdAt: now,
          },
        ],
      },
      now,
    )
    const old = next.tasks?.[0] as { scheduledWeek?: string; schedulePlacements?: { period: string; value: string; resolved?: string }[] }
    expect(old.scheduledWeek).toBe("2026-09-14_2026-09-20")
    expect(old.schedulePlacements).toEqual([{ period: "week", value: "2026-09-14_2026-09-20" }])
    expect((next.tasks?.[1] as { schedulePlacements?: unknown }).schedulePlacements).toBeUndefined()
    expect((next.tasks?.[2] as { schedulePlacements?: unknown }).schedulePlacements).toBeUndefined()
  })
})

describe("task-store v17 migrateUtcMidnightScheduleDates", () => {
  it("moves UTC-midnight schedule dates onto that UTC calendar day and leaves everything else", () => {
    const createdAt = "2026-09-01T08:30:00.000Z"
    const keptDates = ["2026-09-21T00:00:00.000Z"]
    const next = migrateUtcMidnightScheduleDates({
      lists: [{ id: "reading", name: "Reading" }],
      tasks: [
        {
          id: "shifted",
          description: "Pick Monday",
          lists: ["reading"],
          createdAt,
          scheduledDate: "2026-09-21T00:00:00.000Z",
          deadline: "2026-09-22T00:00:00.000Z",
          schedulingConstraints: {
            mustBeDoneAfter: "2026-09-20T00:00:00.000Z",
            mustBeDoneBefore: new Date("2026-09-30T18:00:00.000Z"),
            timeOfDayPreference: "morning",
            canOnlyBeDoneOnDates: keptDates,
          },
        },
        {
          id: "timed",
          description: "Already local",
          scheduledDate: new Date(2026, 8, 21, 15, 0),
          createdAt: new Date("2026-06-01T08:30:00.000Z"),
        },
      ],
    })

    const shifted = next.tasks?.[0] as {
      description: string
      lists: string[]
      createdAt: string
      scheduledDate: Date
      deadline: Date
      schedulingConstraints: {
        mustBeDoneAfter: Date
        mustBeDoneBefore: Date
        timeOfDayPreference: string
        canOnlyBeDoneOnDates: string[]
      }
    }
    expect(shifted.description).toBe("Pick Monday")
    expect(shifted.lists).toEqual(["reading"])
    expect(shifted.createdAt).toBe(createdAt)
    expect(shifted.scheduledDate).toEqual(new Date(2026, 8, 21))
    expect(shifted.deadline).toEqual(new Date(2026, 8, 22))
    expect(shifted.schedulingConstraints.mustBeDoneAfter).toEqual(new Date(2026, 8, 20))
    expect(shifted.schedulingConstraints.mustBeDoneBefore).toEqual(new Date("2026-09-30T18:00:00.000Z"))
    expect(shifted.schedulingConstraints.timeOfDayPreference).toBe("morning")
    expect(shifted.schedulingConstraints.canOnlyBeDoneOnDates).toBe(keptDates)
    expect(next.lists).toEqual([{ id: "reading", name: "Reading" }])

    const timed = next.tasks?.[1] as { scheduledDate: Date; createdAt: Date }
    expect(timed.scheduledDate).toEqual(new Date(2026, 8, 21, 15, 0))
    expect(timed.createdAt).toEqual(new Date("2026-06-01T08:30:00.000Z"))
  })
})
