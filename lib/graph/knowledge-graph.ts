/**
 * lib/graph/knowledge-graph.ts — The whole-vault knowledge graph (KG-D1, KG-R1).
 *
 * A read-only merge. The day spine (`projectVault`), the recorded edges
 * (`projectVaultEdges`), and, when asked, vault-wide derived edges become one
 * `KnowledgeGraph` (`kg-model.ts`). Nothing is written back to a store.
 *
 * Derived edges (order `derived`, graph `derived`) come from two places:
 * - transitive closure for each relation with `traits.transitive`, depth at
 *   most `KG_CLOSURE_DEPTH`;
 * - enabled chain rules of one to three steps (`relation-rules.ts`), with
 *   guards and `unless`.
 * A step matches a relation r when its relation ⊑ r in the lattice. A
 * recorded link is also read backwards through its def's inverse, as
 * `ego-reason.ts` does. A derived edge is dropped when the same fact (or its
 * inverse form) is already an edge. One pass, not a fixpoint: derived edges
 * do not feed further rules. Total derived edges stop at `KG_DERIVED_CAP`.
 *
 * Pure. No registry import: pass `defs` (for example `allRelations()`).
 */
import type { KgEdge, KgNode, KgNodeKind, KnowledgeGraph } from "@/lib/graph/kg-model"
import { buildLattice } from "@/lib/graph/relation-lattice"
import type { RelationRule } from "@/lib/graph/relation-rules"
import { projectVaultEdges, type VaultEdgeItem, type VaultEdgeList } from "@/lib/graph/vault-edges"
import type { EdgeOrder, SpineGraph } from "@/lib/graph/vault-graph"
import type { RelationDef } from "@/lib/links"

export const KG_CLOSURE_DEPTH = 6
export const KG_DERIVED_CAP = 20_000

export interface KgItem extends VaultEdgeItem {
  title?: string
  type?: string
}

export interface KnowledgeGraphInput {
  items: readonly KgItem[]
  lists?: readonly (VaultEdgeList & { name?: string })[]
  spine?: SpineGraph
  rules?: readonly RelationRule[]
  defs?: readonly RelationDef[]
  /** Add read-time closure and chain-rule edges. Default false. */
  withDerived?: boolean
}

const KINDS = new Set<KgNodeKind>([
  "item",
  "list",
  "pen",
  "block",
  "message",
  "place",
  "habit",
  "day",
  "week",
  "month",
  "season",
  "year",
])
const PERIODS = new Set<string>(["day", "week", "month", "season", "year"])

/** Kind of an address. A bare id is an item. Null when the prefix is not a `KgNodeKind`. */
export function nodeKind(address: string): KgNodeKind | null {
  const at = address.indexOf(":")
  if (at < 0) return "item"
  const prefix = address.slice(0, at)
  return KINDS.has(prefix as KgNodeKind) ? (prefix as KgNodeKind) : null
}

/** Nearest kind for a prefix outside `KgNodeKind`. */
function nearestKind(address: string): { kind: KgNodeKind; prefix: string } {
  const [prefix, second] = address.split(":")
  if (prefix === "who") return { kind: "pen", prefix }
  if ((prefix === "period" || prefix === "review") && PERIODS.has(second)) return { kind: second as KgNodeKind, prefix }
  if (prefix === "period" || prefix === "review") return { kind: "day", prefix }
  if (prefix === "stream" || prefix === "capture") return { kind: "message", prefix }
  return { kind: "item", prefix }
}

function itemAddr(id: string): string {
  return id.startsWith("item:") ? id : `item:${id}`
}

function edgeId(e: Pick<KgEdge, "s" | "p" | "o">): string {
  return `${e.s}|${e.p}|${e.o}`
}

let cache: { input: KnowledgeGraphInput; graph: KnowledgeGraph } | null = null

function sameInput(a: KnowledgeGraphInput, b: KnowledgeGraphInput): boolean {
  return (
    a.items === b.items &&
    a.lists === b.lists &&
    a.spine === b.spine &&
    a.rules === b.rules &&
    a.defs === b.defs &&
    !!a.withDerived === !!b.withDerived
  )
}

