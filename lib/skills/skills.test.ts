import { describe, expect, it } from "vitest"
import { addSkill, idsOf, loadBank, pickSkills, proposedIn, recordUse, renderSkills, saveBank, setStatus } from "./bank"
import { cleanSkills, distillWithModel, lessonOf, lessonsOf } from "./distill"
import { appendExperience, loadExperiences, makeExperience, saveExperiences } from "./experience"
import { evolve, sampleFailures, statsByCategory, weakCategories, withProposals } from "./evolve"
import { recordReaction } from "./learn"
import { LISTS_HELPER_SKILLS, TRACKING_HELPER_SKILLS } from "./seeds"
import type { Experience, Skill, SkillBank } from "./types"

const store = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } as unknown as Storage
}

const skill = (over: Partial<Skill> = {}): Skill => ({ id: "s1", name: "Reading ends", principle: "End is the plain time.", whenToApply: "reading until three thirty", kind: "task", category: "wire:end-vs-maybe", status: "active", source: "distilled", from: [], uses: 0, wins: 0, ...over })
const bank = (...skills: Skill[]): SkillBank => ({ agentId: "a", skills })
let n = 0
const exp = (over: Partial<Experience> = {}): Experience => ({ id: `e${n++}`, agentId: "a", at: n, category: "c", input: "walked from 4 until 5", outcome: "failure", severity: 1, chose: "walking", should: "a walk", skillsUsed: [], ...over })

describe("Neutral accepts (lib/accept-grade.ts)", () => {
  it("are kept as neutral, credit no skill, and stay out of the success rate and distill", () => {
    const st = store()
    saveBank(bank(skill({ uses: 2, wins: 1 })), st)
    const e = recordReaction({ agentId: "a", category: "c", input: "x", chose: "y", skillsUsed: ["s1"], neutral: true }, [], st)
    expect(e.outcome).toBe("neutral")
    expect(loadExperiences("a", st).map((x) => x.outcome)).toEqual(["neutral"])
    expect(loadBank("a", [], st).skills[0]).toMatchObject({ uses: 2, wins: 1 })
    const stats = statsByCategory([exp({ outcome: "neutral" }), exp({ outcome: "neutral" }), exp({ outcome: "success", severity: 1 })])
    expect(stats[0]).toMatchObject({ n: 1, success: 1, rate: 1 })
  })
  it("a correction stays a failure even when the key was Neutral", () => {
    expect(makeExperience({ agentId: "a", category: "c", input: "x", chose: "y", skillsUsed: [], neutral: true, severity: 1, should: "z" }).outcome).toBe("failure")
  })
})

describe("seeds", () => {
  it("have unique ids and are all hand-written and active", () => {
    for (const list of [TRACKING_HELPER_SKILLS, LISTS_HELPER_SKILLS]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
      for (const s of list) expect([s.source, s.status, s.kind]).toEqual(["hand", "active", "general"])
    }
  })
})

describe("pickSkills / renderSkills", () => {
  const b = bank(
    skill({ id: "g", kind: "general", name: "Blank beats a guess", whenToApply: "a field not stated" }),
    skill({ id: "t1", name: "Reading ends", whenToApply: "reading until three thirty" }),
    skill({ id: "t2", name: "Cooking", whenToApply: "cooking dinner", category: "wire:other" }),
    skill({ id: "p", name: "Proposed one", whenToApply: "reading until three", status: "proposed" }),
    skill({ id: "r", name: "Retired one", whenToApply: "reading until three", status: "retired" }),
  )
  it("always takes live general skills and only live task skills that fit", () => {
    const pick = pickSkills(b, "I was reading until three thirty")
    expect(pick.general.map((s) => s.id)).toEqual(["g"])
    expect(pick.task.map((s) => s.id)).toEqual(["t1"])
    expect(idsOf(pick)).toEqual(["g", "t1"])
  })
  it("caps task skills at k and renders nothing for an empty pick", () => {
    expect(pickSkills(bank(...[1, 2, 3].map((i) => skill({ id: `t${i}`, name: `n${i}`, whenToApply: "reading until" }))), "reading until", { k: 2 }).task).toHaveLength(2)
    expect(renderSkills({ general: [], task: [] })).toBe("")
    expect(renderSkills(pickSkills(b, "reading until three thirty"))).toContain("SKILLS FOR THIS INPUT")
  })
})

