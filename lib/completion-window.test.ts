import { describe, expect, it } from "vitest"
import {
  clampAnchorMinutes,
  completionWindow,
  DEFAULT_DAY_ANCHOR_MINUTES,
  formatAnchorMinutes,
  lastPaintedRun,
} from "@/lib/completion-window"

const day = new Date(2026, 8, 17)
const now = new Date(2026, 8, 17, 20, 30)

/** Minutes past midnight for `[from, to)`, the shape `lib/tracked-time.ts` returns. */
function painted(fromHour: number, fromMin: number, toHour: number, toMin: number): number[] {
  const start = fromHour * 60 + fromMin
  const end = toHour * 60 + toMin
  return Array.from({ length: end - start }, (_, i) => start + i)
}

describe("completion window", () => {
  it("assumes the work finished just now on the day that is still running", () => {
    const window = completionWindow({ date: day, durationMinutes: 40, now })
    expect(window.kind).toBe("now")
    expect(window.completedAt).toEqual(now)
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 19, 50))
    expect(window.estimatedFields).toEqual(["completedDate", "startedAt"])
    expect(window.basis).toContain("just now")
  })

  it("falls back to the day anchor once the day is over, not to midnight or noon", () => {
    const window = completionWindow({ date: new Date(2026, 8, 15), durationMinutes: 30, now })
    expect(window.kind).toBe("anchor")
    expect(window.completedAt).toEqual(new Date(2026, 8, 15, 21, 0))
    expect(window.startedAt).toEqual(new Date(2026, 8, 15, 20, 30))
    expect(window.basis).toContain("9:00 PM")
  })

  it("honors a custom anchor", () => {
    const window = completionWindow({
      date: new Date(2026, 8, 15),
      durationMinutes: 0,
      now,
      anchorMinutes: 7 * 60 + 30,
    })
    expect(window.completedAt).toEqual(new Date(2026, 8, 15, 7, 30))
    expect(window.estimatedFields).toEqual(["completedDate"])
  })

  it("reads both ends off painted Tracking time when the run covers the duration", () => {
    const window = completionWindow({
      date: day,
      durationMinutes: 45,
      trackedMinutes: painted(19, 0, 20, 0),
      now,
    })
    expect(window.kind).toBe("tracked")
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 19, 0))
    expect(window.completedAt).toEqual(new Date(2026, 8, 17, 20, 0))
    expect(window.estimatedFields).toEqual([])
    expect(window.basis).toBe("painted in Tracking 7:00 PM–8:00 PM")
  })

  it("keeps the painted finish but assumes the start when the run is short", () => {
    const window = completionWindow({
      date: day,
      durationMinutes: 60,
      trackedMinutes: painted(19, 30, 20, 0),
      now,
    })
    expect(window.completedAt).toEqual(new Date(2026, 8, 17, 20, 0))
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 19, 0))
    expect(window.estimatedFields).toEqual(["startedAt"])
  })

  it("uses the last painted run, so scattered paint does not stretch the window", () => {
    const scattered = [...painted(9, 0, 9, 30), ...painted(19, 30, 20, 0)]
    expect(lastPaintedRun(scattered)).toEqual([19 * 60 + 30, 20 * 60 - 1])
    expect(lastPaintedRun([])).toBeNull()
    const window = completionWindow({ date: day, durationMinutes: 30, trackedMinutes: scattered, now })
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 19, 30))
    expect(window.completedAt).toEqual(new Date(2026, 8, 17, 20, 0))
  })

  it("never starts a window before the day it belongs to", () => {
    const early = new Date(2026, 8, 17, 0, 20)
    const window = completionWindow({ date: day, durationMinutes: 90, now: early })
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 0, 0))
  })

  it("clamps and formats the anchor", () => {
    expect(clampAnchorMinutes(undefined)).toBe(DEFAULT_DAY_ANCHOR_MINUTES)
    expect(clampAnchorMinutes(-5)).toBe(0)
    expect(clampAnchorMinutes(99999)).toBe(24 * 60 - 1)
    expect(formatAnchorMinutes(DEFAULT_DAY_ANCHOR_MINUTES)).toBe("9:00 PM")
    expect(formatAnchorMinutes(7 * 60 + 5)).toBe("7:05 AM")
  })
})

// A logged night says more about a past day than any fixed default can.
describe("completion window against the sleep log", () => {
  it("prefers the night's bedtime to the day anchor for a day that is over", () => {
    const window = completionWindow({
      date: new Date(2026, 8, 15),
      durationMinutes: 30,
      now,
      // In bed at 11:00 PM: the anchor becomes 10:30, not the 9:00 PM default.
      awake: { wake: 7 * 60, bed: 23 * 60 },
    })
    expect(window.completedAt).toEqual(new Date(2026, 8, 15, 22, 30))
    expect(window.startedAt).toEqual(new Date(2026, 8, 15, 22, 0))
    expect(window.basis).toContain("sleep log")
  })

  it("handles an after-midnight bedtime without running past the day", () => {
    const window = completionWindow({
      date: new Date(2026, 8, 15),
      durationMinutes: 0,
      now,
      // Asleep at 00:45, i.e. minute 1485 of the 15th.
      awake: { wake: 7 * 60, bed: 24 * 60 + 45 },
    })
    expect(window.completedAt).toEqual(new Date(2026, 8, 15, 23, 59))
  })

  it("will not backdate a session into hours the user was asleep", () => {
    const early = new Date(2026, 8, 17, 8, 0)
    const window = completionWindow({
      date: day,
      durationMinutes: 120,
      now: early,
      awake: { wake: 7 * 60 },
    })
    // Two hours before 8am would be 6am, an hour before they got up.
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 7, 0))
    expect(window.completedAt).toEqual(early)
  })

  it("still falls back to midnight when the night was never logged", () => {
    const early = new Date(2026, 8, 17, 0, 20)
    const window = completionWindow({ date: day, durationMinutes: 90, now: early })
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 0, 0))
  })

  it("does not push a finish forward to the wake time", () => {
    // Completing something at 3am on a day you got up at 7 is odd but recorded;
    // the clamp must not rewrite an observed time into the future.
    const smallHours = new Date(2026, 8, 17, 3, 0)
    const window = completionWindow({ date: day, durationMinutes: 30, now: smallHours, awake: { wake: 7 * 60 } })
    expect(window.completedAt).toEqual(smallHours)
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 2, 30))
  })

  it("leaves painted Tracking time alone — observed beats assumed", () => {
    const window = completionWindow({
      date: day,
      durationMinutes: 45,
      trackedMinutes: painted(5, 0, 6, 0),
      now,
      awake: { wake: 7 * 60, bed: 23 * 60 },
    })
    expect(window.kind).toBe("tracked")
    expect(window.startedAt).toEqual(new Date(2026, 8, 17, 5, 0))
  })
})

describe("anchor helpers", () => {
  it("clamps and formats", () => {
    expect(clampAnchorMinutes(undefined)).toBe(DEFAULT_DAY_ANCHOR_MINUTES)
    expect(clampAnchorMinutes(-5)).toBe(0)
    expect(clampAnchorMinutes(99999)).toBe(24 * 60 - 1)
    expect(formatAnchorMinutes(DEFAULT_DAY_ANCHOR_MINUTES)).toBe("9:00 PM")
    expect(formatAnchorMinutes(7 * 60 + 5)).toBe("7:05 AM")
  })
})
