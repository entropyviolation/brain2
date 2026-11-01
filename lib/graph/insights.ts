/**
 * lib/graph/insights.ts — Counted findings over the whole-vault graph
 * (KNOWLEDGE_GRAPH_PLAN §5.7 KG-A, §5.8 KG-L).
 *
 * Pure and deterministic. Reads a `KnowledgeGraph` (`kg-model.ts`), never a
 * store. Every finding is description: a sentence carries `n`, the subset it
 * read, and the date range of its edges. Nothing here writes a link or a rule.
 * Mined chain rules are suggestions in `RelationRule` shape, off until the
 * person accepts one. Sentences are templates; no model reads or writes them.
 */
import type { EdgeOrder } from "@/lib/graph/vault-graph"
import type { KgEdge, KgNodeKind, KnowledgeGraph } from "@/lib/graph/kg-model"
import type { GraphProposal } from "@/lib/graph/proposal-schema"
import type { RelationRule } from "@/lib/graph/relation-rules"

/** Sample floor for a stated pattern (KG law 7, same as `OBSERVATORY_FLOOR`). */
export const GRAPH_SAMPLE_FLOOR = 7

export interface GraphView {
  /** Keep only nodes of these kinds. Omitted keeps every kind. */
  kinds?: readonly KgNodeKind[]
  /** Keep only edges of these orders. Omitted keeps every order. */
  orders?: readonly EdgeOrder[]
  /** Keep only edges from these named graphs. Omitted keeps every graph. */
  graphs?: readonly string[]
}

/** The undirected, simple projection every structural measure reads. */
export interface Projection {
  /** Node ids in the view, sorted. */
  ids: string[]
  /** Sorted, distinct neighbours. No self loops. */
  adj: Map<string, string[]>
  /** Directed, distinct successors (for PageRank). */
  succ: Map<string, string[]>
  edges: KgEdge[]
  /** Valid-time range of the kept edges, or null when none is dated. */
  range: { from: string; to: string } | null
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function project(g: KnowledgeGraph, view: GraphView = {}): Projection {
  const kinds = view.kinds ? new Set(view.kinds) : null
  const orders = view.orders ? new Set(view.orders) : null
  const graphs = view.graphs ? new Set(view.graphs) : null
  const ids = [...g.nodes.values()].filter((n) => !kinds || kinds.has(n.kind)).map((n) => n.id).sort(cmp)
  const keep = new Set(ids)
  const adjSet = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]))
  const succSet = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]))
  const edges: KgEdge[] = []
  let from = ""
  let to = ""
  for (const e of g.edges) {
    if (!keep.has(e.s) || !keep.has(e.o)) continue
    if (orders && !orders.has(e.order)) continue
    if (graphs && !graphs.has(e.graph)) continue
    edges.push(e)
    if (e.at) {
      if (!from || e.at < from) from = e.at
      if (!to || e.at > to) to = e.at
    }
    if (e.s === e.o) continue
    adjSet.get(e.s)!.add(e.o)
    adjSet.get(e.o)!.add(e.s)
    succSet.get(e.s)!.add(e.o)
  }
  const sorted = (m: Map<string, Set<string>>) => new Map([...m].map(([k, v]) => [k, [...v].sort(cmp)]))
  return { ids, adj: sorted(adjSet), succ: sorted(succSet), edges, range: from ? { from, to } : null }
}

function linkedIds(p: Projection): string[] {
  return p.ids.filter((id) => p.adj.get(id)!.length > 0)
}

export interface Ranked {
  id: string
  score: number
}

const byScore = (a: Ranked, b: Ranked) => b.score - a.score || cmp(a.id, b.id)

/** Directed PageRank over the view. Fixed iterations; dangling rank spreads evenly. */
export function pageRank(g: KnowledgeGraph | Projection, opts: GraphView & { damping?: number; iterations?: number } = {}): Ranked[] {
  const p = "adj" in g ? g : project(g, opts)
  const d = opts.damping ?? 0.85
  const iterations = opts.iterations ?? 50
  const n = p.ids.length
  if (!n) return []
  let rank = new Map(p.ids.map((id) => [id, 1 / n]))
  for (let it = 0; it < iterations; it++) {
    let dangling = 0
    for (const id of p.ids) if (!p.succ.get(id)!.length) dangling += rank.get(id)!
    const next = new Map(p.ids.map((id) => [id, (1 - d) / n + (d * dangling) / n]))
    for (const id of p.ids) {
      const out = p.succ.get(id)!
      if (!out.length) continue
      const share = (d * rank.get(id)!) / out.length
      for (const o of out) next.set(o, next.get(o)! + share)
    }
    rank = next
  }
  return p.ids.map((id) => ({ id, score: rank.get(id)! })).sort(byScore)
}

