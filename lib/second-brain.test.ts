import { describe, it, expect } from "vitest"
import {
  RELATIONS,
  isKnownRelation,
  inverseRelation,
  isEvidenceRelation,
  EVIDENCE_RELATIONS,
  stanceWeight,
  STANCE_WEIGHTS,
  getLinkStance,
  setLinkStance,
  defaultStanceForRelation,
  linkStanceWeight,
  makeLink,
} from "@/lib/links"
import {
  SOURCE_TYPE_ID,
  BELIEF_TYPE_ID,
  SOURCE_ATTR,
  BELIEF_ATTR,
  getSourceTypeDefinition,
  getBeliefTypeDefinition,
  getSecondBrainTypeDefinitions,
  withSecondBrainTypes,
  DEFAULT_SOURCE_TRUST,
} from "@/lib/second-brain-types"
import type { ItemTypeDefinition, LinkStance } from "@/lib/types"

describe("evidence relations (links.ts additions)", () => {
  it("refutes/refuted-by are in the catalog with correct inverses", () => {
    expect(isKnownRelation("refutes")).toBe(true)
    expect(isKnownRelation("refuted-by")).toBe(true)
    expect(inverseRelation("refutes")).toBe("refuted-by")
    expect(inverseRelation("refuted-by")).toBe("refutes")
  })

  it("every relation's inverse still round-trips (no regressions)", () => {
    for (const r of RELATIONS) {
      expect(inverseRelation(r.id)).toBe(r.inverse)
      expect(inverseRelation(r.inverse)).toBe(r.id)
    }
  })

  it("isEvidenceRelation matches support/refute relations only", () => {
    for (const r of EVIDENCE_RELATIONS) expect(isEvidenceRelation(r)).toBe(true)
    expect(isEvidenceRelation("blocks")).toBe(false)
    expect(isEvidenceRelation("related")).toBe(false)
  })
})

describe("stance helpers", () => {
  it("stanceWeight maps the five-level spectrum to [-1,+1]", () => {
    expect(stanceWeight("strong-support")).toBe(1)
    expect(stanceWeight("weak-support")).toBe(0.5)
    expect(stanceWeight("none")).toBe(0)
    expect(stanceWeight("weak-refute")).toBe(-0.5)
    expect(stanceWeight("strong-refute")).toBe(-1)
  })

  it("stanceWeight treats missing stance as neutral", () => {
    expect(stanceWeight(undefined)).toBe(0)
    expect(stanceWeight(null)).toBe(0)
  })

  it("STANCE_WEIGHTS covers exactly the LinkStance values", () => {
    const keys = Object.keys(STANCE_WEIGHTS).sort()
    expect(keys).toEqual(
      ["none", "strong-refute", "strong-support", "weak-refute", "weak-support"].sort(),
    )
  })

  it("get/set stance are immutable", () => {
    const base = makeLink("supported-by", "s1")
    expect(getLinkStance(base)).toBeUndefined()
    const withStance = setLinkStance(base, "weak-support")
    expect(withStance).not.toBe(base)
    expect(base.stance).toBeUndefined()
    expect(getLinkStance(withStance)).toBe("weak-support")
  })

  it("defaultStanceForRelation infers from relation", () => {
    const expected: Record<string, LinkStance> = {
      supports: "strong-support",
      "supported-by": "strong-support",
      refutes: "strong-refute",
      "refuted-by": "strong-refute",
      related: "none",
    }
    for (const [relation, stance] of Object.entries(expected)) {
      expect(defaultStanceForRelation(relation)).toBe(stance)
    }
  })

  it("linkStanceWeight prefers explicit stance, else relation default", () => {
    expect(linkStanceWeight(makeLink("supported-by", "s1"))).toBe(1)
    expect(linkStanceWeight(makeLink("refuted-by", "s1"))).toBe(-1)
    expect(linkStanceWeight(setLinkStance(makeLink("supported-by", "s1"), "weak-support"))).toBe(0.5)
    expect(linkStanceWeight(makeLink("related", "s1"))).toBe(0)
  })
})

describe("Source / Belief type definitions", () => {
  it("Source has the Brain2 schema attributes + sensible defaults", () => {
    const def = getSourceTypeDefinition()
    expect(def.id).toBe(SOURCE_TYPE_ID)
    expect(def.builtin).toBe(false)
    const ids = (def.attributes ?? []).map((a) => a.id)
    for (const id of Object.values(SOURCE_ATTR)) expect(ids).toContain(id)

    const sourceType = def.attributes?.find((a) => a.id === SOURCE_ATTR.sourceType)
    expect(sourceType?.type).toBe("selection")
    expect(sourceType?.options).toEqual(["full", "snippet", "report"])

    const trust = def.attributes?.find((a) => a.id === SOURCE_ATTR.trust)
    expect(trust?.type).toBe("number")
    expect(def.defaultAttributeValues?.[SOURCE_ATTR.trust]).toBe(DEFAULT_SOURCE_TRUST)
    expect(def.displayedAttributes).toContain(SOURCE_ATTR.trust)
  })

  it("Belief has statement/strength/certainty/locked + defaults", () => {
    const def = getBeliefTypeDefinition()
    expect(def.id).toBe(BELIEF_TYPE_ID)
    expect(def.builtin).toBe(false)
    const ids = (def.attributes ?? []).map((a) => a.id)
    for (const id of Object.values(BELIEF_ATTR)) expect(ids).toContain(id)

    const locked = def.attributes?.find((a) => a.id === BELIEF_ATTR.locked)
    expect(locked?.type).toBe("boolean")
    const presup = def.attributes?.find((a) => a.id === BELIEF_ATTR.presuppositions)
    expect(presup?.type).toBe("multistring")
    expect(def.defaultAttributeValues?.[BELIEF_ATTR.strength]).toBe(0.5)
  })

  it("getSecondBrainTypeDefinitions returns Source then Belief", () => {
    const defs = getSecondBrainTypeDefinitions()
    expect(defs.map((d) => d.id)).toEqual([SOURCE_TYPE_ID, BELIEF_TYPE_ID])
  })
})

describe("withSecondBrainTypes (seed helper)", () => {
  const existing: ItemTypeDefinition[] = [
    { id: "task", name: "Task", builtin: true },
    { id: "book", name: "Book" },
  ]

  it("appends Source + Belief, preserving existing types", () => {
    const next = withSecondBrainTypes(existing)
    expect(next.map((t) => t.id)).toEqual(["task", "book", SOURCE_TYPE_ID, BELIEF_TYPE_ID])
    expect(next).not.toBe(existing)
  })

  it("is idempotent (same reference when already seeded)", () => {
    const once = withSecondBrainTypes(existing)
    const twice = withSecondBrainTypes(once)
    expect(twice).toBe(once)
  })

  it("does not remove or duplicate existing user types", () => {
    const seeded = withSecondBrainTypes(existing)
    expect(seeded.filter((t) => t.id === SOURCE_TYPE_ID)).toHaveLength(1)
    expect(seeded.find((t) => t.id === "book")).toBeTruthy()
  })
})
