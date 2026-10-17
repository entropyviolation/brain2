/**
 * lib/link-constellation-layout.ts — Where each linked item sits on the
 * radial plate (PD 6.4; UI copy says "radial plate", the file name stays).
 *
 * Pure and deterministic. The center item sits at (W/2, H/2). Families get
 * angular sectors sized by edge count, in the fixed `FAMILY_ORDER`, so the
 * picture is the same between opens. Inside a sector, edges are sorted by
 * relation then other id and spread evenly on ring 1 (r = 38% of min(W, H)).
 * A sector with more than `CROWD` edges alternates a second, inner radius.
 * Ring 2 (second-degree items, `secondRing` in `lib/link-graph.ts`) sits
 * just outside ring 1, fanned around the ring-1 item that reaches it.
 *
 * `springHome` is the one physics step the plate needs: each body is pulled
 * to its slot and damped. The stir and fling come from
 * `components/Lists/lib/list-icon-gravity.ts`.
 */
import type { EgoEdge } from "@/lib/link-graph"
import type { RelationFamily } from "@/lib/links"

export const FAMILY_ORDER: RelationFamily[] = [
  "family",
  "friend",
  "romance",
  "work",
  "group",
  "place",
  "task",
  "evidence",
  "other",
]

/** More than this in one sector → alternate an inner radius. */
export const CROWD = 10
/** Ring 1 radius as a share of min(W, H). */
export const RING1 = 0.38
const INNER = 0.27
const RING2 = 0.47
/** Empty arc between neighboring sectors (radians), when there are two or more. */
const SECTOR_GAP = 0.12

export interface PlateNode {
  key: string
  otherId: string
  x: number
  y: number
  angle: number
  r: number
  ring: 1 | 2
  family: RelationFamily
  /** Ring 2 only: the ring-1 item it hangs from. */
  from?: string
}

export interface PlateSector {
  family: RelationFamily
  start: number
  end: number
  count: number
}

export interface PlateLayout {
  center: { x: number; y: number }
  nodes: PlateNode[]
  sectors: PlateSector[]
}

function familyRank(family: RelationFamily): number {
  const i = FAMILY_ORDER.indexOf(family)
  return i === -1 ? FAMILY_ORDER.length : i
}

function byRelationThenId(a: EgoEdge, b: EgoEdge): number {
  if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1
  if (a.otherId !== b.otherId) return a.otherId < b.otherId ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

/**
 * Lay out ring 1 (and ring 2 when given). Angles start at the top (-π/2)
 * and run clockwise.
 */
export function layoutPlate(
  edges: readonly EgoEdge[],
  size: { width: number; height: number },
  ring2: readonly { from: string; edge: EgoEdge }[] = [],
): PlateLayout {
  const cx = size.width / 2
  const cy = size.height / 2
  const base = Math.min(size.width, size.height)
  const groups = new Map<RelationFamily, EgoEdge[]>()
  for (const edge of edges) {
    const list = groups.get(edge.family) ?? []
    list.push(edge)
    groups.set(edge.family, list)
  }
  const families = [...groups.keys()].sort((a, b) => familyRank(a) - familyRank(b))
  const total = edges.length
  const gap = families.length > 1 ? SECTOR_GAP : 0
  const usable = Math.PI * 2 - gap * families.length
  const sectors: PlateSector[] = []
  const nodes: PlateNode[] = []
  let cursor = -Math.PI / 2
  for (const family of families) {
    const list = [...(groups.get(family) ?? [])].sort(byRelationThenId)
    const span = total > 0 ? (usable * list.length) / total : 0
    const start = cursor
    const end = cursor + span
    sectors.push({ family, start, end, count: list.length })
    const crowded = list.length > CROWD
    list.forEach((edge, i) => {
      const angle = start + ((i + 0.5) * span) / list.length
      const r = base * (crowded && i % 2 === 1 ? INNER : RING1)
      nodes.push({
        key: edge.key,
        otherId: edge.otherId,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        angle,
        r,
        ring: 1,
        family,
      })
    })
    cursor = end + gap
  }

  const parentAngle = new Map(nodes.map((n) => [n.otherId, n.angle]))
  const fan = new Map<string, number>()
  for (const { from, edge } of ring2) {
    const anchor = parentAngle.get(from)
    if (anchor === undefined) continue
    const k = fan.get(from) ?? 0
    fan.set(from, k + 1)
    // 0, +1, -1, +2, -2 … small steps around the parent's angle.
    const step = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2)
    const angle = anchor + step * 0.09
    const r = base * RING2
    nodes.push({
      key: `ring2|${from}|${edge.otherId}`,
      otherId: edge.otherId,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
      r,
      ring: 2,
      family: edge.family,
      from,
    })
  }

  return { center: { x: cx, y: cy }, nodes, sectors }
}

export interface HomeBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  held?: boolean
}

const HOME_K = 42
const HOME_DAMP = 7.5

/** One damped spring step toward each body's slot. Held bodies stay put. */
export function springHome(
  bodies: readonly HomeBody[],
  slots: ReadonlyMap<string, { x: number; y: number }>,
  dt: number,
): HomeBody[] {
  return bodies.map((b) => {
    const slot = slots.get(b.id)
    if (!slot || b.held) return b
    const ax = HOME_K * (slot.x - b.x) - HOME_DAMP * b.vx
    const ay = HOME_K * (slot.y - b.y) - HOME_DAMP * b.vy
    const vx = b.vx + ax * dt
    const vy = b.vy + ay * dt
    return { ...b, vx, vy, x: b.x + vx * dt, y: b.y + vy * dt }
  })
}

/** True when every body is within half a pixel of its slot and nearly still. */
export function bodiesHome(bodies: readonly HomeBody[], slots: ReadonlyMap<string, { x: number; y: number }>): boolean {
  return bodies.every((b) => {
    const slot = slots.get(b.id)
    if (!slot) return true
    return Math.hypot(slot.x - b.x, slot.y - b.y) < 0.5 && Math.hypot(b.vx, b.vy) < 2
  })
}
