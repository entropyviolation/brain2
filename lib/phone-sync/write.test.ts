import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyIphoneText } from "@/lib/ingest/apply-phone-life"
import { applyPhoneRecords } from "./write"
import type { MessageRecord } from "./types"

beforeEach(() => {
  resetAllStores()
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

describe("applyPhoneRecords", () => {
  it("writes once, makes the scope and pen, and is idempotent", () => {
    const people = [{ id: "p1", name: "Jane", phones: ["555-123-4567"] }]
    const first = applyPhoneRecords([msg("a", "+15551234567"), msg("b", "+15551234567")], people)
    expect(first).toEqual({ read: 2, written: 2, skipped: 0 })
    const again = applyPhoneRecords([msg("a", "+15551234567")], people)
    expect(again.written).toBe(0)

    const { scopes, entries } = useTimeTrackingStore.getState()
    const texts = scopes.find((s) => s.id === "iphone-texts")
    expect(texts?.pens.map((p) => p.name)).toEqual(["Jane"])
    expect(entries.filter((e) => e.generatedBy?.kind === "phone-sync")).toHaveLength(2)
  })

  it("shares the pen a BIM text: verb made for the same person", () => {
    applyIphoneText("Jane on my way", new Date(2026, 9, 21, 9, 0))
    applyPhoneRecords([msg("a", "+15550000000", "Jane")], [{ id: "p1", name: "Jane" }])
    const texts = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-texts")
    expect(texts?.pens).toHaveLength(1)
  })

  it("names an unknown number's pen by the number", () => {
    applyPhoneRecords([msg("a", "5550000000")], [])
    const texts = useTimeTrackingStore.getState().scopes.find((s) => s.id === "iphone-texts")
    expect(texts?.pens[0].name).toBe("+1 (555) 000-0000")
  })
})
