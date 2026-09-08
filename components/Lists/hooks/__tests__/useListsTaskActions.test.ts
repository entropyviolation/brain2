import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { List, Task } from "@/lib/types"
import { useListsTaskActions } from "../useListsTaskActions"

const list: List = { id: "list-1", name: "Stuff", color: "#3B82F6", createdAt: new Date() }

describe("useListsTaskActions handleBulkAddToOpen", () => {
  it("adds every line to the open list without requiring tag headers", () => {
    const addTask = vi.fn()
    const { result } = renderHook(() => useListsTaskActions([list], [], addTask))
    result.current.handleBulkAddToOpen(
      "fox statue\ncorn dog",
      { type: "category", id: "list-1" },
      null,
      vi.fn(),
    )
    expect(addTask).toHaveBeenCalledTimes(2)
    const items = addTask.mock.calls.map((c) => c[0] as Task)
    expect(items.map((t) => t.description)).toEqual(["fox statue", "corn dog"])
    expect(items.every((t) => t.lists.includes("list-1"))).toBe(true)
    expect(items.every((t) => (t.tags ?? []).length === 0)).toBe(true)
  })

  it("applies section tags (normalized) and still files every item on the open list", () => {
    const addTask = vi.fn()
    const onDone = vi.fn()
    const { result } = renderHook(() => useListsTaskActions([list], [], addTask))
    result.current.handleBulkAddToOpen(
      `Already have:
fox statue
2 mobiles

planned:
holder for spoons`,
      { type: "category", id: "list-1" },
      null,
      onDone,
    )
    expect(addTask).toHaveBeenCalledTimes(3)
    expect(onDone).toHaveBeenCalled()
    const items = addTask.mock.calls.map((c) => c[0] as Task)
    expect(items.map((t) => t.description)).toEqual(["fox statue", "2 mobiles", "holder for spoons"])
    expect(items.some((t) => /:$/.test(t.description) || t.description.toLowerCase().includes("already have"))).toBe(false)
    expect(items.map((t) => t.tags)).toEqual([["already have"], ["already have"], ["planned"]])
    expect(items.every((t) => t.lists.includes("list-1"))).toBe(true)
  })
})
