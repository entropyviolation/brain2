import { describe, expect, it } from "vitest"
import { arrivalWindow, certaintyPatch, nearbyInstants, nextBlock, refitTransit, resolveEdge, settleAnchors } from "@/lib/entry-edges"
import type { TimeEntry } from "@/lib/time-entries"

const e = (o: Partial<TimeEntry>) => ({ id: "x", date: "2026-10-20", scopeId: "location", penId: "p", startMin: 0, endMin: 60, ...o }) as TimeEntry

describe("entry edges", () => {
  it("derives block certainty from the worse end", () => {
    expect(certaintyPatch("exact", "exact")).toMatchObject({ clockCertainty: undefined, precision: undefined })
    expect(certaintyPatch("exact", "unknown")).toMatchObject({ endCertainty: "unknown", clockCertainty: "unknown", precision: "estimated" })
  })
  it("finds the next block and gap", () => {
    const a = e({ id: "a", startMin: 0, endMin: 60 })
    const b = e({ id: "b", startMin: 90, endMin: 120 })
    expect(nextBlock([a, b], a)).toMatchObject({ gap: 30, entry: { id: "b" } })
  })
  it("lists instants nearest the end", () => {
    const i = e({ id: "i", kind: "instant", startMin: 55, endMin: 55 })
    expect(nearbyInstants([i, e({ id: "far", kind: "instant", startMin: 900, endMin: 900 })], "2026-10-20", 60, 1)[0].id).toBe("i")
  })
  it("widens the arrival window with uncertainty", () => {
    expect(arrivalWindow(100, 20, "exact")).toEqual([120, 120])
    expect(arrivalWindow(100, 20, "estimated")).toEqual([105, 135])
  })
  it("refits transit when the previous block's end moves", () => {
    const from = e({ id: "a", endMin: 70 })
    const t = e({ id: "t", transitFrom: "a", transitTo: "b", transitMin: 20, startMin: 60, endMin: 80 })
    const to = e({ id: "b", startMin: 120, endMin: 150 })
    expect(refitTransit([from, t, to], from)).toEqual({ t: { startMin: 70, endMin: 90, transitMin: 20 } })
  })
})

describe("anchors", () => {
  const blk = (id: string, startMin: number, endMin: number, extra: Partial<TimeEntry> = {}) =>
    ({ id, date: "2026-10-20", scopeId: "loc", penId: "p", startMin, endMin, ...extra }) as TimeEntry

  it("the more certain edge wins, equal certainty with different minutes conflicts", () => {
    expect(resolveEdge({ min: 900, c: "estimated" }, { min: 905, c: "exact" })).toEqual({ kind: "snap", to: { min: 905, c: "exact" } })
    expect(resolveEdge({ min: 900, c: "exact" }, { min: 905, c: "unknown" }).kind).toBe("keep")
    expect(resolveEdge({ min: 900, c: "exact" }, { min: 905, c: "exact" }).kind).toBe("conflict")
    expect(resolveEdge({ min: 900, c: "unknown" }, { min: 900, c: "exact" }).kind).toBe("snap")
  })

  it("saving a joined block moves the partner and merges certainty at the same minute", () => {
    const a = blk("a", 800, 900, { endJoinId: "b", endCertainty: "estimated", clockCertainty: "estimated", precision: "estimated" })
    const b = blk("b", 900, 960, { startJoinId: "a" })
    const out = settleAnchors([a, b], "a")
    expect(out.a).toMatchObject({ endCertainty: undefined, clockCertainty: undefined })
    expect(out.b).toBeUndefined()
    const moved = settleAnchors([{ ...a, endMin: 910 }, b], "a")
    expect(moved.b).toMatchObject({ startMin: 910, startCertainty: "estimated" })
  })

  it("an instant that moves drags the blocks that name it", () => {
    const ev = { ...blk("e", 930, 930), kind: "instant" } as TimeEntry
    const a = blk("a", 800, 900, { endEventId: "e" })
    expect(settleAnchors([a, ev], "e").a).toMatchObject({ endMin: 930 })
  })
})
