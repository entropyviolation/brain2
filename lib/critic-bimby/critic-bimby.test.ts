import { describe, expect, it } from "vitest"
import type { PlanDraft, PlanItem } from "@/lib/plan-bimby/types"
import { GOLD } from "./bench"
import { diffPlan } from "./diff"
import { applyKey, keysOf } from "./keys"
import { classify, loadLedger, appendRecord, makeRecord, outcomeOf, rates } from "./ledger"
import { clausesOf, minutesSaid as checkMinutesForTest, planChecks } from "./checks-plan"
import { critiquePlan, keepQuoted, verdictOf } from "./verdict"
import type { Critique, Finding } from "./types"

const row = (title: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id: title, title, subtasks: [], pace: "steady", ...extra })
const draft = (source: string, items: PlanItem[], remarks: string[] = []): PlanDraft => ({ items, remarks, source, by: "model" })

describe("minutes", () => {
  it("accepts digits, words, hours and 'an hour'", () => {
    expect(checkMinutesForTest("clean for 15 min", 15)).toBe(true)
    expect(checkMinutesForTest("stretch for fifteen minutes", 15)).toBe(true)
    expect(checkMinutesForTest("work for 2 hours", 120)).toBe(true)
    expect(checkMinutesForTest("record it (an hour)", 60)).toBe(true)
    expect(checkMinutesForTest("half an hour of email", 30)).toBe(true)
    expect(checkMinutesForTest("clean for 15 min", 20)).toBe(false)
  })
})

describe("planChecks", () => {
  it("raises nothing on the gold plans", () => {
    for (const g of GOLD) expect(planChecks(g.draft), g.name).toEqual([])
  })
  it("fails a length the person never said", () => {
    const c = critiquePlan(draft("make tea, sort mail", [row("make tea", { minutes: 12 }), row("sort mail")]))
    expect(c.verdict).toBe("fail")
    expect(c.findings[0]).toMatchObject({ kind: "invented", where: "make tea", strength: "certain", by: "code" })
  })
  it("fails a plan with no rows from a sentence with tasks", () => {
    expect(critiquePlan(draft("make tea, sort mail", [])).verdict).toBe("fail")
  })
  it("warns on a clause no row touches, and quotes it from the line", () => {
    const d = draft("make tea, sort mail, fix the bicycle", [row("make tea"), row("sort mail")])
    const c = critiquePlan(d)
    expect(c.verdict).toBe("warn")
    const f = c.findings.find((x) => x.kind === "dropped")!
    expect(d.source).toContain(f.quote!)
  })
  it("fails an intake link on a thing the person did not say", () => {
    const c = critiquePlan(draft("make tea, sort mail", [row("make tea", { link: { kind: "intake", label: "coffee", intakeClass: "drink" } }), row("sort mail")]))
    expect(c.findings).toContainEqual(expect.objectContaining({ kind: "wrong-link", strength: "certain" }))
  })
  it("warns when rows come out of spoken order", () => {
    const c = critiquePlan(draft("make tea, sort mail, wash car", [row("sort mail"), row("make tea"), row("wash car")]))
    expect(c.findings).toContainEqual(expect.objectContaining({ kind: "misordered" }))
    expect(c.verdict).toBe("warn")
  })
  it("splits clauses as parts of the line", () => {
    for (const p of clausesOf("Plan for rn: make tea, then sort mail")) expect("Plan for rn: make tea, then sort mail").toContain(p)
  })
})

describe("verdict", () => {
  const hint = (by: Finding["by"]): Finding => ({ kind: "dropped", where: "plan", reason: "x", by, strength: "hint", quote: "tea" })
  it("passes with no findings", () => expect(verdictOf([], "code-only")).toBe("pass"))
  it("warns on one model hint and fails on two", () => {
    expect(verdictOf([hint("model")], "full")).toBe("warn")
    expect(verdictOf([hint("model"), hint("model")], "full")).toBe("fail")
  })
  it("never fails on model findings alone when it shares the planner's model", () => {
    expect(verdictOf([hint("model"), hint("model")], "same-model")).toBe("warn")
  })
  it("drops a model finding whose quote is not in the line", () => {
    const kept = keepQuoted([{ ...hint("model"), quote: "make   tea" }, { ...hint("model"), quote: "wash car" }, { ...hint("model"), quote: undefined }], "Make tea, sort mail")
    expect(kept).toHaveLength(1)
  })
})

