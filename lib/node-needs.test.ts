import { describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import { eventHappened, externalWaits, patchStep, toggleId } from "@/lib/node-needs"
import { tierPointChanges } from "@/lib/step-points"
import { stepPointChanges } from "@/lib/task-card"
import { isStepLocked } from "@/components/steps/step-tree-view"

const leaf = (id: string, completed = false, tier?: Subtask["tier"]) => ({ id, description: id, completed, tier }) as Subtask

describe("node needs", () => {
  it("an awaited event locks until logged or its date passes; missing never blocks", () => {
    const now = new Date("2026-10-20T12:00:00")
    expect(eventHappened({ completed: false }, now)).toBe(false)
    expect(eventHappened({ completed: true }, now)).toBe(true)
    expect(eventHappened({ completed: false, scheduledDate: new Date("2026-10-19") }, now)).toBe(true)
    expect(eventHappened(undefined, now)).toBe(true)
    const items = new Map<string, Pick<Task, "completed">>([["ev", { completed: false }], ["t", { completed: true }]])
    const step = { ...leaf("s"), awaitIds: ["ev"], needsTaskIds: ["t"] }
    expect(externalWaits(step, (id) => items.get(id), now)).toEqual(["ev"])
    const extra = (s: Subtask) => externalWaits(s, (id) => items.get(id), now).length > 0
    expect(isStepLocked([step], step, extra)).toBe(true)
    expect(isStepLocked([step], step)).toBe(false)
  })

  it("patchStep deletes undefined fields; toggleId empties to undefined", () => {
    const tree = [{ ...leaf("a"), points: 3 }]
    expect("points" in patchStep(tree, "a", { points: undefined })[0]).toBe(false)
    expect(toggleId(["x"], "x")).toBeUndefined()
    expect(toggleId(undefined, "x")).toEqual(["x"])
  })

  it("points by level pay per level reached and replace plain points", () => {
    const parent = (kids: Subtask[]): Subtask => ({ id: "p", description: "p", completed: false, subtasks: kids, points: 9, tierPoints: { min: 2, goal: 5 } })
    const before = [parent([leaf("b", false, "min"), leaf("g")])]
    const minDone = [parent([leaf("b", true, "min"), leaf("g")])]
    expect(tierPointChanges(before, minDone).map((c) => [c.tier, c.paid])).toEqual([["min", true]])
    const allDone = [parent([leaf("b", true, "min"), leaf("g", true)])]
    expect(tierPointChanges(minDone, allDone).map((c) => [c.tier, c.paid])).toEqual([["goal", true]])
    expect(tierPointChanges(allDone, before).map((c) => c.paid)).toEqual([false, false])
    const ticked = [{ ...parent([leaf("b", false, "min"), leaf("g")]), completed: true }]
    expect(stepPointChanges(before, ticked)).toEqual([])
  })
})
