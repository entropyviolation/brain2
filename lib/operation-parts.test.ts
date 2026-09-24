/**
 * lib/operation-parts.test.ts — Part formulas, ideas, glance, and the To do union
 */
import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { OP_REL } from "@/lib/operations"
import { PART_TASK_ATTR } from "@/lib/operation-parts"
import {
  collectOperationTodoTasks,
  formulaDescendantIds,
  glanceLabelUniverse,
  glanceMeters,
  readPartFormulas,
  readPartInstances,
  resolveGlanceSelection,
} from "@/lib/operation-parts"

const NOW = new Date("2026-06-23T12:00:00.000Z")

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t",
    description: overrides.description ?? "Task",
    stage: "clarified",
    createdAt: NOW,
    completed: false,
    lists: [],
    ...overrides,
  }
}

describe("part formulas", () => {
  it("parses kinds, drops cycles, and keeps ideas off the task list", () => {
    const formulas = readPartFormulas([
      { id: "issue", name: "Issue", finishSteps: ["ordered", "printed"] },
      { id: "article", name: "Article", parentFormulaId: "issue", stages: ["drafted", "written", "drafted"] },
      { id: "loop", name: "Loop", parentFormulaId: "loop" },
    ])
    expect(formulas.find((formula) => formula.id === "article")?.stages).toEqual(["drafted", "written"])
    expect(formulas.find((formula) => formula.id === "article")?.parentFormulaId).toBe("issue")
    expect(formulas.find((formula) => formula.id === "loop")?.parentFormulaId).toBeNull()
    expect(formulaDescendantIds(formulas, "issue")).toEqual(new Set(["article"]))

    const instances = readPartInstances([
      {
        id: "spring",
        formulaId: "issue",
        title: "Spring",
        ideas: [{ id: "i1", text: "neon cover", createdAt: "2026-01-01" }, { id: "i1", text: "dup" }],
      },
      { id: "cover", formulaId: "article", title: "Cover", parentInstanceId: "spring", ideas: [] },
    ])
    expect(instances[0].ideas.map((idea) => idea.text)).toEqual(["neon cover"])
    expect(instances[1].parentInstanceId).toBe("spring")
  })

  it("tallies chosen stages and a finished meter, and leaves ideas out of To do", () => {
    const formulas = readPartFormulas(
      JSON.stringify([
        { id: "issue", name: "Issue", finishSteps: ["printed"] },
        { id: "article", name: "Article", parentFormulaId: "issue", stages: ["drafted", "written"] },
      ]),
    )
    const instances = readPartInstances([
      { id: "spring", formulaId: "issue", title: "Spring", ideas: [{ id: "idea", text: "neon cover", createdAt: "" }] },
      { id: "cover", formulaId: "article", title: "Cover", parentInstanceId: "spring" },
    ])
    const drafted = task({
      id: "drafted",
      description: "Cover — drafted",
      completed: true,
      lists: ["op-list"],
      attributes: {
        [PART_TASK_ATTR.instanceId]: "cover",
        [PART_TASK_ATTR.role]: "stage",
        [PART_TASK_ATTR.label]: "drafted",
        [PART_TASK_ATTR.operationId]: "op",
      },
    })
    const written = task({
      id: "written",
      description: "Cover — written",
      lists: ["op-list"],
      attributes: {
        [PART_TASK_ATTR.instanceId]: "cover",
        [PART_TASK_ATTR.role]: "stage",
        [PART_TASK_ATTR.label]: "written",
        [PART_TASK_ATTR.operationId]: "op",
      },
    })
    const printed = task({
      id: "printed",
      description: "Spring — printed",
      attributes: {
        [PART_TASK_ATTR.instanceId]: "spring",
        [PART_TASK_ATTR.role]: "finish",
        [PART_TASK_ATTR.label]: "printed",
        [PART_TASK_ATTR.operationId]: "op",
      },
    })
    const phase = task({ id: "phase", description: "Research" })
    const step = task({ id: "step", description: "Call the printer", lists: ["op-list"] })
    const operation = task({
      id: "op",
      type: "operation",
      description: "Fashion magazine",
      links: [
        { id: "l1", relation: OP_REL.hasPhase, targetId: "phase" },
        { id: "l2", relation: OP_REL.hasPart, targetId: "drafted" },
      ],
    })
    const phaseTask = {
      ...phase,
      links: [{ id: "l3", relation: OP_REL.hasPart, targetId: "step" }],
    }
    const all = [operation, phaseTask, step, drafted, written, printed]

    expect(glanceLabelUniverse(formulas)).toEqual(["printed", "drafted", "written", "finished"])
    const meters = glanceMeters(formulas, instances, all, glanceLabelUniverse(formulas))
    expect(meters.find((meter) => meter.label === "drafted")).toEqual({ label: "drafted", done: 1, total: 1 })
    expect(meters.find((meter) => meter.label === "written")).toEqual({ label: "written", done: 0, total: 1 })
    expect(meters.find((meter) => meter.label === "finished")?.done).toBe(0)
    expect(resolveGlanceSelection(["drafted"], glanceLabelUniverse(formulas)).map((label) => label.toLowerCase())).toEqual([
      "drafted",
    ])

    const todo = collectOperationTodoTasks("op", all, "op-list").map((item) => item.description)
    expect(todo).toContain("Call the printer")
    expect(todo).toContain("Cover — drafted")
    expect(todo).toContain("Cover — written")
    expect(todo).not.toContain("neon cover")
    expect(todo).not.toContain("Research")
    expect(todo).not.toContain("Fashion magazine")
  })
})
