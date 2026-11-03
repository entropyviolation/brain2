import { describe, expect, it } from "vitest"
import "@/lib/person-relations"
import { allRelations, getRelationDef } from "@/lib/relation-registry"
import { linkIndexOf } from "@/lib/graph/link-index"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { deriveAround } from "@/lib/graph/ego-reason"
import { makeRule, validateRule } from "@/lib/graph/relation-rules"
import { egoDensity } from "@/lib/graph/ego-density"
import { linkPath, pathQuery } from "@/lib/graph/link-path"
import { egoMatrix } from "@/lib/graph/ego-matrix"
import { egoChecks } from "@/lib/graph/relation-checks"
import { mergeSuggestions } from "@/lib/graph/densify"
import { triadSource } from "@/lib/graph/densify/triad"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import { mentionSource } from "@/lib/graph/densify/mention"
import { coMemberSource } from "@/lib/graph/densify/co-member"
import { coTimeSource } from "@/lib/graph/densify/co-time"
import { parseProposalFile } from "@/lib/graph/proposal-schema"
import { graphSnapshot } from "@/lib/graph/graph-snapshot"
import { inverseRelation } from "@/lib/links"
import type { ItemLink, ItemRecord } from "@/lib/types"

let n = 0
const l = (relation: string, targetId: string): ItemLink => ({ id: `l${++n}`, relation, targetId })
const item = (id: string, links: ItemLink[] = [], extra: Partial<ItemRecord> = {}) => ({ id, title: id, links, lists: [], ...extra }) as unknown as ItemRecord
const lattice = () => buildLattice(allRelations())
const transitive = () => allRelations().filter((d) => getRelationDef(d.id)?.traits?.transitive).map((d) => d.id)
const title = (id: string) => id

describe("ego reasoner", () => {
  const grand = makeRule({ label: "Grandparents", chain: ["parent-of", "parent-of"], head: "grandparent-of" })
  const all = [item("linda", [l("mother-of", "lio")]), item("lio", [l("parent-of", "oey")]), item("oey")]

  it("derives a grandparent chain from both ends, with a proof", () => {
    const ctx = { links: linkIndexOf(all), rules: [grand], lattice: lattice(), transitive: [] }
    const fromLinda = deriveAround("linda", ctx)
    expect(fromLinda).toEqual([expect.objectContaining({ otherId: "oey", relation: "grandparent-of", direction: "derived" })])
    expect(fromLinda[0].proof.steps.map((s) => s.to)).toEqual(["lio", "oey"])
    const fromOey = deriveAround("oey", ctx)
    expect(fromOey[0]).toMatchObject({ otherId: "linda", relation: getRelationDef("grandparent-of")!.inverse })
  })

  it("is silent for a disabled rule and blocked by unless", () => {
    const links = linkIndexOf(all)
    expect(deriveAround("linda", { links, rules: [{ ...grand, enabled: false }], lattice: lattice(), transitive: [] })).toEqual([])
    const withUnless = [item("linda", [l("mother-of", "lio"), l("friends-with", "oey")]), all[1], all[2]]
    expect(deriveAround("linda", { links: linkIndexOf(withUnless), rules: [{ ...grand, unless: "friends-with" }], lattice: lattice(), transitive: [] })).toEqual([])
  })

  it("closes part-of transitively, stops on a cycle, honours depth", () => {
    const chain = [item("a", [l("part-of", "b")]), item("b", [l("part-of", "c")]), item("c", [l("part-of", "a")])]
    const out = deriveAround("a", { links: linkIndexOf(chain), rules: [], lattice: lattice(), transitive: transitive() })
    expect(out.map((e) => `${e.otherId}:${e.relation}`)).toContain("c:part-of")
    expect(out.every((e) => e.otherId !== "a")).toBe(true)
    expect(deriveAround("a", { links: linkIndexOf(chain), rules: [], lattice: lattice(), transitive: transitive(), depth: 1 })).toEqual([])
  })

  it("validates rules", () => {
    expect(validateRule({ label: "", chain: ["parent-of"], head: "related" }, getRelationDef)).toMatch(/Name/)
    expect(validateRule({ label: "x", chain: ["a", "b", "c", "d"], head: "related" }, getRelationDef)).toMatch(/at most/)
    expect(validateRule({ label: "x", chain: ["nope"], head: "related" }, getRelationDef)).toMatch(/No relation/)
    expect(validateRule({ label: "x", chain: ["parent-of", "parent-of"], head: "grandparent-of" }, getRelationDef)).toBeNull()
  })
})

