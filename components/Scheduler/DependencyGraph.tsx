/**
 * components/Scheduler/DependencyGraph.tsx — Task dependency node-graph
 *
 * Project network as a document inside the Scheduler window: nodes, directed
 * edges, critical path in maroon. Click a node to open the task.
 */
"use client"

import { useMemo, useState } from "react"
import { iconFor } from "@/components/Icons"
import type { Task } from "@/lib/types"
import { layeredLayout, boundingBox } from "@/lib/graph-layout"
import { buildProjectNetwork, toLayoutEdges } from "./project-network"
import { itemTitle } from "@/lib/item-utils"

const NODE_W = 168
const NODE_H = 48
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
      <div className="sch-doc">
        <p className="sch-doc-empty">
          No dependencies to graph yet. Link tasks with dependencies to see the precedence network and its critical path.
        </p>
      </div>
    )
  }

  const viewW = Math.max(box.width, 320)
  const viewH = Math.max(box.height, 200)
  const criticalCount = network.tasks.filter((t) => cpm.nodes[t.id].isOnCriticalPath).length

  return (
    <div className="sch-doc">
      <div className="sch-doc-legend">
        <span>{network.tasks.length} tasks</span>
        <span>
          <span className="sch-swatch-crit" /> Critical ({criticalCount})
        </span>
        {cpm.hasCycle && <span>Cycle detected</span>}
      </div>
      <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        <svg
          viewBox={`${box.minX} ${box.minY} ${viewW} ${viewH}`}
          width={viewW}
          height={viewH}
          className="block"
          style={{ minWidth: "100%" }}
        >
          <defs>
            <marker id="dep-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
              <path d="M0,0 L9,4.5 L0,9 Z" fill="#808080" />
            </marker>
            <marker id="dep-arrow-critical" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
              <path d="M0,0 L9,4.5 L0,9 Z" fill="#800000" />
            </marker>
          </defs>

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
                stroke={critical ? "#800000" : "#808080"}
                strokeWidth={critical ? 2.5 : 1.5}
                markerEnd={`url(#${critical ? "dep-arrow-critical" : "dep-arrow"})`}
              />
            )
          })}

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
                  fill={critical ? "#f3e6e6" : "#e8e8f0"}
                  stroke={selected ? "#000" : critical ? "#800000" : "#000080"}
                  strokeWidth={selected ? 2 : 1}
                />
                <image href={iconFor(task.id, task.icon)} x={6} y={16} width={16} height={16} />
                <text x={26} y={20} fill="#000" fontSize="11">
                  {itemTitle(task).length > 18 ? itemTitle(task).slice(0, 17) + "…" : itemTitle(task)}
                </text>
                <text x={26} y={36} fill="#404040" fontSize="10">
                  {Math.round(node.duration)}m
                  {node.slack > 0 ? ` · slack ${Math.round(node.slack)}m` : " · critical"}
                </text>
                <title>{itemTitle(task)}</title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
