import { describe, it, expect } from "vitest"
import {
  makeSubtask,
  addStepsAsSubtasks,
  parseSteps,
  markMolecular,
  toggleMolecular,
  setSubtaskContext,
  toggleSubtaskComplete,
  completeSubtask,
  removeSubtask,
  nextMolecularStep,
  subtaskProgress,
} from "./molecular"
import type { Subtask } from "@/lib/types"

const sub = (overrides: Partial<Subtask>): Subtask => ({
  id: "s1",
  description: "step",
  completed: false,
  ...overrides,
})

describe("makeSubtask", () => {
  it("builds a subtask from a plain string", () => {
    const s = makeSubtask("  Do the thing  ")
    expect(s.description).toBe("Do the thing")
    expect(s.completed).toBe(false)
    expect(s.isMolecular).toBeUndefined()
    expect(s.context).toBeUndefined()
    expect(s.id).toBeTruthy()
  })

  it("carries context and molecular flag from a spec", () => {
    const s = makeSubtask({ description: "atom", context: "needs login", isMolecular: true })
    expect(s.isMolecular).toBe(true)
    expect(s.context).toBe("needs login")
  })

  it("generates unique ids", () => {
    expect(makeSubtask("a").id).not.toBe(makeSubtask("b").id)
  })
})

describe("addStepsAsSubtasks", () => {
  it("appends steps and skips blank descriptions", () => {
    const result = addStepsAsSubtasks([sub({ id: "a" })], ["one", "  ", "two"])
    expect(result.map((s) => s.description)).toEqual(["step", "one", "two"])
    expect(result).toHaveLength(3)
  })

  it("does not mutate the input array", () => {
    const input = [sub({ id: "a" })]
    addStepsAsSubtasks(input, ["x"])
    expect(input).toHaveLength(1)
  })

  it("applies a shared context, letting per-step context win", () => {
    const result = addStepsAsSubtasks(undefined, ["one", { description: "two", context: "own" }], "shared")
    expect(result[0].context).toBe("shared")
    expect(result[1].context).toBe("own")
  })
})

describe("parseSteps", () => {
  it("splits lines and strips list markers", () => {
    const text = "1. First\n- second\n* third\n\n   \n4) fourth"
    expect(parseSteps(text)).toEqual(["First", "second", "third", "fourth"])
  })
})

describe("flag + context mutators", () => {
  const base = [sub({ id: "a" }), sub({ id: "b" })]

  it("markMolecular sets the flag immutably", () => {
    const next = markMolecular(base, "b")
    expect(next.find((s) => s.id === "b")?.isMolecular).toBe(true)
    expect(base.find((s) => s.id === "b")?.isMolecular).toBeUndefined()
  })

  it("toggleMolecular flips the flag", () => {
    const on = toggleMolecular(base, "a")
    expect(on[0].isMolecular).toBe(true)
    expect(toggleMolecular(on, "a")[0].isMolecular).toBe(false)
  })

  it("setSubtaskContext updates or clears context", () => {
    expect(setSubtaskContext(base, "a", "ctx")[0].context).toBe("ctx")
    expect(setSubtaskContext(base, "a", "   ")[0].context).toBeUndefined()
  })

  it("toggleSubtaskComplete / completeSubtask / removeSubtask", () => {
    expect(toggleSubtaskComplete(base, "a")[0].completed).toBe(true)
    expect(completeSubtask(base, "a")[0].completed).toBe(true)
    expect(removeSubtask(base, "a").map((s) => s.id)).toEqual(["b"])
  })
})

describe("nextMolecularStep", () => {
  it("returns undefined when there are no subtasks", () => {
    expect(nextMolecularStep(undefined)).toBeUndefined()
    expect(nextMolecularStep({ subtasks: [] })).toBeUndefined()
  })

  it("returns undefined when all subtasks are complete", () => {
    expect(nextMolecularStep({ subtasks: [sub({ id: "a", completed: true })] })).toBeUndefined()
  })

  it("prefers the first incomplete molecular step", () => {
    const subtasks = [
      sub({ id: "a", completed: true }),
      sub({ id: "b" }),
      sub({ id: "c", isMolecular: true }),
      sub({ id: "d", isMolecular: true }),
    ]
    expect(nextMolecularStep({ subtasks })?.id).toBe("c")
  })

  it("falls back to the first incomplete step when none are molecular", () => {
    const subtasks = [sub({ id: "a", completed: true }), sub({ id: "b" }), sub({ id: "c" })]
    expect(nextMolecularStep({ subtasks })?.id).toBe("b")
  })
})

describe("subtaskProgress", () => {
  it("counts completed and total", () => {
    const subtasks = [sub({ id: "a", completed: true }), sub({ id: "b" })]
    expect(subtaskProgress({ subtasks })).toEqual({ completed: 1, total: 2 })
    expect(subtaskProgress(undefined)).toEqual({ completed: 0, total: 0 })
  })
})
