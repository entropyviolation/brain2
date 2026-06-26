/**
 * lib/link-graph.ts — Pure relationship graph builder
 *
 * Turns a flat list of items (with typed `links`) into a node/edge graph for
 * relationship visualization (spec §5 — second-brain navigation). Edges are
 * derived from each item's outgoing `links`; because relations are typed and
 * have inverses (see lib/links.ts), traversal naturally follows both forward
 * links and backlinks.
 *
 * Everything here is pure and deterministic: same input → same output, no store
 * access, no Date.now(), no randomness. The UI layer (components/Graph/*) reads
 * data from the repository and feeds it in.
 */
import type { Item } from "@/lib/types"
import { relationLabel } from "@/lib/links"

/** A graph vertex — one item. */
export interface GraphNode {
  id: string
  /** Display label, derived from the item's title/description. */
  label: string
}

/** A directed graph edge — one typed link from `source` → `target`. */
export interface GraphEdge {
  source: string
  target: string
  /** Raw relation id (e.g. "blocks"). */
  relation: string
  /** Human label for the relation (via `relationLabel`). */
  label: string
}

/** The built graph. */
export interface LinkGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Options for {@link buildLinkGraph}. */
export interface BuildLinkGraphOptions {
  /**
   * When set, only the subgraph within `depth` hops of this item is returned.
   * Neighbors are discovered via BOTH forward links and backlinks. When unset,
   * the whole graph is built.
   */
  focusId?: string
  /** Hop radius around `focusId` (default 1). Ignored when `focusId` is unset. */
  depth?: number
}

/** Best label for an item: explicit title, else task description, else its id. */
function labelFor(item: Item & { description?: string }): string {
  const title = (item.title ?? item.description ?? "").trim()
  return title.length > 0 ? title : item.id
}

/**
 * Build a node/edge graph from `items`.
 *
 * Without options the full graph is returned: a node per item and a deduplicated
 * edge per outgoing link whose target also exists in `items`.
 *
 * With `opts.focusId` only the subgraph reachable within `opts.depth` hops
 * (default 1) of the focus is returned. Adjacency is undirected for traversal
 * purposes (a forward link and its implied backlink both count as one hop), but
 * the returned edges keep their original direction. Self-links and links to
 * unknown items are skipped. Output ordering is stable (input order).
 */
export function buildLinkGraph(items: Item[], opts: BuildLinkGraphOptions = {}): LinkGraph {
  const byId = new Map<string, Item>()
  for (const item of items) {
    if (item && typeof item.id === "string") byId.set(item.id, item)
  }

  // Collect every valid directed link (both endpoints exist, no self-links).
  interface RawEdge {
    source: string
    target: string
    relation: string
  }
  const rawEdges: RawEdge[] = []
  for (const item of items) {
    if (!item || typeof item.id !== "string") continue
    for (const link of item.links ?? []) {
      if (!link || typeof link.targetId !== "string" || !link.relation) continue
      if (link.targetId === item.id) continue // self-link
      if (!byId.has(link.targetId)) continue // dangling target
      rawEdges.push({ source: item.id, target: link.targetId, relation: link.relation })
    }
  }

  // Determine which node ids to keep.
  let keep: Set<string> | null = null
  if (opts.focusId !== undefined) {
    if (!byId.has(opts.focusId)) {
      return { nodes: [], edges: [] }
    }
    // Undirected adjacency for BFS (forward + backlink count as one hop).
    const adjacency = new Map<string, Set<string>>()
    const connect = (a: string, b: string) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set())
      adjacency.get(a)!.add(b)
    }
    for (const e of rawEdges) {
      connect(e.source, e.target)
      connect(e.target, e.source)
    }

    const depth = Math.max(0, opts.depth ?? 1)
    keep = new Set<string>([opts.focusId])
    let frontier: string[] = [opts.focusId]
    for (let hop = 0; hop < depth; hop++) {
      const next: string[] = []
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (!keep.has(neighbor)) {
            keep.add(neighbor)
            next.push(neighbor)
          }
        }
      }
      if (next.length === 0) break
      frontier = next
    }
  }

  const inScope = (id: string) => keep === null || keep.has(id)

  const nodes: GraphNode[] = []
  for (const item of items) {
    if (!item || typeof item.id !== "string") continue
    if (!inScope(item.id)) continue
    nodes.push({ id: item.id, label: labelFor(item) })
  }

  const seen = new Set<string>()
  const edges: GraphEdge[] = []
  for (const e of rawEdges) {
    if (!inScope(e.source) || !inScope(e.target)) continue
    const key = `${e.source}\u0000${e.relation}\u0000${e.target}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({
      source: e.source,
      target: e.target,
      relation: e.relation,
      label: relationLabel(e.relation),
    })
  }

  return { nodes, edges }
}
