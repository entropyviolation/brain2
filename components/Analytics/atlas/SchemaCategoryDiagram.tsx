/**
 * components/Analytics/atlas/SchemaCategoryDiagram.tsx — The vocabulary as a
 * small category (KG-V5, second plate). Objects (types and address kinds) are
 * boxes. Morphisms (relations) are labelled arrows from domain to codomain.
 * Identity arrows (`id:…`) are left out.
 *
 * Layered left to right by `topologicalRanks` (`lib/graph-layout.ts`).
 * Morphisms that share a domain and codomain are drawn as one arrow, labelled
 * with the first and a count. Clicking an arrow lists each morphism in it with
 * its domain and codomain. Presentational and read-only.
 */
"use client"

import { useMemo, useState } from "react"
import { topologicalRanks } from "@/lib/graph-layout"
import type { SchemaMorphism, SchemaObject } from "@/lib/graph/kg-model"
import "./atlas.css"

const BOX_W = 128
const BOX_H = 26
const COL = 230
const ROW = 64
const PAD = 40

export function isIdentity(m: SchemaMorphism): boolean {
  return m.id.startsWith("id:")
}

interface Bundle {
  key: string
  dom: string
  cod: string
  morphisms: SchemaMorphism[]
}

export function SchemaCategoryDiagram({ objects, morphisms }: { objects: readonly SchemaObject[]; morphisms: readonly SchemaMorphism[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const label = useMemo(() => new Map(objects.map((o) => [o.id, o.label])), [objects])

  const { bundles, at, width, height } = useMemo(() => {
    const ids = objects.map((o) => o.id)
    const known = new Set(ids)
    const arrows = morphisms.filter((m) => !isIdentity(m) && known.has(m.dom) && known.has(m.cod))
    const byPair = new Map<string, Bundle>()
    for (const m of arrows) {
      const key = `${m.dom}→${m.cod}`
      if (!byPair.has(key)) byPair.set(key, { key, dom: m.dom, cod: m.cod, morphisms: [] })
      byPair.get(key)!.morphisms.push(m)
    }
    for (const b of byPair.values()) b.morphisms.sort((x, y) => x.label.localeCompare(y.label) || x.id.localeCompare(y.id))
    const { rank, layers } = topologicalRanks(
      ids,
      arrows.map((m) => ({ source: m.dom, target: m.cod })),
    )
    const at = new Map<string, { x: number; y: number }>()
    for (const id of ids) at.set(id, { x: PAD + rank[id] * COL, y: PAD + layers[rank[id]].indexOf(id) * ROW })
    const rows = Math.max(1, ...layers.map((l) => l.length))
    return {
      bundles: [...byPair.values()].sort((a, b) => a.key.localeCompare(b.key)),
      at,
      width: PAD * 2 + Math.max(0, layers.length - 1) * COL + BOX_W,
      height: PAD * 2 + (rows - 1) * ROW + BOX_H,
    }
  }, [objects, morphisms])

  const opened = bundles.find((b) => b.key === open)
  const name = (id: string) => label.get(id) ?? id

  if (!objects.length) return <p className="atlas-empty">No types to draw.</p>

  return (
    <div className="atlas-schema" data-testid="schema-category">
      <div className="atlas-schema-well">
        <svg width={width} height={height} role="group" aria-label="Types and relations">
          <defs>
            <marker id="atlas-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" className="atlas-arrow-head" />
            </marker>
          </defs>
          {bundles.map((b) => {
            const a = at.get(b.dom)!
            const c = at.get(b.cod)!
            const first = b.morphisms[0].label
            const text = b.morphisms.length > 1 ? `${first} +${b.morphisms.length - 1}` : first
            let d: string
            let lx: number
            let ly: number
            if (b.dom === b.cod) {
              const x = a.x + BOX_W * 0.7
              d = `M${x - 14} ${a.y} C${x - 22} ${a.y - 34}, ${x + 22} ${a.y - 34}, ${x + 14} ${a.y}`
              lx = x
              ly = a.y - 30
            } else if (c.x > a.x) {
              const x1 = a.x + BOX_W
              const y1 = a.y + BOX_H / 2
              const x2 = c.x
              const y2 = c.y + BOX_H / 2
              const mx = (x1 + x2) / 2
              d = `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
              lx = mx
              ly = (y1 + y2) / 2 - 4
            } else {
              // Back or same-column arrow: bow out to the right.
              const x1 = a.x + BOX_W
              const y1 = a.y + BOX_H / 2
              const x2 = c.x + BOX_W
              const y2 = c.y + BOX_H / 2
              const bow = Math.max(x1, x2) + 50
              d = `M${x1} ${y1} C${bow} ${y1}, ${bow} ${y2}, ${x2} ${y2}`
              lx = bow - 10
              ly = (y1 + y2) / 2
            }
            return (
              <g
                key={b.key}
                className={`atlas-morphism${open === b.key ? " is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${text}: ${name(b.dom)} to ${name(b.cod)}`}
                onClick={() => setOpen(open === b.key ? null : b.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setOpen(open === b.key ? null : b.key)
                  }
                }}
              >
                <path d={d} className="atlas-morphism-hit" />
                <path d={d} className="atlas-morphism-line" markerEnd="url(#atlas-arrow)" />
                <text x={lx} y={ly} textAnchor="middle">
                  {text}
                </text>
              </g>
            )
          })}
          {objects.map((o) => {
            const p = at.get(o.id)!
            return (
              <g key={o.id} className="atlas-object" transform={`translate(${p.x},${p.y})`}>
                <rect width={BOX_W} height={BOX_H} />
                <text x={BOX_W / 2} y={BOX_H / 2 + 4} textAnchor="middle">
                  {o.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {opened && (
        <aside className="atlas-readout" aria-label="Morphism readout" data-testid="morphism-readout">
          <p className="atlas-readout-title">
            {name(opened.dom)} → {name(opened.cod)}
          </p>
          <ul className="atlas-edge-rows">
            {opened.morphisms.map((m) => (
              <li key={m.id}>
                {m.label} <span className="atlas-faint">· domain {name(m.dom)} · codomain {name(m.cod)}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  )
}
