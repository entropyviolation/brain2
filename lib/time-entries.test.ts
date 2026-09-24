import { describe, expect, it } from "vitest"
import {
  MINUTES_PER_DAY,
  clearRange,
  entriesOnDate,
  entryAt,
  formatDuration,
  mergeAdjacent,
  minuteMap,
  minutesToLabel,
  minutesToTimeString,
  moveEntry,
  paintRange,
  paintWrappingRange,
  sameVariants,
  splitEntry,
  timeStringToMinutes,
  toggleEntryVariant,
  totalMinutes,
  trackedDates,
  untrackedRanges,
  wrappingSlices,
  assignedPenIds,
  entryDisplayName,
  normalizeSecondaryPenIds,
  isInstant,
  instantsForDay,
  type TimeEntry,
} from "./time-entries"

const DATE = "2026-09-17"
let seq = 0
const makeId = () => `id-${++seq}`

function entry(patch: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: makeId(),
    date: DATE,
    scopeId: "activity",
    penId: "work",
    startMin: 540,
    endMin: 600,
    ...patch,
  }
}

const paint = (entries: TimeEntry[], patch: Partial<TimeEntry> & { startMin: number; endMin: number }) =>
  paintRange(
    entries,
    { date: DATE, scopeId: "activity", penId: "work", ...patch },
    makeId,
  )

describe("painting minute ranges", () => {
  it("creates a block with exclusive end minutes", () => {
    const result = paint([], { startMin: 540, endMin: 600 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startMin: 540, endMin: 600 })
    expect(totalMinutes(result)).toBe(60)
  })

  it("supports single-minute precision", () => {
    const result = paint([], { startMin: 541, endMin: 542 })
    expect(totalMinutes(result)).toBe(1)
  })

  it("ignores empty and inverted ranges", () => {
    expect(paint([], { startMin: 600, endMin: 600 })).toHaveLength(0)
    expect(totalMinutes(paint([], { startMin: 600, endMin: 540 }))).toBe(60)
  })

  it("merges a block that continues an identical one", () => {
    let result = paint([], { startMin: 540, endMin: 600 })
    result = paint(result, { startMin: 600, endMin: 660 })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startMin: 540, endMin: 660 })
  })

  it("keeps blocks apart when the pen differs", () => {
    let result = paint([], { startMin: 540, endMin: 600 })
    result = paint(result, { startMin: 600, endMin: 660, penId: "rest" })
    expect(result).toHaveLength(2)
  })

  it("keeps blocks apart when the variants differ", () => {
    let result = paint([], { startMin: 540, endMin: 600, variantIds: ["elijah"] })
    result = paint(result, { startMin: 600, endMin: 660, variantIds: ["rebecca"] })
    expect(result).toHaveLength(2)
  })

  it("keeps blocks apart when notes differ", () => {
    let result = paint([], { startMin: 540, endMin: 600, notes: "standup" })
    result = paint(result, { startMin: 600, endMin: 660 })
    expect(result).toHaveLength(2)
  })
})

describe("overlap resolution", () => {
  it("trims the tail of an earlier block", () => {
    let result = paint([], { startMin: 540, endMin: 660 })
    result = paint(result, { startMin: 600, endMin: 720, penId: "rest" })
    const sorted = result.sort((a, b) => a.startMin - b.startMin)
    expect(sorted.map((e) => [e.penId, e.startMin, e.endMin])).toEqual([
      ["work", 540, 600],
      ["rest", 600, 720],
    ])
  })

  it("trims the head of a later block", () => {
    let result = paint([], { startMin: 600, endMin: 720 })
    result = paint(result, { startMin: 540, endMin: 660, penId: "rest" })
    const sorted = result.sort((a, b) => a.startMin - b.startMin)
    expect(sorted.map((e) => [e.penId, e.startMin, e.endMin])).toEqual([
      ["rest", 540, 660],
      ["work", 660, 720],
    ])
  })

  it("splits a block painted through the middle", () => {
    let result = paint([], { startMin: 540, endMin: 720 })
    result = paint(result, { startMin: 600, endMin: 630, penId: "rest" })
    const sorted = result.sort((a, b) => a.startMin - b.startMin)
    expect(sorted.map((e) => [e.penId, e.startMin, e.endMin])).toEqual([
      ["work", 540, 600],
      ["rest", 600, 630],
      ["work", 630, 720],
    ])
    expect(new Set(sorted.map((e) => e.id)).size).toBe(3)
  })

  it("swallows a block it fully covers", () => {
    let result = paint([], { startMin: 600, endMin: 630 })
    result = paint(result, { startMin: 540, endMin: 720, penId: "rest" })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ penId: "rest", startMin: 540, endMin: 720 })
  })

  it("never double-books a minute", () => {
    let result = paint([], { startMin: 0, endMin: 600 })
    result = paint(result, { startMin: 300, endMin: 900, penId: "rest" })
    result = paint(result, { startMin: 120, endMin: 400, penId: "exercise" })
    expect(totalMinutes(result)).toBe(900)
    const map = minuteMap(result, DATE, "activity")
    expect(map.filter(Boolean)).toHaveLength(900)
  })
})

