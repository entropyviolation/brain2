import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  LAST_PERSIST_OK_KEY,
  PERSIST_SEED_MAX_RECORDS,
  cogsStateStorage,
  createCogsJSONStorage,
  getPersistStatus,
  isQuotaExceededError,
  persistErrorMessage,
  persistKeyFailed,
  resetPersistStatus,
  pickPersistItem,
  choosePersistSnapshot,
  shouldAwaitPersistHub,
  wroteWhileHubLoaded,
  staleAgainstLocalVault,
} from "@/lib/persist-storage"
import { nextAppearanceRev } from "@/lib/appearance-rev"

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

  it("keeps a failed vault flagged while another vault saves fine", () => {
    const storage = cogsStateStorage()
    const original = Storage.prototype.setItem
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((key: string, value: string) => {
      if (key.endsWith("tracking-day-notes")) throw quotaError()
      return original.call(localStorage, key, value)
    })
    storage.setItem("brain2-tracking-day-notes", '{"2026-09-21":"jot"}')
    expect(persistKeyFailed("brain2-tracking-day-notes")).toBe(true)
    spy.mockRestore()
    storage.setItem("cogs-theme-store", '{"state":{}}')
    expect(persistKeyFailed("brain2-tracking-day-notes")).toBe(true)
    expect(getPersistStatus().ok).toBe(false)
    storage.setItem("brain2-tracking-day-notes", '{"2026-09-21":"jot"}')
    expect(persistKeyFailed("brain2-tracking-day-notes")).toBe(false)
    expect(getPersistStatus().ok).toBe(true)
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

  it("replaces a seed-sized local lists snapshot with a richer hub vault", () => {
    const seed = JSON.stringify({ state: { tasks: Array.from({ length: 15 }, (_, i) => ({ id: String(i) })) } })
    const vault = JSON.stringify({ state: { tasks: Array.from({ length: 2455 }, (_, i) => ({ id: String(i) })) } })
    expect(pickPersistItem(seed, vault, "cogs-task-storage")).toBe(vault)
    expect(pickPersistItem(vault, seed, "cogs-task-storage")).toBe(vault)
  })

  it("does not wait on the persist hub when this profile already has a rich snapshot", () => {
    expect(shouldAwaitPersistHub("cogs-habits-store", null)).toBe(true)
    const seedHabits = JSON.stringify({
      state: { tasks: Array.from({ length: 15 }, (_, i) => ({ id: String(i) })), weeklyData: {} },
    })
    expect(shouldAwaitPersistHub("cogs-habits-store", seedHabits)).toBe(true)
    const liveHabits = JSON.stringify({
      state: {
        tasks: Array.from({ length: 30 }, (_, i) => ({ id: String(i) })),
        weeklyData: Object.fromEntries(Array.from({ length: 47 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, "0")}`, {}])),
      },
    })
    expect(shouldAwaitPersistHub("cogs-habits-store", liveHabits)).toBe(false)
    const liveLists = JSON.stringify({
      state: { tasks: Array.from({ length: PERSIST_SEED_MAX_RECORDS + 1 }, (_, i) => ({ id: String(i) })) },
    })
    expect(shouldAwaitPersistHub("cogs-task-storage", liveLists)).toBe(false)
    const oneNote = JSON.stringify({ "2026-09-21": "typed just now" })
    expect(shouldAwaitPersistHub("cogs-tracking-day-notes", oneNote)).toBe(false)
    expect(shouldAwaitPersistHub("brain2-tracking-day-notes", oneNote)).toBe(false)
    expect(shouldAwaitPersistHub("cogs-tracking-day-notes", null)).toBe(true)
    expect(shouldAwaitPersistHub("monthPlan-2026-09", "")).toBe(true)
    expect(cogsStateStorage().getItem("monthPlan-2026-09")).toBeNull()
    localStorage.setItem("monthPlan-2026-09", "")
    expect(cogsStateStorage().getItem("monthPlan-2026-09")).toBeNull()
  })

  it("does not rewrite localStorage or the hub when the payload is unchanged", () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)
    const storage = cogsStateStorage()
    const payload = '{"state":{"entries":[1,2,3]}}'
    localStorage.setItem("cogs-timegrid-store", payload)
    const setSpy = vi.spyOn(Storage.prototype, "setItem")
    storage.setItem("cogs-timegrid-store", payload)
    expect(setSpy).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("merges a late hub vault from the fresh disk snapshot, not the getItem-start copy", () => {
    const stale = JSON.stringify({
      state: {
        tasks: Array.from({ length: 15 }, (_, i) => ({ id: `h${i}` })),
        weeklyData: { "2026-09-01": {} },
        percentLedTint: "#49ff6a",
        appearanceRev: 0,
      },
      version: 15,
    })
    const fresh = JSON.stringify({
      state: {
        tasks: Array.from({ length: 15 }, (_, i) => ({ id: `h${i}` })),
        weeklyData: { "2026-09-01": {} },
        percentLedTint: "#ff00aa",
        appearanceRev: 2,
      },
      version: 15,
    })
    const hub = JSON.stringify({
      state: {
        tasks: Array.from({ length: 30 }, (_, i) => ({ id: `h${i}` })),
        weeklyData: Object.fromEntries(
          Array.from({ length: 47 }, (_, i) => [`2026-08-${String(i + 1).padStart(2, "0")}`, {}]),
        ),
        percentLedTint: "#00b8ff",
        appearanceRev: 0,
      },
      version: 15,
    })
    localStorage.setItem("cogs-habits-store", fresh)
    const picked = JSON.parse(choosePersistSnapshot("cogs-habits-store", stale, hub) ?? "{}") as {
      state?: { percentLedTint?: string; tasks?: unknown[]; appearanceRev?: number }
    }
    expect(picked.state?.tasks).toHaveLength(30)
    expect(picked.state?.percentLedTint).toBe("#ff00aa")
    expect(picked.state?.appearanceRev).toBe(2)
  })

  it("keeps rows typed while the hub GET was in flight", () => {
    const atGetItem = JSON.stringify({ state: { entries: [{ id: "a" }, { id: "b" }] } })
    const painted = atGetItem
    // Tracking blocks entered during the round-trip: this profile is ahead of
    // both the snapshot we started from and the hub copy that just arrived.
    const typedSince = JSON.stringify({ state: { entries: [{ id: "a" }, { id: "b" }, { id: "c" }] } })
    expect(wroteWhileHubLoaded(typedSince, atGetItem, painted)).toBe(true)
    // Nothing written since: the hub is free to fill a seed or a missing key.
    expect(wroteWhileHubLoaded(atGetItem, atGetItem, painted)).toBe(false)
    expect(wroteWhileHubLoaded(painted, null, painted)).toBe(false)
    expect(wroteWhileHubLoaded(null, atGetItem, painted)).toBe(false)
  })

  it("does not send a vault the disk copy has already outgrown", () => {
    const rows = (n: number) =>
      JSON.stringify({ state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) } })
    // The popout rehydrated an older snapshot; the main window is at 212.
    expect(staleAgainstLocalVault("cogs-timegrid-store", rows(173), rows(212))).toBe(true)
    expect(staleAgainstLocalVault("cogs-timegrid-store", rows(212), rows(173))).toBe(false)
    expect(staleAgainstLocalVault("cogs-timegrid-store", rows(212), rows(212))).toBe(false)
    expect(staleAgainstLocalVault("cogs-timegrid-store", rows(1), null)).toBe(false)
    // A delete in this window: nothing richer on disk, so it still goes out.
    expect(staleAgainstLocalVault("cogs-theme-store", '{"state":{"pcbMode":"mint"}}', '{"state":{}}')).toBe(false)
  })

  it("does not persist ceramic defaults over a saved PCB plate", () => {
    const saved = JSON.stringify({
      state: { pcbMode: "xray", chromeFace: 40, appearanceRev: 2 },
      version: 3,
    })
    localStorage.setItem("cogs-theme-store", saved)
    const storage = cogsStateStorage()
    storage.setItem(
      "cogs-theme-store",
      JSON.stringify({
        state: { pcbMode: "ceramic", chromeFace: 50, appearanceRev: 0 },
        version: 3,
      }),
    )
    expect(localStorage.getItem("cogs-theme-store")).toBe(saved)
  })

  it("does not persist seed teal over a saved PCB plate", () => {
    const saved = JSON.stringify({
      state: { pcbMode: "xray", chromeFace: 40, appearanceRev: 2 },
      version: 4,
    })
    localStorage.setItem("cogs-theme-store", saved)
    const storage = cogsStateStorage()
    storage.setItem(
      "cogs-theme-store",
      JSON.stringify({
        state: { pcbMode: "teal", chromeFace: 50, appearanceRev: 0 },
        version: 4,
      }),
    )
    expect(localStorage.getItem("cogs-theme-store")).toBe(saved)
  })

  it("persists a plate picked before hydrate stamped the store", () => {
    const saved = JSON.stringify({
      state: { pcbMode: "xray", chromeFace: 40, appearanceRev: 6 },
      version: 4,
    })
    localStorage.setItem("cogs-theme-store", saved)
    const storage = cogsStateStorage()
    const picked = JSON.stringify({
      state: { pcbMode: "ceramic", chromeFace: 40, appearanceRev: nextAppearanceRev(0) },
      version: 4,
    })
    storage.setItem("cogs-theme-store", picked)
    expect(localStorage.getItem("cogs-theme-store")).toBe(picked)
  })

  it("persists a new LED tint even when the pin still has the old purple", () => {
    localStorage.setItem("cogs-habit-led-tint", "#7e14ff")
    const previous = JSON.stringify({
      state: {
        tasks: Array.from({ length: 30 }, (_, i) => ({ id: String(i) })),
        weeklyData: { "2026-09-01": {} },
        percentLedTint: "#7e14ff",
        appearanceRev: 1,
      },
      version: 15,
    })
    localStorage.setItem("cogs-habits-store", previous)
    const storage = cogsStateStorage()
    const next = JSON.stringify({
      state: {
        tasks: Array.from({ length: 30 }, (_, i) => ({ id: String(i) })),
        weeklyData: { "2026-09-01": {} },
        percentLedTint: "#00cc88",
        appearanceRev: 2,
      },
      version: 15,
    })
    storage.setItem("cogs-habits-store", next)
    const stored = JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}") as {
      state?: { percentLedTint?: string }
    }
    expect(stored.state?.percentLedTint).toBe("#00cc88")
    expect(localStorage.getItem("cogs-habit-led-tint")).toBe("#00cc88")
  })

  it("refuses a habits write that rolls titles back to an older contentRev", () => {
    const saved = JSON.stringify({
      state: {
        tasks: [{ id: "h1", name: "fold shirts" }],
        weeklyData: { "2026-09-02": { h1: { value: 4 } } },
        contentRev: 80,
      },
      version: 19,
    })
    localStorage.setItem("cogs-habits-store", saved)
    const storage = cogsStateStorage()
    storage.setItem(
      "cogs-habits-store",
      JSON.stringify({
        state: {
          tasks: [{ id: "h1", name: "laundry" }],
          weeklyData: {},
          contentRev: 4,
        },
        version: 19,
      }),
    )
    const stored = JSON.parse(localStorage.getItem("cogs-habits-store") ?? "{}") as {
      state?: { tasks?: { name?: string }[]; weeklyData?: Record<string, { h1?: { value?: number } }> }
    }
    expect(stored.state?.tasks?.[0]?.name).toBe("fold shirts")
    expect(stored.state?.weeklyData?.["2026-09-02"]?.h1?.value).toBe(4)
  })

  it("unions a Telegram Inbox id into a stale task write instead of dropping it", () => {
    const hub = JSON.stringify({
      state: {
        tasks: [
          { id: "old", stage: "next", createdAt: "2026-09-01T00:00:00.000Z" },
          { id: "tg-inbox", stage: "inbox", createdAt: "2026-09-22T08:00:00.000Z" },
        ],
        lists: [],
        folders: [],
      },
      version: 12,
    })
    localStorage.setItem("brain2-task-storage", hub)
    const storage = cogsStateStorage()
    storage.setItem(
      "brain2-task-storage",
      JSON.stringify({
        state: {
          tasks: [{ id: "old", stage: "next", createdAt: "2026-09-01T00:00:00.000Z" }],
          lists: [],
          folders: [],
        },
        version: 12,
      }),
    )
    const stored = JSON.parse(localStorage.getItem("brain2-task-storage") ?? "{}") as {
      state?: { tasks?: { id: string }[] }
    }
    expect(stored.state?.tasks?.map((task) => task.id).sort()).toEqual(["old", "tg-inbox"])
    expect(getPersistStatus().ok).toBe(true)
  })
})
