import { renderHook, act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useListsSearch } from "../useListsSearch"
import type { Task } from "@/lib/types"

describe("useListsSearch", () => {
  const items: Task[] = [
    { id: "1", description: "Buy groceries", stage: "list", completed: false, createdAt: new Date(), lists: [], urgency: 1, importance: 1 },
    { id: "2", description: "Write report", stage: "list", completed: false, createdAt: new Date(), lists: [], urgency: 1, importance: 1 },
  ]

  it("returns all active items when search is empty", () => {
    const { result } = renderHook(() => useListsSearch([], [], items))
    expect(result.current.filteredItems).toHaveLength(2)
  })

  it("filters items by description", () => {
    const { result } = renderHook(() => useListsSearch([], [], items))
    act(() => result.current.setSearchTerm("groceries"))
    expect(result.current.searchResults.tasks).toHaveLength(1)
    expect(result.current.searchResults.tasks[0].id).toBe("1")
  })

  it("still finds Module Lists folders and autocreated lists", () => {
    const folders = [
      { id: "folder-module-lists", name: "Module Lists", createdAt: new Date(), listIds: [], description: "" },
    ]
    const lists = [{ id: "pack", name: "Packing", color: "#8b5cf6", createdAt: new Date(), createdByModuleId: "m1" }]
    const { result } = renderHook(() => useListsSearch(folders, lists, []))
    act(() => result.current.setSearchTerm("module"))
    expect(result.current.searchResults.folders.map((f) => f.id)).toEqual(["folder-module-lists"])
    act(() => result.current.setSearchTerm("packing"))
    expect(result.current.searchResults.lists.map((c) => c.id)).toEqual(["pack"])
  })
})
