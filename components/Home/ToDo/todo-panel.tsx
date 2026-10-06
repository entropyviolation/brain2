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
 *   - todo-desk-plate   the title jewel at photograph size under the window
 *
 * Spec: §8.4 (To-Do panel). Past periods also list Undone — scheduled then
 * not finished — with assimilate / push / discard.
 *
 * The day lens reads Home's selected day (`currentDate` / `setCurrentDate`).
 * Week, month, and season nameplates keep a local date and do not move that
 * cursor. Until a coarse nameplate is used, it shows the period that contains
 * the shared day.
 */
"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { orbFor } from "@/components/Icons"
import { useTaskStore } from "@/lib/task-store"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { quarterKey, quarterLabel, quarterStartDate, seasonSlug, seasonOfDate, shiftQuarter, taskTouchesQuarter } from "@/lib/seasons"
import { completeTask, markMissedOpportunity } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { assimilateUndoneFields, discardUndoneFields, pushUndoneFields } from "@/lib/scheduling"
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
import type { TodoItem, Task, PriorityWeights, CompletionStatus, Subtask } from "@/lib/types"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import JustStartMode from "@/components/Focus/JustStartMode"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { openPeriodTodoList, periodTodoListName } from "@/lib/scheduled-lists-sync"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { effectiveStatus, isOpen, withStatus } from "@/lib/completion-status"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  buildTodoItems,
  buildDoneTodoItems,
  buildMissedTodoItems,
  buildUndoneTodoItems,
  filterAndSortTodos,
  filterTodosByStatus,
  filterTodosAvailableNow,
  countInProgress,
  formatWipWarning,
  sortTodos,
  pinPrioritizedFirst,
  tierToUrgencyImportance,
  getTodoOpenTitle,
  getTodoDoneTitle,
  getTodoMissedTitle,
  getPeriodNavLabel,
  getMonthKey,
  todoPeriodValue,
  isPastTodoPeriod,
  undonePushTitle,
  createScheduledTodoTask,
  DEFAULT_TODO_SORT_ORDER,
  type TodoPeriod,
  type TodoSortMode,
  type TodoSortOrder,
  type TodoStatusFilter,
} from "./todo-utils"
import { TodoTable } from "./TodoTable"
import { TodoLoadPanel } from "./TodoLoadPanel"
import { AddTodoDialog, type NewTodoDraft } from "./AddTodoDialog"
import { TodoPeriodNav } from "./TodoPeriodNav"
import { DoneTodoSection } from "./DoneTodoSection"
import { MissedTodoSection } from "./MissedTodoSection"
import { UndoneTodoSection } from "./UndoneTodoSection"
import { TodoFilters } from "./todo-filters"
import { useTodoPrefs, setTodoPrefs } from "./todo-prefs"
import {
  comfortBand,
  comfortRatio,
  daysLeftLabel,
  formatComfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
  nextPriorityIds,
  patchTodoCommitment,
  splitByCommitment,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
  hoursLeftInPeriod,
  workingHoursLeft,
  type EstimateScope,
} from "@/lib/todo-commitment"
import { flattenSteps, taskMatchesAssignedQuery, effectiveDurationMinutes } from "@/lib/todo-steps"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection } from "./TodoBreakdown"
import "./todo-chrome.css"

const PRIORITY_WEIGHT_FIELDS: { key: keyof PriorityWeights; label: string; hint: string }[] = [
  { key: "urgency", label: "Urgency", hint: "Higher urgency ranks sooner" },
  { key: "importance", label: "Importance", hint: "Higher importance ranks sooner" },
  { key: "cognitiveLoad", label: "Quick win", hint: "Lower cognitive load ranks sooner" },
  { key: "entropy", label: "Entropy", hint: "Vaguer tasks surface for clarification" },
]

const TODO_TABS = ["day", "week", "month", "quarter"] as const
type TodoTab = (typeof TODO_TABS)[number]

/** Assumed length for work logged after the fact, until the user says otherwise. */
const DEFAULT_LOGGED_DONE_MINUTES = 30

/** Stable empty snapshot for Zustand — `?? []` would allocate every getSnapshot and loop. */
const EMPTY_PRIORITY_IDS: string[] = []

