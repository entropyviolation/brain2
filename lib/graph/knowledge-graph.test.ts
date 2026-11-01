import { describe, expect, it } from "vitest"
import {
  buildKnowledgeGraph,
  deriveEdges,
  edgesBetween,
  neighbors,
  nodeKind,
  type KgItem,
} from "@/lib/graph/knowledge-graph"
import type { RelationRule } from "@/lib/graph/relation-rules"
import type { SpineGraph } from "@/lib/graph/vault-graph"
import type { RelationDef } from "@/lib/links"

const def = (id: string, inverse: string, extra: Partial<RelationDef> = {}): RelationDef => ({
  id,
  label: id,
  inverse,
  inverseLabel: inverse,
  ...extra,
})

const defs: RelationDef[] = [
  def("parent-of", "child-of"),
  def("child-of", "parent-of"),
  def("grandparent-of", "grandchild-of"),
  def("grandchild-of", "grandparent-of"),
  def("part-of", "has-part", { traits: { transitive: true } }),
  def("has-part", "part-of"),
  def("phase-of", "has-phase", { parent: "part-of" }),
  def("has-phase", "phase-of"),
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

const rules = [rule("rule-grand", ["parent-of", "parent-of"], "grandparent-of")]

const items: KgItem[] = [
  { id: "ada", title: "Ada", type: "person", links: [{ relation: "parent-of", targetId: "ben" }] },
  // Stored only on the child: Cy is Ben's child.
  { id: "cy", title: "Cy", type: "person", links: [{ relation: "child-of", targetId: "ben" }] },
  { id: "ben", title: "Ben", type: "person" },
  { id: "wheel", title: "Wheel", links: [{ relation: "phase-of", targetId: "bike" }] },
  { id: "bike", title: "Bike", links: [{ relation: "part-of", targetId: "fleet" }] },
  { id: "fleet", title: "Fleet", links: [{ relation: "part-of", targetId: "depot" }] },
  { id: "depot", title: "Depot" },
  { id: "lone", title: "Lone" },
]

const spine: SpineGraph = {
  triples: [
    { s: "block:1", p: "on-day", o: "day:2026-11-01", graph: "timegrid", order: "recorded", at: "2026-11-01" },
    { s: "day:2026-11-01", p: "nested-in", o: "week:2026-10-26_2026-11-01", graph: "periods", order: "derived" },
    { s: "block:1", p: "with", o: "item:ada", graph: "timegrid", order: "recorded", at: "2026-11-01", startMin: 60 },
    { s: "block:1", p: "generated-by", o: "stream:sleep", graph: "timegrid", order: "observed" },
  ],
  labels: { "block:1": "Walk", "item:ada": "Ada (pen)", "day:2026-11-01": "1 Nov" },
}

describe("nodeKind", () => {
  it("reads the prefix, a bare id is an item, an unknown prefix is null", () => {
    expect(nodeKind("item:a")).toBe("item")
    expect(nodeKind("day:2026-11-01")).toBe("day")
    expect(nodeKind("abc")).toBe("item")
    expect(nodeKind("who:s:p:v")).toBeNull()
  })
})

describe("buildKnowledgeGraph", () => {
  it("merges spine and recorded edges, names every node, and indexes out and in", () => {
    const g = buildKnowledgeGraph({ items, spine })
    expect(g.edges.some((e) => e.order === "derived" && e.graph === "derived")).toBe(false)
    expect(g.edges.find((e) => e.p === "with")).toEqual({
      s: "block:1",
      p: "with",
      o: "item:ada",
      graph: "timegrid",
      order: "recorded",
      at: "2026-11-01",
    })
    expect(g.nodes.get("item:ada")).toEqual({ id: "item:ada", kind: "item", label: "Ada", typeId: "person" })
    expect(g.nodes.get("item:lone")?.label).toBe("Lone")
    expect(g.nodes.get("block:1")).toEqual({ id: "block:1", kind: "block", label: "Walk" })
    expect(g.nodes.get("week:2026-10-26_2026-11-01")?.kind).toBe("week")
    expect(g.nodes.get("stream:sleep")).toMatchObject({ kind: "message", prefix: "stream" })
    expect(g.out.get("item:ada")?.map((e) => e.o)).toEqual(["item:ben"])
    expect(g.in.get("item:ada")?.map((e) => e.s)).toEqual(["block:1"])
  })

  it("derives grandparent-of through a chain rule, reading a child-of link backwards", () => {
    const g = buildKnowledgeGraph({ items, rules, defs, withDerived: true })
    const grand = g.edges.filter((e) => e.p === "grandparent-of")
    expect(grand).toEqual([
      { s: "item:ada", p: "grandparent-of", o: "item:cy", graph: "derived", order: "derived", proof: "rule-grand" },
    ])
  })

  it("closes a transitive relation, counting its subrelations as steps", () => {
    const g = buildKnowledgeGraph({ items, rules, defs, withDerived: true })
    const closure = g.edges.filter((e) => e.proof === "transitive:part-of").map((e) => `${e.s}>${e.o}`)
    expect(closure.sort()).toEqual(["item:bike>item:depot", "item:wheel>item:depot", "item:wheel>item:fleet"])
  })

  it("never derives a fact that is already recorded, in either direction", () => {
    const withRecorded: KgItem[] = [
      ...items.filter((i) => i.id !== "cy"),
      { id: "cy", links: [{ relation: "child-of", targetId: "ben" }, { relation: "grandchild-of", targetId: "ada" }] },
      { id: "x", links: [{ relation: "part-of", targetId: "y" }] },
      { id: "y", links: [{ relation: "part-of", targetId: "z" }] },
      { id: "x2", links: [{ relation: "part-of", targetId: "z" }] },
    ]
    const g = buildKnowledgeGraph({ items: withRecorded, rules, defs, withDerived: true })
    expect(g.edges.filter((e) => e.p === "grandparent-of")).toEqual([])
    expect(g.edges.filter((e) => e.s === "item:x" && e.o === "item:z").map((e) => e.order)).toEqual(["derived"])
  })

  it("respects disabled rules, unless, and guards", () => {
    const off = buildKnowledgeGraph({ items, defs, rules: [{ ...rules[0], enabled: false }], withDerived: true })
    expect(off.edges.some((e) => e.p === "grandparent-of")).toBe(false)
    const guarded = buildKnowledgeGraph({
      items,
      defs,
      rules: [rule("g", ["parent-of", "parent-of"], "grandparent-of", { guards: [["robot"]] })],
      withDerived: true,
    })
    expect(guarded.edges.some((e) => e.p === "grandparent-of")).toBe(false)
  })

  it("stops at the cap and the depth on a long cycle", () => {
    const ring: KgItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      links: [{ relation: "part-of", targetId: `n${(i + 1) % 20}` }],
    }))
    const base = buildKnowledgeGraph({ items: ring }).edges
    const capped = deriveEdges(base, [], defs, undefined, { cap: 7 })
    expect(capped).toHaveLength(7)
    const deep = deriveEdges(base, [], defs)
    // Each node reaches 5 more nodes past its neighbour at depth 6.
    expect(deep).toHaveLength(20 * 5)
  })

  it("caches by input identity and writes nothing back", () => {
    const before = JSON.stringify(items)
    const input = { items, rules, defs, withDerived: true }
    expect(buildKnowledgeGraph(input)).toBe(buildKnowledgeGraph({ ...input }))
    expect(buildKnowledgeGraph(input)).not.toBe(buildKnowledgeGraph({ ...input, withDerived: false }))
    expect(JSON.stringify(items)).toBe(before)
  })
})

describe("neighbors and edgesBetween", () => {
  const g = buildKnowledgeGraph({ items, spine, rules, defs, withDerived: true })

  it("lists one-step neighbours, filtered by direction, relation, and order", () => {
    expect(neighbors(g, "item:ben")).toEqual(["item:ada", "item:cy"])
    expect(neighbors(g, "item:ada", { direction: "out" })).toEqual(["item:ben", "item:cy"])
    expect(neighbors(g, "item:ada", { direction: "out", orders: ["recorded"] })).toEqual(["item:ben"])
    expect(neighbors(g, "item:ada", { direction: "in", relation: "with" })).toEqual(["block:1"])
  })

  it("returns edges both ways between two addresses", () => {
    expect(edgesBetween(g, "item:ben", "item:cy").map((e) => `${e.s} ${e.p} ${e.o}`)).toEqual(["item:cy child-of item:ben"])
    expect(edgesBetween(g, "item:ada", "item:lone")).toEqual([])
  })
})
