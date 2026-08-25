import { describe, expect, it } from "vitest"
import { LIVE_SYNC_DEPRECATED, LIVE_SYNC_ENABLED_KEY, isLiveSyncEnabled, startLiveSync } from "@/lib/live-sync"

describe("live-sync (deprecated)", () => {
  it("stays parked even if localStorage still has the old enable flag", () => {
    expect(LIVE_SYNC_DEPRECATED).toBe(true)
    localStorage.setItem(LIVE_SYNC_ENABLED_KEY, "1")
    expect(isLiveSyncEnabled()).toBe(false)
  })

  it("does not start the poll/push engine", () => {
    const dispose = startLiveSync()
    expect(typeof dispose).toBe("function")
    dispose()
  })
})
