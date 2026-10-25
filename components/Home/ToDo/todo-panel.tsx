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
import { needsNotice, withNoticeAnswer } from "@/lib/notice-dot"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { quarterKey, quarterLabel, quarterStartDate, seasonSlug, seasonOfDate, shiftQuarter, taskTouchesQuarter } from "@/lib/seasons"
import { completeTask, markMissedOpportunity } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { assimilateUndoneFields, discardUndoneFields, pushUndoneFields } from "@/lib/scheduling"
import { resolveCompletionPoints } from "@/lib/item-utils"
import type { StepTier } from "@/lib/types"
import { usePointsStore } from "@/lib/points-store"
import { emitTaskCompleted } from "@/lib/completion-events"
import { completionWindow } from "@/lib/completion-window"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { formatLocalDateKey } from "@/lib/date-utils"
import { makeEstimate } from "@/lib/estimated-values"
import { confirmTaskTimes, type ConfirmedTimes } from "@/lib/services/completion-time-service"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import type { TodoItem, Task, PriorityWeights, CompletionStatus, Subtask, StoredBlockedReason } from "@/lib/types"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import JustStartMode from "@/components/Focus/JustStartMode"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { stopTaskClock } from "@/lib/task-clock"
import { offerPenDebrief } from "@/lib/session-debrief"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { activeNowObjectives } from "@/lib/now-objective"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { openTaskBlockers } from "@/lib/prereqs"
import { inheritedDue, unlockBreakdown } from "@/lib/unlock-value"
import { TaskPrereqDialog } from "./TaskPrereqDialog"
import { TaskCard, type TaskCardHost } from "./TaskCard"
import { registerTaskCardHost } from "@/lib/task-card"
import { settleStepPoints } from "@/lib/step-points"
import { PickListKey, SessionKey, SessionPlanner, SessionsKey } from "./SessionPlanner"
import { isClearedFromWork } from "@/lib/completion-status"
import { formatLocalMonthKey, taskScheduledInMonth, taskScheduledInWeek, taskScheduledOnDay } from "@/lib/date-utils"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { openPeriodTodoList, periodTodoListName } from "@/lib/scheduled-lists-sync"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { effectiveStatus, isOpen, withStatus } from "@/lib/completion-status"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { useStarLordStore } from "@/lib/star-lord-store"
import { isRitualTodoId, ritualBoardFollowingSun, ritualDayBoard } from "@/lib/ritual-todo"
import type { RitualTodoPlacement } from "@/lib/ritual-todo"
import { RitualWalkDialog } from "@/components/Reviews/RitualWalkDialog"
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
} from "./todo-utils"
import { TodoTable } from "./TodoTable"
import { TodoLoadPanel, comfortDialT, comfortWord } from "./TodoLoadPanel"
import { AddTodoDialog, type ExistingTaskHit, type NewTodoDraft } from "./AddTodoDialog"
import { AddDoneDialog } from "./AddDoneDialog"
import { TodoPeriodNav } from "./TodoPeriodNav"
import { DoneTodoSection } from "./DoneTodoSection"
import { MissedTodoSection } from "./MissedTodoSection"
import { UndoneTodoSection } from "./UndoneTodoSection"
import { TodoFilters, TodoSortKeys } from "./todo-filters"
import { TodoSettingsDialog } from "./TodoSettingsDialog"
import { PriorityFormulaPanel } from "./PriorityFormulaPanel"
import { TodoRangeNav, TodoRangeSheet, useTodoRanges } from "./TodoRangeSheet"
import { todoTitle, tasksInRange } from "./todo-ranges"
import { WaitingLine } from "@/components/steps/WaitingLine"
import { DEFAULT_TODO_PREFS, useTodoPrefs, setTodoPrefs } from "./todo-prefs"
import { useRitesSun } from "./use-rites-sun"
import { useTodoTime } from "./use-todo-time"
import { PaceSettings } from "./todo-pace"
import { bgeScore, type BgeEntry } from "@/lib/bge-score"
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
  splitByTier,
  summedEstimate,
  todoMarkTier,
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
  hoursLeftInPeriod,
  workingHoursLeft,
  type EstimateScope,
} from "@/lib/todo-commitment"
import { flattenSteps, taskMatchesAssignedQuery, effectiveDurationMinutes } from "@/lib/todo-steps"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection } from "./TodoBreakdown"
import { openStepItem } from "@/lib/step-item-stack"
import "./todo-chrome.css"
import { NativeSelect } from "@/components/ui/native-select"

const TODO_TABS = ["day", "week", "month", "quarter", "other"] as const
type TodoTab = (typeof TODO_TABS)[number]

/** Assumed length for work logged after the fact, until the user says otherwise. */
const DEFAULT_LOGGED_DONE_MINUTES = 30

/** Stable empty snapshot for Zustand — `?? []` would allocate every getSnapshot and loop. */
const EMPTY_PRIORITY_IDS: string[] = []

/** Span keys (Tek time-base keys): the word, and under it the span it covers. */
const SPAN_KEYS: { value: TodoTab; word: string }[] = [
  { value: "day", word: "Day" },
  { value: "week", word: "Week" },
  { value: "month", word: "Month" },
  { value: "quarter", word: "Season" },
  { value: "other", word: "Other" },
]

function spanSubLabel(tab: TodoTab, date: Date): string {
  if (tab === "day") return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
  if (tab === "week") return getPeriodNavLabel("week", date)
  if (tab === "month") return date.toLocaleDateString("en-US", { month: "long" })
  if (tab === "quarter") return seasonOfDate(date).replace(/^./, (c) => c.toUpperCase())
  return "named ranges"
}

const BGE_SECTIONS: { tier: StepTier; title: string }[] = [
  { tier: "min", title: "Bare minimum" },
  { tier: "goal", title: "Goal" },
  { tier: "exceptional", title: "Exceptional" },
]

