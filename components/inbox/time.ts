/**
 * Clocks, age marks, and sticky day plates for the inbox pile.
 * The plate is the day plus the time span of the ideas in that group.
 */

import { format } from "date-fns"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import type { Task } from "@/lib/types"

export type InboxDayGroup = { key: string; plate: string; tasks: Task[] }

export function asDate(value: Date | string | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function inboxClock(value: Date | string | undefined): string {
  const d = asDate(value)
  return d ? format(d, "h:mm a") : ""
}

export function inboxAgeMark(value: Date | string | undefined, now = new Date()): string | null {
  const d = asDate(value)
  if (!d) return null
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (day >= start) return null
  const days = Math.max(1, Math.round((start.getTime() - day.getTime()) / 86_400_000))
  return `${days}d`
}

export function inboxDayGroups(tasks: Task[], now = new Date()): InboxDayGroup[] {
  const today = formatLocalDateKey(now)
  const groups: InboxDayGroup[] = []
  for (const task of tasks) {
    const d = asDate(task.createdAt)
    const key = d ? formatLocalDateKey(d) : "undated"
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) groups.push({ key, plate: "", tasks: [task] })
    else last.tasks.push(task)
  }
  for (const group of groups) {
    const minutes = group.tasks
      .map((task) => asDate(task.createdAt))
      .filter((d): d is Date => !!d)
      .map((d) => d.getHours() * 60 + d.getMinutes())
    const clock = (m: number) => format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), "h:mm a")
    const span =
      minutes.length === 0
        ? ""
        : Math.min(...minutes) === Math.max(...minutes)
          ? clock(Math.min(...minutes))
          : `${clock(Math.min(...minutes))}–${clock(Math.max(...minutes))}`
    const day =
      group.key === today
        ? "Today"
        : group.key === "undated"
          ? "Undated"
          : format(parseLocalDate(group.key) ?? now, "EEE MMM d")
    group.plate = span ? `${day} · ${span}` : day
  }
  return groups
}
