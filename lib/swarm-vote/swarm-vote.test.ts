import { describe, expect, it } from "vitest"
import { runSwarm } from "./run"
import { cleanBallot, earlyStop, survivors, tally } from "./tally"
import type { Ballot } from "./types"

const ACTIONS = ["merge-items", "exclusive-type", "retype-items", "find-items"]
const ballot = (id: string, family: string, ranking: string[], weight?: number): Ballot => ({
  voter: { id, family, weight },
  ranking,
  ms: 1,
})

describe("cleanBallot", () => {
  it("drops off-list, repeated and non-string entries", () => {
    expect(cleanBallot(["exclusive-type", "nope", "exclusive-type", 3, "find-items"], ACTIONS)).toEqual(["exclusive-type", "find-items"])
    expect(cleanBallot("exclusive-type", ACTIONS)).toEqual([])
  })
})

describe("tally", () => {
  it("is clear when most put the same action first", () => {
    const t = tally([
      ballot("a", "qwen", ["exclusive-type", "retype-items"]),
      ballot("b", "llama", ["exclusive-type", "retype-items"]),
      ballot("c", "gemma", ["exclusive-type"]),
      ballot("d", "qwen", ["retype-items", "exclusive-type"]),
    ])
    expect(t.standings[0]!.action).toBe("exclusive-type")
    expect(t.agreement).toBe(0.75)
    expect(t.families).toBe(3)
    expect(t.verdict).toBe("clear")
  })

  it("is split when voters disagree, and survivors keep the shared ones", () => {
    const t = tally([
      ballot("a", "x", ["exclusive-type", "retype-items"]),
      ballot("b", "y", ["retype-items", "exclusive-type"]),
      ballot("c", "z", ["find-items", "retype-items"]),
    ])
    expect(t.verdict).toBe("split")
    expect(survivors(t)).toEqual(["retype-items", "exclusive-type"])
  })

  it("is empty with no usable ballots", () => {
    expect(tally([ballot("a", "x", [])]).verdict).toBe("empty")
    expect(tally([]).voters).toBe(0)
  })

  it("weights a voter", () => {
    const t = tally([ballot("a", "x", ["find-items"], 3), ballot("b", "y", ["merge-items"]), ballot("c", "z", ["merge-items"])])
    expect(t.standings[0]!.action).toBe("find-items")
  })
})

describe("earlyStop", () => {
  it("stops when the lead exceeds the ballots still out", () => {
    const bs = [ballot("a", "x", ["merge-items"]), ballot("b", "x", ["merge-items"]), ballot("c", "x", ["merge-items"])]
    expect(earlyStop(bs, 5)).toBe(true)
    expect(earlyStop(bs, 9)).toBe(false)
  })
})

describe("runSwarm", () => {
  const voter = (id: string, ranking: unknown, delay = 0, fail = false) => ({
    voter: { id, family: id },
    call: () =>
      new Promise<unknown>((res, rej) => setTimeout(() => (fail ? rej(new Error("down")) : res({ ranking })), delay)),
  })

  it("tallies the voters that answer and names the ones that failed", async () => {
    const r = await runSwarm(
      [voter("a", ["merge-items"]), voter("b", ["merge-items", "bogus"]), voter("c", [], 0, true)],
      { actions: ACTIONS, system: "s", line: "l" },
    )
    expect(r.tally.voters).toBe(2)
    expect(r.missed).toEqual(["c"])
    expect(r.tally.verdict).toBe("clear")
  })

  it("votes with whoever answered before the timeout", async () => {
    const r = await runSwarm([voter("a", ["find-items"]), voter("slow", ["merge-items"], 300)], {
      actions: ACTIONS,
      system: "s",
      line: "l",
      timeoutMs: 40,
    })
    expect(r.ballots).toHaveLength(1)
    expect(r.missed).toEqual(["slow"])
  })

  it("stops early when the lead cannot be passed", async () => {
    const r = await runSwarm(
      [voter("a", ["merge-items"]), voter("b", ["merge-items"]), voter("c", ["merge-items"]), voter("slow", ["find-items"], 300)],
      { actions: ACTIONS, system: "s", line: "l", stopEarly: true },
    )
    expect(r.stoppedEarly).toBe(true)
    expect(r.tally.standings[0]!.action).toBe("merge-items")
  })
})

import { cleanKeys, rewordSplit } from "./reword"
import { sweep, subset, type Recorded } from "./bench"

describe("reword", () => {
  it("cleans keys to the given actions, falling back to the name", () => {
    const keys = cleanKeys({ keys: [{ action: "exclusive-type", sentence: " Book stays, Task goes " }, { action: "bogus", sentence: "x" }] }, ["exclusive-type", "retype-items"])
    expect(keys).toEqual([
      { action: "exclusive-type", sentence: "Book stays, Task goes", reworded: true },
      { action: "retype-items", sentence: "retype-items", reworded: false },
    ])
  })

  it("only rewords a split vote", async () => {
    const calls: unknown[] = []
    const call = async (req: unknown) => (calls.push(req), { keys: [{ action: "find-items", sentence: "Count them." }] })
    const split = tally([ballot("a", "x", ["find-items", "merge-items"]), ballot("b", "y", ["merge-items", "find-items"])])
    expect(split.verdict).toBe("split")
    const keys = await rewordSplit(call, "line", split)
    expect(keys.map((k) => k.action)).toEqual(["merge-items", "find-items"].sort((a, b) => (split.standings.findIndex((s) => s.action === a) - split.standings.findIndex((s) => s.action === b))))
    expect(calls).toHaveLength(1)
    const clear = tally([ballot("a", "x", ["find-items"]), ballot("b", "y", ["find-items"])])
    expect(await rewordSplit(call, "line", clear)).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it("falls back to names when the model throws or is absent", async () => {
    const split = tally([ballot("a", "x", ["find-items", "merge-items"]), ballot("b", "y", ["merge-items", "find-items"])])
    const boom = async () => { throw new Error("down") }
    expect((await rewordSplit(boom, "l", split)).every((k) => !k.reworded)).toBe(true)
    expect((await rewordSplit(null, "l", split)).every((k) => !k.reworded)).toBe(true)
  })
})

describe("bench", () => {
  const rec: Recorded[] = [
    {
      case: { line: "l", expected: "exclusive-type" },
      ballots: [
        ballot("a1", "qwen", ["find-items"]),
        ballot("a2", "qwen", ["find-items"]),
        ballot("b1", "llama", ["exclusive-type"]),
        ballot("c1", "gemma", ["exclusive-type"]),
        ballot("c2", "gemma", ["exclusive-type"]),
      ],
    },
  ]

  it("picks mixed round-robin across families", () => {
    expect(subset(rec[0]!.ballots, 3, "mixed").map((b) => b.voter.id)).toEqual(["a1", "b1", "c1"])
    expect(subset(rec[0]!.ballots, 3, "copies").map((b) => b.voter.id)).toEqual(["a1", "a2", "b1"])
  })

  it("scores a mixed swarm above copies on correlated errors", () => {
    const rows = sweep(rec, [3])
    const copies = rows.find((r) => r.pick === "copies")!
    const mixed = rows.find((r) => r.pick === "mixed")!
    expect(copies.borda).toBe(0)
    expect(mixed.borda).toBe(1)
  })
})
