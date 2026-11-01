/**
 * components/Analytics/atlas/GraphAtlas.tsx — The whole-vault graph as one
 * plate (KG-V). Presentational: it takes a `KnowledgeGraph` and draws it.
 *
 * - Filters: node kinds, edge orders, relation family. Each chip says its count.
 * - Orders as stroke (KG-V3): observed cobalt, recorded ink, derived dashed,
 *   inferred dotted.
 * - Cap by degree (`lib/graph/atlas-layout.ts`), with "showing N of M".
 * - Search focuses a node: its 1- or 2-hop neighbourhood stays lit, the rest dims.
 * - Click a node: a readout with label, kind, type, degree, and in / out edges.
 * - Pan by drag, zoom by wheel or the + / − keys. Both move the viewBox.
 * - `insights` (id → score) sizes nodes. `communities` (id → key) groups and
 *   tints them with the room's ink tokens.
 * Read-only. Nothing here writes a store.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { atlasLayout, ATLAS_DEFAULT_CAP, hopsFrom } from "@/lib/graph/atlas-layout"
import type { KgEdge, KgNode, KnowledgeGraph } from "@/lib/graph/kg-model"
import type { EdgeOrder } from "@/lib/graph/vault-graph"
import { relationFamily } from "@/lib/link-graph"
import { relationLabel, type RelationFamily } from "@/lib/links"
import "./atlas.css"

export const EDGE_ORDERS: EdgeOrder[] = ["observed", "recorded", "derived", "inferred"]
const CAPS = [150, ATLAS_DEFAULT_CAP, 1000] as const
/** Ink tones for communities. More communities than tones repeat in order. */
export const COMMUNITY_TONES = 6
const LABEL_TOP = 14
const READOUT_ROWS = 30
const MATCH_ROWS = 8

type View = { x: number; y: number; w: number; h: number }

function countBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of rows) out.set(key(row), (out.get(key(row)) ?? 0) + 1)
  return out
}

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function GraphAtlas({
  graph,
  insights,
  communities,
  typeLabel,
  onOpen,
  initialCap = ATLAS_DEFAULT_CAP,
}: {
  graph: KnowledgeGraph
  /** Node id → score. Larger score, larger node. */
  insights?: ReadonlyMap<string, number>
  /** Node id → community key. */
  communities?: ReadonlyMap<string, string | number>
  typeLabel?: (typeId: string) => string
  /** Opens a node outside the atlas (an item in Lists). */
  onOpen?: (node: KgNode) => void
  initialCap?: number
}) {
  const nodes = useMemo(() => [...graph.nodes.values()], [graph])
  const kindCounts = useMemo(() => countBy(nodes, (n) => n.kind), [nodes])
  const orderCounts = useMemo(() => countBy(graph.edges, (e) => e.order), [graph])
  const familyCounts = useMemo(() => countBy(graph.edges, (e) => relationFamily(e.p)), [graph])

  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(() => new Set())
  const [hiddenOrders, setHiddenOrders] = useState<Set<EdgeOrder>>(() => new Set())
  const [family, setFamily] = useState<RelationFamily | "all">("all")
  const [cap, setCap] = useState(initialCap)
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState<string | null>(null)
  const [hopsMax, setHopsMax] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<string | null>(null)

  const label = (id: string) => graph.nodes.get(id)?.label ?? id

  const shownNodes = useMemo(() => nodes.filter((n) => !hiddenKinds.has(n.kind)), [nodes, hiddenKinds])
  const shownEdges = useMemo(() => {
    const ok = new Set(shownNodes.map((n) => n.id))
    return graph.edges.filter(
      (e) =>
        ok.has(e.s) &&
        ok.has(e.o) &&
        !hiddenOrders.has(e.order) &&
        (family === "all" || relationFamily(e.p) === family),
    )
  }, [graph, shownNodes, hiddenOrders, family])

  // Only the focus is pinned past the cap, so a click does not move the drawing.
  const keep = useMemo(() => (focus ? [focus] : []), [focus])
  const layout = useMemo(
    () =>
      atlasLayout(
        shownNodes.map((n) => n.id),
        shownEdges,
        { cap, keep, communities },
      ),
    [shownNodes, shownEdges, cap, keep, communities],
  )
  const drawnEdges = useMemo(() => shownEdges.filter((e) => e.s !== e.o && layout.at.has(e.s) && layout.at.has(e.o)), [shownEdges, layout])
  const hops = useMemo(() => (focus ? hopsFrom(focus, shownEdges, hopsMax) : null), [focus, shownEdges, hopsMax])
  const toneOf = useMemo(() => new Map(layout.communityOrder.map((key, i) => [key, i % COMMUNITY_TONES])), [layout])

  const maxScore = useMemo(() => {
    let max = 0
    for (const v of insights?.values() ?? []) if (v > max) max = v
    return max
  }, [insights])
  const radius = (id: string, degree: number) => {
    if (insights && maxScore > 0) return 3 + 7 * Math.sqrt(Math.max(0, insights.get(id) ?? 0) / maxScore)
    return Math.min(9, 3 + Math.sqrt(degree))
  }
  const labelled = useMemo(() => {
    const top = [...layout.points].sort((a, b) => b.degree - a.degree || (a.id < b.id ? -1 : 1)).slice(0, LABEL_TOP)
    return new Set(top.map((p) => p.id))
  }, [layout])

  // viewBox pan / zoom
  const fit = useMemo<View>(() => ({ x: -20, y: -20, w: layout.width + 40, h: layout.height + 40 }), [layout])
  const [view, setView] = useState<View>(fit)
  useEffect(() => setView(fit), [fit])
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{ px: number; py: number; view: View } | null>(null)
  const zoom = (factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) =>
    setView((v) => ({ x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor, w: v.w * factor, h: v.h * factor }))
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const box = svg.getBoundingClientRect()
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15
      setView((v) => {
        const cx = box.width ? v.x + ((event.clientX - box.left) / box.width) * v.w : v.x + v.w / 2
        const cy = box.height ? v.y + ((event.clientY - box.top) / box.height) * v.h : v.y + v.h / 2
        return { x: cx - (cx - v.x) * factor, y: cy - (cy - v.y) * factor, w: v.w * factor, h: v.h * factor }
      })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest?.(".atlas-node")) return
    drag.current = { px: event.clientX, py: event.clientY, view }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const box = event.currentTarget.getBoundingClientRect()
    const sx = box.width ? d.view.w / box.width : 1
    const sy = box.height ? d.view.h / box.height : 1
    setView({ ...d.view, x: d.view.x - (event.clientX - d.px) * sx, y: d.view.y - (event.clientY - d.py) * sy })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return shownNodes
      .filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
      .slice(0, MATCH_ROWS)
  }, [query, shownNodes])
  const pick = (id: string) => {
    setFocus(id)
    setSelected(id)
  }

  const families = [...familyCounts.keys()].sort() as RelationFamily[]
  const kinds = [...kindCounts.keys()].sort()
  const selectedNode = selected ? graph.nodes.get(selected) : undefined

  return (
    <div className="atlas" data-testid="graph-atlas">
      <div className="atlas-tools" role="group" aria-label="Atlas filters">
        <div className="atlas-row">
          <span className="atlas-key">Kinds</span>
          {kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className="an-chip"
              aria-pressed={!hiddenKinds.has(kind)}
              title={`${kindCounts.get(kind)} ${kind} nodes. Press to show or hide them.`}
              onClick={() => setHiddenKinds((s) => toggle(s, kind))}
            >
              {kind} {kindCounts.get(kind)}
            </button>
          ))}
        </div>
        <div className="atlas-row">
          <span className="atlas-key">Orders</span>
          {EDGE_ORDERS.map((order) => (
            <button
              key={order}
              type="button"
              className="an-chip"
              aria-pressed={!hiddenOrders.has(order)}
              title={`${orderCounts.get(order) ?? 0} ${order} edges. Press to show or hide them.`}
              onClick={() => setHiddenOrders((s) => toggle(s, order))}
            >
              <svg className="atlas-stroke-key" width="18" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="17" y2="3" className={`atlas-edge atlas-o-${order}`} />
              </svg>
              {order} {orderCounts.get(order) ?? 0}
            </button>
          ))}
        </div>
        <div className="atlas-row">
          <span className="atlas-key">Family</span>
          <button type="button" className="an-chip" aria-pressed={family === "all"} onClick={() => setFamily("all")}>
            all
          </button>
          {families.map((f) => (
            <button
              key={f}
              type="button"
              className="an-chip"
              aria-pressed={family === f}
              title={`${familyCounts.get(f)} edges in the ${f} family.`}
              onClick={() => setFamily(f)}
            >
              {f} {familyCounts.get(f)}
            </button>
          ))}
        </div>
        <div className="atlas-row">
          <span className="atlas-key">Most</span>
          {CAPS.map((c) => (
            <button key={c} type="button" className="an-chip" aria-pressed={cap === c} title={`Place the ${c} nodes with the most edges.`} onClick={() => setCap(c)}>
              {c}
            </button>
          ))}
          <label className="atlas-search">
            <span className="atlas-key">Find</span>
            <input
              type="search"
              value={query}
              placeholder="Node name"
              aria-label="Find a node"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) pick(matches[0].id)
              }}
            />
          </label>
          {focus && (
            <>
              <button type="button" className="an-chip" aria-pressed={hopsMax === 1} onClick={() => setHopsMax(1)} title="Light nodes one edge from the focus.">
                1 hop
              </button>
              <button type="button" className="an-chip" aria-pressed={hopsMax === 2} onClick={() => setHopsMax(2)} title="Light nodes up to two edges from the focus.">
                2 hops
              </button>
              <button type="button" className="an-chip" onClick={() => setFocus(null)} title="Light every node again.">
                Clear focus
              </button>
            </>
          )}
        </div>
        {matches.length > 0 && (
          <ul className="atlas-matches" aria-label="Matching nodes">
            {matches.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => pick(n.id)}>
                  {n.label} <span className="atlas-faint">{n.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="an-canvas-kicker" data-testid="atlas-count">
        Showing {layout.shown} of {layout.total} nodes · {drawnEdges.length} edges
      </p>

      <div className="atlas-body">
        <div className="atlas-well">
          {layout.shown === 0 ? (
            <p className="atlas-empty">No nodes in this cut.</p>
          ) : (
            <svg
              ref={svgRef}
              className="atlas-svg"
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              role="img"
              aria-label="Vault graph"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              <g className="atlas-edges">
                {drawnEdges.map((e, i) => {
                  const a = layout.at.get(e.s)!
                  const b = layout.at.get(e.o)!
                  const dim = hops && !(hops.has(e.s) && hops.has(e.o))
                  return (
                    <line
                      key={`${e.s}|${e.p}|${e.o}|${i}`}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      className={`atlas-edge atlas-o-${e.order}${dim ? " atlas-dim" : ""}`}
                      data-order={e.order}
                      data-testid={`atlas-edge-${e.s}-${e.o}`}
                    >
                      <title>{`${label(e.s)} · ${relationLabel(e.p)} · ${label(e.o)} (${e.order})`}</title>
                    </line>
                  )
                })}
              </g>
              <g className="atlas-nodes">
                {layout.points.map((p) => {
                  const node = graph.nodes.get(p.id)
                  const tone = p.community !== undefined ? toneOf.get(p.community) : undefined
                  const dim = hops && !hops.has(p.id)
                  const isSel = p.id === selected
                  const showLabel = isSel || p.id === focus || labelled.has(p.id) || (hops?.get(p.id) ?? 9) <= 1
                  return (
                    <g
                      key={p.id}
                      className={`atlas-node${tone !== undefined ? ` atlas-c${tone}` : ""}${dim ? " atlas-dim" : ""}${isSel ? " is-selected" : ""}`}
                      transform={`translate(${p.x},${p.y})`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSel}
                      aria-label={node?.label ?? p.id}
                      data-kind={node?.kind}
                      onClick={() => setSelected(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelected(p.id)
                        }
                      }}
                    >
                      <circle r={radius(p.id, p.degree)} />
                      {showLabel && (
                        <text x={radius(p.id, p.degree) + 3} y={3}>
                          {node?.label ?? p.id}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>
            </svg>
          )}
          <div className="atlas-zoom" role="group" aria-label="Zoom">
            <button type="button" className="an-chip" onClick={() => zoom(1 / 1.3)} aria-label="Zoom in" title="Zoom in. The wheel zooms too.">
              +
            </button>
            <button type="button" className="an-chip" onClick={() => zoom(1.3)} aria-label="Zoom out" title="Zoom out.">
              −
            </button>
            <button type="button" className="an-chip" onClick={() => setView(fit)} title="Show the whole drawing. Drag the paper to pan.">
              Fit
            </button>
          </div>
        </div>
        {selectedNode && (
          <NodeReadout
            node={selectedNode}
            graph={graph}
            label={label}
            typeLabel={typeLabel}
            onPick={(id) => setSelected(id)}
            onFocus={(id) => setFocus(id)}
            onOpen={onOpen}
          />
        )}
      </div>
    </div>
  )
}

function EdgeRows({
  title,
  edges,
  other,
  phrase,
  onPick,
}: {
  title: string
  edges: readonly KgEdge[]
  other: (e: KgEdge) => string
  phrase: (e: KgEdge) => string
  onPick: (id: string) => void
}) {
  if (!edges.length) return null
  return (
    <>
      <p className="atlas-key">
        {title} {edges.length}
      </p>
      <ul className="atlas-edge-rows" aria-label={`${title} edges`}>
        {edges.slice(0, READOUT_ROWS).map((e, i) => (
          <li key={`${e.s}|${e.p}|${e.o}|${i}`} data-order={e.order}>
            <button type="button" onClick={() => onPick(other(e))}>
              {phrase(e)}
            </button>
            {e.order !== "recorded" && <span className="atlas-order-tag">{e.order}</span>}
          </li>
        ))}
        {edges.length > READOUT_ROWS && <li className="atlas-faint">and {edges.length - READOUT_ROWS} more</li>}
      </ul>
    </>
  )
}

function NodeReadout({
  node,
  graph,
  label,
  typeLabel,
  onPick,
  onFocus,
  onOpen,
}: {
  node: KgNode
  graph: KnowledgeGraph
  label: (id: string) => string
  typeLabel?: (typeId: string) => string
  onPick: (id: string) => void
  onFocus: (id: string) => void
  onOpen?: (node: KgNode) => void
}) {
  const out = graph.out.get(node.id) ?? []
  const inn = graph.in.get(node.id) ?? []
  return (
    <aside className="atlas-readout" aria-label="Node readout" data-testid="atlas-readout">
      <p className="atlas-readout-title">{node.label}</p>
      <dl className="atlas-readout-grid">
        <dt>Kind</dt>
        <dd>{node.kind}</dd>
        {node.typeId && (
          <>
            <dt>Type</dt>
            <dd>{typeLabel ? typeLabel(node.typeId) : node.typeId}</dd>
          </>
        )}
        <dt>Degree</dt>
        <dd>
          {out.length + inn.length} ({out.length} out · {inn.length} in)
        </dd>
        <dt>Address</dt>
        <dd className="atlas-faint">{node.id}</dd>
      </dl>
      <div className="atlas-row">
        <button type="button" className="an-chip" onClick={() => onFocus(node.id)} title="Light this node's neighbourhood.">
          Focus
        </button>
        {onOpen && node.kind === "item" && (
          <button type="button" className="an-chip" onClick={() => onOpen(node)}>
            Open in Lists
          </button>
        )}
      </div>
      <EdgeRows title="Out" edges={out} other={(e) => e.o} phrase={(e) => `${relationLabel(e.p)} → ${label(e.o)}`} onPick={onPick} />
      <EdgeRows title="In" edges={inn} other={(e) => e.s} phrase={(e) => `${label(e.s)} ${relationLabel(e.p)} →`} onPick={onPick} />
    </aside>
  )
}
