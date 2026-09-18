/**
 * lib/habit-done-log.ts — Mirror habit completions into To-Do Done
 *
 * When a habit first meets its goal for a day (or weekly/monthly period), write
 * a `loggedAction` row into the task store so it appears in Done today / this
 * week / this month and in Analytics task counts. Un-meeting the goal removes
 * that row. Points stay on `habits-store` (rewardValue 0 here; no completion popup).
 */
import type { TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { taskRepository } from "@/lib/data/task-repository"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"

export function habitDoneLogId(habitId: string, date: Date): string {
  return `habit-done-${habitId}-${formatLocalDateKey(date)}`
}

function stamp(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

export function syncHabitDoneLog(
  habit: WeeklyTask,
  date: Date,
  previous: TaskCompletion | undefined,
  completion: TaskCompletion,
  weeklyData: WeeklyData,
): void {
  const ctx = { date, weeklyData }
  const wasMet = previous ? isHabitGoalMet(habit, previous, ctx) : false
  const nowMet = isHabitGoalMet(habit, completion, ctx)
  if (nowMet === wasMet) return

  const id = habitDoneLogId(habit.id, date)
  if (nowMet && !wasMet) {
    if (taskRepository.getById(id)) return
    const at = stamp(date)
    taskRepository.add({
      id,
      description: habit.name,
      title: habit.name,
      type: LOGGED_ACTION_TYPE_ID,
      loggedAction: true,
      stage: "completed",
      status: "done",
      createdAt: at,
      completed: true,
      completedDate: at,
      scheduledDate: at,
      lists: [],
      tags: ["habit"],
      links: [],
      rewardValue: 0,
      attributes: { sourceHabitId: habit.id },
    })
    return
  }

  if (wasMet && !nowMet && taskRepository.getById(id)) {
    taskRepository.remove(id)
  }
}
