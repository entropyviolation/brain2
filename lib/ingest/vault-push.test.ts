import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchPhoneHubStatus, HUB_OFFLINE_BACKOFF_MS, pushVaultToHubIfChanged, resetHubOfflineBackoff, resetVaultPushStamps } from "./vault-push"

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

describe("pushVaultToHubIfChanged", () => {
  beforeEach(() => {
    resetVaultPushStamps()
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("sends the vault only when a save landed since the last push", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" })
    vi.stubGlobal("fetch", fetchMock)
    localStorage.setItem("brain2-task-storage", '{"state":{"tasks":[]}}')
    localStorage.setItem("brain2-last-persist-ok", "2026-11-11T10:00:00.000Z")
    expect((await pushVaultToHubIfChanged("http://127.0.0.1:8787")).skipped).toBeUndefined()
    expect((await pushVaultToHubIfChanged("http://127.0.0.1:8787")).skipped).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    localStorage.setItem("brain2-last-persist-ok", "2026-11-11T10:01:00.000Z")
    await pushVaultToHubIfChanged("http://127.0.0.1:8787")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
