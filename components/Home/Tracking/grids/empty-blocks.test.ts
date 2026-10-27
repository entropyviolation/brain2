import { describe, expect, it } from "vitest"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import {
  clocksToEmptyBlock,
  emptyBlockDuration,
  emptyBlocksForDay,
  longestEmptyBlockIndex,
} from "./empty-blocks"

const FALLBACK = { startMin: 9 * 60, endMin: 10 * 60 }

function block(startMin: number, endMin: number, patch: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: `e-${startMin}-${endMin}`,
    date: "2026-06-20",
    scopeId: "activity",
    penId: "act-work",
    startMin,
    endMin,
    ...patch,
  }
}

describe("emptyBlocksForDay", () => {
  it("falls back to the waking window when the day is fully untracked", () => {
    expect(emptyBlocksForDay([], FALLBACK)).toEqual([
      { startMin: 9 * 60, endMin: 10 * 60, wraps: false },
    ])
    expect(emptyBlocksForDay([block(9 * 60, 9 * 60, { kind: "instant" })], FALLBACK)).toEqual([
      { startMin: 9 * 60, endMin: 10 * 60, wraps: false },
    ])
  })

  it("returns no gaps on a fully tracked day", () => {
    expect(emptyBlocksForDay([block(0, MINUTES_PER_DAY)], FALLBACK)).toEqual([])
  })

  it("lists gaps chronologically and picks the longest as default", () => {
    const entries = [block(0, 9 * 60), block(10 * 60, 12 * 60), block(15 * 60, MINUTES_PER_DAY)]
    const gaps = emptyBlocksForDay(entries, FALLBACK)
    expect(gaps).toEqual([
      { startMin: 9 * 60, endMin: 10 * 60, wraps: false },
      { startMin: 12 * 60, endMin: 15 * 60, wraps: false },
    ])
    expect(longestEmptyBlockIndex(gaps)).toBe(1)
    expect(emptyBlockDuration(gaps[1])).toBe(3 * 60)
  })

  it("does not treat sleep or other painted cells as empty", () => {
    const sleep = block(0, 7 * 60, { penId: "act-sleep", generatedBy: { kind: "sleep", id: "2026-06-20" } })
    const work = block(9 * 60, 17 * 60)
    const gaps = emptyBlocksForDay([sleep, work], FALLBACK)
    expect(gaps).toEqual([
      { startMin: 7 * 60, endMin: 9 * 60, wraps: false },
      { startMin: 17 * 60, endMin: MINUTES_PER_DAY, wraps: false },
    ])
    expect(longestEmptyBlockIndex(gaps)).toBe(1)
  })

  it("merges empty midnight ends into one wrapping gap", () => {
    const gaps = emptyBlocksForDay([block(8 * 60, 22 * 60)], FALLBACK)
    expect(gaps).toEqual([{ startMin: 22 * 60, endMin: 8 * 60, wraps: true }])
    expect(emptyBlockDuration(gaps[0])).toBe(10 * 60)
    expect(longestEmptyBlockIndex(gaps)).toBe(0)
  })

  it("keeps a wrapping fallback when the whole day is untracked", () => {
    expect(emptyBlocksForDay([], { startMin: 22 * 60, endMin: 7 * 60 })).toEqual([
      { startMin: 22 * 60, endMin: 7 * 60, wraps: true },
    ])
  })
})

describe("clocksToEmptyBlock", () => {
  it("treats 00:00 as the end of this day, not a wrap", () => {
    expect(clocksToEmptyBlock(9 * 60, 0)).toEqual({
      startMin: 9 * 60,
      endMin: MINUTES_PER_DAY,
      wraps: false,
    })
  })
})
