import { describe, expect, it } from "vitest"
import "@/lib/person-relations"
import { allRelations } from "@/lib/relation-registry"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { schematicLayout } from "@/lib/graph/relation-schematic-layout"
import { dryRunRule } from "@/lib/graph/rule-dry-run"
import { deriveAround } from "@/lib/graph/ego-reason"
import { linkIndexOf } from "@/lib/graph/link-index"
import { makeRule } from "@/lib/graph/relation-rules"
import type { ItemRecord } from "@/lib/types"

const item = (id: string, links: [string, string][] = []) =>
  ({ id, title: id, lists: [], links: links.map(([relation, targetId], i) => ({ id: `${id}${i}`, relation, targetId })) }) as unknown as ItemRecord

describe("schematic layout", () => {
  it("puts the root left and every relation once, deterministically", () => {
    const defs = allRelations()
    const lattice = buildLattice(defs)
    const a = schematicLayout(defs, lattice)
    expect(a.nodes[0]).toMatchObject({ id: "related", x: 0 })
    expect(new Set(a.nodes.map((n) => n.id)).size).toBe(a.nodes.length)
    expect(schematicLayout(defs, lattice)).toEqual(a)
    const mother = a.nodes.find((n) => n.id === "mother-of")!
    expect(a.nodes.find((n) => n.id === mother.parent)!.x).toBeLessThan(mother.x)
  })
})

describe("rule dry run", () => {
  it("matches the reasoner over a fixture", () => {
    const tasks = [item("g", [["parent-of", "p"]]), item("p", [["parent-of", "c1"], ["parent-of", "c2"]]), item("c1"), item("c2"), item("h", [["grandparent-of", "c1"], ["parent-of", "p"]])]
    const lattice = buildLattice(allRelations())
    const rule = makeRule({ label: "G", chain: ["parent-of", "parent-of"], head: "grandparent-of" })
    const run = dryRunRule(rule, tasks, lattice)
    const links = linkIndexOf(tasks)
    const byReasoner = tasks.flatMap((t) => deriveAround(t.id, { links, rules: [rule], lattice, transitive: [] }).filter((d) => d.relation === "grandparent-of"))
    expect(run.fresh + run.known).toBe(byReasoner.length)
    expect(run).toMatchObject({ fresh: 3, known: 1 })
  })
})

describe("graph review", async () => {
  const { graphReview, linkEditsByWeek } = await import("@/lib/graph/graph-review")
  it("gives vault-wide suggestions, linkability, and link edits per week", () => {
    const tasks = [item("me", [["related", "a"], ["related", "b"]]), item("a", [["related", "x"]]), item("b", [["related", "x"]]), item("x"), item("lone")]
    const r = graphReview(tasks, (id) => id)
    expect(r.suggestions.map((s) => [s.fromId, s.otherId].sort().join("|"))).toContain("me|x")
    expect(r.linkability[0]).toMatchObject({ type: "item", linked: 4, total: 5 })
    const now = new Date("2026-10-16T12:00:00")
    const strip = linkEditsByWeek({ me: [{ id: "1", itemId: "me", at: "2026-10-14T10:00:00", summary: "", changes: [{ field: "links", label: "Links", from: "", to: "a" }] }] }, now, 2)
    expect(strip.map((w) => w.edits)).toEqual([0, 1])
  })
})
