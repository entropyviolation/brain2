/**
 * components/Graph/KnowledgeGraph.tsx — Typed-links knowledge graph (feature 9)
 *
 * A force-directed spatial graph over ALL items and their typed links (spec §5 /
 * Brain2 #109). Nodes are items (read from `useTaskStore`); edges are typed
 * relations from each item's `links`, labelled via `relationLabel` and optionally
 * colored by `ItemLink.stance` (support → green, refute → red). Clicking a node
 * opens it in the task detail popup. Layout comes from the pure, deterministic
 * `forceishLayout` helper so the graph is reproducible and SSR-safe.
 *
 * Default export reads the store itself; the coordinator wires a top-level tab.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Network } from "lucide-react"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { relationLabel } from "@/lib/links"
import { forceishLayout, boundingBox } from "@/lib/graph-layout"
import type { LayoutEdge } from "@/lib/graph-layout"
import type { LinkStance, Task } from "@/lib/types"

const WIDTH = 1000
const HEIGHT = 700
const NODE_R = 9

function stanceColor(stance?: LinkStance): string {
  switch (stance) {
    case "strong-support":
      return "#16a34a"
    case "weak-support":
      return "#4ade80"
    case "weak-refute":
      return "#f87171"
    case "strong-refute":
      return "#dc2626"
    default:
      return "#94a3b8"
  }
}

interface GraphEdgeView {
  source: string
  target: string
  relation: string
  stance?: LinkStance
}

export default function KnowledgeGraph() {
  const tasks = useTaskStore((s) => s.tasks)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    const rawEdges: GraphEdgeView[] = []
    for (const t of tasks) {
      for (const link of t.links ?? []) {
        if (!byId.has(link.targetId) || link.targetId === t.id) continue
        rawEdges.push({ source: t.id, target: link.targetId, relation: link.relation, stance: link.stance })
      }
    }
    const connected = new Set<string>()
    rawEdges.forEach((e) => {
      connected.add(e.source)
      connected.add(e.target)
    })
    // By default only show linked items (the actual graph); optionally show all.
    const nodes = tasks.filter((t) => showAll || connected.has(t.id))
    const nodeIds = new Set(nodes.map((t) => t.id))
    const edges = rawEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    return { nodes, edges }
  }, [tasks, showAll])

  const positions = useMemo(() => {
    const layoutEdges: LayoutEdge[] = edges.map((e) => ({ source: e.source, target: e.target }))
    return forceishLayout(
      nodes.map((t) => t.id),
      layoutEdges,
      { width: WIDTH, height: HEIGHT, seed: "knowledge" },
    )
  }, [nodes, edges])

  const box = useMemo(() => boundingBox(positions, NODE_R + 60), [positions])
  const labelFor = (t: Task) => t.title || t.description || t.id

  if (nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Knowledge Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No typed links yet. Connect items with relations (e.g. <span className="font-medium">supports</span>,{" "}
            <span className="font-medium">blocks</span>, <span className="font-medium">related to</span>) to grow your
            knowledge graph.
          </p>
        </CardContent>
      </Card>
    )
  }

  const viewW = Math.max(box.width, 400)
  const viewH = Math.max(box.height, 300)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Knowledge Graph
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>
                {nodes.length} items · {edges.length} links
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#16a34a" }} />
                supports
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#dc2626" }} />
                refutes
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Linked only" : "Show all items"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border border-border bg-muted/20" style={{ maxHeight: 640 }}>
          <svg
            viewBox={`${box.minX} ${box.minY} ${viewW} ${viewH}`}
            width="100%"
            height={Math.min(viewH, 640)}
            className="block"
          >
            <defs>
              <marker id="kg-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const sp = positions[e.source]
              const tp = positions[e.target]
              if (!sp || !tp) return null
              const mx = (sp.x + tp.x) / 2
              const my = (sp.y + tp.y) / 2
              const color = stanceColor(e.stance)
              return (
                <g key={i}>
                  <line
                    x1={sp.x}
                    y1={sp.y}
                    x2={tp.x}
                    y2={tp.y}
                    stroke={color}
                    strokeWidth={e.stance && e.stance !== "none" ? 2 : 1.25}
                    opacity={0.7}
                    markerEnd="url(#kg-arrow)"
                  />
                  <text x={mx} y={my - 2} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                    {relationLabel(e.relation)}
                  </text>
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((task) => {
              const p = positions[task.id]
              if (!p) return null
              const selected = selectedTaskId === task.id
              const label = labelFor(task)
              return (
                <g key={task.id} className="cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={NODE_R}
                    fill={selected ? "#0f172a" : "#3b82f6"}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <text x={p.x + NODE_R + 3} y={p.y + 3} className="fill-foreground text-[11px]">
                    {label.length > 24 ? label.slice(0, 23) + "…" : label}
                  </text>
                  <title>{label}</title>
                </g>
              )
            })}
          </svg>
        </div>
        {edges.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-1">
              Tip
            </Badge>
            These items have no links between them yet — add typed relations to connect them.
          </p>
        )}
      </CardContent>
      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </Card>
  )
}
