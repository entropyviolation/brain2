import { describe, expect, it } from "vitest"
import { projectVaultEdges } from "@/lib/graph/vault-edges"

describe("recorded edges outside the day spine", () => {
  const items = [
    { id: "a", links: [{ relation: "related", targetId: "b" }], dependencies: ["c", "c", "a"] },
    { id: "b", links: [{ relation: "same-as", targetId: "a" }, { relation: "", targetId: "c" }] },
    { id: "c", links: [{ relation: "different-from", targetId: "b" }] },
  ]

  it("projects item links and depends-on as recorded triples, and does not write them back", () => {
    const before = items.map((item) => ({ ...item, links: item.links.map((link) => ({ ...link })) }))
    const triples = projectVaultEdges({ items })
    expect(triples).toEqual([
      { s: "item:a", p: "related", o: "item:b", graph: "links", order: "recorded" },
      { s: "item:a", p: "depends-on", o: "item:c", graph: "dependencies", order: "recorded" },
      { s: "item:b", p: "same-as", o: "item:a", graph: "links", order: "recorded" },
      { s: "item:c", p: "different-from", o: "item:b", graph: "links", order: "recorded" },
    ])
    expect(triples.every((triple) => triple.order === "recorded")).toBe(true)
    expect(triples.some((triple) => triple.p === "nested-in" || triple.s.startsWith("day:"))).toBe(false)
    expect(items).toEqual(before)
    expect(items[0].links.some((link) => link.relation === "depends-on")).toBe(false)
  })

  it("projects list links only when lists are passed", () => {
    expect(projectVaultEdges({ items }).some((triple) => triple.graph === "lists")).toBe(false)
    const withLists = projectVaultEdges({
      items,
      lists: [
        { id: "ink", linkedTargetListIds: ["paper", "ink"] },
        { id: "paper" },
        { id: "gone", linkedTargetListIds: ["missing"] },
      ],
    })
    expect(withLists.filter((triple) => triple.graph === "lists")).toEqual([
      { s: "list:ink", p: "linked-list", o: "list:paper", graph: "lists", order: "recorded" },
      { s: "list:gone", p: "linked-list", o: "list:missing", graph: "lists", order: "recorded" },
    ])
  })
})
