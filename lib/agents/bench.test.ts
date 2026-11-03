import { describe, expect, it } from "vitest"
import { compareCards, confusions, runSuite, trimHistory, type BenchCase, type Variant } from "./bench"
import { LISTS_CASES } from "./bench-cases"
import { keywordBaseline, swarmVariant, type ClosedList } from "./bench-variants"
import { TOOLS } from "@/lib/lists-helper/tools"

const cases: BenchCase[] = [
  { id: "a", input: "one", expect: "x", tags: ["t"] },
  { id: "b", input: "two", expect: "y", tags: ["t", "u"] },
  { id: "c", input: "three", expect: "x" },
]
const table = (m: Record<string, string | null | "throw">): Variant => ({
  id: "v",
  label: "V",
  run: async (i) => {
    if (m[i] === "throw") throw new Error("boom")
    return { pick: m[i] ?? null, confidence: i === "one" ? 0.9 : undefined }
  },
})

describe("runSuite", () => {
  it("scores passes, declines and errors, and counts per tag", async () => {
    const card = await runSuite(table({ one: "x", two: null, three: "throw" }), cases)
    expect(card.n).toBe(3)
    expect(card.passed).toBe(1)
    expect(card.declined).toBe(1)
    expect(card.errors).toBe(1)
    expect(card.byTag).toEqual({ t: { n: 2, passed: 1 }, u: { n: 1, passed: 0 } })
    expect(card.rightWhenSure).toBe(1)
    expect(card.rows[2]!.error).toBe("boom")
  })
  it("stops when aborted and reports only what ran", async () => {
    const ctl = new AbortController()
    const card = await runSuite(table({ one: "x", two: "y", three: "x" }), cases, { signal: ctl.signal, onRow: (_r, n) => n === 1 && ctl.abort() })
    expect(card.n).toBe(1)
  })
})

describe("compareCards", () => {
  it("names gained, lost, stuck and held on the shared lines", async () => {
    const before = await runSuite(table({ one: "x", two: "z", three: "z" }), cases)
    const after = await runSuite(table({ one: "z", two: "y", three: "z" }), cases.slice(0, 2))
    const c = compareCards(before, after)
    expect(c).toMatchObject({ shared: 2, gained: ["b"], lost: ["a"], stuck: [], held: [] })
    expect(c.delta).toBe(0)
  })
})

describe("confusions and trimHistory", () => {
  it("counts wrong answers by expected and picked", async () => {
    const card = await runSuite(table({ one: "y", two: "x", three: "y" }), cases)
    expect(confusions(card)[0]).toEqual({ expect: "x", pick: "y", count: 2 })
  })
  it("keeps the newest few of each variant", async () => {
    const mk = async (at: string) => ({ ...(await runSuite(table({}), [])), at })
    const out = trimHistory([await mk("2026-01-01"), await mk("2026-01-03"), await mk("2026-01-02")], 2)
    expect(out.map((c) => c.at)).toEqual(["2026-01-03", "2026-01-02"])
  })
})

const list: ClosedList = { actions: TOOLS.map((t) => t.name), does: TOOLS.map((t) => t.does), system: "s" }

describe("variants", () => {
  it("the keyword baseline declines with no words in common and is deterministic", async () => {
    const v = keywordBaseline(list)
    expect((await v.run("zzz qqq")).pick).toBeNull()
    expect((await v.run("find duplicates")).pick).toBe("find-duplicates")
  })
  it("a swarm that splits declines when asked to", async () => {
    const voter = (id: string, fam: string, ranking: string[]) => ({ voter: { id, family: fam }, call: async () => ({ ranking }) })
    const split = [voter("a", "f1", ["find-items"]), voter("b", "f2", ["merge-items"])]
    expect((await swarmVariant("s", "S", list, split).run("x")).pick).not.toBeNull()
    expect((await swarmVariant("s", "S", list, split, { declineOnSplit: true }).run("x")).pick).toBeNull()
    const clear = [voter("a", "f1", ["find-items"]), voter("b", "f2", ["find-items"]), voter("c", "f3", ["find-items"])]
    expect((await swarmVariant("s", "S", list, clear, { declineOnSplit: true }).run("x")).pick).toBe("find-items")
  })
})

describe("LISTS_CASES", () => {
  it("only expects real tools and has unique ids", () => {
    const names = new Set(TOOLS.map((t) => t.name))
    expect(LISTS_CASES.every((c) => names.has(c.expect as never))).toBe(true)
    expect(new Set(LISTS_CASES.map((c) => c.id)).size).toBe(LISTS_CASES.length)
  })
})