export interface Degree {
  id: string
  degree: number
  /** degree / (nodes − 1). */
  centrality: number
}

/** Undirected degree over distinct neighbours. */
export function degreeCentrality(g: KnowledgeGraph | Projection, view: GraphView = {}): Degree[] {
  const p = "adj" in g ? g : project(g, view)
  const denom = Math.max(1, p.ids.length - 1)
  return p.ids
    .map((id) => ({ id, degree: p.adj.get(id)!.length, centrality: p.adj.get(id)!.length / denom }))
    .sort((a, b) => b.degree - a.degree || cmp(a.id, b.id))
}

/** Nodes whose degree is at least `minDegree` (default the floor), most linked first. */
export function hubs(g: KnowledgeGraph | Projection, opts: GraphView & { minDegree?: number; limit?: number } = {}): Degree[] {
  const min = opts.minDegree ?? GRAPH_SAMPLE_FLOOR
  return degreeCentrality(g, opts).filter((r) => r.degree >= min).slice(0, opts.limit ?? 5)
}

/** Brandes betweenness, undirected, unnormalised: each unordered pair counts once. */
export function betweenness(g: KnowledgeGraph | Projection, view: GraphView = {}): Ranked[] {
  const p = "adj" in g ? g : project(g, view)
  const cb = new Map(p.ids.map((id) => [id, 0]))
  for (const s of p.ids) {
    const stack: string[] = []
    const preds = new Map<string, string[]>()
    const sigma = new Map<string, number>([[s, 1]])
    const dist = new Map<string, number>([[s, 0]])
    const queue = [s]
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi]
      stack.push(v)
      for (const w of p.adj.get(v)!) {
        if (!dist.has(w)) {
          dist.set(w, dist.get(v)! + 1)
          queue.push(w)
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + sigma.get(v)!)
          if (!preds.has(w)) preds.set(w, [])
          preds.get(w)!.push(v)
        }
      }
    }
    const delta = new Map<string, number>()
    while (stack.length) {
      const w = stack.pop()!
      for (const v of preds.get(w) ?? []) {
        delta.set(v, (delta.get(v) ?? 0) + (sigma.get(v)! / sigma.get(w)!) * (1 + (delta.get(w) ?? 0)))
      }
      if (w !== s) cb.set(w, cb.get(w)! + (delta.get(w) ?? 0))
    }
  }
  return p.ids.map((id) => ({ id, score: cb.get(id)! / 2 })).sort(byScore)
}

export interface Bridge {
  /** Ends sorted, `a < b`. */
  a: string
  b: string
  /** Nodes on the far side (the DFS subtree below the edge). */
  cut: number
  /** Nodes in the component the edge sits in. */
  component: number
}

export interface Articulation {
  id: string
  /** Pieces the component falls into without this node. */
  pieces: number
  component: number
}

/**
 * Bridges and articulation points of the undirected simple view (Tarjan,
 * iterative). Parallel edges between one pair count as one link, so two
 * relations between the same two nodes still make one bridge.
 */
export function bridges(g: KnowledgeGraph | Projection, view: GraphView = {}): { bridges: Bridge[]; articulations: Articulation[] } {
  const p = "adj" in g ? g : project(g, view)
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const size = new Map<string, number>()
  const out: Bridge[] = []
  const arts: Articulation[] = []
  let time = 0
  for (const root of p.ids) {
    if (disc.has(root)) continue
    const compStart = out.length
    const artStart = arts.length
    const pieces = new Map<string, number>()
    const members: string[] = []
    const stack: { v: string; parent: string | null; i: number }[] = [{ v: root, parent: null, i: 0 }]
    disc.set(root, time)
    low.set(root, time++)
    size.set(root, 1)
    members.push(root)
    while (stack.length) {
      const top = stack[stack.length - 1]
      const nbrs = p.adj.get(top.v)!
      if (top.i < nbrs.length) {
        const w = nbrs[top.i++]
        if (w === top.parent) continue
        if (disc.has(w)) {
          low.set(top.v, Math.min(low.get(top.v)!, disc.get(w)!))
        } else {
          disc.set(w, time)
          low.set(w, time++)
          size.set(w, 1)
          members.push(w)
          stack.push({ v: w, parent: top.v, i: 0 })
        }
        continue
      }
      stack.pop()
      const parent = top.parent
      if (parent === null) continue
      low.set(parent, Math.min(low.get(parent)!, low.get(top.v)!))
      size.set(parent, size.get(parent)! + size.get(top.v)!)
      if (low.get(top.v)! > disc.get(parent)!) {
        const [a, b] = cmp(parent, top.v) < 0 ? [parent, top.v] : [top.v, parent]
        out.push({ a, b, cut: size.get(top.v)!, component: 0 })
      }
      if (low.get(top.v)! >= disc.get(parent)!) pieces.set(parent, (pieces.get(parent) ?? 0) + 1)
    }
    for (const [id, k] of pieces) {
      // The root is a cut node only with two or more DFS children; any other node adds the piece above it.
      const total = id === root ? k : k + 1
      if (total >= 2) arts.push({ id, pieces: total, component: 0 })
    }
    for (let i = compStart; i < out.length; i++) out[i].component = members.length
    for (let i = artStart; i < arts.length; i++) arts[i].component = members.length
  }
  out.sort((x, y) => cmp(x.a, y.a) || cmp(x.b, y.b))
  arts.sort((x, y) => cmp(x.id, y.id))
  return { bridges: out, articulations: arts }
}

