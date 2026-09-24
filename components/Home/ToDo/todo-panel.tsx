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
 *   - todo-desk-plate   the title jewel at photograph size, on the desktop under the window
 *
 * Spec: §8.4 (To-Do panel). Carry-over (§7.7) not yet automated.
 */
"use client"

import { useMemo, useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { orbFor } from "@/components/Icons"
import { useTaskStore } from "@/lib/task-store"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { completeTask, markMissedOpportunity } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/priority"
import { resolveCompletionPoints } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import { emitTaskCompleted } from "@/lib/completion-events"
import { completionWindow } from "@/lib/completion-window"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { formatLocalDateKey } from "@/lib/date-utils"
import { makeEstimate } from "@/lib/estimated-values"
import { confirmTaskTimes, type ConfirmedTimes } from "@/lib/services/completion-time-service"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import type { TodoItem, Task, PriorityWeights, CompletionStatus } from "@/lib/types"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import JustStartMode from "@/components/Focus/JustStartMode"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { effectiveStatus, withStatus } from "@/lib/completion-status"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  buildTodoItems,
  buildDoneTodoItems,
  buildMissedTodoItems,
  filterAndSortTodos,
  filterTodosByStatus,
  filterTodosAvailableNow,
  countInProgress,
  formatWipWarning,
  sortTodos,
  tierToUrgencyImportance,
  getTodoOpenTitle,
  getTodoDoneTitle,
  getTodoMissedTitle,
  getPeriodNavLabel,
  getMonthKey,
  createScheduledTodoTask,
  DEFAULT_TODO_SORT_ORDER,
  type TodoPeriod,
  type TodoSortMode,
  type TodoSortOrder,
  type TodoStatusFilter,
} from "./todo-utils"
import { TodoTable } from "./TodoTable"
import { AddTodoDialog, type NewTodoDraft } from "./AddTodoDialog"
import { TodoPeriodNav } from "./TodoPeriodNav"
import { DoneTodoSection } from "./DoneTodoSection"
import { MissedTodoSection } from "./MissedTodoSection"
import { TodoFilters } from "./todo-filters"
import { useTodoPrefs, setTodoPrefs } from "./todo-prefs"
import "./todo-chrome.css"

const PRIORITY_WEIGHT_FIELDS: { key: keyof PriorityWeights; label: string; hint: string }[] = [
  { key: "urgency", label: "Urgency", hint: "Higher urgency ranks sooner" },
  { key: "importance", label: "Importance", hint: "Higher importance ranks sooner" },
  { key: "cognitiveLoad", label: "Quick win", hint: "Lower cognitive load ranks sooner" },
  { key: "entropy", label: "Entropy", hint: "Vaguer tasks surface for clarification" },
]

const TODO_TABS = ["day", "week", "month"] as const

/** Assumed length for work logged after the fact, until the user says otherwise. */
const DEFAULT_LOGGED_DONE_MINUTES = 30

/** Stable empty snapshot for Zustand — `?? []` would allocate every getSnapshot and loop. */
const EMPTY_PRIORITY_IDS: string[] = []

