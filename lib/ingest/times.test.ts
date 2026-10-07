import { describe, it, expect } from "vitest"
import {
  parseBedClock,
  parseDurationMinutes,
  parseExpectedWhen,
  parseSleepRange,
  parseTrackWindow,
  parseWakeClock,
} from "./times"

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

describe("parseExpectedWhen", () => {
  it("reads spaced and dotted pm as 13:00", () => {
    for (const raw of ["1pm", "1:00pm", "1 PM", "1:00 PM", "1:00 p.m.", "1:00p.m.", "1 : 00 p. m."]) {
      expect(parseExpectedWhen(raw)).toEqual({ minutes: 13 * 60 })
    }
  })

  it("treats a bare clock as military time", () => {
    expect(parseExpectedWhen("12:04")).toEqual({ minutes: 12 * 60 + 4 })
    expect(parseExpectedWhen("18:37")).toEqual({ minutes: 18 * 60 + 37 })
    expect(parseExpectedWhen("1:00")).toEqual({ minutes: 60 })
    expect(parseExpectedWhen("6:37")).toEqual({ minutes: 6 * 60 + 37 })
  })

  it("reads a US date and does not invent a clock", () => {
    expect(parseExpectedWhen("7/4/26")).toEqual({ minutes: null, date: "2026-07-04" })
    expect(parseExpectedWhen("7/4/2026")).toEqual({ minutes: null, date: "2026-07-04" })
    expect(parseExpectedWhen("1:00 PM 7/4/26")).toEqual({ minutes: 13 * 60, date: "2026-07-04" })
    expect(parseExpectedWhen("2/31/26")).toBeNull()
  })

  it("leaves ordinary words, est, and unknown alone", () => {
    expect(parseExpectedWhen("left room at 3:30")).toBeNull()
    expect(parseExpectedWhen("buy oats")).toBeNull()
    expect(parseExpectedWhen("est")).toBeNull()
    expect(parseExpectedWhen("estimated")).toBeNull()
    expect(parseExpectedWhen("unknown")).toBeNull()
    expect(parseExpectedWhen("at 3:30")).toBeNull()
    expect(parseExpectedWhen("noon")).toEqual({ minutes: 12 * 60 })
  })
})
