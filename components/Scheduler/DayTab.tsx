/**
 * components/Scheduler/DayTab.tsx — Scheduler Day period
 *
 * Sidebar of the day's tasks plus the 24-hour agenda. The agenda title
 * opens that day as Schedule Card Detail. Drop-to-hour and clear-time
 * stay on the agenda.
 */
"use client"

import type React from "react"
import type { SchedulePlacementPeriod, Task } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { DayAgenda } from "./DayAgenda"
import type { SchedulerTaskItemOpts } from "./PeriodFunnelTab"

export function DayTab({
  currentDate,
  allTasks,
  dayTasks,
  onDropHour,
  onClearTime,
  onDragStart,
  onTaskClick,
  onOpenDay,
  detail,
  onSidebarDrop,
  renderTaskItem,
}: {
  currentDate: Date
  allTasks: Task[]
  dayTasks: Task[]
  onDropHour: (taskId: string, hour: string) => void
  onClearTime: (taskId: string) => void
  onDragStart: (e: React.DragEvent, taskId: string, from?: { period: SchedulePlacementPeriod; value: string }) => void
  onTaskClick: (taskId: string) => void
  onOpenDay: () => void
  detail?: React.ReactNode
  onSidebarDrop?: (e: React.DragEvent) => void
  renderTaskItem: (task: Task, opts?: SchedulerTaskItemOpts) => React.ReactNode
}) {
  const dayKey = formatLocalDateKey(currentDate)
  const dayFrom = { period: "day" as const, value: dayKey }
  return (
    <div className="sch-split">
      <aside
        className="sch-pane"
        onDragOver={detail ? (e) => e.preventDefault() : undefined}
        onDrop={detail ? onSidebarDrop : undefined}
      >
        <div className="sch-pane-head">
          Today's Tasks
          {detail && <span>Drop here to return</span>}
        </div>
        <div className="sch-pane-body">
          {dayTasks.length === 0 ? (
            <p className="sch-vacant">0 for this day</p>
          ) : (
            dayTasks.map((task) =>
              renderTaskItem(task, {
                showUnschedule: true,
                fromPeriod: dayFrom.period,
                fromValue: dayFrom.value,
              }),
            )
          )}
        </div>
      </aside>
      {detail ?? <div className="sch-pane">
        <div className="sch-pane-head">
          <button type="button" className="sch-bucket-name" aria-label="Open this day" onClick={onOpenDay}>
            Daily Agenda
          </button>
        </div>
        <div className="sch-pane-body">
          <DayAgenda
            currentDate={currentDate}
            allTasks={allTasks}
            onDragStart={(e, taskId) => onDragStart(e, taskId, dayFrom)}
            onDropHour={onDropHour}
            onClearTime={onClearTime}
            onTaskClick={onTaskClick}
          />
        </div>
      </div>}
    </div>
  )
}
