/**
 * lib/graph/atlas-layout.ts — Where each node sits on the whole-vault atlas
 * (KG-V, `components/Analytics/atlas/GraphAtlas.tsx`).
 *
 * Pure and deterministic. Same ids, edges, and options give the same points.
 * Three steps:
 * 1. Cap by degree. The `cap` highest-degree nodes are kept (ties by id).
 *    `keep` ids always stay. The caller prints "showing N of M".
 * 2. Without communities: one `forceishLayout` (`lib/graph-layout.ts`) over
 *    the kept nodes, seeded, fixed iterations.
 * 3. With a community map: one cell per community, packed in rows, largest
 *    first. Each cell runs its own `forceishLayout` over its members and the
 *    edges inside it. A node with no community joins the cell `·`.
 *
 * Pairwise repulsion is O(n²) per pass, so passes drop as n grows. Under
 * about 2k nodes that stays fast enough; Barnes-Hut is not needed.
 */
import { forceishLayout } from "@/lib/graph-layout"

export interface AtlasEdgeEnds {
  s: string
  o: string
}

export interface AtlasPoint {
  id: string
  x: number
  y: number
  /** Degree in the edges passed in, both directions, self-loops left out. */
  degree: number
  /** Community key when a map was passed (`·` for a node outside it). */
  community?: string
}

export interface AtlasLayout {
  points: AtlasPoint[]
  at: Map<string, AtlasPoint>
  /** Nodes placed. */
  shown: number
  /** Nodes passed in. */
  total: number
  width: number
  height: number
  /** Community keys, largest first. Empty without a map. */
  communityOrder: string[]
}

export interface AtlasLayoutOptions {
  /** Most nodes to place. Default 300. */
  cap?: number
  /** Ids kept even below the cap (a focused node). */
  keep?: readonly string[]
  /** Node id → community key. */
  communities?: ReadonlyMap<string, string | number>
  seed?: string
  /** Fixed passes. Default falls with n (120 → 60 → 30). */
  iterations?: number
}

export const ATLAS_DEFAULT_CAP = 300
/** Space per node, in viewBox units. */
const SPACING = 64
const MIN_SIDE = 160
const CELL_GAP = 40
/** Community for a node the map does not name. */
export const NO_COMMUNITY = "·"

/** Undirected degree per id. Edges to ids outside `ids` and self-loops are left out. */
export function degreeOf(ids: readonly string[], edges: readonly AtlasEdgeEnds[]): Map<string, number> {
  const degree = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const e of edges) {
    if (e.s === e.o || !degree.has(e.s) || !degree.has(e.o)) continue
    degree.set(e.s, degree.get(e.s)! + 1)
    degree.set(e.o, degree.get(e.o)! + 1)
  }
  return degree
}

/** The `cap` highest-degree ids (ties by id), plus every `keep` id that exists. Returned in id order. */
export function capByDegree(
  ids: readonly string[],
  degree: ReadonlyMap<string, number>,
  cap: number,
  keep: readonly string[] = [],
): string[] {
  const unique = [...new Set(ids)]
  const ranked = unique.sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0))
  const kept = new Set(ranked.slice(0, Math.max(0, cap)))
  const exists = new Set(unique)
  for (const id of keep) if (exists.has(id)) kept.add(id)
  return [...kept].sort()
}

function passesFor(n: number): number {
  if (n <= 300) return 120
  if (n <= 700) return 60
  return 30
}

function sideFor(n: number): number {
  return Math.max(MIN_SIDE, Math.ceil(Math.sqrt(n) * SPACING))
}

function placeCell(
  ids: string[],
  edges: { source: string; target: string }[],
  seed: string,
  iterations: number | undefined,
): { pos: Record<string, { x: number; y: number }>; side: number } {
  const side = sideFor(ids.length)
  const pos = forceishLayout(ids, edges, { width: side, height: side, seed, iterations: iterations ?? passesFor(ids.length) })
  return { pos, side }
}

