/**
 * hooks/use-screentime-sync.test.ts — Poll, focus, and missing ActivityWatch
 */
import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetScreenTimeSyncSessionForTests, useScreenTimeSync } from "./use-screentime-sync"

const syncScreenTime = vi.fn(async () => ({ ok: true, days: 0, blocks: 0 }))

vi.mock("@/lib/screentime/sync", () => ({
  syncScreenTime: (...args: unknown[]) => syncScreenTime(...args),
}))

vi.mock("@/lib/screentime/prefs", () => ({
  loadScreenTimePrefs: () => ({
    url: "http://127.0.0.1:5600",
    lookbackDays: 14,
    minDurationSec: 15,
    storeWindowTitles: false,
  }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  syncScreenTime.mockReset()
  syncScreenTime.mockResolvedValue({ ok: true, days: 0, blocks: 0 })
  resetScreenTimeSyncSessionForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useScreenTimeSync", () => {
  it("syncs on mount, on a ~2 minute poll, and on window focus", async () => {
    renderHook(() => useScreenTimeSync())
    await vi.advanceTimersByTimeAsync(0)
    expect(syncScreenTime).toHaveBeenCalledTimes(1)
    expect(syncScreenTime.mock.calls[0][0]).toBeUndefined()

    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    expect(syncScreenTime).toHaveBeenCalledTimes(2)
    expect(syncScreenTime.mock.calls[1][0]).toEqual({ lookbackDays: 2 })

    window.dispatchEvent(new Event("focus"))
    await vi.advanceTimersByTimeAsync(0)
    expect(syncScreenTime).toHaveBeenCalledTimes(3)
    expect(syncScreenTime.mock.calls[2][0]).toEqual({ lookbackDays: 2 })
  })

  it("does not throw when ActivityWatch is gone", async () => {
    syncScreenTime.mockRejectedValue(new Error("ECONNREFUSED"))
    expect(() => renderHook(() => useScreenTimeSync())).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    expect(syncScreenTime).toHaveBeenCalled()
  })
})