export function TodoPanel({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  usePenActionSync()
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const addTask = useTaskStore((s) => s.addTask)
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const priorityWeights = useTaskStore((s) => s.priorityWeights)
  const updatePriorityWeights = useTaskStore((s) => s.updatePriorityWeights)
  const [todoItems, setTodoItems] = useState<TodoItem[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [justStartTaskId, setJustStartTaskId] = useState<string | null>(null)
  const [activeTodoTab, setActiveTodoTab] = usePersistedTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day")
  // Uncontrolled fallback for unit tests. The day sheet reads the prop itself
  // when Home passes one, so midnight catch-up is not a copy taken at mount.
  const [internalDate, setInternalDate] = useState(new Date())
  const currentDate = controlledDate ?? internalDate
  const setCurrentDate = setControlledDate ?? setInternalDate
  // Unset until that nameplate is used. A later shared-day change must not
  // overwrite a week, month, or season the user has already paged.
  const [weekDate, setWeekDate] = useState<Date | null>(null)
  const [monthDate, setMonthDate] = useState<Date | null>(null)
  const [seasonDate, setSeasonDate] = useState<Date | null>(null)
  const focusedDate =
    activeTodoTab === "week"
      ? (weekDate ?? currentDate)
      : activeTodoTab === "month"
        ? (monthDate ?? currentDate)
        : activeTodoTab === "quarter"
          ? (seasonDate ?? currentDate)
          : currentDate
  const setFocusedDate = (date: Date) => {
    if (activeTodoTab === "week") setWeekDate(date)
    else if (activeTodoTab === "month") setMonthDate(date)
    else if (activeTodoTab === "quarter") setSeasonDate(date)
    else setCurrentDate(date)
  }
  const { availableNow, wipLimit } = useTodoPrefs()
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TodoStatusFilter>("open")
  const [sortMode, setSortMode] = useState<TodoSortMode>("priority")
  const [sortOrder, setSortOrder] = useState<TodoSortOrder>(DEFAULT_TODO_SORT_ORDER.priority)
  const [showFormula, setShowFormula] = useState(false)
  const [estimateScope, setEstimateScope] = useState<EstimateScope>("all")
  const [assignedQuery, setAssignedQuery] = useState("")
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
  const [undoneSectionsOpen, setUndoneSectionsOpen] = useState<Record<TodoPeriod, boolean>>({
    day: true,
    week: true,
    month: true,
  })
  const [openRowId, setOpenRowId] = useState<string | null>(null)
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [flockingId, setFlockingId] = useState<string | null>(null)
  const [composerName, setComposerName] = useState("")
  const [composerTier, setComposerTier] = useState<TodoItem["tier"]>("A")
  const [periodFolding, setPeriodFolding] = useState(false)
  const sheetScrollRef = useRef<HTMLDivElement | null>(null)

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

  const undoneByPeriod = useMemo(
    () => ({
      day: buildUndoneTodoItems(tasks, "day", focusedDate),
      week: buildUndoneTodoItems(tasks, "week", focusedDate),
      month: buildUndoneTodoItems(tasks, "month", focusedDate),
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
    // A season todo lands on the first month of the quarter so it shows in that season.
    addTask(
      createScheduledTodoTask({
        description: draft.description,
        tier: draft.tier,
        period: activeTodoTab === "quarter" ? "month" : activeTodoTab,
        date: activeTodoTab === "quarter" ? quarterStartDate(focusedDate) : focusedDate,
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

    const loggedPeriod: TodoPeriod = activeTodoTab === "quarter" ? "month" : activeTodoTab
    const loggedDate = activeTodoTab === "quarter" ? quarterStartDate(focusedDate) : refDate
    scheduleTaskForPeriod(task, loggedPeriod, loggedDate)
    addTask(task)

    const points = resolveCompletionPoints(task, categories, folders)
    if (points > 0) {
      usePointsStore.getState().addPoints(id, points, description, completedAt)
    }

    // Surface the completion popup so the user can attribute this logged win to
    // objectives/goals (or skip) — even though it was completed in the past.
    emitTaskCompleted({ taskId: id, basePoints: points, at: completedAt })

    setDoneSectionsOpen((prev) => ({ ...prev, [loggedPeriod]: true }))
  }

  // Settle an autogenerated time from the Done row's "est." chip. A correction is
  // confirmed too, so the habit sync stops re-deriving over the user's number.
  const handleConfirmTimes = (taskId: string, values: ConfirmedTimes) => {
    confirmTaskTimes(taskId, values)
  }

  const prefersReduced = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }, [])

  const handleComplete = (todoId: string) => {
    const finish = () => {
      setTodoItems((items) => items.map((item) => (item.id === todoId ? { ...item, completed: true } : item)))
      const todo = todoItems.find((item) => item.id === todoId)
      // The store stamps `completedDate` on this transition, so the row lands in
      // today's "Done" list no matter which day it was scheduled for.
      completeTask(todo?.taskId ?? todoId)
      setOpenRowId((id) => (id === todoId ? null : id))
      setFlockingId(null)
    }
    if (prefersReduced()) {
      finish()
      return
    }
    setFlockingId(todoId)
    window.setTimeout(finish, 380)
  }

  const handleRename = (todoId: string, description: string) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    updateTask({ ...task, description })
  }

  const handleMissed = (todoId: string) => {
    setTodoItems((items) => items.filter((item) => item.id !== todoId))
    const todo = todoItems.find((item) => item.id === todoId)
    markMissedOpportunity(todo?.taskId ?? todoId)
    if (activeTodoTab !== "quarter") {
      setMissedSectionsOpen((prev) => ({ ...prev, [activeTodoTab]: true }))
    }
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

  const handleDelete = (todoId: string) => {
    deleteTask(todoId)
  }

  const handleEstimate = (todoId: string, minutes: number | undefined) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    updateTask({ ...task, estimatedDuration: minutes })
  }

  const handleSteps = (todoId: string, subtasks: Subtask[]) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    updateTask({ ...task, subtasks })
  }

  const resolveUndone = (taskId: string, period: TodoPeriod, action: "assimilate" | "push" | "discard") => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const value = todoPeriodValue(period, focusedDate)
    const patch =
      action === "assimilate"
        ? assimilateUndoneFields(task, period, value)
        : action === "push"
          ? pushUndoneFields(task, period, value, focusedDate)
          : discardUndoneFields(task, period, value)
    updateTask({ ...task, ...patch })
  }

  const getStatus = (todoId: string): CompletionStatus => {
    const task = tasks.find((t) => t.id === todoId)
    return task ? effectiveStatus(task) : "active"
  }

  // Persist a richer completion status, keeping `completed` in sync via the
  // completion-status helpers (invariant: status "done" ⇔ completed true).
  const handleCommitment = (todoId: string, period: "day" | "week" | "month" | "quarter", flag: "required" | "prioritized") => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    const key = todoPeriodKey(period, focusedDate)
    const ritualIds = period === "day" ? morningPriorities : undefined
    const on =
      flag === "required"
        ? !taskIsRequired(task, period, key)
        : !taskIsPrioritized(task, period, key, ritualIds)
    updateTask(patchTodoCommitment(task, period, key, { [flag]: on }))
    if (period !== "day" || flag !== "prioritized") return
    const morning = useReviewsStore.getState().getMorningReview(key)
    if (!morning) return
    const priorityTaskIds = nextPriorityIds(morning.priorityTaskIds, todoId, on)
    if (!priorityTaskIds) return
    useReviewsStore.getState().saveMorningReview(key, { priorityTaskIds })
  }

  const handleStatusChange = (todoId: string, status: CompletionStatus) => {
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    // `withStatus` flips `completed`; the store stamps/clears `completedDate`.
    updateTask(withStatus(task, status))
  }

  const renderTab = (period: TodoPeriod) => {
    const past = isPastTodoPeriod(period, focusedDate)
    const undoneIds = new Set(undoneByPeriod[period].map((todo) => todo.taskId ?? todo.id))
    const openTodos = past
      ? filteredByPeriod[period].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id))
      : filteredByPeriod[period]
    const periodKey = todoPeriodKey(period, focusedDate)
    const ritualIds = period === "day" ? morningPriorities : undefined
    const taskFor = (todoId: string) => tasks.find((task) => task.id === todoId)
    const requiredOf = (todoId: string) => {
      const task = taskFor(todoId)
      return !!task && taskIsRequired(task, period, periodKey)
    }
    const prioritizedOf = (todoId: string) => {
      const task = taskFor(todoId)
      return !!task && taskIsPrioritized(task, period, periodKey, ritualIds)
    }
    const { required, assigned } = splitByCommitment(openTodos, (todo) => requiredOf(todo.taskId ?? todo.id))
    const assignedPinned = pinPrioritizedFirst(assigned, (todo) => prioritizedOf(todo.taskId ?? todo.id))
    const visibleAssigned = assignedPinned.filter((todo) => {
      const task = taskFor(todo.taskId ?? todo.id)
      return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, assignedQuery)
    })
    const estimate = summedEstimate(openTodos, tasks, period, periodKey, estimateScope, ritualIds)
    const hours = workingHoursLeft(period, focusedDate)
    const clockHours = hoursLeftInPeriod(period, focusedDate)
    const ratio = comfortRatio(estimate.minutes, hours)
    const band = comfortBand(ratio)
    const tableProps = {
      period,
      onComplete: handleComplete,
      onMissed: handleMissed,
      onPush: handlePush,
      onDelete: handleDelete,
      onEstimateChange: handleEstimate,
      onStepsChange: handleSteps,
      stepsOf: (todoId: string) => taskFor(todoId)?.subtasks,
      estimateOf: (todoId: string) => taskFor(todoId)?.estimatedDuration,
      onTaskClick: setSelectedTaskId,
      onTierChange: handleTierChange,
      onJustStart: setJustStartTaskId,
      getStatus,
      onStatusChange: handleStatusChange,
      isRequired: requiredOf,
      isPrioritized: prioritizedOf,
      onToggleRequired: (todoId: string) => handleCommitment(todoId, period, "required"),
      onTogglePrioritized: (todoId: string) => handleCommitment(todoId, period, "prioritized"),
      onRename: handleRename,
      openRowId,
      onOpenRowIdChange: setOpenRowId,
      selectedRowId,
      onSelectedRowIdChange: setSelectedRowId,
      flockingId,
    }
    const inProgress = countInProgress(tasks)
    const openUnestimated = () => {
      const target = [...required, ...visibleAssigned].find((todo) => {
        const task = taskFor(todo.taskId ?? todo.id)
        if (!task) return false
        return !(effectiveDurationMinutes(task.estimatedDuration, task.subtasks) > 0)
      })
      if (!target) return
      setSelectedRowId(target.id)
      setOpenRowId(target.id)
    }
    const composerMatch = composerName.trim()
      ? [...required, ...visibleAssigned].find(
          (todo) => itemTitleOrUntitled(taskFor(todo.taskId ?? todo.id) ?? todo).toLowerCase() === composerName.trim().toLowerCase(),
        )
      : undefined
    const submitComposer = (focusFirstStep: boolean) => {
      const description = composerName.trim()
      if (!description) return
      if (composerMatch) {
        setSelectedRowId(composerMatch.id)
        setOpenRowId(composerMatch.id)
        setComposerName("")
        return
      }
      const created = createScheduledTodoTask({
        description,
        tier: composerTier,
        period,
        date: focusedDate,
      })
      addTask(created)
      setComposerName("")
      if (focusFirstStep) {
        window.setTimeout(() => {
          setSelectedRowId(created.id)
          setOpenRowId(created.id)
        }, 0)
      }
    }
    const aftermathCount = [
      past ? undoneByPeriod[period].length > 0 : false,
      doneByPeriod[period].length > 0,
      missedByPeriod[period].length > 0,
    ].filter(Boolean).length
    return (
    <div
      className={`todo-sheet${periodFolding ? " is-folding" : ""}`}
      ref={sheetScrollRef}
      data-ui-name="Period sheet"
      data-ui-help="Load, Required, Assigned, and the Done, Missed, and Undone wells."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="instrument-layout"
    >
      <h3 className="todo-sheet-title">{getTodoOpenTitle(period, focusedDate)}</h3>
      <TodoLoadPanel
        showDaysLeft={period !== "day"}
        daysLeft={daysLeftLabel(period, focusedDate)}
        estimate={formatMinutesAsHours(estimate.minutes)}
        estimateMinutes={estimate.minutes}
        unestimated={estimate.unestimated}
        included={estimate.included}
        scope={estimateScope}
        onScopeChange={setEstimateScope}
        hoursLeft={formatWorkingHours(clockHours)}
        workingHours={formatWorkingHours(hours)}
        workingHoursValue={hours}
        comfortRatioText={formatComfortRatio(ratio)}
        comfortRatioValue={ratio}
        band={band}
        inProgress={inProgress}
        wipLimit={wipLimit}
        onUnestimatedClick={openUnestimated}
      />
      {period === "day" && morningPriorities.length > 0 && (
        <div
          className="todo-morning-priorities"
          data-ui-name="Morning priorities"
          data-ui-help="Tasks marked in today's morning review."
          data-ui-docs="components/Home/ToDo/README.md"
        >
          <p className="todo-morning-label">Morning priorities</p>
          <ol className="todo-morning-list">
            {morningPriorities.map((id) => {
              const task = tasks.find((t) => t.id === id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="todo-btn"
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
      <div className="todo-ledger">
        <section
          className="todo-band is-required"
          role="region"
          aria-label="Required"
          data-ui-name="Required"
          data-ui-help="Must be done this period."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <h4 className="todo-list-title is-required">
            Required <span className="todo-list-count">{required.length}</span>
          </h4>
          {required.length === 0 ? (
            <p className="todo-empty-inline">Nothing required.</p>
          ) : (
            <TodoTable
              {...tableProps}
              todos={required}
              isExpanded={!!expandedPeriods[`required-${period}`]}
              onToggleExpand={() =>
                setExpandedPeriods((prev) => ({ ...prev, [`required-${period}`]: !prev[`required-${period}`] }))
              }
            />
          )}
        </section>
        <section
          className="todo-band is-assigned"
          role="region"
          aria-label="Assigned"
          data-ui-name="Assigned"
          data-ui-help="Everything else scheduled here. Prioritized rows lead."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <div className="todo-assigned-bar">
            <h4 className="todo-list-title">
              Assigned <span className="todo-list-count">{assigned.length}</span>
            </h4>
            <label className="todo-search">
              <span className="todo-visually-hidden">Search</span>
              <input
                type="search"
                value={assignedQuery}
                placeholder="Search assigned tasks"
                aria-label="Search assigned tasks"
                onChange={(event) => setAssignedQuery(event.target.value)}
              />
            </label>
          </div>
          <TodoTable
            {...tableProps}
            todos={visibleAssigned}
            emptyLabel={
              assignedQuery.trim()
                ? "Nothing matches."
                : required.length > 0
                  ? "Nothing else assigned."
                  : undefined
            }
            isExpanded={!!expandedPeriods[period]}
            onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [period]: !prev[period] }))}
          />
          <div
            className="todo-composer"
            data-ui-name="Assigned composer"
            data-ui-help="Adds a task on this period, or opens a name that already exists."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="required-prioritized-assigned"
          >
            <input
              type="text"
              className="todo-composer-name"
              value={composerName}
              placeholder="Add a task…"
              aria-label="Add a task"
              onChange={(e) => setComposerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  submitComposer(e.shiftKey)
                }
              }}
            />
            <select
              className="todo-nixie"
              aria-label="Composer tier"
              title={`Tier ${composerTier}`}
              value={composerTier}
              onChange={(e) => setComposerTier(e.target.value as TodoItem["tier"])}
            >
              {(["A+", "A", "A/B", "B", "C", "D"] as const).map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            {composerMatch ? (
              <button
                type="button"
                className="todo-btn"
                onClick={() => {
                  setSelectedRowId(composerMatch.id)
                  setOpenRowId(composerMatch.id)
                  setComposerName("")
                }}
              >
                Open existing
              </button>
            ) : null}
            <button
              type="button"
              className="todo-btn todo-composer-add"
              onClick={() => submitComposer(false)}
            >
              Add
            </button>
          </div>
        </section>
      </div>
      <div
        className={`todo-aftermath${aftermathCount > 1 ? " is-columns" : ""}`}
        style={aftermathCount > 1 ? { ["--todo-aftermath-cols" as string]: String(aftermathCount) } : undefined}
      >
      {past && (
        <UndoneTodoSection
          todos={undoneByPeriod[period]}
          tasks={tasks}
          period={period}
          pushTitle={undonePushTitle(period, focusedDate)}
          open={undoneSectionsOpen[period]}
          onOpenChange={(open) => setUndoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
          onTaskClick={setSelectedTaskId}
          onAssimilate={(taskId) => resolveUndone(taskId, period, "assimilate")}
          onPush={(taskId) => resolveUndone(taskId, period, "push")}
          onDiscard={(taskId) => resolveUndone(taskId, period, "discard")}
        />
      )}
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
    </div>
    )
  }

  // Open / required / assigned / estimate only for the season tab. Day, week, and month skip this.
  const season = useMemo(() => {
    if (activeTodoTab !== "quarter") return null
    const seasonKey = quarterKey(focusedDate)
    const seasonOpen = tasks.filter(
      (task) => isOpen(task) && !task.hiddenFromTodo && taskTouchesQuarter(task, seasonKey),
    )
    const seasonRequired = seasonOpen.filter((task) => taskIsRequired(task, "quarter", seasonKey))
    const seasonAssigned = pinPrioritizedFirst(
      seasonOpen.filter((task) => !taskIsRequired(task, "quarter", seasonKey)),
      (task) => taskIsPrioritized(task, "quarter", seasonKey),
    )
    const seasonEstimate = summedEstimate(
      seasonOpen.map((task) => ({ id: task.id, estimatedDuration: task.estimatedDuration })),
      tasks,
      "quarter",
      seasonKey,
      estimateScope,
    )
    const seasonHours = workingHoursLeft("quarter", focusedDate)
    const seasonClockHours = hoursLeftInPeriod("quarter", focusedDate)
    const seasonRatio = comfortRatio(seasonEstimate.minutes, seasonHours)
    const seasonBand = comfortBand(seasonRatio)
    const seasonAssignedVisible = seasonAssigned.filter((task) =>
      taskMatchesAssignedQuery(itemTitleOrUntitled(task), task.subtasks, assignedQuery),
    )
    return {
      seasonKey,
      seasonOpen,
      seasonRequired,
      seasonAssigned,
      seasonEstimate,
      seasonHours,
      seasonClockHours,
      seasonRatio,
      seasonBand,
      seasonAssignedVisible,
    }
  }, [activeTodoTab, assignedQuery, estimateScope, focusedDate, tasks])

  const renderSeasonRow = (task: Task) => {
    if (!season) return null
    const { seasonKey } = season
    const prioritized = taskIsPrioritized(task, "quarter", seasonKey)
    const required = taskIsRequired(task, "quarter", seasonKey)
    const name = itemTitleOrUntitled(task)
    const stepCount = flattenSteps(task.subtasks).length
    const open = openRowId === task.id
    return (
      <li key={task.id} className={`todo-season-row${open ? " is-open" : ""}`}>
        <div className="todo-row-closed">
          <button
            type="button"
            className="todo-row-nameplate"
            data-no95
            title={name}
            onClick={() => {
              setSelectedRowId(task.id)
              setOpenRowId(open ? null : task.id)
            }}
          >
            <span className="todo-row-name">{name}</span>
          </button>
          <div className="todo-row-verbs" role="toolbar" aria-label="Task actions">
            <TodoDeleteButton
              prompt={stepCount > 0 ? `Delete "${name}" and its ${stepCount} steps?` : `Delete "${name}"?`}
              onDelete={() => handleDelete(task.id)}
            />
          </div>
        </div>
        {open ? (
          <div className="todo-lid">
            <TodoLidSection id="flags" label="Flags" layout="flags">
              <button
                type="button"
                className="todo-jewel is-required"
                aria-pressed={required}
                aria-label="Required"
                title="Required — absolutely must be done this season"
                onClick={() => handleCommitment(task.id, "quarter", "required")}
              >
                <span className="todo-jewel-glass" aria-hidden />
                <span className="todo-jewel-word">Required</span>
              </button>
              <button
                type="button"
                className="todo-jewel is-prioritized"
                aria-pressed={prioritized}
                aria-label="Prioritized"
                title="Prioritized — stays on Assigned, marked"
                onClick={() => handleCommitment(task.id, "quarter", "prioritized")}
              >
                <span className="todo-jewel-glass" aria-hidden />
                <span className="todo-jewel-word">Prioritized</span>
              </button>
              <button type="button" className="todo-verb" onClick={() => setSelectedTaskId(task.id)}>
                View
              </button>
            </TodoLidSection>
            <TodoBreakdown
              estimate={task.estimatedDuration}
              steps={task.subtasks}
              onEstimateChange={(minutes) => handleEstimate(task.id, minutes)}
              onStepsChange={(subtasks) => handleSteps(task.id, subtasks)}
            />
          </div>
        ) : null}
      </li>
    )
  }
  const seasonLabel = season ? quarterLabel(season.seasonKey) : ""
  const periodLabel =
    activeTodoTab === "quarter"
      ? "Season view"
      : activeTodoTab === "day"
        ? "Day view"
        : activeTodoTab === "week"
          ? "Week view"
          : "Month view"
  const viewingPast = activeTodoTab === "quarter" ? false : isPastTodoPeriod(activeTodoTab, focusedDate)
  const undoneIds =
    activeTodoTab === "quarter"
      ? new Set<string>()
      : new Set(undoneByPeriod[activeTodoTab].map((todo) => todo.taskId ?? todo.id))
  const openCount =
    activeTodoTab === "quarter"
      ? (season?.seasonOpen.length ?? 0)
      : viewingPast
        ? filteredByPeriod[activeTodoTab].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id)).length
        : filteredByPeriod[activeTodoTab].length
  const undoneCount = activeTodoTab === "quarter" ? 0 : undoneByPeriod[activeTodoTab].length

  return (
    <div
      className="todo95"
      data-ui-name="To Do"
      data-ui-help="Day, week, month, and season tasks. Season lists work scheduled in that quarter."
      data-season={activeTodoTab === "quarter" ? seasonSlug(seasonOfDate(focusedDate)) : undefined}
      data-ui-docs="components/Home/ToDo/README.md"
    >
      <div className="todo-window">
        <Tabs
          value={activeTodoTab}
          className="todo-tabs"
          onValueChange={(v) => {
            const next = v as TodoTab
            if (next === activeTodoTab) return
            setActiveTodoTab(next)
            setOpenRowId(null)
            if (prefersReduced()) return
            setPeriodFolding(true)
            window.setTimeout(() => setPeriodFolding(false), 180)
          }}
        >
          <div
            className="todo-fascia"
            data-ui-name="To Do fascia"
            data-ui-help="Title, period nameplate, period keys, and Show / Sort / Pace."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="instrument-layout"
          >
            <div className="todo-fascia-row">
              <div className="todo-mark">
                <img src={orbFor("home-todo")} alt="" className="todo-title-orb" />
                <h2>To Do</h2>
                <span className="todo-mark-count">{openCount}</span>
              </div>
              {activeTodoTab === "quarter" ? (
                <div
                  className="todo-period-nav"
                  data-ui-name="Period nameplate"
                  data-ui-help="Moves the focused season."
                  data-ui-docs="components/Home/ToDo/README.md"
                  data-ui-docs-anchor="instrument-layout"
                >
                  <button type="button" className="todo-btn" aria-label="Previous season" onClick={() => setFocusedDate(shiftQuarter(focusedDate, -1))}>
                    ‹
                  </button>
                  <span>{seasonLabel}</span>
                  <button type="button" className="todo-btn" aria-label="Next season" onClick={() => setFocusedDate(shiftQuarter(focusedDate, 1))}>
                    ›
                  </button>
                </div>
              ) : (
                <TodoPeriodNav
                  period={activeTodoTab}
                  focusedDate={focusedDate}
                  onFocusedDateChange={setFocusedDate}
                  listName={periodTodoListName(activeTodoTab, todoPeriodValue(activeTodoTab, focusedDate))}
                  onOpenList={() => openPeriodTodoList(activeTodoTab, todoPeriodValue(activeTodoTab, focusedDate))}
                />
              )}
              <AddTodoDialog onAdd={handleAddTodo} />
              <TabsList
                className="todo-view-keys"
                data-ui-name="Period keys"
                data-ui-help="Day, week, month, and season."
                data-ui-docs="components/Home/ToDo/README.md"
                data-ui-docs-anchor="data"
              >
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="quarter">Season</TabsTrigger>
              </TabsList>
              {activeTodoTab !== "quarter" && (
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
              )}
            </div>
          </div>

          {wipWarning && (
            <p
              className={`todo-wip${wipWarning ? " is-lace" : ""}`}
              role="status"
              data-ui-name="WIP warning"
              data-ui-help="Soft cap when too many tasks are in progress."
              data-ui-docs="components/Home/ToDo/README.md"
              data-ui-docs-anchor="wip-warning-19"
            >
              {wipWarning}
            </p>
          )}

          {showFormula && (
            <div
              className="todo-formula"
              data-ui-name="Priority formula"
              data-ui-help="Weights for urgency, importance, quick win, and entropy."
              data-ui-docs="components/Home/ToDo/README.md"
              data-ui-docs-anchor="tier-system--sorting"
            >
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

          <div className="todo-stage">
            <div className="todo-body">
              <TabsContent value="day">{activeTodoTab === "day" ? renderTab("day") : null}</TabsContent>
              <TabsContent value="week">{activeTodoTab === "week" ? renderTab("week") : null}</TabsContent>
              <TabsContent value="month">{activeTodoTab === "month" ? renderTab("month") : null}</TabsContent>
              <TabsContent value="quarter">
                {season ? (
                <div
                  className="todo-sheet"
                  data-season={seasonSlug(seasonOfDate(focusedDate))}
                  data-ui-name="Season list"
                  data-ui-help="Open tasks already scheduled on a day, week, or month in this quarter."
                  data-ui-docs="components/Home/ToDo/README.md"
                  data-ui-docs-anchor="data"
                >
                  <p className="todo-hint">Tasks scheduled on a day, week, or month in {quarterLabel(season.seasonKey)}.</p>
                  <TodoLoadPanel
                    daysLeft={daysLeftLabel("quarter", focusedDate)}
                    estimate={formatMinutesAsHours(season.seasonEstimate.minutes)}
                    estimateMinutes={season.seasonEstimate.minutes}
                    unestimated={season.seasonEstimate.unestimated}
                    included={season.seasonEstimate.included}
                    scope={estimateScope}
                    onScopeChange={setEstimateScope}
                    hoursLeft={formatWorkingHours(season.seasonClockHours)}
                    workingHours={formatWorkingHours(season.seasonHours)}
                    workingHoursValue={season.seasonHours}
                    comfortRatioText={formatComfortRatio(season.seasonRatio)}
                    comfortRatioValue={season.seasonRatio}
                    band={season.seasonBand}
                    inProgress={countInProgress(tasks)}
                    wipLimit={wipLimit}
                  />
                  <div className="todo-ledger">
                    <section
                      className="todo-band is-required"
                      role="region"
                      aria-label="Required"
                      data-ui-name="Required"
                      data-ui-help="Must be done this season."
                      data-ui-docs="components/Home/ToDo/README.md"
                      data-ui-docs-anchor="required-prioritized-assigned"
                    >
                      <h4 className="todo-list-title is-required">
                        Required <span className="todo-list-count">{season.seasonRequired.length}</span>
                      </h4>
                      {season.seasonRequired.length === 0 ? (
                        <p className="todo-empty-inline">Nothing required.</p>
                      ) : (
                        <ul className="todo-season-list">
                          {season.seasonRequired.map((task) => renderSeasonRow(task))}
                        </ul>
                      )}
                    </section>
                    <section
                      className="todo-band is-assigned"
                      role="region"
                      aria-label="Assigned"
                      data-ui-name="Assigned"
                      data-ui-help="Everything else scheduled in this season. Prioritized rows lead."
                      data-ui-docs="components/Home/ToDo/README.md"
                      data-ui-docs-anchor="required-prioritized-assigned"
                    >
                      <div className="todo-assigned-bar">
                        <h4 className="todo-list-title">
                          Assigned <span className="todo-list-count">{season.seasonAssigned.length}</span>
                        </h4>
                        <label className="todo-search">
                          <span className="todo-visually-hidden">Search</span>
                          <input
                            type="search"
                            value={assignedQuery}
                            placeholder="Search assigned tasks"
                            aria-label="Search assigned tasks"
                            onChange={(event) => setAssignedQuery(event.target.value)}
                          />
                        </label>
                      </div>
                      {season.seasonAssignedVisible.length === 0 ? (
                        <p className="todo-empty-inline">
                          {assignedQuery.trim()
                            ? "Nothing matches."
                            : season.seasonRequired.length > 0
                              ? "Nothing else assigned."
                              : "Nothing scheduled in this season yet. Add a task to place it on the first month."}
                        </p>
                      ) : (
                        <ul className="todo-season-list">
                          {season.seasonAssignedVisible.map((task) => renderSeasonRow(task))}
                        </ul>
                      )}
                    </section>
                  </div>
                </div>
                ) : null}
              </TabsContent>
            </div>
          </div>
        </Tabs>

        <div
          className="todo-status"
          data-ui-name="Status bar"
          data-ui-help="Which period is open, and how many tasks are still open."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="instrument-layout"
        >
          <span>
            {activeTodoTab === "quarter" ? `${periodLabel} · ${seasonLabel}` : `${periodLabel} · ${getPeriodNavLabel(activeTodoTab, focusedDate)}`}
          </span>
          <span className="todo-status-count">
            {openCount} open{viewingPast ? ` · ${undoneCount} undone` : ""}
          </span>
        </div>
      </div>

      <div
        className="todo-desk-plate"
        data-desk-plate="todo"
        aria-hidden="true"
        data-ui-name="To Do plate"
        data-ui-help="The dove under the window."
        data-ui-docs="components/Home/ToDo/README.md"
        data-ui-docs-anchor="instrument-layout"
      >
        <img src={orbFor("home-todo")} alt="" draggable={false} />
      </div>

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />

      {justStartTaskId && (
        <JustStartMode taskId={justStartTaskId} onClose={() => setJustStartTaskId(null)} />
      )}
    </div>
  )
}
