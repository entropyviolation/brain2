import { describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import {
  addTaskPrereq,
  isStepAvailable,
  openTaskBlockers,
  removeTaskPrereq,
  stepBlockers,
  stepPrereqChoices,
  toggleStepPrereq,
} from "./prereqs"

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}
function t(id: string, extra: Partial<Task> = {}): Task {
  return { id, description: id, stage: "scheduled", createdAt: new Date(), completed: false, lists: [], ...extra }
}

const tree = () => [
  s("overall", { subtasks: [s("get better wood"), s("harvest wood")] }),
  s("inside holder", { subtasks: [s("confirm wood"), s("confirm hidden message")] }),
  s("done thing", { completed: true }),
]

describe("step prerequisites", () => {
  it("toggles a prerequisite on and off", () => {
    let steps = toggleStepPrereq(tree(), "confirm wood", "get better wood")
    expect(stepBlockers(steps, "confirm wood").map((b) => b.id)).toEqual(["get better wood"])
    expect(isStepAvailable(steps, "confirm wood")).toBe(false)
    steps = toggleStepPrereq(steps, "confirm wood", "get better wood")
    expect(isStepAvailable(steps, "confirm wood")).toBe(true)
  })

  it("an ancestor's prerequisite blocks its children", () => {
    const steps = toggleStepPrereq(tree(), "inside holder", "harvest wood")
    expect(stepBlockers(steps, "confirm hidden message").map((b) => b.id)).toEqual(["harvest wood"])
  })

  it("refuses loops, family and done steps", () => {
    let steps = toggleStepPrereq(tree(), "confirm wood", "get better wood")
    const before = JSON.stringify(steps)
    steps = toggleStepPrereq(steps, "get better wood", "confirm wood")
    expect(JSON.stringify(steps)).toBe(before)
    const choices = stepPrereqChoices(steps, "confirm wood")
    expect(choices.has("inside holder")).toBe(false)
    expect(choices.has("done thing")).toBe(false)
    expect(choices.has("harvest wood")).toBe(true)
  })
})

describe("task prerequisites", () => {
  it("adds, refuses a loop, removes, and lists open blockers", () => {
    const a = t("a")
    const b = t("b", { dependencies: ["a"] })
    const added = addTaskPrereq(a, "c", [a, b, t("c")])
    expect(added).toEqual({ ok: true, dependencies: ["c"] })
    const loop = addTaskPrereq(a, "b", [a, b])
    expect(loop.ok).toBe(false)
    expect(removeTaskPrereq(b, "a")).toEqual([])
    expect(openTaskBlockers(b, [a, b]).map((x) => x.id)).toEqual(["a"])
    expect(openTaskBlockers(b, [{ ...a, completed: true, status: "done" }, b])).toEqual([])
  })
})