/** Build the whole-vault graph. Cached by the identity of every input field. */
export function buildKnowledgeGraph(input: KnowledgeGraphInput): KnowledgeGraph {
  if (cache && sameInput(cache.input, input)) return cache.graph
  const graph = build(input)
  cache = { input: { ...input }, graph }
  return graph
}

function build(input: KnowledgeGraphInput): KnowledgeGraph {
  const edges: KgEdge[] = []
  const keyed = new Set<string>()
  const push = (e: KgEdge) => {
    const key = `${edgeId(e)}|${e.graph}`
    if (keyed.has(key)) return
    keyed.add(key)
    edges.push(e)
  }

  for (const t of input.spine?.triples ?? []) {
    const e: KgEdge = { s: t.s, p: t.p, o: t.o, graph: t.graph, order: t.order }
    if (t.at) e.at = t.at
    push(e)
  }
  for (const t of projectVaultEdges({ items: input.items, lists: input.lists })) {
    push({ s: t.s, p: t.p, o: t.o, graph: t.graph, order: t.order })
  }

  const typeOf = new Map<string, string>()
  for (const item of input.items) if (item?.id && item.type) typeOf.set(itemAddr(item.id), item.type)

  if (input.withDerived) {
    for (const e of deriveEdges(edges, input.rules ?? [], input.defs ?? [], (id) => typeOf.get(id))) push(e)
  }

  // Nodes.
  const nodes = new Map<string, KgNode>()
  const labels = input.spine?.labels ?? {}
  const titles = new Map<string, string>()
  for (const item of input.items) if (item?.id && item.title?.trim()) titles.set(itemAddr(item.id), item.title.trim())
  for (const list of input.lists ?? []) if (list?.id && list.name?.trim()) titles.set(`list:${list.id}`, list.name.trim())
  const addNode = (id: string) => {
    if (nodes.has(id)) return
    const kind = nodeKind(id)
    const node: KgNode = kind ? { id, kind, label: "" } : { id, ...nearestKind(id), label: "" }
    node.label = titles.get(id) || labels[id] || id.slice(id.indexOf(":") + 1) || id
    const typeId = typeOf.get(id)
    if (typeId) node.typeId = typeId
    nodes.set(id, node)
  }
  for (const item of input.items) if (item?.id) addNode(itemAddr(item.id))
  for (const e of edges) {
    addNode(e.s)
    addNode(e.o)
  }

  const out = new Map<string, KgEdge[]>()
  const inn = new Map<string, KgEdge[]>()
  for (const e of edges) {
    ;(out.get(e.s) ?? out.set(e.s, []).get(e.s)!).push(e)
    ;(inn.get(e.o) ?? inn.set(e.o, []).get(e.o)!).push(e)
  }
  return { nodes, edges, out, in: inn }
}

interface Fact {
  s: string
  p: string
  o: string
}

/**
 * Vault-wide derived edges. Facts are the non-derived edges plus each
 * recorded edge read back through its def's inverse. Deterministic: rules,
 * relations, and start nodes are walked in sorted order.
 */
