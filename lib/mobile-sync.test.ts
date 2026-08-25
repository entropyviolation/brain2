import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MOBILE_SYNC_DEFAULT_URL,
  fetchMobileSyncStatus,
  guessMobileSyncUrl,
  pullMobileSyncBackup,
  pushMobileSyncBackup,
  readMobileSyncUrl,
  writeMobileSyncUrl,
} from "@/lib/mobile-sync"
import type { Backup } from "@/lib/data/backup"

const sampleBackup: Backup = {
  app: "cogs",
  version: 1,
  exportedAt: "2026-07-22T00:00:00.000Z",
  stores: {},
  planText: {},
}

describe("mobile-sync", () => {
  afterEach(() => {
    localStorage.removeItem("cogs-mobile-sync-url")
    vi.unstubAllGlobals()
  })

  it("uses same origin on http pages", () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "192.168.0.150",
      origin: "http://192.168.0.150:3002",
    })
    expect(guessMobileSyncUrl()).toBe("http://192.168.0.150:3002")
    expect(readMobileSyncUrl()).toBe("http://192.168.0.150:3002")
  })

  it("persists explicit overrides for non-http shells", () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
    })
    writeMobileSyncUrl("http://192.168.1.10:3847/")
    expect(readMobileSyncUrl()).toBe("http://192.168.1.10:3847")
  })

  it("defaults loopback when no window host", () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
    })
    expect(guessMobileSyncUrl()).toBe(MOBILE_SYNC_DEFAULT_URL)
  })

  it("fetches status with basic auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, hasData: false, updatedAt: null, exportedAt: null }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const status = await fetchMobileSyncStatus("http://example.test:3847")
    expect(status.hasData).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.test:3847/api/sync/status",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${btoa("admin:admin")}`,
        }),
      }),
    )
  })

  it("pulls and validates backup payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, backup: sampleBackup, updatedAt: "t" }),
      }),
    )
    const result = await pullMobileSyncBackup("http://example.test:3847")
    expect(result.backup?.app).toBe("cogs")
  })

  it("pushes backup json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, updatedAt: "t" }),
    })
    vi.stubGlobal("fetch", fetchMock)
    await pushMobileSyncBackup("http://example.test:3847", "admin", "admin", sampleBackup)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.test:3847/api/sync/push",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
