/**
 * components/Home/Habits/period-habit-list.tsx — Weekly or monthly habit checklist
 */
"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, Target } from "lucide-react"
import { TaskType, type WeeklyTask, type TaskCompletion, type WeeklyData } from "@/lib/types"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { incrementalDataForTask, incrementalGoalOn, incrementalLoggedValue } from "@/lib/incremental-habits"
import { useThemeStore } from "@/lib/theme-store"
import type { HabitFrequency } from "@/lib/types"

interface PeriodHabitListProps {
  tasks: WeeklyTask[]
  periodKey: string
  data: WeeklyData
  periodLabel: string
  onUpdate: (taskId: string, completion: TaskCompletion) => void
  onEdit: (task: WeeklyTask) => void
  onDelete: (taskId: string) => void
  hideCompleted?: boolean
}

export function PeriodHabitList({
  tasks,
  periodKey,
  data,
  periodLabel,
  onUpdate,
  onEdit,
  onDelete,
  hideCompleted = false,
}: PeriodHabitListProps) {
  const colors = useThemeStore((s) => s.colors)
  const bucket = data[periodKey] || {}

  let visible = tasks
  if (hideCompleted) {
    visible = tasks.filter((t) => !isHabitGoalMet(t, bucket[t.id]))
  }

  const renderInput = (task: WeeklyTask, c: TaskCompletion) => {
    switch (task.type) {
      case TaskType.BOOLEAN:
        return (
          <Checkbox
            checked={!!c.completed}
            onCheckedChange={(checked) => onUpdate(task.id, { completed: checked === true })}
          />
        )
      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-20 h-8"
              value={c.value?.toString() ?? ""}
              placeholder="0"
              onChange={(e) =>
                onUpdate(task.id, { value: e.target.value === "" ? 0 : Number.parseFloat(e.target.value) })
              }
            />
            <span className="text-sm text-muted-foreground">
              / {task.goal} {task.unit}
            </span>
          </div>
        )
      case TaskType.TEXT:
        return (
          <Textarea
            className="min-h-[60px] text-sm"
            value={c.text ?? ""}
            placeholder="Enter details…"
            onChange={(e) => onUpdate(task.id, { text: e.target.value })}
          />
        )
      case TaskType.INCREMENTAL: {
        const climb = incrementalDataForTask(task)
        const asOf = new Date()
        const goal = incrementalGoalOn(task, {}, asOf)
        const value = incrementalLoggedValue(c)
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="w-20 h-8"
              value={value?.toString() ?? ""}
              placeholder="0"
              onChange={(e) =>
                onUpdate(task.id, { value: e.target.value === "" ? undefined : Number.parseFloat(e.target.value) })
              }
            />
            <span className="text-sm text-muted-foreground">
              / {goal} {climb?.unit || task.unit}
            </span>
          </div>
        )
      }
    }
  }

  const typeColor = (type: TaskType) => {
    switch (type) {
      case TaskType.BOOLEAN:
        return colors.habitBoolean
      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        return colors.habitGoal
      case TaskType.TEXT:
        return colors.habitText
      default:
        return colors.habitIncremental
    }
  }

  if (visible.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No habits for {periodLabel}.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{periodLabel}</p>
      {visible.map((task) => {
        const c = bucket[task.id] || {}
        const done = isHabitGoalMet(task, c)
        return (
          <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
            <div className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: typeColor(task.type) }} />
            <div className="flex-1 min-w-0 space-y-2">
              <div className={`font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{task.name}</div>
              {renderInput(task, c)}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(task)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function filterHabitsByFrequency(tasks: WeeklyTask[], frequency: HabitFrequency) {
  return tasks.filter((t) => (t.frequency || "daily") === frequency)
}
