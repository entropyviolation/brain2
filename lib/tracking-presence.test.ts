import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { defaultScopes, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  applyTrackingPresenceUpdate,
  livePresenceHints,
  presenceLaneForScope,
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

describe("applyTrackingPresenceUpdate", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("paints chosen pens from now through the end of the day", () => {
    applyTrackingPresenceUpdate(
      { activity: "act-rest", location: "Home" },
      new Date(2026, 8, 23, 14, 0),
    )
    const entries = useTimeTrackingStore.getState().entries.filter((e) => e.date === "2026-09-23")
    const act = entries.find((e) => e.scopeId === "activity")
    const loc = entries.find((e) => e.scopeId === "location")
    expect(act?.penId).toBe("act-rest")
    expect(act?.startMin).toBe(14 * 60)
    expect(act?.endMin).toBe(1440)
    expect(loc?.penId).toBe("loc-home")
  })
})
