import { beforeEach, describe, expect, it } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { clearHistory, loadHistory, saveHistory } from "./history"
import { browserPort } from "./port"
import { newSession } from "./session"

describe("chat history", () => {
  beforeEach(() => localStorage.clear())
  it("brings back what was said, drops a waiting plan's weight, and clears", () => {
    const plan = { tool: "retype-items", title: "t", summary: [], impacts: [], samples: ["a"], warnings: [], oneTime: true, total: 3, signature: "s", changes: [{ id: "1", title: "a", patch: {}, before: {}, note: "" }] } as never
    saveHistory(
      [{ id: 0, who: "you", text: "hi" }, { id: 1, who: "helper", replies: [{ kind: "plan", plan, confirm: "yes", choices: [{ label: "Yes", text: "yes" }] }] }],
      { ...newSession(), listId: "L" },
    )
    const got = loadHistory()!
    expect(got.listId).toBe("L")
    expect(got.turns).toHaveLength(2)
    const reply = got.turns[1]!.replies![0] as { plan: { changes: unknown[]; samples: string[] } }
    expect(reply.plan.changes).toEqual([])
    expect(reply.plan.samples).toEqual(["a"])
    clearHistory()
    expect(loadHistory()).toBeNull()
  })
})

describe("browserPort.commitMany", () => {
  it("patches many items in the real store with one write", () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: `x${i}`, description: `d${i}`, title: `d${i}`, type: "task", lists: [], stage: "list", completed: false, createdAt: new Date() })) as Task[]
    useTaskStore.setState({ tasks: rows })
    let writes = 0
    const off = useTaskStore.subscribe(() => writes++)
    const n = browserPort().commitMany(rows.map((r) => ({ id: r.id, patch: { type: "book" } })))
    off()
    expect(n).toBe(1500)
    expect(writes).toBe(1)
    expect(useTaskStore.getState().tasks.every((t) => t.type === "book")).toBe(true)
  })
})
