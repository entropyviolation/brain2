import { describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import {
  blockerCandidates,
  finishStep,
  pickStartStep,
  setStepDependsOn,
  splitStep,
  startProgress,
  stepPath,
} from "./next-step"

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

// Finish CDs, as on the To Do lid: Chaos › insert › disc, plus Entropy and a loose step.
function cds(): Subtask[] {
  return [
    s("chaos", {
      subtasks: [
        s("insert", {
          subtasks: [s("disc", { completed: true }), s("reformat insert", { estimatedDuration: 30 })],
        }),
        s("back", {
          subtasks: [
            s("remove extra text", { estimatedDuration: 10 }),
            s("save and export", { estimatedDuration: 5 }),
            s("add spines"),
          ],
        }),
      ],
    }),
    s("entropy", { subtasks: [s("get better wood", { estimatedDuration: 20 })] }),
    s("look at new templates", { estimatedDuration: 10 }),
  ]
}

describe("pickStartStep", () => {
  it("picks the lowest-level step with the lowest estimate, at any depth", () => {
    const pick = pickStartStep({ subtasks: cds() })
    expect(pick.kind).toBe("step")
    if (pick.kind !== "step") return
    expect(pick.step.id).toBe("save and export")
    expect(pick.path.map((p) => p.id)).toEqual(["chaos", "back"])
    expect(pick.minutes).toBe(5)
    expect(pick.ready).toBe(5)
  })

  it("never picks a parent that still has open children, or a step without an estimate", () => {
    const pick = pickStartStep({ subtasks: [s("parent", { estimatedDuration: 1, subtasks: [s("kid")] })] })
    expect(pick.kind).toBe("needs-estimates")
    if (pick.kind !== "needs-estimates") return
    expect(pick.leaves.map((l) => l.step.id)).toEqual(["kid"])
  })

  it("skips a step whose prerequisite is open, including an ancestor's prerequisite", () => {
    let steps = setStepDependsOn(cds(), "save and export", ["remove extra text"])
    let pick = pickStartStep({ subtasks: steps })
    expect(pick.kind === "step" && pick.step.id).not.toBe("save and export")
    steps = setStepDependsOn(steps, "back", ["get better wood"])
    pick = pickStartStep({ subtasks: steps })
    expect(pick.kind === "step" && pick.step.id).toBe("look at new templates")
  })

  it("breaks ties with isMolecular, then tree order", () => {
    const tie = [s("a", { estimatedDuration: 5 }), s("b", { estimatedDuration: 5, isMolecular: true })]
    const pick = pickStartStep({ subtasks: tie })
    expect(pick.kind === "step" && pick.step.id).toBe("b")
  })

  it("honours skip, and wraps once everything ready has been skipped", () => {
    const steps = [s("a", { estimatedDuration: 5 }), s("b", { estimatedDuration: 10 })]
    expect(pickStartStep({ subtasks: steps }, { skip: ["a"] }).kind === "step" &&
      (pickStartStep({ subtasks: steps }, { skip: ["a"] }) as { step: Subtask }).step.id).toBe("b")
    const wrapped = pickStartStep({ subtasks: steps }, { skip: ["a", "b"] })
    expect(wrapped.kind === "step" && wrapped.step.id).toBe("a")
  })

  it("names every reason when nothing is ready", () => {
    expect(pickStartStep({ subtasks: [] }).kind).toBe("no-steps")
    expect(pickStartStep({ subtasks: [s("a", { completed: true })] }).kind).toBe("all-done")
    const looped = setStepDependsOn([s("a", { estimatedDuration: 5 }), s("b")], "a", ["b"])
    const both = setStepDependsOn(looped, "b", ["a"])
    const pick = pickStartStep({ subtasks: both })
    expect(pick.kind).toBe("blocked")
  })

  it("waits on the task's own open prerequisites unless told not to", () => {
    const task: Pick<Task, "subtasks" | "dependencies"> = { subtasks: cds(), dependencies: ["other"] }
    const allTasks = [{ id: "other", completed: false }]
    const pick = pickStartStep(task, { allTasks })
    expect(pick).toEqual({ kind: "task-blocked", blockerIds: ["other"] })
    expect(pickStartStep(task, { allTasks, ignoreTaskDependencies: true }).kind).toBe("step")
    expect(pickStartStep(task, { allTasks: [{ id: "other", completed: true }] }).kind).toBe("step")
  })
})

describe("step tree helpers", () => {
  it("finishStep records the actual and closes a finished branch", () => {
    const now = new Date("2026-10-15T20:00:00")
    const steps = finishStep(cds(), "reformat insert", 42, now)
    const insert = steps[0].subtasks![0]
    expect(insert.subtasks![1]).toMatchObject({ completed: true, actualDuration: 42, completedAt: now })
    expect(insert.completed).toBe(true)
    expect(steps[0].completed).toBe(false)
  })

  it("blockerCandidates leaves out self, family, done steps, and loops", () => {
    const steps = setStepDependsOn(cds(), "remove extra text", ["save and export"])
    const ids = blockerCandidates(steps, "save and export").map((p) => p.step.id)
    expect(ids).not.toContain("save and export")
    expect(ids).not.toContain("back")
    expect(ids).not.toContain("chaos")
    expect(ids).not.toContain("disc")
    expect(ids).not.toContain("remove extra text")
    expect(ids).toContain("get better wood")
  })

  it("splitStep nests the parts and the picker then takes the smallest part", () => {
    const steps = splitStep(cds(), "reformat insert", [
      { description: "move to new template", estimatedDuration: 3 },
      { description: " ", estimatedDuration: 1 },
    ])
    const pick = pickStartStep({ subtasks: steps })
    expect(pick.kind === "step" && pick.step.description).toBe("move to new template")
    expect(stepPath(steps, pick.kind === "step" ? pick.step.id : "")?.map((p) => p.id)).toEqual([
      "chaos",
      "insert",
      "reformat insert",
    ])
  })

  it("startProgress counts lowest-level steps only", () => {
    expect(startProgress(cds())).toEqual({ done: 1, total: 7, minutesLeft: 75, minutesTotal: 75 })
  })
})
