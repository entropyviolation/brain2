import { describe, expect, it } from "vitest"
import { hasUnmetDependencies, isAvailableNow } from "./available-tasks"

const tasks = [
  { id: "open", completed: false },
  { id: "done", completed: true },
  { id: "blocked", completed: false },
]

describe("hasUnmetDependencies / isAvailableNow", () => {
  it("treats no dependencies as available", () => {
    expect(hasUnmetDependencies({ dependencies: [] }, tasks)).toBe(false)
    expect(isAvailableNow({ dependencies: undefined }, tasks)).toBe(true)
  })

  it("blocks when a listed dep exists and is incomplete", () => {
    expect(hasUnmetDependencies({ dependencies: ["open"] }, tasks)).toBe(true)
    expect(isAvailableNow({ dependencies: ["open"] }, tasks)).toBe(false)
  })

  it("does not block on missed-opportunity deps", () => {
    const withMissed = [...tasks, { id: "late", completed: false, status: "missed" as const }]
    expect(hasUnmetDependencies({ dependencies: ["late"] }, withMissed)).toBe(false)
    expect(isAvailableNow({ dependencies: ["late"] }, withMissed)).toBe(true)
  })

  it("does not block on missing (ghost) ids", () => {
    expect(hasUnmetDependencies({ dependencies: ["ghost"] }, tasks)).toBe(false)
  })
})
