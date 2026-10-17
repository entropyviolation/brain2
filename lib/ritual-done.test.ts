import { describe, expect, it } from "vitest"
import { ritualDoneStamp } from "@/lib/ritual-done"

describe("ritualDoneStamp", () => {
  const now = new Date(2026, 9, 17, 21, 0, 0)
  it("is noon on a past night", () => {
    expect(ritualDoneStamp("day", "2026-10-16", now)).toEqual(new Date(2026, 9, 16, 12, 0, 0))
  })
  it("never lands after now", () => {
    const morning = new Date(2026, 9, 17, 8, 0, 0)
    expect(ritualDoneStamp("day", "2026-10-17", morning)).toEqual(morning)
  })
  it("is the last day of a month", () => {
    expect(ritualDoneStamp("month", "2026-09", now)).toEqual(new Date(2026, 8, 30, 12, 0, 0))
  })
})
