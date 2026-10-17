import { afterEach, describe, expect, it } from "vitest"
import { canonicalRelation, egoEdges, secondRing, type EgoEdge } from "@/lib/link-graph"
import { createRelationPair, registerCustomRelations } from "@/lib/relation-registry"
import type { ItemLink, ItemRecord } from "@/lib/types"

function link(id: string, relation: string, targetId: string): ItemLink {
  return { id, relation, targetId }
}

function item(id: string, links: ItemLink[] = []): ItemRecord {
  return { id, title: id, links } as unknown as ItemRecord
}

afterEach(() => registerCustomRelations([]))

describe("egoEdges", () => {
  it("reads outgoing links as written", () => {
    const me = item("me", [link("l1", "blocks", "b")])
    const edges = egoEdges(me, [me, item("b")])
    expect(edges).toEqual([
      expect.objectContaining({ otherId: "b", relation: "blocks", direction: "out", outLinkId: "l1", family: "task" }),
    ])
  })

  it("reads incoming links through the inverse", () => {
    const me = item("me")
    const other = item("x", [link("l9", "blocks", "me")])
    const [edge] = egoEdges(me, [me, other])
    expect(edge).toMatchObject({
      otherId: "x",
      relation: "blocked-by",
      direction: "in",
      inLink: { sourceId: "x", linkId: "l9", relation: "blocks" },
    })
  })

  it("merges a reciprocal pair into one mutual edge", () => {
    const me = item("me", [link("l1", "parent-of", "kid")])
    const kid = item("kid", [link("l2", "child-of", "me")])
    const edges = egoEdges(me, [me, kid])
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ direction: "mutual", relation: "parent-of", outLinkId: "l1", family: "family" })
    expect(edges[0].inLink?.linkId).toBe("l2")
  })

  it("merges a symmetric relation held on both sides", () => {
    const me = item("me", [link("l1", "friends-with", "x")])
    const x = item("x", [link("l2", "friends-with", "me")])
    const edges = egoEdges(me, [me, x])
    expect(edges).toHaveLength(1)
    expect(edges[0].direction).toBe("mutual")
    expect(edges[0].key).toBe(`x|${canonicalRelation("friends-with")}`)
  })

  it("merges a many-to-one inverse (mother-of + child-of)", () => {
    const mom = item("mom", [link("l1", "mother-of", "kid")])
    const kid = item("kid", [link("l2", "child-of", "mom")])
    expect(egoEdges(mom, [mom, kid]).map((e) => e.direction)).toEqual(["mutual"])
  })

  it("skips the item's own saved copy and self-links", () => {
    const draft = item("me", [link("l1", "related", "me")])
    const saved = item("me", [link("l0", "related", "x")])
    expect(egoEdges(draft, [saved, item("x")])).toEqual([])
  })

  it("drops a derived edge when a real edge has the same key", () => {
    const me = item("me", [link("l1", "sibling-of", "oey")])
    const derived: EgoEdge[] = [
      { key: "", otherId: "oey", relation: "sibling-of", direction: "derived", family: "family", derivedFrom: "relation-field" },
      { key: "", otherId: "linda", relation: "child-of", direction: "derived", family: "family", derivedFrom: "relation-field" },
    ]
    const edges = egoEdges(me, [me], derived)
    expect(edges.map((e) => `${e.otherId}:${e.direction}`)).toEqual(["oey:out", "linda:derived"])
  })

  it("reads a custom relation through the registry", () => {
    const [member, has] = createRelationPair({ label: "plays in", inverseLabel: "has player", symmetric: false })
    registerCustomRelations([member, has])
    const me = item("band")
    const player = item("p", [link("l1", member.id, "band")])
    const [edge] = egoEdges(me, [me, player])
    expect(edge).toMatchObject({ relation: has.id, direction: "in", family: "other" })
  })
})

describe("secondRing", () => {
  it("lists neighbors of neighbors once, not the center or ring 1", () => {
    const me = item("me", [link("l1", "friends-with", "a"), link("l2", "friends-with", "b")])
    const a = item("a", [link("l3", "friends-with", "b"), link("l4", "friends-with", "z"), link("l5", "friends-with", "me")])
    const b = item("b", [link("l6", "friends-with", "z"), link("l7", "friends-with", "y")])
    const all = [me, a, b, item("z"), item("y")]
    const ring = secondRing(egoEdges(me, all), all, 10, "me")
    expect(ring.map((r) => `${r.from}>${r.edge.otherId}`)).toEqual(["a>z", "b>y"])
    expect(secondRing(egoEdges(me, all), all, 1, "me")).toHaveLength(1)
  })
})
