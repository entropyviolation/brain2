import { describe, expect, it } from "vitest"
import { lastUsedFromEntries, orderPens, orderedChildren, type SortablePen } from "./pen-sort"

const pens: SortablePen[] = [
  { id: "work", name: "Work", color: "#00f", lastUsedAt: 10 },
  { id: "rest", name: "Rest", color: "#0f0", lastUsedAt: 30 },
  { id: "chores", name: "Chores", color: "#f00" },
  { id: "trash", name: "Trash", color: "#888", parentId: "chores", lastUsedAt: 20 },
]

describe("pen sort", () => {
  it("lists recently used first and unused last", () => {
    expect(orderPens(pens, "recent").map((p) => p.id)).toEqual(["rest", "trash", "work", "chores"])
  })

  it("lists A–Z by name", () => {
    expect(orderPens(pens, "name").map((p) => p.name)).toEqual(["Chores", "Rest", "Trash", "Work"])
  })

  it("keeps tree children in insertion order", () => {
    expect(orderedChildren(pens, "chores", "tree").map((p) => p.id)).toEqual(["trash"])
    expect(orderedChildren(pens, null, "tree").map((p) => p.id)).toEqual(["work", "rest", "chores"])
  })

  it("stamps last-used from painted intervals", () => {
    const latest = lastUsedFromEntries([
      { penId: "work", date: "2026-09-18", startMin: 600 },
      { penId: "work", date: "2026-09-19", startMin: 60 },
      { penId: "rest", date: "2026-09-19", startMin: 0 },
    ])
    expect(latest.work).toBeGreaterThan(latest.rest)
  })
})
