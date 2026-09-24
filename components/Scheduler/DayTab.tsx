/**
 * components/Scheduler/DayTab.tsx — Scheduler Day period
 *
 * Sidebar of the day's tasks plus the 24-hour agenda. Drop-to-hour and
 * clear-time stay on the agenda.
 */
"use client"

import type React from "react"
import type { Task } from "@/lib/types"
import { DayAgenda } from "./DayAgenda"

export function DayTab({
  currentDate,
  allTasks,
  dayTasks,
  onDropHour,
  onClearTime,
  onDragStart,
  onTaskClick,
  renderTaskItem,
}: {
  currentDate: Date
  allTasks: Task[]
  dayTasks: Task[]
  onDropHour: (taskId: string, hour: string) => void
  onClearTime: (taskId: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onTaskClick: (taskId: string) => void
  renderTaskItem: (task: Task, opts?: { showCheckbox?: boolean; showUnschedule?: boolean }) => React.ReactNode
}) {
  return (
    <div className="sch-split">
      <aside className="sch-pane">
        <div className="sch-pane-head">Today's Tasks</div>
        <div className="sch-pane-body">
          {dayTasks.length === 0 ? (
            <p className="sch-vacant">0 for this day</p>
          ) : (
            dayTasks.map((task) => renderTaskItem(task, { showUnschedule: true }))
          )}
        </div>
      </aside>
      <div className="sch-pane">
        <div className="sch-pane-head">Daily Agenda</div>
        <div className="sch-pane-body">
          <DayAgenda
            currentDate={currentDate}
            allTasks={allTasks}
            onDragStart={onDragStart}
            onDropHour={onDropHour}
            onClearTime={onClearTime}
            onTaskClick={onTaskClick}
          />
        </div>
      </div>
    </div>
  )
}
