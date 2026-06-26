import { describe, it, expect } from "vitest"
import { dispatchWorkflows, type WorkflowActionAdapter, type WorkflowContext } from "@/lib/workflow-engine"
import type { ItemLike } from "@/lib/item-types"
import type { WorkflowDefinition } from "@/lib/types"

const wf = (overrides: Partial<WorkflowDefinition>): WorkflowDefinition => ({
  id: "wf",
  name: "WF",
  trigger: { kind: "item", event: "create" },
  actions: [],
  ...overrides,
})

const item = (overrides: Partial<ItemLike> = {}): ItemLike => ({
  id: "i1",
  type: "task",
  lists: [],
  attributes: {},
  ...overrides,
})

/** A recording adapter that captures calls for assertions. */
function makeAdapter(): WorkflowActionAdapter & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {}
  const push = (k: string, v: unknown) => {
    ;(calls[k] ??= []).push(v)
  }
  return {
    calls,
    setAttribute: (id, field, value) => push("setAttribute", { id, field, value }),
    addTag: (id, tag) => push("addTag", { id, tag }),
    addToNextActions: (id) => push("addToNextActions", { id }),
    createItem: (categoryId, defaults, title) => {
      push("createItem", { categoryId, defaults, title })
      return "new-item"
    },
    link: (sourceId, relation, targetId) => push("link", { sourceId, relation, targetId }),
    setSchedule: (id, date, time) => push("setSchedule", { id, date, time }),
    syncPlan: () => push("syncPlan", {}),
    pickRandom: (cat, count) => {
      push("pickRandom", { cat, count })
      return ["a", "b"].slice(0, count)
    },
  }
}

describe("workflow-engine — trigger & scope matching", () => {
  it("runs only workflows whose trigger matches the event", () => {
    const ctx: WorkflowContext = {
      workflows: [
        wf({ id: "on-create", trigger: { kind: "item", event: "create" } }),
        wf({ id: "on-complete", trigger: { kind: "item", event: "complete" } }),
      ],
    }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(res.ranWorkflows).toEqual(["on-create"])
  })

  it("matches attribute-change triggers via changedAttrs", () => {
    const ctx: WorkflowContext = {
      workflows: [wf({ id: "on-status", trigger: { kind: "attribute", attrId: "status", event: "change" } })],
    }
    expect(
      dispatchWorkflows({ trigger: "update", itemId: "i1", after: item(), changedAttrs: ["status"] }, ctx)
        .ranWorkflows,
    ).toEqual(["on-status"])
    expect(
      dispatchWorkflows({ trigger: "update", itemId: "i1", after: item(), changedAttrs: ["other"] }, ctx)
        .ranWorkflows,
    ).toEqual([])
  })

  it("filters by category and item-type scope", () => {
    const ctx: WorkflowContext = {
      workflows: [
        wf({ id: "books-only", scope: { listIds: ["books"] } }),
        wf({ id: "notes-only", scope: { itemTypeIds: ["note"] } }),
      ],
    }
    const res = dispatchWorkflows(
      { trigger: "create", itemId: "i1", after: item({ lists: ["books"], type: "task" }) },
      ctx,
    )
    expect(res.ranWorkflows).toEqual(["books-only"])
  })

  it("runs a specific workflow on a manual trigger", () => {
    const ctx: WorkflowContext = {
      workflows: [
        wf({ id: "m1", trigger: { kind: "manual", buttonLabel: "Go" } }),
        wf({ id: "m2", trigger: { kind: "manual" } }),
      ],
    }
    expect(dispatchWorkflows({ trigger: "manual", workflowId: "m1", itemId: "i1", after: item() }, ctx).ranWorkflows).toEqual(["m1"])
    // No workflowId ⇒ all manuals run.
    expect(dispatchWorkflows({ trigger: "manual", itemId: "i1", after: item() }, ctx).ranWorkflows.sort()).toEqual(["m1", "m2"])
  })
})

