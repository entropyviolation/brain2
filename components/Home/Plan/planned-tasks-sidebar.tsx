/**
 * components/Home/Plan/planned-tasks-sidebar.tsx — Planned tasks rail
 *
 * Context-aware sidebar for Plan month/week/day views. Each mode shows only
 * tasks that belong in that period but haven't been placed on a finer schedule
 * yet (month-only, week-only, or day without a time slot). Day view also
 * surfaces incomplete daily habits with a filter toggle, plus a quick-add field
 * that creates the same Home/To-Do records (`createScheduledTodoTask`).
 */
"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GripVertical, Zap, Target, Plus } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import {
  isMonthOnlyPlanned,
  isWeekOnlyPlanned,
  isDayUnscheduledPlanned,
} from "@/lib/item-utils"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { format } from "date-fns"
import type { WeeklyTask } from "@/lib/types"
import { TaskType as TT } from "@/lib/types"

export type PlannedSidebarMode = "month" | "week" | "day"

interface PlannedTasksSidebarProps {
  mode: PlannedSidebarMode
  currentDate: Date
  onTaskClick: (taskId: string) => void
  onUnscheduleTask?: (taskId: string) => void
  onUnscheduleEvent?: (eventId: string) => void
}

export function PlannedTasksSidebar({
  mode,
  currentDate,
  onTaskClick,
  onUnscheduleTask,
  onUnscheduleEvent,
}: PlannedTasksSidebarProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const addTask = useTaskStore((s) => s.addTask)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const [showHabits, setShowHabits] = useState(true)
  const [showTodos, setShowTodos] = useState(true)
  const [newTodoText, setNewTodoText] = useState("")

  const monthKey = format(currentDate, "yyyy-MM")
  const weekKey = getWeekString(currentDate)
  const dayKey = formatLocalDateKey(currentDate)

  const plannedTasks = useMemo(() => {
    switch (mode) {
      case "month":
        return tasks.filter((t) => isMonthOnlyPlanned(t, monthKey))
      case "week":
        return tasks.filter((t) => isWeekOnlyPlanned(t, weekKey))
      case "day":
        return tasks.filter((t) => isDayUnscheduledPlanned(t, currentDate))
      default:
        return []
    }
  }, [tasks, mode, monthKey, weekKey, currentDate])

  const incompleteHabits = useMemo(() => {
    if (mode !== "day") return []
    return habitTasks.filter((habit: WeeklyTask) => {
      const c = weeklyData[dayKey]?.[habit.id]
      if (!c) return true
      switch (habit.type) {
        case TT.BOOLEAN:
          return !c.completed
        case TT.TIME:
        case TT.COUNT:
          return habit.goal ? (c.value ?? 0) < habit.goal : !c.value
        case TT.TEXT:
          return !c.text?.trim()
        case TT.INCREMENTAL:
          return !c.incrementalValues
        default:
          return false
      }
    })
  }, [mode, habitTasks, weeklyData, dayKey])

  const onTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    const eventId = e.dataTransfer.getData("eventId")
    if (taskId && onUnscheduleTask) onUnscheduleTask(taskId)
    else if (eventId && onUnscheduleEvent) onUnscheduleEvent(eventId)
  }

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault()
    const description = newTodoText.trim()
    if (!description) return
    addTask(createScheduledTodoTask({ description, period: "day", date: currentDate }))
    setNewTodoText("")
    setShowTodos(true)
  }

  const title =
    mode === "month" ? "Planned This Month" : mode === "week" ? "Planned This Week" : "Planned Today"

  const visibleTasks = showTodos ? plannedTasks : []
  const visibleHabits = showHabits ? incompleteHabits : []
  const totalCount = visibleTasks.length + visibleHabits.length

  return (
    <Card
      className="w-80 bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-black/80 border border-gray-700 shadow-2xl backdrop-blur-xl"
      onDragOver={mode === "day" ? onDragOver : undefined}
      onDrop={mode === "day" ? onDrop : undefined}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
          <Zap className="h-5 w-5 text-[#8cd4a5] animate-pulse" />
          {title}
          <Badge className="ml-auto bg-gradient-to-r from-[#8cd4a5] to-[#9fc2a5] text-black font-semibold">
            {totalCount}
          </Badge>
        </CardTitle>
        {mode === "day" && (
          <p className="text-xs text-gray-500 pt-1">Drop scheduled items here to unschedule</p>
        )}
        {mode === "day" && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant={showTodos ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setShowTodos((v) => !v)}
            >
              To Do ({plannedTasks.length})
            </Button>
            <Button
              size="sm"
              variant={showHabits ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setShowHabits((v) => !v)}
            >
              Habits ({incompleteHabits.length})
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-2">
          {visibleHabits.map((habit: WeeklyTask) => (
            <div
              key={habit.id}
              className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-900/40 to-gray-800/50 rounded-lg border border-purple-700/50"
            >
              <Target className="h-4 w-4 text-purple-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-200 truncate block">{habit.name}</span>
                <span className="text-xs text-purple-300/80">Daily habit</span>
              </div>
            </div>
          ))}

          {visibleTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-700/50 to-gray-800/50 rounded-lg cursor-move hover:from-[#8cd4a5]/20 hover:to-[#b89fbf]/20 border border-gray-600 hover:border-[#8cd4a5] transition-all duration-300"
              onClick={() => onTaskClick(task.id)}
              draggable
              onDragStart={(e) => onTaskDragStart(e, task.id)}
            >
              <GripVertical className="h-4 w-4 text-gray-400" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-200 truncate block">{task.description}</span>
                {task.context && <span className="text-xs text-gray-400 mt-1 block">{task.context}</span>}
              </div>
              {(task.estimatedDuration ?? 0) > 0 && (
                <Badge className="text-xs bg-gradient-to-r from-[#5f756d] to-[#adc29f] text-white border-none">
                  {task.estimatedDuration}m
                </Badge>
              )}
            </div>
          ))}

          {totalCount === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Zap className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <p className="text-sm">Nothing to plan here</p>
            </div>
          )}
        </div>
        {mode === "day" && (
          <form onSubmit={handleAddTodo} className="flex gap-2 pt-2 border-t border-gray-700">
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a to-do for this day…"
              aria-label="Add a to-do for this day"
              className="h-8 bg-gray-800/80 border-gray-600 text-gray-200 placeholder:text-gray-500"
            />
            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 shrink-0 bg-[#8cd4a5] text-black hover:bg-[#9fc2a5]"
              disabled={!newTodoText.trim()}
              aria-label="Add to-do"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