describe("bank upkeep", () => {
  it("skips a skill that says the same thing", () => {
    const b = bank(skill())
    expect(addSkill(b, skill({ id: "other" })).skills).toHaveLength(1)
    expect(addSkill(b, skill({ id: "x", name: "Totally different", principle: "Never write a place unless named." })).skills).toHaveLength(2)
  })
  it("drops the weakest learned skill past the cap and keeps hand skills", () => {
    const b = bank(skill({ id: "hand", source: "hand", uses: 10, wins: 0 }), skill({ id: "weak", name: "weak one", principle: "alpha beta gamma", uses: 4, wins: 0 }), skill({ id: "strong", name: "strong one", principle: "delta epsilon zeta", uses: 4, wins: 4 }))
    const out = addSkill(b, skill({ id: "new", name: "newest", principle: "eta theta iota" }), 3)
    expect(out.skills.map((s) => s.id).sort()).toEqual(["hand", "new", "strong"])
  })
  it("credits uses and wins, and moves status", () => {
    const b = recordUse(bank(skill()), ["s1"], true)
    expect([b.skills[0]!.uses, b.skills[0]!.wins]).toEqual([1, 1])
    expect(proposedIn(setStatus(b, "s1", "proposed"))).toHaveLength(1)
  })
  it("saves and loads, merging missing seeds without undoing edits", () => {
    const st = store()
    const seeds = [skill({ id: "seed", source: "hand", kind: "general" })]
    saveBank({ agentId: "a", skills: [{ ...seeds[0]!, status: "retired" }, skill({ id: "learned" })] }, st)
    const b = loadBank("a", [...seeds, skill({ id: "newseed", source: "hand" })], st)
    expect(b.skills.map((s) => [s.id, s.status])).toEqual([["newseed", "active"], ["seed", "retired"], ["learned", "active"]])
    expect(loadBank("a", seeds, { getItem: () => "{not json" }).skills.map((s) => s.id)).toEqual(["seed"])
  })
})

describe("experience", () => {
  it("makes a success without a severity and a failure with one, keeps the newest", () => {
    expect(makeExperience({ agentId: "a", category: "c", input: "x", chose: "y", skillsUsed: [] }).outcome).toBe("success")
    expect(makeExperience({ agentId: "a", category: "c", input: "x", chose: "y", skillsUsed: [], severity: 2 })).toMatchObject({ outcome: "failure", severity: 2 })
    expect(appendExperience([exp(), exp()], exp(), 2)).toHaveLength(2)
  })
  it("round-trips through storage and survives garbage", () => {
    const st = store()
    saveExperiences("a", [exp()], st)
    expect(loadExperiences("a", st)).toHaveLength(1)
    expect(loadExperiences("a", { getItem: () => "[1,2" })).toEqual([])
  })
  it("records a reaction and credits the skills", () => {
    const st = store()
    saveBank(bank(skill()), st)
    recordReaction({ agentId: "a", category: "c", input: "x", chose: "y", skillsUsed: ["s1"] }, [], st)
    expect(loadExperiences("a", st)).toHaveLength(1)
    expect(loadBank("a", [], st).skills[0]).toMatchObject({ uses: 1, wins: 1 })
  })
})

