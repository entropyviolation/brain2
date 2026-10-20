/**
 * components/Analytics/relations/RelationSchematic.tsx — The relation
 * hierarchy as a diagram (L2.4, KG-V5). Root left; parent strokes as
 * elbows; inverse pairs as a twin dashed stroke. Read-only; click a node to
 * open its sheet.
 */
"use client"

import { useMemo } from "react"
import { buildLattice } from "@/lib/graph/relation-lattice"
import { schematicLayout } from "@/lib/graph/relation-schematic-layout"
import type { RelationDef } from "@/lib/links"

export function RelationSchematic({ defs, onOpen }: { defs: readonly RelationDef[]; onOpen: (id: string) => void }) {
  const { nodes, width, height } = useMemo(() => schematicLayout(defs, buildLattice(defs)), [defs])
  const at = new Map(nodes.map((n) => [n.id, n]))
  const label = new Map(defs.map((d) => [d.id, d.label]))
  const pad = 12
  return (
    <div className="rel-schematic" data-testid="relation-schematic">
      <svg width={width + 140} height={height + pad * 2} role="img" aria-label="Relation hierarchy">
        <g transform={`translate(${pad},${pad})`}>
          {nodes.map((n) => {
            const p = n.parent ? at.get(n.parent) : undefined
            if (!p) return null
            const mx = p.x + 120
            return <path key={`e-${n.id}`} d={`M${p.x + 4} ${p.y} H${mx} V${n.y} H${n.x}`} className="rel-sch-edge" />
          })}
          {nodes.map((n) => {
            const inv = n.inverse ? at.get(n.inverse) : undefined
            if (!inv || n.id > n.inverse!) return null
            return <path key={`i-${n.id}`} d={`M${n.x + 8} ${n.y + 4} C${n.x + 60} ${n.y + 14}, ${inv.x + 60} ${inv.y + 14}, ${inv.x + 8} ${inv.y + 4}`} className="rel-sch-inverse" />
          })}
          {nodes.map((n) => (
            <g key={n.id} className="rel-sch-node" transform={`translate(${n.x},${n.y})`} onClick={() => onOpen(n.id)} role="button" aria-label={label.get(n.id) ?? n.id}>
              <circle r={3} />
              <text x={7} y={4}>
                {label.get(n.id) ?? n.id}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