describe("clearing and editing", () => {
  it("erases a span and keeps the surrounding halves", () => {
    const painted = paint([], { startMin: 540, endMin: 720 })
    const result = clearRange(painted, DATE, "activity", 600, 660, makeId)
    const sorted = result.sort((a, b) => a.startMin - b.startMin)
    expect(sorted.map((e) => [e.startMin, e.endMin])).toEqual([
      [540, 600],
      [660, 720],
    ])
  })

  it("leaves other scopes untouched", () => {
    const entries = [entry(), entry({ scopeId: "location", penId: "home" })]
    expect(clearRange(entries, DATE, "activity", 0, MINUTES_PER_DAY, makeId)).toHaveLength(1)
  })

  it("splits a block at a minute", () => {
    const painted = paint([], { startMin: 540, endMin: 660 })
    const result = splitEntry(painted, painted[0].id, 600, makeId).sort((a, b) => a.startMin - b.startMin)
    expect(result.map((e) => [e.startMin, e.endMin])).toEqual([
      [540, 600],
      [600, 660],
    ])
    expect(result[0].splitAfter).toBe(true)
    expect(mergeAdjacent(result, DATE, "activity")).toHaveLength(2)
  })

  it("refuses to split outside the block", () => {
    const painted = paint([], { startMin: 540, endMin: 660 })
    expect(splitEntry(painted, painted[0].id, 540, makeId)).toHaveLength(1)
    expect(splitEntry(painted, painted[0].id, 900, makeId)).toHaveLength(1)
  })

  it("moves a block and clears what it lands on", () => {
    let painted = paint([], { startMin: 540, endMin: 600 })
    painted = paint(painted, { startMin: 700, endMin: 760, penId: "rest" })
    const work = painted.find((e) => e.penId === "work")!
    const result = moveEntry(painted, work.id, 720, 780, makeId)
    expect(totalMinutes(result)).toBe(80) // 20m of rest survives + 60m moved work
    expect(result.find((e) => e.penId === "work")).toMatchObject({ startMin: 720, endMin: 780 })
  })
})

describe("variants", () => {
  it("normalizes order so two selections compare equal", () => {
    expect(sameVariants(["b", "a"], ["a", "b"])).toBe(true)
    expect(sameVariants(["a"], ["a", "b"])).toBe(false)
    expect(sameVariants(undefined, [])).toBe(true)
  })

  it("holds several at once and toggles them off", () => {
    let e = entry({ variantIds: ["elijah"] })
    e = toggleEntryVariant(e, "rebecca")
    expect(e.variantIds).toEqual(["elijah", "rebecca"])
    e = toggleEntryVariant(e, "elijah")
    expect(e.variantIds).toEqual(["rebecca"])
    e = toggleEntryVariant(e, "rebecca")
    expect(e.variantIds).toBeUndefined()
  })
})

describe("reads", () => {
  it("finds the entry covering a minute, end-exclusive", () => {
    const painted = paint([], { startMin: 540, endMin: 600 })
    expect(entryAt(painted, DATE, "activity", 540)).toBeTruthy()
    expect(entryAt(painted, DATE, "activity", 599)).toBeTruthy()
    expect(entryAt(painted, DATE, "activity", 600)).toBeUndefined()
  })

  it("lists a whole day across scopes in clock order", () => {
    const entries = [
      entry({ startMin: 600, endMin: 660 }),
      entry({ scopeId: "location", penId: "home", startMin: 540, endMin: 560 }),
    ]
    expect(entriesOnDate(entries, DATE).map((e) => e.startMin)).toEqual([540, 600])
  })

  it("reports the gaps between blocks", () => {
    let painted = paint([], { startMin: 540, endMin: 600 })
    painted = paint(painted, { startMin: 660, endMin: 720, penId: "rest" })
    expect(untrackedRanges(painted, DATE, "activity")).toEqual([
      { startMin: 0, endMin: 540 },
      { startMin: 600, endMin: 660 },
      { startMin: 720, endMin: MINUTES_PER_DAY },
    ])
  })

  it("lists tracked dates newest first", () => {
    const entries = [entry(), entry({ date: "2026-09-19" }), entry({ date: "2026-09-18" })]
    expect(trackedDates(entries)).toEqual(["2026-09-19", "2026-09-18", "2026-09-17"])
  })

  it("merges adjacent identical blocks that arrived separately", () => {
    const entries = [entry({ startMin: 540, endMin: 600 }), entry({ startMin: 600, endMin: 660 })]
    expect(mergeAdjacent(entries, DATE, "activity")).toHaveLength(1)
  })
})

describe("formatting", () => {
  it("labels minutes as clock times", () => {
    expect(minutesToLabel(0)).toBe("12:00 AM")
    expect(minutesToLabel(547)).toBe("9:07 AM")
    expect(minutesToLabel(720)).toBe("12:00 PM")
    expect(minutesToLabel(1439)).toBe("11:59 PM")
  })

  it("round-trips time inputs", () => {
    expect(timeStringToMinutes("13:30")).toBe(810)
    expect(timeStringToMinutes("09:05")).toBe(545)
    expect(timeStringToMinutes("nope")).toBeNull()
    expect(timeStringToMinutes("25:00")).toBeNull()
    expect(minutesToTimeString(810)).toBe("13:30")
  })

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(95)).toBe("1h 35m")
  })
})