describe("distill", () => {
  it("writes a failure lesson only when the person gave a better move", () => {
    expect(lessonOf(exp({ should: undefined }))).toBeNull()
    expect(lessonOf(exp({ outcome: "success" }))).toBeNull()
    const s = lessonOf(exp({ category: "wire:activity-name", chose: "reading", should: "reading a book" }))!
    expect(s).toMatchObject({ status: "proposed", kind: "task", category: "wire:activity-name", source: "distilled" })
    expect(s.principle).toContain("Mistake")
  })
  it("merges the same lesson from two experiences", () => {
    const a = exp({ chose: "x", should: "y" })
    const b = exp({ chose: "x", should: "y" })
    const out = lessonsOf([a, b])
    expect(out).toHaveLength(1)
    expect(out[0]!.from).toEqual([a.id, b.id])
  })
  it("cleans model output and drops malformed skills", () => {
    const out = cleanSkills({ skills: [{ name: "A", principle: "p", whenToApply: "w", kind: "general", category: "c" }, { name: "", principle: "p", whenToApply: "w" }, { name: "A", principle: "dup", whenToApply: "w", category: "c" }, "junk"] }, [exp()])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: "general", status: "proposed", source: "evolved" })
  })
  it("asks the ladder and returns proposals, or nothing with no model", async () => {
    const call = async () => ({ skills: [{ name: "Keep ends", principle: "p", whenToApply: "w", kind: "task", category: "c" }] })
    const d = await distillWithModel(call, ["m"], [exp()], [])
    expect(d.skills).toHaveLength(1)
    expect(d.model).toBe("m")
    expect((await distillWithModel(call, [], [exp()], [])).skills).toEqual([])
  })
})

describe("evolve", () => {
  const mix = (cat: string, ok: number, bad: number) => [...Array(ok).fill(0).map(() => exp({ category: cat, outcome: "success", should: undefined, severity: 1 })), ...Array(bad).fill(0).map((_, i) => exp({ category: cat, chose: `c${cat}${i}`, should: `s${cat}${i}`, severity: ((i % 3) + 1) as 1 | 2 | 3 }))]
  it("finds only the categories under the bar with enough cases", () => {
    const list = [...mix("good", 9, 1), ...mix("weak", 1, 3), ...mix("tiny", 0, 2)]
    expect(statsByCategory(list).find((s) => s.category === "good")!.rate).toBeCloseTo(0.9)
    expect(weakCategories(list).map((s) => s.category)).toEqual(["weak"])
  })
  it("samples failures round-robin across weak categories, worst first", () => {
    const list = [...mix("a", 0, 4), ...mix("b", 0, 4)]
    const out = sampleFailures(list, weakCategories(list), 4)
    expect(out.map((e) => e.category)).toEqual(["a", "b", "a", "b"])
    expect(out[0]!.severity).toBe(3)
  })
  it("proposes plain lessons with no model, skips known skills, and adds as proposed", async () => {
    const list = mix("weak", 1, 3)
    const r = await evolve({ experiences: list, bank: bank() })
    expect(r.weak).toHaveLength(1)
    expect(r.proposals.length).toBeGreaterThan(0)
    expect(r.fallback).toBe("no model reachable")
    const next = withProposals(bank(), r.proposals)
    expect(next.skills.every((s) => s.status === "proposed")).toBe(true)
    expect((await evolve({ experiences: list, bank: next })).proposals).toEqual([])
  })
  it("prefers the model's skills and falls back to lessons when it writes nothing", async () => {
    const list = mix("weak", 1, 3)
    const good = await evolve({ experiences: list, bank: bank(), ladder: ["m"], call: async () => ({ skills: [{ name: "Generalised", principle: "p q r", whenToApply: "w", kind: "task", category: "weak" }] }) })
    expect(good.proposals.map((s) => s.name)).toEqual(["Generalised"])
    expect(good.model).toBe("m")
    const none = await evolve({ experiences: list, bank: bank(), ladder: ["m"], call: async () => ({ skills: [] }) })
    expect(none.fallback).toBe("the model wrote nothing new")
    expect(none.proposals.length).toBeGreaterThan(0)
  })
})
