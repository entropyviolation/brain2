/**
 * components/Lists/lib/list-icon-force-links.ts — visual force cords for List Icons
 *
 * Pure geometry + weight→stroke mapping for the Gravity / Field overlay.
 * Does not step physics (that stays in list-icon-gravity / list-icon-pile).
 * Mount via ListIconForceLinksOverlay; see Lists README “Force-link juice”.
 */

import {
  VELVET_ICON_CELL,
  type IconPos,
} from "@/components/Lists/lib/velvet-icon-grid"

/** Icon center in canvas pixels (not velvet top-left). */
export type ForceLinkNode = {
  id: string
  x: number
  y: number
}

/** Undirected weighted cord — same shape as GravityEdge. */
export type ForceLinkEdge = {
  a: string
  b: string
  weight: number
}

export type ForceLinkStroke = {
  key: string
  d: string
  weight: number
  opacity: number
  strokeWidth: number
  heavy: boolean
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Tunable paint map — independent of GRAVITY_SIM so juice can ship alone. */
export const FORCE_LINK_STYLE = {
  /** Weights at or below this are skipped. */
  MIN_WEIGHT: 0.01,
  /** Clamp for opacity / width lerp (matches GRAVITY_WEIGHT.MAX_EDGE spirit). */
  MAX_WEIGHT: 3.5,
  MIN_OPACITY: 0.16,
  MAX_OPACITY: 0.78,
  MIN_WIDTH: 1,
  MAX_WIDTH: 3.6,
  /** Pulse class when weight ≥ this. */
  HEAVY_AT: 1.55,
  /** Quadratic bulge as a fraction of segment length. */
  CURVE_BULGE: 0.14,
  /** Cap cords drawn (hub graphs can explode). */
  MAX_STROKES: 220,
  /**
   * Above this node count, juice skips per-frame DOM center sampling and
   * proximity rebuilds (Gravity still sims; cords use React poses or hide).
   */
  LIVE_DOM_N: 80,
  /** Large-N paint cadence (ms) when cords stay on. */
  LARGE_PAINT_MS: 96,
} as const

export const FORCE_LINK_PROXIMITY = {
  /** Soft pile “near contact” cord distance (centers, px). */
  MAX_DIST: 130,
  /** Cap edges per node so dense heaps stay readable. */
  MAX_PER_NODE: 3,
  /** Uniform weight for proximity cords. */
  WEIGHT: 0.55,
  /** Cap nodes considered for proximity (large piles already compact). */
  MAX_NODES: 80,
} as const

function clamp01(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t
}

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Map connection weight → stroke opacity. */
export function forceLinkOpacity(weight: number): number {
  if (!Number.isFinite(weight) || weight < FORCE_LINK_STYLE.MIN_WEIGHT) return 0
  const t = clamp01(weight / FORCE_LINK_STYLE.MAX_WEIGHT)
  return (
    FORCE_LINK_STYLE.MIN_OPACITY +
    (FORCE_LINK_STYLE.MAX_OPACITY - FORCE_LINK_STYLE.MIN_OPACITY) * t
  )
}

/** Map connection weight → SVG stroke width (px). */
export function forceLinkStrokeWidth(weight: number): number {
  if (!Number.isFinite(weight) || weight < FORCE_LINK_STYLE.MIN_WEIGHT) return 0
  const t = clamp01(weight / FORCE_LINK_STYLE.MAX_WEIGHT)
  return (
    FORCE_LINK_STYLE.MIN_WIDTH +
    (FORCE_LINK_STYLE.MAX_WIDTH - FORCE_LINK_STYLE.MIN_WIDTH) * Math.sqrt(t)
  )
}

export function forceLinkIsHeavy(weight: number): boolean {
  return Number.isFinite(weight) && weight >= FORCE_LINK_STYLE.HEAVY_AT
}

/**
 * SVG path between two centers. Curved: gentle quadratic bulge perpendicular
 * to the chord (stable for a given a→b order so the cord does not flicker).
 */
export function forceLinkPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curved = true,
): string {
  if (!curved) return `M ${x1} ${y1} L ${x2} ${y2}`
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 0.001
  // Perpendicular unit; sign from undirected order is applied by caller via node order.
  const nx = -dy / len
  const ny = dx / len
  const bulge = len * FORCE_LINK_STYLE.CURVE_BULGE
  const cx = (x1 + x2) / 2 + nx * bulge
  const cy = (y1 + y2) / 2 + ny * bulge
  return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
}

/** Midpoint control hint (for tests / debug dots). */
export function forceLinkControlPoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): { x: number; y: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 0.001
  const nx = -dy / len
  const ny = dx / len
  const bulge = len * FORCE_LINK_STYLE.CURVE_BULGE
  return {
    x: (x1 + x2) / 2 + nx * bulge,
    y: (y1 + y2) / 2 + ny * bulge,
  }
}

export function iconPosToForceNode(id: string, pos: IconPos): ForceLinkNode {
  return {
    id,
    x: pos.x + VELVET_ICON_CELL.w / 2,
    y: pos.y + VELVET_ICON_CELL.h / 2,
  }
}

/** Velvet top-left map → center nodes (Gravity / React paint path). */
export function nodesFromIconPositions(
  positions: Record<string, IconPos>,
  ids?: readonly string[],
): ForceLinkNode[] {
  const keys = ids ?? Object.keys(positions)
  const out: ForceLinkNode[] = []
  for (const id of keys) {
    const pos = positions[id]
    if (!pos) continue
    out.push(iconPosToForceNode(id, pos))
  }
  return out
}

