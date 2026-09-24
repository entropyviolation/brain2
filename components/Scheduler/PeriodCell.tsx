/**
 * components/Scheduler/PeriodCell.tsx — Droppable period bucket
 *
 * Empty buckets stay reserved one-line furniture. When they hold work the
 * row opens and shows orb-bearing task items. Drag and click-to-schedule stay.
 */
"use client"

import type React from "react"
import type { Task } from "@/lib/types"

export function PeriodCell({
  title,
  badge,
  isCurrent = false,
  tasks,
  maxVisible,
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
    <div
      className={`sch-bucket cursor-pointer${isCurrent ? " is-current" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onClick}
    >
      <div className="sch-bucket-line">
        <span className="sch-bucket-title">{title}</span>
        {badge}
        <span className="sch-bucket-count">{tasks.length}</span>
      </div>
      {tasks.length > 0 && (
        <div className="sch-bucket-body">
          {tasks.slice(0, maxVisible).map((task) => renderTaskItem(task))}
          {overflow > 0 && <div className="sch-hint">+{overflow} more</div>}
        </div>
      )}
    </div>
  )
}
