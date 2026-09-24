/**
 * components/Scheduler/DayAgenda.tsx — 24-hour day agenda
 *
 * Hour rows stay reserved furniture. Occupied hours hold orb-bearing tasks
 * that can be dropped, opened, or cleared.
 */
"use client"

import type React from "react"
import { iconFor } from "@/components/Icons"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"

export function DayAgenda({
  currentDate,
  allTasks,
  onDragStart,
  onDropHour,
  onClearTime,
  onTaskClick,
}: {
  currentDate: Date
  allTasks: Task[]
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDropHour: (taskId: string, hour: string) => void
  onClearTime: (taskId: string) => void
  onTaskClick: (taskId: string) => void
}) {
  return (
    <div className="sch-agenda">
      {Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, "0") + ":00"
        const scheduledTasks = allTasks.filter(
          (task) =>
            task.scheduledDate &&
            new Date(task.scheduledDate).toDateString() === currentDate.toDateString() &&
            task.scheduledTime === hour,
        )

        return (
          <div key={hour} className="sch-hour">
            <div className="sch-hour-label">{hour}</div>
            <div
              className="sch-hour-slot"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const taskId = e.dataTransfer.getData("taskId")
                if (taskId) onDropHour(taskId, hour)
              }}
            >
              {scheduledTasks.map((task) => (
                <div
                  key={task.id}
                  className="sch-hour-task"
                  onClick={() => onTaskClick(task.id)}
                  draggable
                  onDragStart={(e) => onDragStart(e, task.id)}
                >
                  <img src={iconFor(task.id, task.icon)} alt="" className="sch-gantt-orb" draggable={false} />
                  <span className="sch-task-title">{itemTitle(task)}</span>
                  <span className="sch-task-meta">{task.estimatedDuration ?? 0}m</span>
                  <button
                    type="button"
                    className="sch-btn sch-task-x"
                    title="Clear time"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClearTime(task.id)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
