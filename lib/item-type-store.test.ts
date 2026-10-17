import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistKey, writeAliasedLocal } from "./storage-keys"
import { ITEM_TYPE_STORE_PERSIST_VERSION, migrateItemTypeState, useItemTypeStore } from "./item-type-store"

describe("item-type-store persist", () => {
  beforeEach(() => {
    localStorage.clear()
    useItemTypeStore.getState().resetTypes()
  })

  afterEach(() => {
    useItemTypeStore.getState().resetTypes()
    useItemTypeStore.setState({ relations: [], relationOverrides: {} })
    vi.restoreAllMocks()
  })

  it("keeps a custom user type when migrating a v0 snapshot", () => {
    const next = migrateItemTypeState(
      { types: [{ id: "friend", name: "Friend", builtin: false, attributes: [] }] },
      0,
    )
    expect(next.types.find((t) => t.id === "friend")?.name).toBe("Friend")
    expect(next.types.find((t) => t.id === "task")?.name).toBe("Task")
  })

  it("rehydrates a version-mismatched snapshot instead of warning and dropping it", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {})
    writeAliasedLocal(
      "cogs-item-types-store",
      JSON.stringify({
        state: {
          types: [{ id: "friend", name: "Friend", builtin: false, attributes: [] }],
        },
        version: 0,
      }),
    )
    await useItemTypeStore.persist.rehydrate()
    expect(useItemTypeStore.getState().types.find((t) => t.id === "friend")?.name).toBe("Friend")
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("couldn't be migrated since no migrate function was provided"),
    )
    const raw = localStorage.getItem(persistKey("item-types-store"))
    expect(JSON.parse(raw ?? "{}").version).toBe(ITEM_TYPE_STORE_PERSIST_VERSION)
  })

  it("carries relations and overrides through a v2 → v3 migrate (L1.4)", () => {
    const rel = { id: "rel-coaches-ab12", label: "coaches", inverse: "rel-coaches-ab12", inverseLabel: "coaches", custom: true }
    const next = migrateItemTypeState(
      {
        types: [],
        relations: [rel, { id: 3 }],
        relationOverrides: { "part-of": { traits: { transitive: true }, label: "nope" }, bad: { label: "x" } },
        relationRules: [{ id: "rule-gp-ab12", chain: ["parent-of", "parent-of"], head: "grandparent-of" }, null],
      },
      2,
    )
    expect(next.relations).toEqual([rel])
    expect(next.relationOverrides).toEqual({ "part-of": { traits: { transitive: true } } })
    expect(next.relationRules).toHaveLength(1)
    expect(next.types.find((t) => t.id === "task")).toBeDefined()
  })

  it("rehydrates a v2 blob with its relations intact", async () => {
    const rel = { id: "rel-coaches-ab12", label: "coaches", inverse: "rel-coaches-ab12", inverseLabel: "coaches", custom: true }
    writeAliasedLocal(
      persistKey("item-types-store"),
      JSON.stringify({ state: { types: [], relations: [rel] }, version: 2 }),
    )
    await useItemTypeStore.persist.rehydrate()
    expect(useItemTypeStore.getState().relations.map((r) => r.id)).toEqual([rel.id])
    expect(useItemTypeStore.getState().relationOverrides).toEqual({})
  })
})
