/**
 * components/Scheduler/PeriodCell.tsx — Droppable period cell
 *
 * A single schedulable bucket card (a month/week/day cell, or an "Always"
 * overview box). Accepts dropped tasks and click-to-schedule-selected, renders a
 * capped list of task items with a "+n more" overflow line.
 */
"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Task } from "@/lib/types"

export function PeriodCell({
  title,
  badge,
  isCurrent = false,
  tasks,
  maxVisible,
  emptyText,
  onDrop,
  onClick,
  renderTaskItem,
}: {
  title: string
  badge?: React.ReactNode
  isCurrent?: boolean
  tasks: Task[]
  maxVisible: number
  emptyText?: string
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
  renderTaskItem: (task: Task) => React.ReactNode
}) {
  const overflow = tasks.length - maxVisible
  return (
    <Card
      className={`cursor-pointer hover:bg-muted/50 ${isCurrent ? "ring-2 ring-primary" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          {badge}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {tasks.slice(0, maxVisible).map((task) => renderTaskItem(task))}
        {overflow > 0 && <div className="text-xs text-muted-foreground">+{overflow} more</div>}
        {tasks.length === 0 && emptyText && <div className="text-xs text-muted-foreground italic">{emptyText}</div>}
      </CardContent>
    </Card>
  )
}
