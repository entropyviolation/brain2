import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { phoneEntryId } from "./ids"
import { mergePhoneEntries, preview, recordToEntries, type EntryTargets } from "./to-entries"
import type { CallRecord, MessageRecord } from "./types"

const targets: EntryTargets = { textsScopeId: "iphone-texts", callsScopeId: "iphone-calls", penFor: () => "pen-jane" }
const at = (h: number, m: number, s = 0, day = 21) => new Date(2026, 9, day, h, m, s).getTime()

const text: MessageRecord = {
  type: "message",
  source: "messages",
  sourceId: "GUID-1",
  at: at(17, 42, 30),
  direction: "out",
  party: { handle: "+15551234567" },
  threadId: "chat1",
  body: "on my   way\nsee you",
}

const call = (over: Partial<CallRecord> = {}): CallRecord => ({
  type: "call",
  source: "calls",
  sourceId: "CALL-1",
  at: at(15, 2, 10),
  direction: "in",
  party: { handle: "+15551234567" },
  durationSec: 15 * 60,
  answered: true,
  ...over,
})

describe("recordToEntries", () => {
  it("makes a text an exact instant with a short preview and a per-record stamp", () => {
    const [e] = recordToEntries(text, targets)
    expect(e).toMatchObject({
      date: "2026-10-21",
      scopeId: "iphone-texts",
      penId: "pen-jane",
      kind: "instant",
      startMin: 17 * 60 + 42,
      endMin: 17 * 60 + 42,
      title: "→ on my way see you",
      generatedBy: { kind: "phone-sync", id: "messages:GUID-1" },
    })
    expect(e.precision).toBeUndefined()
    expect(recordToEntries(text, targets)[0].id).toBe(e.id)
  })

  it("caps the preview", () => {
    expect(preview("x".repeat(500)).length).toBe(120)
  })

  it("makes an answered call an interval, rounding a partial minute up", () => {
    const [e] = recordToEntries(call({ durationSec: 20 }), targets)
    expect(e).toMatchObject({ scopeId: "iphone-calls", startMin: 15 * 60 + 2, endMin: 15 * 60 + 3 })
    expect(e.kind).toBeUndefined()
  })

  it("slices a call at local midnight with one span id", () => {
    const rows = recordToEntries(call({ at: at(23, 50), durationSec: 30 * 60 }), targets)
    expect(rows.map((r) => [r.date, r.startMin, r.endMin])).toEqual([
      ["2026-10-21", 23 * 60 + 50, 1440],
      ["2026-10-22", 0, 20],
    ])
    expect(rows[0].spanId).toBe(rows[1].spanId)
    expect(new Set(rows.map((r) => r.id)).size).toBe(2)
  })

  it("makes a missed call an instant", () => {
    const [e] = recordToEntries(call({ answered: false, durationSec: 0 }), targets)
    expect(e).toMatchObject({ kind: "instant", title: "missed call" })
  })
})

describe("mergePhoneEntries", () => {
  it("adds once, and never brings back a row the person deleted", () => {
    const rows = recordToEntries(text, targets)
    const first = mergePhoneEntries([], [], rows)
    expect(first.added).toBe(1)
    const again = mergePhoneEntries(first.entries, [], rows)
    expect(again.added).toBe(0)
    expect(again.entries).toHaveLength(1)
    const deleted = mergePhoneEntries([] as TimeEntry[], [phoneEntryId("messages", "GUID-1")], rows)
    expect(deleted.added).toBe(0)
  })
})
