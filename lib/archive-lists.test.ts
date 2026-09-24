import { describe, expect, it } from "vitest"
import {
  joinArchiveListMembership,
  resolveArchiveListId,
  tasksForArchiveList,
  withArchiveListMembership,
} from "@/lib/archive-lists"
import { NA_SMART_COMPLETED, NA_SMART_MISSED } from "@/lib/scheduled-lists-sync"
import type { Folder, List, Task } from "@/lib/types"

const na: Folder = {
  id: "folder-next-actions",
  name: "Next Actions",
  createdAt: new Date(),
  listIds: [NA_SMART_COMPLETED, NA_SMART_MISSED],
}

const lists: List[] = [
  { id: NA_SMART_COMPLETED, name: "Completed", color: "#059669", createdAt: new Date(), autoArchive: "completed" },
  { id: NA_SMART_MISSED, name: "Missed Opportunities", color: "#b45309", createdAt: new Date(), autoArchive: "missed" },
]

const task = (overrides: Partial<Task> & Pick<Task, "id">): Task => ({
  description: overrides.id,
  stage: "scheduled",
  completed: false,
  lists: [],
  createdAt: new Date(),
  ...overrides,
})

describe("archive list membership", () => {
  it("joins Completed when a task becomes done, unless excluded", () => {
    const open = task({ id: "a" })
    const done = task({ id: "a", completed: true, status: "done" })
    const next = withArchiveListMembership(done, open, lists, [na])
    expect(next.lists).toContain(NA_SMART_COMPLETED)
    const excluded = task({ id: "a", completed: true, status: "done", listMembershipExclusions: [NA_SMART_COMPLETED] })
    expect(withArchiveListMembership(excluded, open, lists, [na]).lists).not.toContain(NA_SMART_COMPLETED)
  })

  it("drops Completed when reopened, and does not record a new exclusion", () => {
    const done = task({ id: "a", completed: true, status: "done", lists: [NA_SMART_COMPLETED] })
    const open = task({ id: "a", completed: false, status: "active", lists: [NA_SMART_COMPLETED] })
    const next = withArchiveListMembership(open, done, lists, [na])
    expect(next.lists).not.toContain(NA_SMART_COMPLETED)
    expect(next.listMembershipExclusions).toBeUndefined()
  })

  it("joins Missed Opportunities when marked missed", () => {
    const open = task({ id: "a" })
    const late = task({ id: "a", status: "missed", missedAt: new Date() })
    const next = withArchiveListMembership(late, open, lists, [na])
    expect(next.lists).toContain(NA_SMART_MISSED)
    expect(next.lists).not.toContain(NA_SMART_COMPLETED)
  })

  it("sweep joins existing done/missed rows and leaves hand-added incomplete items", () => {
    const done = task({ id: "done", completed: true, status: "done" })
    const late = task({ id: "late", status: "missed" })
    const hand = task({ id: "hand", lists: [NA_SMART_COMPLETED] })
    const next = joinArchiveListMembership([done, late, hand], lists, [na])
    expect(next.find((t) => t.id === "done")?.lists).toContain(NA_SMART_COMPLETED)
    expect(next.find((t) => t.id === "late")?.lists).toContain(NA_SMART_MISSED)
    expect(next.find((t) => t.id === "hand")?.lists).toEqual([NA_SMART_COMPLETED])
  })

  it("opens archive lists by membership, not a status filter", () => {
    const done = task({ id: "done", completed: true, lists: [NA_SMART_COMPLETED] })
    const ghost = task({ id: "ghost", completed: true, lists: [] })
    const hand = task({ id: "hand", lists: [NA_SMART_COMPLETED] })
    expect(tasksForArchiveList([done, ghost, hand], NA_SMART_COMPLETED).map((t) => t.id).sort()).toEqual(["done", "hand"])
  })

  it("reuses a same-named list already in Next Actions", () => {
    const custom: List = { id: "my-done", name: "Completed", color: "#111", createdAt: new Date() }
    const folder: Folder = { ...na, listIds: ["my-done"] }
    expect(resolveArchiveListId([custom], [folder], "completed")).toBe("my-done")
  })
})
