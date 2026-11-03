/**
 * components/Home/ToDo/desk/use-todo-desk.ts — Desk state for one mount
 *
 * Called once from `TodoDeskPanel`. Hook order, top to bottom: pen sync, store
 * selectors and the priority sweep, dialog state and the pen clock, the lens,
 * prefs and chrome state, the board, the verbs (flock timers included), then
 * `taskCardHost`. The returned object is not memoized.
 */
"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { usePenActionSync } from "@/lib/pen-action-sync"
import { sweepStaleTaskPriorities } from "@/components/Home/ToDo/priority-star-sweep"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import type { RitualTodoPlacement } from "@/lib/ritual-todo"
import type { TaskCardHost } from "../task-card/TaskCard"
import type { TodoItem } from "@/lib/types"
import { taskIsPrioritized, taskIsRequired, todoPeriodKey, workingHoursLeft, type EstimateScope } from "@/lib/todo-commitment"
import { useTodoPrefs } from "../todo-prefs"
import { useTodoRanges } from "../ranges/TodoRangeSheet"
import { useTodoTime } from "../use-todo-time"
import { useRitesSun } from "../use-rites-sun"
import type { TodoPeriod } from "../todo-utils"
import { useTodoDeskLens } from "./use-todo-desk-lens"
import { useTodoDeskBoard } from "./use-todo-desk-board"
import { useTodoDeskActions } from "./use-todo-desk-actions"

export function useTodoDesk(controlledDate?: Date, setControlledDate?: (date: Date) => void) {
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
  const lens = useTodoDeskLens(controlledDate, setControlledDate)
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
  const board = useTodoDeskBoard({
    sessionOpen,
    tasks,
    periodTab: lens.periodTab,
    focusedDate: lens.focusedDate,
    reviews,
    starReports,
    birthday,
    ritesFollowSun,
    peekHidden,
    hideLocked,
    availableNow,
    ritesSun,
    showAllTasks,
    statusFilter,
    lockFilterOn,
    sortMode,
    sortOrder,
    priorityWeights,
    folders,
    estimateScope,
    assignedQuery,
  })
  const actions = useTodoDeskActions({
    tasks,
    addTask,
    updateTask,
    deleteTask,
    categories,
    folders,
    periodTab: lens.periodTab,
    focusedDate: lens.focusedDate,
    filteredByPeriod: board.filteredByPeriod,
    morningPriorities: board.morningPriorities,
    ritualBoard: board.ritualBoard,
    todoTime,
    setOpenRowId,
    setFlockingId,
    setDoneSectionsOpen,
    setMissedSectionsOpen,
    setRitualWalk,
    setSelectedTaskId,
    setJustStartTaskId,
  })

  // Phase 12: the task card borrows the panel's handlers for the lens it opened on.
  // Push counts read a ledger period (season reads month); Required and Prioritized
  // follow the lens itself, so the card and the season lid flip the same marks.
  const cardPeriod: TodoPeriod = lens.periodTab === "quarter" ? "month" : lens.periodTab
  const markPeriod = lens.periodTab
  const markKey = todoPeriodKey(markPeriod, lens.focusedDate)
  const taskCardHost: TaskCardHost = {
    period: cardPeriod,
    periodLabel: { day: "This day", week: "This week", month: "This month", quarter: "This season" }[markPeriod],
    focusedDate: lens.focusedDate,
    isRequired: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsRequired(t, markPeriod, markKey)
    },
    isPrioritized: (id) => {
      const t = tasks.find((x) => x.id === id)
      return !!t && taskIsPrioritized(t, markPeriod, markKey, markPeriod === "day" ? board.morningPriorities : undefined)
    },
    onToggleRequired: (id) => actions.handleCommitment(id, markPeriod, "required"),
    onTogglePrioritized: (id) => actions.handleCommitment(id, markPeriod, "prioritized"),
    onStepsChange: actions.handleSteps,
    onJustStart: (id) => setJustStartTaskId(id),
    onNeeds: setPrereqTaskId,
    timeOf: (id) => todoTime.timeOf(id),
    clockTaskId,
    clockStepId,
    onClockStart: taskClock.start,
    onClockStop: () => actions.clockStop.request(),
    defaultEstimateMin,
    hoursLeft: workingHoursLeft("day", new Date()),
  }

  return {
    tasks,
    updateTask,
    addTask,
    todoPrefs,
    todoRanges,
    availableNow,
    wipLimit,
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
    peekHidden,
    setPeekHidden,
    todoTime,
    showFormula,
    setShowFormula,
    estimateScope,
    setEstimateScope,
    assignedQuery,
    setAssignedQuery,
    expandedPeriods,
    setExpandedPeriods,
    doneSectionsOpen,
    setDoneSectionsOpen,
    missedSectionsOpen,
    setMissedSectionsOpen,
    undoneSectionsOpen,
    setUndoneSectionsOpen,
    openRowId,
    setOpenRowId,
    selectedRowId,
    setSelectedRowId,
    flockingId,
    composerName,
    setComposerName,
    composerTier,
    setComposerTier,
    periodFolding,
    setPeriodFolding,
    sheetScrollRef,
    selectedTaskId,
    setSelectedTaskId,
    ritualWalk,
    setRitualWalk,
    justStartTaskId,
    setJustStartTaskId,
    prereqTaskId,
    setPrereqTaskId,
    sessionOpen,
    setSessionOpen,
    clockTaskId,
    clockStepId,
    taskClock,
    taskCardHost,
    ...lens,
    ...board,
    ...actions,
  }
}

export type TodoDesk = ReturnType<typeof useTodoDesk>
