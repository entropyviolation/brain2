import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { defaultScopes, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  applyTrackingPresenceUpdate,
  livePresenceHints,
  presenceLaneForScope,
  presencePaintEnd,
  presencePaintStart,
  trackingPresenceSnapshot,
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

  it("fills the gap from the previous log up to now", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-09-23", "activity", 600, 700, "act-work")
    applyTrackingPresenceUpdate({ activity: "act-rest" }, new Date(2026, 8, 23, 14, 0))
    const act = useTimeTrackingStore
      .getState()
      .entries.find((e) => e.date === "2026-09-23" && e.scopeId === "activity" && e.penId === "act-rest")
    expect(act).toMatchObject({ startMin: 700, endMin: 14 * 60 + 1 })
  })
})
