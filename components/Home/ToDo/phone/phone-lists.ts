/**
 * components/Home/ToDo/phone/phone-lists.ts — Pure list derives for the phone To Do page.
 */
import { isClearedFromWork } from "@/lib/completion-status"
import { formatLocalMonthKey, getWeekString, taskScheduledInMonth, taskScheduledInWeek, taskScheduledOnDay } from "@/lib/date-utils"
import type { Folder, PriorityWeights, Task, TodoItem } from "@/lib/types"
import { ritualBoardFollowingSun, ritualDayBoard, type RitualDayBoard } from "@/lib/ritual-todo"
import {
  taskIsPrioritized,
  taskIsRequired,
  todoPeriodKey,
} from "@/lib/todo-commitment"
import type { TodoTab } from "./phone-constants"
import {
  buildDoneTodoItems,
  buildMissedTodoItems,
  buildTodoItems,
  buildUndoneTodoItems,
  filterAndSortTodos,
  filterTodosAvailableNow,
  filterTodosByStatus,
  sortTodos,
  type TodoPeriod,
  type TodoSortMode,
  type TodoSortOrder,
  type TodoStatusFilter,
} from "../todo-utils"

type PeriodTab = Exclude<TodoTab, "other">

/** Open work on the lens, for the session pick list. Season falls back to every open task. */
export function sessionPickList(input: {
  sessionOpen: false | "session" | "shelves" | "list"
  tasks: Task[]
  periodTab: PeriodTab
  focusedDate: Date
}): { label: string; tasks: Task[] } {
  const { sessionOpen, tasks, periodTab, focusedDate } = input
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
}

export function ritualBoardFor(
  focusedDate: Date,
  reviews: Parameters<typeof ritualDayBoard>[1],
  starReports: Parameters<typeof ritualDayBoard>[2],
  birthday: Parameters<typeof ritualDayBoard>[3],
): RitualDayBoard {
  return ritualDayBoard(focusedDate, reviews, starReports, birthday)
}

/** The open list drops a rite at the wrong end of today. Done, lookups and walks keep the whole board. */
export function openRitualBoardFor(
  ritualBoard: RitualDayBoard,
  ritesFollowSun: boolean,
  peekHidden: boolean,
  now: Date,
  sunsetMinutes: number,
): RitualDayBoard {
  return ritesFollowSun && !peekHidden
    ? ritualBoardFollowingSun(ritualBoard, now, sunsetMinutes)
    : ritualBoard
}

export function sunHiddenCountFor(
  ritualBoard: RitualDayBoard,
  ritesFollowSun: boolean,
  now: Date,
  sunsetMinutes: number,
): number {
  return ritesFollowSun
    ? ritualBoard.tasks.length - ritualBoardFollowingSun(ritualBoard, now, sunsetMinutes).tasks.length
    : 0
}

/** A priority whose task was since deleted drops off the strip instead of showing its id. */
export function morningTasksFor(morningPriorities: readonly string[], tasks: readonly Task[]): Task[] {
  return morningPriorities.flatMap((id) => tasks.find((t) => t.id === id) ?? [])
}

export function todoItemsFor(tasks: Task[], showAllTasks: boolean, focusedDate: Date): TodoItem[] {
  return buildTodoItems(tasks, showAllTasks, focusedDate)
}

export function filteredTodosByPeriod(input: {
  todoItems: TodoItem[]
  showAllTasks: boolean
  focusedDate: Date
  tasks: Task[]
  statusFilter: TodoStatusFilter
  lockFilterOn: boolean
  sortMode: TodoSortMode
  sortOrder: TodoSortOrder
  priorityWeights: PriorityWeights
  openRitualBoard: RitualDayBoard
  morningPriorities: readonly string[]
}): Record<TodoPeriod, TodoItem[]> {
  const {
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
  } = input
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
}

/** Rows Hide locked keeps off each list (only when Available now is not already hiding them). */
export function lockedHiddenByPeriodFor(input: {
  hideLocked: boolean
  availableNow: boolean
  todoItems: TodoItem[]
  showAllTasks: boolean
  focusedDate: Date
  tasks: Task[]
  statusFilter: TodoStatusFilter
}): Record<TodoPeriod, number> {
  const { hideLocked, availableNow, todoItems, showAllTasks, focusedDate, tasks, statusFilter } = input
  const count = (period: TodoPeriod) => {
    if (!hideLocked || availableNow) return 0
    const byStatus = filterTodosByStatus(filterAndSortTodos(todoItems, period, showAllTasks, focusedDate), tasks, statusFilter)
    return byStatus.length - filterTodosAvailableNow(byStatus, tasks, true).length
  }
  return { day: count("day"), week: count("week"), month: count("month") } satisfies Record<TodoPeriod, number>
}

export function doneByPeriodFor(
  tasks: Task[],
  focusedDate: Date,
  folders: Folder[],
  ritualBoard: RitualDayBoard,
): Record<TodoPeriod, TodoItem[]> {
  return {
    day: [
      ...buildDoneTodoItems(ritualBoard.tasks, "day", focusedDate, folders),
      ...buildDoneTodoItems(tasks, "day", focusedDate, folders),
    ],
    week: buildDoneTodoItems(tasks, "week", focusedDate, folders),
    month: buildDoneTodoItems(tasks, "month", focusedDate, folders),
  }
}

export function missedByPeriodFor(tasks: Task[], focusedDate: Date): Record<TodoPeriod, TodoItem[]> {
  return {
    day: buildMissedTodoItems(tasks, "day", focusedDate),
    week: buildMissedTodoItems(tasks, "week", focusedDate),
    month: buildMissedTodoItems(tasks, "month", focusedDate),
  }
}

export function undoneByPeriodFor(tasks: Task[], focusedDate: Date): Record<TodoPeriod, TodoItem[]> {
  return {
    day: buildUndoneTodoItems(tasks, "day", focusedDate),
    week: buildUndoneTodoItems(tasks, "week", focusedDate),
    month: buildUndoneTodoItems(tasks, "month", focusedDate),
  }
}