export interface Community {
  /** Smallest member id after propagation. */
  label: string
  members: string[]
}

/**
 * Deterministic label propagation. Nodes are read in sorted order and
 * updated together each round; each takes the most common label among
 * itself and its neighbours, ties to the smallest. (In-place updates with
 * smallest-label ties flood one label across a whole component.) Stops when nothing changes or at `maxIterations`. Isolated
 * nodes are left out. Largest community first.
 */
export function communities(g: KnowledgeGraph | Projection, opts: GraphView & { maxIterations?: number; minSize?: number } = {}): Community[] {
  const p = "adj" in g ? g : project(g, opts)
  const ids = linkedIds(p)
  const label = new Map(ids.map((id) => [id, id]))
  const max = opts.maxIterations ?? 20
  for (let it = 0; it < max; it++) {
    let changed = false
    const next = new Map<string, string>()
    for (const id of ids) {
      const counts = new Map<string, number>([[label.get(id)!, 1]])
      for (const w of p.adj.get(id)!) counts.set(label.get(w)!, (counts.get(label.get(w)!) ?? 0) + 1)
      let best = label.get(id)!
      let bestN = -1
      for (const [l, n] of counts) if (n > bestN || (n === bestN && cmp(l, best) < 0)) [best, bestN] = [l, n]
      next.set(id, best)
      if (best !== label.get(id)) changed = true
    }
    for (const [id, l] of next) label.set(id, l)
    if (!changed) break
  }
  const groups = new Map<string, string[]>()
  for (const id of ids) {
    const l = label.get(id)!
    if (!groups.has(l)) groups.set(l, [])
    groups.get(l)!.push(id)
  }
  return [...groups.values()]
    .map((members) => ({ label: members[0], members }))
    .filter((c) => c.members.length >= (opts.minSize ?? 2))
    .sort((a, b) => b.members.length - a.members.length || cmp(a.label, b.label))
}

/** `item:` nodes with no edge in the view. */
export function orphans(g: KnowledgeGraph | Projection, view: GraphView = {}): string[] {
  const p = "adj" in g ? g : project(g, view)
  const nodes = "adj" in g ? null : g.nodes
  const touched = new Set<string>()
  for (const e of p.edges) {
    touched.add(e.s)
    touched.add(e.o)
  }
  return p.ids.filter((id) => !touched.has(id) && (nodes ? nodes.get(id)?.kind === "item" : id.startsWith("item:")))
}

export interface MinedRule {
  chain: [string, string]
  head: string
  /** Body pairs (a, c) that also hold `head` directly. */
  support: number
  /** Distinct (a, c) pairs the chain reaches, a ≠ c. */
  n: number
  confidence: number
  /** Valid-time range over every body chain (the `n`), not only the supporting ones. */
  range: { from: string; to: string } | null
}

/**
 * AMIE-style length-2 chain rules: for relations r, s, count distinct pairs
 * a -r-> b -s-> c (a ≠ c), and how many also hold a -t-> c. Rules at or above
 * the support floor and `minConfidence` come back as suggestions. Mining reads
 * observed and recorded edges unless `orders` says otherwise, so a rule never
 * counts the edges another rule derived.
 */
