/**
 * screen-location + controller — apply restore and session recording
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { APP_NAV_KEYS, APP_TABS, readStoredId, readStoredTab, writeStoredTab } from "@/lib/app-navigation"
import {
  getScreenHistorySnapshot,
  resetScreenHistoryForTests,
  screenHistoryBack,
  screenHistoryForward,
  seedScreenHistoryIfNeeded,
} from "@/lib/screen-history-controller"
import {
  applyScreenLocation,
  COGS_NAV_RESTORE_EVENT,
  isScreenRestoreInProgress,
  readScreenLocation,
  screenLocationKey,
} from "@/lib/screen-location"
import { resetLocalStorage } from "@/tests/test-utils"

function flushRecords(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve())
}

function waitRestoreSettled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("screen-location", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetScreenHistoryForTests()
  })

  afterEach(() => {
    resetScreenHistoryForTests()
  })

  it("round-trips a screen snapshot through apply", async () => {
    writeStoredTab(APP_NAV_KEYS.appTab, "home")
    writeStoredTab(APP_NAV_KEYS.homeTab, "habits")
    const before = readScreenLocation()
    expect(before.appTab).toBe("home")

    const target = {
      ...before,
      appTab: "docs" as const,
      docsDocId: "doc-1",
      docsFolder: "__all__",
    }
    const restored: string[] = []
    const onRestore = () => restored.push("ok")
    window.addEventListener(COGS_NAV_RESTORE_EVENT, onRestore)

    applyScreenLocation(target)
    expect(isScreenRestoreInProgress()).toBe(true)
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("docs")
    expect(readStoredId(APP_NAV_KEYS.docsDocId)).toBe("doc-1")
    expect(restored).toEqual(["ok"])
    expect(screenLocationKey(readScreenLocation())).toBe(screenLocationKey(target))

    window.removeEventListener(COGS_NAV_RESTORE_EVENT, onRestore)
    await waitRestoreSettled()
    expect(isScreenRestoreInProgress()).toBe(false)
  })
})

describe("screen-history-controller", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetScreenHistoryForTests()
  })

  afterEach(() => {
    resetScreenHistoryForTests()
  })

  it("seeds on first listen and records tab changes", async () => {
    writeStoredTab(APP_NAV_KEYS.appTab, "home")
    seedScreenHistoryIfNeeded()
    expect(getScreenHistorySnapshot().canBack).toBe(false)

    writeStoredTab(APP_NAV_KEYS.appTab, "categories")
    await flushRecords()

    const snap = getScreenHistorySnapshot()
    expect(snap.canBack).toBe(true)
    expect(snap.current?.appTab).toBe("categories")
  })

  it("back restores the previous tab and enables forward", async () => {
    writeStoredTab(APP_NAV_KEYS.appTab, "home")
    seedScreenHistoryIfNeeded()
    writeStoredTab(APP_NAV_KEYS.appTab, "scheduler")
    await flushRecords()

    expect(screenHistoryBack()).toBe(true)
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("home")
    expect(getScreenHistorySnapshot().canForward).toBe(true)

    expect(screenHistoryForward()).toBe(true)
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("scheduler")
    await waitRestoreSettled()
  })

  it("new navigation after back truncates forward", async () => {
    writeStoredTab(APP_NAV_KEYS.appTab, "home")
    seedScreenHistoryIfNeeded()
    writeStoredTab(APP_NAV_KEYS.appTab, "categories")
    await flushRecords()
    writeStoredTab(APP_NAV_KEYS.appTab, "docs")
    await flushRecords()

    screenHistoryBack()
    expect(getScreenHistorySnapshot().canForward).toBe(true)
    await waitRestoreSettled()

    writeStoredTab(APP_NAV_KEYS.appTab, "analytics")
    await flushRecords()

    const snap = getScreenHistorySnapshot()
    expect(snap.canForward).toBe(false)
    expect(snap.current?.appTab).toBe("analytics")
    expect(snap.entries.map((e) => e.appTab)).toEqual(["home", "categories", "analytics"])
  })
})
