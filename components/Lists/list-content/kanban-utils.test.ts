import { describe, expect, it } from "vitest"
import type { AttributeDefinition, Task } from "@/lib/types"
import {
  KANBAN_BACKLOG,
  deriveKanbanColumns,
  isKanbanGroupable,
  statusValueOf,
  statusValueToWrite,
} from "./kanban-utils"

function task(id: string, attrs?: Record<string, unknown>): Task {
  return {
    id,
    description: `Task ${id}`,
    completed: false,
    createdAt: new Date(),
    attributes: attrs as Task["attributes"],
  } as Task
}

const statusDef: AttributeDefinition = {
  id: "status",
  name: "Status",
  type: "selection",
  options: ["To Do", "Doing", "Done"],
}

describe("statusValueOf", () => {
  it("reads a plain string value", () => {
    expect(statusValueOf(task("1", { status: "Doing" }), statusDef)).toBe("Doing")
  })

  it("returns empty string when unset", () => {
    expect(statusValueOf(task("1"), statusDef)).toBe("")
    expect(statusValueOf(task("2", { status: null }), statusDef)).toBe("")
  })

  it("uses the first element of array values", () => {
    expect(statusValueOf(task("1", { status: ["Done", "Doing"] }), statusDef)).toBe("Done")
    expect(statusValueOf(task("2", { status: [] }), statusDef)).toBe("")
  })
})

describe("deriveKanbanColumns", () => {
  it("returns [] without a definition", () => {
    expect(deriveKanbanColumns([task("1")], undefined)).toEqual([])
  })

  it("keeps manual option order and shows empty columns", () => {
    const cols = deriveKanbanColumns([task("1", { status: "Doing" })], statusDef)
    expect(cols.map((c) => c.key)).toEqual(["To Do", "Doing", "Done"])
    expect(cols.find((c) => c.key === "Doing")?.taskIds).toEqual(["1"])
    expect(cols.find((c) => c.key === "To Do")?.taskIds).toEqual([])
  })

  it("appends a backlog column when items are unset", () => {
    const cols = deriveKanbanColumns([task("1"), task("2", { status: "Done" })], statusDef)
    const backlog = cols[cols.length - 1]
    expect(backlog.key).toBe(KANBAN_BACKLOG)
    expect(backlog.label).toBe("No Status")
    expect(backlog.taskIds).toEqual(["1"])
  })

  it("adds ad-hoc values not present in the manual options", () => {
    const cols = deriveKanbanColumns([task("1", { status: "Blocked" })], statusDef)
    expect(cols.map((c) => c.key)).toContain("Blocked")
  })

  it("groups by distinct values when there are no manual options", () => {
    const freeDef: AttributeDefinition = { id: "stage", name: "Stage", type: "string" }
    const cols = deriveKanbanColumns(
      [task("1", { stage: "A" }), task("2", { stage: "B" }), task("3", { stage: "A" })],
      freeDef,
    )
    expect(cols.map((c) => c.key)).toEqual(["A", "B"])
    expect(cols.find((c) => c.key === "A")?.taskIds).toEqual(["1", "3"])
  })
})

describe("statusValueToWrite", () => {
  it("writes the column key for single-value attributes", () => {
    expect(statusValueToWrite(statusDef, "Done")).toBe("Done")
  })

  it("clears the value for the backlog column", () => {
    expect(statusValueToWrite(statusDef, KANBAN_BACKLOG)).toBeUndefined()
  })

  it("wraps multi-valued attributes in an array", () => {
    const multi: AttributeDefinition = { ...statusDef, allowMultiple: true }
    expect(statusValueToWrite(multi, "Doing")).toEqual(["Doing"])
  })
})

describe("isKanbanGroupable", () => {
  it("accepts selection-like and textual attributes", () => {
    expect(isKanbanGroupable(statusDef)).toBe(true)
    expect(isKanbanGroupable({ id: "n", name: "N", type: "string" })).toBe(true)
    expect(isKanbanGroupable({ id: "b", name: "B", type: "boolean" })).toBe(true)
  })

  it("rejects numeric/date attributes", () => {
    expect(isKanbanGroupable({ id: "n", name: "N", type: "number" })).toBe(false)
    expect(isKanbanGroupable({ id: "d", name: "D", type: "datetime" })).toBe(false)
  })
})
