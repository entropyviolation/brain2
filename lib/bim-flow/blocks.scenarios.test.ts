import { describe, expect, it } from "vitest"
import { assembleBlocks, fitToUnknown, placeSinceClock } from "./blocks"
import type { ActivitySignal, TimeBlock } from "./types"

const D = "2026-10-29"
const at = (hm: string, day = D) => new Date(`${day}T${hm}:00`).toISOString()
const sig = (hm: string, activity: string, relation: ActivitySignal["relation"], o: Partial<ActivitySignal> = {}): ActivitySignal => ({ messageId: `${hm}-${activity}`, at: at(hm), activity, relation, ...o })
const clock = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, "0")}:${String(new Date(iso).getMinutes()).padStart(2, "0")}`
const show = (bs: TimeBlock[]) => bs.map((b) => `${clock(b.start)}-${clock(b.end)} ${b.activity}${b.estimated ? "*" : ""}`)

describe("block timelines", () => {
  it("the garlic confit afternoon", () => {
    const b = assembleBlocks([sig("13:30", "cooking", "starting"), sig("14:00", "cooking", "finished"), sig("14:05", "walking", "starting"), sig("14:40", "walking", "finished")])
    expect(show(b)).toEqual(["13:30-14:00 cooking", "14:05-14:40 walking"])
  })

  it("a finish with no start assumes the default length and says so", () => {
    expect(show(assembleBlocks([sig("11:00", "dishes", "finished")]))).toEqual(["10:30-11:00 dishes*"])
  })

  it("did earlier is the same as a finish", () => {
    expect(show(assembleBlocks([sig("11:00", "dishes", "did_earlier")]))).toEqual(["10:30-11:00 dishes*"])
  })

  it("keeps a block alive across several doing-now messages, then caps it", () => {
    const b = assembleBlocks([sig("09:00", "reading", "starting"), sig("09:20", "reading", "doing_now"), sig("09:50", "reading", "doing_now")])
    // Last message 09:50, then default 30 more minutes, estimated.
    expect(show(b)).toEqual(["09:00-10:20 reading*"])
  })

  it("never runs more than 90 minutes past the last message", () => {
    const b = assembleBlocks([sig("08:00", "reading", "starting"), sig("14:00", "walking", "starting"), sig("14:30", "walking", "finished")])
    expect(show(b)[0]).toBe("08:00-09:30 reading*")
  })

  it("minutes left closes the block at that moment", () => {
    expect(show(assembleBlocks([sig("18:00", "cooking", "doing_now", { minutesLeft: 40 })]))).toEqual(["18:00-18:40 cooking*"])
  })

  it("a since clock backdates the start", () => {
    expect(show(assembleBlocks([sig("17:09", "walking", "doing_now", { since: "4:46" }), sig("17:30", "walking", "finished")]))).toEqual(["16:46-17:30 walking"])
  })

  it("a since that echoes the send minute is ignored", () => {
    expect(show(assembleBlocks([sig("17:09", "walking", "doing_now", { since: "5:09" }), sig("17:30", "walking", "finished")]))).toEqual(["17:09-17:30 walking"])
  })

  it("am/pm and 24-hour clocks are placed", () => {
    expect(placeSinceClock("4:46pm", new Date(at("17:09")))?.getHours()).toBe(16)
    expect(placeSinceClock("16:46", new Date(at("17:09")))?.getHours()).toBe(16)
    expect(placeSinceClock("12:05am", new Date(at("00:30")))?.getHours()).toBe(0)
    expect(placeSinceClock("25:00", new Date(at("12:00")))).toBeNull()
    expect(placeSinceClock("noon", new Date(at("12:00")))).toBeNull()
  })

  it("a since after midnight reaches back to yesterday evening when needed", () => {
    // "since 11:30" sent at 00:20 is 23:30 the day before.
    const p = placeSinceClock("11:30", new Date(at("00:20")))!
    expect(p.getDate()).toBe(28)
    expect(p.getHours()).toBe(23)
  })

  it("interleaved activities close each other at the switch", () => {
    const b = assembleBlocks([sig("10:00", "coding", "starting"), sig("10:30", "dishes", "starting"), sig("10:40", "coding", "doing_now"), sig("11:10", "coding", "finished")])
    expect(show(b)).toEqual(["10:00-10:30 coding", "10:30-10:40 dishes", "10:40-11:10 coding"])
  })

  it("signals out of order are sorted by time", () => {
    const b = assembleBlocks([sig("14:00", "cooking", "finished"), sig("13:30", "cooking", "starting")])
    expect(show(b)).toEqual(["13:30-14:00 cooking"])
  })

  it("an empty day gives no blocks", () => expect(assembleBlocks([])).toEqual([]))

  it("blocks from one batch do not overlap", () => {
    // A finish with no start can reach back over the previous block. That is a real hole if it shows.
    const b = assembleBlocks([sig("13:30", "cooking", "starting"), sig("14:00", "cooking", "finished"), sig("14:10", "dishes", "finished")])
    const sorted = [...b].sort((x, y) => x.start.localeCompare(y.start))
    for (let i = 1; i < sorted.length; i++) expect(Date.parse(sorted[i]!.start)).toBeGreaterThanOrEqual(Date.parse(sorted[i - 1]!.end))
  })

  it("a finish with no start starts where the last block ended, not over it", () => {
    const b = assembleBlocks([sig("13:30", "cooking", "starting"), sig("14:00", "cooking", "finished"), sig("14:10", "dishes", "finished")])
    expect(show(b)).toEqual(["13:30-14:00 cooking", "14:00-14:10 dishes*"])
    expect(b[1]!.why).toContain("where the last block ended")
  })

  it("a finish right on the end of the last block adds nothing", () => {
    expect(show(assembleBlocks([sig("13:30", "cooking", "starting"), sig("14:00", "cooking", "finished"), sig("14:00", "dishes", "finished")]))).toEqual(["13:30-14:00 cooking"])
  })

  it("estimated blocks never claim to be exact", () => {
    for (const b of assembleBlocks([sig("11:00", "dishes", "finished"), sig("12:00", "reading", "starting")])) if (b.why.includes("assumed") || b.why.includes("left open")) expect(b.estimated).toBe(true)
  })
})

describe("fitToUnknown", () => {
  const span = (a: string, b: string) => ({ start: Date.parse(at(a)), end: Date.parse(at(b)) })
  const blk = (a: string, b: string): TimeBlock => ({ activity: "x", start: at(a), end: at(b), estimated: false, why: "t", evidence: [] })

  it("drops a block inside confirmed time", () => expect(fitToUnknown([blk("10:00", "10:30")], [span("09:00", "11:00")])).toEqual([]))
  it("keeps a block outside confirmed time whole", () => expect(fitToUnknown([blk("12:00", "12:30")], [span("09:00", "11:00")])).toHaveLength(1))
  it("cuts a block that crosses the edge", () => expect(show(fitToUnknown([blk("10:30", "11:30")], [span("09:00", "11:00")]))).toEqual(["11:00-11:30 x*"]))
  it("splits a block around confirmed time in the middle", () => expect(show(fitToUnknown([blk("10:00", "12:00")], [span("10:30", "11:00")]))).toEqual(["10:00-10:30 x*", "11:00-12:00 x*"]))
  it("drops slivers under a minute", () => expect(fitToUnknown([blk("10:00", "10:30")], [span("10:00", "10:29:30".slice(0, 5))])).toBeDefined())
  it("handles two adjacent confirmed spans", () => expect(show(fitToUnknown([blk("09:00", "13:00")], [span("10:00", "11:00"), span("11:00", "12:00")]))).toEqual(["09:00-10:00 x*", "12:00-13:00 x*"]))
  it("with nothing confirmed returns the blocks as they were", () => {
    const b = [blk("10:00", "10:30")]
    expect(fitToUnknown(b, [])).toBe(b)
  })
})
