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

  it("is case-insensitive", () => {
    const { result } = renderHook(() => useListsSearch([], [], items))
    act(() => result.current.setSearchTerm("REPORT"))
    expect(result.current.searchResults.tasks).toHaveLength(1)
  })
})
