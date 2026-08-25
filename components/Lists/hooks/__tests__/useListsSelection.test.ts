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

  it("toggles folder selection", () => {
    const { result } = renderHook(() => useListsSelection())
    act(() => result.current.toggleFolderSelection("folder-1"))
    expect(result.current.selectedFolderIds).toEqual(["folder-1"])
    act(() => result.current.toggleFolderSelection("folder-1"))
    expect(result.current.selectedFolderIds).toEqual([])
  })

  it("clears list and folder selection when leaving select mode", () => {
    const { result } = renderHook(() => useListsSelection())
    act(() => {
      result.current.toggleSelectMode()
      result.current.toggleCategorySelection("list-1")
      result.current.toggleFolderSelection("folder-1")
    })
    act(() => result.current.toggleSelectMode())
    expect(result.current.selectMode).toBe(false)
    expect(result.current.selectedCategories).toEqual([])
    expect(result.current.selectedFolderIds).toEqual([])
  })

  it("selects all provided lists and folders", () => {
    const { result } = renderHook(() => useListsSelection())
    act(() => result.current.selectAll(["list-1", "list-2"], ["folder-1"]))
    expect(result.current.selectedCategories).toEqual(["list-1", "list-2"])
    expect(result.current.selectedFolderIds).toEqual(["folder-1"])
    act(() => result.current.clearSelection())
    expect(result.current.selectedCategories).toEqual([])
    expect(result.current.selectedFolderIds).toEqual([])
  })
})
