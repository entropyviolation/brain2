import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { writeAliasedLocal } from "./storage-keys"
import { ITEM_TYPE_STORE_PERSIST_VERSION, migrateItemTypeState, useItemTypeStore } from "./item-type-store"

describe("item-type-store persist", () => {
  beforeEach(() => {
    localStorage.clear()
    useItemTypeStore.getState().resetTypes()
  })

  afterEach(() => {
    useItemTypeStore.getState().resetTypes()
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
    const raw = localStorage.getItem("cogs-item-types-store")
    expect(JSON.parse(raw ?? "{}").version).toBe(ITEM_TYPE_STORE_PERSIST_VERSION)
  })
})
