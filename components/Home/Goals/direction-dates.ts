/**
 * components/Home/Goals/direction-dates.ts — Dates for the direction report
 *
 * Desktop Direction in Life and the phone direction block read a task's
 * completion the same way, and print a drift day as "MMM d".
 */
import { format } from "date-fns"
import { parseLocalDate } from "@/lib/date-utils"
import type { Task } from "@/lib/types"

export function taskCompletionDate(task: Task): Date | undefined {
  if (task.completedDate) return new Date(task.completedDate)
  if (task.completionReview?.completedAt) return new Date(task.completionReview.completedAt)
  const chunks = task.completedChunks ?? []
  if (chunks.length) {
    const last = chunks[chunks.length - 1]
    if (last?.date) return new Date(last.date)
  }
  if (task.scheduledDate) return new Date(task.scheduledDate)
  return task.createdAt ? new Date(task.createdAt) : undefined
}

export function formatDriftDay(key: string): string {
  const date = parseLocalDate(key)
  return date ? format(date, "MMM d") : key
}
