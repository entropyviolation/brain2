/**
 * components/Home/Plan/plan-gem-day.ts — Completed-work tokens for gem mode
 *
 * Past-day Month cells (when gem-and-trinket mode is on) show photographed
 * habit gems and Lists orbs/trinkets for work finished that local calendar
 * day. Events stay chips. Reuses `resolveTaskGem` and `iconFor` — no second
 * icon language.
 */
import { iconFor } from "@/components/Icons"
import { formatLocalDateKey, sameCalendarDay } from "@/lib/date-utils"
import { habitDoneLogId } from "@/lib/habit-done-log"
import { resolveTaskGem } from "@/lib/habit-gems"
import { isDailyHabit } from "@/lib/habit-points"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { itemTitle } from "@/lib/item-utils"
import type { Task, WeeklyData, WeeklyTask } from "@/lib/types"

export type PlanGemKind = "habit" | "task"

export type PlanGemToken = {
  id: string
  kind: PlanGemKind
  src: string
  title: string
  /** Task-store id for `TaskDetailPopup` (habit-done log for habits). */
  openTaskId: string
}

const DONE_LOG_ID = /^habit-done-(.+)-(\d{4}-\d{2}-\d{2})$/

export function sourceHabitIdFromTask(task: Pick<Task, "id" | "attributes">): string | null {
  const attr = task.attributes?.sourceHabitId
  if (typeof attr === "string" && attr.length > 0) return attr
  const match = DONE_LOG_ID.exec(task.id)
  return match?.[1] ?? null
}

export function isTaskCompletedOnDay(
  task: Pick<Task, "completed" | "completedDate">,
  date: Date,
): boolean {
  return !!task.completed && sameCalendarDay(task.completedDate, date)
}

function habitById(habits: WeeklyTask[], id: string): WeeklyTask | undefined {
  return habits.find((habit) => habit.id === id)
}

function addHabitToken(
  tokens: PlanGemToken[],
  seenHabits: Set<string>,
  habit: WeeklyTask,
  openTaskId: string,
) {
  if (seenHabits.has(habit.id)) return
  seenHabits.add(habit.id)
  tokens.push({
    id: `habit-${habit.id}`,
    kind: "habit",
    src: resolveTaskGem(habit),
    title: habit.name,
    openTaskId,
  })
}

function addTaskToken(
  tokens: PlanGemToken[],
  seenHabits: Set<string>,
  seenTasks: Set<string>,
  habits: WeeklyTask[],
  task: Task,
) {
  if (seenTasks.has(task.id)) return
  const habitId = sourceHabitIdFromTask(task)
  if (habitId) {
    const habit = habitById(habits, habitId)
    if (habit) {
      addHabitToken(tokens, seenHabits, habit, task.id)
      seenTasks.add(task.id)
      return
    }
  }
  seenTasks.add(task.id)
  tokens.push({
    id: `task-${task.id}`,
    kind: "task",
    src: iconFor(task.id, task.icon),
    title: itemTitle(task),
    openTaskId: task.id,
  })
}

/**
 * Gems/orbs for work completed on `date`.
 *
 * Habits: daily goal met on that date key (`weeklyData`), plus any habit-done
 * log whose `completedDate` falls on this day (weekly/monthly land here when
 * the done-log is stamped that day). Lists items: `completedDate` that day,
 * rendered with the Lists orb/trinket (`iconFor`). Habit-done mirrors are not
 * double-counted as list orbs.
 */
export function planGemTokensForDay({
  date,
  habits,
  weeklyData,
  tasks,
}: {
  date: Date
  habits: WeeklyTask[]
  weeklyData: WeeklyData
  tasks: Task[]
}): PlanGemToken[] {
  const tokens: PlanGemToken[] = []
  const seenHabits = new Set<string>()
  const seenTasks = new Set<string>()
  const dateKey = formatLocalDateKey(date)

  for (const task of tasks) {
    if (!isTaskCompletedOnDay(task, date)) continue
    addTaskToken(tokens, seenHabits, seenTasks, habits, task)
  }

  for (const habit of habits) {
    if (!isDailyHabit(habit)) continue
    if (!isHabitGoalMet(habit, weeklyData[dateKey]?.[habit.id], { date, weeklyData })) continue
    addHabitToken(tokens, seenHabits, habit, habitDoneLogId(habit.id, date))
  }

  tokens.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "habit" ? -1 : 1
    return a.title.localeCompare(b.title)
  })
  return tokens
}

/** Task ids already painted as gems/orbs — hide their text chips. */
export function planGemChipTaskIds(tokens: PlanGemToken[], tasks: Task[], date: Date): Set<string> {
  const ids = new Set<string>()
  for (const token of tokens) ids.add(token.openTaskId)
  for (const task of tasks) {
    if (!isTaskCompletedOnDay(task, date)) continue
    ids.add(task.id)
  }
  return ids
}
