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

  it("blocks exactly as before when dependencyCombine is absent", () => {
    expect(hasUnmetDependencies({ dependencies: ["open"] }, tasks)).toBe(true)
    expect(isAvailableNow({ dependencies: ["open"] }, tasks)).toBe(false)
    expect(hasUnmetDependencies({ dependencies: ["done"] }, tasks)).toBe(false)
    expect(hasUnmetDependencies({ dependencies: ["ghost"] }, tasks)).toBe(false)
    const withMissed = [...tasks, { id: "late", completed: false, status: "missed" as const }]
    expect(hasUnmetDependencies({ dependencies: ["late"] }, withMissed)).toBe(false)
    const weighted = tasks.map((task) =>
      task.id === "done"
        ? { ...task, links: [{ id: "l", relation: "part-of", targetId: "goal", weight: 1 }] }
        : task,
    )
    expect(hasUnmetDependencies({ dependencies: ["done", "open"] }, weighted)).toBe(true)
    expect(isAvailableNow({ dependencies: ["done", "open"] }, weighted)).toBe(false)
  })

  it("asks the combine module only when dependencyCombine is set", () => {
    expect(
      hasUnmetDependencies({ dependencies: ["done", "open"], dependencyCombine: { mode: "redundant" } }, tasks),
    ).toBe(false)
    expect(
      isAvailableNow({ dependencies: ["done", "open"], dependencyCombine: { mode: "redundant" } }, tasks),
    ).toBe(true)
    expect(
      hasUnmetDependencies(
        { dependencies: ["done", "open"], dependencyCombine: { mode: "threshold", need: 2 } },
        tasks,
      ),
    ).toBe(true)
  })
})
