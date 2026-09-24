import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { entryMinutes, type TimeEntry } from "@/lib/time-entries"
import {
  applyScreenTimeEntries,
  describeScreenTimeSync,
  ensureAppPen,
  fetchScreenTime,
  screenTimeLookbackDates,
  screenTimeOngoingDates,
  syncScreenTime,
} from "./sync"
import { loadScreenTimePrefs } from "./prefs"
import type { AwEvent } from "./map-events"

const DATE = "2026-09-21"
const NOW = new Date(2026, 8, 21, 18, 0, 0)

const CATEGORY_PENS: TrackPen[] = [
  { id: "st-cat-work", name: "Work", color: "#2563eb" },
  { id: "st-cat-communication", name: "Communication", color: "#ec4899" },
  { id: "st-cat-browsing", name: "Browsing", color: "#0ea5e9" },
  { id: "st-cat-media", name: "Media", color: "#8b5cf6" },
  { id: "st-cat-system", name: "System", color: "#64748b" },
  { id: "st-cat-other", name: "Other", color: "#f59e0b" },
]

function seedScopes(): void {
  const activity: TrackScope = {
    id: "activity",
    name: "Activity",
    pens: [{ id: "act-work", name: "Work", color: "#2563eb" }],
  }
  const screentime: TrackScope = {
    id: "screentime",
    name: "Screen Time",
    pens: CATEGORY_PENS.map((pen) => ({ ...pen })),
  }
  useTimeTrackingStore.setState({
    scopes: [activity, screentime],
    entries: [],
    activeScopeId: "activity",
  })
}

function at(hour: number, minute: number, second = 0): string {
  return new Date(2026, 8, 21, hour, minute, second).toISOString()
}

function eventsPayload(windowEvents: AwEvent[], afkEvents: AwEvent[], webEvents: AwEvent[] = []) {
  return {
    ok: true as const,
    mode: "events" as const,
    windowEvents,
    afkEvents,
    webEvents,
  }
}

function allDayNotAfk(): AwEvent[] {
  return [{ timestamp: at(0, 0), duration: 24 * 3600, data: { status: "not-afk" } }]
}

beforeEach(() => {
  resetAllStores()
  seedScopes()
})

describe("applyScreenTimeEntries", () => {
  const derived = (overrides: Partial<TimeEntry> = {}): TimeEntry => ({
    id: "st-te-new",
    date: DATE,
    scopeId: "screentime",
    penId: "st-app-cursor",
    startMin: 600,
    endMin: 660,
    generatedBy: { kind: "screentime", id: DATE } as TimeEntry["generatedBy"],
    precision: "estimated",
    ...overrides,
  })

  it("replaces its own stamp rather than stacking", () => {
    let entries = applyScreenTimeEntries([], DATE, [derived()])
    entries = applyScreenTimeEntries(entries, DATE, [derived({ id: "st-te-second" })])
    const ours = entries.filter((e) => e.generatedBy && (e.generatedBy as { kind: string }).kind === "screentime")
    expect(ours).toHaveLength(1)
    expect(entryMinutes(ours[0])).toBe(60)
  })

  it("keeps the same block ids when the day has not moved", () => {
    const first = applyScreenTimeEntries([], DATE, [derived({ id: "keep-me" })])
    const second = applyScreenTimeEntries(first, DATE, [derived({ id: "must-not-land" })])
    expect(second).toBe(first)
    expect(second[0].id).toBe("keep-me")
  })

  it("leaves hand-painted and sleep-stamped blocks in the Screen Time scope", () => {
    const painted: TimeEntry = {
      id: "hand",
      date: DATE,
      scopeId: "screentime",
      penId: "st-cat-work",
      startMin: 0,
      endMin: 60,
    }
    const slept: TimeEntry = {
      id: "sleep-hand",
      date: DATE,
      scopeId: "screentime",
      penId: "st-cat-other",
      startMin: 60,
      endMin: 120,
      generatedBy: { kind: "sleep", id: DATE },
    }
    const next = applyScreenTimeEntries([painted, slept], DATE, [derived()])
    expect(next.find((e) => e.id === "hand")).toBeDefined()
    expect(next.find((e) => e.id === "sleep-hand")).toBeDefined()
    expect(next.filter((e) => (e.generatedBy as { kind?: string } | undefined)?.kind === "screentime")).toHaveLength(1)
  })

  it("never emits an activity-scope block", () => {
    const activity: TimeEntry = {
      id: "act-hand",
      date: DATE,
      scopeId: "activity",
      penId: "act-work",
      startMin: 0,
      endMin: 60,
    }
    const sneaky = derived({ id: "sneak", scopeId: "activity", penId: "act-work" })
    const next = applyScreenTimeEntries([activity], DATE, [sneaky, derived()])
    expect(next.filter((e) => e.scopeId === "activity")).toEqual([activity])
    expect(next.some((e) => e.id === "sneak")).toBe(false)
  })
})

