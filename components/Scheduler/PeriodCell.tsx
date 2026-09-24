/**
 * components/Scheduler/PeriodCell.tsx — Droppable period bucket
 *
 * Funnel grids keep empty buckets as reserved one-line furniture. The Always
 * board uses `variant="card"`: a two-column drop card with an Empty line.
 * Past periods use `isPast` for muted gray furniture. Drag and click-to-schedule stay.
 */
"use client"

import type React from "react"
import type { Task } from "@/lib/types"

export function PeriodCell({
  title,
  detail,
  hint,
  badge,
  isCurrent = false,
  isPast = false,
  tasks,
  maxVisible,
  emptyText,
  variant = "line",
  onDrop,
  onClick,
  renderTaskItem,
}: {
  title: string
  detail?: string
  hint?: string
  badge?: React.ReactNode
  isCurrent?: boolean
  /** Elapsed period: darker fill, muted type. Today is never past. */
  isPast?: boolean
  tasks: Task[]
  maxVisible: number
  emptyText?: string
  variant?: "line" | "card"
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
  renderTaskItem: (task: Task) => React.ReactNode
}) {
  const overflow = tasks.length - maxVisible
  const card = variant === "card"
  return (
    <div
      className={`sch-bucket cursor-pointer${isCurrent ? " is-current" : ""}${isPast ? " is-past" : ""}${card ? " sch-bucket-card" : ""}`}
      data-past={isPast ? "true" : "false"}
      title={hint}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onClick={onClick}
    >
      <div className="sch-bucket-line">
        <span className="sch-bucket-title">
          <span className="sch-bucket-name">{title}</span>
          {detail && <span className="sch-bucket-sub">{detail}</span>}
        </span>
        {badge}
        <span className="sch-bucket-count">{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        <div className="sch-bucket-body">
          {tasks.slice(0, maxVisible).map((task) => renderTaskItem(task))}
          {overflow > 0 && <div className="sch-hint">+{overflow} more</div>}
        </div>
      ) : (
        card && emptyText && <p className="sch-bucket-empty">{emptyText}</p>
      )}
    </div>
  )
}
