/**
 * components/Home/Plan/planned-tasks-sidebar.tsx — Planned tasks rail
 *
 * Context-aware Explorer rail for Plan month/week/day. Each mode shows tasks
 * that belong in that period but haven't been placed on a finer schedule yet,
 * plus incomplete habits and Lists Next Actions that can be worked in that
 * period. Day / week / month share search, sort, To Do / Habits / Next actions
 * filters, packed wells, gems, and period quick-add (the same records as
 * Home → To Do). Empty stays reserved furniture. Day-rail rows write
 * `lib/plan-drag.ts` so a drop on the agenda actually plans. Habits show
 * `HabitRowGem` / `resolveTaskGem`; To Do and Next actions show the Lists
 * orb/trinket (`iconFor` through `HabitGemImg`). Double-click any row opens
 * `TaskDetailPopup` via `onTaskClick` — same path as the rest of Plan.
 */
"use client"

import type React from "react"
import { useMemo, useRef, useState } from "react"
import { format, startOfMonth } from "date-fns"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useEventStore } from "@/lib/event-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatLocalDateKey, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import {
  isMonthOnlyPlanned,
  isWeekOnlyPlanned,
  isDayUnscheduledPlanned,
  itemTitle,
} from "@/lib/item-utils"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt } from "@/lib/habit-exemption"
import { isDailyHabit } from "@/lib/habit-points"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { readPlanDrag } from "@/lib/plan-drag"
import { nextActionMeta, nextActionsForPlanPeriod } from "@/lib/plan-rail-next-actions"
import { ifNotPlanDragClick, planRailDragProps, usePlanPointerDrop } from "./use-plan-rail-drag"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import type { Task, WeeklyTask } from "@/lib/types"
import { iconFor } from "@/components/Icons"
import { HabitGemImg, HabitRowGem } from "@/components/Home/Habits/habit-gems"
import {
  CAPACITY_PIPS,
  capacityPipCount,
  formatCapacityLine,
  plannedMinutesForDay,
  wakingWindowMinutes,
} from "./plan-capacity"

export type PlannedSidebarMode = "month" | "week" | "day"
type RailSort = "name" | "duration" | "created"

interface PlannedTasksSidebarProps {
  mode: PlannedSidebarMode
  currentDate: Date
  onTaskClick: (taskId: string) => void
  onUnscheduleTask?: (taskId: string) => void
  onUnscheduleEvent?: (eventId: string) => void
  onUnschedulePlannedAction?: (actionId: string) => void
}

function matchesQuery(query: string, ...fields: Array<string | undefined>): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => (field ?? "").toLowerCase().includes(q))
}

function sortTasks(tasks: Task[], sortMode: RailSort): Task[] {
  const copy = [...tasks]
  copy.sort((a, b) => {
    if (sortMode === "duration") return (a.estimatedDuration ?? 0) - (b.estimatedDuration ?? 0)
    if (sortMode === "created") {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
      return aTime - bTime
    }
    return itemTitle(a).localeCompare(itemTitle(b))
  })
  return copy
}

function sortHabits(habits: WeeklyTask[], sortMode: RailSort): WeeklyTask[] {
  const copy = [...habits]
  copy.sort((a, b) => {
    if (sortMode === "duration") return 0
    if (sortMode === "created") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return aTime - bTime
    }
    return a.name.localeCompare(b.name)
  })
  return copy
}

function habitMeta(mode: PlannedSidebarMode): string {
  if (mode === "week") return "Weekly habit"
  if (mode === "month") return "Monthly habit"
  return "Daily habit"
}

function addLabel(mode: PlannedSidebarMode): string {
  if (mode === "week") return "Add a to-do for this week"
  if (mode === "month") return "Add a to-do for this month"
  return "Add a to-do for this day"
}

/** Lists orb/trinket at the same 16px rail cut as habit gems. */
function RailListOrb({ task }: { task: Pick<Task, "id" | "icon"> }) {
  return <HabitGemImg src={iconFor(task.id, task.icon)} className="plan-rail-gem" width={16} height={16} />
}

