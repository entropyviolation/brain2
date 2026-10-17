/**
 * lib/ritual-due.ts — What the morning and start rituals look ahead at
 *
 * Open work only (not done, not missed or otherwise cleared, not hidden from
 * To Do). `dueWithin` is every task whose deadline falls from now up to
 * `days` ahead, soonest first. `overdue` is every task whose deadline has
 * passed. `periodList` is a week or month to-do list, most important first.
 */
import { isClearedFromWork } from "@/lib/completion-status"
import { taskScheduledInMonth, taskScheduledInWeek, taskScheduledOnDay } from "@/lib/date-utils"
import type { Task } from "@/lib/types"

const DAY_MS = 86_400_000

function isOpen(task: Task): boolean {
  return !task.completed && !task.hiddenFromTodo && !isClearedFromWork(task)
}

function deadlineMs(task: Task): number | null {
  if (!task.deadline) return null
  const t = new Date(task.deadline).getTime()
  return Number.isFinite(t) ? t : null
}

export function dueWithin(tasks: Task[], now: Date, days = 7): Task[] {
  const from = now.getTime()
  const to = from + days * DAY_MS
  return tasks
    .filter((t) => {
      const d = deadlineMs(t)
      return isOpen(t) && d !== null && d >= from && d <= to
    })
    .sort((a, b) => deadlineMs(a)! - deadlineMs(b)!)
}

export function overdue(tasks: Task[], now: Date): Task[] {
  return tasks
    .filter((t) => {
      const d = deadlineMs(t)
      return isOpen(t) && d !== null && d < now.getTime()
    })
    .sort((a, b) => deadlineMs(a)! - deadlineMs(b)!)
}

/** Latest importance rating, else the task's own importance. */
export function importanceOf(task: Task): number {
  const ratings = Object.entries(task.dayRatings ?? {})
    .filter(([, r]) => typeof r.importance === "number")
    .sort(([a], [b]) => b.localeCompare(a))
  return ratings[0]?.[1].importance ?? task.importance ?? 0
}

/** A week or month to-do list, open rows not already on `day`, most important first. */
export function periodList(tasks: Task[], period: "week" | "month", key: string, day: Date): Task[] {
  const inPeriod = period === "week" ? taskScheduledInWeek : taskScheduledInMonth
  return tasks
    .filter((t) => isOpen(t) && inPeriod(t, key) && !taskScheduledOnDay(t, day))
    .sort((a, b) => importanceOf(b) - importanceOf(a))
}

/** `3d 4h`, `5h`, `40m`; past deadlines read `2d late`. */
export function countdown(deadline: Date, now: Date): string {
  const diff = new Date(deadline).getTime() - now.getTime()
  const abs = Math.abs(diff)
  const d = Math.floor(abs / DAY_MS)
  const h = Math.floor((abs % DAY_MS) / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const text = d > 0 ? `${d}d${h ? ` ${h}h` : ""}` : h > 0 ? `${h}h` : `${m}m`
  return diff < 0 ? `${text} late` : text
}