describe("workflow-engine — conditions", () => {
  it("only runs when every condition passes", () => {
    const ctx: WorkflowContext = {
      workflows: [
        wf({
          id: "gated",
          conditions: [{ field: "priority", operator: "gte", value: 3 }],
          actions: [{ kind: "addTag", tag: "important" }],
        }),
      ],
    }
    const adapter = makeAdapter()
    const pass = dispatchWorkflows(
      { trigger: "create", itemId: "i1", after: item({ attributes: { priority: 5 } }) },
      { ...ctx, adapter },
    )
    expect(pass.ranWorkflows).toEqual(["gated"])

    const fail = dispatchWorkflows(
      { trigger: "create", itemId: "i1", after: item({ attributes: { priority: 1 } }) },
      { ...ctx, adapter },
    )
    expect(fail.ranWorkflows).toEqual([])
  })
})

describe("workflow-engine — actions", () => {
  it("setAttribute / addTag / addToNextActions call the adapter", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({
          actions: [
            { kind: "setAttribute", field: "stage", value: "review" },
            { kind: "addTag", tag: "auto" },
            { kind: "addToNextActions" },
          ],
        }),
      ],
    }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(adapter.calls.setAttribute).toEqual([{ id: "i1", field: "stage", value: "review" }])
    expect(adapter.calls.addTag).toEqual([{ id: "i1", tag: "auto" }])
    expect(adapter.calls.addToNextActions).toEqual([{ id: "i1" }])
    expect(res.effects.map((e) => e.action)).toEqual(["setAttribute", "addTag", "addToNextActions"])
  })

  it("setDefault only fills empty fields", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [wf({ actions: [{ kind: "setDefault", field: "stage", value: "new" }] })],
    }
    // Empty → set.
    dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    // Already present → skip.
    dispatchWorkflows({ trigger: "create", itemId: "i1", after: item({ attributes: { stage: "done" } }) }, ctx)
    expect(adapter.calls.setAttribute).toEqual([{ id: "i1", field: "stage", value: "new" }])
  })

  it("createItem resolves a title from an attribute", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({
          actions: [{ kind: "createItem", categoryId: "followups", defaults: { kind: "x" }, titleFrom: "name" }],
        }),
      ],
    }
    dispatchWorkflows({ trigger: "create", itemId: "i1", after: item({ attributes: { name: "Order #5" } }) }, ctx)
    expect(adapter.calls.createItem).toEqual([
      { categoryId: "followups", defaults: { kind: "x" }, title: "Order #5" },
    ])
  })

  it("link uses an explicit targetId or one read from an attribute", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({ id: "a", actions: [{ kind: "link", relation: "blocks", targetId: "t9" }] }),
        wf({ id: "b", actions: [{ kind: "link", relation: "refs", targetFromAttr: "ref" }] }),
      ],
    }
    dispatchWorkflows({ trigger: "create", itemId: "i1", after: item({ attributes: { ref: "t7" } }) }, ctx)
    expect(adapter.calls.link).toEqual([
      { sourceId: "i1", relation: "blocks", targetId: "t9" },
      { sourceId: "i1", relation: "refs", targetId: "t7" },
    ])
  })

  it("setSchedule reads date/time attributes", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({
          trigger: { kind: "item", event: "update" },
          actions: [{ kind: "setSchedule", dateAttrId: "due", timeAttrId: "at", fromAttrs: true }],
        }),
      ],
    }
    dispatchWorkflows(
      { trigger: "update", itemId: "i1", after: item({ attributes: { due: "2026-07-01", at: "09:00" } }) },
      ctx,
    )
    expect(adapter.calls.setSchedule).toEqual([{ id: "i1", date: "2026-07-01", time: "09:00" }])
  })

  it("pickRandom stores the picked ids into an attribute", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({
          trigger: { kind: "manual" },
          actions: [{ kind: "pickRandom", storeInAttr: "chosen", fromCategoryId: "pool", count: 2 }],
        }),
      ],
    }
    dispatchWorkflows({ trigger: "manual", itemId: "i1", after: item() }, ctx)
    expect(adapter.calls.pickRandom).toEqual([{ cat: "pool", count: 2 }])
    expect(adapter.calls.setAttribute).toEqual([{ id: "i1", field: "chosen", value: ["a", "b"] }])
  })

  it("syncPlan calls the adapter", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [wf({ trigger: { kind: "manual" }, actions: [{ kind: "syncPlan" }] })],
    }
    dispatchWorkflows({ trigger: "manual", itemId: "i1", after: item() }, ctx)
    expect(adapter.calls.syncPlan).toEqual([{}])
  })
})

