import { describe, expect, it } from "vitest"
import type { SkillBank } from "@/lib/skills/types"
import { starterFlow } from "./flow"
import { reactionOfCorrection, reactionOfDismiss, reactionsOfAdd } from "./learn"
import { runHelper } from "./run"
import { systemText } from "./wire"
import type { ProposedBlock } from "./types"

const block = (over: Partial<ProposedBlock> = {}): ProposedBlock => ({ id: "b1", day: "2026-11-01", activity: "walking", startMin: 270, endMin: 310, startCert: "exact", endCert: "exact", notes: "", from: "walked", ...over })
const base = { input: "walked 4:30 to 5:10", skillsUsed: ["s1"] }

describe("reactionsOfAdd", () => {
  it("is a success on every aspect when the block went in as proposed", () => {
    const r = reactionsOfAdd(block(), block(), base)
    expect(r.map((x) => [x.category, !!x.severity])).toEqual([["wire:activity-name", false], ["wire:time-edge", false]])
  })
  it("is a failure with the corrected value for each aspect the person changed", () => {
    const r = reactionsOfAdd(block({ place: { name: "Park", source: "stated", isNew: false } }), block({ activity: "hiking", endMin: 330 }), base)
    expect(r.map((x) => [x.category, x.severity, x.should])).toEqual([
      ["wire:activity-name", 1, "hiking"],
      ["wire:time-edge", 1, "4:30 AM-5:30 AM"],
      ["wire:place", 1, "no place"],
    ])
  })
})

describe("dismiss and correction", () => {
  it("a dismissal is a failure with no better move, a correction carries the new words", () => {
    expect(reactionOfDismiss(block(), base)).toMatchObject({ category: "wire:extra-entry", severity: 2 })
    expect(reactionOfDismiss(block(), base).should).toBeUndefined()
    expect(reactionOfCorrection(block(), "actually it was a run", base)).toMatchObject({ category: "wire:correction", should: "actually it was a run" })
  })
})

describe("skills in the WIRE prompt", () => {
  const bank: SkillBank = { agentId: "tracking-helper", skills: [{ id: "k1", name: "Hiking not walking", principle: 'Mistake: "walking". Better: "hiking".', whenToApply: "walked on a trail", kind: "task", category: "wire:activity-name", status: "active", source: "distilled", from: [], uses: 0, wins: 0 }] }
  const ctx = { now: new Date(2026, 10, 2, 12), activityPens: [], locationPens: [], history: [] }
  it("adds nothing to the prompt without a bank, and a skill block with one that fits", () => {
    expect(systemText(starterFlow())).toBe(systemText(starterFlow(), ""))
    expect(systemText(starterFlow(), "SKILLS FOR THIS INPUT\n- x")).toContain("SKILLS FOR THIS INPUT")
  })
  it("puts a fitting learned skill in the prompt and reports it as used", async () => {
    let seen = ""
    const call = async (req: { system: string }) => {
      seen = req.system
      return { segments: [{ activity: "walking", place: "", day: "", start: "T1", end: "T2", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "" }] }
    }
    const run = await runHelper({ text: "walked on a trail 4:30 to 5:10 yesterday", flow: starterFlow(), ctx, call, ladder: ["m"], bank })
    expect(seen).toContain("Hiking not walking")
    expect(run.skillsUsed).toEqual(["k1"])
    const none = await runHelper({ text: "walked on a trail 4:30 to 5:10 yesterday", flow: starterFlow(), ctx, call, ladder: ["m"] })
    expect(none.skillsUsed).toEqual([])
  })
})
