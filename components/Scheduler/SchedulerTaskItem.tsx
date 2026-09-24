/**
 * components/Scheduler/SchedulerTaskItem.tsx — Draggable scheduler task row
 *
 * A single task used across every Scheduler tab. Orb first (Lists contract),
 * then bureaucratic title + counts. Drag/select/unschedule stay delegated.
 */
"use client"

import type React from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { iconFor } from "@/components/Icons"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"

export function SchedulerTaskItem({
  task,
  color,
  selected = false,
  showCheckbox = false,
  showUnschedule = false,
  onClick,
  onToggleSelect,
  onUnschedule,
  onDragStart,
}: {
  task: Task
  color: string
  selected?: boolean
  showCheckbox?: boolean
  showUnschedule?: boolean
  onClick?: () => void
  onToggleSelect?: (taskId: string) => void
  onUnschedule?: (taskId: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
}) {
  return (
    <div
      className={`sch-task task-item${selected ? " is-selected" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      style={{ boxShadow: undefined, borderLeft: `3px solid ${color}` }}
    >
      {showCheckbox && (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect?.(task.id)} />
        </div>
      )}
      <img src={iconFor(task.id, task.icon)} alt="" className="sch-task-orb" draggable={false} />
      <div className="sch-task-main" onClick={onClick}>
        <p className="sch-task-title">{itemTitle(task)}</p>
        <div className="sch-task-meta">
          <span>{task.estimatedDuration ?? 0}m</span>
          <span>u{task.urgency ?? 0}</span>
          <span>i{task.importance ?? 0}</span>
        </div>
      </div>
      {showUnschedule && (
        <button
          type="button"
          className="sch-btn sch-task-x"
          title="Unschedule"
          onClick={(e) => {
            e.stopPropagation()
            onUnschedule?.(task.id)
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
