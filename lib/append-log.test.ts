/**
 * lib/append-log.ts — stamped append-only writing log
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  formatAppendLog,
  formatAppendStamp,
  makeAppendLogEntry,
  parseAppendLog,
  parseAppendLogDraft,
  serializeAppendLog,
  sortAppendLogNewestFirst,
} from "./append-log"

function at(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0)
}

describe("append-log", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(at(2026, 9, 21, 9))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stamps a compact writing time", () => {
    expect(formatAppendStamp(at(2026, 9, 21, 9).toISOString())).toBe("9/21 9am")
    expect(formatAppendStamp(at(2026, 9, 21, 16, 17).toISOString())).toBe("9/21 4:17pm")
    expect(formatAppendStamp(at(2025, 9, 21, 16).toISOString())).toBe("9/21/25 4pm")
    expect(formatAppendStamp(null)).toBe("earlier")
  })

  it("treats leftover plaintext as one earlier entry", () => {
    const entries = parseAppendLog("ate at 1")
    expect(entries).toEqual([{ id: "legacy", createdAt: null, text: "ate at 1" }])
  })

  it("round-trips a versioned envelope", () => {
    const entry = makeAppendLogEntry("zoo 4-5", at(2026, 9, 21, 16))
    expect(entry?.text).toBe("zoo 4-5")
    const raw = serializeAppendLog([entry!])
    expect(JSON.parse(raw).v).toBe(1)
    expect(parseAppendLog(raw)[0]?.text).toBe("zoo 4-5")
    expect(parseAppendLogDraft(raw)).toBe("")
  })

  it("keeps an unsubmitted draft on the envelope without turning it into an entry", () => {
    const raw = serializeAppendLog([], "Ship September")
    expect(parseAppendLog(raw)).toEqual([])
    expect(parseAppendLogDraft(raw)).toBe("Ship September")
    expect(parseAppendLogDraft("plain leftover")).toBe("")
  })

  it("lists newest first and keeps earlier last", () => {
    const stamped = makeAppendLogEntry("zoo 4-5", at(2026, 9, 21, 16))!
    const ordered = sortAppendLogNewestFirst([
      { id: "legacy", createdAt: null, text: "ate at 1" },
      stamped,
    ])
    expect(ordered.map((e) => e.text)).toEqual(["zoo 4-5", "ate at 1"])
    expect(formatAppendLog([stamped, { id: "legacy", createdAt: null, text: "ate at 1" }])).toContain(
      "9/21 4pm - zoo 4-5",
    )
  })
})
