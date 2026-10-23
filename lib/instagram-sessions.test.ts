import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  INSTAGRAM_SESSION_NOTE,
  applyInstagramSessions,
  mergeSessionEntries,
  readInstagramSessions,
  sessionEntries,
} from "@/lib/instagram-sessions"
import { syncInstagramSessionsFromReport } from "@/lib/instagram-sessions-sync"
import type { InstagramSource } from "@/lib/instagram-report"
import { findIphoneScreenTimeScope, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetAllStores } from "@/tests/test-utils"

const at = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Math.floor(new Date(y, mo - 1, d, h, mi, s).getTime() / 1000)

describe("sessionEntries", () => {
  it("runs from the first action's minute to a minute past the last", () => {
    const [row, ...rest] = sessionEntries({ start: at(2026, 9, 24, 15, 18, 30), end: at(2026, 9, 24, 15, 20, 10), actions: 4 }, "s", "p")
    expect(rest).toEqual([])
    expect(row).toMatchObject({ date: "2026-09-24", startMin: 15 * 60 + 18, endMin: 15 * 60 + 22, notes: INSTAGRAM_SESSION_NOTE, precision: "estimated" })
    expect(row.generatedBy).toEqual({ kind: "phone-sync", id: `instagram:${at(2026, 9, 24, 15, 18, 30)}` })
  })

  it("gives a one-action session one minute", () => {
    const t = at(2026, 10, 1, 9, 0, 0)
    const [row] = sessionEntries({ start: t, end: t, actions: 1 }, "s", "p")
    expect(row.endMin - row.startMin).toBe(1)
  })

  it("slices at midnight and links the slices", () => {
    const rows = sessionEntries({ start: at(2026, 10, 18, 23, 50), end: at(2026, 10, 19, 0, 20), actions: 9 }, "s", "p")
    expect(rows.map((r) => [r.date, r.startMin, r.endMin])).toEqual([
      ["2026-10-18", 23 * 60 + 50, 1440],
      ["2026-10-19", 0, 21],
    ])
    expect(new Set(rows.map((r) => r.spanId)).size).toBe(1)
    expect(new Set(rows.map((r) => r.id)).size).toBe(2)
  })
})

describe("readInstagramSessions", () => {
  it("reads rows and drops bad ones", () => {
    expect(readInstagramSessions({ time_active: { sessions_recent: [[1, 61, 3], "x", [5, 2, 1], [7, 7]] } })).toEqual([
      { start: 1, end: 61, actions: 3 },
      { start: 7, end: 7, actions: 1 },
    ])
    expect(readInstagramSessions({ time_active: {} })).toEqual([])
    expect(readInstagramSessions(null)).toEqual([])
  })
})

describe("mergeSessionEntries", () => {
  const base = sessionEntries({ start: at(2026, 10, 1, 9, 0), end: at(2026, 10, 1, 9, 10), actions: 5 }, "s", "p")
  const longer = sessionEntries({ start: at(2026, 10, 1, 9, 0), end: at(2026, 10, 1, 9, 30), actions: 9 }, "s", "p")

  it("stretches an untouched block and skips a deleted one", () => {
    expect(mergeSessionEntries(base, [], longer)).toMatchObject({ added: 0, updated: 1 })
    expect(mergeSessionEntries([], [base[0].id], base)).toMatchObject({ added: 0, skipped: 1 })
  })

  it("leaves an edited block alone", () => {
    const edited = [{ ...base[0], notes: "mine" }]
    const out = mergeSessionEntries(edited, [], longer)
    expect(out.updated).toBe(0)
    expect(out.entries[0].endMin).toBe(base[0].endMin)
  })
})

describe("applyInstagramSessions", () => {
  beforeEach(() => {
    resetAllStores()
    window.localStorage.clear()
  })

  it("paints the Instagram pen on iPhone Screen Time, once", () => {
    const sessions = [
      { start: at(2026, 9, 24, 15, 18), end: at(2026, 9, 24, 18, 14), actions: 352 },
      { start: at(2026, 10, 21, 15, 40), end: at(2026, 10, 21, 15, 44), actions: 6 },
    ]
    expect(applyInstagramSessions(sessions)).toMatchObject({ added: 2, updated: 0 })
    expect(applyInstagramSessions(sessions)).toMatchObject({ added: 0, updated: 0 })
    const { entries, scopes } = useTimeTrackingStore.getState()
    const scope = findIphoneScreenTimeScope(scopes)!
    const pen = scope.pens.find((p) => p.id === "iphone-st-app-instagram")
    expect(pen?.name).toBe("Instagram")
    const rows = entries.filter((e) => e.generatedBy?.id.startsWith("instagram:"))
    expect(rows).toHaveLength(2)
    expect(rows.every((e) => e.scopeId === scope.id && e.penId === pen!.id && e.notes === INSTAGRAM_SESSION_NOTE)).toBe(true)
  })
})

describe("syncInstagramSessionsFromReport", () => {
  beforeEach(() => {
    resetAllStores()
    window.localStorage.clear()
  })
  const source = (buildId: string, summary: unknown) =>
    ({ kind: "dev", canIngest: false, status: vi.fn(), saveUi: vi.fn(), summary: async () => ({ buildId, text: JSON.stringify(summary) }) }) as unknown as InstagramSource
  const withSessions = { time_active: { sessions_recent: [[at(2026, 10, 1, 9, 0), at(2026, 10, 1, 9, 5), 3]] } }

  it("applies a build once unless forced", async () => {
    expect((await syncInstagramSessionsFromReport({ source: source("b1", withSessions) })).status).toBe("applied")
    expect((await syncInstagramSessionsFromReport({ source: source("b1", withSessions) })).status).toBe("skipped")
    expect((await syncInstagramSessionsFromReport({ source: source("b1", withSessions), force: true })).status).toBe("applied")
  })

  it("says so when the build has no session list", async () => {
    const out = await syncInstagramSessionsFromReport({ source: source("b0", { time_active: {} }) })
    expect(out.status).toBe("none")
    expect(await syncInstagramSessionsFromReport({ source: null })).toMatchObject({ status: "none" })
  })
})
