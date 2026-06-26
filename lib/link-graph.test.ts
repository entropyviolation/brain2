import { describe, it, expect } from "vitest"
import { buildLinkGraph } from "@/lib/link-graph"
import type { Item, ItemLink } from "@/lib/types"

let linkSeq = 0
function link(relation: string, targetId: string): ItemLink {
  return { id: `lnk_${linkSeq++}`, relation, targetId }
}

function item(id: string, links: ItemLink[] = [], title?: string): Item {
  return { id, title: title ?? id.toUpperCase(), createdAt: new Date(0), links }
}

describe("buildLinkGraph — full graph", () => {
  it("builds a node per item and a labelled edge per link", () => {
    const items: Item[] = [
      item("a", [link("blocks", "b")]),
      item("b", [link("supports", "c")]),
      item("c"),
    ]
    const { nodes, edges } = buildLinkGraph(items)

    expect(nodes.map((n) => n.id)).toEqual(["a", "b", "c"])
    expect(nodes[0].label).toBe("A")

    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({ source: "a", target: "b", relation: "blocks", label: "blocks" })
    expect(edges[1]).toMatchObject({ source: "b", target: "c", relation: "supports", label: "supports" })
  })

  it("uses description as a label fallback when no title", () => {
    const items: Item[] = [{ id: "x", description: "Buy milk", createdAt: new Date(0) } as Item]
    const { nodes } = buildLinkGraph(items)
    expect(nodes[0].label).toBe("Buy milk")
  })

  it("falls back to the id when there is no title or description", () => {
    const items: Item[] = [{ id: "x", createdAt: new Date(0) } as Item]
    expect(buildLinkGraph(items).nodes[0].label).toBe("x")
  })

  it("skips self-links and links to unknown items", () => {
    const items: Item[] = [item("a", [link("blocks", "a"), link("blocks", "ghost")])]
    const { nodes, edges } = buildLinkGraph(items)
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it("returns empty graph for empty input", () => {
    expect(buildLinkGraph([])).toEqual({ nodes: [], edges: [] })
  })

  it("deduplicates identical (source, relation, target) edges", () => {
    const items: Item[] = [
      item("a", [link("blocks", "b"), link("blocks", "b")]),
      item("b"),
    ]
    expect(buildLinkGraph(items).edges).toHaveLength(1)
  })

  it("keeps same target under different relations as distinct edges", () => {
    const items: Item[] = [
      item("a", [link("blocks", "b"), link("supports", "b")]),
      item("b"),
    ]
    expect(buildLinkGraph(items).edges).toHaveLength(2)
  })
})

describe("buildLinkGraph — focus subgraph", () => {
  // a -> b -> c -> d ; plus e -> a (backlink into a)
  const items: Item[] = [
    item("a", [link("blocks", "b")]),
    item("b", [link("blocks", "c")]),
    item("c", [link("blocks", "d")]),
    item("d"),
    item("e", [link("blocks", "a")]),
  ]

  it("depth 1 returns the focus plus immediate forward + back neighbors", () => {
    const { nodes } = buildLinkGraph(items, { focusId: "a", depth: 1 })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "e"]))
  })

  it("defaults to depth 1 when depth is omitted", () => {
    const { nodes } = buildLinkGraph(items, { focusId: "a" })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "e"]))
  })

  it("depth 2 expands another hop in both directions", () => {
    const { nodes } = buildLinkGraph(items, { focusId: "a", depth: 2 })
    expect(new Set(nodes.map((n) => n.id))).toEqual(new Set(["a", "b", "c", "e"]))
  })

  it("includes backlinks as neighbors (e links to a)", () => {
    const { nodes, edges } = buildLinkGraph(items, { focusId: "a", depth: 1 })
    expect(nodes.map((n) => n.id)).toContain("e")
    // the backlink edge keeps its original direction (e -> a)
    expect(edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: "e", target: "a" })]),
    )
  })

  it("only includes edges whose endpoints are both in scope", () => {
    const { edges } = buildLinkGraph(items, { focusId: "a", depth: 1 })
    // a->b and e->a are in scope; b->c is not (c excluded at depth 1)
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "a", target: "b" }),
        expect.objectContaining({ source: "e", target: "a" }),
      ]),
    )
    expect(edges.some((e) => e.target === "c")).toBe(false)
  })

  it("depth 0 returns just the focus node, no edges", () => {
    const { nodes, edges } = buildLinkGraph(items, { focusId: "a", depth: 0 })
    expect(nodes.map((n) => n.id)).toEqual(["a"])
    expect(edges).toHaveLength(0)
  })

  it("returns empty graph when focusId is unknown", () => {
    expect(buildLinkGraph(items, { focusId: "nope" })).toEqual({ nodes: [], edges: [] })
  })
})
