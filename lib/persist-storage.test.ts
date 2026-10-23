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
  hubPostKeys,
  resetPersistWriteCache,
  registerPersistRehydrator,
  mergeHubIntoStores,
  createHubFocusPull,
  hubRefusedSave,
} from "@/lib/persist-storage"
import { nextAppearanceRev } from "@/lib/appearance-rev"

function quotaError(): DOMException {
  return new DOMException("The quota has been exceeded.", "QuotaExceededError")
}

describe("persist-storage", () => {
  beforeEach(() => {
    localStorage.clear()
    resetPersistStatus()
    resetPersistWriteCache()
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
    const monthLog = JSON.stringify({
      v: 1,
      entries: [{ id: "al_oct", createdAt: "2026-10-06T20:26:00.000Z", text: "already on this profile" }],
    })
    expect(shouldAwaitPersistHub("monthPlan-2026-10", monthLog)).toBe(true)
    expect(shouldAwaitPersistHub("brain2-monthPlan-2026-10", monthLog)).toBe(true)
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
    localStorage.setItem("cogs-habit-led-tint", "#7d6bb8")
    const previous = JSON.stringify({
      state: {
        tasks: Array.from({ length: 30 }, (_, i) => ({ id: String(i) })),
        weeklyData: { "2026-09-01": {} },
        percentLedTint: "#7d6bb8",
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
  describe("one parse per setItem", () => {
    const taskBlob = (ids: string[]) =>
      JSON.stringify({
        state: { tasks: ids.map((id) => ({ id, stage: "next", createdAt: "2026-09-01T00:00:00.000Z" })), lists: [], folders: [] },
        version: 12,
      })
    const ids = (key: string) =>
      (JSON.parse(localStorage.getItem(key) ?? "{}") as { state: { tasks: { id: string }[] } }).state.tasks
        .map((t) => t.id)
        .sort()

    it("parses an unguarded vault zero times", () => {
      const spy = vi.spyOn(JSON, "parse")
      cogsStateStorage().setItem("brain2-sleep-store", '{"state":{"a":1}}')
      cogsStateStorage().setItem("brain2-sleep-store", '{"state":{"a":2}}')
      const sleepParses = spy.mock.calls.filter(([text]) => String(text).includes('"a"'))
      expect(sleepParses).toHaveLength(0)
    })

    it("parses a task edit's incoming blob once when this tab wrote the stored copy", () => {
      const storage = cogsStateStorage()
      storage.setItem("brain2-task-storage", taskBlob(["a", "b"]))
      const next = taskBlob(["a", "b", "c"])
      const spy = vi.spyOn(JSON, "parse")
      storage.setItem("brain2-task-storage", next)
      const taskParses = spy.mock.calls.filter(([text]) => String(text).includes('"tasks"'))
      expect(taskParses).toHaveLength(1)
      expect(ids("brain2-task-storage")).toEqual(["a", "b", "c"])
    })

    it("still unions when another writer changed the key under this tab", () => {
      const storage = cogsStateStorage()
      storage.setItem("brain2-task-storage", taskBlob(["a", "b"]))
      // Another window adds "z" straight to disk.
      localStorage.setItem("brain2-task-storage", taskBlob(["a", "b", "z"]))
      storage.setItem("brain2-task-storage", taskBlob(["a", "b", "c"]))
      expect(ids("brain2-task-storage")).toEqual(["a", "b", "c", "z"])
    })

    it("still unions when the record count dropped, even if this tab wrote the stored copy", () => {
      const storage = cogsStateStorage()
      storage.setItem("brain2-task-storage", taskBlob(["a", "b", "c"]))
      // A stale rehydrate writes two rows with no tombstone for "c".
      storage.setItem("brain2-task-storage", taskBlob(["a", "b"]))
      expect(ids("brain2-task-storage")).toEqual(["a", "b", "c"])
    })

    it("still refuses a habits write older than the stored contentRev", () => {
      const storage = cogsStateStorage()
      const habits = (contentRev: number, title: string) =>
        JSON.stringify({ state: { contentRev, habits: [{ id: "h", title }] }, version: 1 })
      storage.setItem("brain2-habits-store", habits(5, "new"))
      storage.setItem("brain2-habits-store", habits(3, "old"))
      expect(localStorage.getItem("brain2-habits-store")).toBe(habits(5, "new"))
    })
  })

  describe("hubPostKeys", () => {
    it("sends one POST key for a prefixed vault, whichever prefix the store used", () => {
      expect(hubPostKeys("brain2-task-storage")).toEqual(["brain2-task-storage"])
      expect(hubPostKeys("cogs-task-storage")).toEqual(["brain2-task-storage"])
    })

    it("keeps a separate key for a bare plan-text vault the hub does not twin", () => {
      const keys = hubPostKeys("monthPlan-2026-10")
      expect(keys).toEqual(["monthPlan-2026-10", "brain2-monthPlan-2026-10"])
    })
  })

  describe("hub follow (rows another writer added)", () => {
    const KEY = "brain2-timegrid-store"
    const row = (id: string, extra: Record<string, unknown> = {}) => ({
      id,
      date: "2026-10-21",
      scopeId: "iphone-texts",
      penId: "iphone-text-a",
      startMin: 600,
      endMin: 600,
      kind: "instant",
      ...extra,
    })
    const blob = (entries: unknown[]) =>
      JSON.stringify({ state: { scopes: [], tags: [], entries, removedEntryIds: [] }, version: 1 })
    const ids = (value: string | null) => (JSON.parse(value ?? "{}").state?.entries ?? []).map((e: { id: string }) => e.id).sort()

    it("merges hub rows into a running store and keeps this profile's own", async () => {
      localStorage.setItem(KEY, blob([row("mine")]))
      const rehydrate = vi.fn()
      registerPersistRehydrator(KEY, rehydrate)
      const hub = { items: { [KEY]: blob([row("mine"), row("phone-1", { generatedBy: { kind: "phone-sync", id: "messages:1" } })]) } }
      const changed = await mergeHubIntoStores(hub)
      expect(changed).toContain(KEY)
      expect(ids(localStorage.getItem(KEY))).toEqual(["mine", "phone-1"])
      expect(rehydrate).toHaveBeenCalledTimes(1)
    })

    it("keeps a block painted here that the hub does not have yet", async () => {
      localStorage.setItem(KEY, blob([row("painted-here"), row("old")]))
      registerPersistRehydrator(KEY, vi.fn())
      await mergeHubIntoStores({ items: { [KEY]: blob([row("old"), row("phone-2")]) } })
      expect(ids(localStorage.getItem(KEY))).toEqual(["old", "painted-here", "phone-2"])
    })

    it("does nothing when the hub has nothing new", async () => {
      localStorage.setItem(KEY, blob([row("a")]))
      const rehydrate = vi.fn()
      registerPersistRehydrator(KEY, rehydrate)
      expect(await mergeHubIntoStores({ items: { [KEY]: blob([row("a")]) } })).toEqual([])
      expect(rehydrate).not.toHaveBeenCalled()
    })

    it("treats only a shrink as a refused save", () => {
      expect(hubRefusedSave({ ok: true, skipped: "shrink" })).toBe(true)
      expect(hubRefusedSave({ ok: true, skipped: false })).toBe(false)
      expect(hubRefusedSave({ ok: true, skipped: "friend-pic" })).toBe(false)
      expect(hubRefusedSave(null)).toBe(false)
    })

    it("pulls on focus at most once per window", () => {
      let t = 0
      const pull = vi.fn()
      const onFocus = createHubFocusPull(pull, 10_000, () => t)
      expect(onFocus()).toBe(true)
      t = 5_000
      expect(onFocus()).toBe(false)
      t = 10_000
      expect(onFocus()).toBe(true)
      expect(pull).toHaveBeenCalledTimes(2)
    })
  })
})
