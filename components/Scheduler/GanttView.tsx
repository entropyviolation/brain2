/**
 * components/Scheduler/GanttView.tsx — Gantt timeline with critical-path highlight
 *
 * Project network as a horizontal Gantt document inside the Scheduler window.
 * Bars sit on CPM earliest-start; the critical path is highlighted. Not editable.
 */
"use client"

import { useMemo } from "react"
import { iconFor } from "@/components/Icons"
import type { Task } from "@/lib/types"
import { buildProjectNetwork } from "./project-network"
import { itemTitle } from "@/lib/item-utils"

const ROW_HEIGHT = 40
const BAR_HEIGHT = 22
const CRIT_BAR_HEIGHT = 28
const LABEL_WIDTH = 220
const CHART_MIN_WIDTH = 640
const PADDING_X = 24

function formatDuration(minutes: number): string {
  if (!minutes) return "0m"
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** Slack labels stay short so a long float does not dominate the row. */
function formatSlack(minutes: number): string {
  if (minutes <= 0) return ""
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60))
    return `${days}d`
  }
  if (minutes >= 60) {
    const h = Math.round(minutes / 60)
    return `${h}h`
  }
  return `${Math.round(minutes)}m`
}

export function GanttView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[]
  onSelectTask?: (taskId: string) => void
}) {
  const network = useMemo(() => buildProjectNetwork(tasks), [tasks])
  const { cpm, edges } = network

  const rows = useMemo(() => {
    return [...network.tasks].sort((a, b) => {
      const na = cpm.nodes[a.id]
      const nb = cpm.nodes[b.id]
      if (na.earliestStart !== nb.earliestStart) return na.earliestStart - nb.earliestStart
      if (na.earliestFinish !== nb.earliestFinish) return na.earliestFinish - nb.earliestFinish
      return a.id.localeCompare(b.id)
    })
  }, [network.tasks, cpm])

  const rowIndex = useMemo(() => {
    const m: Record<string, number> = {}
    rows.forEach((t, i) => (m[t.id] = i))
    return m
  }, [rows])

  const projectDuration = cpm.projectDuration
  const chartWidth = CHART_MIN_WIDTH
  const innerWidth = chartWidth - PADDING_X * 2
  const scale = projectDuration > 0 ? innerWidth / projectDuration : 0
  const svgHeight = Math.max(rows.length * ROW_HEIGHT + 32, 80)
  const criticalCount = rows.filter((t) => cpm.nodes[t.id].isOnCriticalPath).length

  const xFor = (unit: number) => PADDING_X + unit * scale

  const ticks = useMemo(() => {
    if (projectDuration <= 0) return [] as { x: number; label: string }[]
    const count = 6
    const step = projectDuration / count
    return Array.from({ length: count + 1 }, (_, i) => {
      const unit = step * i
      return { x: xFor(unit), label: formatDuration(unit) }
    })
  }, [projectDuration, scale])

  if (rows.length === 0) {
    return (
      <div className="sch-doc sch-doc-frame">
        <div className="sch-doc-legend">
          <span>Project length: —</span>
          <span>
            <span className="sch-swatch-crit" /> Critical path
          </span>
          <span>
            <span className="sch-swatch-slack" /> Has slack
          </span>
        </div>
        <div className="sch-path-empty" role="status">
          Nothing on the path yet. Link dependencies and a duration estimate.
        </div>
      </div>
    )
  }

  return (
    <div className="sch-doc sch-doc-frame">
      <div className="sch-doc-legend">
        <span>Project length: {formatDuration(projectDuration)}</span>
        <span>
          <span className="sch-swatch-crit" /> Critical path ({criticalCount})
        </span>
        <span>
          <span className="sch-swatch-slack" /> Has slack
        </span>
        {cpm.hasCycle && <span>Dependency cycle detected</span>}
      </div>
      {criticalCount === 0 ? (
        <div className="sch-path-empty sch-path-empty-sparse" role="status">
          Nothing on the path yet — no zero-slack chain in this set.
        </div>
      ) : null}
      <div className="flex" style={{ minHeight: 0, overflow: "auto" }}>
        <div className="shrink-0" style={{ width: LABEL_WIDTH }}>
          <div style={{ height: 32 }} />
          {rows.map((task) => {
            const node = cpm.nodes[task.id]
            const critical = node.isOnCriticalPath
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelectTask?.(task.id)}
                className="sch-gantt-row"
                style={{ height: ROW_HEIGHT }}
                title={itemTitle(task)}
              >
                <img src={iconFor(task.id, task.icon)} alt="" className="sch-gantt-orb" />
                <span style={{ minWidth: 0 }}>
                  <span className="sch-task-title" style={{ fontWeight: critical ? "bold" : undefined }}>
                    {itemTitle(task)}
                  </span>
                  <span className="sch-task-meta">
                    {formatDuration(node.duration)}
                    {node.slack > 0 ? ` · slack ${formatSlack(node.slack)}` : ""}
                    {task.scheduledDate ? ` · ${new Date(task.scheduledDate).toLocaleDateString()}` : ""}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <svg width={chartWidth} height={svgHeight + 32} className="block">
            <defs>
              <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#808080" />
              </marker>
              <marker id="gantt-arrow-critical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#800000" />
              </marker>
            </defs>

            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={32} x2={t.x} y2={svgHeight + 32} stroke="#c0c0c0" />
                <text x={t.x} y={20} textAnchor="middle" fill="#404040" fontSize="10">
                  {t.label}
                </text>
              </g>
            ))}

            {rows.map((_, i) => (
              <line
                key={i}
                x1={0}
                y1={32 + (i + 1) * ROW_HEIGHT}
                x2={chartWidth}
                y2={32 + (i + 1) * ROW_HEIGHT}
                stroke="#d0d0d0"
              />
            ))}

            {edges.map((e, i) => {
              const s = cpm.nodes[e.source]
              const t = cpm.nodes[e.target]
              if (!s || !t || rowIndex[e.source] == null || rowIndex[e.target] == null) return null
              const critical = s.isOnCriticalPath && t.isOnCriticalPath && Math.abs(s.earliestFinish - t.earliestStart) < 1e-9
              const x1 = xFor(s.earliestFinish)
              const y1 = 32 + rowIndex[e.source] * ROW_HEIGHT + ROW_HEIGHT / 2
              const x2 = xFor(t.earliestStart)
              const y2 = 32 + rowIndex[e.target] * ROW_HEIGHT + ROW_HEIGHT / 2
              const midX = Math.max(x1 + 8, (x1 + x2) / 2)
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2 - 2} ${y2}`}
                  fill="none"
                  stroke={critical ? "#800000" : "#808080"}
                  strokeWidth={critical ? 2 : 1.25}
                  strokeDasharray={critical ? undefined : "3 2"}
                  markerEnd={`url(#${critical ? "gantt-arrow-critical" : "gantt-arrow"})`}
                />
              )
            })}

            {rows.map((task, i) => {
              const node = cpm.nodes[task.id]
              const critical = node.isOnCriticalPath
              const barH = critical ? CRIT_BAR_HEIGHT : BAR_HEIGHT
              const barX = xFor(node.earliestStart)
              const barW = Math.max(node.duration * scale, critical ? 5 : 3)
              const barY = 32 + i * ROW_HEIGHT + (ROW_HEIGHT - barH) / 2
              return (
                <g key={task.id} className="cursor-pointer" onClick={() => onSelectTask?.(task.id)}>
                  {node.slack > 0 && (
                    <rect
                      x={barX}
                      y={barY + barH / 2 - 1}
                      width={Math.max((node.duration + node.slack) * scale, 3)}
                      height={2}
                      fill="#c0c0c0"
                    />
                  )}
                  <rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    fill={critical ? "#b00000" : "#000080"}
                    stroke={critical ? "#3a0000" : "none"}
                    strokeWidth={critical ? 1.5 : 0}
                  />
                  {critical ? (
                    <rect x={barX} y={barY} width={barW} height={3} fill="#ff6a6a" opacity={0.85} />
                  ) : null}
                  <title>
                    {itemTitle(task)} — start {formatDuration(node.earliestStart)}, {formatDuration(node.duration)}
                    {node.slack > 0 ? `, slack ${formatSlack(node.slack)}` : " (critical)"}
                  </title>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
