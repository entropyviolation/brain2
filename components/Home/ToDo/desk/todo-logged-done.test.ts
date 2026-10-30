import { describe, expect, it } from "vitest"
import type { CompletionWindow } from "@/lib/completion-window"
import { loggedDoneTask } from "./todo-logged-done"

const ref = new Date(2026, 9, 27, 12, 0, 0)

const window: CompletionWindow = {
  startedAt: new Date(2026, 9, 27, 14, 0, 0),
  completedAt: new Date(2026, 9, 27, 14, 30, 0),
  kind: "anchor",
  estimatedFields: ["startedAt", "completedDate"],
  basis: "logged after the fact",
}

describe("loggedDoneTask", () => {
  it("assumes half an hour and stamps a completed task", () => {
    const done = loggedDoneTask("Printed the sleeves", ref, window)
    expect(done.id.startsWith("done-")).toBe(true)
    expect(done.description).toBe("Printed the sleeves")
    expect(done.stage).toBe("completed")
    expect(done.createdAt).toBe(ref)
    expect(done.completed).toBe(true)
    expect(done.status).toBe("done")
    expect(done.completedDate).toBe(window.completedAt)
    expect(done.startedAt).toBe(window.startedAt)
    expect(done.actualDuration).toBe(30)
    expect(done.estimatedDuration).toBe(30)
    expect(done.estimates?.map((row) => ({ field: row.field, kind: row.kind, basis: row.basis }))).toEqual([
      { field: "startedAt", kind: "anchor", basis: "logged after the fact" },
      { field: "completedDate", kind: "anchor", basis: "logged after the fact" },
      { field: "actualDuration", kind: "flat", basis: "30m assumed for work logged after the fact" },
    ])
    expect(done.lists).toEqual([])
    expect(done.scheduleable).toBe(true)
    expect(done.urgency).toBe(3)
    expect(done.importance).toBe(3)
    expect(done.cognitiveLoad).toBe(2)
    expect(done.dependencies).toEqual([])
    expect(done.context).toBe("@general")
    expect(done.entropy).toBe(0.5)
    expect(done.rewardValue).toBe(1)
    expect(done.allowPartialCompletion).toBe(false)
    expect(done.minimumChunkSize).toBe(15)
  })
})
