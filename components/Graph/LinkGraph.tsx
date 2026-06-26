/**
 * components/Graph/LinkGraph.tsx — Related-items relationship visual
 *
 * A lightweight, dependency-free graph view for a single focused item. It reads
 * tasks from the repository, builds a focus-centered subgraph via the pure
 * `buildLinkGraph` (lib/link-graph.ts), and lays the neighbors out radially
 * around the focus with labelled edges. Clicking any node opens that item.
 *
 * Intentionally self-contained and presentational: no store mutation, no new npm
 * deps (plain SVG + a radial layout computed here). Mount it from the item-detail
 * view as a companion to RelatedItemsPanel — see components/Graph/README.md.
 *
 * Spec: §5 (tags & links) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useMemo } from "react"
import { taskRepository } from "@/lib/data/task-repository"
import { buildLinkGraph, type GraphNode, type GraphEdge } from "@/lib/link-graph"

interface LinkGraphProps {
  /** Item to center the graph on. */
  focusId: string
  /** Called with an item id when a node is clicked. */
  onOpenItem: (id: string) => void
  /** Hop radius around the focus (default 1). */
  depth?: number
  /** Square SVG viewport size in px (default 360). */
  size?: number
}

interface PlacedNode extends GraphNode {
  x: number
  y: number
  isFocus: boolean
}

const NODE_RADIUS = 26

/** Radial layout: focus at center, neighbors evenly spaced on a ring around it. */
function layout(nodes: GraphNode[], focusId: string, size: number): PlacedNode[] {
  const center = size / 2
  const ring = Math.max(60, center - NODE_RADIUS - 24)
  const neighbors = nodes.filter((n) => n.id !== focusId)
  const placed: PlacedNode[] = []

  const focus = nodes.find((n) => n.id === focusId)
  if (focus) placed.push({ ...focus, x: center, y: center, isFocus: true })

  neighbors.forEach((node, i) => {
    // Start at the top (-90°) and distribute clockwise for a stable layout.
    const angle = (2 * Math.PI * i) / neighbors.length - Math.PI / 2
    placed.push({
      ...node,
      x: center + ring * Math.cos(angle),
      y: center + ring * Math.sin(angle),
      isFocus: false,
    })
  })

  return placed
}

function truncate(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}\u2026` : label
}

/** Focus-centered, dependency-free relationship graph for one item. */
export function LinkGraph({ focusId, onOpenItem, depth = 1, size = 360 }: LinkGraphProps) {
  const { placed, edges, byId } = useMemo(() => {
    const items = taskRepository.getAll()
    const graph = buildLinkGraph(items, { focusId, depth })
    const placedNodes = layout(graph.nodes, focusId, size)
    const map = new Map<string, PlacedNode>(placedNodes.map((n) => [n.id, n]))
    return { placed: placedNodes, edges: graph.edges as GraphEdge[], byId: map }
  }, [focusId, depth, size])

  const hasNeighbors = placed.length > 1

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Relationship graph</h4>
      {!hasNeighbors ? (
        <p className="text-sm text-muted-foreground italic">No related items to graph</p>
      ) : (
        <svg
          role="img"
          aria-label="Relationship graph"
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-full rounded-md border bg-background/50"
          style={{ aspectRatio: "1 / 1" }}
        >
          {/* Edges (drawn first so nodes sit on top). */}
          {edges.map((edge) => {
            const a = byId.get(edge.source)
            const b = byId.get(edge.target)
            if (!a || !b) return null
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            return (
              <g key={`${edge.source}-${edge.relation}-${edge.target}`}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className="stroke-border"
                  strokeWidth={1.5}
                />
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-muted-foreground"
                  style={{ fontSize: 9 }}
                >
                  {edge.label}
                </text>
              </g>
            )
          })}

          {/* Nodes. */}
          {placed.map((node) => (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${node.label}`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onOpenItem(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onOpenItem(node.id)
                }
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={NODE_RADIUS}
                className={
                  node.isFocus
                    ? "fill-primary stroke-primary"
                    : "fill-muted stroke-border hover:fill-accent"
                }
                strokeWidth={node.isFocus ? 2 : 1.5}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                className={node.isFocus ? "fill-primary-foreground" : "fill-foreground"}
                style={{ fontSize: 10, fontWeight: node.isFocus ? 600 : 500, pointerEvents: "none" }}
              >
                {truncate(node.label)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

export default LinkGraph
