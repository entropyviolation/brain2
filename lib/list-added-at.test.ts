import { beforeEach, describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { listAddedAt, stampListAddedAt } from "./list-added-at"

const NOW = new Date("2026-10-12T12:00:00.000Z")

describe("stampListAddedAt", () => {
  it("stamps lists gained, drops lists left, and returns the same object when nothing moves", () => {
    const prev: { lists: string[]; listAddedAt?: Record<string, string> } = { lists: ["a"] }
    const next = stampListAddedAt(prev, { lists: ["a", "b"] } as typeof prev, NOW)
    expect(next.listAddedAt).toEqual({ b: NOW.toISOString() })

    const left = stampListAddedAt(next, { lists: ["a"], listAddedAt: next.listAddedAt }, NOW)
    expect(left.listAddedAt).toBeUndefined()

    const same = { lists: ["a", "b"], listAddedAt: next.listAddedAt }
    expect(stampListAddedAt(next, same, NOW)).toBe(same)
  })

  it("keeps a join instant the incoming record already carries", () => {
    const out = stampListAddedAt({ lists: [] }, { lists: ["a"], listAddedAt: { a: "2026-01-01T00:00:00.000Z" } }, NOW)
    expect(out.listAddedAt).toEqual({ a: "2026-01-01T00:00:00.000Z" })
  })
})

describe("listAddedAt", () => {
  it("falls back to createdAt", () => {
    const created = new Date("2026-02-02")
    expect(listAddedAt({ createdAt: created, lists: ["a"] }, "a")).toBe(created.getTime())
    expect(listAddedAt({ createdAt: created, lists: ["a"], listAddedAt: { a: NOW.toISOString() } }, "a")).toBe(NOW.getTime())
  })
})

describe("task store stamps list joins", () => {
  beforeEach(() => useTaskStore.getState().clearAllData())

  it("updateTask stamps a newly added list", () => {
    const base = {
      id: "t1",
      description: "Dune",
      lists: ["a"],
      stage: "list",
      completed: false,
      createdAt: new Date("2026-01-01"),
    } as Task
    useTaskStore.getState().addTask(base)
    expect(useTaskStore.getState().tasks[0].listAddedAt).toBeUndefined()
    useTaskStore.getState().updateTask({ ...useTaskStore.getState().tasks[0], lists: ["a", "b"] })
    const stamped = useTaskStore.getState().tasks[0].listAddedAt
    expect(Object.keys(stamped ?? {})).toEqual(["b"])
  })
})