export function atlasLayout(
  ids: readonly string[],
  edges: readonly AtlasEdgeEnds[],
  opts: AtlasLayoutOptions = {},
): AtlasLayout {
  const cap = opts.cap ?? ATLAS_DEFAULT_CAP
  const seed = opts.seed ?? "atlas"
  const allDegree = degreeOf(ids, edges)
  const visible = capByDegree(ids, allDegree, cap, opts.keep)
  const total = new Set(ids).size
  const visibleSet = new Set(visible)
  const links = edges
    .filter((e) => e.s !== e.o && visibleSet.has(e.s) && visibleSet.has(e.o))
    .map((e) => ({ source: e.s, target: e.o }))
  const degree = degreeOf(visible, edges)

  const communityOf = (id: string): string | undefined => {
    if (!opts.communities) return undefined
    const c = opts.communities.get(id)
    return c === undefined ? NO_COMMUNITY : String(c)
  }

  if (!opts.communities) {
    const { pos, side } = placeCell(visible, links, seed, opts.iterations)
    const points = visible.map((id) => ({ id, x: pos[id].x, y: pos[id].y, degree: degree.get(id) ?? 0 }))
    return { points, at: new Map(points.map((p) => [p.id, p])), shown: points.length, total, width: side, height: side, communityOrder: [] }
  }

  const groups = new Map<string, string[]>()
  for (const id of visible) {
    const c = communityOf(id)!
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(id)
  }
  const order = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || (a < b ? -1 : a > b ? 1 : 0))
  const cells = order.map((key) => {
    const members = groups.get(key)!
    const inside = new Set(members)
    const cellLinks = links.filter((l) => inside.has(l.source) && inside.has(l.target))
    return { key, members, ...placeCell(members, cellLinks, `${seed}:${key}`, opts.iterations) }
  })

  // Shelf packing: rows no wider than the square root of the summed areas.
  const area = cells.reduce((sum, c) => sum + (c.side + CELL_GAP) ** 2, 0)
  const rowMax = Math.max(cells[0]?.side ?? MIN_SIDE, Math.sqrt(area))
  let x = 0
  let y = 0
  let rowH = 0
  let width = 0
  const points: AtlasPoint[] = []
  for (const cell of cells) {
    if (x > 0 && x + cell.side > rowMax) {
      x = 0
      y += rowH + CELL_GAP
      rowH = 0
    }
    for (const id of cell.members) {
      points.push({ id, x: x + cell.pos[id].x, y: y + cell.pos[id].y, degree: degree.get(id) ?? 0, community: cell.key })
    }
    x += cell.side + CELL_GAP
    width = Math.max(width, x - CELL_GAP)
    rowH = Math.max(rowH, cell.side)
  }
  points.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    points,
    at: new Map(points.map((p) => [p.id, p])),
    shown: points.length,
    total,
    width: Math.max(width, MIN_SIDE),
    height: Math.max(y + rowH, MIN_SIDE),
    communityOrder: order,
  }
}

/**
 * Hop distance from `focus` over undirected edges, up to `maxHops`.
 * The focus is 0. Ids farther away are absent.
 */
export function hopsFrom(focus: string, edges: readonly AtlasEdgeEnds[], maxHops: number): Map<string, number> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (e.s === e.o) continue
    if (!adj.has(e.s)) adj.set(e.s, [])
    if (!adj.has(e.o)) adj.set(e.o, [])
    adj.get(e.s)!.push(e.o)
    adj.get(e.o)!.push(e.s)
  }
  const hops = new Map<string, number>([[focus, 0]])
  let frontier = [focus]
  for (let h = 1; h <= maxHops && frontier.length; h++) {
    const next: string[] = []
    for (const id of frontier) {
      for (const n of adj.get(id) ?? []) {
        if (hops.has(n)) continue
        hops.set(n, h)
        next.push(n)
      }
    }
    frontier = next
  }
  return hops
}
