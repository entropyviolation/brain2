import { afterEach, describe, expect, it } from "vitest"
import { egoEdges, edgeCount, secondRing } from "@/lib/link-graph"
import { derivedSelfEdges } from "@/lib/self-relations"
import { registerRelationDefs } from "@/lib/links"
import { createRelationPair } from "@/lib/relation-registry"
import { PEOPLE_SELF_ID } from "@/lib/people-self"
import type { ItemLink, Task } from "@/lib/types"

function item(id: string, links: ItemLink[] = [], extra: Partial<Task> = {}): Task {
  return { id, description: id, title: id, links, ...extra } as Task
}
const link = (id: string, relation: string, targetId: string): ItemLink => ({ id, relation, targetId })

afterEach(() => registerRelationDefs([]))

describe("egoEdges", () => {
  it("reads out, in (as the inverse), and merges a mutual pair", () => {
    const elijah = item("elijah", [link("l1", "member-of", "foxtide"), link("l2", "friends-with", "oey")])
    const all = [
      elijah,
      item("foxtide", [link("l3", "has-member", "elijah")]),
      item("oey"),
      item("linda", [link("l4", "mother-of", "elijah")]),
    ]
    const edges = egoEdges(elijah, all)
    const by = Object.fromEntries(edges.map((e) => [e.otherId, e]))
    expect(by.foxtide.direction).toBe("mutual")
    expect(by.foxtide.outLinkId).toBe("l1")
    expect(by.foxtide.inLink?.linkId).toBe("l3")
    expect(by.oey.direction).toBe("out")
    expect(by.linda.direction).toBe("in")
    expect(by.linda.relation).toBe("child-of")
    expect(by.linda.label).toBe("is the child of")
    expect(edgeCount(edges)).toBe(3)
  })

  it("merges a symmetric relation said from both sides", () => {
    const a = item("a", [link("x", "friends-with", "b")])
    const b = item("b", [link("y", "friends-with", "a")])
    const edges = egoEdges(a, [a, b])
    expect(edges).toHaveLength(1)
    expect(edges[0].direction).toBe("mutual")
  })

  it("reads person-made relations through the registry", () => {
    const [drummer, hasDrummer] = createRelationPair({ label: "is the drummer of", inverseLabel: "has drummer" })
    registerRelationDefs([drummer, hasDrummer])
    const band = item("band")
    const eli = item("eli", [link("d", drummer.id, "band")])
    const edges = egoEdges(band, [band, eli])
    expect(edges[0].label).toBe("has drummer")
  })

  it("drops a derived edge when a real one has its key, and lists the second ring", () => {
    const self = item(PEOPLE_SELF_ID, [link("s", "sibling-of", "oey")], { personProfile: { self: true } })
    const oey = item("oey", [link("o", "friends-with", "kai")], { personProfile: { relation: "sister" } })
    const elijah = item("elijah", [], { personProfile: { relation: "coach" } })
    const all = [self, oey, elijah, item("kai")]
    const derived = derivedSelfEdges(self, all)
    expect(derived.map((e) => e.otherId).sort()).toEqual(["elijah", "oey"])
    const edges = egoEdges(self, all, derived)
    expect(edges.find((e) => e.otherId === "oey")?.direction).toBe("out")
    expect(edges.find((e) => e.otherId === "elijah")?.label).toBe("knows · coach")
    expect(secondRing(self.id, edges, all).map((r) => r.to)).toEqual(["kai"])
  })
})

describe("derivedSelfEdges", () => {
  it("mirrors onto the person, and hides dismissed keys", () => {
    const self = item(PEOPLE_SELF_ID, [], { personProfile: { self: true } })
    const linda = item("linda", [], { personProfile: { relation: "Mom" } })
    const onLinda = derivedSelfEdges(linda, [self, linda])
    expect(onLinda[0].relation).toBe("parent-of")
    expect(onLinda[0].otherId).toBe(PEOPLE_SELF_ID)
    const onSelf = derivedSelfEdges(self, [self, linda])
    expect(onSelf[0].relation).toBe("child-of")
    expect(derivedSelfEdges(self, [self, linda], [onSelf[0].key])).toHaveLength(0)
  })

  it("is empty with no self", () => {
    const linda = item("linda", [], { personProfile: { relation: "mom" } })
    expect(derivedSelfEdges(linda, [linda])).toEqual([])
  })
})