describe("workflow-engine — validation results", () => {
  it("throw yields a blocking error result", () => {
    const ctx: WorkflowContext = {
      workflows: [wf({ actions: [{ kind: "throw", message: "nope" }, { kind: "addTag", tag: "after" }] })],
    }
    const adapter = makeAdapter()
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, { ...ctx, adapter })
    expect(res.blocked).toBe(true)
    expect(res.errors).toEqual([{ workflowId: "wf", kind: "throw", message: "nope" }])
    // Actions after throw don't run.
    expect(adapter.calls.addTag).toBeUndefined()
  })

  it("require fails when the field is empty and blocks", () => {
    const ctx: WorkflowContext = {
      workflows: [wf({ actions: [{ kind: "require", field: "title", message: "need title" }] })],
    }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(res.blocked).toBe(true)
    expect(res.errors[0]).toMatchObject({ kind: "require", message: "need title" })

    const ok = dispatchWorkflows(
      { trigger: "create", itemId: "i1", after: item({ title: "Has title" }) },
      ctx,
    )
    expect(ok.blocked).toBe(false)
  })

  it("block surfaces a blocking error", () => {
    const ctx: WorkflowContext = { workflows: [wf({ actions: [{ kind: "block", message: "blocked!" }] })] }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(res.blocked).toBe(true)
    expect(res.errors[0]).toMatchObject({ kind: "block", message: "blocked!" })
  })
})

describe("workflow-engine — chaining & safety", () => {
  it("runWorkflow chains into another workflow", () => {
    const adapter = makeAdapter()
    const ctx: WorkflowContext = {
      adapter,
      workflows: [
        wf({ id: "first", actions: [{ kind: "runWorkflow", workflowId: "second" }] }),
        wf({ id: "second", trigger: { kind: "manual" }, actions: [{ kind: "addTag", tag: "chained" }] }),
      ],
    }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(res.ranWorkflows).toEqual(["first", "second"])
    expect(adapter.calls.addTag).toEqual([{ id: "i1", tag: "chained" }])
  })

  it("caps chain depth to prevent infinite loops", () => {
    const ctx: WorkflowContext = {
      maxDepth: 3,
      workflows: [
        // self-referential manual workflow
        wf({ id: "loop", trigger: { kind: "manual" }, actions: [{ kind: "runWorkflow", workflowId: "loop" }] }),
      ],
    }
    const res = dispatchWorkflows({ trigger: "manual", workflowId: "loop", itemId: "i1", after: item() }, ctx)
    // Terminates and records a depth error rather than hanging.
    expect(res.errors.some((e) => e.kind === "depth")).toBe(true)
    // Ran a bounded number of times (depth 0..3 inclusive).
    expect(res.ranWorkflows.filter((id) => id === "loop").length).toBeLessThanOrEqual(4)
  })

  it("is resilient to a throwing adapter action", () => {
    const ctx: WorkflowContext = {
      adapter: {
        setAttribute: () => {
          throw new Error("adapter boom")
        },
      },
      workflows: [
        wf({
          actions: [
            { kind: "setAttribute", field: "x", value: 1 },
            { kind: "addTag", tag: "still-runs" },
          ],
        }),
      ],
    }
    const res = dispatchWorkflows({ trigger: "create", itemId: "i1", after: item() }, ctx)
    expect(res.errors.some((e) => e.kind === "exception" && /boom/.test(e.message))).toBe(true)
    // The subsequent action still recorded an effect (engine kept going).
    expect(res.effects.some((e) => e.action === "addTag")).toBe(true)
  })
})