describe("density, path, matrix", () => {
  const all = [item("me", [l("related", "a"), l("related", "b"), l("related", "c")]), item("a", [l("related", "b")]), item("b"), item("c"), item("far", [l("related", "c")])]
  const links = linkIndexOf(all)
  it("computes clustering and open triads", () => {
    const d = egoDensity("me", links)
    expect(d.degree).toBe(3)
    expect(d.clustering).toBeCloseTo(1 / 3)
    expect(d.openTriads).toEqual([["a", "c"], ["b", "c"]])
  })
  it("finds a shortest path", () => {
    expect(linkPath("a", "far", links)!.map((s) => s.to)).toEqual(["me", "c", "far"])
    expect(linkPath("a", "nobody", links)).toBeNull()
    const family = [item("ada", [l("mother-of", "lio")]), item("lio"), item("xe", [l("blocks", "ada")])]
    const familyLinks = linkIndexOf(family)
    const along = { relation: "family-of", isSubrelation: (step: string, asked: string) => lattice().isSubrelation(step, asked) }
    expect(linkPath("ada", "lio", familyLinks, 6, along)!.map((step) => step.to)).toEqual(["lio"])
    expect(linkPath("xe", "ada", familyLinks, 6, along)).toBeNull()
    expect(linkPath("xe", "ada", familyLinks)!.map((step) => step.to)).toEqual(["ada"])
    expect(pathQuery("family-of Ada", allRelations())).toEqual({ along: "family-of", name: "Ada" })
  })
  it("marks open cells", () => {
    const m = egoMatrix("me", links)
    expect(m.ids[0]).toBe("me")
    const ia = m.ids.indexOf("a"), ic = m.ids.indexOf("c"), ib = m.ids.indexOf("b")
    expect(m.cells[ia][ic].open).toBe(true)
    expect(m.cells[ia][ib].relation).toBe("related")
  })
})

describe("checks", () => {
  it("counts an inverse-functional mother and a disjoint pair", () => {
    const all = [item("oey"), item("ida", [l("mother-of", "oey")]), item("kim", [l("mother-of", "oey")])]
    const ctx = { links: linkIndexOf(all), getDef: getRelationDef, lattice: lattice(), title, label: (r: string) => r }
    const kinds = egoChecks("oey", ctx).map((c) => c.kind)
    expect(kinds).toContain("inverse-functional")
    const dad = [item("oey"), item("ida", [l("mother-of", "oey")]), item("bo", [l("father-of", "oey")])]
    expect(egoChecks("oey", { ...ctx, links: linkIndexOf(dad) })).toEqual([])
    const ev = [item("b", [l("supported-by", "s"), l("refuted-by", "s")]), item("s")]
    expect(egoChecks("b", { ...ctx, links: linkIndexOf(ev) }).map((c) => c.kind)).toContain("disjoint")
  })
  it("sees a cycle on an acyclic relation", () => {
    const all = [item("a", [l("blocks", "b")]), item("b", [l("blocks", "a")])]
    const ctx = { links: linkIndexOf(all), getDef: getRelationDef, lattice: lattice(), title, label: (r: string) => r }
    expect(egoChecks("a", ctx).map((c) => c.kind)).toContain("acyclic")
  })
})

