import { describe, expect, it } from "vitest"
import type { KgEdge, KgNodeKind, KnowledgeGraph } from "@/lib/graph/kg-model"
import {
  betweenness,
  bridges,
  communities,
  degreeCentrality,
  hubs,
  insightSentences,
  mineChainRules,
  minedRuleDraft,
  minedRuleProposal,
  orphans,
  pageRank,
} from "@/lib/graph/insights"

type E = [string, string, string, Partial<KgEdge>?]

/** A hand-built graph: ids without a prefix become `item:` nodes. */
function kg(nodes: string[], edges: E[], kind: (id: string) => KgNodeKind = () => "item"): KnowledgeGraph {
  const g: KnowledgeGraph = { nodes: new Map(), edges: [], out: new Map(), in: new Map() }
  for (const id of nodes) g.nodes.set(id, { id, kind: kind(id), label: id.replace(/^\w+:/, "") })
  for (const [s, p, o, extra] of edges) {
    const e: KgEdge = { s, p, o, graph: "links", order: "recorded", ...extra }
    g.edges.push(e)
    if (!g.out.has(s)) g.out.set(s, [])
    if (!g.in.has(o)) g.in.set(o, [])
    g.out.get(s)!.push(e)
    g.in.get(o)!.push(e)
  }
  return g
}

const ids = (n: number, p = "item:n") => Array.from({ length: n }, (_, i) => `${p}${String(i).padStart(2, "0")}`)

describe("pageRank", () => {
  it("sums to 1, ranks the sink of a star first, and is deterministic", () => {
    const n = ids(5)
    const g = kg(n, n.slice(1).map((x) => [x, "rel", n[0]] as E))
    const r = pageRank(g)
    expect(r[0].id).toBe(n[0])
    expect(r.reduce((s, x) => s + x.score, 0)).toBeCloseTo(1, 6)
    // ties broken by id
    expect(r.slice(1).map((x) => x.id)).toEqual(n.slice(1))
    expect(pageRank(g)).toEqual(r)
  })
})

describe("degree and hubs", () => {
  it("counts distinct neighbours both ways", () => {
    const g = kg(["item:a", "item:b", "item:c"], [["item:a", "x", "item:b"], ["item:b", "y", "item:a"], ["item:c", "x", "item:a"]])
    const d = degreeCentrality(g)
    expect(d[0]).toEqual({ id: "item:a", degree: 2, centrality: 1 })
    expect(hubs(g, { minDegree: 2 }).map((h) => h.id)).toEqual(["item:a"])
    expect(hubs(g)).toEqual([])
  })
})

describe("bridges", () => {
  it("finds the bridge and the cut nodes between two triangles", () => {
    const g = kg(
      ["item:a", "item:b", "item:c", "item:d", "item:e", "item:f"],
      [
        ["item:a", "r", "item:b"],
        ["item:b", "r", "item:c"],
        ["item:c", "r", "item:a"],
        ["item:c", "r", "item:d"],
        ["item:d", "r", "item:e"],
        ["item:e", "r", "item:f"],
        ["item:f", "r", "item:d"],
      ],
    )
    const out = bridges(g)
    expect(out.bridges).toEqual([{ a: "item:c", b: "item:d", cut: 3, component: 6 }])
    expect(out.articulations.map((a) => [a.id, a.pieces])).toEqual([
      ["item:c", 2],
      ["item:d", 2],
    ])
  })

  it("does not overflow on a long path", () => {
    const n = ids(20000)
    const g = kg(n, n.slice(1).map((x, i) => [n[i], "r", x] as E))
    const out = bridges(g)
    expect(out.bridges.length).toBe(19999)
    expect(out.articulations.length).toBe(19998)
  })
})

describe("communities", () => {
  it("separates two cliques joined by one edge", () => {
    const left = ids(4, "item:l")
    const right = ids(4, "item:r")
    const edges: E[] = []
    for (const side of [left, right]) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) edges.push([side[i], "r", side[j]])
    edges.push([left[3], "r", right[0]])
    const g = kg([...left, ...right, "item:z"], edges)
    const c = communities(g)
    expect(c.map((x) => x.members)).toEqual([left, right])
    expect(communities(g)).toEqual(c)
  })
})

