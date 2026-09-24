import { describe, it, expect } from "vitest"
import {
  taskSchema,
  taskCategorySchema,
  categoryFolderSchema,
  taskStoreSnapshotSchema,
  itemLinkSchema,
  subtaskSchema,
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

  it("accepts molecular subtasks with extra fields", () => {
    expect(
      taskSchema.safeParse({
        ...validTask,
        subtasks: [{ id: "st1", description: "Tiny step", completed: false, isMolecular: true, context: "at desk" }],
      }).success,
    ).toBe(true)
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

describe("itemLinkSchema", () => {
  // `itemLinkSchema` is strict, so an unlisted field is *dropped*, not merely
  // unvalidated. These two carry the belief graph and used to vanish on restore.
  it("keeps stance and weight through a round-trip", () => {
    const link = { id: "l1", relation: "supports", targetId: "t2", stance: "weak-refute", weight: 0.4 }
    expect(itemLinkSchema.parse(link)).toEqual(link)
  })

  it("still accepts a link that has neither", () => {
    const link = { id: "l1", relation: "blocks", targetId: "t2" }
    expect(itemLinkSchema.parse(link)).toEqual(link)
  })

  it("rejects a stance outside the five-level spectrum", () => {
    const link = { id: "l1", relation: "supports", targetId: "t2", stance: "kind-of" }
    expect(itemLinkSchema.safeParse(link).success).toBe(false)
  })
})

describe("subtaskSchema", () => {
  it("keeps the molecular-step fields", () => {
    const sub = { id: "s1", description: "Open the file", completed: false, isMolecular: true, context: "on the desk" }
    expect(subtaskSchema.parse(sub)).toEqual(sub)
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
