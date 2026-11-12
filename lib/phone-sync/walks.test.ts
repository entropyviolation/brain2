/**
 * lib/phone-sync/walks.test.ts — Walks from per-minute steps, free minutes, and place titles
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { mergeHealthPage, WALK_PEN_ID, type HealthMergeState } from "./health"
import { freePieces, parseStepMinutes, placeNear, tagHealthPlaces, titleWithPlaces, walkBouts, walkEntries } from "./walks"

const MIN = 60_000
/** 2026-03-10 09:00 local. */
const NINE = new Date(2026, 2, 10, 9, 0).getTime()
const LATER = NINE + 6 * 60 * MIN

function minutes(startMs: number, count: number, steps = 100, meters = 70): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => [startMs + i * MIN, steps, meters])
}

function scopes(): TrackScope[] {
  return useTimeTrackingStore.getState().scopes
}

function blank(entries: TimeEntry[] = []): HealthMergeState {
  return { days: {}, ledger: {}, sleep: {}, entries, removedEntryIds: [], scopes: scopes() }
}

beforeEach(() => resetAllStores())

describe("walkBouts", () => {
  it("joins minutes across a short stop and drops a stretch that is too short", () => {
    const rows = parseStepMinutes([
      ...minutes(NINE, 6),
      // two still minutes at a crosswalk
      ...minutes(NINE + 8 * MIN, 6),
      // four minutes much later: not a walk
      ...minutes(NINE + 60 * MIN, 4),
    ])
    const bouts = walkBouts(rows, { minMinutes: 5, nowMs: LATER })
    expect(bouts).toHaveLength(1)
    expect(bouts[0]).toMatchObject({ startMs: NINE, endMs: NINE + 14 * MIN, steps: 1200, meters: 840, kind: "walk" })
  })

  it("does not join across a long stop, and ignores slow minutes", () => {
    const rows = parseStepMinutes([...minutes(NINE, 6), ...minutes(NINE + 6 * MIN, 5, 20), ...minutes(NINE + 11 * MIN, 6)])
    expect(walkBouts(rows, { minMinutes: 5, nowMs: LATER })).toHaveLength(2)
  })

  it("waits for a walk to be over", () => {
    const rows = parseStepMinutes(minutes(NINE, 10))
    expect(walkBouts(rows, { minMinutes: 5, nowMs: NINE + 12 * MIN })).toHaveLength(0)
    expect(walkBouts(rows, { minMinutes: 5, nowMs: NINE + 15 * MIN })).toHaveLength(1)
  })

  it("calls a fast cadence a run", () => {
    expect(walkBouts(parseStepMinutes(minutes(NINE, 10, 165)), { minMinutes: 5, nowMs: LATER })[0]?.kind).toBe("run")
  })

  it("honors the shortest walk", () => {
    expect(walkBouts(parseStepMinutes(minutes(NINE, 8)), { minMinutes: 10, nowMs: LATER })).toHaveLength(0)
  })
})

describe("freePieces", () => {
  it("returns what the busy spans leave, when long enough", () => {
    expect(freePieces(540, 580, [{ startMin: 550, endMin: 560 }], 5)).toEqual([
      { startMin: 540, endMin: 550 },
      { startMin: 560, endMin: 580 },
    ])
    expect(freePieces(540, 580, [{ startMin: 543, endMin: 578 }], 5)).toEqual([])
    expect(freePieces(540, 580, [], 5)).toEqual([{ startMin: 540, endMin: 580 }])
  })
})

describe("walkEntries", () => {
  const bout = { startMs: NINE, endMs: NINE + 30 * MIN, steps: 3000, meters: 2100, kind: "walk" as const }
  const targets = { scopeId: "activity", walkPenId: "act-walk", runPenId: "act-exercise", removedEntryIds: [], minMinutes: 5 }

  it("paints a whole free walk with steps and distance in the notes", () => {
    const { entries, bouts } = walkEntries([bout], { ...targets, entries: [] })
    expect(bouts).toBe(1)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ date: "2026-03-10", startMin: 540, endMin: 570, penId: "act-walk", title: "Walk", notes: "3,000 steps · 2.1 km" })
  })

  it("leaves tracked time alone and keeps only the free part", () => {
    const work: TimeEntry = { id: "w", date: "2026-03-10", scopeId: "activity", penId: "act-work", startMin: 555, endMin: 600 }
    const { entries } = walkEntries([bout], { ...targets, entries: [work] })
    expect(entries.map((e) => [e.startMin, e.endMin])).toEqual([[540, 555]])
  })

  it("skips a walk the person deleted", () => {
    const first = walkEntries([bout], { ...targets, entries: [] }).entries[0]!
    expect(walkEntries([bout], { ...targets, entries: [], removedEntryIds: [first.id] }).entries).toHaveLength(0)
  })
})

