import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  dispatchItemMutation,
  registerItemMutationDispatcher,
  type ItemMutationEvent,
} from "@/lib/workflow-hooks"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date("2026-06-01T08:30:00.000Z"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("workflow-hooks registry", () => {
  afterEach(() => registerItemMutationDispatcher(null))

  it("is a no-op when no dispatcher is registered", () => {
    expect(() => dispatchItemMutation({ trigger: "create", itemId: "x" })).not.toThrow()
  })

  it("invokes the registered dispatcher with the event", () => {
    const events: ItemMutationEvent[] = []
    registerItemMutationDispatcher((e) => events.push(e))
    dispatchItemMutation({ trigger: "update", itemId: "abc", changedAttrs: ["price"] })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ trigger: "update", itemId: "abc", changedAttrs: ["price"] })
  })

  it("swallows a throwing dispatcher (mutation stays safe)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    registerItemMutationDispatcher(() => {
      throw new Error("boom")
    })
    expect(() => dispatchItemMutation({ trigger: "complete", itemId: "y" })).not.toThrow()
    spy.mockRestore()
  })
})

describe("task-store → workflow-hooks wiring", () => {
  beforeEach(() => resetAllStores())
  afterEach(() => registerItemMutationDispatcher(null))

  it("dispatches a create event on addTask", () => {
    const events: ItemMutationEvent[] = []
    registerItemMutationDispatcher((e) => events.push(e))
    useTaskStore.getState().addTask(task({ id: "a", description: "New" }))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ trigger: "create", itemId: "a" })
    expect(events[0].after?.id).toBe("a")
  })

  it("dispatches an update event with best-effort changedAttrs", () => {
    useTaskStore.getState().setTasks([task({ id: "a", attributes: { price: 10 } })])
    const events: ItemMutationEvent[] = []
    registerItemMutationDispatcher((e) => events.push(e))
    useTaskStore.getState().updateTask(task({ id: "a", attributes: { price: 20 } }))
    expect(events).toHaveLength(1)
    expect(events[0].trigger).toBe("update")
    expect(events[0].changedAttrs).toContain("price")
  })

  it("dispatches a complete event when a task transitions to completed", () => {
    useTaskStore.getState().setTasks([task({ id: "a", completed: false })])
    const events: ItemMutationEvent[] = []
    registerItemMutationDispatcher((e) => events.push(e))
    useTaskStore.getState().updateTask(task({ id: "a", completed: true }))
    expect(events[0].trigger).toBe("complete")
  })

  it("a throwing dispatcher does not break the store mutation", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    registerItemMutationDispatcher(() => {
      throw new Error("boom")
    })
    expect(() => useTaskStore.getState().addTask(task({ id: "z", description: "Z" }))).not.toThrow()
    expect(useTaskStore.getState().tasks.some((t) => t.id === "z")).toBe(true)
    spy.mockRestore()
  })
})