export function deriveEdges(
  base: readonly KgEdge[],
  rules: readonly RelationRule[],
  defs: readonly RelationDef[],
  typeOf: (id: string) => string | undefined = () => undefined,
  opts: { depth?: number; cap?: number } = {},
): KgEdge[] {
  const depth = opts.depth ?? KG_CLOSURE_DEPTH
  const cap = opts.cap ?? KG_DERIVED_CAP
  const lattice = buildLattice(defs)
  const sub = (r: string, s: string) => lattice.isSubrelation(r, s)
  const inverse = new Map(defs.map((d) => [d.id, d.inverse]))

  const known = new Set<string>()
  const steps = new Map<string, Fact[]>()
  const addFact = (f: Fact) => {
    const id = edgeId(f)
    if (known.has(id)) return
    known.add(id)
    ;(steps.get(f.s) ?? steps.set(f.s, []).get(f.s)!).push(f)
  }
  for (const e of base) {
    if (e.order === "derived" || e.s === e.o) continue
    addFact(e)
    const inv = inverse.get(e.p)
    if (inv && e.order === "recorded") addFact({ s: e.o, p: inv, o: e.s })
  }
  for (const list of steps.values()) list.sort((a, b) => (a.o < b.o ? -1 : a.o > b.o ? 1 : a.p < b.p ? -1 : a.p > b.p ? 1 : 0))
  const starts = [...steps.keys()].sort()

  const out: KgEdge[] = []
  const emitted = new Set<string>()
  const emit = (s: string, p: string, o: string, proof: string): boolean => {
    if (out.length >= cap) return false
    if (s === o) return true
    const id = edgeId({ s, p, o })
    if (known.has(id) || emitted.has(id)) return true
    const inv = inverse.get(p)
    if (inv && known.has(edgeId({ s: o, p: inv, o: s }))) return true
    emitted.add(id)
    out.push({ s, p, o, graph: "derived", order: "derived", proof })
    return true
  }
  const holds = (a: string, z: string, r: string) => (steps.get(a) ?? []).some((f) => f.o === z && sub(f.p, r))

  // Transitive closure.
  const transitive = defs
    .filter((d) => d.traits?.transitive && !d.archived)
    .map((d) => d.id)
    .sort()
  for (const r of transitive) {
    for (const start of starts) {
      const seen = new Set([start])
      let frontier = [start]
      for (let d = 1; d <= depth && frontier.length; d++) {
        const next: string[] = []
        for (const at of frontier) {
          for (const f of steps.get(at) ?? []) {
            if (!sub(f.p, r) || seen.has(f.o)) continue
            seen.add(f.o)
            if (d >= 2 && !emit(start, r, f.o, `transitive:${r}`)) return out
            next.push(f.o)
          }
        }
        frontier = next
      }
    }
  }

  // Chain rules.
  const active = rules.filter((r) => r.enabled && r.chain.length >= 1 && r.chain.length <= 3)
  active.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  for (const rule of active) {
    const n = rule.chain.length
    const guardOk = (i: number, id: string) => {
      const g = rule.guards?.[i]
      if (!g?.length) return true
      const t = typeOf(id)
      return !!t && g.includes(t)
    }
    let full = false
    const walk = (a: string, at: string, i: number, path: Set<string>) => {
      if (full) return
      if (i === n) {
        if (!guardOk(n, at) || (rule.unless && holds(a, at, rule.unless))) return
        if (!emit(a, rule.head, at, rule.id)) full = true
        return
      }
      for (const f of steps.get(at) ?? []) {
        if (!sub(f.p, rule.chain[i]) || path.has(f.o)) continue
        if (i + 1 < n && !guardOk(i + 1, f.o)) continue
        path.add(f.o)
        walk(a, f.o, i + 1, path)
        path.delete(f.o)
      }
    }
    for (const start of starts) {
      if (!guardOk(0, start)) continue
      walk(start, start, 0, new Set([start]))
      if (full) return out
    }
  }
  return out
}

export interface NeighborOptions {
  direction?: "out" | "in" | "both"
  /** Keep edges with this relation only. */
  relation?: string
  orders?: readonly EdgeOrder[]
}

/** Addresses one edge away, sorted and unique. */
export function neighbors(g: KnowledgeGraph, id: string, opts: NeighborOptions = {}): string[] {
  const dir = opts.direction ?? "both"
  const keep = (e: KgEdge) => (!opts.relation || e.p === opts.relation) && (!opts.orders || opts.orders.includes(e.order))
  const found = new Set<string>()
  if (dir !== "in") for (const e of g.out.get(id) ?? []) if (keep(e)) found.add(e.o)
  if (dir !== "out") for (const e of g.in.get(id) ?? []) if (keep(e)) found.add(e.s)
  found.delete(id)
  return [...found].sort()
}

/** Every edge between two addresses, either direction. */
export function edgesBetween(g: KnowledgeGraph, a: string, b: string): KgEdge[] {
  const there = (g.out.get(a) ?? []).filter((e) => e.o === b)
  const back = a === b ? [] : (g.out.get(b) ?? []).filter((e) => e.o === a)
  return [...there, ...back]
}