export function mineChainRules(
  g: KnowledgeGraph | Projection,
  opts: GraphView & { floor?: number; minConfidence?: number; known?: readonly Pick<RelationRule, "chain" | "head">[]; limit?: number } = {},
): MinedRule[] {
  const p = "adj" in g ? g : project(g, { ...opts, orders: opts.orders ?? ["observed", "recorded"] })
  const floor = opts.floor ?? GRAPH_SAMPLE_FLOOR
  const minConfidence = opts.minConfidence ?? 0.5
  const known = new Set((opts.known ?? []).map((r) => `${r.chain.join(">")}=>${r.head}`))
  const outBy = new Map<string, KgEdge[]>()
  const direct = new Map<string, Set<string>>()
  for (const e of p.edges) {
    if (!outBy.has(e.s)) outBy.set(e.s, [])
    outBy.get(e.s)!.push(e)
    const k = `${e.s}\u0000${e.o}`
    if (!direct.has(k)) direct.set(k, new Set())
    direct.get(k)!.add(e.p)
  }
  // body "r>s" -> pair key -> earliest/latest date on the path
  const bodies = new Map<string, Map<string, { from?: string; to?: string }>>()
  for (const e1 of p.edges) {
    for (const e2 of outBy.get(e1.o) ?? []) {
      if (e2.o === e1.s) continue
      const body = `${e1.p}>${e2.p}`
      if (!bodies.has(body)) bodies.set(body, new Map())
      const pairs = bodies.get(body)!
      const k = `${e1.s}\u0000${e2.o}`
      const prev = pairs.get(k) ?? {}
      for (const at of [e1.at, e2.at]) {
        if (!at) continue
        if (!prev.from || at < prev.from) prev.from = at
        if (!prev.to || at > prev.to) prev.to = at
      }
      pairs.set(k, prev)
    }
  }
  const rules: MinedRule[] = []
  for (const body of [...bodies.keys()].sort(cmp)) {
    const pairs = bodies.get(body)!
    const n = pairs.size
    if (n < floor) continue
    const [r, s] = body.split(">") as [string, string]
    const heads = new Map<string, number>()
    let from = ""
    let to = ""
    for (const [k, dates] of pairs) {
      if (dates.from && (!from || dates.from < from)) from = dates.from
      if (dates.to && (!to || dates.to > to)) to = dates.to
      for (const t of direct.get(k) ?? []) heads.set(t, (heads.get(t) ?? 0) + 1)
    }
    for (const [head, support] of heads) {
      const confidence = support / n
      if (support < floor || confidence < minConfidence) continue
      if (known.has(`${r}>${s}=>${head}`)) continue
      rules.push({ chain: [r, s], head, support, n, confidence, range: from ? { from, to } : null })
    }
  }
  rules.sort((a, b) => b.confidence - a.confidence || b.support - a.support || cmp(`${a.chain}>${a.head}`, `${b.chain}>${b.head}`))
  return rules.slice(0, opts.limit ?? 20)
}

/** A mined rule as a `RelationRule` body, off until the person accepts it. */
export function minedRuleDraft(rule: MinedRule, label?: string): Omit<RelationRule, "id" | "createdAt"> {
  return { label: label ?? `${rule.chain[0]} then ${rule.chain[1]} gives ${rule.head}`, chain: [...rule.chain], head: rule.head, enabled: false }
}

/** A mined rule as an open inbox row (`densify:rule-mining`). The id is stable per rule. */
export function minedRuleProposal(rule: MinedRule, now: Date, label?: (id: string) => string): GraphProposal {
  return {
    id: `prop-mined-${rule.chain.join("-")}-${rule.head}`,
    kind: "rule",
    ruleDraft: minedRuleDraft(rule),
    origin: "densify:rule-mining",
    reason: chainRuleSentence(rule, label),
    score: rule.confidence,
    createdAt: now.toISOString(),
    status: "open",
  }
}

export type InsightKind = "pagerank" | "betweenness" | "hub" | "bridge" | "articulation" | "community" | "orphans" | "chain-rule"

export interface Insight {
  id: string
  kind: InsightKind
  nodeIds: string[]
  sentence: string
  /** The population the sentence counts over. */
  n: number
  order: "derived" | "inferred"
}

function rangeText(range: { from: string; to: string } | null): string {
  if (!range) return "undated"
  return range.from === range.to ? range.from : `${range.from} – ${range.to}`
}

function subsetText(view: GraphView): string {
  const nodes = view.kinds?.length ? `${view.kinds.join(", ")} nodes` : "all nodes"
  const edges = view.orders?.length ? `${view.orders.join(", ")} edges` : "all edges"
  return view.graphs?.length ? `${nodes}, ${edges} from ${view.graphs.join(", ")}` : `${nodes}, ${edges}`
}