export function TodoPanel({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  usePenActionSync()
  const tasks = useTaskStore((s) => s.tasks)
  const reviews = useReviewsStore((s) => s.reviews)
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const addTask = useTaskStore((s) => s.addTask)
  const categories = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const priorityWeights = useTaskStore((s) => s.priorityWeights)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [ritualWalk, setRitualWalk] = useState<RitualTodoPlacement | null>(null)
  const [justStartTaskId, setJustStartTaskId] = useState<string | null>(null)
  const clockTaskId = usePenColorSessionStore((s) => s.session?.taskId ?? null)
  const clockStepId = usePenColorSessionStore((s) => s.session?.stepId)
  const taskClock = useTaskClockStarter()
  const [prereqTaskId, setPrereqTaskId] = useState<string | null>(null)
  const [sessionOpen, setSessionOpen] = useState<false | "session" | "shelves" | "list">(false)
  const [activeTodoTab, setActiveTodoTab] = usePersistedTab(APP_NAV_KEYS.homeTodoTab, TODO_TABS, "day")
  // Other (custom ranges) has its own sheet; the period machinery below keeps reading a period.
  const periodTab: Exclude<TodoTab, "other"> = activeTodoTab === "other" ? "day" : activeTodoTab
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
    periodTab === "week"
      ? (weekDate ?? currentDate)
      : periodTab === "month"
        ? (monthDate ?? currentDate)
        : periodTab === "quarter"
          ? (seasonDate ?? currentDate)
          : currentDate
  const setFocusedDate = (date: Date) => {
    if (periodTab === "week") setWeekDate(date)
    else if (periodTab === "month") setMonthDate(date)
    else if (periodTab === "quarter") setSeasonDate(date)
    else setCurrentDate(date)
  }
  const todoPrefs = useTodoPrefs()
  const {
    availableNow,
    wipLimit,
    ritesFollowSun,
    defaultEstimateMin,
    hideLocked,
    showAllTasks,
    statusFilter,
    sortMode,
    sortOrder,
    loadOpen,
    showTrayOpen,
    bgeTiers,
    showNextOnly,
    tierView,
  } = todoPrefs
  const todoRanges = useTodoRanges()
  // Peek at what Hide locked and the sun rule keep off the list, without turning them off (UI-5).
  const [peekHidden, setPeekHidden] = useState(false)
  const lockFilterOn = availableNow || (hideLocked && !peekHidden)
  const todoTime = useTodoTime(tasks)
  const ritesSun = useRitesSun(ritesFollowSun)
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
  // Open work on the lens, for the session pick list. Season falls back to every open task.
  const sessionPeriod = useMemo(() => {
    if (!sessionOpen) return { label: "", tasks: [] as Task[] }
    const open = tasks.filter((t) => !t.completed && !isClearedFromWork(t))
    if (periodTab === "day") {
      return { label: "This day", tasks: open.filter((t) => taskScheduledOnDay(t, focusedDate)) }
    }
    if (periodTab === "week") {
      const week = getWeekString(focusedDate)
      return { label: "This week", tasks: open.filter((t) => taskScheduledInWeek(t, week)) }
    }
    if (periodTab === "month") {
      const month = formatLocalMonthKey(focusedDate)
      return { label: "This month", tasks: open.filter((t) => taskScheduledInMonth(t, month)) }
    }
    return { label: "All open tasks", tasks: open }
  }, [sessionOpen, tasks, periodTab, focusedDate])

  const focusedDayKey = localDayKey(focusedDate)
  const ritualBoard = useMemo(
    () => ritualDayBoard(focusedDate, reviews, starReports, birthday),
    [focusedDate, reviews, starReports, birthday],
  )
  // The open list drops a rite at the wrong end of today. Done, lookups and walks keep the whole board.
  const openRitualBoard = useMemo(
    () =>
      ritesFollowSun && !peekHidden ? ritualBoardFollowingSun(ritualBoard, ritesSun.now, ritesSun.sunsetMinutes) : ritualBoard,
    [ritualBoard, ritesFollowSun, peekHidden, ritesSun.now, ritesSun.sunsetMinutes],
  )
  const sunHiddenCount = ritesFollowSun
    ? ritualBoard.tasks.length - ritualBoardFollowingSun(ritualBoard, ritesSun.now, ritesSun.sunsetMinutes).tasks.length
    : 0
  const morningPriorities = useReviewsStore(
    (s) => s.getMorningReview(focusedDayKey)?.priorityTaskIds ?? EMPTY_PRIORITY_IDS,
  )
  // A priority whose task was since deleted drops off the strip instead of showing its id.
  const morningTasks = useMemo(
    () => morningPriorities.flatMap((id) => tasks.find((t) => t.id === id) ?? []),
    [morningPriorities, tasks],
  )

  const todoItems = useMemo(() => buildTodoItems(tasks, showAllTasks, focusedDate), [tasks, showAllTasks, focusedDate])

  const filteredByPeriod = useMemo(() => {
    // Required / Prioritized this period count as full value for what they wait on (Phase 14).
    const markedIdsFor = (period: TodoPeriod) => {
      const key = todoPeriodKey(period, focusedDate)
      const ritual = period === "day" ? morningPriorities : undefined
      return new Set(
        tasks
          .filter((t) => taskIsRequired(t, period, key) || taskIsPrioritized(t, period, key, ritual))
          .map((t) => t.id),
      )
    }
    const order = (period: TodoPeriod) => {
      const base = filterAndSortTodos(todoItems, period, showAllTasks, focusedDate)
      const byStatus = filterTodosByStatus(base, tasks, statusFilter)
      const available = filterTodosAvailableNow(byStatus, tasks, lockFilterOn)
      return sortTodos(available, {
        mode: sortMode,
        order: sortOrder,
        period,
        tasks,
        weights: priorityWeights,
        now: focusedDate,
        markedIds: markedIdsFor(period),
      })
    }
    const riteItems = buildTodoItems(openRitualBoard.tasks, true, focusedDate)
    const riteScheduled = filterAndSortTodos(riteItems, "day", true, focusedDate)
    const riteById = new Map(riteScheduled.map((item) => [item.id, item]))
    const riteView = [...tasks, ...openRitualBoard.tasks]
    const dayRites = filterTodosAvailableNow(
      filterTodosByStatus(
        openRitualBoard.tasks.flatMap((task) => {
          const item = riteById.get(task.id)
          return item ? [item] : []
        }),
        riteView,
        statusFilter,
      ),
      riteView,
      lockFilterOn,
    )
    return {
      day: [...dayRites, ...order("day")],
      week: order("week"),
      month: order("month"),
    } satisfies Record<TodoPeriod, TodoItem[]>
  }, [todoItems, showAllTasks, statusFilter, lockFilterOn, sortMode, sortOrder, tasks, priorityWeights, focusedDate, openRitualBoard, morningPriorities])

  // Rows Hide locked keeps off each list (only when Available now is not already hiding them).
  const lockedHiddenByPeriod = useMemo(() => {
    const count = (period: TodoPeriod) => {
      if (!hideLocked || availableNow) return 0
      const byStatus = filterTodosByStatus(filterAndSortTodos(todoItems, period, showAllTasks, focusedDate), tasks, statusFilter)
      return byStatus.length - filterTodosAvailableNow(byStatus, tasks, true).length
    }
    return { day: count("day"), week: count("week"), month: count("month") } satisfies Record<TodoPeriod, number>
  }, [hideLocked, availableNow, todoItems, showAllTasks, focusedDate, tasks, statusFilter])

  const wipWarning = formatWipWarning(countInProgress(tasks), wipLimit)

  const doneByPeriod = useMemo(
    () => ({
      day: [
        ...buildDoneTodoItems(ritualBoard.tasks, "day", focusedDate, folders),
        ...buildDoneTodoItems(tasks, "day", focusedDate, folders),
      ],
      week: buildDoneTodoItems(tasks, "week", focusedDate, folders),
      month: buildDoneTodoItems(tasks, "month", focusedDate, folders),
    }),
    [tasks, focusedDate, folders, ritualBoard],
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

  // A season task lands on this month while the season is current, else on its first month.
  const seasonMonthDate = () =>
    quarterKey(focusedDate) === quarterKey(new Date()) ? new Date() : quarterStartDate(focusedDate)

  const handleAddTodo = (draft: NewTodoDraft) => {
    // Same factory the Plan day sidebar uses — one task record, both views.
    addTask(
      createScheduledTodoTask({
        description: draft.description,
        tier: draft.tier,
        period: periodTab === "quarter" ? "month" : periodTab,
        date: periodTab === "quarter" ? seasonMonthDate() : focusedDate,
      }),
    )
  }

  // Add task → From lists: schedule a task that already exists instead of making a new one.
  const searchExistingTasks = (query: string): ExistingTaskHit[] => {
    const words = query.toLowerCase()
    const period = periodTab === "quarter" ? "month" : periodTab
    const here = new Set(
      (period === "day" || period === "week" || period === "month" ? filteredByPeriod[period] : []).map(
        (todo) => todo.taskId ?? todo.id,
      ),
    )
    return tasks
      .filter((task) => isOpen(task) && !task.hiddenFromTodo && !here.has(task.id))
      .filter((task) => itemTitleOrUntitled(task).toLowerCase().includes(words))
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        title: itemTitleOrUntitled(task),
        hint: task.scheduledDate
          ? `on ${toLocalCalendarDate(task.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : task.scheduledWeek
            ? `week ${task.scheduledWeek}`
            : task.scheduledMonth
              ? task.scheduledMonth
              : task.lists?.length
                ? "in a list"
                : undefined,
      }))
  }

  const pickExistingTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const next = { ...task }
    scheduleTaskForPeriod(
      next,
      periodTab === "quarter" ? "month" : periodTab,
      periodTab === "quarter" ? seasonMonthDate() : focusedDate,
    )
    updateTask(next)
  }

  const handleAddDone = (description: string) => {
    // On Season the log lands on this month (today) or the season's first month; the completion window uses the same day.
    const loggedPeriod: TodoPeriod = periodTab === "quarter" ? "month" : periodTab
    const refDate = toLocalCalendarDate(periodTab === "quarter" ? seasonMonthDate() : focusedDate)
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
    const id = `done-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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

    scheduleTaskForPeriod(task, loggedPeriod, refDate)
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

  const openRitual = (todoId: string): boolean => {
    if (!isRitualTodoId(todoId)) return false
    const placement = ritualBoard.byId.get(todoId)
    if (!placement) return false
    setRitualWalk(placement)
    setOpenRowId((id) => (id === todoId ? null : id))
    return true
  }

  // Pending flock and fold timers, cleared on unmount. A second Done during the flock is ignored.
  // A Done still mid-flock at unmount is completed then, so leaving the tab never drops it.
  const timers = useRef(new Set<number>())
  const flocking = useRef(new Map<string, () => void>())
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }, [])
  useEffect(() => {
    const pending = timers.current
    const unfinished = flocking.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
      unfinished.forEach((complete) => complete())
    }
  }, [])

  const handleComplete = (todoId: string, level?: StepTier) => {
    if (openRitual(todoId)) return
    if (flocking.current.has(todoId)) return
    // The store stamps `completedDate` on this transition, so the row lands in
    // today's "Done" list no matter which day it was scheduled for.
    const complete = () => completeTask(todoId, { level })
    const finish = () => {
      flocking.current.delete(todoId)
      complete()
      setOpenRowId((id) => (id === todoId ? null : id))
      setFlockingId(null)
    }
    if (prefersReduced()) {
      finish()
      return
    }
    flocking.current.set(todoId, complete)
    setFlockingId(todoId)
    later(finish, 380)
  }

  const handleRename = (todoId: string, description: string) => {
    if (isRitualTodoId(todoId)) return
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    updateTask({ ...task, description })
  }

  const [reasonAsk, setReasonAsk] = useState<{ subject: string; apply: (reason: StoredBlockedReason | undefined) => void } | null>(null)

  const handleMissed = (todoId: string) => {
    if (isRitualTodoId(todoId)) return
    const task = tasks.find((row) => row.id === todoId)
    setReasonAsk({
      subject: itemTitleOrUntitled(task),
      apply: (reason) => {
        markMissedOpportunity(todoId, undefined, reason)
        if (periodTab !== "quarter") {
          setMissedSectionsOpen((prev) => ({ ...prev, [periodTab]: true }))
        }
      },
    })
  }

  const handleTierChange = (todoId: string, tier: TodoItem["tier"]) => {
    if (isRitualTodoId(todoId)) return
    const task = tasks.find((t) => t.id === todoId)
    if (task) updateTask({ ...task, ...tierToUrgencyImportance(tier) })
  }

  const handlePush = (todoId: string, period: TodoPeriod) => {
    if (isRitualTodoId(todoId)) return
    const task = tasks.find((row) => row.id === todoId)
    const ritualPrioritized = period === "day" && morningPriorities.includes(todoId)
    setReasonAsk({
      subject: itemTitleOrUntitled(task),
      apply: (reason) => pushTask(todoId, period, undefined, new Date(), reason, ritualPrioritized),
    })
  }

  const handleDelete = (todoId: string) => {
    if (isRitualTodoId(todoId)) return
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
    const settled = todoTime.settle(task, subtasks)
    updateTask({ ...task, subtasks: settled })
    // Phase 12: step points paid on tick, taken back on untick (lid and card).
    settleStepPoints({ id: task.id, description: itemTitleOrUntitled(task), stepPoints: task.stepPoints }, task.subtasks, settled)
  }
  useEffect(() => registerTaskCardHost(), [])

  const resolveUndone = (taskId: string, period: TodoPeriod, action: "assimilate" | "push" | "discard") => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const value = todoPeriodValue(period, focusedDate)
    if (action === "push") {
      setReasonAsk({
        subject: itemTitleOrUntitled(task),
        apply: (reason) => {
          const ritualPrioritized = period === "day" && morningPriorities.includes(taskId)
          const patch = pushUndoneFields(task, period, value, focusedDate, new Date(), reason, ritualPrioritized)
          updateTask({ ...task, ...patch })
        },
      })
      return
    }
    const patch =
      action === "assimilate"
        ? assimilateUndoneFields(task, period, value)
        : discardUndoneFields(task, period, value)
    updateTask({ ...task, ...patch })
  }

  const getStatus = (todoId: string): CompletionStatus => {
    const task = tasks.find((t) => t.id === todoId) ?? ritualBoard.tasks.find((t) => t.id === todoId)
    return task ? effectiveStatus(task) : "active"
  }

  const openTask = (todoId: string) => {
    if (openRitual(todoId)) return
    setSelectedTaskId(todoId)
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
    if (isRitualTodoId(todoId)) return
    const task = tasks.find((t) => t.id === todoId)
    if (!task) return
    // `withStatus` flips `completed`; the store stamps/clears `completedDate`.
    updateTask(withStatus(task, status))
  }

  const clockObjectives = usePenColorSessionStore((state) => state.session?.nowObjectives)
  const clockStop = useUnfinishedStop(activeNowObjectives(clockObjectives).length, (park) => {
    const ended = stopTaskClock(undefined, new Date(), park ? { parkUnfinished: true } : undefined)
    if (ended) offerPenDebrief(ended)
  })

  // Phase 12: the task card borrows the panel's handlers for the lens it opened on.
  // Push counts read a ledger period (season reads month); Required and Prioritized
  // follow the lens itself, so the card and the season lid flip the same marks.
  const cardPeriod: TodoPeriod = periodTab === "quarter" ? "month" : periodTab
  const markPeriod = periodTab
  const markKey = todoPeriodKey(markPeriod, focusedDate)
  const taskCardHost: TaskCardHost = {
    period: cardPeriod,
    periodLabel: { day: "This day", week: "This week", month: "This month", quarter: "This season" }[markPeriod],
    focusedDate,
    isRequired: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsRequired(t, markPeriod, markKey)
    },
    isPrioritized: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsPrioritized(t, markPeriod, markKey, markPeriod === "day" ? morningPriorities : undefined)
    },
    onToggleRequired: (id) => handleCommitment(id, markPeriod, "required"),
    onTogglePrioritized: (id) => handleCommitment(id, markPeriod, "prioritized"),
    onStepsChange: handleSteps,
    onJustStart: (id) => setJustStartTaskId(id),
    onNeeds: setPrereqTaskId,
    timeOf: (id) => todoTime.timeOf(id),
    clockTaskId,
    clockStepId,
    onClockStart: taskClock.start,
    onClockStop: () => clockStop.request(),
    defaultEstimateMin,
    hoursLeft: workingHoursLeft("day", new Date()),
  }

  /** Open rows and the load figures for one lens. The header glass and the sheet read the same numbers. */
  const periodLoad = (period: TodoPeriod) => {
    const past = isPastTodoPeriod(period, focusedDate)
    const undoneIds = new Set(undoneByPeriod[period].map((todo) => todo.taskId ?? todo.id))
    const openTodos = past
      ? filteredByPeriod[period].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id))
      : filteredByPeriod[period]
    const periodKey = todoPeriodKey(period, focusedDate)
    const ritualIds = period === "day" ? morningPriorities : undefined
    const estimate = summedEstimate(openTodos, tasks, period, periodKey, estimateScope, ritualIds)
    const hours = workingHoursLeft(period, focusedDate)
    const clockHours = hoursLeftInPeriod(period, focusedDate)
    const ratio = comfortRatio(estimate.minutes, hours)
    const band = comfortBand(ratio)
    return { past, undoneIds, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band }
  }

  const renderTab = (period: TodoPeriod) => {
    const { past, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band } = periodLoad(period)
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
    const bgeTierOf = (todoId: string): StepTier => {
      const task = taskFor(todoId)
      return task ? todoMarkTier(task, period, periodKey) : "goal"
    }
    const bgeSections = bgeTiers
      ? splitByTier(pinPrioritizedFirst([...required, ...assigned], (todo) => prioritizedOf(todo.taskId ?? todo.id)).filter((todo) => {
          const task = taskFor(todo.taskId ?? todo.id)
          return taskMatchesAssignedQuery(itemTitleOrUntitled(task ?? todo), task?.subtasks, assignedQuery)
        }), (todo) => bgeTierOf(todo.taskId ?? todo.id))
      : null
    // Score reads every real task on this list: open, done and missed. Rites are derived rows, not tasks, so they stay out.
    const bgeEntries: BgeEntry[] = bgeTiers
      ? [
          ...openTodos.map((todo) => ({ todo, done: false })),
          ...doneByPeriod[period].map((todo) => ({ todo, done: true })),
          ...missedByPeriod[period].map((todo) => ({ todo, done: false })),
        ].flatMap(({ todo, done }) => (taskFor(todo.taskId ?? todo.id) ? [{ tier: bgeTierOf(todo.taskId ?? todo.id), done }] : []))
      : []
    const bge = bgeTiers ? bgeScore(bgeEntries) : null
    const tableProps = {
      period,
      bgeTierOf: bgeTiers ? bgeTierOf : undefined,
      onBgeTierChange: bgeTiers
        ? (todoId: string, tier: StepTier) => {
            const task = taskFor(todoId)
            if (task) updateTask(patchTodoCommitment(task, period, periodKey, { tier }))
          }
        : undefined,
      onComplete: handleComplete,
      onMissed: handleMissed,
      onPush: handlePush,
      onDelete: handleDelete,
      onEstimateChange: handleEstimate,
      onStepsChange: handleSteps,
      stepsOf: (todoId: string) => taskFor(todoId)?.subtasks,
      estimateOf: (todoId: string) => taskFor(todoId)?.estimatedDuration,
      defaultEstimateMin,
      spentOf: (todoId: string) => todoTime.spentOf(taskFor(todoId)?.id ?? todoId),
      timeOf: (todoId: string) => todoTime.timeOf(taskFor(todoId)?.id ?? todoId),
      onTaskClick: openTask,
      onTierChange: handleTierChange,
      onJustStart: (taskId: string) => {
        if (openRitual(taskId)) return
        setJustStartTaskId(taskId)
      },
      isWalkRow: isRitualTodoId,
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
      clockTaskId,
      clockStepId,
      onClockStart: taskClock.start,
      onClockStop: () => clockStop.request(),
      unlockOf: (taskId: string) => {
        const breakdown = unlockBreakdown({ id: taskId }, tasks)
        if (!breakdown.count) return null
        const due = inheritedDue(taskId, tasks, focusedDate)
        return {
          count: breakdown.count,
          title: breakdown.label,
          due: due
            ? `due ${due.due.toLocaleDateString(undefined, { weekday: "short" })} for ${itemTitleOrUntitled(due.forTask)}`
            : undefined,
          overdue: due?.overdue,
        }
      },
      blockersOf: (taskId: string) => {
        const task = taskFor(taskId)
        return task ? openTaskBlockers(task, tasks).map((t) => itemTitleOrUntitled(t)) : []
      },
      onNeeds: setPrereqTaskId,
      noticeOf: (todoId: string) => {
        const task = taskFor(todoId)
        return task ? needsNotice(task) : false
      },
      onNotice: (todoId: string, text: string) => {
        const task = taskFor(todoId)
        if (task) updateTask(withNoticeAnswer(task, text))
      },
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
      {loadOpen && (
      <TodoLoadPanel
        isDay={period === "day"}
        spentMinutes={openTodos.reduce((sum, todo) => sum + todoTime.spentOf(todo.taskId ?? todo.id), 0)}
        requiredMinutes={summedEstimate(openTodos, tasks, period, periodKey, "required", ritualIds).minutes}
        allMinutes={summedEstimate(openTodos, tasks, period, periodKey, "all", ritualIds).minutes}
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
      )}
      {period === "day" && morningTasks.length > 0 && (
        <div
          className="todo-morning-priorities"
          data-ui-name="Morning priorities"
          data-ui-help="Tasks marked in today's morning review."
          data-ui-docs="components/Home/ToDo/README.md"
        >
          <p className="todo-morning-label">Morning priorities</p>
          <ol className="todo-morning-list">
            {morningTasks.map((task) => (
              <li key={task.id} className={task.completed ? "is-done" : undefined}>
                <button type="button" className="todo-btn" onClick={() => setSelectedTaskId(task.id)}>
                  {itemTitleOrUntitled(task)}
                </button>
                {task.completed ? <span className="todo-visually-hidden"> (done)</span> : null}
              </li>
            ))}
          </ol>
        </div>
      )}
      {bge && bgeEntries.length > 0 && (
        <div
          className="todo-bge-score"
          data-ui-name="B/G/E score"
          data-ui-help="Bare minimum 70%, Goal 30%, Exceptional done adds what a Goal task is worth."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="bge-tiers"
        >
          <span className="todo-bge-score-num" title="Bare minimum is 70%, Goal 30%. Each Exceptional done adds one Goal task's share on top.">
            {Math.round(bge.points)}
            <small>%</small>
          </span>
          <span className="todo-bge-score-label">B/G/E {period} score</span>
          <span className="todo-bge-score-parts">
            B {bge.min.done}/{bge.min.total} · G {bge.goal.done}/{bge.goal.total} · E {bge.exceptional.done}/{bge.exceptional.total}
            {bge.bonus > 0 ? ` · +${Math.round(bge.bonus)} bonus` : ""}
          </span>
          <span className="todo-bge-score-plain">
            {bgeEntries.filter((e) => e.done).length} of {bgeEntries.length} tasks done
          </span>
        </div>
      )}
      <div className="todo-ledger">
        {/* Hidden while empty (dead instruments are hidden); it appears when a row's Required gem lights. */}
        {required.length > 0 && !bgeTiers && (
        <section
          className="todo-band is-required"
          role="region"
          aria-label="Required"
          data-ui-name="Required"
          data-ui-help="Marked required for this period."
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="required-prioritized-assigned"
        >
          <h4 className="todo-list-title is-required">
            Required <span className="todo-list-count">{required.length}</span>
          </h4>
          <TodoTable
              {...tableProps}
              todos={required}
              isExpanded={!!expandedPeriods[`required-${period}`]}
              onToggleExpand={() =>
                setExpandedPeriods((prev) => ({ ...prev, [`required-${period}`]: !prev[`required-${period}`] }))
              }
            />
        </section>
        )}
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
          {bgeSections ? (
            BGE_SECTIONS.map(({ tier, title }) => (
              <div key={tier} className={`todo-bge-band is-${tier}`} role="group" aria-label={title} data-ui-name={`${title} tier`}>
                <h5 className="todo-bge-title">
                  {title} <span className="todo-list-count">{bgeSections[tier].length}</span>
                </h5>
                <TodoTable
                  {...tableProps}
                  todos={bgeSections[tier]}
                  emptyLabel={assignedQuery.trim() ? "Nothing matches." : `Nothing at ${title} yet.`}
                  isExpanded={!!expandedPeriods[`${tier}-${period}`]}
                  onToggleExpand={() => setExpandedPeriods((prev) => ({ ...prev, [`${tier}-${period}`]: !prev[`${tier}-${period}`] }))}
                />
              </div>
            ))
          ) : (
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
          )}
          <WaitingLine
            hidden={lockedHiddenByPeriod[period] + (period === "day" ? sunHiddenCount : 0)}
            peeking={peekHidden}
            onPeek={() => setPeekHidden((on) => !on)}
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
            <NativeSelect
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
            </NativeSelect>
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
            {/* Log done lives here too, so it stays reachable while the Done well is hidden. */}
            <AddDoneDialog onAdd={handleAddDone} />
          </div>
        </section>
      </div>
      <div
        className={`todo-aftermath${aftermathCount > 1 ? " is-columns" : ""}`}
        style={aftermathCount > 1 ? { ["--todo-aftermath-cols" as string]: String(aftermathCount) } : undefined}
      >
      {past && undoneByPeriod[period].length > 0 && (
        <UndoneTodoSection
          todos={undoneByPeriod[period]}
          tasks={tasks}
          period={period}
          pushTitle={undonePushTitle(period, focusedDate)}
          open={undoneSectionsOpen[period]}
          onOpenChange={(open) => setUndoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
          onTaskClick={openTask}
          onAssimilate={(taskId) => resolveUndone(taskId, period, "assimilate")}
          onPush={(taskId) => resolveUndone(taskId, period, "push")}
          onDiscard={(taskId) => resolveUndone(taskId, period, "discard")}
        />
      )}
      {doneByPeriod[period].length > 0 && (
      <DoneTodoSection
        title={getTodoDoneTitle(period, focusedDate)}
        todos={doneByPeriod[period]}
        tasks={tasks}
        period={period}
        open={doneSectionsOpen[period]}
        onOpenChange={(open) => setDoneSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={openTask}
        onAddDone={handleAddDone}
        onConfirmTimes={handleConfirmTimes}
        refDate={focusedDate}
      />
      )}
      {missedByPeriod[period].length > 0 && (
      <MissedTodoSection
        title={getTodoMissedTitle(period, focusedDate)}
        todos={missedByPeriod[period]}
        tasks={tasks}
        period={period}
        open={missedSectionsOpen[period]}
        onOpenChange={(open) => setMissedSectionsOpen((prev) => ({ ...prev, [period]: open }))}
        onTaskClick={openTask}
      />
      )}
      </div>
    </div>
    )
  }

  // Open / required / assigned / estimate only for the season tab. Day, week, and month skip this.
  const season = useMemo(() => {
    if (periodTab !== "quarter") return null
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
  }, [periodTab, assignedQuery, estimateScope, focusedDate, tasks])

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
                title="Required — you marked this one for this season"
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
              onOpenStep={(step) => openStepItem(task.id, step.id)}
              time={todoTime.timeOf(task.id)}
            />
          </div>
        ) : null}
      </li>
    )
  }
  const seasonLabel = season ? quarterLabel(season.seasonKey) : ""
  const activeRange = todoRanges.find((r) => r.range.id === todoPrefs.activeRangeId) ?? todoRanges[0]
  const todoHeading = todoTitle(activeTodoTab, focusedDate, todoPrefs, activeRange?.name)
  const periodLabel =
    periodTab === "quarter"
      ? "Season view"
      : periodTab === "day"
        ? "Day view"
        : periodTab === "week"
          ? "Week view"
          : "Month view"
  const viewingPast = periodTab === "quarter" ? false : isPastTodoPeriod(periodTab, focusedDate)
  const undoneIds =
    periodTab === "quarter"
      ? new Set<string>()
      : new Set(undoneByPeriod[periodTab].map((todo) => todo.taskId ?? todo.id))
  const openCount =
    activeTodoTab === "other"
      ? activeRange ? tasksInRange(tasks, activeRange.range.id).filter((t) => isOpen(t) && !isClearedFromWork(t)).length : 0
      : periodTab === "quarter"
      ? (season?.seasonOpen.length ?? 0)
      : viewingPast
        ? filteredByPeriod[periodTab].filter((todo) => !undoneIds.has(todo.taskId ?? todo.id)).length
        : filteredByPeriod[periodTab].length
  const undoneCount = periodTab === "quarter" ? 0 : undoneByPeriod[periodTab].length
  const inProgressCount = countInProgress(tasks)
  const stripShown = activeTodoTab !== "other" && periodTab !== "quarter"
  const activeFilterCount = [
    availableNow,
    showAllTasks,
    hideLocked,
    showNextOnly,
    tierView !== "all",
    statusFilter !== DEFAULT_TODO_PREFS.statusFilter,
  ].filter(Boolean).length
  // One phosphor line in the header glass: working hours left · estimate · comfort word.
  const headerLoad = (() => {
    if (activeTodoTab === "other") return null
    const figures =
      periodTab === "quarter"
        ? season
          ? { minutes: season.seasonEstimate.minutes, hours: season.seasonHours, ratio: season.seasonRatio, band: season.seasonBand }
          : null
        : (() => {
            const load = periodLoad(periodTab)
            return { minutes: load.estimate.minutes, hours: load.hours, ratio: load.ratio, band: load.band }
          })()
    if (!figures) return null
    const t = comfortDialT(figures.ratio)
    return {
      text: `${formatWorkingHours(figures.hours)} left · ${formatMinutesAsHours(figures.minutes)} est · ${comfortWord(figures.band)}`,
      angle: ((-90 + t * 180) * Math.PI) / 180,
      overCap: inProgressCount > wipLimit,
    }
  })()

  return (
    <div
      className="todo95"
      data-ui-name="To Do"
      data-ui-help="Day, week, month, and season tasks. Season lists work scheduled in that quarter."
      data-season={periodTab === "quarter" ? seasonSlug(seasonOfDate(focusedDate)) : undefined}
      data-ui-docs="components/Home/ToDo/README.md"
    >
      {clockStop.dialog}
      <div className="todo-window">
        <Tabs
          value={activeTodoTab}
          className="todo-tabs"
          onValueChange={(v) => {
            const next = v as TodoTab
            if (next === activeTodoTab) return
            setActiveTodoTab(next)
            setOpenRowId(null)
            setSelectedRowId(null)
            // One search box and one formula panel serve every lens; neither follows you to the next one.
            setAssignedQuery("")
            setShowFormula(false)
            if (prefersReduced()) return
            setPeriodFolding(true)
            later(() => setPeriodFolding(false), 180)
          }}
        >
          <div
            className="todo-fascia"
            data-ui-name="To Do fascia"
            data-ui-help="Title, period nameplate, period keys, and Show / Sort / Pace."
            data-ui-docs="components/Home/ToDo/README.md"
            data-ui-docs-anchor="instrument-layout"
          >
            <div className="todo-fascia-row is-screen">
              <div className="todo-screen">
                <div className="todo-mark">
                  <img src={orbFor("home-todo")} alt="" className="todo-title-orb" />
                  <h2>{todoHeading}</h2>
                  <span className="todo-mark-count" title="Open">{openCount}</span>
                </div>
                {headerLoad ? (
                  <button
                    type="button"
                    data-no95
                    className={`todo-load-readout${headerLoad.overCap ? " is-over-cap" : ""}`}
                    aria-expanded={loadOpen}
                    aria-label={`Load: ${headerLoad.text}. ${loadOpen ? "Hide" : "Show"} the load instrument`}
                    title={loadOpen ? "Hide the load instrument" : "Time, comfort and scope"}
                    onClick={() => setTodoPrefs({ loadOpen: !loadOpen })}
                  >
                    <svg className="todo-load-needle" viewBox="0 0 26 14" aria-hidden="true">
                      <path d="M2 13 A11 11 0 0 1 24 13" fill="none" stroke="#3f9c74" strokeWidth="1.5" />
                      <path d={`M13 13 L${(13 + Math.sin(headerLoad.angle) * 9).toFixed(1)} ${(13 - Math.cos(headerLoad.angle) * 9).toFixed(1)}`} stroke="#7dffc4" strokeWidth="1.6" />
                      <circle cx="13" cy="13" r="1.6" fill="#7dffc4" />
                    </svg>
                    <span className="todo-load-readout-text">{headerLoad.text}</span>
                    {headerLoad.overCap ? (
                      <span className="todo-load-readout-wip" title={`${inProgressCount} in progress, over the soft cap of ${wipLimit}`}>
                        {inProgressCount} in progress
                      </span>
                    ) : null}
                    <span className="todo-load-caret" aria-hidden>
                      {loadOpen ? "▴" : "▾"}
                    </span>
                  </button>
                ) : null}
              </div>
              <TodoSettingsDialog
                paceSlot={
                  <PaceSettings
                    samples={todoTime.samples}
                    overrides={todoTime.paceOverrides}
                    ghosts={todoTime.paceGhosts}
                    scopes={todoTime.scopes}
                  />
                }
              />
            </div>
            <div className="todo-fascia-row is-keys">
              {activeTodoTab === "other" ? (
                <TodoRangeNav />
              ) : periodTab === "quarter" ? (
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
                  period={periodTab}
                  focusedDate={focusedDate}
                  onFocusedDateChange={setFocusedDate}
                />
              )}
              <div className="todo-span">
                <span className="todo-span-legend" aria-hidden>
                  Span
                </span>
                <TabsList
                  className="todo-view-keys"
                  data-ui-name="Period keys"
                  data-ui-help="Day, week, month, season, and Other (your own named ranges). Each key shows the span it covers."
                  data-ui-docs="components/Home/ToDo/README.md"
                  data-ui-docs-anchor="data"
                >
                  {SPAN_KEYS.map(({ value, word }) => (
                    <TabsTrigger key={value} value={value} aria-label={word} className="todo-span-key">
                      <span className="todo-span-lamp" aria-hidden />
                      <span className="todo-span-word">{word}</span>
                      <small className="todo-span-sub" aria-hidden>
                        {spanSubLabel(value, focusedDate)}
                      </small>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <span className="todo-keys-grow" aria-hidden />
              <div className="todo-actions" role="group" aria-label="Task actions">
                {activeTodoTab !== "other" && (
                  <AddTodoDialog
                    onAdd={handleAddTodo}
                    searchExisting={searchExistingTasks}
                    onPickExisting={pickExistingTask}
                    onOpenPickList={() => setSessionOpen("list")}
                  />
                )}
                <span className="todo-actions-pair">
                  <SessionKey onOpen={() => setSessionOpen("session")} />
                  <SessionsKey onOpen={() => setSessionOpen("shelves")} />
                </span>
              </div>
              {stripShown && (
                <div className="todo-show-keys">
                  <button
                    type="button"
                    data-no95
                    className={`todo-cap is-mod todo-show-key${activeFilterCount > 0 ? " is-lit" : ""}`}
                    aria-expanded={showTrayOpen}
                    aria-controls="todo-show-tray"
                    aria-label={`Show filters${activeFilterCount > 0 ? `, ${activeFilterCount} on` : ""}`}
                    title="Filters: Available now, All tasks, Hide locked, Show next only, Tier, Status, Formula, Open list"
                    onClick={() => setTodoPrefs({ showTrayOpen: !showTrayOpen })}
                  >
                    <span className="todo-show-lamp" aria-hidden />
                    Show{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
                  </button>
                  <TodoSortKeys
                    period={periodTab}
                    sortMode={sortMode}
                    onSortModeChange={(mode) => setTodoPrefs({ sortMode: mode, sortOrder: DEFAULT_TODO_SORT_ORDER[mode] })}
                    sortOrder={sortOrder}
                    onSortOrderChange={(order) => setTodoPrefs({ sortOrder: order })}
                  />
                </div>
              )}
            </div>
            {stripShown && (
              <div className="todo-fascia-tray" id="todo-show-tray" hidden={!showTrayOpen}>
                <TodoFilters
                  period={periodTab}
                  availableNow={availableNow}
                  onAvailableNowChange={(value) => setTodoPrefs({ availableNow: value })}
                  showAllTasks={showAllTasks}
                  onShowAllTasksChange={(value) => setTodoPrefs({ showAllTasks: value })}
                  statusFilter={statusFilter}
                  onStatusFilterChange={(value) => setTodoPrefs({ statusFilter: value })}
                  onToggleFormula={() => setShowFormula((v) => !v)}
                  listName={periodTodoListName(periodTab, todoPeriodValue(periodTab, focusedDate))}
                  onOpenList={() => openPeriodTodoList(periodTab, todoPeriodValue(periodTab, focusedDate))}
                />
              </div>
            )}
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

          {showFormula && activeTodoTab !== "other" && periodTab !== "quarter" && <PriorityFormulaPanel />}

          <div className="todo-stage">
            <div className="todo-body">
              <TabsContent value="day">{periodTab === "day" ? renderTab("day") : null}</TabsContent>
              <TabsContent value="week">{periodTab === "week" ? renderTab("week") : null}</TabsContent>
              <TabsContent value="month">{periodTab === "month" ? renderTab("month") : null}</TabsContent>
              <TabsContent value="other">
                {activeTodoTab === "other" ? (
                  <TodoRangeSheet onOpenTask={openTask} onComplete={(id) => completeTask(id)} />
                ) : null}
              </TabsContent>
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
                  {loadOpen && (
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
                  )}
                  <div className="todo-ledger">
                    {season.seasonRequired.length > 0 && (
                    <section
                      className="todo-band is-required"
                      role="region"
                      aria-label="Required"
                      data-ui-name="Required"
                      data-ui-help="Marked required for this season."
                      data-ui-docs="components/Home/ToDo/README.md"
                      data-ui-docs-anchor="required-prioritized-assigned"
                    >
                      <h4 className="todo-list-title is-required">
                        Required <span className="todo-list-count">{season.seasonRequired.length}</span>
                      </h4>
                      <ul className="todo-season-list">
                        {season.seasonRequired.map((task) => renderSeasonRow(task))}
                      </ul>
                    </section>
                    )}
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
                              : "Nothing scheduled in this season yet. Add a task to place it on this month, or the season's first month."}
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
            {activeTodoTab === "other"
              ? `Other view · ${activeRange ? `before ${activeRange.name}` : "no range yet"}`
              : periodTab === "quarter" ? `${periodLabel} · ${seasonLabel}` : `${periodLabel} · ${getPeriodNavLabel(periodTab, focusedDate)}`}
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
      <RitualWalkDialog placement={ritualWalk} onClose={() => setRitualWalk(null)} />
      <MissReasonDialog
        open={reasonAsk !== null}
        subject={reasonAsk?.subject ?? ""}
        onResolve={(reason) => {
          const apply = reasonAsk?.apply
          setReasonAsk(null)
          apply?.(reason)
        }}
      />

      {taskClock.picker}
      <TaskCard host={taskCardHost} />
      <TaskPrereqDialog taskId={prereqTaskId} onClose={() => setPrereqTaskId(null)} />
      {sessionOpen ? (
        <SessionPlanner
          open
          startOn={sessionOpen}
          onClose={() => setSessionOpen(false)}
          periodLabel={sessionPeriod.label}
          periodTasks={sessionPeriod.tasks}
        />
      ) : null}
      {justStartTaskId && (
        <JustStartMode taskId={justStartTaskId} onClose={() => setJustStartTaskId(null)} />
      )}
    </div>
  )
}
