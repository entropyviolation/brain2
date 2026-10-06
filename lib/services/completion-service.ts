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
import { isClearedFromWork, isMissed, withCompleted, withStatus } from "@/lib/completion-status"
import { rememberWorld } from "@/lib/action-history"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  applyClockWrite,
  clampReflectionScore,
  clockDraftFromTask,
  clockWriteFromDraft,
  formatHm,
  positiveMinutes,
  readStartCertainty,
  recordQuickReviewPoints,
  REFLECTION_SCORE_KEYS,
  type ClockWrite,
} from "@/lib/completion-review"

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
  rememberWorld("complete task")

  let updated: Task = { ...task }
  if (options.actualDuration !== undefined) updated.actualDuration = options.actualDuration

  const repeat = task.repeatSettings
  if (task.isRepeated && repeat?.type === "count") {
    const total = repeat.totalCount ?? 1
    const nextCount = (repeat.completedCount ?? 0) + 1
    const done = nextCount >= total
    updated = {
      ...withCompleted(updated, done),
      repeatSettings: { ...repeat, completedCount: nextCount },
      ...(done ? { stage: "completed" as const } : {}),
    }
  } else {
    updated = { ...withCompleted(updated, true), stage: "completed" }
  }

  return repo.update(updated)
}

/**
 * Mark a task a missed opportunity (too late). Clears it from To Do / Next
 * Actions the same way complete does, but it lands on Missed Opportunities
 * instead of Completed. No points, no completion popup.
 */
export function markMissedOpportunity(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task || isClearedFromWork(task)) return task
  rememberWorld("miss opportunity")
  return repo.update(withStatus({ ...task }, "missed"))
}

/** Reopen a missed-opportunity task back to active work. */
export function unmarkMissedOpportunity(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task || !isMissed(task)) return task
  rememberWorld("unmiss opportunity")
  return repo.update(withStatus({ ...task }, "active"))
}

/** Reopen a completed task (clears the completed flag). */
export function uncompleteTask(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task || !task.completed) return task
  rememberWorld("uncomplete task")
  return repo.update(withCompleted({ ...task, completed: false }, false))
}

/** Toggle a task's completion state. */
export function toggleCompletion(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return task.completed ? uncompleteTask(id, repo) : completeTask(id, {}, repo)
}

const CLEARABLE_SCORE_KEYS = [...REFLECTION_SCORE_KEYS, "satisfaction", "distraction"] as const
type ClearableScoreKey = (typeof CLEARABLE_SCORE_KEYS)[number]

/**
 * Fields a save may write. `taskId` / `completedAt` are filled in.
 * A score of `null` clears that score. Omitting the key leaves the saved value.
 */
export type CompletionReviewInput = Omit<
  TaskCompletionReview,
  "taskId" | "completedAt" | "actualDuration" | ClearableScoreKey | "reflectNotes"
> & {
  completedAt?: Date
  /** Optional override; falls back to the task's existing actualDuration. */
  actualDuration?: number
  /**
   * Award 3 points plus 0.1 per word in `notes`, and store that on the review.
   * This is the only flag that writes `review:${taskId}`, `reviewWordCount`, and `reviewPoints`.
   */
  awardQuickReview?: boolean
  /** Later Reflect note. `null` or a blank string clears it. Omitted leaves the saved note. */
  reflectNotes?: string | null
} & {
  [K in ClearableScoreKey]?: number | null
}

function applyClearableScore(
  review: TaskCompletionReview,
  key: ClearableScoreKey,
  incoming: number | null | undefined,
) {
  if (incoming === undefined) return
  if (incoming === null) {
    delete review[key]
    return
  }
  const score = clampReflectionScore(incoming)
  if (score !== undefined) review[key] = score
}

function applyReflectNotes(review: TaskCompletionReview, incoming: string | null | undefined) {
  if (incoming === undefined) return
  const text = incoming === null ? "" : incoming.trim()
  if (!text) delete review.reflectNotes
  else review.reflectNotes = text
}

/**
 * What Reflect may write. Scores that dialog shows are cleared with `null`.
 * It never sends the quick-review `notes` or an award.
 */
export function postMortemReviewInput(args: {
  satisfaction?: number
  resistance?: number
  focus?: number
  distraction?: number
  note: string
}): CompletionReviewInput {
  return {
    satisfaction: args.satisfaction ?? null,
    resistance: args.resistance ?? null,
    focus: args.focus ?? null,
    distraction: args.distraction ?? null,
    reflectNotes: args.note,
  }
}

