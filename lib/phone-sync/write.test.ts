import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyIphoneText } from "@/lib/ingest/apply-phone-life"
import { applyPhoneRecords, inTrackWindow, textDaysFromEnv } from "./write"
import type { MessageRecord } from "./types"

beforeEach(() => {
  resetAllStores()
  // The records below are dated Oct 21, 2026; keep them inside the 30-day text window.
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

describe("text window", () => {
  const now = new Date(2026, 9, 22, 12, 0).getTime()
  const at = (daysAgo: number) => now - daysAgo * 86_400_000

  it("keeps recent texts and every call", () => {
    expect(inTrackWindow({ ...msg("a", "1"), at: at(29) }, now, 30)).toBe(true)
    expect(inTrackWindow({ ...msg("a", "1"), at: at(31) }, now, 30)).toBe(false)
    expect(inTrackWindow({ ...msg("a", "1"), at: at(1) }, now, 0)).toBe(false)
    const call = { type: "call", source: "calls", sourceId: "c", at: at(400), direction: "in", party: { handle: "1" }, answered: true, durationSec: 60 } as const
    expect(inTrackWindow(call, now, 0)).toBe(true)
  })

  it("writes only texts inside the window and counts the rest as skipped", () => {
    const result = applyPhoneRecords([{ ...msg("old", "1"), at: at(90) }, { ...msg("new", "1"), at: at(2) }], [], { textDays: 30, now })
    expect(result).toEqual({ read: 2, written: 1, skipped: 1 })
  })

  it("reads the env setting", () => {
    expect(textDaysFromEnv(undefined)).toBe(30)
    expect(textDaysFromEnv("")).toBe(30)
    expect(textDaysFromEnv("90")).toBe(90)
    expect(textDaysFromEnv("0")).toBe(0)
    expect(textDaysFromEnv("abc")).toBe(30)
  })
})
