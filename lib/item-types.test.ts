import { describe, it, expect } from "vitest"
import {
  getBuiltinItemTypes,
  getItemType,
  resolveAttributes,
  resolveDefaultValues,
  composeListAttributes,
  composeListDefaults,
  resolveItemSchema,
  assignedItemTypes,
  itemsOfType,
  gatherItemRules,
  applyRules,
  evaluateCondition,
  applyRulesFor,
  validateItem,
  type TypedAttributeSource,
} from "@/lib/item-types"
import type { ItemLike } from "@/lib/item-types"
import type { AttributeDefinition, ItemTypeDefinition, ItemTypeRule } from "@/lib/types"

const attr = (id: string, name = id): AttributeDefinition => ({ id, name, type: "string" })

describe("getBuiltinItemTypes / getItemType", () => {
  it("ships a built-in task type with capabilities", () => {
    const task = getBuiltinItemTypes().find((t) => t.id === "task")
    expect(task?.builtin).toBe(true)
    expect(task?.capabilities?.scheduleable).toBe(true)
    expect(task?.capabilities?.points).toBe(true)
  })

  it("falls back to the task type for unknown ids", () => {
    const types = getBuiltinItemTypes()
    expect(getItemType(types, "does-not-exist").id).toBe("task")
    expect(getItemType(types, undefined).id).toBe("task")
  })
})

describe("resolveAttributes", () => {
  it("unions type and category attributes, type winning on id clash", () => {
    const type: ItemTypeDefinition = {
      id: "book",
      name: "Book",
      attributes: [attr("rating"), { ...attr("status"), name: "Reading status" }],
    }
    const categories = [
      { itemAttributes: [attr("author")] },
      { itemAttributes: [{ ...attr("status"), name: "List status" }] },
    ]
    const resolved = resolveAttributes(type, categories)
    const ids = resolved.map((a) => a.id).sort()
    expect(ids).toEqual(["author", "rating", "status"])
    // Type's definition of `status` wins.
    expect(resolved.find((a) => a.id === "status")?.name).toBe("Reading status")
  })

  it("handles missing type and empty categories", () => {
    expect(resolveAttributes(undefined, [])).toEqual([])
  })
})

describe("resolveDefaultValues", () => {
  it("merges category defaults then type defaults (type wins)", () => {
    const type: ItemTypeDefinition = {
      id: "book",
      name: "Book",
      defaultAttributeValues: { status: "unread" },
    }
    const categories = [{ defaultAttributeValues: { status: "queued", author: "" } }]
    expect(resolveDefaultValues(type, categories)).toEqual({ status: "unread", author: "" })
  })
})

describe("composeListAttributes / composeListDefaults (per-list composition)", () => {
  const bookType: ItemTypeDefinition = {
    id: "book",
    name: "Book",
    attributes: [attr("title", "Title"), attr("author", "Author"), { id: "read", name: "Read", type: "boolean" }],
    defaultAttributeValues: { read: false },
  }
  const types = [bookType]

  it("layers list-specific attributes on top of the type's, list winning on clash", () => {
    const readingList: TypedAttributeSource = {
      itemTypeId: "book",
      itemAttributes: [attr("recommendedBy", "Recommended by"), { ...attr("author"), name: "Author (list)" }],
    }
    const schema = composeListAttributes(readingList, types)
    const ids = schema.map((a) => a.id)
    expect(ids).toEqual(["title", "author", "read", "recommendedBy"])
    // List's definition of `author` wins over the type's.
    expect(schema.find((a) => a.id === "author")?.name).toBe("Author (list)")
  })

  it("merges type defaults then list defaults (list wins)", () => {
    const booksToBuy: TypedAttributeSource = {
      itemTypeId: "book",
      itemAttributes: [{ id: "purchased", name: "Purchased", type: "boolean" }],
      defaultAttributeValues: { purchased: false, read: true },
    }
    expect(composeListDefaults(booksToBuy, types)).toEqual({ read: true, purchased: false })
  })

  it("ignores an unknown item type id (treats list as untyped)", () => {
    const list: TypedAttributeSource = { itemTypeId: "ghost", itemAttributes: [attr("x")] }
    expect(composeListAttributes(list, types).map((a) => a.id)).toEqual(["x"])
  })
})

