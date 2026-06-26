/**
 * components/Reviews/DayReviewTomorrowSection.tsx — Plan tomorrow during day review
 *
 * Shown at the end of the day review ritual: tomorrow's written plan (editable,
 * persisted via lib/plan-text.ts) and tomorrow's to-do list with search-to-schedule
 * and create-new affordances.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, X } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import type { Task, TodoItem } from "@/lib/types"
import { taskScheduledOnDay, toLocalCalendarDate } from "@/lib/date-utils"
import { searchItems } from "@/lib/search"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { dateFromPeriodKey, localDayKey, nextPeriodDate, periodLabel } from "@/lib/reviews-store"
import {
  buildTodoItems,
  filterAndSortTodos,
  getTierColor,
  tierToUrgencyImportance,
} from "@/components/Home/ToDo/todo-utils"

export function DayReviewTomorrowSection({ reviewedDayKey }: { reviewedDayKey: string }) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)

  const tomorrowDate = useMemo(
    () => nextPeriodDate("day", dateFromPeriodKey("day", reviewedDayKey)),
    [reviewedDayKey],
  )
  const tomorrowKey = localDayKey(tomorrowDate)

  const [planText, setPlanText] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [newDescription, setNewDescription] = useState("")
  const [newTier, setNewTier] = useState<TodoItem["tier"]>("A")
  const [showNewForm, setShowNewForm] = useState(false)

  useEffect(() => {
    setPlanText(getStoredPlanText("day", tomorrowKey) ?? "")
  }, [tomorrowKey])

  const tomorrowTodos = useMemo(() => {
    const items = buildTodoItems(tasks, false, tomorrowDate)
    return filterAndSortTodos(items, "day", false, tomorrowDate)
  }, [tasks, tomorrowDate])

  const tomorrowTaskIds = useMemo(() => new Set(tomorrowTodos.map((t) => t.taskId ?? t.id)), [tomorrowTodos])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return []
    return searchItems(q, tasks, { limit: 8, titleOnly: true })
      .map((r) => r.item as Task)
      .filter((t) => !t.completed && !tomorrowTaskIds.has(t.id))
  }, [searchQuery, tasks, tomorrowTaskIds])

  const handlePlanChange = (value: string) => {
    setPlanText(value)
    saveStoredPlanText("day", tomorrowKey, value)
  }

  const scheduleForTomorrow = (task: Task) => {
    updateTask({
      ...task,
      scheduledDate: toLocalCalendarDate(tomorrowDate),
      scheduledWeek: undefined,
      scheduledMonth: undefined,
      scheduledYear: undefined,
      scheduledTime: undefined,
    })
    setSearchQuery("")
    setSearchFocused(false)
  }

  const unscheduleFromTomorrow = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({
      ...task,
      scheduledDate: undefined,
    })
  }

  const handleCreateTask = () => {
    const description = newDescription.trim()
    if (!description) return
    const { urgency, importance } = tierToUrgencyImportance(newTier)
    const refDate = toLocalCalendarDate(tomorrowDate)

    const task: Task = {
      id: `todo-${Date.now()}`,
      description,
      stage: "clarified",
      createdAt: refDate,
      completed: false,
      lists: [],
      scheduleable: true,
      urgency,
      importance,
      estimatedDuration: 30,
      cognitiveLoad: 2,
      dependencies: [],
      context: "@general",
      entropy: 0.5,
      rewardValue: 1,
      allowPartialCompletion: false,
      minimumChunkSize: 15,
      scheduledDate: refDate,
    }

    addTask(task)
    setNewDescription("")
    setNewTier("A")
    setShowNewForm(false)
  }

  return (
    <section className="space-y-4">
      <div>
        <Label className="font-semibold text-sm">Tomorrow&apos;s plan</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{periodLabel("day", tomorrowKey)}</p>
      </div>

      <Textarea
        value={planText}
        onChange={(e) => handlePlanChange(e.target.value)}
        rows={4}
        placeholder="What matters most tomorrow?"
        data-testid="tomorrow-plan-text"
      />

      <div className="space-y-2">
        <Label className="font-semibold text-sm">Tomorrow&apos;s to-do ({tomorrowTodos.length})</Label>

        {tomorrowTodos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks scheduled yet.</p>
        ) : (
          <div className="space-y-1">
            {tomorrowTodos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-center gap-2 border rounded-md p-2 text-sm"
                data-testid={`tomorrow-todo-${todo.id}`}
              >
                <Badge variant="outline" className={`shrink-0 text-xs ${getTierColor(todo.tier)}`}>
                  {todo.tier}
                </Badge>
                <span className="truncate flex-1">{todo.description}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Remove ${todo.description} from tomorrow`}
                  onClick={() => unscheduleFromTomorrow(todo.taskId ?? todo.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search existing tasks to add…"
                className="pl-8"
                data-testid="tomorrow-task-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setShowNewForm((v) => !v)}
              data-testid="tomorrow-new-task-toggle"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>

          {searchFocused && searchResults.length > 0 && (
            <div
              className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto"
              data-testid="tomorrow-search-results"
            >
              {searchResults.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted truncate"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => scheduleForTomorrow(task)}
                >
                  {task.description}
                  {!taskScheduledOnDay(task, tomorrowDate) && task.scheduledDate && (
                    <span className="text-xs text-muted-foreground ml-2">(reschedule)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {showNewForm && (
          <div className="border rounded-md p-3 space-y-3" data-testid="tomorrow-new-task-form">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="New task description"
              data-testid="tomorrow-new-task-description"
            />
            <div className="flex gap-2">
              <Select value={newTier} onValueChange={(v) => setNewTier(v as TodoItem["tier"])}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+ (Critical)</SelectItem>
                  <SelectItem value="A">A (High)</SelectItem>
                  <SelectItem value="A/B">A/B (Medium-High)</SelectItem>
                  <SelectItem value="B">B (Medium)</SelectItem>
                  <SelectItem value="C">C (Low)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateTask} disabled={!newDescription.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
