import { describe, it, expect } from "vitest"
import { migrateCategoryToList } from "@/lib/task-store"

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
