import { describe, it, expect } from "vitest"
import {
  taskSchema,
  taskCategorySchema,
  categoryFolderSchema,
  taskStoreSnapshotSchema,
  parseOrThrow,
  ValidationError,
} from "@/lib/data/schemas"

const validTask = {
  id: "t1",
  description: "Do thing",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
}

describe("taskSchema", () => {
  it("accepts a minimal valid task", () => {
    expect(taskSchema.safeParse(validTask).success).toBe(true)
  })

  it("coerces ISO string dates to Date", () => {
    const parsed = taskSchema.parse({ ...validTask, createdAt: "2026-06-20T12:00:00.000Z" })
    expect(parsed.createdAt).toBeInstanceOf(Date)
  })

  it("rejects an invalid stage bucket", () => {
    expect(taskSchema.safeParse({ ...validTask, stage: "bogus" }).success).toBe(false)
  })

  it("rejects a task with no id", () => {
    expect(taskSchema.safeParse({ ...validTask, id: "" }).success).toBe(false)
  })

  it("validates tags and links shapes", () => {
    expect(
      taskSchema.safeParse({
        ...validTask,
        tags: ["to schedule"],
        links: [{ id: "l1", relation: "blocks", targetId: "t2" }],
      }).success,
    ).toBe(true)
    expect(taskSchema.safeParse({ ...validTask, links: [{ id: "l1" }] }).success).toBe(false)
  })

  it("preserves unknown legacy fields via passthrough", () => {
    const parsed = taskSchema.parse({ ...validTask, legacyField: 42 }) as Record<string, unknown>
    expect(parsed.legacyField).toBe(42)
  })
})

describe("taskCategorySchema / categoryFolderSchema", () => {
  it("validates a category", () => {
    expect(
      taskCategorySchema.safeParse({ id: "c1", name: "List", color: "#fff", createdAt: new Date() }).success,
    ).toBe(true)
  })

  it("requires folder listIds to be an array", () => {
    expect(
      categoryFolderSchema.safeParse({ id: "f1", name: "F", createdAt: new Date(), listIds: "no" }).success,
    ).toBe(false)
  })
})

describe("taskStoreSnapshotSchema", () => {
  it("validates a whole snapshot", () => {
    const snap = { tasks: [validTask], lists: [], folders: [] }
    expect(taskStoreSnapshotSchema.safeParse(snap).success).toBe(true)
  })
})

describe("parseOrThrow", () => {
  it("returns parsed data on success", () => {
    expect(parseOrThrow(taskSchema, validTask, "task").id).toBe("t1")
  })

  it("throws a ValidationError with issues on failure", () => {
    try {
      parseOrThrow(taskSchema, { ...validTask, stage: "x" }, "task")
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      expect((e as ValidationError).issues.length).toBeGreaterThan(0)
    }
  })
})
