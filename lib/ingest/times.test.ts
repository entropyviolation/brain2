import { describe, it, expect } from "vitest"
import { parseSleepRange, parseDurationMinutes, parseTrackWindow, parseBedClock, parseWakeClock } from "./times"

const NOW = new Date(2026, 8, 19, 17, 42, 0)

describe("ingest times", () => {
  it("reads durations", () => {
    expect(parseDurationMinutes("exercise 30m")).toBe(30)
    expect(parseDurationMinutes("1h")).toBe(60)
    expect(parseDurationMinutes("1.5 hours")).toBe(90)
  })

  it("parses a sleep range across midnight", () => {
    const range = parseSleepRange("11:30-7:00")
    expect(range).toEqual({ sleptMin: -30, wokeMin: 420 })
  })

  it("treats 8–11 bed clocks as PM", () => {
    expect(parseBedClock("11:30")).toBe(23 * 60 + 30)
    expect(parseWakeClock("7:00")).toBe(7 * 60)
  })

  it("parses a clock window and a duration ending now", () => {
    expect(parseTrackWindow("9-11", NOW)).toEqual({ startMin: 9 * 60, endMin: 11 * 60 })
    expect(parseTrackWindow("30m", NOW)).toEqual({ startMin: 17 * 60 + 12, endMin: 17 * 60 + 42 })
  })
})
