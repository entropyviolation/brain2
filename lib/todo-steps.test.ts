import { describe, expect, it } from "vitest"
import {
  addNestedStep,
  effectiveDurationMinutes,
  formatInternalProgress,
  removeNestedStep,
  taskMatchesAssignedQuery,
  todoCompletionPercent,
  updateNestedStep,
} from "./todo-steps"

describe("todo steps", () => {
  it("uses whichever is larger, the typed estimate or the steps inside", () => {
    const steps = addNestedStep(undefined, null, { description: "Draft", estimatedDuration: 20 })
    const withChild = addNestedStep(steps, steps[0]!.id, { description: "Outline", estimatedDuration: 50 })
    expect(withChild[0]?.subtasks).toHaveLength(1)
    expect(effectiveDurationMinutes(10, withChild)).toBe(50)
    expect(effectiveDurationMinutes(90, withChild)).toBe(90)
    expect(effectiveDurationMinutes(undefined, withChild)).toBe(50)
  })

  it("reports progress from every nested step and leaves siblings independent", () => {
    let steps = addNestedStep(undefined, null, { description: "Write" })
    const write = steps[0]!.id
    steps = addNestedStep(steps, write, { description: "Open" })
    steps = addNestedStep(steps, write, { description: "Save" })
    const open = steps[0]!.subtasks![0]!.id
    steps = updateNestedStep(steps, open, { completed: true })
    expect(formatInternalProgress(steps)).toBe("1/3 · 33%")
    expect(steps[0]!.completed).toBe(false)
    expect(steps[0]!.subtasks![1]!.completed).toBe(false)
    steps = removeNestedStep(steps, open)
    expect(steps[0]!.subtasks).toHaveLength(1)
  })

  it("is 0% when nothing is finished, not 6% of an 8-hour day", () => {
    expect(todoCompletionPercent(undefined)).toBe(0)
    expect(todoCompletionPercent([])).toBe(0)
    const steps = addNestedStep(undefined, null, { description: "Finish CDs", estimatedDuration: 30 })
    expect(todoCompletionPercent(steps)).toBe(0)
    expect(formatInternalProgress(steps)).toBe("0/1 · 0%")
    // The closed-row meter used to pass round(minutes / 480 * 100) into a % readout.
    expect(Math.round((30 / 480) * 100)).toBe(6)
    expect(todoCompletionPercent(steps)).not.toBe(6)
  })

  it("matches a task by its name or a step buried inside it", () => {
    const steps = addNestedStep(
      addNestedStep(undefined, null, { description: "Pack" }),
      null,
      { description: "Leave" },
    )
    const packed = addNestedStep(steps, steps[0]!.id, { description: "Passport" })
    expect(taskMatchesAssignedQuery("Trip", packed, "pass")).toBe(true)
    expect(taskMatchesAssignedQuery("Trip", packed, "zzz")).toBe(false)
    expect(taskMatchesAssignedQuery("Trip", packed, "  ")).toBe(true)
  })
})