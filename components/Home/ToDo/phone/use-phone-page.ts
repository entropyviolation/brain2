/**
 * components/Home/ToDo/phone/use-phone-page.ts — The one hook the phone To Do page calls.
 *
 * Hook order matches the page before the split. The desk remnant is built and discarded.
 */
"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { useTaskStore } from "@/lib/task-store"
import { sweepStaleTaskPriorities } from "@/components/Home/ToDo/priority-star-sweep"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import type { RitualTodoPlacement } from "@/lib/ritual-todo"
import { isOpen } from "@/lib/completion-status"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { useStarLordStore } from "@/lib/star-lord-store"
import { quarterKey, taskTouchesQuarter } from "@/lib/seasons"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  comfortBand,
  comfortRatio,
  hoursLeftInPeriod,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  workingHoursLeft,
  type EstimateScope,
} from "@/lib/todo-commitment"
import { taskMatchesAssignedQuery } from "@/lib/todo-steps"
import type { TodoItem } from "@/lib/types"
import { useTodoPrefs } from "../todo-prefs"
import { useTodoRanges } from "../TodoRangeSheet"
import { useRitesSun } from "../use-rites-sun"
import { useTodoTime } from "../use-todo-time"
import { pinPrioritizedFirst, type TodoPeriod } from "../todo-utils"
import { bindPhoneDeskRemnant } from "./phone-desk-remnant"
import { EMPTY_PRIORITY_IDS } from "./phone-constants"
import {
  doneByPeriodFor,
  filteredTodosByPeriod,
  lockedHiddenByPeriodFor,
  missedByPeriodFor,
  morningTasksFor,
  openRitualBoardFor,
  ritualBoardFor,
  sessionPickList,
  sunHiddenCountFor,
  todoItemsFor,
  undoneByPeriodFor,
} from "./phone-lists"
import { periodLoadFor } from "./phone-load"
import { buildPhoneTaskCardHost } from "./phone-task-card-host"
import { usePhoneActions } from "./use-phone-actions"
import { usePhoneFocus } from "./use-phone-focus"

