import { describe, it, expect } from "vitest"
import { migrateTaskToItem, migrateTasksToItems, migrateModulePlatform } from "@/lib/migrations"

describe("migrateTaskToItem", () => {
  it("backfills base-Item fields and defaults type to 'task'", () => {
    const migrated = migrateTaskToItem({
      id: "1",
      description: "Buy milk",
      category: "list",
      completed: false,
    })
    expect(migrated).toMatchObject({
      id: "1",
      type: "task",
      title: "Buy milk",
      tags: [],
      links: [],
    })
  })

  it("does not introduce a status field or alter category/categories", () => {
    const migrated = migrateTaskToItem({
      id: "2",
      description: "Plan trip",
      category: "clarified",
      categories: ["travel"],
    })
    expect(migrated).not.toHaveProperty("status")
    expect(migrated.category).toBe("clarified")
    expect(migrated.categories).toEqual(["travel"])
  })

  it("preserves existing base-Item fields when already present", () => {
    const migrated = migrateTaskToItem({
      id: "3",
      description: "x",
      type: "book",
      title: "Dune",
      tags: ["sci-fi"],
      links: [{ id: "l1", relation: "by", targetId: "author-1" }],
    })
    expect(migrated.type).toBe("book")
    expect(migrated.title).toBe("Dune")
    expect(migrated.tags).toEqual(["sci-fi"])
    expect(migrated.links).toEqual([{ id: "l1", relation: "by", targetId: "author-1" }])
  })
})

describe("migrateTasksToItems", () => {
  it("backfills every task in the state blob", () => {
    const result = migrateTasksToItems({
      tasks: [
        { id: "1", description: "a", category: "inbox" },
        { id: "2", description: "b", category: "completed", completed: true },
      ],
      categories: [],
    })
    expect(result.tasks?.[0]).toMatchObject({ id: "1", type: "task", title: "a" })
    expect(result.tasks?.[1]).toMatchObject({ id: "2", type: "task", title: "b" })
  })

  it("returns state untouched when tasks is missing", () => {
    const state = { categories: [] }
    expect(migrateTasksToItems(state)).toBe(state)
  })
})

describe("migrateModulePlatform (v8)", () => {
  it("is a backward-compatible no-op that preserves all existing data", () => {
    const state = {
      tasks: [
        { id: "1", description: "a", category: "inbox", type: "task", title: "a", tags: [], links: [] },
      ],
      categories: [{ id: "c1", name: "List", color: "#fff" }],
      folders: [],
    }
    const result = migrateModulePlatform(state)
    expect(result).toEqual(state)
    expect(result.tasks).toEqual(state.tasks)
    expect(result.tasks[0]).not.toHaveProperty("status")
  })

  it("returns the same reference (no copy, no loss)", () => {
    const state = { tasks: [], categories: [] }
    expect(migrateModulePlatform(state)).toBe(state)
  })
})
