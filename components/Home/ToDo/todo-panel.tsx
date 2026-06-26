/**
 * components/Home/ToDo/todo-panel.tsx — To-Do panel (orchestrator)
 *
 * The day/week/month to-do view. Groups items by tier (A+, A, A/B, B, C, D),
 * shows computed overdue indicators, and supports complete/edit/reschedule. Same
 * underlying records as the Scheduler's planned-tasks lists (spec §7.3).
 *
 * Composition:
 *   - todo-utils.ts     pure tier/Q-I/build/filter helpers
 *   - TodoTable.tsx     per-period table
 *   - AddTodoDialog.tsx the "Add Task" form
 *
 * Spec: §8.4 (To-Do panel). Carry-over (§7.7) not yet automated.
 */
"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Calendar, Clock, AlertTriangle, SlidersHorizontal, RotateCcw } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { completeTask } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/priority"
import { resolveCompletionPoints } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import { emitTaskCompleted } from "@/lib/completion-events"
import type { TodoItem, Task, PriorityWeights, CompletionStatus } from "@/lib/types"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import JustStartMode from "@/components/Focus/JustStartMode"
import { APP_NAV_KEYS, readStoredTab, writeStoredTab } from "@/lib/app-navigation"
import { effectiveStatus, withStatus } from "@/lib/completion-status"
import {
  buildTodoItems,
  buildDoneTodoItems,
  filterAndSortTodos,
  filterTodosByStatus,
  sortTodosByPriority,
  tierToUrgencyImportance,
  getTodoOpenTitle,
  getTodoDoneTitle,
  getMonthKey,
  TODO_STATUS_FILTERS,
  type TodoPeriod,
  type TodoSortMode,
  type TodoStatusFilter,
} from "./todo-utils"
import { TodoTable } from "./TodoTable"
import { AddTodoDialog, type NewTodoDraft } from "./AddTodoDialog"
import { TodoPeriodNav } from "./TodoPeriodNav"
import { DoneTodoSection } from "./DoneTodoSection"

const PRIORITY_WEIGHT_FIELDS: { key: keyof PriorityWeights; label: string; hint: string }[] = [
  { key: "urgency", label: "Urgency", hint: "Higher urgency ranks sooner" },
  { key: "importance", label: "Importance", hint: "Higher importance ranks sooner" },
  { key: "cognitiveLoad", label: "Quick win", hint: "Lower cognitive load ranks sooner" },
  { key: "entropy", label: "Entropy", hint: "Vaguer tasks surface for clarification" },
]

const TODO_TABS = ["day", "week", "month"] as const

