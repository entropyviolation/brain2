// Page-only scheduling tab for the full-screen item detail. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useCallback, type Dispatch, type SetStateAction } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { TodoCommitmentFields } from "@/components/ItemDetail/tabs/scheduling/TodoCommitmentFields"
import { ItemScheduleFlags } from "@/components/ItemDetail/tabs/scheduling/ItemScheduleFlags"
import { SchedulingSummary } from "@/components/ItemDetail/tabs/scheduling/SchedulingSummary"
import { dateInputValue, parseLocalDate, safeDateFormat } from "@/lib/date-utils"
import type { Task } from "@/lib/types"
import { Calendar, CalendarDays, Target } from "lucide-react"

export function ItemDetailPageScheduling({
  task,
  isEditing,
  scheduleableCategoryIds,
  setTask,
  touchDraft,
}: {
  task: Task
  isEditing: boolean
  scheduleableCategoryIds: Set<string>
  setTask: Dispatch<SetStateAction<Task | null>>
  touchDraft: (patch: Partial<Task>) => void
}) {
  const handleSchedule = useCallback(
    (type: "date" | "week" | "month" | "year", value: string) => {
      if (task) {
        const updates: Partial<Task> = {}

        switch (type) {
          case "date":
            updates.scheduledDate = value ? parseLocalDate(value) ?? undefined : undefined
            break
          case "week":
            updates.scheduledWeek = value
            break
          case "month":
            updates.scheduledMonth = value
            break
          case "year":
            updates.scheduledYear = value
            break
        }

        setTask({ ...task, ...updates })
      }
    },
    [task, setTask],
  )

  return (
    <TabsContent value="scheduling" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Scheduling & Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SchedulingSummary task={task} scheduleableCategoryIds={scheduleableCategoryIds} />
          <ItemScheduleFlags
            task={task}
            scheduleableCategoryIds={scheduleableCategoryIds}
            onChange={setTask}
            disabled={!isEditing}
          />
          <TodoCommitmentFields task={task} onChange={setTask} disabled={!isEditing} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-medium">Specific Date & Time</h3>
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Scheduled Date</Label>
                <Input
                  id="scheduled-date"
                  type="date"
                  value={dateInputValue(task.scheduledDate)}
                  onChange={(e) => handleSchedule("date", e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-time">Scheduled Time</Label>
                <ClockPicker
                  id="scheduled-time"
                  value={task.scheduledTime || ""}
                  onChange={(scheduledTime) => {
                    touchDraft({ scheduledTime })
                    setTask((prev) => (prev ? { ...prev, scheduledTime } : prev))
                  }}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Deadline</h3>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline Date</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={dateInputValue(task.deadline)}
                  onChange={(e) => {
                    const date = e.target.value ? parseLocalDate(e.target.value) ?? undefined : undefined
                    setTask({ ...task, deadline: date })
                  }}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium">Flexible Scheduling</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-week">Scheduled Week</Label>
                <Input
                  id="scheduled-week"
                  placeholder="e.g., 2024-05-19_2024-05-25"
                  value={task.scheduledWeek || ""}
                  onChange={(e) => handleSchedule("week", e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-month">Scheduled Month</Label>
                <Input
                  id="scheduled-month"
                  type="month"
                  value={task.scheduledMonth || ""}
                  onChange={(e) => handleSchedule("month", e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-year">Scheduled Year</Label>
                <Input
                  id="scheduled-year"
                  type="number"
                  min="2024"
                  max="2030"
                  value={task.scheduledYear || ""}
                  onChange={(e) => handleSchedule("year", e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {(task.scheduledDate ||
            task.deadline ||
            task.scheduledWeek ||
            task.scheduledMonth ||
            task.scheduledYear) && (
            <div className="p-4 bg-muted rounded-md space-y-2">
              {task.scheduledDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Scheduled for {safeDateFormat(task.scheduledDate)}
                    {task.scheduledTime && ` at ${task.scheduledTime}`}
                  </span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4" />
                  <span>Deadline: {safeDateFormat(task.deadline)}</span>
                </div>
              )}
              {task.scheduledWeek && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Scheduled for week: {task.scheduledWeek}</span>
                </div>
              )}
              {task.scheduledMonth && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Scheduled for month: {task.scheduledMonth}</span>
                </div>
              )}
              {task.scheduledYear && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Scheduled for year: {task.scheduledYear}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
