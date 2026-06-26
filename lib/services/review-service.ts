/**
 * lib/services/review-service.ts — Period review workflow
 *
 * Cross-cutting review logic on top of a thin repository over the reviews
 * store: load/save period reviews and upsert by period+key. Pure period-key
 * helpers remain in `lib/reviews-store.ts`.
 *
 * Spec: §13 (end-of-period reviews, carry-over prompts).
 */
import type { PeriodReview, ReviewPeriod, Task } from "@/lib/types"
import { useReviewsStore, dateFromPeriodKey, nextPeriodDate } from "@/lib/reviews-store"
import { taskRepository, type TaskRepository } from "@/lib/data/task-repository"
import {
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
  taskScheduledInYear,
} from "@/lib/date-utils"
import { pushTaskOnePeriod } from "@/lib/item-utils"
import { clearedScheduleFields } from "@/lib/scheduling"

export interface ReviewRepository {
  getAll(): PeriodReview[]
  get(period: ReviewPeriod, key: string): PeriodReview | undefined
  save(review: PeriodReview): void
}

export const reviewRepository: ReviewRepository = {
  getAll() {
    return useReviewsStore.getState().reviews
  },
  get(period, key) {
    return useReviewsStore.getState().getReview(period, key)
  },
  save(review) {
    useReviewsStore.getState().saveReview(review)
  },
}

/** Persist a review (replaces any existing review with the same id). */
export function savePeriodReview(review: PeriodReview, repo: ReviewRepository = reviewRepository): PeriodReview {
  repo.save(review)
  return review
}

/** Load the review for a period bucket, if one exists. */
export function getPeriodReview(
  period: ReviewPeriod,
  key: string,
  repo: ReviewRepository = reviewRepository,
): PeriodReview | undefined {
  return repo.get(period, key)
}

/** A blank review for a period bucket (stable id = `${period}:${key}`). */
function emptyReview(period: ReviewPeriod, key: string): PeriodReview {
  return {
    id: `${period}:${key}`,
    period,
    periodKey: key,
    completedAt: new Date(),
    summary: "",
    gratitude: [],
    nextPlans: "",
    reflections: {},
    resolvedTaskIds: [],
    pushedTaskIds: [],
  }
}

/** Create or update a review for a period key (stable id = `${period}:${key}`). */
export function upsertPeriodReview(
  period: ReviewPeriod,
  key: string,
  patch: Partial<Omit<PeriodReview, "id" | "period" | "periodKey">>,
  repo: ReviewRepository = reviewRepository,
): PeriodReview {
  const base = repo.get(period, key) ?? emptyReview(period, key)
  const review: PeriodReview = { ...base, ...patch }
  repo.save(review)
  return review
}

// ---------------------------------------------------------------------------
// Carry-over (Phase 9): push a period's still-unfinished tasks to the next one.
// ---------------------------------------------------------------------------

/**
 * Incomplete tasks that belong to a period bucket. Pure: takes a task snapshot,
 * mirrors the membership semantics the Review dialog uses
 * (`components/Reviews/reviews.tsx#tasksScheduledInPeriod`) so the automated
 * carry-over and the manual ritual agree on what counts as "in this period".
 */
export function tasksIncompleteInPeriod(
  tasks: Task[],
  period: ReviewPeriod,
  key: string,
): Task[] {
  const ref = dateFromPeriodKey(period, key)
  return tasks.filter((t) => {
    if (t.completed) return false
    switch (period) {
      case "day":
        return taskScheduledOnDay(t, ref)
      case "week":
        return taskScheduledInWeek(t, key)
      case "month":
        return taskScheduledInMonth(t, key)
      case "quarter": {
        const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
        return [0, 1, 2].some((i) => {
          const md = new Date(start.getFullYear(), start.getMonth() + i, 1)
          const mkey = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}`
          return taskScheduledInMonth(t, mkey)
        })
      }
      case "year":
        return taskScheduledInYear(t, key)
      default:
        return false
    }
  })
}

/**
 * Pure field math for pushing a task out of a review period into the next one.
 * Reuses `item-utils.pushTaskOnePeriod` for day/week/month (the same helper the
 * To-Do views and scheduling service use) and handles the coarser quarter/year
 * buckets the way the Review dialog does.
 */
export function pushFieldsForReviewPeriod(
  task: Task,
  period: ReviewPeriod,
  key: string,
): Partial<Task> {
  if (period === "day" || period === "week" || period === "month") {
    return pushTaskOnePeriod(task, period, dateFromPeriodKey(period, key))
  }
  const next = nextPeriodDate(period, dateFromPeriodKey(period, key))
  const cleared = clearedScheduleFields()
  if (period === "quarter") {
    return {
      ...cleared,
      scheduledMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
      monthsPushed: (task.monthsPushed ?? 0) + 1,
    }
  }
  // year
  return { ...cleared, scheduledYear: String(next.getFullYear()) }
}

export interface CarryOverRepos {
  tasks?: TaskRepository
  reviews?: ReviewRepository
}

/**
 * Push every still-incomplete task in a period forward to the next period and
 * record them on the period's review (`pushedTaskIds`). Returns the ids that
 * were carried over by *this* call.
 *
 * Idempotent: tasks already recorded as pushed on the review are skipped, and
 * pushing a task clears it out of the period bucket anyway, so re-running yields
 * an empty result and never double-advances a task's schedule.
 */
export function carryOverIncomplete(
  period: ReviewPeriod,
  key: string,
  _opts: { now?: Date } = {},
  repos: CarryOverRepos = {},
): string[] {
  const taskRepo = repos.tasks ?? taskRepository
  const reviewRepo = repos.reviews ?? reviewRepository

  const existing = reviewRepo.get(period, key)
  const alreadyPushed = new Set(existing?.pushedTaskIds ?? [])

  const carried: string[] = []
  for (const task of tasksIncompleteInPeriod(taskRepo.getAll(), period, key)) {
    if (alreadyPushed.has(task.id)) continue
    taskRepo.update({ ...task, ...pushFieldsForReviewPeriod(task, period, key) })
    carried.push(task.id)
  }

  if (carried.length > 0) {
    const merged = [...new Set([...(existing?.pushedTaskIds ?? []), ...carried])]
    upsertPeriodReview(period, key, { pushedTaskIds: merged }, reviewRepo)
  }

  return carried
}

// ---------------------------------------------------------------------------
// Due-prompt (Phase 9): decide whether a just-ended period still needs review.
// ---------------------------------------------------------------------------

/** Exclusive end of a period bucket (= start of the following period). */
function periodEndExclusive(period: ReviewPeriod, key: string): Date {
  return nextPeriodDate(period, dateFromPeriodKey(period, key))
}

/**
 * Whether a review for `period`/`key` is still pending: no review has been saved
 * for it yet AND the period has fully ended relative to `opts.now`. Pure and
 * deterministic — pass the reviews snapshot and a fixed `now` for testing.
 */
export function isReviewDue(
  period: ReviewPeriod,
  key: string,
  opts: { now: Date; reviews?: PeriodReview[] },
): boolean {
  const reviews = opts.reviews ?? []
  const alreadyReviewed = reviews.some((r) => r.period === period && r.periodKey === key)
  if (alreadyReviewed) return false
  return opts.now.getTime() >= periodEndExclusive(period, key).getTime()
}
