import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  LAST_PERSIST_OK_KEY,
  cogsStateStorage,
  createCogsJSONStorage,
  getPersistStatus,
  isQuotaExceededError,
  persistErrorMessage,
  resetPersistStatus,
  pickPersistItem,
} from "@/lib/persist-storage"

function quotaError(): DOMException {
  return new DOMException("The quota has been exceeded.", "QuotaExceededError")
}

describe("persist-storage", () => {
  beforeEach(() => {
    localStorage.clear()
    resetPersistStatus()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetPersistStatus()
  })

  it("detects QuotaExceededError", () => {
    expect(isQuotaExceededError(quotaError())).toBe(true)
    expect(isQuotaExceededError({ name: "QuotaExceededError", code: 22 })).toBe(true)
    expect(isQuotaExceededError(new Error("nope"))).toBe(false)
    expect(persistErrorMessage(quotaError())).toMatch(/Storage is full/)
  })

  it("records success and writes last-ok timestamp", () => {
    const storage = cogsStateStorage()
    storage.setItem("cogs-task-storage", '{"state":{}}')
    const status = getPersistStatus()
    expect(status.ok).toBe(true)
    expect(status.lastOkAt).toBeTruthy()
    expect(localStorage.getItem(LAST_PERSIST_OK_KEY)).toBe(status.lastOkAt)
    expect(localStorage.getItem("cogs-task-storage")).toBe('{"state":{}}')
  })

  it("does not throw on quota and leaves prior disk state intact", () => {
    localStorage.setItem("cogs-task-storage", "old")
    const storage = cogsStateStorage()
    const original = Storage.prototype.setItem
    vi.spyOn(localStorage, "setItem").mockImplementation((key: string) => {
      if (key === LAST_PERSIST_OK_KEY) return original.call(localStorage, key, "")
      throw quotaError()
    })
    expect(() => storage.setItem("cogs-task-storage", "new")).not.toThrow()
    expect(localStorage.getItem("cogs-task-storage")).toBe("old")
    const status = getPersistStatus()
    expect(status.ok).toBe(false)
    expect(status.quotaExceeded).toBe(true)
    expect(status.error).toMatch(/Storage is full/)
  })

  it("createCogsJSONStorage round-trips JSON and reports stringify failures", async () => {
    const persistStorage = createCogsJSONStorage()
    await persistStorage.setItem("cogs-theme-store", { state: { colors: { a: 1 } }, version: 1 })
    const loaded = await persistStorage.getItem("cogs-theme-store")
    expect(loaded?.state).toEqual({ colors: { a: 1 } })
    expect(getPersistStatus().ok).toBe(true)
  })

  it("does not call the persist hub during tests", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const storage = cogsStateStorage()
    expect(storage.getItem("cogs-task-storage")).toBeNull()
    storage.setItem("cogs-task-storage", '{"state":{}}')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("prefers this profile's local snapshot over a hub value", () => {
    expect(pickPersistItem('{"state":{"tasks":[]}}', '{"state":{"stale":true}}')).toBe('{"state":{"tasks":[]}}')
    expect(pickPersistItem(null, '{"state":{"fromHub":true}}')).toBe('{"state":{"fromHub":true}}')
    expect(pickPersistItem(null, undefined)).toBeNull()
  })
})