describe("resolveItemSchema (union across all an item's lists + its type)", () => {
  const bookType: ItemTypeDefinition = {
    id: "book",
    name: "Book",
    attributes: [attr("title", "Title"), attr("author", "Author")],
  }
  const types = [bookType]
  const readingList = { id: "reading", itemTypeId: "book" as const, itemAttributes: [attr("recommendedBy")] }
  const booksToBuy = {
    id: "tobuy",
    itemTypeId: "book" as const,
    itemAttributes: [{ id: "cost", name: "Cost", type: "number" as const, unit: "$" }],
  }

  it("unions every list's effective schema for an item in multiple lists", () => {
    const schema = resolveItemSchema({ type: "book", lists: ["reading", "tobuy"] }, [readingList, booksToBuy], types)
    expect(schema.map((a) => a.id).sort()).toEqual(["author", "cost", "recommendedBy", "title"])
  })

  it("keeps the item's own type attributes even with no typed list", () => {
    const schema = resolveItemSchema({ type: "book", lists: [] }, [], types)
    expect(schema.map((a) => a.id)).toEqual(["title", "author"])
  })
})

describe("assignedItemTypes (own type + list-pinned types)", () => {
  const taskType: ItemTypeDefinition = { id: "task", name: "Task" }
  const goalType: ItemTypeDefinition = { id: "goal", name: "Goal" }
  const bookType: ItemTypeDefinition = { id: "book", name: "Book" }
  const types = [taskType, goalType, bookType]
  const goalsList = { id: "goals", itemTypeId: "goal" as const }
  const readingList = { id: "reading", itemTypeId: "book" as const }
  const plainList = { id: "plain" }

  it("returns the item's own type first, then distinct list-pinned types", () => {
    const result = assignedItemTypes(
      { type: "task", lists: ["goals", "reading"] },
      [goalsList, readingList],
      types,
    )
    expect(result.map((t) => t.id)).toEqual(["task", "goal", "book"])
  })

  it("deduplicates when a list pins the item's own type", () => {
    const result = assignedItemTypes({ type: "goal", lists: ["goals"] }, [goalsList], types)
    expect(result.map((t) => t.id)).toEqual(["goal"])
  })

  it("defaults a missing type to the built-in task type", () => {
    const result = assignedItemTypes({ lists: [] }, [], types)
    expect(result.map((t) => t.id)).toEqual(["task"])
  })

  it("ignores untyped lists and unregistered type ids", () => {
    const result = assignedItemTypes(
      { type: "task", lists: ["plain", "ghost-list"] },
      [plainList],
      types,
    )
    expect(result.map((t) => t.id)).toEqual(["task"])
  })
})