export function PlannedTasksSidebar({
  mode,
  currentDate,
  onTaskClick,
  onUnscheduleTask,
  onUnscheduleEvent,
  onUnschedulePlannedAction,
}: PlannedTasksSidebarProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const folders = useTaskStore((s) => s.folders)
  const addTask = useTaskStore((s) => s.addTask)
  const events = useEventStore((s) => s.events)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const nights = useSleepStore((s) => s.nights)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const [showHabits, setShowHabits] = useState(true)
  const [showTodos, setShowTodos] = useState(true)
  const [showNextActions, setShowNextActions] = useState(true)
  const [newTodoText, setNewTodoText] = useState("")
  const [query, setQuery] = useState("")
  const [sortMode, setSortMode] = useState<RailSort>("name")
  const railRef = useRef<HTMLElement>(null)

  const monthKey = format(currentDate, "yyyy-MM")
  const weekKey = getWeekString(currentDate)
  const dayKey = formatLocalDateKey(currentDate)
  const weekStart = getWeekStartDate(currentDate)
  const monthStart = startOfMonth(currentDate)

  const plannedTasks = useMemo(() => {
    switch (mode) {
      case "month":
        return tasks.filter((t) => isMonthOnlyPlanned(t, monthKey))
      case "week":
        return tasks.filter((t) => isWeekOnlyPlanned(t, weekKey))
      case "day":
        return tasks.filter((t) => isDayUnscheduledPlanned(t, currentDate))
      default:
        return []
    }
  }, [tasks, mode, monthKey, weekKey, currentDate])

  const incompleteHabits = useMemo(() => {
    if (mode === "day") {
      return habitTasks.filter((habit: WeeklyTask) => {
        if (!isDailyHabit(habit)) return false
        const c = weeklyData[dayKey]?.[habit.id]
        if (isHabitPeriodExempt(habit, dayKey, "daily", habitExemptions)) return false
        return !isHabitGoalMet(habit, c, { date: currentDate, weeklyData })
      })
    }
    if (mode === "week") {
      return habitTasks.filter((habit: WeeklyTask) => {
        if ((habit.frequency || "daily") !== "weekly") return false
        const c = weeklyHabitData[weekKey]?.[habit.id]
        if (isHabitPeriodExempt(habit, weekKey, "weekly", habitExemptions)) return false
        return !isHabitGoalMet(habit, c, { date: weekStart, weeklyData: weeklyHabitData })
      })
    }
    return habitTasks.filter((habit: WeeklyTask) => {
      if (habit.frequency !== "monthly") return false
      const c = monthlyHabitData[monthKey]?.[habit.id]
      if (isHabitPeriodExempt(habit, monthKey, "monthly", habitExemptions)) return false
      return !isHabitGoalMet(habit, c, { date: monthStart, weeklyData: monthlyHabitData })
    })
  }, [
    mode,
    habitTasks,
    weeklyData,
    weeklyHabitData,
    monthlyHabitData,
    dayKey,
    weekKey,
    monthKey,
    currentDate,
    weekStart,
    monthStart,
    habitExemptions,
    nights,
  ])

  const nextActionTasks = useMemo(
    () => nextActionsForPlanPeriod(tasks, folders, mode, currentDate),
    [tasks, folders, mode, currentDate],
  )

  const capacityLine = useMemo(() => {
    const planned = plannedMinutesForDay(currentDate, tasks, events, plannedActions)
    const window = wakingWindowMinutes(awakeWindowFor(dayKey, currentDate))
    return {
      text: formatCapacityLine(planned, window),
      over: window !== null && planned > window,
      pips: capacityPipCount(planned, window),
    }
  }, [currentDate, tasks, events, plannedActions, dayKey, nights, trackingEntries])

  const filteredTasks = useMemo(() => {
    const matched = plannedTasks.filter((task) => matchesQuery(query, itemTitle(task), task.context))
    return sortTasks(matched, sortMode)
  }, [plannedTasks, query, sortMode])

  const filteredHabits = useMemo(() => {
    const matched = incompleteHabits.filter((habit) => matchesQuery(query, habit.name))
    return sortHabits(matched, sortMode)
  }, [incompleteHabits, query, sortMode])

  const filteredNextActions = useMemo(() => {
    const matched = nextActionTasks.filter((task) => matchesQuery(query, itemTitle(task), task.context))
    return sortTasks(matched, sortMode)
  }, [nextActionTasks, query, sortMode])

  const canDrop = Boolean(onUnscheduleTask || onUnscheduleEvent || onUnschedulePlannedAction)

  const unschedulePayload = (payload: { kind: string; id: string }) => {
    if (payload.kind === "action" && onUnschedulePlannedAction) onUnschedulePlannedAction(payload.id)
    else if (payload.kind === "task" && onUnscheduleTask) onUnscheduleTask(payload.id)
    else if (payload.kind === "event" && onUnscheduleEvent) onUnscheduleEvent(payload.id)
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const payload = readPlanDrag(e.dataTransfer)
    if (payload) unschedulePayload(payload)
  }

  usePlanPointerDrop((payload, _x, _y, target) => {
    if (target !== railRef.current) return
    unschedulePayload(payload)
  })

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault()
    const description = newTodoText.trim()
    if (!description) return
    addTask(createScheduledTodoTask({ description, period: mode, date: currentDate }))
    setNewTodoText("")
    setShowTodos(true)
  }

  const title =
    mode === "month" ? "Planned This Month" : mode === "week" ? "Planned This Week" : "Planned Today"

  const visibleTasks = showTodos ? filteredTasks : []
  const visibleHabits = showHabits ? filteredHabits : []
  const visibleNextActions = showNextActions ? filteredNextActions : []
  const totalCount = visibleTasks.length + visibleHabits.length + visibleNextActions.length
  const addAria = addLabel(mode)

  return (
    <aside
      ref={railRef}
      className="plan-rail"
      data-plan-drop="rail"
      data-ui-name="Planned tasks"
      data-ui-help="Explorer rail: To Do, undone habits, and Next actions for this period. Drag onto Day to plan."
      data-ui-docs="components/Home/Plan/README.md"
      onDragOver={canDrop ? onDragOver : undefined}
      onDrop={canDrop ? onDrop : undefined}
    >
      <div className="plan-rail-head">
        <span>{title}</span>
        <span className="plan-rail-count">{totalCount}</span>
      </div>
      <p className="plan-capacity" data-over={capacityLine.over ? "true" : "false"}>
        <span className="plan-capacity-pips" data-testid="plan-capacity-pips" aria-hidden>
          {Array.from({ length: CAPACITY_PIPS }, (_, i) => (
            <span key={i} className="plan-pip" data-on={i < capacityLine.pips ? "true" : "false"} />
          ))}
        </span>
        <span className="plan-capacity-line">{capacityLine.text}</span>
      </p>
      {canDrop && <p className="plan-rail-hint">Drop scheduled items here to unschedule</p>}
      <div className="plan-rail-tools">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this rail…"
          aria-label="Search planned items"
        />
        <label>
          <span className="sr-only">Sort planned items</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as RailSort)}
            aria-label="Sort planned items"
          >
            <option value="name">Sort: Name</option>
            <option value="duration">Sort: Duration</option>
            <option value="created">Sort: Created</option>
          </select>
        </label>
      </div>
      <div className="plan-rail-filters">
        <button type="button" aria-pressed={showTodos} onClick={() => setShowTodos((v) => !v)}>
          To Do ({plannedTasks.length})
        </button>
        <button type="button" aria-pressed={showHabits} onClick={() => setShowHabits((v) => !v)}>
          Habits ({incompleteHabits.length})
        </button>
        <button type="button" aria-pressed={showNextActions} onClick={() => setShowNextActions((v) => !v)}>
          Next actions ({nextActionTasks.length})
        </button>
      </div>
      <div className="plan-rail-list">
        {visibleHabits.map((habit: WeeklyTask) => (
          <div
            key={habit.id}
            className="plan-rail-item"
            data-kind="habit"
            {...planRailDragProps("habit", habit.id, habit.name)}
            onDoubleClick={ifNotPlanDragClick(() => onTaskClick(habit.id))}
          >
            <span className="plan-rail-handle" aria-hidden>
              ⠿
            </span>
            <HabitRowGem task={habit} className="plan-rail-gem" />
            <div className="plan-rail-title">
              {habit.name}
              <span className="plan-rail-meta">{habitMeta(mode)}</span>
            </div>
          </div>
        ))}

        {visibleNextActions.map((task) => (
          <div
            key={`na-${task.id}`}
            className="plan-rail-item"
            data-kind="next-action"
            onClick={ifNotPlanDragClick(() => onTaskClick(task.id))}
            onDoubleClick={ifNotPlanDragClick(() => onTaskClick(task.id))}
            {...planRailDragProps("task", task.id, itemTitle(task))}
          >
            <span className="plan-rail-handle" aria-hidden>
              ⠿
            </span>
            <RailListOrb task={task} />
            <div className="plan-rail-title">
              {itemTitle(task)}
              <span className="plan-rail-meta">{nextActionMeta(task)}</span>
            </div>
            {(task.estimatedDuration ?? 0) > 0 && (
              <span className="plan-rail-mins">{task.estimatedDuration}m</span>
            )}
          </div>
        ))}

        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className="plan-rail-item"
            data-kind="todo"
            onClick={ifNotPlanDragClick(() => onTaskClick(task.id))}
            onDoubleClick={ifNotPlanDragClick(() => onTaskClick(task.id))}
            {...planRailDragProps("task", task.id, itemTitle(task))}
          >
            <span className="plan-rail-handle" aria-hidden>
              ⠿
            </span>
            <RailListOrb task={task} />
            <div className="plan-rail-title">
              {itemTitle(task)}
              {task.context ? <span className="plan-rail-meta">{task.context}</span> : null}
            </div>
            {(task.estimatedDuration ?? 0) > 0 && (
              <span className="plan-rail-mins">{task.estimatedDuration}m</span>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAddTodo} className="plan-add">
        <input
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder={`${addAria}…`}
          aria-label={addAria}
        />
        <button type="submit" disabled={!newTodoText.trim()} aria-label="Add to-do">
          +
        </button>
      </form>
    </aside>
  )
}
