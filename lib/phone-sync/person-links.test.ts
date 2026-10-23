import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { personTimePenIds } from "@/lib/people-i-know"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { penHandle, relinkPhonePens, splitHandles, twinPenId, unlinkedPhoneHandles } from "./person-links"
import { applyPhoneRecords } from "./write"
import type { CallRecord, MessageRecord } from "./types"

beforeEach(() => {
  resetAllStores()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 22, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

const msg = (id: string, handle: string, displayName?: string): MessageRecord => ({
  type: "message",
  source: "messages",
  sourceId: id,
  at: new Date(2026, 9, 21, 9, 30).getTime(),
  direction: "in",
  party: { handle, displayName },
  threadId: "t",
  body: "hi",
})

const call = (id: string, handle: string): CallRecord => ({
  type: "call",
  source: "calls",
  sourceId: id,
  at: new Date(2026, 9, 21, 10, 0).getTime(),
  direction: "out",
  party: { handle },
  durationSec: 600,
  answered: true,
})

const pens = (scopeId: string) => useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)?.pens ?? []

describe("penHandle", () => {
  it("reads the stamp, a number name, or an email name", () => {
    expect(penHandle({ name: "Mom", handle: "5551234567" })).toBe("+15551234567")
    expect(penHandle({ name: "+1 (555) 123-4567" })).toBe("+15551234567")
    expect(penHandle({ name: "Ana@Example.com" })).toBe("ana@example.com")
    expect(penHandle({ name: "Mom" })).toBe("")
  })
})

describe("relinkPhonePens", () => {
  const scopes = () => [
    { id: "iphone-texts", pens: [{ id: "iphone-text-1-555-123-4567", name: "+1 (555) 123-4567" }] },
    { id: "activity", pens: [{ id: "act-work", name: "+1 (555) 123-4567" }] },
  ]

  it("names a number pen after the person who has the number", () => {
    const out = relinkPhonePens(scopes(), [{ id: "p1", name: "Ana", phones: ["555-123-4567"] }], 1)
    expect(out[0].pens[0]).toMatchObject({ name: "Ana", personId: "p1", editedAt: 1 })
    // Other views are left alone.
    expect(out[1].pens[0].name).toBe("+1 (555) 123-4567")
  })

  it("returns the same array when nothing changes", () => {
    const same = scopes()
    expect(relinkPhonePens(same, [])).toBe(same)
  })

  it("unlinks when the number comes off the person, and the number is the name again", () => {
    const linked = relinkPhonePens(scopes(), [{ id: "p1", name: "Ana", phones: ["5551234567"] }], 1)
    const out = relinkPhonePens(linked, [{ id: "p1", name: "Ana" }], 2)
    expect(out[0].pens[0]).not.toHaveProperty("personId")
    expect(out[0].pens[0].name).toBe("+1 (555) 123-4567")
  })

  it("keeps a pen linked by hand and follows a rename", () => {
    const hand = [{ id: "iphone-texts", pens: [{ id: "iphone-text-mom", name: "Mom", personId: "p1" }] }]
    expect(relinkPhonePens(hand, [{ id: "p1", name: "Mother" }], 1)[0].pens[0].name).toBe("Mother")
    expect(relinkPhonePens(hand, [], 1)[0].pens[0]).not.toHaveProperty("personId")
  })
})

describe("phone sync with links", () => {
  it("stamps the number on an unknown pen, then follows the person once linked", () => {
    applyPhoneRecords([msg("a", "+15551234567", "Mom")], [])
    expect(pens("iphone-texts")[0]).toMatchObject({ name: "Mom", handle: "+15551234567" })

    const people = [{ id: "p1", name: "Ana", phones: ["+15551234567"] }]
    useTimeTrackingStore.setState({ scopes: relinkPhonePens(useTimeTrackingStore.getState().scopes, people) })
    applyPhoneRecords([msg("b", "+15551234567")], people)
    // One pen, now Ana's, holding both texts.
    expect(pens("iphone-texts")).toHaveLength(1)
    expect(pens("iphone-texts")[0]).toMatchObject({ name: "Ana", personId: "p1" })
    expect(new Set(useTimeTrackingStore.getState().entries.map((e) => e.penId)).size).toBe(1)
  })

  it("keeps one call pen across a rename and counts it as time together", () => {
    applyPhoneRecords([call("c1", "+15551234567")], [{ id: "p1", name: "Ana", phones: ["5551234567"] }])
    applyPhoneRecords([call("c2", "+15551234567")], [{ id: "p1", name: "Ana Ruiz", phones: ["5551234567"] }])
    const callPens = pens("iphone-calls")
    expect(callPens).toHaveLength(1)
    expect(callPens[0]).toMatchObject({ id: "iphone-call-ana", name: "Ana Ruiz", personId: "p1" })
    const ids = personTimePenIds({ id: "p1", title: "Ana Ruiz", description: "", personPipelines: undefined }, useTimeTrackingStore.getState().scopes)
    expect(ids).toContain("iphone-call-ana")
  })

  it("does not stamp a number on a pen matched by name only", () => {
    applyPhoneRecords([msg("a", "+15550000000", "Jane")], [{ id: "p1", name: "Jane" }])
    expect(pens("iphone-texts")[0]).not.toHaveProperty("handle")
    expect(pens("iphone-texts")[0].personId).toBe("p1")
  })
})

describe("helpers", () => {
  it("splits numbers from emails", () => {
    expect(splitHandles(["555 123 4567", "A@b.co", ""])).toEqual({ phones: ["+15551234567"], emails: ["a@b.co"] })
  })

  it("lists numbers no one has", () => {
    const scopes = [{ id: "iphone-calls", pens: [{ id: "x", name: "+1 (555) 000-0000" }, { id: "y", name: "Ana", personId: "p1" }] }]
    expect(unlinkedPhoneHandles(scopes, [])).toEqual(["+15550000000"])
    expect(unlinkedPhoneHandles(scopes, [{ id: "p2", name: "Bo", phones: ["5550000000"] }])).toEqual([])
  })

  it("pairs text and call pens", () => {
    expect(twinPenId("iphone-text-ana")).toBe("iphone-call-ana")
    expect(twinPenId("iphone-call-ana")).toBe("iphone-text-ana")
    expect(twinPenId("act-work")).toBeNull()
  })
})
