import { describe, expect, it } from "vitest"
import { looksLikeDump, readDump } from "./parse"
import { readPatterns } from "@/lib/thought-patterns/patterns"

export const DUMP = `Maybe in llm mode you shouldnt just default to logging so much but i guess i would rather you err on the side of that as you're learning. <3 currently allowing myself to work on brain2 because THAT'S THE EFFECT ADDERALL HAS ON ME (i took one of my last ones knowing elijah has a refill on the way). So many things. So many things. Need 2.5 and balls (or hopefully less cash and more balls) to call cap again and clear car once and for all and be permanently mobile. I definitely should be at my big age and it will help for social and revenue. and mailing, and everything. anyway. gotta book arkansas tickets also. ASAP!!!! and figure out timing tulsa whatever. and need to make a christmas list. and need to make/ get chrsitmas gifts for everyone. also send hannah and mary lou and emily shad mail ASAP!!!!!!!!!!! and lucas/shelby thank u note and necklace. But right the fuck now (before 2pm) need to clean entire house.`

const NOW = new Date(2026, 10, 24, 7, 12)

describe("dump", () => {
  it("is a dump", () => {
    expect(looksLikeDump(DUMP)).toBe(true)
    expect(looksLikeDump("who do i need to text back?")).toBe(false)
  })
  it("reads the plans, one per person for mail", () => {
    const r = readDump(DUMP, NOW)
    expect(r.intentions.map((i) => i.title)).toEqual([
      "Call cap again and clear car",
      "Book arkansas tickets",
      "Figure out timing tulsa",
      "Make a christmas list",
      "Make or get chrsitmas gifts for everyone",
      "Send Hannah mail",
      "Send Mary Lou mail",
      "Send Emily Shad mail",
      "Send lucas/shelby thank u note and necklace",
      "Clean entire house",
    ])
    expect(r.intentions[0]!.gate).toBe("2.5 and balls")
    expect(r.intentions[1]!.urgency).toBe(4)
    const house = r.intentions.at(-1)!
    expect(house.urgency).toBe(5)
    expect(house.by).toBe(new Date(2026, 10, 24, 14, 0).getTime())
    expect(r.intake).toMatchObject({ drug: "adderall", last: true })
    expect(r.waiting).toEqual(["Elijah has refill on the way"])
    expect(r.feedback).toHaveLength(1)
  })
  it("reads the thought patterns", () => {
    expect(readPatterns(DUMP).map((h) => h.pattern).sort()).toEqual(
      ["deferral", "money-gate", "overwhelm", "permission", "scarcity", "self-kindness", "should", "substance-credit", "urgency-stack"],
    )
  })
  it("is not a stream or a short line", () => {
    expect(looksLikeDump("add to inbox: buy milk. need to call mom. gotta book flights and need to pack for the trip this week, also send the card")).toBe(false)
    expect(looksLikeDump("need to call mom")).toBe(false)
  })
})
