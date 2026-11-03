import { beforeEach, describe, expect, it } from "vitest"
import { tryResistance, tryResistanceOutcome } from "@/lib/ingest/bim-resistance"
import { detectResistance } from "./detect"
import { tacticScoreboard, withExperiment } from "./experiment"
import { readByRules } from "./read"
import { useOvercomeStore } from "./store"

const SAID = "i really have to finish those cds but i feel a lot of resistance, it was due a week ago"
beforeEach(() => useOvercomeStore.setState({ log: [] }))

describe("detectResistance", () => {
  it("hits strong and stacked weak signs", () => {
    expect(detectResistance(SAID).score).toBe(2)
    expect(detectResistance("need to book flights but im stuck").score).toBe(2)
    expect(detectResistance("i have to do the taxes but it was due a week ago").score).toBe(1)
  })
  it("ignores plain lines, questions and commands", () => {
    for (const t of ["making garlic confit now", "i have to buy milk", "why can't i start the cds?", "log: avoiding the cds"]) expect(detectResistance(t).hit).toBe(false)
  })
})

describe("experiment", () => {
  it("swaps the last slot for the least-offered tactic and keeps kinds distinct", () => {
    const reading = readByRules(SAID)
    const { tactics, experiment } = withExperiment([{ id: "a", name: "a", kind: "friction", do: "", helps: [] }, { id: "b", name: "b", kind: "dopamine", do: "", helps: [] }, { id: "c", name: "c", kind: "block", do: "", helps: [] }], reading, [])
    expect(tactics).toHaveLength(3)
    expect(experiment).toBe(tactics[2]!.id)
    expect(new Set(tactics.map((t) => t.kind)).size).toBe(3)
  })
})

describe("chat lane", () => {
  it("tags, offers an experiment, and records the outcome", async () => {
    const r = await tryResistance(SAID, false)
    expect(r?.route).toMatch(/^RESISTANCE/)
    expect(r?.text).toContain("🧪")
    const log = useOvercomeStore.getState().log
    expect(log[0]?.source).toBe("chat")
    expect(log[0]?.experiment).toBeTruthy()
    const first = r!.choices[0]!
    expect(tryResistanceOutcome(first.text)?.route).toBe("RESISTANCE · started")
    expect(tacticScoreboard(useOvercomeStore.getState().log).some((x) => x.started === 1)).toBe(true)
    expect(await tryResistance("making garlic confit now", false)).toBeNull()
  })
})
