import { describe, expect, it } from "vitest"
import { detectClock } from "./detect-clock"

describe("detectClock", () => {
  it("reads a 24-hour clock at the start", () => {
    expect(detectClock("10:30 walked outside")).toEqual({ time: "10:30", rest: "walked outside" })
  })
  it("reads 12-hour times and a leading at", () => {
    expect(detectClock("lunch at 1:15pm with Sam")).toEqual({ time: "13:15", rest: "lunch with Sam" })
    expect(detectClock("3 pm - call mom")).toEqual({ time: "15:00", rest: "call mom" })
    expect(detectClock("12am slept")).toEqual({ time: "00:00", rest: "slept" })
  })
  it("returns null with no clock", () => {
    expect(detectClock("walked outside")).toBeNull()
    expect(detectClock("room 25:99")).toBeNull()
  })
})