describe("mergeHealthPage walks", () => {
  const page = { stepMinutes: minutes(NINE, 20) }

  it("writes a walk on the Walking pen once, and nothing on a second read", () => {
    const first = mergeHealthPage(blank(), page, { walks: { nowMs: LATER } })
    expect(first.write.written.walks).toBe(1)
    const walk = first.state.entries.find((e) => e.penId === WALK_PEN_ID)
    expect(walk).toMatchObject({ startMin: 540, endMin: 560, title: "Walk" })
    expect(first.state.scopes.find((s) => s.id === "activity")?.pens.some((p) => p.id === WALK_PEN_ID)).toBe(true)

    const again = mergeHealthPage(first.state, page, { walks: { nowMs: LATER } })
    expect(again.write.written.walks).toBeUndefined()
    expect(again.state.entries).toHaveLength(first.state.entries.length)
  })

  it("lets a workout keep its minutes", () => {
    const merged = mergeHealthPage(
      blank(),
      { ...page, workouts: [{ id: "W1", activity: "Walking", startMs: NINE, endMs: NINE + 20 * MIN }] },
      { walks: { nowMs: LATER } },
    )
    expect(merged.state.entries.filter((e) => e.penId === WALK_PEN_ID)).toHaveLength(0)
    expect(merged.write.written.workouts).toBe(1)
  })

  it("stays out when walks are off", () => {
    expect(mergeHealthPage(blank(), page, { walks: false }).state.entries).toHaveLength(0)
  })
})

describe("place names", () => {
  function withPlaces(): { entries: TimeEntry[]; scopes: TrackScope[] } {
    const store = useTimeTrackingStore.getState()
    const home = store.addPen("location", { name: "Home", color: "#333333" })
    const park = store.addPen("location", { name: "Park", color: "#444444" })
    const coord = store.addPen("location", { name: "32.741,-117.250", color: "#555555" })
    return {
      scopes: scopes(),
      entries: [
        { id: "l1", date: "2026-03-10", scopeId: "location", penId: home, startMin: 400, endMin: 538 },
        { id: "l2", date: "2026-03-10", scopeId: "location", penId: park, startMin: 565, endMin: 620 },
        { id: "l3", date: "2026-03-10", scopeId: "location", penId: coord, startMin: 700, endMin: 760 },
      ],
    }
  }

  it("finds the named place at or near a minute, never a bare coordinate", () => {
    const { entries, scopes: s } = withPlaces()
    expect(placeNear(entries, s, "2026-03-10", 540)).toBe("Home")
    expect(placeNear(entries, s, "2026-03-10", 600)).toBe("Park")
    expect(placeNear(entries, s, "2026-03-10", 552)).toBeNull()
    expect(placeNear(entries, s, "2026-03-10", 720)).toBeNull()
  })

  it("words one place, two places, and none", () => {
    expect(titleWithPlaces("Walk", "Home", "Park")).toBe("Walk · Home → Park")
    expect(titleWithPlaces("Yoga", "Studio", "Studio")).toBe("Yoga · Studio")
    expect(titleWithPlaces("Walk", null, null)).toBe("Walk")
  })

  it("titles a new walk from the Location beside it, and leaves a renamed block alone", () => {
    const { entries } = withPlaces()
    const merged = mergeHealthPage(blank(entries), { stepMinutes: minutes(NINE, 20) }, { walks: { nowMs: LATER } })
    const walk = merged.state.entries.find((e) => e.penId === WALK_PEN_ID)!
    expect(walk.title).toBe("Walk · Home → Park")

    const renamed = merged.state.entries.map((e) => (e.id === walk.id ? { ...e, title: "Morning loop" } : e))
    const tagged = tagHealthPlaces(renamed, scopes(), { sinceDate: "2026-03-01", bases: new Set(["Walk"]) })
    expect(tagged).toBe(renamed)
  })

  it("names a walk later, when Location lands after it", () => {
    const first = mergeHealthPage(blank(), { stepMinutes: minutes(NINE, 20) }, { walks: { nowMs: LATER } })
    expect(first.state.entries[0]?.title).toBe("Walk")
    const { entries } = withPlaces()
    const second = mergeHealthPage(
      { ...first.state, entries: [...first.state.entries, ...entries], scopes: scopes() },
      { stepMinutes: minutes(NINE, 20) },
      { walks: { nowMs: LATER } },
    )
    expect(second.state.entries.find((e) => e.penId === WALK_PEN_ID)?.title).toBe("Walk · Home → Park")
  })

  it("leaves titles bare when place names are off", () => {
    const { entries } = withPlaces()
    const merged = mergeHealthPage(blank(entries), { stepMinutes: minutes(NINE, 20) }, { walks: { nowMs: LATER }, places: false })
    expect(merged.state.entries.find((e) => e.penId === WALK_PEN_ID)?.title).toBe("Walk")
  })
})
