import { describe, expect, it } from "vitest"
import { fromClock, linkTimes, toClock } from "@/lib/assumed-time-math"

describe("linkTimes", () => {
  const base = { start: 9 * 60, duration: 30, finish: 9 * 60 + 30 }
  it("start moves the finish", () => {
    expect(linkTimes(base, "start", 10 * 60)).toEqual({ start: 600, duration: 30, finish: 630 })
  })
  it("duration moves the finish", () => {
    expect(linkTimes(base, "duration", 90)).toEqual({ start: 540, duration: 90, finish: 630 })
  })
  it("finish keeps the start and changes the duration", () => {
    expect(linkTimes(base, "finish", 10 * 60)).toEqual({ start: 540, duration: 60, finish: 600 })
  })
  it("wraps past midnight", () => {
    expect(linkTimes({ start: 23 * 60, duration: 0, finish: 23 * 60 }, "duration", 90).finish).toBe(30)
    expect(linkTimes({ start: 23 * 60, duration: 0, finish: 23 * 60 }, "finish", 30).duration).toBe(90)
  })
  it("reads and writes clock strings", () => {
    expect(toClock(fromClock("07:05")!)).toBe("07:05")
    expect(fromClock("25:00")).toBeNull()
  })
})
