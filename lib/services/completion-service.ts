/**
 * lib/services/completion-service.ts — Task completion workflow
 *
 * Cross-cutting completion logic in one place, on top of the repository. Points
 * awarding still happens inside the store's `updateTask` (so any completion path
 * stays consistent); this service adds the higher-level semantics: optional
 * actual-duration capture and repeated-"count" tasks that only finish once their
 * total has been reached.
 *
 * Spec: §6 (Next Actions), §9 (habits award separately).
 */
import type { Task, TaskCompletionReview } from "@/lib/types"
import { taskRepository, type TaskRepository } from "@/lib/data/task-repository"

export interface CompleteOptions {
  /** Minutes actually spent; stored on the task when provided. */
  actualDuration?: number
}

/**
 * Mark a task complete. For a repeated task of type "count", this records one
 * occurrence (incrementing `completedCount`) and only flips `completed` once the
 * configured `totalCount` is reached.
 */
export function completeTask(
  id: string,
  options: CompleteOptions = {},
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(id)
  if (!task || task.completed) return task

  let updated: Task = { ...task }
  if (options.actualDuration !== undefined) updated.actualDuration = options.actualDuration

  const repeat = task.repeatSettings
  if (task.isRepeated && repeat?.type === "count") {
    const total = repeat.totalCount ?? 1
    const nextCount = (repeat.completedCount ?? 0) + 1
    updated = {
      ...updated,
      repeatSettings: { ...repeat, completedCount: nextCount },
      completed: nextCount >= total,
    }
  } else {
    updated.completed = true
  }

  return repo.update(updated)
}

/** Reopen a completed task (clears the completed flag). */
export function uncompleteTask(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task || !task.completed) return task
  return repo.update({ ...task, completed: false })
}

/** Toggle a task's completion state. */
export function toggleCompletion(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return task.completed ? uncompleteTask(id, repo) : completeTask(id, {}, repo)
}

/** Fields of a post-mortem the dialog collects (taskId/completedAt are filled in). */
export type CompletionReviewInput = Omit<TaskCompletionReview, "taskId" | "completedAt" | "actualDuration"> & {
  completedAt?: Date
  /** Optional override; falls back to the task's existing actualDuration. */
  actualDuration?: number
}

/**
 * Persist a task post-mortem (Brain2 #40). Saves the `TaskCompletionReview`
 * onto the task via a task-store action CALL (through the repository) — this
 * service does NOT edit task-store.ts. If the task carries an `actualDuration`
 * and the review didn't capture one, the existing value is reused so the review
 * stays consistent with the completion record.
 *
 * This is intentionally separate from the hot `completeTask` path (owned by
 * Worker A): reflection is captured after the fact from Reviews/Analytics.
 */
export function saveCompletionReview(
  taskId: string,
  input: CompletionReviewInput,
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(taskId)
  if (!task) return undefined

  const review: TaskCompletionReview = {
    taskId,
    completedAt: input.completedAt ?? new Date(),
    actualDuration: input.actualDuration || task.actualDuration || 0,
    satisfaction: input.satisfaction,
    resistance: input.resistance,
    focus: input.focus,
    distraction: input.distraction,
    notes: input.notes,
  }

  const updated: Task = { ...task, completionReview: review }
  // If the review captured a different actual duration, keep the task in sync.
  if (input.actualDuration !== undefined) updated.actualDuration = input.actualDuration

  return repo.update(updated)
}