describe("blocks that continue past midnight", () => {
  it("treats 00:00 as the end of this day, not a wrap", () => {
    expect(wrappingSlices(DATE, 540, 0)).toEqual([{ date: DATE, startMin: 540, endMin: MINUTES_PER_DAY }])
  })

  it("splits 11 PM–2 AM onto both calendar days", () => {
    expect(wrappingSlices(DATE, 1380, 120)).toEqual([
      { date: DATE, startMin: 1380, endMin: MINUTES_PER_DAY },
      { date: "2026-09-18", startMin: 0, endMin: 120 },
    ])
  })

  it("honours an explicit end date when the clocks would not wrap", () => {
    expect(wrappingSlices(DATE, 1380, 1380, "2026-09-18")).toEqual([
      { date: DATE, startMin: 1380, endMin: MINUTES_PER_DAY },
      { date: "2026-09-18", startMin: 0, endMin: 1380 },
    ])
  })

  it("paints a wrapping range as one linked span of 3 hours", () => {
    const result = paintWrappingRange(
      [],
      { date: DATE, scopeId: "activity", penId: "work", startMin: 1380, endMin: 120 },
      makeId,
    )
    expect(result).toHaveLength(2)
    expect(result.map((e) => [e.date, e.startMin, e.endMin])).toEqual([
      [DATE, 1380, 1440],
      ["2026-09-18", 0, 120],
    ])
    expect(result[0].spanId).toBeTruthy()
    expect(result[0].spanId).toBe(result[1].spanId)
    expect(totalMinutes(result)).toBe(180)
  })

  it("does not merge a wrapping slice into an unlinked neighbour", () => {
    const earlier = paint([], { startMin: 1320, endMin: 1380 })
    const result = paintWrappingRange(
      earlier,
      { date: DATE, scopeId: "activity", penId: "work", startMin: 1380, endMin: 120 },
      makeId,
    )
    const thursday = result.filter((e) => e.date === DATE)
    expect(thursday).toHaveLength(2)
  })
})

describe("display name and secondary pens", () => {
  it("falls back to the pen name when the title is blank", () => {
    expect(entryDisplayName({ title: "walk to the beach" }, "walking")).toBe("walk to the beach")
    expect(entryDisplayName({ title: "  " }, "walking")).toBe("walking")
    expect(entryDisplayName({}, "walking")).toBe("walking")
    expect(entryDisplayName({}, "  ")).toBe("Block")
  })

  it("keeps the primary first and drops it from secondaries", () => {
    expect(assignedPenIds({ penId: "youtube", secondaryPenIds: ["spanish", "youtube"] })).toEqual([
      "youtube",
      "spanish",
    ])
    expect(assignedPenIds({ penId: "youtube" })).toEqual(["youtube"])
    expect(normalizeSecondaryPenIds("youtube", ["spanish", "youtube", "spanish"])).toEqual(["spanish"])
  })

  it("keeps adjacent blocks apart when secondaries differ", () => {
    let result = paint([], { startMin: 540, endMin: 600, secondaryPenIds: ["spanish"] })
    result = paint(result, { startMin: 600, endMin: 660 })
    expect(result).toHaveLength(2)
  })

  it("merges adjacent blocks that share the same secondaries", () => {
    let result = paint([], { startMin: 540, endMin: 600, secondaryPenIds: ["spanish"] })
    result = paint(result, { startMin: 600, endMin: 660, secondaryPenIds: ["spanish"] })
    expect(result).toHaveLength(1)
    expect(result[0].secondaryPenIds).toEqual(["spanish"])
  })
})

describe("discrete instants", () => {
  it("paints a zero-duration event that does not fill occupancy", () => {
    const result = paintRange(
      [],
      { date: DATE, scopeId: "activity", penId: "work", startMin: 540, endMin: 540, kind: "instant", title: "smoked weed" },
      makeId,
    )
    expect(result).toHaveLength(1)
    expect(isInstant(result[0])).toBe(true)
    expect(result[0]).toMatchObject({ startMin: 540, endMin: 540, title: "smoked weed" })
    expect(totalMinutes(result)).toBe(0)
    expect(minuteMap(result, DATE, "activity").filter(Boolean)).toHaveLength(0)
    expect(untrackedRanges(result, DATE, "activity")).toEqual([{ startMin: 0, endMin: MINUTES_PER_DAY }])
    expect(instantsForDay(result, DATE, "activity")).toHaveLength(1)
  })

  it("does not merge an instant into an adjacent interval of the same pen", () => {
    let result = paint([], { startMin: 540, endMin: 600 })
    result = paintRange(
      result,
      { date: DATE, scopeId: "activity", penId: "work", startMin: 600, endMin: 600, kind: "instant" },
      makeId,
    )
    expect(result.filter((e) => !isInstant(e))).toHaveLength(1)
    expect(result.filter(isInstant)).toHaveLength(1)
  })
})
