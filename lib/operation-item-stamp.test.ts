import { describe, expect, it } from "vitest"
import { stampUntypedOperations } from "@/lib/operation-item-stamp"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  const description = partial.description ?? partial.id
  const type = Object.prototype.hasOwnProperty.call(partial, "type") ? partial.type : "item"
  return {
    id: partial.id,
    title: partial.title ?? description,
    description,
    type,
    stage: partial.stage ?? "clarified",
    createdAt: partial.createdAt ?? new Date("2026-01-01"),
    completed: partial.completed ?? false,
    lists: partial.lists ?? [],
    tags: partial.tags ?? [],
    links: partial.links ?? [],
    subtasks: partial.subtasks ?? [],
    rewardValue: partial.rewardValue ?? 0,
    ...(type === "task"
      ? {
          estimatedDuration: partial.estimatedDuration ?? 30,
          cognitiveLoad: partial.cognitiveLoad ?? 2,
          urgency: partial.urgency ?? 3,
          importance: partial.importance ?? 3,
          context: partial.context ?? "",
          entropy: partial.entropy ?? 0,
          allowPartialCompletion: partial.allowPartialCompletion ?? false,
          minimumChunkSize: partial.minimumChunkSize ?? 15,
        }
      : {}),
    ...partial,
  }
}

describe("stampUntypedOperations", () => {
  it("types a record that already carries operation panels, once", () => {
    const rows = [
      task({ id: "a", type: "item", attributes: { [OPERATION_ATTR.panels]: ["home", "tasks"] } }),
      task({ id: "b", type: OPERATION_TYPE_ID }),
      task({ id: "c", type: COMPUTER_PROJECT_TYPE_ID, attributes: { [OPERATION_ATTR.panels]: ["home"] } }),
      task({ id: "d", type: "book", attributes: { [OPERATION_ATTR.panels]: ["home"] } }),
    ]
    const once = stampUntypedOperations(rows)
    expect(once.find((row) => row.id === "a")?.type).toBe(OPERATION_TYPE_ID)
    expect(once.find((row) => row.id === "b")).toBe(rows[1])
    expect(once.find((row) => row.id === "c")?.type).toBe(COMPUTER_PROJECT_TYPE_ID)
    expect(once.find((row) => row.id === "d")?.type).toBe("book")
    expect(stampUntypedOperations(once)).toBe(once)
  })

  it("leaves an ordinary item alone", () => {
    const rows = [task({ id: "plain", type: "item" })]
    expect(stampUntypedOperations(rows)).toBe(rows)
  })

  it("stamps a generic item that carries a task list, parts, or a tracking pen, and skips empty marks", () => {
    const rows = [
      task({ id: "list", type: "item", attributes: { [OPERATION_ATTR.taskListId]: "op-list-list" } }),
      task({ id: "parts", type: "item", attributes: { [OPERATION_ATTR.partFormulas]: [{ id: "room", name: "Room" }] } }),
      task({ id: "pen", type: undefined, attributes: { [OPERATION_ATTR.trackingPenId]: "pen-1" } }),
      task({ id: "empty", type: "item", attributes: { [OPERATION_ATTR.panels]: [] } }),
      task({ id: "blank-pen", type: "item", attributes: { [OPERATION_ATTR.trackingPenId]: "" } }),
      task({ id: "book", type: "book", attributes: { [OPERATION_ATTR.taskListId]: "op-list-book" } }),
    ]
    const once = stampUntypedOperations(rows)
    expect(once.find((row) => row.id === "list")?.type).toBe(OPERATION_TYPE_ID)
    expect(once.find((row) => row.id === "parts")?.type).toBe(OPERATION_TYPE_ID)
    expect(once.find((row) => row.id === "pen")?.type).toBe(OPERATION_TYPE_ID)
    expect(once.find((row) => row.id === "empty")?.type).toBe("item")
    expect(once.find((row) => row.id === "blank-pen")?.type).toBe("item")
    expect(once.find((row) => row.id === "book")?.type).toBe("book")
    expect(stampUntypedOperations(once)).toBe(once)
  })
})
