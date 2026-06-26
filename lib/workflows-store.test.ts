import { describe, it, expect, beforeEach } from "vitest"
import { useWorkflowsStore, workflowMatchesScope } from "@/lib/workflows-store"
import type { WorkflowDefinition } from "@/lib/types"

function resetStore() {
  localStorage.clear()
  useWorkflowsStore.setState({ workflows: [] })
}

const base = (overrides: Partial<WorkflowDefinition> = {}): Omit<WorkflowDefinition, "id"> => ({
  name: "WF",
  trigger: { kind: "item", event: "create" },
  actions: [{ kind: "addTag", tag: "x" }],
  ...overrides,
})

describe("workflows-store — CRUD", () => {
  beforeEach(resetStore)

  it("adds a workflow with a generated id", () => {
    const id = useWorkflowsStore.getState().addWorkflow(base())
    expect(id).toMatch(/^wf-/)
    expect(useWorkflowsStore.getState().getWorkflow(id)).toBeDefined()
  })

  it("respects an explicit id and is idempotent", () => {
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "fixed" })
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "fixed" })
    expect(useWorkflowsStore.getState().workflows).toHaveLength(1)
  })

  it("addWorkflowDefinition won't duplicate by id", () => {
    const def: WorkflowDefinition = { ...base(), id: "d1" }
    useWorkflowsStore.getState().addWorkflowDefinition(def)
    useWorkflowsStore.getState().addWorkflowDefinition(def)
    expect(useWorkflowsStore.getState().workflows).toHaveLength(1)
  })

  it("updates a workflow but preserves its id", () => {
    const id = useWorkflowsStore.getState().addWorkflow(base())
    useWorkflowsStore.getState().updateWorkflow(id, { name: "Renamed", id: "hacked" as never })
    const w = useWorkflowsStore.getState().getWorkflow(id)
    expect(w?.name).toBe("Renamed")
    expect(w?.id).toBe(id)
  })

  it("removes a workflow", () => {
    const id = useWorkflowsStore.getState().addWorkflow(base())
    useWorkflowsStore.getState().removeWorkflow(id)
    expect(useWorkflowsStore.getState().getWorkflow(id)).toBeUndefined()
  })

  it("enables / disables a workflow", () => {
    const id = useWorkflowsStore.getState().addWorkflow(base())
    useWorkflowsStore.getState().setEnabled(id, false)
    expect(useWorkflowsStore.getState().getWorkflow(id)?.enabled).toBe(false)
    useWorkflowsStore.getState().setEnabled(id, true)
    expect(useWorkflowsStore.getState().getWorkflow(id)?.enabled).toBe(true)
  })

  it("persists under cogs-workflows-store", () => {
    useWorkflowsStore.getState().addWorkflow({ ...base(), name: "Persisted" })
    expect(localStorage.getItem("cogs-workflows-store")).toContain("Persisted")
  })
})

describe("workflows-store — query by scope", () => {
  beforeEach(resetStore)

  it("returns scoped + unscoped workflows for a matching list", () => {
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "global" })
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "books", scope: { listIds: ["books"] } })
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "movies", scope: { listIds: ["movies"] } })

    const ids = useWorkflowsStore
      .getState()
      .getByScope({ categoryId: "books" })
      .map((w) => w.id)
      .sort()
    expect(ids).toEqual(["books", "global"])
  })

  it("excludes disabled workflows", () => {
    const id = useWorkflowsStore.getState().addWorkflow({ ...base(), id: "off" })
    useWorkflowsStore.getState().setEnabled(id, false)
    expect(useWorkflowsStore.getState().getByScope({}).map((w) => w.id)).toEqual([])
  })

  it("filters by item type and module", () => {
    useWorkflowsStore
      .getState()
      .addWorkflow({ ...base(), id: "notes", scope: { itemTypeIds: ["note"] }, moduleId: "m1" })
    useWorkflowsStore.getState().addWorkflow({ ...base(), id: "tasks", scope: { itemTypeIds: ["task"] } })

    expect(useWorkflowsStore.getState().getByScope({ itemTypeId: "note" }).map((w) => w.id)).toEqual(["notes"])
    expect(useWorkflowsStore.getState().getForModule("m1").map((w) => w.id)).toEqual(["notes"])
  })
})

describe("workflowMatchesScope (pure)", () => {
  const w = (scope?: WorkflowDefinition["scope"], moduleId?: string): WorkflowDefinition => ({
    id: "w",
    name: "w",
    trigger: { kind: "manual" },
    actions: [],
    scope,
    moduleId,
  })

  it("matches everything when unscoped", () => {
    expect(workflowMatchesScope(w(), { categoryId: "anything" })).toBe(true)
  })

  it("does not exclude on category when the query omits a category", () => {
    expect(workflowMatchesScope(w({ listIds: ["books"] }), {})).toBe(true)
  })

  it("excludes when scope category doesn't intersect the query", () => {
    expect(workflowMatchesScope(w({ listIds: ["books"] }), { categoryId: "movies" })).toBe(false)
  })
})
