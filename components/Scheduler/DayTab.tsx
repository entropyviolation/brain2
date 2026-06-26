/**
 * components/Scheduler/DayTab.tsx — Scheduler "Day" tab
 *
 * A sidebar of the day's tasks plus the 24-hour `DayAgenda`. Owns the small
 * drop-to-hour / clear-time task mutations for the agenda.
 */
"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="grid grid-cols-4 gap-6">
      <div className="col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Today's Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {dayTasks.map((task) => renderTaskItem(task, { showUnschedule: true }))}
          </CardContent>
        </Card>
      </div>
      <div className="col-span-3">
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
  )
}
