import { describe, expect, it } from "vitest"
import { departureFor } from "@/lib/transit-time"
import { acceptSuggestion, isSuggestion, makesSense, overlaySuggestions, transitCandidates, transitEntries } from "@/lib/transit-suggest"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"

const scope = {
  id: "location",
  name: "Location",
  pens: [
    { id: "home", name: "Home", color: "#0a0", place: { lat: 32.7, lng: -117.1 } },
    { id: "work", name: "Work", color: "#00a", place: { lat: 32.8, lng: -117.2 } },
    { id: "loc-transit", name: "Transit", color: "#a0a" },
  ],
} as unknown as TrackScope
const e = (id: string, penId: string, startMin: number, endMin: number) => ({ id, date: "2026-10-20", scopeId: "location", penId, startMin, endMin }) as TimeEntry

describe("transit suggestions", () => {
  const entries = [e("a", "home", 360, 480), e("b", "work", 540, 720)]
  it("finds addressed neighbours with a gap", () => {
    const c = transitCandidates(entries, "2026-10-20", scope)
    expect(c).toHaveLength(1)
    expect([c[0].gapStart, c[0].gapEnd]).toEqual([480, 540])
  })
  it("draws a hatched transit tile sized to the trip", () => {
    const c = transitCandidates(entries, "2026-10-20", scope)
    const [t] = transitEntries(c, new Map([[c[0].id, 35]]), scope)
    expect(t).toMatchObject({ penId: "loc-transit", precision: "estimated", startMin: 480, endMin: 515 })
    expect(t.title).toBe("Transit from Home to Work?")
  })
  it("stays quiet for touching blocks, unknown trips, other views and absurd gaps", () => {
    expect(transitCandidates([e("a", "home", 360, 480), e("b", "work", 480, 720)], "2026-10-20", scope)).toEqual([])
    expect(transitCandidates(entries, "2026-10-20", { ...scope, id: "mood", name: "Mood" })).toEqual([])
    const c = transitCandidates(entries, "2026-10-20", scope)
    expect(transitEntries(c, new Map(), scope)).toEqual([])
    expect(makesSense(10, 300)).toBe(false)
    expect(makesSense(60, 20)).toBe(false)
  })
  it("never overwrites painted minutes", () => {
    const base = new Array(1440).fill(null) as (TimeEntry | null)[]
    base[490] = entries[0]
    const out = overlaySuggestions(base, [{ ...entries[1], startMin: 480, endMin: 500 }])
    expect(out[490]).toBe(entries[0])
    expect(out[485]).not.toBeNull()
  })
  it("asks about the coming week for a past day, same weekday and time", () => {
    const now = new Date("2026-10-20T12:00:00")
    const d = departureFor("2026-10-12", 8 * 60, now)
    expect(d.getDay()).toBe(new Date("2026-10-12T00:00:00").getDay())
    expect(d.getHours()).toBe(8)
    expect(d.getTime()).toBeGreaterThan(now.getTime())
  })
  it("accepting writes a definite block without the question mark", () => {
    const c = transitCandidates(entries, "2026-10-20", scope)
    const [t] = transitEntries(c, new Map([[c[0].id, 35]]), scope)
    expect(isSuggestion(t)).toBe(true)
    expect(isSuggestion(entries[0])).toBe(false)
    const calls: unknown[][] = []
    acceptSuggestion(t, (...a) => calls.push(a))
    expect(calls[0]).toEqual(["2026-10-20", "location", 480, 515, "loc-transit", [], undefined, "definite", { title: "Transit from Home to Work" }])
  })
})
