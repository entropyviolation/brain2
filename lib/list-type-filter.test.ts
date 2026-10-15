import { describe, expect, it } from "vitest"
import type { ItemTypeDefinition, Task } from "@/lib/types"
import {
  effectiveItemTypeId,
  filterTasksByHiddenItemTypes,
  shouldShowTypeFilter,
  typeFilterItems,
  typesPresentInTasks,
} from "@/lib/list-type-filter"

const task = (partial: Partial<Task> & Pick<Task, "id">): Task => ({
  description: partial.id,
  lists: [],
  stage: "list",
  completed: false,
  createdAt: new Date("2026-01-01"),
  urgency: 1,
  importance: 1,
  ...partial,
})

describe("effectiveItemTypeId", () => {
  it("prefers task.type", () => {
    expect(effectiveItemTypeId(task({ id: "1", type: "film" }), { itemTypeId: "book" })).toBe("film")
  })

  it("falls back to list default then item", () => {
    expect(effectiveItemTypeId(task({ id: "1" }), { itemTypeId: "book" })).toBe("book")
    expect(effectiveItemTypeId(task({ id: "1" }), null)).toBe("item")
  })
})

describe("typesPresentInTasks / filter", () => {
  const rows = [
    task({ id: "a", type: "film" }),
    task({ id: "b", type: "book" }),
    task({ id: "c" }),
  ]

  it("lists distinct effective types", () => {
    expect(typesPresentInTasks(rows, { itemTypeId: "item" })).toEqual(["book", "film", "item"])
  })

  it("empty hidden shows all", () => {
    expect(filterTasksByHiddenItemTypes(rows, [])).toHaveLength(3)
  })

  it("hides exact type ids only", () => {
    const next = filterTasksByHiddenItemTypes(rows, ["film"], null)
    expect(next.map((t) => t.id)).toEqual(["b", "c"])
  })
})

describe("typeFilterItems", () => {
  const types: ItemTypeDefinition[] = [{ id: "film", name: "Film", builtin: true, kind: "catalog" }]

  it("uses registry names and Unknown for missing", () => {
    expect(typeFilterItems(["film", "ghost"], types)).toEqual([
      { id: "film", name: "Film" },
      { id: "ghost", name: "Unknown (ghost)" },
    ])
  })
})

describe("shouldShowTypeFilter", () => {
  it("shows when present or allowlist has 2+", () => {
    expect(shouldShowTypeFilter({ presentTypeCount: 2 })).toBe(true)
    expect(shouldShowTypeFilter({ presentTypeCount: 1, allowedTypeCount: 2 })).toBe(true)
    expect(shouldShowTypeFilter({ presentTypeCount: 1, allowedTypeCount: 1 })).toBe(false)
  })
})
