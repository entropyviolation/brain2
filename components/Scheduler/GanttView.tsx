/**
 * components/Scheduler/GanttView.tsx — Gantt timeline with critical-path highlight
 *
 * Renders the project network (see project-network.ts) as a horizontal Gantt:
 * one row per task, bars positioned by the CPM **earliest start** and sized by
 * the task's duration (PERT expected when available, else estimatedDuration).
 * Dependency arrows connect predecessor → successor bars, and the critical path
 * (zero-slack chain) is highlighted in red. Built with plain SVG + divs — no
 * charting dependency.
 *
 * Axis units are minutes from project start (t=0); a task's `scheduledDate`, if
 * any, is surfaced in the row label. Click a row to open the task.
 */
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GanttChartSquare } from "lucide-react"
import type { Task } from "@/lib/types"
import { buildProjectNetwork } from "./project-network"

const ROW_HEIGHT = 40
const BAR_HEIGHT = 22
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

export function GanttView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[]
  onSelectTask?: (taskId: string) => void
}) {
  const network = useMemo(() => buildProjectNetwork(tasks), [tasks])
  const { cpm, byId, edges } = network

  // Rows ordered by earliest start, then by earliest finish, then id (stable).
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

  // Gridlines at ~6 evenly spaced ticks.
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GanttChartSquare className="h-5 w-5" />
            Gantt & Critical Path
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No project tasks to chart yet. Add task <span className="font-medium">dependencies</span> and a duration
            estimate to see a timeline with the critical path highlighted.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GanttChartSquare className="h-5 w-5" />
          Gantt & Critical Path
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Project length: <span className="font-medium text-foreground">{formatDuration(projectDuration)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#ef4444" }} />
            Critical path ({criticalCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#3b82f6" }} />
            Has slack
          </span>
          {cpm.hasCycle && <Badge variant="destructive">Dependency cycle detected</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex border-t border-border">
          {/* Row labels */}
          <div className="shrink-0" style={{ width: LABEL_WIDTH }}>
            <div style={{ height: 32 }} className="border-b border-border" />
            {rows.map((task) => {
              const node = cpm.nodes[task.id]
              const critical = node.isOnCriticalPath
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask?.(task.id)}
                  className="flex w-full flex-col justify-center border-b border-border px-2 text-left hover:bg-muted/50 transition-colors"
                  style={{ height: ROW_HEIGHT }}
                  title={task.description}
                >
                  <span className={`truncate text-sm ${critical ? "font-semibold" : ""}`}>{task.description}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatDuration(node.duration)}
                    {node.slack > 0 ? ` · slack ${formatDuration(node.slack)}` : ""}
                    {task.scheduledDate ? ` · ${new Date(task.scheduledDate).toLocaleDateString()}` : ""}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Timeline */}
          <div className="overflow-x-auto">
            <svg width={chartWidth} height={svgHeight + 32} className="block">
              <defs>
                <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" />
                </marker>
                <marker id="gantt-arrow-critical" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#ef4444" />
                </marker>
              </defs>

              {/* Gridlines + tick labels */}
              {ticks.map((t, i) => (
                <g key={i}>
                  <line x1={t.x} y1={32} x2={t.x} y2={svgHeight + 32} stroke="currentColor" className="text-border" />
                  <text x={t.x} y={20} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {t.label}
                  </text>
                </g>
              ))}

              {/* Row separators */}
              {rows.map((_, i) => (
                <line
                  key={i}
                  x1={0}
                  y1={32 + (i + 1) * ROW_HEIGHT}
                  x2={chartWidth}
                  y2={32 + (i + 1) * ROW_HEIGHT}
                  stroke="currentColor"
                  className="text-border"
                />
              ))}

              {/* Dependency arrows */}
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
                    stroke={critical ? "#ef4444" : "#94a3b8"}
                    strokeWidth={critical ? 2 : 1.25}
                    strokeDasharray={critical ? undefined : "3 2"}
                    markerEnd={`url(#${critical ? "gantt-arrow-critical" : "gantt-arrow"})`}
                  />
                )
              })}

              {/* Bars */}
              {rows.map((task, i) => {
                const node = cpm.nodes[task.id]
                const critical = node.isOnCriticalPath
                const barX = xFor(node.earliestStart)
                const barW = Math.max(node.duration * scale, 3)
                const barY = 32 + i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
                return (
                  <g key={task.id} className="cursor-pointer" onClick={() => onSelectTask?.(task.id)}>
                    {/* Slack track (latest finish reach) */}
                    {node.slack > 0 && (
                      <rect
                        x={barX}
                        y={barY + BAR_HEIGHT / 2 - 1}
                        width={Math.max((node.duration + node.slack) * scale, 3)}
                        height={2}
                        fill="#cbd5e1"
                      />
                    )}
                    <rect
                      x={barX}
                      y={barY}
                      width={barW}
                      height={BAR_HEIGHT}
                      rx={4}
                      fill={critical ? "#ef4444" : "#3b82f6"}
                      opacity={critical ? 0.92 : 0.82}
                    />
                    <title>
                      {task.description} — start {formatDuration(node.earliestStart)}, {formatDuration(node.duration)}
                      {node.slack > 0 ? `, slack ${formatDuration(node.slack)}` : " (critical)"}
                    </title>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
