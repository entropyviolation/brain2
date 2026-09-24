import { beforeEach, describe, expect, it } from "vitest"
import {
  appendItemActivity,
  diffItemActivity,
  listItemActivity,
  MAX_ACTIVITY_PER_ITEM,
  recordItemWrite,
  resetItemActivity,
} from "@/lib/item-activity"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> & Pick<Task, "id" | "description">): Task {
  return {
    stage: "list",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("item-activity ledger", () => {
  beforeEach(() => {
    resetItemActivity()
  })

  it("diffs name, schedule, duration, and completion", () => {
    const before = task({
      id: "a",
      description: "Draft",
      estimatedDuration: 30,
      scheduledDate: new Date("2026-09-21"),
    })
    const after = task({
      id: "a",
      description: "Ship",
      estimatedDuration: 45,
      scheduledDate: new Date("2026-09-22"),
      completed: true,
      actualDuration: 50,
    })
    const changes = diffItemActivity(before, after)
    const fields = changes.map((c) => c.field)
    expect(fields).toContain("title")
    expect(fields).toContain("estimatedDuration")
    expect(fields).toContain("scheduledDate")
    expect(fields).toContain("completed")
    expect(fields).toContain("actualDuration")
  })

  it("does not emit a row when nothing watched changed", () => {
    const t = task({ id: "a", description: "Same" })
    expect(recordItemWrite(t, { ...t, notes: "private scribble" })).toBeNull()
    expect(listItemActivity("a")).toEqual([])
  })

  it("appends newest-first and never rewrites older rows", () => {
    const before = task({ id: "a", description: "One", estimatedDuration: 10 })
    const mid = task({ id: "a", description: "Two", estimatedDuration: 10 })
    const after = task({ id: "a", description: "Three", estimatedDuration: 20 })
    recordItemWrite(before, mid, undefined, new Date("2026-09-21T10:00:00.000Z"))
    recordItemWrite(mid, after, undefined, new Date("2026-09-21T11:00:00.000Z"))
    const rows = listItemActivity("a")
    expect(rows).toHaveLength(2)
    expect(rows[0].changes.some((c) => c.to === "Three" || c.to === "20")).toBe(true)
    expect(rows[1].changes).toEqual([
      expect.objectContaining({ field: "title", from: "One", to: "Two" }),
    ])
    expect(rows[1].id).not.toBe(rows[0].id)
  })

  it("labels dependencies with item titles when a lookup is provided", () => {
    const a = task({ id: "a", description: "Write", dependencies: [] })
    const b = task({ id: "b", description: "Review" })
    const changes = diffItemActivity(a, { ...a, dependencies: ["b"] }, { tasks: [a, b] })
    expect(changes).toEqual([
      expect.objectContaining({ field: "dependencies", from: "(none)", to: "Review" }),
    ])
  })

  it("drops the oldest entries once the per-item cap is hit", () => {
    for (let i = 0; i < MAX_ACTIVITY_PER_ITEM + 3; i++) {
      appendItemActivity({
        itemId: "a",
        at: new Date(2026, 0, 1, 0, i).toISOString(),
        summary: `row ${i}`,
        changes: [{ field: "title", label: "Name", from: String(i), to: String(i + 1) }],
      })
    }
    const rows = listItemActivity("a")
    expect(rows).toHaveLength(MAX_ACTIVITY_PER_ITEM)
    expect(rows[rows.length - 1].summary).toBe("row 3")
  })
})
