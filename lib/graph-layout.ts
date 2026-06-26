/**
 * lib/graph-layout.ts — Pure graph/timeline layout helpers
 *
 * Deterministic, dependency-free geometry used by the project-visualization
 * views (Gantt, dependency graph, knowledge graph). Everything here is pure:
 * given the same nodes/edges it always returns the same coordinates, so the
 * layouts are unit-testable and SSR-safe.
 *
 * Two families:
 *   - Layered (Sugiyama-lite): topological "rank" → x column, ordinal within a
 *     rank → y row. Powers Gantt row ordering and the dependency-graph columns.
 *   - Radial/circular + deterministic force-ish spread: places nodes around a
 *     circle (or a seeded grid) for the relation/knowledge graph where there is
 *     no inherent left→right precedence.
 */

export interface LayoutEdge {
  source: string
  target: string
}

export interface Point {
  x: number
  y: number
}

export type Positions = Record<string, Point>

/**
 * Assign each node a topological "rank" (longest predecessor chain). Roots get
 * rank 0; a node's rank is `max(rank(pred)) + 1`. Cycles are tolerated: nodes
 * that cannot be ranked (back-edges) keep rank 0 so the function never loops.
 * Returns ranks plus the layers grouped + ordered for layout.
 */
export function topologicalRanks(
  ids: string[],
  edges: LayoutEdge[],
): { rank: Record<string, number>; layers: string[][] } {
  const idSet = new Set(ids)
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  ids.forEach((id) => {
    preds.set(id, [])
    succs.set(id, [])
  })
  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target) || e.source === e.target) continue
    preds.get(e.target)!.push(e.source)
    succs.get(e.source)!.push(e.target)
  }

  // Kahn ordering; longest-path rank via relaxation in topo order.
  const indeg = new Map<string, number>()
  ids.forEach((id) => indeg.set(id, preds.get(id)!.length))
  const queue = ids.filter((id) => indeg.get(id) === 0)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const s of succs.get(id)!) {
      indeg.set(s, indeg.get(s)! - 1)
      if (indeg.get(s) === 0) queue.push(s)
    }
  }
  // Any nodes left out are in a cycle; append so they still get a rank.
  const seen = new Set(order)
  for (const id of ids) if (!seen.has(id)) order.push(id)

  const rank: Record<string, number> = {}
  ids.forEach((id) => (rank[id] = 0))
  for (const id of order) {
    const ps = preds.get(id)!
    rank[id] = ps.length ? Math.max(...ps.map((p) => rank[p] + 1)) : 0
  }

  const maxRank = ids.reduce((m, id) => Math.max(m, rank[id]), 0)
  const layers: string[][] = Array.from({ length: maxRank + 1 }, () => [])
  // Preserve input order within each layer for deterministic rows.
  for (const id of ids) layers[rank[id]].push(id)

  return { rank, layers }
}

export interface LayeredLayoutOptions {
  /** Horizontal distance between ranks (columns). */
  columnGap?: number
  /** Vertical distance between rows within a rank. */
  rowGap?: number
  /** Top-left origin. */
  originX?: number
  originY?: number
}

/**
 * Layered left→right layout: x by topological rank, y by position within the
 * rank. Good for dependency graphs and as the row order for a Gantt chart.
 */
export function layeredLayout(ids: string[], edges: LayoutEdge[], opts: LayeredLayoutOptions = {}): Positions {
  const { columnGap = 220, rowGap = 90, originX = 40, originY = 40 } = opts
  const { rank, layers } = topologicalRanks(ids, edges)
  const positions: Positions = {}
  for (const id of ids) {
    const layer = layers[rank[id]]
    const rowIndex = layer.indexOf(id)
    positions[id] = {
      x: originX + rank[id] * columnGap,
      y: originY + rowIndex * rowGap,
    }
  }
  return positions
}

export interface CircularLayoutOptions {
  radius?: number
  centerX?: number
  centerY?: number
  /** Angle (radians) of the first node. Default -π/2 (12 o'clock). */
  startAngle?: number
}

/**
 * Evenly space nodes around a circle. Deterministic and order-stable; ideal for
 * a small relation graph. A single node sits at the center.
 */
