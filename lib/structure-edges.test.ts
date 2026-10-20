import { describe, expect, it } from "vitest"
import { parseNodeId, structureEdges, stepNodeId } from "@/lib/structure-edges"
import type { Task } from "@/lib/types"

const t = (o: Partial<Task> & { id: string }) => ({ type: "task", title: o.id, description: o.id, completed: false, ...o }) as Task

const known = { listIds: new Set(["L"]), penIds: new Set(["pen1"]) }

describe("structureEdges", () => {
  it("links a task to its steps, pens and lists", () => {
    const parent = t({
      id: "p",
      lists: ["L"],
      penLinks: [{ scopeId: "s", penId: "pen1" }],
      subtasks: [{ id: "a", description: "A", completed: false }],
    })
    const keys = structureEdges(parent, [parent], known).map((e) => `${e.otherId}:${e.relation}`)
    expect(keys).toEqual([`${stepNodeId("p", "a")}:has-part`, "pen:pen1:related", "list:L:part-of"])
  })

  it("links a step item up to its task and inherits the task's pen", () => {
    const parent = t({
      id: "p",
      penLinks: [{ scopeId: "s", penId: "pen1" }],
      subtasks: [{ id: "a", description: "A", completed: false, subtasks: [{ id: "b", description: "B", completed: false }] }],
    })
    const item = t({ id: "i", stepOf: { taskId: "p", stepId: "a" }, parentTaskId: "p" })
    const edges = structureEdges(item, [parent, item], known)
    expect(edges.map((e) => e.otherId)).toEqual(["p", stepNodeId("p", "b"), "pen:pen1"])
    expect(edges[0].relation).toBe("part-of")
  })

  it("parses virtual node ids", () => {
    expect(parseNodeId("pen:x")).toEqual({ kind: "pen", penId: "x" })
    expect(parseNodeId("step:p:a")).toEqual({ kind: "step", taskId: "p", stepId: "a" })
    expect(parseNodeId("real-id")).toBeNull()
  })
})