describe("ensureAppPen", () => {
  it("keeps a stable id and does not overwrite a user's parent or color", () => {
    const id = ensureAppPen({ id: "st-app-cursor", name: "Cursor", parentId: "st-cat-work" })
    expect(id).toBe("st-app-cursor")
    const created = useTimeTrackingStore.getState().scopes.flatMap((s) => s.pens).find((p) => p.id === id)
    expect(created?.color).toBeTruthy()
    expect(created?.parentId).toBe("st-cat-work")

    useTimeTrackingStore.setState({
      scopes: useTimeTrackingStore.getState().scopes.map((scope) =>
        scope.id === "screentime"
          ? {
              ...scope,
              pens: scope.pens.map((pen) =>
                pen.id === id ? { ...pen, color: "#ffffff", parentId: "st-cat-other", name: "My Cursor" } : pen,
              ),
            }
          : scope,
      ),
    })

    ensureAppPen({ id, name: "Cursor", parentId: "st-cat-work", color: "#000000" })
    const kept = useTimeTrackingStore.getState().scopes.flatMap((s) => s.pens).find((p) => p.id === id)
    expect(kept).toMatchObject({ color: "#ffffff", parentId: "st-cat-other", name: "My Cursor" })
  })
})

describe("date helpers", () => {
  it("lists lookback days and the today+yesterday edge", () => {
    expect(screenTimeLookbackDates(14, NOW)).toHaveLength(14)
    expect(screenTimeLookbackDates(14, NOW)[13]).toBe(DATE)
    expect(screenTimeOngoingDates(NOW)).toEqual(["2026-09-20", DATE])
  })
})

describe("fetchScreenTime", () => {
  it("uses an injected desktop bridge and never hits the network", async () => {
    const result = await fetchScreenTime(
      { mode: "health" },
      {
        desktop: {
          fetchScreenTime: async () => ({ ok: true, mode: "health", reachable: true, version: "0.13.2" }),
        },
      },
    )
    expect(result).toMatchObject({ ok: true, mode: "health", reachable: true, version: "0.13.2" })
  })

  it("uses an injected localhost hub fetch", async () => {
    const result = await fetchScreenTime(
      { mode: "events" },
      {
        location: { hostname: "localhost" },
        fetch: (async () => ({
          json: async () =>
            eventsPayload(
              [{ timestamp: at(10, 0), duration: 60, data: { app: "Cursor" } }],
              [{ timestamp: at(10, 0), duration: 60, data: { status: "not-afk" } }],
            ),
        })) as unknown as typeof fetch,
      },
    )
    expect(result.ok).toBe(true)
    if (result.ok && result.mode === "events") {
      expect(result.windowEvents).toHaveLength(1)
      expect(result.afkEvents).toHaveLength(1)
    }
  })
})