function num(x: number): string {
  const r = Math.round(x * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

function names(ids: readonly string[], label: (id: string) => string, show = 3): string {
  const shown = ids.slice(0, show).map(label)
  const more = ids.length - shown.length
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ")
}

export function chainRuleSentence(rule: MinedRule, label: (id: string) => string = (id) => id): string {
  const pct = Math.round(rule.confidence * 100)
  return `On ${rule.support} of ${rule.n} chains ${label(rule.chain[0])} then ${label(rule.chain[1])}, ${label(rule.head)} also holds directly (${pct}%, n=${rule.n}, ${rangeText(rule.range)}).`
}

/**
 * Every finding as one neutral sentence. Nothing is said below the floor:
 * a view with fewer linked nodes than the floor returns only the orphan
 * count. Analytics are `derived`; mined rules are `inferred`.
 */
export function insightSentences(
  g: KnowledgeGraph,
  opts: GraphView & {
    label?: (id: string) => string
    relationLabel?: (id: string) => string
    floor?: number
    top?: number
    knownRules?: readonly Pick<RelationRule, "chain" | "head">[]
  } = {},
): Insight[] {
  const floor = opts.floor ?? GRAPH_SAMPLE_FLOOR
  const top = opts.top ?? 3
  const label = opts.label ?? ((id: string) => g.nodes.get(id)?.label ?? id)
  const view: GraphView = { kinds: opts.kinds, orders: opts.orders, graphs: opts.graphs }
  const p = project(g, view)
  const linked = linkedIds(p).length
  const among = `Among ${linked} linked nodes (${subsetText(view)}, ${rangeText(p.range)})`
  const out: Insight[] = []

  const lonely = orphans(p).filter((id) => g.nodes.get(id)?.kind === "item")
  const items = p.ids.filter((id) => g.nodes.get(id)?.kind === "item").length
  if (lonely.length) {
    out.push({
      id: "orphans",
      kind: "orphans",
      nodeIds: lonely,
      sentence: `${lonely.length} of ${items} item nodes have no edge in this view (${subsetText(view)}): ${names(lonely, label)}.`,
      n: items,
      order: "derived",
    })
  }
  if (linked < floor) return out

  pageRank(p, opts)
    .slice(0, top)
    .forEach((r, i) => {
      out.push({ id: `pagerank:${r.id}`, kind: "pagerank", nodeIds: [r.id], sentence: `${among}, ${label(r.id)} holds rank ${i + 1} by PageRank (${r.score.toFixed(3)}).`, n: linked, order: "derived" })
    })

  const pairs = (linked * (linked - 1)) / 2
  for (const r of betweenness(p).slice(0, top)) {
    if (r.score <= 0) break
    out.push({ id: `betweenness:${r.id}`, kind: "betweenness", nodeIds: [r.id], sentence: `${among}, ${label(r.id)} sits on the shortest paths of ${num(r.score)} of the ${pairs} node pairs.`, n: linked, order: "derived" })
  }

  for (const h of hubs(p, { minDegree: floor, limit: top })) {
    out.push({ id: `hub:${h.id}`, kind: "hub", nodeIds: [h.id], sentence: `${among}, ${label(h.id)} links to ${h.degree} of the other ${p.ids.length - 1} nodes.`, n: linked, order: "derived" })
  }

  const cut = bridges(p)
  for (const b of cut.bridges) {
    const rest = b.component - b.cut
    out.push({
      id: `bridge:${b.a}|${b.b}`,
      kind: "bridge",
      nodeIds: [b.a, b.b],
      sentence: `${among}, the link between ${label(b.a)} and ${label(b.b)} is the only route between a group of ${b.cut} and the other ${rest} nodes.`,
      n: linked,
      order: "derived",
    })
  }
  for (const a of cut.articulations) {
    out.push({ id: `articulation:${a.id}`, kind: "articulation", nodeIds: [a.id], sentence: `${among}, ${label(a.id)} is the only node joining ${a.pieces} groups of a ${a.component}-node component.`, n: linked, order: "derived" })
  }

  for (const c of communities(p, { minSize: floor })) {
    out.push({ id: `community:${c.label}`, kind: "community", nodeIds: c.members, sentence: `${among}, ${c.members.length} cluster together by shared links: ${names(c.members, label)}.`, n: linked, order: "derived" })
  }

  const rel = opts.relationLabel ?? ((id: string) => id)
  for (const r of mineChainRules(g, { ...view, floor, known: opts.knownRules })) {
    out.push({ id: `chain-rule:${r.chain.join(">")}=>${r.head}`, kind: "chain-rule", nodeIds: [], sentence: chainRuleSentence(r, rel), n: r.n, order: "inferred" })
  }
  return out
}
