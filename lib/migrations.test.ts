import { describe, it, expect } from "vitest"
import {
  migrateTaskToItem,
  migrateTasksToItems,
  migrateModulePlatform,
  migrateTitleAsFieldOfRecord,
  migrateHonestItemTypes,
  inferMissingItemType,
} from "@/lib/migrations"

describe("migrateTaskToItem", () => {
  it("backfills title/tags/links and does not invent a type", () => {
    const migrated = migrateTaskToItem({
      id: "1",
      description: "Buy milk",
      category: "list",
      completed: false,
    })
    expect(migrated).toMatchObject({
      id: "1",
      title: "Buy milk",
      tags: [],
      links: [],
    })
    expect(migrated).not.toHaveProperty("type")
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
    expect(result.tasks?.[0]).toMatchObject({ id: "1", title: "a" })
    expect(result.tasks?.[0]).not.toHaveProperty("type")
    expect(result.tasks?.[1]).toMatchObject({ id: "2", title: "b" })
    expect(result.tasks?.[1]).not.toHaveProperty("type")
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

describe("migrateTitleAsFieldOfRecord", () => {
  it("backfills a missing title from the description", () => {
    const result = migrateTitleAsFieldOfRecord({ tasks: [{ id: "1", description: "Buy milk" }] })
    expect(result.tasks[0]).toMatchObject({ title: "Buy milk", description: "Buy milk" })
  })

  it("leaves a drifted pair alone rather than guessing which side is current", () => {
    // `noteToParkedItem` stores a short title and the note's full text in
    // description on purpose, and search indexes description but not body.
    // Reconciling here would make parked notes unfindable.
    const task = { id: "1", title: "Weekend", description: "Weekend\nMilk\nEggs" }
    expect(migrateTitleAsFieldOfRecord({ tasks: [task] }).tasks[0]).toBe(task)
  })

  it("never clears the description mirror", () => {
    const result = migrateTitleAsFieldOfRecord({ tasks: [{ id: "1", description: "Buy milk" }] })
    expect(result.tasks[0]).toHaveProperty("description", "Buy milk")
  })

  it("leaves a titled record with no description alone", () => {
    const task = { id: "1", title: "Kept", description: "" }
    expect(migrateTitleAsFieldOfRecord({ tasks: [task] }).tasks[0]).toBe(task)
  })

  it("leaves a record with neither alone rather than inventing a name", () => {
    const task = { id: "1" }
    expect(migrateTitleAsFieldOfRecord({ tasks: [task] }).tasks[0]).toBe(task)
  })

  it("is idempotent and touches nothing already in agreement", () => {
    const task = { id: "1", title: "Buy milk", description: "Buy milk" }
    const once = migrateTitleAsFieldOfRecord({ tasks: [task] })
    expect(once.tasks[0]).toBe(task)
    expect(migrateTitleAsFieldOfRecord(once).tasks[0]).toBe(task)
  })

  it("preserves every other field on the record", () => {
    const result = migrateTitleAsFieldOfRecord({
      tasks: [{ id: "1", description: "Buy milk", stage: "list", lists: ["l1"], somethingUnknown: 7 }],
    })
    expect(result.tasks[0]).toMatchObject({ stage: "list", lists: ["l1"], somethingUnknown: 7 })
  })

  it("tolerates a state with no tasks array", () => {
    const state = { lists: [] }
    expect(migrateTitleAsFieldOfRecord(state)).toBe(state)
  })
})

describe("migrateHonestItemTypes (v12)", () => {
  const folders = [
    { id: "folder-next-actions", name: "Next Actions", listIds: ["na-today"] },
    { id: "folder-stuff", name: "Home", listIds: ["furniture"] },
  ]

  it("leaves an explicit type alone, including operation / note / catalog", () => {
    expect(inferMissingItemType({ type: "operation", stage: "list" }, [])).toBe("operation")
    expect(inferMissingItemType({ type: "note" }, [])).toBe("note")
    expect(inferMissingItemType({ type: "book" }, [])).toBe("book")
    const state = {
      folders,
      tasks: [
        { id: "op", description: "Kitchen remodel", type: "operation", stage: "list" },
        { id: "note", description: "Weekend\nMilk", type: "note", title: "Weekend" },
      ],
    }
    const result = migrateHonestItemTypes(state)
    expect(result.tasks[0]).toBe(state.tasks[0])
    expect(result.tasks[1]).toBe(state.tasks[1])
    expect(result.tasks[0].description).toBe("Kitchen remodel")
  })

  it("fills missing type: Next Actions → task, inbox → task, else item", () => {
    const result = migrateHonestItemTypes({
      folders,
      tasks: [
        { id: "na", description: "Write intro", lists: ["na-today"] },
        { id: "inbox", description: "Call dentist", stage: "inbox" },
        { id: "rug", description: "big area rug", stage: "list", lists: ["furniture"] },
      ],
    })
    expect(result.tasks.map((t: { id: string; type: string }) => [t.id, t.type])).toEqual([
      ["na", "task"],
      ["inbox", "task"],
      ["rug", "item"],
    ])
    expect(result.tasks[2]).toHaveProperty("description", "big area rug")
  })

  it("never deletes description and is a no-op when every type is already set", () => {
    const state = {
      folders,
      tasks: [{ id: "1", type: "task", description: "Keep me", lists: ["na-today"] }],
    }
    expect(migrateHonestItemTypes(state)).toBe(state)
    expect(state.tasks[0].description).toBe("Keep me")
  })

  it("treats blank type as missing", () => {
    const result = migrateHonestItemTypes({
      folders,
      tasks: [{ id: "1", type: "   ", description: "Rug", stage: "list" }],
    })
    expect(result.tasks[0].type).toBe("item")
    expect(result.tasks[0].description).toBe("Rug")
  })
})
