import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  initWorkflowEngine,
  teardownWorkflowEngine,
  isWorkflowEngineInstalled,
  runWorkflowManually,
} from "@/lib/services/item-mutation-service"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import type { Task, WorkflowDefinition } from "@/lib/types"

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  description: "Task",
  stage: "inbox",
  createdAt: new Date("2026-06-23T12:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

const wf = (overrides: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: "wf",
  name: "WF",
  trigger: { kind: "item", event: "create" },
  actions: [],
  ...overrides,
})

function reset() {
  teardownWorkflowEngine()
  localStorage.clear()
  useTaskStore.getState().clearAllData()
  useWorkflowsStore.setState({ workflows: [] })
}

describe("item-mutation-service — engine wiring", () => {
  beforeEach(reset)
  afterEach(teardownWorkflowEngine)

  it("registering the dispatcher makes a store mutation trigger a matching workflow", () => {
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({ id: "tag-on-create", actions: [{ kind: "addTag", tag: "auto" }] }),
    )
    initWorkflowEngine()

    taskRepository.add(task({ id: "a1" }))

    expect(taskRepository.getById("a1")?.tags).toContain("auto")
  })

  it("sets an attribute in response to an attribute-change trigger", () => {
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({
        id: "mark-reviewed",
        trigger: { kind: "attribute", attrId: "status", event: "change" },
        actions: [{ kind: "setAttribute", field: "reviewed", value: true }],
      }),
    )
    initWorkflowEngine()

    const t = task({ id: "a2", stage: "clarified", attributes: {} })
    taskRepository.add(t)
    // Change the watched attribute → workflow fires and sets `reviewed`.
    taskRepository.update({ ...taskRepository.getById("a2")!, attributes: { status: "done" } })

    expect(taskRepository.getById("a2")?.attributes?.reviewed).toBe(true)
  })

  it("honors workflow scope (only fires for items in the scoped list)", () => {
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({ id: "books-tag", scope: { listIds: ["books"] }, actions: [{ kind: "addTag", tag: "book" }] }),
    )
    initWorkflowEngine()

    taskRepository.add(task({ id: "in-books", lists: ["books"] }))
    taskRepository.add(task({ id: "in-movies", lists: ["movies"] }))

    expect(taskRepository.getById("in-books")?.tags).toContain("book")
    expect(taskRepository.getById("in-movies")?.tags ?? []).not.toContain("book")
  })

  it("a throwing workflow does NOT break the originating mutation", () => {
    // An adapter whose action throws simulates a broken workflow side effect.
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({ id: "boom", actions: [{ kind: "setAttribute", field: "x", value: 1 }] }),
    )
    initWorkflowEngine({
      adapter: {
        setAttribute: () => {
          throw new Error("kaboom")
        },
      },
    })

    // The mutation must still succeed even though the workflow action throws.
    expect(() => taskRepository.add(task({ id: "survives" }))).not.toThrow()
    expect(taskRepository.getById("survives")).toBeDefined()
  })

  it("a cascading workflow terminates (reentrancy is bounded)", () => {
    // On any update, set an ever-changing attribute → would loop forever without
    // the reentrancy cap. The mutation must still return.
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({
        id: "cascade",
        trigger: { kind: "item", event: "update" },
        actions: [{ kind: "addTag", tag: "ping" }],
      }),
    )
    initWorkflowEngine()

    const t = task({ id: "c1", stage: "clarified" })
    taskRepository.add(t)
    expect(() => taskRepository.update({ ...taskRepository.getById("c1")!, description: "changed" })).not.toThrow()
    expect(taskRepository.getById("c1")?.tags).toContain("ping")
  })

  it("is idempotent and supports teardown", () => {
    initWorkflowEngine()
    expect(isWorkflowEngineInstalled()).toBe(true)
    initWorkflowEngine() // no throw, no double-register
    teardownWorkflowEngine()
    expect(isWorkflowEngineInstalled()).toBe(false)
  })

  it("runWorkflowManually invokes a manual workflow against an item", () => {
    useWorkflowsStore.getState().addWorkflowDefinition(
      wf({ id: "manual-tag", trigger: { kind: "manual" }, actions: [{ kind: "addTag", tag: "manual" }] }),
    )
    taskRepository.add(task({ id: "m1" }))

    const res = runWorkflowManually("manual-tag", "m1")
    expect(res.ranWorkflows).toContain("manual-tag")
    expect(taskRepository.getById("m1")?.tags).toContain("manual")
  })
})