describe("syncScreenTime", () => {
  it("paints estimated Screen Time blocks and a second run does not double minutes", async () => {
    const deps = {
      desktop: {
        fetchScreenTime: async () =>
          eventsPayload(
            [{ timestamp: at(10, 0), duration: 3600, data: { app: "Cursor" } }],
            allDayNotAfk(),
          ),
      },
    }
    const first = await syncScreenTime({ now: NOW, dates: [DATE] }, deps)
    expect(first.ok).toBe(true)
    const afterFirst = useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "screentime")
    expect(afterFirst).toHaveLength(1)
    expect(afterFirst[0]).toMatchObject({
      date: DATE,
      scopeId: "screentime",
      penId: "st-app-cursor",
      precision: "estimated",
    })
    expect(afterFirst[0].generatedBy).toEqual({ kind: "screentime", id: DATE })
    expect(afterFirst[0].title).toBeUndefined()
    const minutes = afterFirst.reduce((sum, e) => sum + entryMinutes(e), 0)

    const second = await syncScreenTime({ now: NOW, dates: [DATE] }, deps)
    expect(second.ok).toBe(true)
    const afterSecond = useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "screentime")
    expect(afterSecond).toHaveLength(1)
    expect(afterSecond.reduce((sum, e) => sum + entryMinutes(e), 0)).toBe(minutes)
    expect(loadScreenTimePrefs().lastSuccessAt).toBeTruthy()
  })

  it("keeps a hand-painted Screen Time block and never paints Activity", async () => {
    const hand: TimeEntry = {
      id: "hand",
      date: DATE,
      scopeId: "screentime",
      penId: "st-cat-work",
      startMin: 0,
      endMin: 45,
    }
    const activity: TimeEntry = {
      id: "act-hand",
      date: DATE,
      scopeId: "activity",
      penId: "act-work",
      startMin: 100,
      endMin: 160,
    }
    useTimeTrackingStore.setState({ entries: [hand, activity] })

    await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () =>
            eventsPayload(
              [{ timestamp: at(10, 0), duration: 1800, data: { app: "Slack", title: "secret channel" } }],
              allDayNotAfk(),
            ),
        },
      },
    )

    const { entries } = useTimeTrackingStore.getState()
    expect(entries.find((e) => e.id === "hand")).toMatchObject({ startMin: 0, endMin: 45 })
    expect(entries.filter((e) => e.scopeId === "activity")).toEqual([activity])
    expect(entries.filter((e) => e.generatedBy && e.scopeId === "activity")).toEqual([])
    expect(entries.some((e) => e.title === "secret channel")).toBe(false)
  })

  it("does not wipe existing stamps when fetch fails", async () => {
    await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () =>
            eventsPayload([{ timestamp: at(10, 0), duration: 1800, data: { app: "Cursor" } }], allDayNotAfk()),
        },
      },
    )
    const before = useTimeTrackingStore.getState().entries
    expect(before.length).toBeGreaterThan(0)

    const failed = await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () => ({ ok: false, error: "ActivityWatch is down", code: "aw" }),
        },
      },
    )
    expect(failed.ok).toBe(false)
    expect(useTimeTrackingStore.getState().entries).toEqual(before)
    expect(loadScreenTimePrefs().lastError).toMatch(/down/)
  })

  it("nests a web domain under Chrome when the watcher overlaps", async () => {
    await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () =>
            eventsPayload(
              [{ timestamp: at(10, 0), duration: 3600, data: { app: "Chrome" } }],
              allDayNotAfk(),
              [{ timestamp: at(10, 0), duration: 3600, data: { url: "https://www.github.com" } }],
            ),
        },
      },
    )
    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "screentime")!.pens
    expect(pens.find((p) => p.id === "st-app-chrome")?.parentId).toBe("st-cat-browsing")
    expect(pens.find((p) => p.id === "st-app-chrome-github-com")?.parentId).toBe("st-app-chrome")
    const blocks = useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "screentime")
    expect(blocks.some((e) => e.penId === "st-app-chrome-github-com")).toBe(true)
    expect(blocks.every((e) => e.scopeId !== "activity")).toBe(true)
  })

  it("treats a reachable ActivityWatch with no windows as success, not an error", async () => {
    const result = await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () => eventsPayload([], []),
        },
      },
    )
    expect(result).toMatchObject({ ok: true, days: 1, blocks: 0, windowEvents: 0 })
    expect(result.error).toBeUndefined()
    expect(result.note).toMatch(/no recorded windows yet/)
    expect(result.note).toMatch(/cannot import Apple Screen Time/)
    expect(loadScreenTimePrefs().lastSuccessAt).toBeTruthy()
    expect(loadScreenTimePrefs().lastError).toBeUndefined()
    expect(loadScreenTimePrefs().lastSyncNote).toMatch(/no recorded windows yet/)
    expect(useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "screentime")).toEqual([])
  })

  it("says mapping dropped events when windows arrived but none became blocks", async () => {
    const result = await syncScreenTime(
      { now: NOW, dates: [DATE] },
      {
        desktop: {
          fetchScreenTime: async () =>
            eventsPayload(
              [{ timestamp: at(10, 0), duration: 5, data: { app: "Cursor" } }],
              [{ timestamp: at(10, 0), duration: 5, data: { status: "not-afk" } }],
            ),
        },
      },
    )
    expect(result).toMatchObject({ ok: true, blocks: 0, windowEvents: 1 })
    expect(result.note).toMatch(/none became blocks/)
    expect(result.note).toMatch(/shorter than 15s/)
    expect(loadScreenTimePrefs().lastSyncNote).toMatch(/none became blocks/)
  })
})

describe("describeScreenTimeSync", () => {
  it("distinguishes empty ActivityWatch from filtered events", () => {
    expect(describeScreenTimeSync({ ok: false, error: "down" })).toBe("down")
    expect(describeScreenTimeSync({ ok: true, blocks: 3, days: 14, windowEvents: 12 })).toMatch(
      /Painted 3 block\(s\) across 14 day\(s\)/,
    )
    expect(describeScreenTimeSync({ ok: true, blocks: 0, windowEvents: 0 })).toMatch(/no recorded windows yet/)
    expect(describeScreenTimeSync({ ok: true, blocks: 0, windowEvents: 8, minDurationSec: 15 })).toMatch(
      /8 window event\(s\).*shorter than 15s/s,
    )
  })
})
