/**
 * components/Home/ToDo/priority-star-sweep.ts — Drop a stale task-card star on read
 *
 * No timer. The To Do panel and item detail call this when they read tasks.
 * A prioritized mark whose `priorityRefreshedOn` is 14 days old or more is
 * cleared the way Remove is: the flag, a `priorityLog` line, the refresh day,
 * and that id on morning reviews.
 */
"use client"

import { releaseStaleTaskPriority } from "@/lib/todo-commitment"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"

export function sweepStaleTaskPriorities(asOf: Date = new Date()): void {
  if (!useTaskStore.persist.hasHydrated() || !useReviewsStore.persist.hasHydrated()) return
  const released: string[] = []
  for (const task of useTaskStore.getState().tasks) {
    const next = releaseStaleTaskPriority(task, asOf)
    if (next === task) continue
    if (task.todoMarks?.some((mark) => mark.prioritized)) released.push(task.id)
    useTaskStore.getState().updateTask(next)
  }
  if (!released.length) return
  const drop = new Set(released)
  for (const review of useReviewsStore.getState().reviews) {
    if (review.period !== "day") continue
    const ids = review.morning?.priorityTaskIds
    if (!ids?.some((id) => drop.has(id))) continue
    useReviewsStore.getState().saveMorningReview(review.periodKey, {
      priorityTaskIds: ids.filter((id) => !drop.has(id)),
    })
  }
}
