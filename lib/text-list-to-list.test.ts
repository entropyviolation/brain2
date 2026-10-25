import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { reorderStrings, textListToBrainList, withTextListId, asListReference } from "./text-list-to-list"

describe("reorderStrings", () => {
  it("moves an item and leaves the input untouched", () => {
    const items = ["a", "b", "c"]
    const next = reorderStrings(items, 0, 2)
    expect(next).toEqual(["b", "c", "a"])
    expect(next).not.toBe(items)
    expect(items).toEqual(["a", "b", "c"])
  })

  it("returns the same reference when indexes are equal or out of range", () => {
    const items = ["a", "b", "c"]
    expect(reorderStrings(items, 1, 1)).toBe(items)
    expect(reorderStrings(items, -1, 0)).toBe(items)
    expect(reorderStrings(items, 0, 9)).toBe(items)
  })
})

describe("withTextListId", () => {
  it("joins an attribute to a list id without renaming either side", () => {
    const task = { id: "t", description: "Idea", textListIds: { other: "list-a" } } as Task
    const next = withTextListId(task, "todo", "list-b")
    expect(next.textListIds).toEqual({ other: "list-a", todo: "list-b" })
    expect(task.textListIds).toEqual({ other: "list-a" })
  })
})

describe("textListToBrainList", () => {
  it("builds a list and one item per non-empty line", () => {
    const { list, items } = textListToBrainList("To do", ["write script", " film ", ""])
    expect(list.name).toBe("To do")
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.title)).toEqual(["write script", "film"])
    expect(items.every((item) => item.lists?.[0] === list.id && item.lists.length === 1)).toBe(true)
    expect(new Set(items.map((item) => item.id)).size).toBe(2)
    expect(items.every((item) => item.stage === "clarified" && item.type === "item")).toBe(true)
  })
})

describe("asListReference", () => {
  it("turns an item-only text list into a list reference", () => {
    const task = {
      id: "t",
      description: "Shoot",
      attributes: { todo: ["write script"] },
      itemAttributeDefinitions: [{ id: "todo", name: "To do", type: "multistring" }],
      textListIds: { todo: "old", other: "keep" },
    } as Task
    const next = asListReference(task, "todo", "list-b")
    expect(next.attributes?.todo).toBe("list-b")
    expect(next.itemAttributeDefinitions?.[0].type).toBe("list")
    expect(next.textListIds).toEqual({ other: "keep" })
    expect(task.attributes?.todo).toEqual(["write script"])
  })

  it("leaves a shared definition as a text list and only stores the join", () => {
    const task = {
      id: "t",
      description: "Shoot",
      attributes: { todo: ["write script"] },
    } as Task
    const next = asListReference(task, "todo", "list-b")
    expect(next.attributes?.todo).toEqual(["write script"])
    expect(next.textListIds).toEqual({ todo: "list-b" })
  })
})
