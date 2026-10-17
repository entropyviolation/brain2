import { describe, expect, it } from "vitest"
import { egoEdges } from "@/lib/link-graph"
import { PEOPLE_SELF_ID } from "@/lib/people-self"
import { derivedSelfEdges } from "@/lib/self-relations"
import type { ItemRecord } from "@/lib/types"

function person(id: string, relation?: string, extra: Partial<ItemRecord> = {}): ItemRecord {
  return {
    id,
    description: id,
    stage: "list",
    createdAt: new Date(0),
    completed: false,
    lists: [],
    type: "person",
    personProfile: relation ? { relation } : {},
    ...extra,
  } as ItemRecord
}

const self = person(PEOPLE_SELF_ID, undefined, { personProfile: { self: true } })

describe("derivedSelfEdges", () => {
  const all = [self, person("oey", "sister"), person("linda", "Mom"), person("eli", "coach"), person("nobody")]

  it("reads every Relation word from Self's side", () => {
    const edges = derivedSelfEdges(self, all)
    expect(edges.map((e) => [e.otherId, e.relation, e.label])).toEqual([
      ["oey", "sibling-of", undefined],
      ["linda", "child-of", undefined],
      ["eli", "knows", "your coach"],
    ])
    expect(edges.every((e) => e.direction === "derived" && e.derivedFrom === "relation-field")).toBe(true)
    expect(edges[0]!.family).toBe("family")
  })

  it("mirrors the word on the person's side", () => {
    expect(derivedSelfEdges(person("linda", "mom"), all)).toEqual([
      expect.objectContaining({ otherId: PEOPLE_SELF_ID, relation: "mother-of", direction: "derived" }),
    ])
    expect(derivedSelfEdges(person("oey", "sisters"), all)[0]).toMatchObject({ relation: "sibling-of" })
    expect(derivedSelfEdges(person("eli", "coach"), all)[0]).toMatchObject({ relation: "knows", label: "is your coach" })
    expect(derivedSelfEdges(person("nobody"), all)).toEqual([])
  })

  it("gives no derived edges without a Self item", () => {
    const noSelf = all.filter((p) => p.id !== PEOPLE_SELF_ID)
    expect(derivedSelfEdges(person("oey", "sister"), noSelf)).toEqual([])
  })

  it("lets a pinned link replace its derived twin", () => {
    const pinned = { ...self, links: [{ id: "l1", relation: "sibling-of", targetId: "oey" }] }
    const edges = egoEdges(pinned, all, derivedSelfEdges(pinned, all))
    const toOey = edges.filter((e) => e.otherId === "oey")
    expect(toOey).toHaveLength(1)
    expect(toOey[0]!.direction).toBe("out")
    // Mom on Linda's side: Self `child-of` Linda; pinning `child-of` drops it too.
    const mom = { ...self, links: [{ id: "l2", relation: "child-of", targetId: "linda" }] }
    expect(egoEdges(mom, all, derivedSelfEdges(mom, all)).filter((e) => e.otherId === "linda")).toHaveLength(1)
  })
})