export function circularLayout(ids: string[], opts: CircularLayoutOptions = {}): Positions {
  const { radius = 200, centerX = 0, centerY = 0, startAngle = -Math.PI / 2 } = opts
  const positions: Positions = {}
  const n = ids.length
  if (n === 0) return positions
  if (n === 1) {
    positions[ids[0]] = { x: centerX, y: centerY }
    return positions
  }
  ids.forEach((id, i) => {
    const angle = startAngle + (2 * Math.PI * i) / n
    positions[id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    }
  })
  return positions
}

/** Deterministic pseudo-random in [0, 1) seeded by a string (mulberry-ish hash). */
function seededUnit(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // Map to [0,1): use the high bits for better spread.
  return ((h >>> 0) % 100000) / 100000
}

export interface ForceishLayoutOptions {
  width?: number
  height?: number
  /** Number of relaxation passes. Deterministic; more passes = more spreading. */
  iterations?: number
  /** Seed appended to ids so multiple graphs can differ deterministically. */
  seed?: string
}

/**
 * A deterministic "force-ish" spatial layout. Seeds nodes on a circle (so the
 * result is reproducible and never depends on `Math.random`), then runs a fixed
 * number of repulsion + edge-attraction relaxation passes. Returns positions
 * centered roughly in a `width × height` box. Pure and SSR-safe.
 */
export function forceishLayout(ids: string[], edges: LayoutEdge[], opts: ForceishLayoutOptions = {}): Positions {
  const { width = 800, height = 600, iterations = 120, seed = "" } = opts
  const n = ids.length
  const positions: Positions = {}
  if (n === 0) return positions

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.42

  // Deterministic seeding: circle base + a tiny seeded jitter to break symmetry.
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n
    const jitter = (seededUnit(seed + id) - 0.5) * radius * 0.25
    positions[id] = {
      x: cx + (radius + jitter) * Math.cos(angle),
      y: cy + (radius + jitter) * Math.sin(angle),
    }
  })
  if (n === 1) {
    positions[ids[0]] = { x: cx, y: cy }
    return positions
  }

  const idSet = new Set(ids)
  const links = edges.filter((e) => idSet.has(e.source) && idSet.has(e.target) && e.source !== e.target)

  const k = Math.sqrt((width * height) / n) // ideal separation
  const repulsion = k * k
  const idealLink = k
  const cooling = 0.95
  let temp = k

  for (let iter = 0; iter < iterations; iter++) {
    const disp: Record<string, Point> = {}
    ids.forEach((id) => (disp[id] = { x: 0, y: 0 }))

    // Repulsion between every pair.
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const ia = ids[a]
        const ib = ids[b]
        let dx = positions[ia].x - positions[ib].x
        let dy = positions[ia].y - positions[ib].y
        let dist = Math.hypot(dx, dy)
        if (dist < 0.01) {
          // Deterministic nudge if coincident.
          dx = (seededUnit(ia + ib) - 0.5) || 0.01
          dy = (seededUnit(ib + ia) - 0.5) || 0.01
          dist = Math.hypot(dx, dy)
        }
        const force = repulsion / dist
        const ux = dx / dist
        const uy = dy / dist
        disp[ia].x += ux * force
        disp[ia].y += uy * force
        disp[ib].x -= ux * force
        disp[ib].y -= uy * force
      }
    }

    // Attraction along edges.
    for (const e of links) {
      const dx = positions[e.source].x - positions[e.target].x
      const dy = positions[e.source].y - positions[e.target].y
      const dist = Math.hypot(dx, dy) || 0.01
      const force = (dist * dist) / idealLink
      const ux = dx / dist
      const uy = dy / dist
      disp[e.source].x -= ux * force
      disp[e.source].y -= uy * force
      disp[e.target].x += ux * force
      disp[e.target].y += uy * force
    }

    // Apply displacement, capped by the cooling temperature; keep in-bounds.
    for (const id of ids) {
      const d = disp[id]
      const dist = Math.hypot(d.x, d.y) || 0.01
      const limited = Math.min(dist, temp)
      positions[id].x += (d.x / dist) * limited
      positions[id].y += (d.y / dist) * limited
      positions[id].x = Math.max(20, Math.min(width - 20, positions[id].x))
      positions[id].y = Math.max(20, Math.min(height - 20, positions[id].y))
    }
    temp *= cooling
  }

  return positions
}

/** Axis-aligned bounding box of a set of positions (with optional padding). */
export function boundingBox(positions: Positions, padding = 0): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
  const pts = Object.values(positions)
  if (pts.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}