function applyReviewClockInput(task: Task, input: CompletionReviewInput): ClockWrite {
  const draft = clockDraftFromTask(task)
  if (input.durationCertainty) {
    draft.durationCertainty = input.durationCertainty
    draft.durationMinutes =
      input.durationCertainty === "unknown" || input.actualDuration === undefined
        ? ""
        : String(Math.round(input.actualDuration))
  }
  if (input.startCertainty === "unknown") {
    draft.startCertainty = "unknown"
    draft.startTime = ""
  } else if (input.startedAt || input.startCertainty) {
    draft.startCertainty = readStartCertainty(input.startCertainty) ?? "exact"
    if (input.startedAt) draft.startTime = formatHm(input.startedAt)
  }
  const write = clockWriteFromDraft(input.startedAt ? { ...task, startedAt: input.startedAt } : task, draft)
  if (!input.durationCertainty) write.writeDuration = false
  if (input.startCertainty === undefined && !input.startedAt) write.writeStart = false
  if (input.startCertainty === "unknown") {
    write.writeStart = true
    write.startedAt = undefined
    write.startCertainty = "unknown"
    const nextDuration = write.writeDuration ? write.durationCertainty : task.durationCertainty
    write.timeRough = nextDuration === "estimated" ? true : undefined
  } else if (input.startedAt && write.writeStart) {
    write.startedAt = input.startedAt
  }
  return write
}

/**
 * Persist a task post-mortem (Brain2 #40). Saves the `TaskCompletionReview`
 * onto the task via a task-store action CALL (through the repository) — this
 * service does NOT edit task-store.ts. If the task carries an `actualDuration`
 * and the review didn't capture one, the existing value is reused so the review
 * stays consistent with the completion record.
 *
 * This is intentionally separate from the hot `completeTask` path (owned by
 * Worker A): a later Reflect note is captured after the fact from Reviews/Analytics.
 * Only `awardQuickReview` writes the quick-review ledger. A score of `null` clears
 * that score; a score left off the input stays as saved.
 */
export function saveCompletionReview(
  taskId: string,
  input: CompletionReviewInput,
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(taskId)
  if (!task) return undefined

  const existing = task.completionReview
  const completedAt = input.completedAt ?? existing?.completedAt ?? new Date()
  const clock =
    input.durationCertainty || input.startCertainty || input.startedAt
      ? applyReviewClockInput(task, input)
      : null

  const legacyMinutes =
    input.durationCertainty
      ? undefined
      : positiveMinutes(input.actualDuration) ??
        positiveMinutes(task.actualDuration) ??
        positiveMinutes(existing?.actualDuration)

  const review: TaskCompletionReview = {
    ...(existing ?? { taskId, completedAt }),
    taskId,
    completedAt,
    notes: input.notes !== undefined ? input.notes : existing?.notes,
  }
  if (review.notes === undefined) delete review.notes
  for (const key of CLEARABLE_SCORE_KEYS) applyClearableScore(review, key, input[key])
  applyReflectNotes(review, input.reflectNotes)

  if (input.durationCertainty === "unknown" || clock?.durationCertainty === "unknown") {
    delete review.actualDuration
    review.durationCertainty = "unknown"
  } else if (clock?.durationCertainty && clock.actualDuration) {
    review.actualDuration = clock.actualDuration
    review.durationCertainty = clock.durationCertainty
  } else if (legacyMinutes) {
    review.actualDuration = legacyMinutes
    if (existing?.durationCertainty && existing.durationCertainty !== "unknown") {
      review.durationCertainty = existing.durationCertainty
    }
  }

  if (clock?.writeStart && clock.startCertainty === "unknown") {
    delete review.startedAt
    review.startCertainty = "unknown"
  } else if (clock?.writeStart && clock.startedAt && clock.startCertainty) {
    review.startedAt = clock.startedAt
    review.startCertainty = readStartCertainty(clock.startCertainty) ?? clock.startCertainty
  }

  if (input.awardQuickReview) {
    const awarded = recordQuickReviewPoints(
      taskId,
      itemTitleOrUntitled(task, "Task"),
      review.notes,
      completedAt instanceof Date ? completedAt : new Date(completedAt),
    )
    review.reviewWordCount = awarded.reviewWordCount
    review.reviewPoints = awarded.reviewPoints
  }

  let updated: Task = { ...task, completionReview: review }
  if (clock) updated = { ...updated, ...applyClockWrite(task, clock), completionReview: review }
  else if (legacyMinutes && input.actualDuration !== undefined) updated.actualDuration = legacyMinutes

  return repo.update(updated)
}
