/**
 * components/Scheduler/SchedulerTaskItem.tsx — Draggable scheduler task card
 *
 * A single task row used across every Scheduler tab. Presentational: selection,
 * checkbox, unschedule, drag-start and click are all delegated via callbacks.
 */
"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, AlertTriangle, Star, GripVertical, X } from "lucide-react"
import type { Task } from "@/lib/types"

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
      className={`p-3 border rounded-lg transition-all duration-200 group relative task-item ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "hover:bg-muted/50 hover:border-muted-foreground/20"
      }`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      style={{ borderLeftColor: color, borderLeftWidth: "4px" }}
    >
      {showUnschedule && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity focus-ring"
          onClick={(e) => {
            e.stopPropagation()
            onUnschedule?.(task.id)
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div className="flex items-center gap-3">
        {showCheckbox && (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={selected} onCheckedChange={() => onToggleSelect?.(task.id)} className="focus-ring" />
          </div>
        )}
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
          <p className="text-sm font-medium truncate">{task.description}</p>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.estimatedDuration}m
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {task.urgency}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {task.importance}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
