/**
 * lib/willpower-stones.ts — Daily-habit gems that collect on Willpower gems this week
 *
 * One satellite **per completion** on the visible week (`isHabitGoalMet` for
 * that day). Seven days complete → seven copies of the same gem. Completions
 * already persist, so the plate rebuilds the same set after reload — no extra
 * collected-id blob. Uncomplete a day and that copy leaves.
 *
 * The row jewel still inverts while the habit has **any** hit this week
 * (`habitContributesWillpowerStone`), not only today.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { isDailyHabit } from "@/lib/habit-points"
import { resolveTaskGem } from "@/lib/habit-gems"
import { isHabitGoalMet } from "@/lib/habit-utils"
import type { WeeklyData, WeeklyTask } from "@/lib/types"

export type WillpowerStone = {
  id: string
  src: string
  name: string
}

export function willpowerStoneId(taskId: string, dateKey: string): string {
  return `${taskId}:${dateKey}`
}

function habitMetOnDate(
  task: WeeklyTask,
  weeklyData: WeeklyData,
  date: Date,
): boolean {
  return isHabitGoalMet(task, weeklyData[formatLocalDateKey(date)]?.[task.id], {
    date,
    weeklyData,
  })
}

export function habitContributesWillpowerStone(
  task: Pick<WeeklyTask, "id" | "type" | "frequency" | "goal" | "incrementalData" | "unit">,
  weeklyData: WeeklyData,
  weekDates: Date[],
): boolean {
  if (!isDailyHabit(task as WeeklyTask)) return false
  return weekDates.some((date) => habitMetOnDate(task as WeeklyTask, weeklyData, date))
}

export function weekWillpowerStones(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  isExempt?: (task: WeeklyTask, dateKey: string) => boolean,
): WillpowerStone[] {
  const stones: WillpowerStone[] = []
  for (const task of tasks) {
    if (!isDailyHabit(task)) continue
    const src = resolveTaskGem(task)
    for (const date of weekDates) {
      const dateKey = formatLocalDateKey(date)
      if (isExempt?.(task, dateKey)) continue
      if (!habitMetOnDate(task, weeklyData, date)) continue
      stones.push({
        id: willpowerStoneId(task.id, dateKey),
        src,
        name: task.name,
      })
    }
  }
  return stones
}
