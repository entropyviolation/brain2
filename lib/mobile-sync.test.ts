import { afterEach, describe, expect, it, vi } from "vitest"
import {
  MOBILE_SYNC_DEFAULT_URL,
  backupTaskCount,
  deviceNeedsPhoneHubPull,
  fetchMobileSyncStatus,
  guessMobileSyncUrl,
  pullAndRestoreMobileSync,
  pullMobileSyncBackup,
  reclaimPhonePullStorage,
  pullShrinksDevice,
  phoneHubCandidates,
  preferBundledHub,
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
    localStorage.removeItem("brain2-mobile-sync-url")
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

  it("uses a bundled LAN hub when the native shell only has loopback", () => {
    expect(preferBundledHub("http://127.0.0.1:3000", "http://192.168.0.150:3000/", false)).toBe(
      "http://192.168.0.150:3000",
    )
    expect(preferBundledHub("http://192.168.0.150:3000", "http://10.0.0.2:3000", false)).toBeNull()
    expect(preferBundledHub("http://127.0.0.1:3000", "http://192.168.0.150:3000", true)).toBeNull()
  })

  it("ignores a saved loopback port 3847", () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
    })
    writeMobileSyncUrl("http://127.0.0.1:3847")
    expect(readMobileSyncUrl()).toBe("http://127.0.0.1:3000")
  })

  it("uses the baked LAN hub on a native shell and keeps a saved address ahead of it", async () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
    })
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.cache).toBeUndefined()
      return { ok: true, json: async () => ({ url: "http://192.168.0.150:3000/" }) }
    })
    vi.stubGlobal("fetch", fetchMock)
    await expect(phoneHubCandidates()).resolves.toEqual(["http://192.168.0.150:3000"])
    expect(readMobileSyncUrl()).toBe("http://192.168.0.150:3000")

    writeMobileSyncUrl("http://10.0.0.9:3000")
    await expect(phoneHubCandidates()).resolves.toEqual(["http://10.0.0.9:3000", "http://192.168.0.150:3000"])
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

  it("counts tasks on either persist name", () => {
    expect(backupTaskCount({ ...sampleBackup, stores: { "brain2-task-storage": { state: { tasks: [{}, {}] } } } })).toBe(2)
    expect(backupTaskCount({ ...sampleBackup, stores: { "cogs-task-storage": { state: { tasks: [{}] } } } })).toBe(1)
  })

  it("refuses a pull that would shrink this device", () => {
    const thin = {
      ...sampleBackup,
      stores: { "cogs-task-storage": { state: { tasks: Array.from({ length: 10 }, () => ({})) } } },
    }
    expect(pullShrinksDevice(thin, 12097)).toMatch(/Refusing pull/)
    expect(pullShrinksDevice(thin, 0)).toBeNull()
  })

  it("treats the iOS shell and an iPhone as a phone-sized pull", () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
      pathname: "/",
    })
    expect(deviceNeedsPhoneHubPull()).toBe(true)
    vi.stubGlobal("location", {
      protocol: "https:",
      hostname: "mac.local",
      origin: "https://mac.local",
      pathname: "/",
    })
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })
    expect(deviceNeedsPhoneHubPull()).toBe(true)
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh)" })
    expect(deviceNeedsPhoneHubPull()).toBe(false)
  })

  it("clears leftover vault keys and keeps the phone's NFC map", () => {
    localStorage.setItem("brain2-item-activity", "x".repeat(200))
    localStorage.setItem("brain2-nfc-chips", "{\"04\":\"door\"}")
    localStorage.setItem("brain2-task-storage", "old")
    expect(reclaimPhonePullStorage(["brain2-task-storage"])).toBeGreaterThan(0)
    expect(localStorage.getItem("brain2-item-activity")).toBeNull()
    expect(localStorage.getItem("brain2-nfc-chips")).toBe("{\"04\":\"door\"}")
    expect(localStorage.getItem("brain2-task-storage")).toBe("old")
  })

  it("on the iOS shell, a force pull writes the phone copy into a cleared box", async () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      origin: "capacitor://localhost",
      pathname: "/",
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        updatedAt: "t",
        backup: {
          app: "brain2",
          version: 1,
          exportedAt: "2026-10-28T00:00:00.000Z",
          stores: {
            "brain2-task-storage": {
              state: {
                tasks: [{ id: "a", title: "Milk", description: "Milk", attributes: { note: "long" }, lists: ["groceries"] }],
                lists: [],
              },
            },
            "brain2-telegram-feed": { state: { posts: [1] } },
          },
          planText: {},
          attachments: { a: { name: "a.png", mime: "image/png", dataUrl: "data:image/png,xx" } },
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    localStorage.setItem("brain2-item-activity", "x".repeat(200))
    localStorage.setItem("brain2-nfc-chips", "{\"04\":\"door\"}")
    const result = await pullAndRestoreMobileSync("http://example.test:3000", "admin", "admin", true)
    expect(fetchMock.mock.calls[0][0]).toBe("http://example.test:3000/api/sync/pull")
    expect(result.restored).toBe(true)
    const stored = JSON.parse(localStorage.getItem("brain2-task-storage") ?? "{}") as {
      state: { tasks: { title?: string; attributes?: unknown; lists?: string[] }[] }
    }
    expect(stored.state.tasks[0].title).toBe("Milk")
    expect(stored.state.tasks[0].attributes).toBeUndefined()
    expect(stored.state.tasks[0].lists).toEqual(["groceries"])
    expect(localStorage.getItem("brain2-item-activity")).toBeNull()
    expect(localStorage.getItem("brain2-nfc-chips")).toBe("{\"04\":\"door\"}")
  })

  it("on the desktop, a force pull still asks for the full snapshot", async () => {
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "127.0.0.1",
      origin: "http://127.0.0.1:3000",
      pathname: "/",
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        updatedAt: "t",
        backup: {
          app: "brain2",
          version: 1,
          exportedAt: "2026-10-28T00:00:00.000Z",
          stores: { "brain2-task-storage": { state: { tasks: [{ id: "a", title: "Desk" }], lists: [] } } },
          planText: {},
        },
      }),
    })
    vi.stubGlobal("fetch", fetchMock)
    localStorage.setItem("brain2-item-activity", "keep")
    await pullAndRestoreMobileSync("http://example.test:3000", "admin", "admin", true)
    expect(fetchMock.mock.calls[0][0]).toBe("http://example.test:3000/api/sync/pull?full=1")
    expect(localStorage.getItem("brain2-item-activity")).toBe("keep")
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
