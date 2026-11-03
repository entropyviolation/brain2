/**
 * components/Home/ToDo/desk/use-todo-desk-board.ts — Derived To Do board
 *
 * Session list, rites, morning priorities, period filters, and the season
 * memo. The season memo returns null unless the lens is season. Rites are
 * prepended on the day list only. Done keeps the full ritual board.
 */
"use client"

import { useMemo } from "react"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import { isClearedFromWork, isOpen } from "@/lib/completion-status"
import { formatLocalMonthKey, getWeekString, taskScheduledInMonth, taskScheduledInWeek, taskScheduledOnDay } from "@/lib/date-utils"
import { quarterKey, taskTouchesQuarter } from "@/lib/seasons"
import { ritualBoardFollowingSun, ritualDayBoard } from "@/lib/ritual-todo"
import type { Folder, PeriodReview, PriorityWeights, Task, TodoItem } from "@/lib/types"
import type { StarLordReport } from "@/lib/star-lord"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  comfortBand,
  comfortRatio,
  hoursLeftInPeriod,
  summedEstimate,
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
  workingHoursLeft,
  type EstimateScope,
} from "@/lib/todo-commitment"
import { taskMatchesAssignedQuery } from "@/lib/todo-steps"
import {
  buildDoneTodoItems,
  buildMissedTodoItems,
  buildTodoItems,
  buildUndoneTodoItems,
  filterAndSortTodos,
  filterTodosAvailableNow,
  filterTodosByStatus,
  pinPrioritizedFirst,
  sortTodos,
  type TodoPeriod,
  type TodoSortMode,
  type TodoSortOrder,
  type TodoStatusFilter,
} from "../todo-utils"
import type { useRitesSun } from "../use-rites-sun"
import { EMPTY_PRIORITY_IDS, type TodoTab } from "./todo-desk-constants"

export function useTodoDeskBoard(input: {
  sessionOpen: false | "session" | "shelves" | "list"
  tasks: Task[]
  periodTab: Exclude<TodoTab, "other">
  focusedDate: Date
  reviews: PeriodReview[]
  starReports: StarLordReport[]
  birthday: string
  hideLocked: boolean
  availableNow: boolean
  ritesFollowSun: boolean
  peekHidden: boolean
  ritesSun: ReturnType<typeof useRitesSun>
  showAllTasks: boolean
  statusFilter: TodoStatusFilter
  lockFilterOn: boolean
  sortMode: TodoSortMode
  sortOrder: TodoSortOrder
  priorityWeights: PriorityWeights
  folders: Folder[]
  estimateScope: EstimateScope
  assignedQuery: string
}) {
  const {
    sessionOpen,
    tasks,
    periodTab,
    focusedDate,
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
  } = input

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

  return {
    sessionPeriod,
    ritualBoard,
    openRitualBoard,
    sunHiddenCount,
    morningPriorities,
    morningTasks,
    filteredByPeriod,
    lockedHiddenByPeriod,
    doneByPeriod,
    missedByPeriod,
    undoneByPeriod,
    season,
  }
}
