import { describe, expect, it } from "vitest"
import { stampUntypedOperations } from "@/lib/operation-item-stamp"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    description: partial.id,
    stage: "clarified",
    createdAt: new Date("2026-01-01"),
    completed: false,
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
})