export function TodoPanel() {
  usePenActionSync()
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const priorityWeights = useTaskStore((s) => s.priorityWeights)
  const updatePriorityWeights = useTaskStore((s) => s.updatePriorityWeights)
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [justStartTaskId, setJustStartTaskId] = useState<string | null>(null)
  const [activeTodoTab, setActiveTodoTab] = usePersistedTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day")
  const [focusedDate, setFocusedDate] = useState(() => new Date())
  const { availableNow, wipLimit } = useTodoPrefs()
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TodoStatusFilter>("open")
  const [sortMode, setSortMode] = useState<TodoSortMode>("tier")
  const [sortOrder, setSortOrder] = useState<TodoSortOrder>(DEFAULT_TODO_SORT_ORDER.tier)
  const [showFormula, setShowFormula] = useState(false)
  const [expandedPeriods, setExpandedPeriods] = useState<Record<string, boolean>>({})
  const [doneSectionsOpen, setDoneSectionsOpen] = useState<Record<TodoPeriod, boolean>>({
    day: false,
    week: false,
    month: false,
  })
  const [missedSectionsOpen, setMissedSectionsOpen] = useState<Record<TodoPeriod, boolean>>({
    day: false,
    week: false,
    month: false,
  })

  const focusedDayKey = localDayKey(focusedDate)
  const morningPriorities = useReviewsStore(
    (s) => s.getMorningReview(focusedDayKey)?.priorityTaskIds ?? EMPTY_PRIORITY_IDS,
  )

  useEffect(() => {
    setTodoItems(buildTodoItems(tasks, showAllTasks, focusedDate))
  }, [tasks, showAllTasks, focusedDate])

  const filteredByPeriod = useMemo(() => {
    const order = (period: TodoPeriod) => {
      const base = filterAndSortTodos(todoItems, period, showAllTasks, focusedDate)
      const byStatus = filterTodosByStatus(base, tasks, statusFilter)
      const available = filterTodosAvailableNow(byStatus, tasks, availableNow)
      return sortTodos(available, {
        mode: sortMode,
        order: sortOrder,
        period,
        tasks,
        weights: priorityWeights,
      })
    }
    return {
      day: order("day"),
      week: order("week"),
      month: order("month"),
    } satisfies Record<TodoPeriod, TodoItem[]>
  }, [todoItems, showAllTasks, statusFilter, availableNow, sortMode, sortOrder, tasks, priorityWeights, focusedDate])

  const wipWarning = formatWipWarning(countInProgress(tasks), wipLimit)

  const doneByPeriod = useMemo(
    () => ({
      day: buildDoneTodoItems(tasks, "day", focusedDate, folders),
      week: buildDoneTodoItems(tasks, "week", focusedDate, folders),
      month: buildDoneTodoItems(tasks, "month", focusedDate, folders),
    }),
    [tasks, focusedDate, folders],
  )

  const missedByPeriod = useMemo(
    () => ({
      day: buildMissedTodoItems(tasks, "day", focusedDate),
      week: buildMissedTodoItems(tasks, "week", focusedDate),
      month: buildMissedTodoItems(tasks, "month", focusedDate),
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
    // Same factory the Plan day sidebar uses — one task record, both views.
    addTask(
      createScheduledTodoTask({
        description: draft.description,
        tier: draft.tier,
        period: activeTodoTab,
        date: focusedDate,
      }),
    )
  }

  const handleAddDone = (description: string) => {
    const refDate = toLocalCalendarDate(focusedDate)
    // Retroactive capture knows the day but not the hour, so derive a plausible
    // window (just now for today, otherwise that night's bedtime or the day
    // anchor) and flag it — an assumed time the user can settle later beats a
    // silent midday stamp.
    const window = completionWindow({
      date: refDate,
      durationMinutes: DEFAULT_LOGGED_DONE_MINUTES,
      anchorMinutes: useUserSettingsStore.getState().dayAnchorMinutes,
      awake: awakeWindowFor(formatLocalDateKey(refDate)),
    })
    const completedAt = window.completedAt
    const id = `done-${Date.now()}`

    const task: Task = {
      id,
      description,
      stage: "completed",
      createdAt: refDate,
      completed: true,
      status: "done",
      completedDate: completedAt,
      startedAt: window.startedAt,
      actualDuration: DEFAULT_LOGGED_DONE_MINUTES,
      estimates: [
        ...window.estimatedFields.map((field) => makeEstimate(field, window.kind, window.basis)),
        makeEstimate(
          "actualDuration",
          "flat",
          `${DEFAULT_LOGGED_DONE_MINUTES}m assumed for work logged after the fact`,
        ),
      ],
      lists: [],
      scheduleable: true,
      urgency: 3,
      importance: 3,
      estimatedDuration: DEFAULT_LOGGED_DONE_MINUTES,
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

  // Settle an autogenerated time from the Done row's "est." chip. A correction is
  // confirmed too, so the habit sync stops re-deriving over the user's number.
  const handleConfirmTimes = (taskId: string, values: ConfirmedTimes) => {
    confirmTaskTimes(taskId, values)
  }

  const handleComplete = (todoId: string) => {
    setTodoItems((items) => items.map((item) => (item.id === todoId ? { ...item, completed: true } : item)))
    const todo = todoItems.find((item) => item.id === todoId)
    // The store stamps `completedDate` on this transition, so the row lands in
    // today's "Done" list no matter which day it was scheduled for.
    completeTask(todo?.taskId ?? todoId)
  }

  const handleMissed = (todoId: string) => {
    setTodoItems((items) => items.filter((item) => item.id !== todoId))
    const todo = todoItems.find((item) => item.id === todoId)
    markMissedOpportunity(todo?.taskId ?? todoId)
    setMissedSectionsOpen((prev) => ({ ...prev, [activeTodoTab]: true }))
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

  const renderTab = (period: TodoPeriod) => (
    <div className="todo-sheet">
      <h3 className="todo-sheet-title">{getTodoOpenTitle(period, focusedDate)}</h3>
      {period === "day" && morningPriorities.length > 0 && (
        <div className="todo-morning-priorities mb-3 rounded-md border border-dashed p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Morning priorities
          </p>
          <ol className="list-decimal pl-5 text-sm space-y-0.5">
            {morningPriorities.map((id) => {
              const task = tasks.find((t) => t.id === id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => setSelectedTaskId(id)}
                  >
                    {task ? itemTitleOrUntitled(task) : id}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      )}
      <TodoTable
        todos={filteredByPeriod[period]}
        period={period}
        isExpanded={!!expandedPeriods[period]}
        onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
        onComplete={handleComplete}
        onMissed={handleMissed}
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
        onConfirmTimes={handleConfirmTimes}
      />
      <MissedTodoSection
        title={getTodoMissedTitle(period, focusedDate)}
        todos={missedByPeriod[period]}
        tasks={tasks}
        period={period}
        open={missedSectionsOpen[period]}
        onOpenChange={(open) => setMissedSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={setSelectedTaskId}
      />
    </div>
  )

  const periodLabel = activeTodoTab === "day" ? "Day view" : activeTodoTab === "week" ? "Week view" : "Month view"
  const openCount = filteredByPeriod[activeTodoTab].length

  return (
    <div
      className="todo95"
      data-ui-name="To Do"
      data-ui-help="Day, week, and month tasks with filters, Done, and missed opportunities."
      data-ui-docs="components/Home/ToDo/README.md"
    >
      <div className="todo-window">
        <Tabs
          value={activeTodoTab}
          className="flex min-h-0 flex-1 flex-col"
          onValueChange={(v) => setActiveTodoTab(v as TodoPeriod)}
        >
          <div className="todo-fascia">
            <div className="todo-fascia-row">
              <div className="todo-mark">
                <img src={orbFor("home-todo")} alt="" className="todo-title-orb" />
                <h2>To Do</h2>
                <span className="todo-mark-count">{openCount}</span>
              </div>
              <TodoPeriodNav period={activeTodoTab} focusedDate={focusedDate} onFocusedDateChange={setFocusedDate} />
              <AddTodoDialog onAdd={handleAddTodo} />
              <TabsList className="todo-view-keys">
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </div>
            <TodoFilters
              period={activeTodoTab}
              availableNow={availableNow}
              onAvailableNowChange={(value) => setTodoPrefs({ availableNow: value })}
              showAllTasks={showAllTasks}
              onShowAllTasksChange={setShowAllTasks}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortMode={sortMode}
              onSortModeChange={(mode) => {
                setSortMode(mode)
                setSortOrder(DEFAULT_TODO_SORT_ORDER[mode])
              }}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              onToggleFormula={() => setShowFormula((v) => !v)}
              wipLimit={wipLimit}
              onWipLimitChange={(value) => setTodoPrefs({ wipLimit: value })}
            />
          </div>

          {wipWarning && (
            <p className="todo-wip" role="status">
              {wipWarning}
            </p>
          )}

          {showFormula && (
            <div className="todo-formula">
              <div className="todo-formula-head">
                <div>
                  <h3>Priority formula</h3>
                  <p className="todo-hint">
                    score = w·urgency + w·importance + w·(quick win) + w·entropy. Set a weight to 0 to ignore that
                    signal.
                  </p>
                </div>
                <button
                  type="button"
                  className="todo-btn"
                  onClick={() => updatePriorityWeights({ ...DEFAULT_PRIORITY_WEIGHTS })}
                >
                  Reset
                </button>
              </div>
              <div className="todo-formula-grid">
                {PRIORITY_WEIGHT_FIELDS.map(({ key, label, hint }) => (
                  <label key={key}>
                    <div className="todo-label">{label}</div>
                    <input
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
                    <p className="todo-hint">{hint}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="todo-body">
            <TabsContent value="day">{renderTab("day")}</TabsContent>
            <TabsContent value="week">{renderTab("week")}</TabsContent>
            <TabsContent value="month">{renderTab("month")}</TabsContent>
          </div>
        </Tabs>

        <div className="todo-status">
          <span>
            {periodLabel} · {getPeriodNavLabel(activeTodoTab, focusedDate)}
          </span>
          <span className="todo-status-count">{openCount} open</span>
        </div>
      </div>

      <div className="todo-desk-plate" data-desk-plate="todo" aria-hidden="true">
        <img src={orbFor("home-todo")} alt="" draggable={false} />
      </div>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />

      {justStartTaskId && (
        <JustStartMode taskId={justStartTaskId} onClose={() => setJustStartTaskId(null)} />
      )}
    </div>
  )
}
