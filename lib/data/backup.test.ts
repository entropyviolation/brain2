import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  createBackup,
  serializeBackup,
  parseBackup,
  restoreBackup,
  backupSchema,
  BACKUP_VERSION,
  buildCategoryExport,
  exportCategory,
  parseCategoryExport,
  importCategory,
} from "@/lib/data/backup"
import { taskRepository } from "@/lib/data/task-repository"
import { saveStoredPlanText, getStoredPlanText } from "@/lib/plan-text"
import { useTaskStore } from "@/lib/task-store"
import type { Task, List } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

const cat = (overrides: Partial<List> & { id: string }): List => ({
  name: overrides.id,
  color: "#000000",
  createdAt: new Date(),
  ...overrides,
})

describe("backup/restore", () => {
  beforeEach(() => resetAllStores())

  it("captures task-store state and plan text", () => {
    taskRepository.add(task({ id: "a", description: "backed up" }))
    saveStoredPlanText("day", "2026-06-20", "do the thing")

    const backup = createBackup()
    expect(backup.app).toBe("cogs")
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.stores["cogs-task-storage"]).toBeDefined()
    expect(backup.planText["dayPlan-2026-06-20"]).toBe("do the thing")
  })

  it("round-trips a backup through serialize/parse", () => {
    taskRepository.add(task({ id: "a" }))
    const json = serializeBackup()
    const parsed = parseBackup(json)
    expect(backupSchema.safeParse(parsed).success).toBe(true)
  })

  it("restores tasks and plan text after data is wiped", async () => {
    taskRepository.add(task({ id: "a", description: "original" }))
    saveStoredPlanText("week", "2026-W25", "weekly plan")
    const backup = parseBackup(serializeBackup())

    resetAllStores()
    expect(taskRepository.getById("a")).toBeUndefined()
    expect(getStoredPlanText("week", "2026-W25")).toBeNull()

    const result = await restoreBackup(backup)
    expect(result.stores).toBeGreaterThan(0)
    expect(result.planText).toBe(1)

    const restored = useTaskStore.getState().tasks.find((t) => t.id === "a")
    expect(restored?.description).toBe("original")
    // Restore round-trips exactly what the store persists (same as a reload).
    expect(restored?.createdAt).toBeDefined()
    expect(getStoredPlanText("week", "2026-W25")).toBe("weekly plan")
  })

  it("rejects a malformed backup", () => {
    expect(() => parseBackup(JSON.stringify({ nope: true }))).toThrow()
  })

  it("replaces plan text on restore (no stale entries)", async () => {
    const backup = parseBackup(serializeBackup())
    saveStoredPlanText("day", "2026-06-21", "stale entry")
    await restoreBackup(backup)
    expect(getStoredPlanText("day", "2026-06-21")).toBeNull()
  })
})

describe("per-category export/import", () => {
  beforeEach(() => resetAllStores())

  const seedTree = () => {
    const store = useTaskStore.getState()
    store.setLists([
      cat({ id: "parent" }),
      cat({ id: "child", parentListId: "parent" }),
      cat({ id: "other" }),
    ])
    store.setTasks([
      task({ id: "tp", lists: ["parent"] }),
      task({ id: "tc", lists: ["child"] }),
      task({ id: "to", lists: ["other"] }),
    ])
  }

  it("exports a category subtree and its member tasks (not siblings)", () => {
    seedTree()
    const data = buildCategoryExport("parent")!
    expect(data.lists.map((c) => c.id).sort()).toEqual(["child", "parent"])
    expect(data.tasks.map((t) => t.id).sort()).toEqual(["tc", "tp"])
    expect(data.kind).toBe("category")
  })

  it("returns null for an unknown category", () => {
    expect(buildCategoryExport("ghost")).toBeNull()
    expect(exportCategory("ghost")).toBeNull()
  })

  it("round-trips through serialize/parse with revived dates", () => {
    seedTree()
    const json = exportCategory("parent")!
    const parsed = parseCategoryExport(json)
    expect(parsed.lists[0].createdAt).toBeInstanceOf(Date)
    expect(parsed.tasks[0].createdAt).toBeInstanceOf(Date)
  })

  it("imports a subtree into a wiped store (merge)", () => {
    seedTree()
    const json = exportCategory("parent")!
    resetAllStores()
    const result = importCategory(parseCategoryExport(json), "merge")
    expect(result.lists).toBe(2)
    expect(result.tasks).toBe(2)
    const state = useTaskStore.getState()
    expect(state.lists.find((c) => c.id === "child")?.parentListId).toBe("parent")
    expect(state.tasks.find((t) => t.id === "tc")).toBeDefined()
  })

  it("merge leaves existing ids untouched but replace overwrites them", () => {
    seedTree()
    const json = exportCategory("parent")!
    // Mutate the live copy, then re-import the original export.
    const store = useTaskStore.getState()
    store.updateList(cat({ id: "parent", name: "renamed" }))
    importCategory(parseCategoryExport(json), "merge")
    expect(useTaskStore.getState().lists.find((c) => c.id === "parent")?.name).toBe("renamed")
    importCategory(parseCategoryExport(json), "replace")
    expect(useTaskStore.getState().lists.find((c) => c.id === "parent")?.name).toBe("parent")
  })

  it("rejects a malformed category export", () => {
    expect(() => parseCategoryExport(JSON.stringify({ nope: true }))).toThrow()
  })
})
