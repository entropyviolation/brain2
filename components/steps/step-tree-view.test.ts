import { describe, expect, it } from "vitest"
import type { Subtask } from "@/lib/types"
import { pickStartStep } from "@/lib/next-step"
import { buildStepView, isStepLocked } from "./step-tree-view"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const ids = (steps: Subtask[], opts: Parameters<typeof buildStepView>[1]) =>
  buildStepView(steps, opts).rows.map((r) => (r.kind === "step" ? r.step.id : r.kind === "more" ? `+${r.count}` : `add:${r.parentId ?? "root"}`))

describe("buildStepView", () => {
  it("ends every open branch, and the root, in one + step", () => {
    expect(ids([s("a", { subtasks: [s("a1")] }), s("b")], {})).toEqual(["a", "a1", "add:a", "b", "add:root"])
    expect(ids([s("a", { subtasks: [s("a1")] })], { folded: new Set(["a"]) })).toEqual(["a", "add:root"])
    expect(ids([], {})).toEqual([])
  })

  it("Hide locked drops waiting steps (inherited too) and all-locked branches, never incomplete ones", () => {
    const steps = [
      s("a"),
      s("b", { dependsOn: ["a"], subtasks: [s("b1")] }),
      s("c", { subtasks: [s("c1", { dependsOn: ["a"] })] }),
      s("d", { subtasks: [s("d1")] }),
    ]
    expect(isStepLocked(steps, steps[1].subtasks![0])).toBe(true)
    expect(isStepLocked(steps, steps[3])).toBe(false)
    const view = buildStepView(steps, { hideLocked: true })
    expect(ids(steps, { hideLocked: true })).toEqual(["a", "d", "d1", "add:d", "add:root"])
    expect(view.hidden).toBe(4)
    const peek = buildStepView(steps, { hideLocked: true, peek: true })
    expect(peek.hidden).toBe(0)
    expect(peek.hiddenBySwitches).toBe(4)
    expect(peek.rows.filter((r) => r.kind === "step" && r.peeked).length).toBe(4)
    // The moment the prerequisite is ticked, they are back.
    const ticked = [{ ...steps[0], completed: true }, ...steps.slice(1)]
    expect(buildStepView(ticked, { hideLocked: true }).hidden).toBe(0)
  })

  it("Show next only keeps the Just Start pick of a branch and counts the rest", () => {
    const branch = s("p", {
      subtasks: [s("x", { estimatedDuration: 30 }), s("y", { estimatedDuration: 5 }), s("z", { estimatedDuration: 10 })],
    })
    const pick = pickStartStep({ subtasks: branch.subtasks })
    expect(pick.kind === "step" && pick.step.id).toBe("y")
    expect(ids([branch], { nextOnly: true })).toEqual(["p", "y", "+2", "add:root"])
    expect(buildStepView([branch], { nextOnly: true }).hidden).toBe(2)
    expect(ids([branch], { nextOnly: true, openedNext: new Set(["p"]) })).toEqual(["p", "x", "y", "z", "add:p", "add:root"])
  })
})