export function usePhonePageModel({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  usePenActionSync()
  const tasks = useTaskStore((s) => s.tasks)
  const reviews = useReviewsStore((s) => s.reviews)
  useLayoutEffect(() => {
    sweepStaleTaskPriorities()
  }, [tasks, reviews])
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
  const { activeTodoTab, setActiveTodoTab, periodTab, focusedDate, setFocusedDate } = usePhoneFocus({
    controlledDate,
    setControlledDate,
  })
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
  const sessionPeriod = useMemo(
    () => sessionPickList({ sessionOpen, tasks, periodTab, focusedDate }),
    [sessionOpen, tasks, periodTab, focusedDate],
  )
  const focusedDayKey = localDayKey(focusedDate)
  const ritualBoard = useMemo(
    () => ritualBoardFor(focusedDate, reviews, starReports, birthday),
    [focusedDate, reviews, starReports, birthday],
  )
  const openRitualBoard = useMemo(
    () => openRitualBoardFor(ritualBoard, ritesFollowSun, peekHidden, ritesSun.now, ritesSun.sunsetMinutes),
    [ritualBoard, ritesFollowSun, peekHidden, ritesSun.now, ritesSun.sunsetMinutes],
  )
  const sunHiddenCount = sunHiddenCountFor(ritualBoard, ritesFollowSun, ritesSun.now, ritesSun.sunsetMinutes)
  const morningPriorities = useReviewsStore(
    (s) => s.getMorningReview(focusedDayKey)?.priorityTaskIds ?? EMPTY_PRIORITY_IDS,
  )
  const morningTasks = useMemo(
    () => morningTasksFor(morningPriorities, tasks),
    [morningPriorities, tasks],
  )
  const todoItems = useMemo(
    () => todoItemsFor(tasks, showAllTasks, focusedDate),
    [tasks, showAllTasks, focusedDate],
  )
  const filteredByPeriod = useMemo(
    () =>
      filteredTodosByPeriod({
        todoItems,
        showAllTasks,
        focusedDate,
        tasks,
        statusFilter,
        lockFilterOn,
        sortMode,
        sortOrder,
        priorityWeights,
        openRitualBoard,
        morningPriorities,
      }),
    [todoItems, showAllTasks, statusFilter, lockFilterOn, sortMode, sortOrder, tasks, priorityWeights, focusedDate, openRitualBoard, morningPriorities],
  )
  const lockedHiddenByPeriod = useMemo(
    () =>
      lockedHiddenByPeriodFor({
        hideLocked,
        availableNow,
        todoItems,
        showAllTasks,
        focusedDate,
        tasks,
        statusFilter,
      }),
    [hideLocked, availableNow, todoItems, showAllTasks, focusedDate, tasks, statusFilter],
  )
  const doneByPeriod = useMemo(
    () => doneByPeriodFor(tasks, focusedDate, folders, ritualBoard),
    [tasks, focusedDate, folders, ritualBoard],
  )
  const missedByPeriod = useMemo(
    () => missedByPeriodFor(tasks, focusedDate),
    [tasks, focusedDate],
  )
  const undoneByPeriod = useMemo(
    () => undoneByPeriodFor(tasks, focusedDate),
    [tasks, focusedDate],
  )
  const actions = usePhoneActions({
    tasks,
    addTask,
    updateTask,
    deleteTask,
    categories,
    folders,
    periodTab,
    activeTodoTab,
    focusedDate,
    filteredByPeriod,
    ritualBoard,
    morningPriorities,
    todoTime,
    setRitualWalk,
    setOpenRowId,
    setFlockingId,
    setMissedSectionsOpen,
    setDoneSectionsOpen,
    setSelectedTaskId,
  })
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

  const periodLoad = (period: TodoPeriod) =>
    periodLoadFor({
      period,
      focusedDate,
      undoneByPeriod,
      filteredByPeriod,
      tasks,
      morningPriorities,
      estimateScope,
    })

  const taskCardHost = buildPhoneTaskCardHost({
    periodTab,
    focusedDate,
    tasks,
    morningPriorities,
    handleCommitment: actions.handleCommitment,
    handleSteps: actions.handleSteps,
    setJustStartTaskId,
    setPrereqTaskId,
    todoTime,
    clockTaskId,
    clockStepId,
    onClockStart: taskClock.start,
    onClockStop: () => actions.clockStop.request(),
    defaultEstimateMin,
  })

  const remnant = bindPhoneDeskRemnant({
    periodLoad,
    tasks,
    updateTask,
    addTask,
    bgeTiers,
    doneByPeriod,
    missedByPeriod,
    undoneByPeriod,
    assignedQuery,
    setAssignedQuery,
    defaultEstimateMin,
    handleComplete: actions.handleComplete,
    handleMissed: actions.handleMissed,
    handlePush: actions.handlePush,
    handleDelete: actions.handleDelete,
    handleEstimate: actions.handleEstimate,
    handleSteps: actions.handleSteps,
    todoTime,
    openTask: actions.openTask,
    handleTierChange: actions.handleTierChange,
    openRitual: actions.openRitual,
    setJustStartTaskId,
    getStatus: actions.getStatus,
    handleStatusChange: actions.handleStatusChange,
    handleCommitment: actions.handleCommitment,
    handleRename: actions.handleRename,
    openRowId,
    setOpenRowId,
    selectedRowId,
    setSelectedRowId,
    flockingId,
    clockTaskId,
    clockStepId,
    taskClock,
    clockStop: actions.clockStop,
    focusedDate,
    setPrereqTaskId,
    estimateScope,
    setEstimateScope,
    wipLimit,
    composerName,
    setComposerName,
    composerTier,
    setComposerTier,
    expandedPeriods,
    setExpandedPeriods,
    morningTasks,
    setSelectedTaskId,
    lockedHiddenByPeriod,
    sunHiddenCount,
    peekHidden,
    setPeekHidden,
    doneSectionsOpen,
    setDoneSectionsOpen,
    missedSectionsOpen,
    setMissedSectionsOpen,
    undoneSectionsOpen,
    setUndoneSectionsOpen,
    handleAddDone: actions.handleAddDone,
    handleConfirmTimes: actions.handleConfirmTimes,
    periodFolding,
    setPeriodFolding,
    sheetScrollRef,
    loadOpen,
    showTrayOpen,
    season,
  })
  void remnant
  // Written on formula open and cleared on tab change. The phone screen keeps its own sheet state.
  void showFormula

  return {
    activeTodoTab,
    setActiveTodoTab,
    periodTab,
    focusedDate,
    setFocusedDate,
    tasks,
    updateTask,
    ritualBoard,
    morningPriorities,
    morningTasks,
    filteredByPeriod,
    lockedHiddenByPeriod,
    doneByPeriod,
    missedByPeriod,
    undoneByPeriod,
    sunHiddenCount,
    peekHidden,
    setPeekHidden,
    availableNow,
    wipLimit,
    hideLocked,
    showAllTasks,
    statusFilter,
    sortMode,
    sortOrder,
    bgeTiers,
    showNextOnly,
    tierView,
    defaultEstimateMin,
    setShowFormula,
    todoPrefs,
    todoRanges,
    todoTime,
    estimateScope,
    setEstimateScope,
    openRowId,
    setOpenRowId,
    selectedRowId,
    setSelectedRowId,
    setAssignedQuery,
    flockingId,
    doneSectionsOpen,
    setDoneSectionsOpen,
    missedSectionsOpen,
    setMissedSectionsOpen,
    undoneSectionsOpen,
    setUndoneSectionsOpen,
    clockTaskId,
    clockStepId,
    taskClock,
    clockStop: actions.clockStop,
    season,
    periodLoad,
    taskCardHost,
    selectedTaskId,
    setSelectedTaskId,
    ritualWalk,
    setRitualWalk,
    prereqTaskId,
    setPrereqTaskId,
    sessionOpen,
    setSessionOpen,
    sessionPeriod,
    justStartTaskId,
    setJustStartTaskId,
    reasonAsk: actions.reasonAsk,
    setReasonAsk: actions.setReasonAsk,
    openRitual: actions.openRitual,
    handleComplete: actions.handleComplete,
    handleMissed: actions.handleMissed,
    handlePush: actions.handlePush,
    handleDelete: actions.handleDelete,
    handleEstimate: actions.handleEstimate,
    handleSteps: actions.handleSteps,
    handleTierChange: actions.handleTierChange,
    handleStatusChange: actions.handleStatusChange,
    handleCommitment: actions.handleCommitment,
    handleRename: actions.handleRename,
    openTask: actions.openTask,
    getStatus: actions.getStatus,
    resolveUndone: actions.resolveUndone,
    handleAddDone: actions.handleAddDone,
    handleConfirmTimes: actions.handleConfirmTimes,
    handleAddTodo: actions.handleAddTodo,
    searchExistingTasks: actions.searchExistingTasks,
    pickExistingTask: actions.pickExistingTask,
    onQuickAdd: actions.onQuickAdd,
  }
}

export type PhonePageModel = ReturnType<typeof usePhonePageModel>

void 0 as unknown as StepTier
