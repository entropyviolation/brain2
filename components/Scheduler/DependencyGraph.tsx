/**
 * components/Scheduler/DependencyGraph.tsx — Task dependency node-graph
 *
 * Draws the project network as a node-link diagram: tasks are nodes, `blocks`
 * precedence (dependency → dependent) are directed edges, and the critical path
 * is highlighted in red. Uses the layered (topological) layout from
 * lib/graph-layout so the graph reads left → right by precedence. Clicking a
 * node selects/opens it. Plain SVG; no graph dependency.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Workflow } from "lucide-react"
import type { Task } from "@/lib/types"
import { layeredLayout, boundingBox } from "@/lib/graph-layout"
import { buildProjectNetwork, toLayoutEdges } from "./project-network"

const NODE_W = 150
const NODE_H = 44
const PADDING = 40

export function DependencyGraph({
  tasks,
  onSelectTask,
}: {
  tasks: Task[]
  onSelectTask?: (taskId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const network = useMemo(() => buildProjectNetwork(tasks), [tasks])
  const { cpm, edges } = network

  const positions = useMemo(
    () =>
      layeredLayout(
        network.tasks.map((t) => t.id),
        toLayoutEdges(edges),
        { columnGap: NODE_W + 90, rowGap: NODE_H + 36, originX: NODE_W / 2 + PADDING, originY: NODE_H / 2 + PADDING },
      ),
    [network.tasks, edges],
  )

  const box = useMemo(() => boundingBox(positions, NODE_W / 2 + PADDING), [positions])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    onSelectTask?.(id)
  }

  if (network.tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Dependency Graph
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No dependencies to graph yet. Link tasks with <span className="font-medium">dependencies</span> to see the
            precedence network and its critical path.
          </p>
        </CardContent>
      </Card>
    )
  }

  const viewW = Math.max(box.width, 320)
  const viewH = Math.max(box.height, 200)
  const criticalCount = network.tasks.filter((t) => cpm.nodes[t.id].isOnCriticalPath).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Dependency Graph
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>{network.tasks.length} tasks</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            Critical ({criticalCount})
          </span>
          {cpm.hasCycle && <Badge variant="destructive">Cycle detected</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto rounded-md border border-border bg-muted/20" style={{ maxHeight: 520 }}>
          <svg
            viewBox={`${box.minX} ${box.minY} ${viewW} ${viewH}`}
            width={viewW}
            height={viewH}
            className="block"
            style={{ minWidth: "100%" }}
          >
            <defs>
              <marker id="dep-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 Z" fill="#94a3b8" />
              </marker>
              <marker id="dep-arrow-critical" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 Z" fill="#ef4444" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const sp = positions[e.source]
              const tp = positions[e.target]
              if (!sp || !tp) return null
              const s = cpm.nodes[e.source]
              const t = cpm.nodes[e.target]
              const critical = s.isOnCriticalPath && t.isOnCriticalPath && Math.abs(s.earliestFinish - t.earliestStart) < 1e-9
              const x1 = sp.x + NODE_W / 2
              const y1 = sp.y
              const x2 = tp.x - NODE_W / 2
              const y2 = tp.y
              const midX = (x1 + x2) / 2
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 4} ${y2}`}
                  fill="none"
                  stroke={critical ? "#ef4444" : "#94a3b8"}
                  strokeWidth={critical ? 2.5 : 1.5}
                  markerEnd={`url(#${critical ? "dep-arrow-critical" : "dep-arrow"})`}
                />
              )
            })}

            {/* Nodes */}
            {network.tasks.map((task) => {
              const p = positions[task.id]
              if (!p) return null
              const node = cpm.nodes[task.id]
              const critical = node.isOnCriticalPath
              const selected = selectedId === task.id
              return (
                <g
                  key={task.id}
                  className="cursor-pointer"
                  transform={`translate(${p.x - NODE_W / 2}, ${p.y - NODE_H / 2})`}
                  onClick={() => handleSelect(task.id)}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={critical ? "#fee2e2" : "#eff6ff"}
                    stroke={selected ? "#0f172a" : critical ? "#ef4444" : "#3b82f6"}
                    strokeWidth={selected ? 3 : critical ? 2 : 1.5}
                  />
                  <text x={NODE_W / 2} y={18} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
                    {task.description.length > 20 ? task.description.slice(0, 19) + "…" : task.description}
                  </text>
                  <text x={NODE_W / 2} y={33} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {Math.round(node.duration)}m
                    {node.slack > 0 ? ` · slack ${Math.round(node.slack)}m` : " · critical"}
                  </text>
                  <title>{task.description}</title>
                </g>
              )
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}
