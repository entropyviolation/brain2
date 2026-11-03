import { describe, expect, it } from "vitest"
import { buildKnowledgeGraph, type KgItem } from "@/lib/graph/knowledge-graph"
import type { RelationRule } from "@/lib/graph/relation-rules"
import {
  checkEquation,
  composable,
  composeRelations,
  rulesAsEquations,
  schemaCategory,
} from "@/lib/graph/schema-category"
import type { RelationDef } from "@/lib/links"

const def = (id: string, inverse: string, extra: Partial<RelationDef> = {}): RelationDef => ({
  id,
  label: id,
  inverse,
  inverseLabel: inverse,
  ...extra,
})

const defs: RelationDef[] = [
  def("parent-of", "child-of", { fromTypes: ["person"], toTypes: ["person"] }),
  def("child-of", "parent-of", { fromTypes: ["person"], toTypes: ["person"] }),
  def("grandparent-of", "grandchild-of", { fromTypes: ["person"], toTypes: ["person"] }),
  def("ancestor-of", "descendant-of", { fromTypes: ["person"], toTypes: ["person"], traits: { transitive: true } }),
  def("part-of", "has-part", { traits: { transitive: true } }),
  def("phase-of", "has-phase", { parent: "part-of", fromTypes: ["phase", "task"], toTypes: ["project"] }),
  def("works-at", "employs", { fromTypes: ["person"], toTypes: ["org"] }),
  def("old", "old", { archived: true }),
]

const rule = (id: string, chain: string[], head: string, extra: Partial<RelationRule> = {}): RelationRule => ({
  id,
  label: id,
  chain,
  head,
  enabled: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...extra,
})

const rules = [
  rule("rule-grand", ["parent-of", "parent-of"], "grandparent-of"),
  rule("rule-off", ["works-at", "works-at"], "parent-of", { enabled: false }),
]

describe("schemaCategory", () => {
  it("gives one morphism per domain and codomain pair, `*` when absent, and identities", () => {
    const { objects, morphisms } = schemaCategory(defs, ["person", "org"], (id) => id.toUpperCase())
    expect(objects.map((o) => o.id)).toEqual(["*", "org", "person", "phase", "project", "task"])
    expect(objects.find((o) => o.id === "person")?.label).toBe("PERSON")
    expect(morphisms.filter((m) => m.id === "phase-of").map((m) => `${m.dom}>${m.cod}`)).toEqual([
      "phase>project",
      "task>project",
    ])
    expect(morphisms.find((m) => m.id === "part-of")).toMatchObject({ dom: "*", cod: "*" })
    expect(morphisms.find((m) => m.id === "id:person")).toMatchObject({ dom: "person", cod: "person" })
    expect(morphisms.some((m) => m.id === "old")).toBe(false)
  })
})

describe("composition", () => {
  it("checks domain and codomain overlap", () => {
    expect(composable("parent-of", "works-at", defs)).toBe(true)
    expect(composable("works-at", "parent-of", defs)).toBe(false)
    expect(composable("part-of", "works-at", defs)).toBe(true)
  })

  it("reads composites from chain rules, transitive traits, and the lattice", () => {
    expect(composeRelations("parent-of", "parent-of", rules, defs)).toEqual(["grandparent-of"])
    expect(composeRelations("part-of", "part-of", rules, defs)).toEqual(["part-of"])
    // phase-of ⊑ part-of, so phase-of ; part-of ⊑ part-of.
    expect(composeRelations("phase-of", "part-of", rules, defs)).toEqual(["part-of"])
    expect(composeRelations("works-at", "works-at", rules, defs)).toEqual([])
    expect(composeRelations("parent-of", "works-at", rules, defs)).toEqual([])
  })

  it("adds the ancestors of a head below the root", () => {
    const withParent = defs.map((d) => (d.id === "grandparent-of" ? { ...d, parent: "ancestor-of" } : d))
    expect(composeRelations("parent-of", "parent-of", rules, withParent)).toEqual(["ancestor-of", "grandparent-of"])
  })
})

describe("path equations", () => {
  it("reads enabled rules as implies equations", () => {
    expect(rulesAsEquations(rules)).toEqual([
      { id: "rule:rule-grand", label: "rule-grand", left: ["parent-of", "parent-of"], right: ["grandparent-of"], kind: "implies" },
    ])
  })

  const items: KgItem[] = [
    { id: "ada", links: [{ relation: "parent-of", targetId: "ben" }, { relation: "grandparent-of", targetId: "cy" }] },
    { id: "ben", links: [{ relation: "parent-of", targetId: "cy" }, { relation: "parent-of", targetId: "dee" }] },
    { id: "eve", links: [{ relation: "grandparent-of", targetId: "fin" }] },
  ]
  const [eq] = rulesAsEquations(rules)

  it("reports where the chain holds and the head is missing", () => {
    const g = buildKnowledgeGraph({ items })
    expect(checkEquation(g, eq)).toEqual([{ equationId: "rule:rule-grand", from: "item:ada", to: "item:dee", holds: "left" }])
  })

  it("reports both ways for an equal equation, and honours the limit", () => {
    const g = buildKnowledgeGraph({ items })
    const both = checkEquation(g, { ...eq, kind: "equal" })
    expect(both).toEqual([
      { equationId: "rule:rule-grand", from: "item:ada", to: "item:dee", holds: "left" },
      { equationId: "rule:rule-grand", from: "item:eve", to: "item:fin", holds: "right" },
    ])
    expect(checkEquation(g, { ...eq, kind: "equal" }, { limit: 1 })).toHaveLength(1)
  })

  it("counts derived edges only when asked", () => {
    const g = buildKnowledgeGraph({ items, rules, defs, withDerived: true })
    expect(checkEquation(g, eq)).toHaveLength(1)
    expect(checkEquation(g, eq, { withDerived: true })).toEqual([])
  })
})
