/**
 * lib/link-constellation-layout.ts — Where each linked orb sits
 *
 * The open item is the center. Each relation family gets an angular sector,
 * sized by how many edges it holds, in a fixed family order so the picture
 * is the same every time it opens. Orbs spread evenly inside their sector on
 * one ring; a crowded sector steps every other orb onto an outer ring.
 * Second-ring orbs sit just past the neighbor they hang from. Pure.
 */
export const FAMILY_ORDER = ["family", "romance", "friend", "group", "place", "work", "task", "evidence", "other"] as const

export interface LayoutEdge {
  key: string
  otherId: string
  family: string
}

export interface LayoutNode {
  id: string
  key: string
  x: number
  y: number
  angle: number
  ring: 1 | 2
  family: string
}

export interface SectorArc {
  family: string
  start: number
  end: number
}

export interface ConstellationLayout {
  cx: number
  cy: number
  radius: number
  nodes: LayoutNode[]
  sectors: SectorArc[]
}

const TAU = Math.PI * 2
/** Start at the top, go clockwise. */
const START = -Math.PI / 2
const CROWDED = 10

function familyRank(family: string): number {
  const i = (FAMILY_ORDER as readonly string[]).indexOf(family)
  return i === -1 ? FAMILY_ORDER.length : i
}

export function layoutConstellation(edges: readonly LayoutEdge[], width: number, height: number): ConstellationLayout {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.36
  const groups = new Map<string, LayoutEdge[]>()
  for (const edge of edges) {
    const bucket = groups.get(edge.family)
    if (bucket) bucket.push(edge)
    else groups.set(edge.family, [edge])
  }
  const families = [...groups.keys()].sort((a, b) => familyRank(a) - familyRank(b) || a.localeCompare(b))
  const total = edges.length
  const nodes: LayoutNode[] = []
  const sectors: SectorArc[] = []
  let cursor = START
  for (const family of families) {
    const members = [...groups.get(family)!].sort((a, b) => a.key.localeCompare(b.key))
    const span = total === 0 ? 0 : (members.length / total) * TAU
    sectors.push({ family, start: cursor, end: cursor + span })
    const crowded = members.length > CROWDED
    members.forEach((edge, i) => {
      const angle = cursor + span * ((i + 0.5) / members.length)
      const outer = crowded && i % 2 === 1
      const r = outer ? radius * 1.28 : radius
      nodes.push({
        id: edge.otherId,
        key: edge.key,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle,
        ring: 1,
        family,
      })
    })
    cursor += span
  }
  return { cx, cy, radius, nodes, sectors }
}

/** Second-ring orbs placed outside their neighbor, fanned a little when several hang from one. */
export function layoutSecondRing(
  layout: ConstellationLayout,
  rows: readonly { from: string; to: string }[],
): { id: string; from: string; x: number; y: number }[] {
  const at = new Map(layout.nodes.map((n) => [n.id, n]))
  const count = new Map<string, number>()
  const out: { id: string; from: string; x: number; y: number }[] = []
  for (const row of rows) {
    const parent = at.get(row.from)
    if (!parent) continue
    const n = count.get(row.from) ?? 0
    count.set(row.from, n + 1)
    const fan = (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 0.22
    const angle = parent.angle + fan
    const r = layout.radius * 1.62
    out.push({ id: row.to, from: row.from, x: layout.cx + Math.cos(angle) * r, y: layout.cy + Math.sin(angle) * r })
  }
  return out
}