describe("itemsOfType", () => {
  const types = [
    { id: "book" as const, name: "Book" },
    { id: "fiction" as const, name: "Fiction", parentTypeId: "book" as const },
  ]
  const lists = [
    { id: "reading", itemTypeId: "book" as const },
    { id: "plain" },
  ]

  it("includes items whose primary type matches", () => {
    const items = [
      { id: "a", type: "book" as const },
      { id: "b", type: "task" as const, lists: ["reading"] },
      { id: "c", type: "task" as const, lists: ["plain"] },
    ]
    expect(itemsOfType("book", items, lists, types).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("includes items of descendant subtypes", () => {
    const items = [
      { id: "a", type: "fiction" as const },
      { id: "b", type: "book" as const },
    ]
    expect(itemsOfType("book", items, lists, types).map((i) => i.id)).toEqual(["a", "b"])
  })
})

describe("gatherItemRules / applyRules (list-scoped rules follow the item)", () => {
  const purchasedRule: ItemTypeRule = {
    id: "purchased->owned",
    name: "When purchased, owned",
    trigger: "update",
    when: { field: "purchased", operator: "eq", value: true },
    action: { kind: "setAttribute", field: "owned", value: true },
  }
  const bookType: ItemTypeDefinition = { id: "book", name: "Book" }

  it("collects rules from the type and every list (dedup by id)", () => {
    const booksToBuy: TypedAttributeSource = { itemTypeId: "book", rules: [purchasedRule] }
    const reading: TypedAttributeSource = { itemTypeId: "book", rules: [purchasedRule] }
    const rules = gatherItemRules(bookType, [booksToBuy, reading])
    expect(rules.map((r) => r.id)).toEqual(["purchased->owned"])
  })

  it("applies a setAttribute action when its condition matches the trigger", () => {
    const item: ItemLike = { attributes: { purchased: true } }
    const result = applyRules(item, [purchasedRule], "update")
    expect(result.item.attributes?.owned).toBe(true)
  })

  it("does not fire on a non-matching trigger or unmet condition", () => {
    const unmet: ItemLike = { attributes: { purchased: false } }
    expect(applyRules(unmet, [purchasedRule], "update").item.attributes?.owned).toBeUndefined()
    const matched: ItemLike = { attributes: { purchased: true } }
    expect(applyRules(matched, [purchasedRule], "create").item.attributes?.owned).toBeUndefined()
  })
})

describe("evaluateCondition", () => {
  const item = { title: "Dune", attributes: { rating: 5, tags: ["sci-fi"] } }

  it("supports exists/empty", () => {
    expect(evaluateCondition(item, { field: "title", operator: "exists" })).toBe(true)
    expect(evaluateCondition(item, { field: "missing", operator: "empty" })).toBe(true)
  })

  it("supports numeric comparisons against attributes", () => {
    expect(evaluateCondition(item, { field: "rating", operator: "gte", value: 4 })).toBe(true)
    expect(evaluateCondition(item, { field: "rating", operator: "lt", value: 4 })).toBe(false)
  })

  it("supports contains for arrays and strings", () => {
    expect(evaluateCondition(item, { field: "tags", operator: "contains", value: "sci-fi" })).toBe(true)
    expect(evaluateCondition(item, { field: "title", operator: "contains", value: "une" })).toBe(true)
  })
})

describe("applyRulesFor / validateItem", () => {
  const type: ItemTypeDefinition = {
    id: "task",
    name: "Task",
    rules: [
      { id: "r1", name: "require title", trigger: "validate", action: { kind: "require", field: "title", message: "Need a title" } },
      { id: "r2", name: "default tag", trigger: "create", action: { kind: "addTag", tag: "new" } },
      { id: "r3", name: "schedule->nextactions", trigger: "schedule", action: { kind: "addToNextActions" } },
      { id: "r4", name: "disabled", trigger: "create", enabled: false, action: { kind: "addTag", tag: "skip" } },
    ],
  }

  it("reports require violations on validate", () => {
    expect(validateItem({ title: "" }, type)).toEqual(["Need a title"])
    expect(validateItem({ title: "Hi" }, type)).toEqual([])
  })

  it("applies automation actions and skips disabled rules", () => {
    const result = applyRulesFor({ title: "Hi", tags: [] }, type, "create")
    expect(result.item.tags).toEqual(["new"])
    expect(result.errors).toEqual([])
  })

  it("flags addToNextActions on the matching trigger", () => {
    expect(applyRulesFor({ title: "Hi" }, type, "schedule").addToNextActions).toBe(true)
    expect(applyRulesFor({ title: "Hi" }, type, "create").addToNextActions).toBe(false)
  })

  it("does not mutate the original item", () => {
    const original = { title: "Hi", tags: ["a"] }
    applyRulesFor(original, type, "create")
    expect(original.tags).toEqual(["a"])
  })

  it("honors `when` conditions", () => {
    const conditional: ItemTypeDefinition = {
      id: "task",
      name: "Task",
      rules: [
        {
          id: "c1",
          name: "tag high priority",
          trigger: "update",
          when: { field: "priority", operator: "gte", value: 5 },
          action: { kind: "addTag", tag: "urgent" },
        },
      ],
    }
    const high: ItemLike = { attributes: { priority: 5 } }
    const low: ItemLike = { attributes: { priority: 1 } }
    expect(applyRulesFor(high, conditional, "update").item.tags).toEqual(["urgent"])
    expect(applyRulesFor(low, conditional, "update").item.tags).toBeUndefined()
  })
})