describe("densify", () => {
  it("offers triads, reciprocals, mentions, co-members, co-time; merges top five", () => {
    const all = [
      item("me", [l("related", "a"), l("related", "b")], { notes: "Lunch with Carla at noon", tags: ["jung", "rare"] }),
      item("a", [l("related", "x")]),
      item("b", [l("related", "x")]),
      item("x"),
      item("sam", [l("blocks", "me")]),
      item("Carla"),
      item("twin", [], { tags: ["jung", "rare"] }),
    ]
    const links = linkIndexOf(all)
    const ctx = { all, links, title }
    const me = all[0]
    expect(triadSource(me, ctx)).toEqual([expect.objectContaining({ otherId: "x", source: "triad" })])
    expect(reciprocalSource(me, ctx)[0]).toMatchObject({ otherId: "sam", relation: inverseRelation("blocks") })
    expect(mentionSource(me, ctx)[0]).toMatchObject({ otherId: "Carla", evidence: expect.objectContaining({ field: "notes" }) })
    expect(mentionSource(me, ctx)[0].reason).toMatch(/"Lunch with Carla at noon"/)
    expect(mentionSource(me, { ...ctx, scopeOk: () => false })).toEqual([])
    expect(mentionSource(me, ctx)[0].relation).toBe("mentioned")

    const elijah = (id: string, extra: Partial<ItemRecord> = {}) => item(id, [], { title: "Elijah", ...extra })
    const note = item("day", [], {
      title: "Elijah called",
      description: "Eli stopped by",
      noteLog: [
        { id: "n1", date: "2026-10-28", text: "elijah" },
        { id: "n2", date: "2026-10-28", text: "elijah" },
        { id: "n3", date: "2026-10-28", text: "elijah" },
      ],
    })
    const people = [
      note,
      elijah("e1", { personProfile: { close: true, nicknames: ["Eli"] } }),
      elijah("e2"),
      elijah("e3"),
    ]
    const hits = mentionSource(note, { all: people, links: linkIndexOf(people), title: (id) => people.find((p) => p.id === id)?.title ?? id })
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ otherId: "e1", relation: "mentioned", evidence: { field: "title" } })

    const far = item("far", [], { title: "Elijah Smith" })
    const nickNote = item("nick", [], { description: "Ask Eli about the keys" })
    const close = item("eli", [], { title: "Elijah Smith", personProfile: { close: true, nicknames: ["Eli"] } })
    const nickHits = mentionSource(nickNote, { all: [nickNote, far, close], links: linkIndexOf([nickNote, far, close]), title: (id) => (id === "far" || id === "eli" ? "Elijah Smith" : id) })
    expect(nickHits).toEqual([expect.objectContaining({ otherId: "eli", relation: "mentioned", evidence: expect.objectContaining({ field: "description" }) })])
    expect(coMemberSource(me, ctx)[0]).toMatchObject({ otherId: "twin", reason: "Both on #jung and #rare" })
    expect(coTimeSource(me, ctx, [{ otherId: "x", sittings: 3, sharedMinutes: 10, minMinutes: 20 }])).toEqual([])
    const shelf = mergeSuggestions({ ...me, dismissedLinkSuggestions: [mentionSource(me, ctx)[0].key] }, [triadSource(me, ctx), mentionSource(me, ctx), reciprocalSource(me, ctx)], { links, muted: ["triad"] })
    expect(shelf.map((s) => s.otherId)).toEqual(["sam"])
    for (const s of [...triadSource(me, ctx), ...coMemberSource(me, ctx)]) expect(s.score).toBeGreaterThanOrEqual(0)
  })
})

describe("file door", () => {
  it("drops bad rows with a count and keeps private items out", () => {
    const has = new Set(["a", "b"])
    const { rows, dropped } = parseProposalFile(
      { proposals: [{ kind: "link", sourceId: "a", targetId: "b", relation: "related", reason: "both" }, { kind: "link", sourceId: "a", targetId: "zz", relation: "related", reason: "x" }, { kind: "link", sourceId: "a", targetId: "b", relation: "related" }] },
      { hasItem: (id) => has.has(id), getDef: getRelationDef, origin: "import:test" },
    )
    expect(rows).toHaveLength(1)
    expect(dropped).toBe(2)
    const snap = graphSnapshot({ tasks: [item("a", [l("related", "s")]), item("s", [], { lists: ["sleep-log"] })], relations: allRelations(), rules: [], title: (t) => t.id })
    expect(snap.items.map((i) => i.id)).toEqual(["a"])
    expect(snap.links).toEqual([])
    expect(snap.leftOut.privateItems).toBe(1)
  })
})
