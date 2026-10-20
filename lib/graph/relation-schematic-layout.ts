/**
 * lib/graph/relation-schematic-layout.ts — Layered tree layout for the
 * relation schematic (LINKS_REDESIGN §8, L2.4). Root left, one column per
 * lattice depth, leaves stacked in tree order. Deterministic.
 */
import type { RelationLattice } from "@/lib/graph/relation-lattice"
import { LATTICE_ROOT } from "@/lib/graph/relation-lattice"

export interface SchematicNode {
  id: string
  x: number
  y: number
  depth: number
  parent?: string
  /** Paired inverse (twin stroke), when both ends are drawn. */
  inverse?: string
}

export function schematicLayout(
  defs: readonly { id: string; label: string; inverse: string }[],
  lattice: RelationLattice,
  opts: { col?: number; row?: number } = {},
): { nodes: SchematicNode[]; width: number; height: number } {
  const col = opts.col ?? 150
  const row = opts.row ?? 22
  const ids = new Set(defs.map((d) => d.id))
  ids.add(LATTICE_ROOT)
  const label = new Map(defs.map((d) => [d.id, d.label]))
  const inverse = new Map(defs.map((d) => [d.id, d.inverse]))
  const children = new Map<string, string[]>()
  for (const id of ids) {
    const p = lattice.parentOf(id)
    if (p === undefined) continue
    const parent = ids.has(p) ? p : LATTICE_ROOT
    children.set(parent, [...(children.get(parent) ?? []), id])
  }
  for (const list of children.values()) list.sort((a, b) => (label.get(a) ?? a).localeCompare(label.get(b) ?? b))
  const nodes: SchematicNode[] = []
  let next = 0
  let maxDepth = 0
  const place = (id: string, depth: number, parent?: string): number => {
    maxDepth = Math.max(maxDepth, depth)
    const kids = children.get(id) ?? []
    const node: SchematicNode = { id, x: depth * col, y: 0, depth, parent }
    nodes.push(node)
    if (!kids.length) node.y = next++ * row
    else {
      const ys = kids.map((k) => place(k, depth + 1, id))
      node.y = (ys[0] + ys[ys.length - 1]) / 2
    }
    return node.y
  }
  place(LATTICE_ROOT, 0)
  for (const n of nodes) {
    const inv = inverse.get(n.id)
    if (inv && inv !== n.id && ids.has(inv)) n.inverse = inv
  }
  return { nodes, width: (maxDepth + 1) * col, height: Math.max(1, next) * row }
}