describe("keys", () => {
  const d = draft("make tea, sort mail, fix the bicycle", [row("make tea"), row("sort mail"), row("zzz")])
  const critique: Critique = {
    verdict: "fail",
    trust: "code-only",
    hops: [],
    ms: 0,
    findings: [
      { kind: "dropped", where: "plan", quote: "then fix the bicycle.", reason: "x", by: "code", strength: "hint" },
      { kind: "invented", where: "zzz", reason: "x", by: "code", strength: "hint" },
      { kind: "wrong-link", where: "sort mail", reason: "x", by: "code", strength: "hint" },
    ],
  }
  it("offers one key per fixable finding", () => {
    expect(keysOf(critique, d).map((k) => k.label)).toEqual(["Add “fix the bicycle” as a task", "Remove “zzz”", "Clear the link on “sort mail”"])
  })
  it("runs a key on the draft and leaves the rest alone", () => {
    const added = applyKey(d, { kind: "add-row", title: "fix the bicycle" })
    expect(added.items.map((i) => i.title)).toEqual(["make tea", "sort mail", "zzz", "fix the bicycle"])
    expect(applyKey(added, { kind: "remove-row", rowId: "zzz" }).items).toHaveLength(3)
    const linked = draft("x", [row("a", { link: { kind: "flight" } })])
    expect(applyKey(linked, { kind: "clear-link", rowId: "a" }).items[0]!.link).toBeUndefined()
  })
  it("stops at four keys", () => {
    const many: Critique = { ...critique, findings: Array.from({ length: 9 }, (_, i) => ({ kind: "dropped" as const, where: "plan", quote: `thing ${i}`, reason: "x", by: "code" as const, strength: "hint" as const })) }
    expect(keysOf(many, d)).toHaveLength(4)
  })
})

describe("diffPlan", () => {
  const first = [row("a"), row("b", { link: { kind: "task", taskId: "t", title: "B", confirmed: false } }), row("c")]
  it("sees added, removed, retitled and relinked rows", () => {
    const confirmed = [row("a", { title: "a2" }), row("b", { link: { kind: "flight" } }), row("n")]
    expect(diffPlan(first, confirmed)).toEqual([
      { kind: "retitled", rowId: "a" },
      { kind: "relinked", rowId: "b" },
      { kind: "added", rowId: "n" },
      { kind: "removed", rowId: "c" },
    ])
  })
  it("does not count a confirmed task link or a blank row as an edit", () => {
    const confirmed = [row("a"), row("b", { link: { kind: "task", taskId: "t", title: "B", confirmed: true } }), row("c"), row("blank", { title: "  " })]
    expect(diffPlan(first, confirmed)).toEqual([])
  })
})

describe("ledger", () => {
  const critique = (verdict: Critique["verdict"], findings: Finding[] = []): Critique => ({ verdict, findings, trust: "code-only", hops: [], ms: 0 })
  const found: Finding = { kind: "invented", where: "r1", reason: "x", by: "code", strength: "certain" }
  const rec = (c: Critique, outcome: Parameters<typeof classify>[0]["outcome"], edits: Parameters<typeof classify>[0]["edits"] = []) => ({ critique: c, outcome, edits })

  it("reads a fail the person acted on as a catch", () => {
    expect(classify(rec(critique("fail", [found]), "key"))).toBe("catch")
    expect(classify(rec(critique("fail", [found]), "edited", [{ kind: "removed", rowId: "r1" }]))).toBe("catch")
  })
  it("reads an edit the critic did not point at as a miss", () => {
    expect(classify(rec(critique("pass"), "edited", [{ kind: "added", rowId: "n" }]))).toBe("miss")
    expect(classify(rec(critique("fail", [found]), "edited", [{ kind: "retitled", rowId: "other" }]))).toBe("miss")
  })
  it("reads a kept fail as a false alarm and a kept pass as unchanged", () => {
    expect(classify(rec(critique("fail", [found]), "kept-over-critic"))).toBe("false-alarm")
    expect(classify(rec(critique("pass"), "accepted"))).toBe("unchanged")
    expect(classify(rec(critique("fail", [found]), "cancelled"))).toBe("none")
  })
  it("derives the outcome from what happened", () => {
    expect(outcomeOf(critique("fail"), [], { keyUsed: false, cancelled: false })).toBe("kept-over-critic")
    expect(outcomeOf(critique("pass"), [], { keyUsed: false, cancelled: false })).toBe("accepted")
    expect(outcomeOf(critique("pass"), [{ kind: "added", rowId: "x" }], { keyUsed: false, cancelled: false })).toBe("edited")
    expect(outcomeOf(critique("fail"), [], { keyUsed: true, cancelled: false })).toBe("key")
    expect(outcomeOf(critique("fail"), [], { keyUsed: false, cancelled: true })).toBe("cancelled")
  })
  it("sums rates", () => {
    const r = rates([
      rec(critique("fail", [found]), "key"),
      rec(critique("fail", [found]), "kept-over-critic"),
      rec(critique("pass"), "edited", [{ kind: "added", rowId: "n" }]),
      rec(critique("pass"), "accepted"),
    ])
    expect(r).toMatchObject({ total: 4, catches: 1, misses: 1, falseAlarms: 1, unchanged: 1, falseAlarmRate: 0.5, catchRate: 0.5 })
  })
  it("stores records, newest last, and never throws", () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const r = makeRecord({ line: "make tea", first: [row("make tea")], confirmed: [row("make tea"), row("sort mail")], critique: critique("pass"), keyUsed: false, cancelled: false, now: new Date("2026-11-02T10:00:00Z") })
    expect(r.outcome).toBe("edited")
    expect(r.edits).toEqual([{ kind: "added", rowId: "sort mail" }])
    appendRecord(r, storage)
    appendRecord({ ...r, id: "two" }, storage)
    expect(loadLedger(storage).map((x) => x.id)).toEqual([r.id, "two"])
    expect(loadLedger({ getItem: () => "not json" })).toEqual([])
    expect(() => appendRecord(r, { getItem: () => null, setItem: () => { throw new Error("quota") } })).not.toThrow()
  })
})
