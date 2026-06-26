import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, beforeEach } from "vitest"
import { useListsNavigation } from "../useListsNavigation"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { APP_NAV_KEYS } from "@/lib/app-navigation"

describe("useListsNavigation", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
  })

  it("initializes with 'home' location", () => {
    const { result } = renderHook(() => useListsNavigation([], []))
    expect(result.current.location).toBe("home")
  })

  it("restores location and open target from localStorage", () => {
    localStorage.setItem(
      APP_NAV_KEYS.listsNav,
      JSON.stringify({
        location: "folder-123",
        openTarget: { type: "category", id: "list-456" },
      }),
    )
    const categories = [{ id: "list-456", name: "Test", color: "#000", description: "", createdAt: new Date(), order: 0 }]
    const folders = [{ id: "folder-123", name: "Work", createdAt: new Date(), listIds: [] }]
    const { result } = renderHook(() => useListsNavigation(categories, folders))
    expect(result.current.location).toBe("folder-123")
    expect(result.current.openTarget).toEqual({ type: "category", id: "list-456" })
  })

  it("persists navigation changes to localStorage", () => {
    const categories = [{ id: "list-456", name: "Test", color: "#000", description: "", createdAt: new Date(), order: 0 }]
    const { result } = renderHook(() => useListsNavigation(categories, []))
    act(() => {
      result.current.navigateToFolder("all")
      result.current.openList("list-456")
    })
    expect(JSON.parse(localStorage.getItem(APP_NAV_KEYS.listsNav)!)).toEqual({
      location: "all",
      openTarget: { type: "category", id: "list-456" },
    })
  })

  it("navigates to a folder", () => {
    const { result } = renderHook(() => useListsNavigation([], [{ id: "folder-123", name: "Work", createdAt: new Date(), listIds: [] }]))
    act(() => result.current.navigateToFolder("folder-123"))
    expect(result.current.location).toBe("folder-123")
  })

  it("opens and closes a target", () => {
    const categories = [{ id: "list-456", name: "Test", color: "#000", description: "", createdAt: new Date(), order: 0 }]
    const { result } = renderHook(() => useListsNavigation(categories, []))
    act(() => result.current.openList("list-456"))
    expect(result.current.openTarget).toEqual({ type: "category", id: "list-456" })
    act(() => result.current.closeTarget())
    expect(result.current.openTarget).toBeNull()
  })

  it("clears open target when navigating", () => {
    const { result } = renderHook(() => useListsNavigation([], []))
    act(() => result.current.openList("list-1"))
    act(() => result.current.navTo("all"))
    expect(result.current.openTarget).toBeNull()
    expect(result.current.location).toBe("all")
  })

  it("keeps the global All Items view open (does not auto-close root all)", () => {
    const { result } = renderHook(() => useListsNavigation([], []))
    act(() => {
      result.current.navTo("all")
      result.current.openFolderAll("__root__")
    })
    expect(result.current.openTarget).toEqual({ type: "folder-all", folderId: "__root__" })
  })
})
