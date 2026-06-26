import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  APP_NAV_KEYS,
  APP_TABS,
  readListsNavigation,
  readStoredTab,
  requestNavigateToList,
  writeListsNavigation,
  writeStoredTab,
} from "@/lib/app-navigation"
import { resetLocalStorage } from "@/tests/test-utils"

describe("app-navigation", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("reads and writes top-level tabs", () => {
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("home")
    writeStoredTab(APP_NAV_KEYS.appTab, "categories")
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("categories")
  })

  it("rejects invalid stored tabs", () => {
    localStorage.setItem(APP_NAV_KEYS.appTab, "invalid")
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("home")
  })

  it("reads and writes lists navigation state", () => {
    writeListsNavigation({
      location: "folder-1",
      openTarget: { type: "category", id: "list-1" },
    })
    expect(readListsNavigation()).toEqual({
      location: "folder-1",
      openTarget: { type: "category", id: "list-1" },
    })
  })

  it("falls back when lists navigation JSON is invalid", () => {
    localStorage.setItem(APP_NAV_KEYS.listsNav, "{not json")
    expect(readListsNavigation()).toEqual({ location: "home", openTarget: null })
  })

  it("requestNavigateToList writes navigation and dispatches an event", () => {
    const handler = vi.fn()
    window.addEventListener("cogs-navigate-to-list", handler)
    requestNavigateToList("list-1", [{ id: "folder-1", listIds: ["list-1"] }])
    expect(readListsNavigation()).toEqual({
      location: "folder-1",
      openTarget: { type: "category", id: "list-1" },
    })
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener("cogs-navigate-to-list", handler)
  })
})