describe("orphans and betweenness", () => {
  it("lists item nodes with no edge, not day nodes", () => {
    const g = kg(["item:a", "item:b", "item:c", "day:2026-11-01"], [["item:a", "r", "item:b"]], (id) => (id.startsWith("day:") ? "day" : "item"))
    expect(orphans(g)).toEqual(["item:c"])
  })
  it("puts the middle of a path on every crossing pair", () => {
    const g = kg(["item:a", "item:b", "item:c"], [["item:a", "r", "item:b"], ["item:b", "r", "item:c"]])
    expect(betweenness(g)[0]).toEqual({ id: "item:b", score: 1 })
  })
})

describe("mineChainRules", () => {
  function chains(withHead: number, without: number) {
    const nodes: string[] = []
    const edges: E[] = []
    for (let i = 0; i < withHead + without; i++) {
      const [a, b, c] = [`item:a${i}`, `item:b${i}`, `item:c${i}`]
      nodes.push(a, b, c)
      edges.push([a, "part-of", b, { at: `2026-10-${String(i + 1).padStart(2, "0")}` }], [b, "part-of", c])
      if (i < withHead) edges.push([a, "part-of", c])
    }
    return kg(nodes, edges)
  }

  it("counts support and confidence and emits a rule body", () => {
    const rules = mineChainRules(chains(9, 2))
    const r = rules.find((x) => x.head === "part-of" && x.chain.join() === "part-of,part-of")!
    expect(r).toMatchObject({ support: 9, n: 11 })
    expect(r.confidence).toBeCloseTo(9 / 11)
    expect(r.range).toEqual({ from: "2026-10-01", to: "2026-10-11" })
    expect(minedRuleDraft(r)).toMatchObject({ chain: ["part-of", "part-of"], head: "part-of", enabled: false })
    const prop = minedRuleProposal(r, new Date("2026-11-01T00:00:00Z"))
    expect(prop).toMatchObject({ kind: "rule", status: "open", origin: "densify:rule-mining" })
    expect(prop.reason).toContain("On 9 of 11 chains part-of then part-of, part-of also holds directly")
  })

  it("stays quiet under the floor and skips known rules and derived edges", () => {
    expect(mineChainRules(chains(6, 0))).toEqual([])
    expect(mineChainRules(chains(9, 2), { known: [{ chain: ["part-of", "part-of"], head: "part-of" }] })).toEqual([])
    const g = chains(9, 0)
    for (const e of g.edges) e.order = "derived"
    expect(mineChainRules(g)).toEqual([])
  })
})

describe("insightSentences", () => {
  it("speaks in counts with n, subset, and range, never prediction words", () => {
    const n = ids(10)
    const edges: E[] = n.slice(1).map((x, i) => [n[0], "r", x, { at: `2026-10-${String(i + 1).padStart(2, "0")}` }] as E)
    const g = kg([...n, "item:lonely"], edges)
    const out = insightSentences(g, { kinds: ["item"] })
    const kinds = new Set(out.map((i) => i.kind))
    expect(kinds.has("orphans")).toBe(true)
    expect(kinds.has("pagerank")).toBe(true)
    expect(kinds.has("hub")).toBe(true)
    const hub = out.find((i) => i.kind === "hub")!
    expect(hub.sentence).toBe("Among 10 linked nodes (item nodes, all edges, 2026-10-01 – 2026-10-09), n00 links to 9 of the other 10 nodes.")
    for (const i of out) {
      expect(i.sentence).not.toMatch(/\b(will|causes?|should)\b/i)
      expect(i.order).toBe("derived")
    }
  })

  it("says nothing but orphans below the floor", () => {
    const g = kg(["item:a", "item:b", "item:c"], [["item:a", "r", "item:b"]])
    expect(insightSentences(g).map((i) => i.kind)).toEqual(["orphans"])
  })
})
