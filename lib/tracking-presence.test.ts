import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { defaultScopes, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  applyScopeNowUpdate,
  applyTrackingPresenceUpdate,
  livePresenceHints,
  paintScopeSequence,
  presenceLaneForScope,
  presencePaintEnd,
  presencePaintStart,
  formatLoggedMoment,
  recentScopeSequence,
  trackingPresenceSnapshot,
  trackingScopeStatuses,
} from "./tracking-presence"

function block(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "scopeId" | "penId" | "startMin" | "endMin">): TimeEntry {
  return { date: "2026-09-23", ...partial }
}

const scopes = defaultScopes()

describe("tracking presence", () => {
  it("treats a covering block as current", () => {
    const entries = [block({ id: "a", scopeId: "activity", penId: "act-work", startMin: 600, endMin: 1440 })]
    expect(presenceLaneForScope("activity", { date: "2026-09-23", min: 800, entries, scopes })).toEqual({
      scopeId: "activity",
      kind: "current",
      name: "Work",
    })
  })

  it("uses a live session when the grid has no covering block", () => {
    expect(
      presenceLaneForScope("activity", {
        date: "2026-09-23",
        min: 800,
        entries: [],
        scopes,
        live: [{ scopeId: "activity", name: "Essay" }],
      }),
    ).toEqual({ scopeId: "activity", kind: "current", name: "Essay" })
  })

  it("falls back to the latest started interval", () => {
    const entries = [
      block({ id: "old", date: "2026-09-22", scopeId: "location", penId: "loc-home", startMin: 0, endMin: 600 }),
      block({ id: "mid", scopeId: "location", penId: "loc-out", startMin: 480, endMin: 600 }),
    ]
    expect(presenceLaneForScope("location", { date: "2026-09-23", min: 800, entries, scopes })).toEqual({
      scopeId: "location",
      kind: "last",
      name: "Outside",
    })
  })

  it("names a mood lane from the word on the stretch", () => {
    const entries = [
      block({
        id: "mood",
        scopeId: "mood",
        penId: "mood-meh",
        startMin: 540,
        endMin: 900,
        moodReading: { word: "Thin" },
      }),
    ]
    expect(presenceLaneForScope("mood", { date: "2026-09-23", min: 600, entries, scopes })).toEqual({
      scopeId: "mood",
      kind: "current",
      name: "Thin",
    })
  })

  it("skips instants", () => {
    const entries = [
      block({
        id: "ping",
        scopeId: "mood",
        penId: "mood-great",
        startMin: 700,
        endMin: 700,
        kind: "instant",
      }),
    ]
    expect(presenceLaneForScope("mood", { date: "2026-09-23", min: 800, entries, scopes }).kind).toBe("empty")
  })

  it("captions Now when any lane is live", () => {
    const snap = trackingPresenceSnapshot({
      date: "2026-09-23",
      min: 800,
      entries: [block({ id: "a", scopeId: "activity", penId: "act-work", startMin: 600, endMin: 900 })],
      scopes,
    })
    expect(snap.caption).toBe("Now")
    expect(snap.activity.name).toBe("Work")
    expect(snap.footer).toBe("now")
  })

  it("maps live sessions onto hints", () => {
    expect(
      livePresenceHints({
        workSession: { title: "Op", scopeId: "activity" },
        penSession: { title: "Cafe", scopeId: "location" },
      }),
    ).toEqual([
      { scopeId: "activity", name: "Op" },
      { scopeId: "location", name: "Cafe" },
    ])
  })
})

describe("presence paint window", () => {
  it("ends at the current minute, never midnight", () => {
    expect(presencePaintEnd(14 * 60)).toBe(14 * 60 + 1)
    expect(presencePaintEnd(1439)).toBe(1440)
  })

  it("fills the open stretch from the previous log", () => {
    const entries = [block({ id: "a", scopeId: "activity", penId: "act-work", startMin: 600, endMin: 700 })]
    expect(presencePaintStart("2026-09-23", "activity", 14 * 60, entries)).toBe(700)
  })

  it("stamps only the current minute when a block already covers now", () => {
    const entries = [block({ id: "a", scopeId: "activity", penId: "act-work", startMin: 600, endMin: 1440 })]
    expect(presencePaintStart("2026-09-23", "activity", 14 * 60, entries)).toBe(14 * 60)
  })

  it("stamps only the current minute when nothing precedes today", () => {
    expect(presencePaintStart("2026-09-23", "activity", 14 * 60, [])).toBe(14 * 60)
  })
})

