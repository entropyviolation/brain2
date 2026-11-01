import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchPhoneHubStatus, HUB_OFFLINE_BACKOFF_MS, resetHubOfflineBackoff } from "./vault-push"

describe("fetchPhoneHubStatus backoff", () => {
  beforeEach(() => {
    resetHubOfflineBackoff()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("does not ask a refused hub again until the backoff ends", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    vi.stubGlobal("fetch", fetchMock)
    expect((await fetchPhoneHubStatus("http://127.0.0.1:8787")).ok).toBe(false)
    expect((await fetchPhoneHubStatus("http://127.0.0.1:8787")).ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(HUB_OFFLINE_BACKOFF_MS + 1)
    await fetchPhoneHubStatus("http://127.0.0.1:8787")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
