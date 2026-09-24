import { describe, expect, it } from "vitest"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { DEFAULT_WAKE_MIN, firstUnpaintedWakingHour } from "./waking-scroll"

function emptyMap(): Array<TimeEntry | null> {
  return new Array(MINUTES_PER_DAY).fill(null)
}

function paint(map: Array<TimeEntry | null>, from: number, to: number) {
  const block = { id: "e", date: "2026-06-20", scopeId: "activity", penId: "p", startMin: from, endMin: to } as TimeEntry
  for (let m = from; m < to; m++) map[m] = block
}

describe("firstUnpaintedWakingHour", () => {
  it("opens on 7 AM when the day is empty, not midnight", () => {
    expect(firstUnpaintedWakingHour({ map: emptyMap() })).toBe(7)
  })

  it("uses the logged wake hour", () => {
    expect(firstUnpaintedWakingHour({ map: emptyMap(), wakeMin: 9 * 60 })).toBe(9)
  })

  it("skips waking hours that are already painted", () => {
    const map = emptyMap()
    paint(map, 7 * 60, 9 * 60)
    expect(firstUnpaintedWakingHour({ map, wakeMin: 7 * 60 })).toBe(9)
  })

  it("stays on the wake hour when the whole waking window is painted", () => {
    const map = emptyMap()
    paint(map, 7 * 60, MINUTES_PER_DAY)
    expect(firstUnpaintedWakingHour({ map, wakeMin: 7 * 60 })).toBe(7)
  })

  it("treats a mid-hour wake as that hour when the rest of it is blank", () => {
    expect(firstUnpaintedWakingHour({ map: emptyMap(), wakeMin: 7 * 60 + 15 })).toBe(7)
  })

  it("does not open on midnight sleep when 12–7 is painted and wake is 7", () => {
    const map = emptyMap()
    paint(map, 0, 7 * 60)
    expect(firstUnpaintedWakingHour({ map, wakeMin: 7 * 60 })).toBe(7)
    expect(DEFAULT_WAKE_MIN).toBe(7 * 60)
  })

  it("stops at bedtime so an evening gap after sleep is not the landing", () => {
    const map = emptyMap()
    paint(map, 7 * 60, 18 * 60)
    expect(firstUnpaintedWakingHour({ map, wakeMin: 7 * 60, bedMin: 22 * 60 })).toBe(18)
  })
})