/** Bodies / live centers already in center space (GravityBody, pile gems). */
export function nodesFromCenters(
  bodies: ReadonlyArray<{ id: string; x: number; y: number }>,
): ForceLinkNode[] {
  return bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }))
}

export function normalizeForceLinkEdges(
  edges: ReadonlyArray<{ a: string; b: string; weight: number }>,
): ForceLinkEdge[] {
  const seen = new Set<string>()
  const out: ForceLinkEdge[] = []
  for (const edge of edges) {
    if (!edge.a || !edge.b || edge.a === edge.b) continue
    if (!Number.isFinite(edge.weight) || edge.weight < FORCE_LINK_STYLE.MIN_WEIGHT) continue
    const key = undirectedKey(edge.a, edge.b)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      a: edge.a < edge.b ? edge.a : edge.b,
      b: edge.a < edge.b ? edge.b : edge.a,
      weight: Math.min(FORCE_LINK_STYLE.MAX_WEIGHT, edge.weight),
    })
  }
  return out
}

/**
 * Nearest-neighbor cords for PILE UP (no ItemLink graph). Weight falls with
 * distance so close contacts read thicker.
 */
export function buildProximityEdges(
  nodes: readonly ForceLinkNode[],
  opts?: { maxDist?: number; maxPerNode?: number },
): ForceLinkEdge[] {
  const maxDist = opts?.maxDist ?? FORCE_LINK_PROXIMITY.MAX_DIST
  const maxPerNode = opts?.maxPerNode ?? FORCE_LINK_PROXIMITY.MAX_PER_NODE
  const counts = new Map<string, number>()
  const seen = new Set<string>()
  const candidates: Array<{ a: string; b: string; dist: number }> = []

  for (let i = 0; i < nodes.length; i++) {
    const A = nodes[i]!
    for (let j = i + 1; j < nodes.length; j++) {
      const B = nodes[j]!
      const dist = Math.hypot(B.x - A.x, B.y - A.y)
      if (dist <= 0 || dist > maxDist) continue
      candidates.push({ a: A.id, b: B.id, dist })
    }
  }
  candidates.sort((p, q) => p.dist - q.dist)

  const edges: ForceLinkEdge[] = []
  for (const c of candidates) {
    const ca = counts.get(c.a) ?? 0
    const cb = counts.get(c.b) ?? 0
    if (ca >= maxPerNode || cb >= maxPerNode) continue
    const key = undirectedKey(c.a, c.b)
    if (seen.has(key)) continue
    seen.add(key)
    counts.set(c.a, ca + 1)
    counts.set(c.b, cb + 1)
    const t = 1 - c.dist / maxDist
    const weight = FORCE_LINK_PROXIMITY.WEIGHT * (0.45 + 0.55 * t)
    edges.push({ a: c.a < c.b ? c.a : c.b, b: c.a < c.b ? c.b : c.a, weight })
  }
  return edges
}

/**
 * Build paint strokes from nodes + edges. Missing endpoints are skipped.
 * Heavier edges sort later (drawn on top).
 */
export function buildForceLinkStrokes(
  nodes: readonly ForceLinkNode[],
  edges: readonly ForceLinkEdge[],
  opts?: { curved?: boolean; maxStrokes?: number },
): ForceLinkStroke[] {
  const curved = opts?.curved !== false
  const maxStrokes = opts?.maxStrokes ?? FORCE_LINK_STYLE.MAX_STROKES
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const strokes: ForceLinkStroke[] = []

  for (const edge of normalizeForceLinkEdges(edges)) {
    const A = byId.get(edge.a)
    const B = byId.get(edge.b)
    if (!A || !B) continue
    const opacity = forceLinkOpacity(edge.weight)
    const strokeWidth = forceLinkStrokeWidth(edge.weight)
    if (opacity <= 0 || strokeWidth <= 0) continue
    strokes.push({
      key: undirectedKey(edge.a, edge.b),
      d: forceLinkPath(A.x, A.y, B.x, B.y, curved),
      weight: edge.weight,
      opacity,
      strokeWidth,
      heavy: forceLinkIsHeavy(edge.weight),
      x1: A.x,
      y1: A.y,
      x2: B.x,
      y2: B.y,
    })
  }

  strokes.sort((a, b) => a.weight - b.weight)
  if (strokes.length > maxStrokes) {
    // Keep the heaviest cords when over budget.
    return strokes.slice(strokes.length - maxStrokes)
  }
  return strokes
}

/**
 * Read live icon centers from the desktop canvas (PILE UP paints DOM-only).
 * Uses offsetLeft/Top + translate3d when present.
 */
export function readIconCentersFromCanvas(root: HTMLElement | null): ForceLinkNode[] {
  if (!root) return []
  const nodes: ForceLinkNode[] = []
  const entries = root.querySelectorAll<HTMLElement>("[data-icon-entry][data-id]")
  for (const el of entries) {
    const id = el.getAttribute("data-id")
    if (!id) continue
    let x = el.offsetLeft
    let y = el.offsetTop
    const transform = el.style.transform
    if (transform && transform.includes("translate")) {
      const m = /translate3d\(\s*([-.\d]+)px\s*,\s*([-.\d]+)px/.exec(transform)
      if (m) {
        x += Number(m[1]) || 0
        y += Number(m[2]) || 0
      } else {
        const m2 = /translate\(\s*([-.\d]+)px\s*,\s*([-.\d]+)px/.exec(transform)
        if (m2) {
          x += Number(m2[1]) || 0
          y += Number(m2[2]) || 0
        }
      }
    }
    nodes.push({
      id,
      x: x + VELVET_ICON_CELL.w / 2,
      y: y + VELVET_ICON_CELL.h / 2,
    })
  }
  return nodes
}

export function prefersForceLinksReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}