describe("applyTrackingPresenceUpdate", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("paints chosen pens up to now and leaves the rest of the day empty", () => {
    applyTrackingPresenceUpdate(
      { activity: "act-rest", location: "Home" },
      new Date(2026, 8, 23, 14, 0),
    )
    const entries = useTimeTrackingStore.getState().entries.filter((e) => e.date === "2026-09-23")
    const act = entries.find((e) => e.scopeId === "activity")
    const loc = entries.find((e) => e.scopeId === "location")
    expect(act?.penId).toBe("act-rest")
    expect(act?.startMin).toBe(14 * 60)
    expect(act?.endMin).toBe(14 * 60 + 1)
    expect(loc?.penId).toBe("loc-home")
    expect(loc?.endMin).toBe(14 * 60 + 1)
    expect(entries.every((e) => e.endMin <= 14 * 60 + 1)).toBe(true)
  })

  it("clears a prior open-until-midnight tail when updating", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-23", "activity", 600, 1440, "act-work")
    applyTrackingPresenceUpdate({ activity: "act-rest" }, new Date(2026, 8, 23, 14, 0))
    const entries = useTimeTrackingStore
      .getState()
      .entries.filter((e) => e.date === "2026-09-23" && e.scopeId === "activity")
      .sort((a, b) => a.startMin - b.startMin)
    expect(entries.some((e) => e.endMin > 14 * 60 + 1)).toBe(false)
    const stamped = entries.find((e) => e.penId === "act-rest")
    expect(stamped).toMatchObject({ startMin: 14 * 60, endMin: 14 * 60 + 1 })
  })

  it("lists every view and marks an estimated block", () => {
    const entries = [
      block({
        id: "est",
        scopeId: "activity",
        penId: "act-work",
        startMin: 0,
        endMin: 60,
        precision: "estimated",
        clockCertainty: "estimated",
      }),
    ]
    const lanes = trackingScopeStatuses({ date: "2026-09-23", min: 800, entries, scopes })
    expect(lanes).toHaveLength(scopes.length)
    expect(lanes.find((lane) => lane.scopeId === "activity")).toMatchObject({
      kind: "last",
      name: "Work",
      estimated: true,
      loggedAt: { date: "2026-09-23", minute: 59 },
    })
    expect(lanes.find((lane) => lane.scopeId === "location")).toMatchObject({
      kind: "empty",
      estimated: false,
      loggedAt: null,
    })
  })

  it("records the most recent moment and formats it as a clock or a date", () => {
    const lanes = trackingScopeStatuses({
      date: "2026-09-23",
      min: 800,
      entries: [
        block({ id: "live", scopeId: "activity", penId: "act-work", startMin: 600, endMin: 900 }),
        block({ id: "old", date: "2026-09-22", scopeId: "location", penId: "loc-home", startMin: 540, endMin: 600 }),
      ],
      scopes,
    })
    expect(lanes.find((lane) => lane.scopeId === "activity")?.loggedAt).toEqual({ date: "2026-09-23", minute: 800 })
    expect(lanes.find((lane) => lane.scopeId === "location")?.loggedAt).toEqual({ date: "2026-09-22", minute: 599 })
    expect(formatLoggedMoment({ date: "2026-09-23", minute: 800 }, "2026-09-23")).toBe("1:20 PM")
    expect(formatLoggedMoment({ date: "2026-09-22", minute: 599 }, "2026-09-23")).toBe("Sep 22, 9:59 AM")
    expect(formatLoggedMoment({ date: "2025-09-22", minute: 600 }, "2026-09-23")).toBe("Sep 22, 2025, 10:00 AM")
  })

  it("paints a new pen for now and an estimated sequence", () => {
    applyScopeNowUpdate("location", "Library", new Date(2026, 8, 23, 14, 0))
    const nowPen = useTimeTrackingStore.getState().scopes.find((scope) => scope.id === "location")?.pens.find((pen) => pen.name === "Library")
    expect(nowPen).toBeTruthy()
    const painted = paintScopeSequence("mood", "2026-09-23", [
      { name: "Worn", startMin: 13 * 60, endMin: 14 * 60, estimated: true },
    ])
    expect(painted).toBe(1)
    const mood = useTimeTrackingStore.getState().entries.find((entry) => entry.scopeId === "mood" && entry.date === "2026-09-23")
    expect(mood?.precision).toBe("estimated")
    expect(mood?.clockCertainty).toBe("estimated")
  })

  it("fills the gap from the previous log up to now", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-23", "activity", 600, 700, "act-work")
    applyTrackingPresenceUpdate({ activity: "act-rest" }, new Date(2026, 8, 23, 14, 0))
    const act = useTimeTrackingStore
      .getState()
      .entries.find((e) => e.date === "2026-09-23" && e.scopeId === "activity" && e.penId === "act-rest")
    expect(act).toMatchObject({ startMin: 700, endMin: 14 * 60 + 1 })
  })

  it("extends one continuous block when the same value fills the open stretch", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-23", "activity", 600, 700, "act-work")
    applyScopeNowUpdate("activity", "Work", new Date(2026, 8, 23, 14, 0), "open")
    const blocks = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.date === "2026-09-23" && entry.scopeId === "activity")
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ penId: "act-work", startMin: 600, endMin: 14 * 60 + 1 })
  })

  it("starts a separate block at the current minute when the span is a minute", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-23", "activity", 600, 700, "act-work")
    applyScopeNowUpdate("activity", "Work", new Date(2026, 8, 23, 14, 0), "minute")
    const blocks = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.date === "2026-09-23" && entry.scopeId === "activity")
      .sort((a, b) => a.startMin - b.startMin)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ penId: "act-work", startMin: 600, endMin: 700 })
    expect(blocks[1]).toMatchObject({ penId: "act-work", startMin: 14 * 60, endMin: 14 * 60 + 1 })
  })

  it("reads the recent blocks on a view, oldest of that window first", () => {
    const store = useTimeTrackingStore.getState()
    store.paintMinutes("2026-09-23", "activity", 600, 660, "act-rest")
    store.paintMinutes("2026-09-23", "activity", 700, 760, "act-work", undefined, undefined, "estimated", {
      clockCertainty: "estimated",
    })
    const recent = recentScopeSequence("activity", useTimeTrackingStore.getState().entries, useTimeTrackingStore.getState().scopes)
    expect(recent.map((step) => step.name)).toEqual(["Rest", "Work"])
    expect(recent[1]?.estimated).toBe(true)
  })
})
