import { renderHook, act } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useListsSelection } from "../useListsSelection"

describe("useListsSelection", () => {
  it("starts with select mode off", () => {
    const { result } = renderHook(() => useListsSelection())
    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedCategories).toEqual([])
  })

  it("toggles select mode and clears selection", () => {
    const { result } = renderHook(() => useListsSelection())
    act(() => result.current.setSelectedCategories(["a", "b"]))
    act(() => result.current.toggleSelectMode())
    expect(result.current.selectMode).toBe(true)
    act(() => result.current.toggleSelectMode())
    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedCategories).toEqual([])
  })

  it("toggles category selection", () => {
    const { result } = renderHook(() => useListsSelection())
    act(() => result.current.toggleCategorySelection("list-1"))
    expect(result.current.selectedCategories).toEqual(["list-1"])
    act(() => result.current.toggleCategorySelection("list-1"))
    expect(result.current.selectedCategories).toEqual([])
  })
})