export function TodoPanel() {
  const { tasks, updateTask, addTask } = useTaskStore()
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const priorityWeights = useTaskStore((s) => s.priorityWeights)
  const updatePriorityWeights = useTaskStore((s) => s.updatePriorityWeights)
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [justStartTaskId, setJustStartTaskId] = useState<string | null>(null)
  const [activeTodoTab, setActiveTodoTab] = useState<TodoPeriod>(() =>
    readStoredTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day"),
  )
  const [focusedDate, setFocusedDate] = useState(() => new Date())
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TodoStatusFilter>("open")
  const [sortMode, setSortMode] = useState<TodoSortMode>("tier")
  const [showFormula, setShowFormula] = useState(false)
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({})
  const [doneSectionsOpen, setDoneSectionsOpen] = useState<Record<TodoPeriod, boolean>>({
    day: false,
    week: false,
    month: false,
  })

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.homeTodoTab, activeTodoTab)
  }, [activeTodoTab])

  useEffect(() => {
    setTodoItems(buildTodoItems(tasks, showAllTasks, focusedDate))
  }, [tasks, showAllTasks, focusedDate])

  const filteredByPeriod = useMemo(() => {
    const order = (period: TodoPeriod) => {
      const base = filterAndSortTodos(todoItems, period, showAllTasks, focusedDate)
      const byStatus = filterTodosByStatus(base, tasks, statusFilter)
      return sortMode === "priority" ? sortTodosByPriority(byStatus, tasks, priorityWeights) : byStatus
    }
    return {
      day: order("day"),
      week: order("week"),
      month: order("month"),
    } satisfies Record<TodoPeriod, TodoItem[]>
  }, [todoItems, showAllTasks, statusFilter, sortMode, tasks, priorityWeights, focusedDate])

  const doneByPeriod = useMemo(
    () => ({
      day: buildDoneTodoItems(tasks, "day", focusedDate),
      week: buildDoneTodoItems(tasks, "week", focusedDate),
      month: buildDoneTodoItems(tasks, "month", focusedDate),
    }),
    [tasks, focusedDate],
  )

  const scheduleTaskForPeriod = (task: Task, period: TodoPeriod, refDate: Date) => {
    if (period === "day") {
      task.scheduledDate = toLocalCalendarDate(refDate)
    } else if (period === "week") {
      task.scheduledWeek = getWeekString(refDate)
    } else {
      task.scheduledMonth = getMonthKey(refDate)
    }
  }

  const handleAddTodo = (draft: NewTodoDraft) => {
    // Schedule to the active period at the currently-focused date. For week/month
    // this assigns the task to that week/month list without pinning a specific day.
    const refDate = toLocalCalendarDate(focusedDate)
    const { urgency, importance } = tierToUrgencyImportance(draft.tier)

    const task: Task = {
      id: `todo-${Date.now()}`,
      description: draft.description.trim(),
      stage: "clarified",
      createdAt: refDate,
      completed: false,
      lists: [],
      // Surface To-Do-created tasks in the Scheduler too (and keep them there if
      // later unscheduled). The Scheduler gate is list-based by default, so an
      // explicit task-level flag is required for tasks created without a list.
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
    }

    scheduleTaskForPeriod(task, activeTodoTab, refDate)
    addTask(task)
  }

  const handleAddDone = (description: string) => {
    const refDate = toLocalCalendarDate(focusedDate)
    // Stamp completion at noon of the focused day so it buckets into the period
    // the user is viewing (and reads naturally regardless of timezone).
    const completedAt = new Date(refDate)
    completedAt.setHours(12, 0, 0, 0)
    const id = `done-${Date.now()}`

    const task: Task = {
      id,
      description,
      stage: "completed",
      createdAt: refDate,
      completed: true,
      status: "done",
      completedDate: completedAt,
      lists: [],
      scheduleable: true,
      urgency: 3,
      importance: 3,
      estimatedDuration: 30,
      cognitiveLoad: 2,
      dependencies: [],
      context: "@general",
      entropy: 0.5,
      rewardValue: 1,
      allowPartialCompletion: false,
      minimumChunkSize: 15,
    }

    scheduleTaskForPeriod(task, activeTodoTab, refDate)
    addTask(task)

    const points = resolveCompletionPoints(task, categories, folders)
    if (points > 0) {
      usePointsStore.getState().addPoints(id, points, description, completedAt)
    }

    // Surface the completion popup so the user can attribute this logged win to
    // objectives/goals (or skip) — even though it was completed in the past.
    emitTaskCompleted({ taskId: id, basePoints: points, at: completedAt })

    setDoneSectionsOpen((prev) => ({ ...prev, [activeTodoTab]: true }))
  }

  const handleComplete = (todoId: string) => {
    setTodoItems((items) => items.map((item) => (item.id === todoId ? { ...item, completed: true } : item)))
    const todo = todoItems.find((item) => item.id === todoId)
    // The store stamps `completedDate` on this transition, so the row lands in
    // today's "Done" list no matter which day it was scheduled for.
    completeTask(todo?.taskId ?? todoId)
  }

  const handleTierChange = (todoId: string, tier: TodoItem["tier"]) => {
    setTodoItems((items) => items.map((item) => (item.id === todoId ? { ...item, tier } : item)))
    const todo = todoItems.find((item) => item.id === todoId)
    const task = tasks.find((t) => t.id === (todo?.taskId ?? todoId))
    if (task) updateTask({ ...task, ...tierToUrgencyImportance(tier) })
  }

  const handlePush = (todoId: string, period: TodoPeriod) => {
    pushTask(todoId, period)
  }

  const handleHide = (todoId: string) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    updateTask({ ...task, hiddenFromTodo: true })
  }

  const getStatus = (todoId: string): CompletionStatus => {
    const task = tasks.find((t) => t.id === todoId)
    return task ? effectiveStatus(task) : "active"
  }

  // Persist a richer completion status, keeping `completed` in sync via the
  // completion-status helpers (invariant: status "done" ⇔ completed true).
  const handleStatusChange = (todoId: string, status: CompletionStatus) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    // `withStatus` flips `completed`; the store stamps/clears `completedDate`.
    updateTask(withStatus(task, status))
  }

  const renderTab = (period: TodoPeriod, Icon: typeof Calendar) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {getTodoOpenTitle(period, focusedDate)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TodoPeriodNav period={period} focusedDate={focusedDate} onFocusedDateChange={setFocusedDate} />
        <TodoTable
          todos={filteredByPeriod[period]}
          period={period}
          isExpanded={!!expandedPeriods[period]}
          onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
          onComplete={handleComplete}
          onPush={handlePush}
          onHide={handleHide}
          onTaskClick={setSelectedTaskId}
          onTierChange={handleTierChange}
          onJustStart={setJustStartTaskId}
          getStatus={getStatus}
          onStatusChange={handleStatusChange}
        />
        <DoneTodoSection
          title={getTodoDoneTitle(period, focusedDate)}
          todos={doneByPeriod[period]}
          tasks={tasks}
          period={period}
          open={doneSectionsOpen[period]}
          onOpenChange={(open) => setDoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
          onTaskClick={setSelectedTaskId}
          onAddDone={handleAddDone}
        />
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">To Do</h2>
          <p className="text-muted-foreground">Tier-based task management with overdue tracking</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium leading-none">Sort</Label>
            <div className="flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setSortMode("tier")}
                className={`px-3 py-1 text-sm ${sortMode === "tier" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                Tier
              </button>
              <button
                type="button"
                onClick={() => setSortMode("priority")}
                className={`px-3 py-1 text-sm border-l ${sortMode === "priority" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                Priority
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="View / reweight the priority formula"
              onClick={() => setShowFormula((v) => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm font-medium leading-none">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TodoStatusFilter)}>
              <SelectTrigger id="status-filter" className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TODO_STATUS_FILTERS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label htmlFor="show-all-tasks" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
            Show All Tasks
          </Label>
          <Switch id="show-all-tasks" checked={showAllTasks} onCheckedChange={(checked) => setShowAllTasks(checked)} />
          <AddTodoDialog onAdd={handleAddTodo} />
        </div>
      </div>

      {showFormula && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Priority formula
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => updatePriorityWeights({ ...DEFAULT_PRIORITY_WEIGHTS })}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              score = w·urgency + w·importance + w·(quick win) + w·entropy. Set a weight to 0 to ignore that signal.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {PRIORITY_WEIGHT_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`pw-${key}`} className="text-sm">
                    {label}
                  </Label>
                  <Input
                    id={`pw-${key}`}
                    type="number"
                    min="0"
                    step="0.25"
                    value={priorityWeights[key]}
                    onChange={(e) => {
                      const n = Number.parseFloat(e.target.value)
                      updatePriorityWeights({
                        ...priorityWeights,
                        [key]: Number.isFinite(n) && n >= 0 ? n : 0,
                      })
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTodoTab} className="w-full" onValueChange={(v) => setActiveTodoTab(v as TodoPeriod)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>

        <TabsContent value="day" className="mt-6">
          {renderTab("day", Calendar)}
        </TabsContent>
        <TabsContent value="week" className="mt-6">
          {renderTab("week", Clock)}
        </TabsContent>
        <TabsContent value="month" className="mt-6">
          {renderTab("month", AlertTriangle)}
        </TabsContent>
      </Tabs>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />

      {justStartTaskId && (
        <JustStartMode taskId={justStartTaskId} onClose={() => setJustStartTaskId(null)} />
      )}
    </div>
  )
}
