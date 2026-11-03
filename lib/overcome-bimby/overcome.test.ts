import { beforeEach, describe, expect, it } from "vitest"
import { gather, pickTactics } from "./pick"
import { pushByRules, writePush } from "./push"
import { cleanReading, overdueIn, readByRules, readMessage } from "./read"
import { overcome } from "./run"
import { useOvercomeStore } from "./store"

const SAID = "i really have to finish those cds but i feel a lot of resistance but it needs to be done a week ago (super overdue)."

beforeEach(() => useOvercomeStore.setState({ log: [] }))

describe("read", () => {
  it("rules read the sample line", () => {
    const r = readByRules(SAID)
    expect(r.task).toMatch(/cds/i)
    expect(r.barrier).toBe("dread")
    expect(r.resistance).toMatch(/resistance/)
    expect(r.overdueDays).toBe(7)
  })
  it("counts days", () => expect(overdueIn("3 days late")).toBe(3))
  it("cleanReading drops a reading with no task and fixes a bad barrier", () => {
    expect(cleanReading({ task: " " })).toBeNull()
    expect(cleanReading({ task: "x", barrier: "nope" })?.barrier).toBe("unknown")
  })
  it("a model reading is kept", async () => {
    const call = async () => ({ task: "finish the CDs", resistance: "a lot", barrier: "dread", overdueDays: 7, motivation: ["fans waiting"], consequences: [] })
    const { reading, by } = await readMessage({ text: SAID, call, ladder: ["m"] })
    expect(by).toBe("model")
    expect(reading.motivation).toEqual(["fans waiting"])
  })
})

describe("pick", () => {
  it("offers three tactics of different kinds, leading with a small start", () => {
    const reading = readByRules(SAID)
    const out = pickTactics(reading, gather(reading, []), [])
    expect(out).toHaveLength(3)
    expect(new Set(out.map((t) => t.kind)).size).toBe(3)
    expect(out.map((t) => t.kind)).toContain("friction")
  })
  it("drops a tactic that already failed on this task and carries earlier words forward", () => {
    const store = useOvercomeStore.getState()
    const r1 = { ...readByRules(SAID), motivation: ["fans are waiting"] }
    const first = pickTactics(r1, gather(r1, []), [])
    const id = store.add(SAID, r1, first.map((t) => t.id))
    store.mark(id, first[0]!.id, "stuck")
    const log = useOvercomeStore.getState().log
    const history = gather(readByRules("still not doing the cds"), log)
    expect(history.motivation).toEqual(["fans are waiting"])
    expect(pickTactics(readByRules("still not doing the cds"), history, log).map((t) => t.id)).not.toContain(first[0]!.id)
  })
})

describe("push", () => {
  it("rules message quotes their words and names the first step", () => {
    const reading = { ...readByRules(SAID), motivation: ["fans are waiting"], consequences: ["super overdue"] }
    const history = gather(reading, [])
    const tactics = pickTactics(reading, history, [])
    const msg = pushByRules(reading, history, tactics)
    expect(msg).toContain("fans are waiting")
    expect(msg).toContain(tactics[0]!.name)
  })
  it("falls back to rules when the model answers short", async () => {
    const reading = readByRules(SAID)
    const history = gather(reading, [])
    const out = await writePush({ reading, history, tactics: pickTactics(reading, history, []), call: async () => ({ message: "ok" }), ladder: ["m"] })
    expect(out.by).toBe("rules")
  })
})

describe("overcome", () => {
  it("logs the resistance with no model and returns a push", async () => {
    const res = await overcome({ text: SAID, call: null, extract: [], prose: [] })
    expect(useOvercomeStore.getState().log).toHaveLength(1)
    expect(useOvercomeStore.getState().log[0]!.said).toBe(SAID.trim())
    expect(res.push.tactics).toHaveLength(3)
  })
})
