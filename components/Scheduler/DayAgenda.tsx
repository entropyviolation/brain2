/**
 * components/Scheduler/DayAgenda.tsx — 24-hour day agenda grid
 *
 * Hour-by-hour agenda for the Scheduler's Day tab. Tasks can be dropped onto an
 * hour to set their scheduledTime, dragged between hours, opened, or cleared.
 */
"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarClock, X } from "lucide-react"
import type { Task } from "@/lib/types"

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Daily Agenda - {currentDate.toLocaleDateString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, "0") + ":00"
            const scheduledTasks = allTasks.filter(
              (task) =>
                task.scheduledDate &&
                new Date(task.scheduledDate).toDateString() === currentDate.toDateString() &&
                task.scheduledTime === hour,
            )

            return (
              <div key={hour} className="flex border-b border-muted last:border-b-0">
                <div className="w-16 py-2 text-xs font-medium text-muted-foreground border-r border-muted">{hour}</div>
                <div
                  className="flex-1 min-h-[40px] p-2 hover:bg-muted/50 transition-colors"
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
                      className="bg-primary/10 border border-primary/20 rounded px-2 py-1 mb-1 text-xs cursor-pointer hover:bg-primary/20 transition-colors group relative"
                      onClick={() => onTaskClick(task.id)}
                      draggable
                      onDragStart={(e) => onDragStart(e, task.id)}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          onClearTime(task.id)
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="font-medium truncate pr-4">{task.description}</div>
                      <div className="text-muted-foreground">{task.estimatedDuration}m</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
