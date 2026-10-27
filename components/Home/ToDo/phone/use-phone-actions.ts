/**
 * components/Home/ToDo/phone/use-phone-actions.ts — Phone To Do verbs, flock timers, and the clock stop.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { quarterKey, quarterStartDate } from "@/lib/seasons"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { completionWindow } from "@/lib/completion-window"
import { emitTaskCompleted } from "@/lib/completion-events"
import { effectiveStatus, isOpen, withStatus } from "@/lib/completion-status"
import { formatLocalDateKey, getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { makeEstimate } from "@/lib/estimated-values"
import { itemTitleOrUntitled, resolveCompletionPoints } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import { assimilateUndoneFields, discardUndoneFields, pushUndoneFields } from "@/lib/scheduling"
import { isRitualTodoId, type RitualDayBoard, type RitualTodoPlacement } from "@/lib/ritual-todo"
import { offerPenDebrief } from "@/lib/session-debrief"
import { confirmTaskTimes, type ConfirmedTimes } from "@/lib/services/completion-time-service"
import { completeTask, markMissedOpportunity } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { settleStepPoints } from "@/lib/step-points"
import { stopTaskClock } from "@/lib/task-clock"
import { registerTaskCardHost } from "@/lib/task-card"
import {
  nextPriorityIds,
  patchTodoCommitment,
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
} from "@/lib/todo-commitment"
import type { CompletionStatus, Folder, List, StepTier, StoredBlockedReason, Subtask, Task, TodoItem } from "@/lib/types"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { activeNowObjectives } from "@/lib/now-objective"
import { useReviewsStore } from "@/lib/reviews-store"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import type { ExistingTaskHit, NewTodoDraft } from "../AddTodoDialog"
import { createScheduledTodoTask, getMonthKey, tierToUrgencyImportance, todoPeriodValue, type TodoPeriod } from "../todo-utils"
import type { useTodoTime } from "../use-todo-time"
import { DEFAULT_LOGGED_DONE_MINUTES, type TodoTab } from "./phone-constants"

type PeriodTab = Exclude<TodoTab, "other">

export function usePhoneActions(input: {
  tasks: Task[]
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  categories: List[]
  folders: Folder[]
  periodTab: PeriodTab
  activeTodoTab: TodoTab
  focusedDate: Date
  filteredByPeriod: Record<TodoPeriod, TodoItem[]>
  ritualBoard: RitualDayBoard
  morningPriorities: readonly string[]
  todoTime: Pick<ReturnType<typeof useTodoTime>, "settle">
  setRitualWalk: (placement: RitualTodoPlacement | null) => void
  setOpenRowId: (value: string | null | ((id: string | null) => string | null)) => void
  setFlockingId: (id: string | null) => void
  setMissedSectionsOpen: (value: Record<TodoPeriod, boolean> | ((prev: Record<TodoPeriod, boolean>) => Record<TodoPeriod, boolean>)) => void
  setDoneSectionsOpen: (value: Record<TodoPeriod, boolean> | ((prev: Record<TodoPeriod, boolean>) => Record<TodoPeriod, boolean>)) => void
  setSelectedTaskId: (id: string | null) => void
}) {
  const {
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
  } = input

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

  const onQuickAdd = (description: string, tier: TodoItem["tier"], focusFirstStep: boolean) => {
    const phoneLens = activeTodoTab === "other" ? "other" : periodTab === "quarter" ? "season" : "period"
    const phonePeriod: TodoPeriod = periodTab === "quarter" ? "month" : periodTab
    if (phoneLens !== "period") return
    const created = createScheduledTodoTask({ description, tier, period: phonePeriod, date: focusedDate })
    addTask(created)
    if (focusFirstStep) window.setTimeout(() => setOpenRowId(created.id), 0)
  }

  return {
    seasonMonthDate,
    handleAddTodo,
    searchExistingTasks,
    pickExistingTask,
    handleAddDone,
    handleConfirmTimes,
    openRitual,
    handleComplete,
    handleRename,
    reasonAsk,
    setReasonAsk,
    handleMissed,
    handleTierChange,
    handlePush,
    handleDelete,
    handleEstimate,
    handleSteps,
    resolveUndone,
    getStatus,
    openTask,
    handleCommitment,
    handleStatusChange,
    clockStop,
    onQuickAdd,
  }
}
