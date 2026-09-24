import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  APP_NAV_KEYS,
  APP_TABS,
  docsScrollSlot,
  readListsNavigation,
  readScrollOffset,
  readStoredDate,
  readStoredId,
  readStoredRecord,
  readStoredTab,
  requestNavigateToList,
  writeListsNavigation,
  writeScrollOffset,
  writeStoredDate,
  writeStoredId,
  writeStoredRecordField,
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

  it("reads and writes optional ids", () => {
    expect(readStoredId(APP_NAV_KEYS.docsDocId)).toBeNull()
    writeStoredId(APP_NAV_KEYS.docsDocId, "doc-1")
    expect(readStoredId(APP_NAV_KEYS.docsDocId)).toBe("doc-1")
    writeStoredId(APP_NAV_KEYS.docsDocId, null)
    expect(readStoredId(APP_NAV_KEYS.docsDocId)).toBeNull()
  })

  it("reads and writes per-id record fields", () => {
    writeStoredRecordField(APP_NAV_KEYS.opsPanel, "op-1", "timeline")
    writeStoredRecordField(APP_NAV_KEYS.opsPanel, "op-2", "log")
    expect(readStoredRecord(APP_NAV_KEYS.opsPanel)).toEqual({
      "op-1": "timeline",
      "op-2": "log",
    })
    writeStoredRecordField(APP_NAV_KEYS.opsPanel, "op-1", null)
    expect(readStoredRecord(APP_NAV_KEYS.opsPanel)).toEqual({ "op-2": "log" })
  })

  it("reads and writes local calendar dates", () => {
    writeStoredDate(APP_NAV_KEYS.homeDate, new Date(2026, 8, 21, 15, 30))
    const restored = readStoredDate(APP_NAV_KEYS.homeDate)
    expect(restored?.getFullYear()).toBe(2026)
    expect(restored?.getMonth()).toBe(8)
    expect(restored?.getDate()).toBe(21)
  })

  it("persists document scroll offsets across a simulated refresh", () => {
    const slot = docsScrollSlot("doc-long")
    writeScrollOffset(slot, 840)
    expect(readScrollOffset(slot)).toBe(840)
    const snap = localStorage.getItem(APP_NAV_KEYS.uiScroll)
    localStorage.clear()
    localStorage.setItem(APP_NAV_KEYS.uiScroll, snap!)
    expect(readScrollOffset(slot)).toBe(840)
    writeScrollOffset(slot, 0)
    expect(readScrollOffset(slot)).toBe(0)
  })
})
