/**
 * lib/reviews-store.ts — Period reviews store + helpers
 *
 * Persists day/week/month/quarter/year reviews and provides the pure helpers the
 * Review dialog uses to (a) key a review to a period, (b) derive a representative
 * date from a period key, (c) compute the *previous* (just-ended) period so the
 * app can prompt for a review, and (d) compute the *next* period for pushing
 * unfinished tasks forward.
 *
 * Spec: end-of-period review ritual (carry-over §7.7, reflection/gratitude).
 * Storage: localStorage today; target MongoDB `reviews` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PeriodReview, ReviewPeriod, BlockedReason } from "@/lib/types"
import { getWeekString, parseWeekString } from "@/lib/date-utils"

/**
 * Operation post-mortem (Feature 2, #277). Worker B builds these from an
 * Operation's phases/log/time and persists them through `addOperationReview`.
 * Lives in this worker-owned store (not `lib/types.ts`, which is frozen).
 */
export interface OperationReview {
  /** Stable id; defaults to `operation:${operationId}` (re-saving upserts). */
  id: string
  /** The operation item/task id this post-mortem belongs to. */
  operationId: string
  completedAt: Date
  summary: string
  /** Free-text "what worked" reflection. */
  whatWorked?: string
  /** Free-text "what failed / would do differently" reflection. */
  whatFailed?: string
  /** Lesson bullets distilled from the operation. */
  lessons?: string[]
  /** Named 1-N ratings (e.g. execution, planning, morale). */
  ratings?: Record<string, number>
  /** Total hours logged across the operation (rolled up by Worker B). */
  hoursLogged?: number
  /** Why phases/tasks were blocked, keyed by task id (HM3 reasons). */
  blockedReasons?: Record<string, BlockedReason>
  /** Follow-up items created from the post-mortem. */
  spawnedItemIds?: string[]
}

/** Input accepted by `addOperationReview` — only `operationId` is required. */
export type OperationReviewInput = Omit<OperationReview, "id" | "completedAt" | "summary"> & {
  id?: string
  completedAt?: Date
  summary?: string
}

interface ReviewsState {
  reviews: PeriodReview[]
  operationReviews: OperationReview[]
  saveReview: (review: PeriodReview) => void
  getReview: (period: ReviewPeriod, key: string) => PeriodReview | undefined
  /**
   * Create or update a period review, merging `patch` into any existing review
   * for the bucket (stable id = `${period}:${key}`). Used by the morning ritual,
   * blocked-reason capture, and spawned-item tracking so they don't clobber each
   * other or the evening review.
   */
  upsertReview: (
    period: ReviewPeriod,
    key: string,
    patch: Partial<Omit<PeriodReview, "id" | "period" | "periodKey">>,
  ) => PeriodReview
  /** Morning ritual (HM2): record/merge the `morning` slice on a day review. */
  saveMorningReview: (dayKey: string, morning: NonNullable<PeriodReview["morning"]>) => PeriodReview
  getMorningReview: (dayKey: string) => PeriodReview["morning"] | undefined
  /** Structured "why blocked/skipped" capture (HM3) for a task in a review. */
  setBlockedReason: (period: ReviewPeriod, key: string, taskId: string, reason: BlockedReason) => void
  /** Record an item spawned (e.g. a follow-up) during a review. */
  addSpawnedItem: (period: ReviewPeriod, key: string, itemId: string) => void
  /**
   * Operation post-mortem (Feature 2 #277) — **Worker B calls this.** Upserts an
   * `OperationReview` (defaults id to `operation:${operationId}`) and returns the
   * stored record. Idempotent for a given id.
   */
  addOperationReview: (review: OperationReviewInput) => OperationReview
  getOperationReview: (operationId: string) => OperationReview | undefined
}

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

export const useReviewsStore = create<ReviewsState>()(
  persist(
    (set, get) => ({
      reviews: [],
      operationReviews: [],
      saveReview: (review) =>
        set((state) => {
          const others = state.reviews.filter((r) => r.id !== review.id)
          return { reviews: [...others, review] }
        }),
      getReview: (period, key) => get().reviews.find((r) => r.period === period && r.periodKey === key),

      upsertReview: (period, key, patch) => {
        const base = get().getReview(period, key) ?? emptyReview(period, key)
        const review: PeriodReview = { ...base, ...patch }
        get().saveReview(review)
        return review
      },

      saveMorningReview: (dayKey, morning) => {
        const base = get().getReview("day", dayKey) ?? emptyReview("day", dayKey)
        return get().upsertReview("day", dayKey, { morning: { ...base.morning, ...morning } })
      },

      getMorningReview: (dayKey) => get().getReview("day", dayKey)?.morning,

      setBlockedReason: (period, key, taskId, reason) => {
        const base = get().getReview(period, key) ?? emptyReview(period, key)
        get().upsertReview(period, key, { blockedReasons: { ...base.blockedReasons, [taskId]: reason } })
      },

      addSpawnedItem: (period, key, itemId) => {
        const base = get().getReview(period, key) ?? emptyReview(period, key)
        const next = [...new Set([...(base.spawnedItemIds ?? []), itemId])]
        get().upsertReview(period, key, { spawnedItemIds: next })
      },

      addOperationReview: (review) => {
        const id = review.id ?? `operation:${review.operationId}`
        const stored: OperationReview = {
          summary: "",
          ...review,
          id,
          completedAt: review.completedAt ?? new Date(),
        }
        set((state) => ({
          operationReviews: [...state.operationReviews.filter((r) => r.id !== id), stored],
        }))
        return stored
      },

      getOperationReview: (operationId) =>
        get().operationReviews.find((r) => r.operationId === operationId),
    }),
    { name: "cogs-reviews-store", version: 1 },
  ),
)

export const REVIEW_PERIODS: ReviewPeriod[] = ["day", "week", "month", "quarter", "year"]

export function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1
}

export function getPeriodKey(period: ReviewPeriod, date: Date): string {
  switch (period) {
    case "day":
      return localDayKey(date)
    case "week":
      return getWeekString(date)
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    case "quarter":
      return `${date.getFullYear()}-Q${quarterOf(date)}`
    case "year":
      return `${date.getFullYear()}`
  }
}

/** A representative date for a stored period key. */
export function dateFromPeriodKey(period: ReviewPeriod, key: string): Date {
  switch (period) {
    case "day":
      return new Date(`${key}T00:00:00`)
    case "week": {
      const r = parseWeekString(key)
      return r ? r.start : new Date()
    }
    case "month":
      return new Date(`${key}-01T00:00:00`)
    case "quarter": {
      const [y, q] = key.split("-Q")
      return new Date(Number(y), (Number(q) - 1) * 3, 1)
    }
    case "year":
      return new Date(Number(key), 0, 1)
  }
}

/** The previous (just-ended) period's reference date, relative to `now`. */
export function previousPeriodDate(period: ReviewPeriod, now = new Date()): Date {
  const d = new Date(now)
  switch (period) {
    case "day":
      d.setDate(d.getDate() - 1)
      return d
    case "week":
      d.setDate(d.getDate() - 7)
      return d
    case "month":
      return new Date(now.getFullYear(), now.getMonth() - 1, 1)
    case "quarter":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1)
    case "year":
      return new Date(now.getFullYear() - 1, 0, 1)
  }
}

/** The next period's reference date, relative to a period's reference date. */
export function nextPeriodDate(period: ReviewPeriod, refDate: Date): Date {
  const d = new Date(refDate)
  switch (period) {
    case "day":
      d.setDate(d.getDate() + 1)
      return d
    case "week":
      d.setDate(d.getDate() + 7)
      return d
    case "month":
      return new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1)
    case "quarter":
      return new Date(refDate.getFullYear(), refDate.getMonth() + 3, 1)
    case "year":
      return new Date(refDate.getFullYear() + 1, 0, 1)
  }
}

export function periodLabel(period: ReviewPeriod, key: string): string {
  const d = dateFromPeriodKey(period, key)
  switch (period) {
    case "day":
      return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    case "week": {
      const r = parseWeekString(key)
      if (r)
        return `Week of ${r.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      return "Week"
    }
    case "month":
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    case "quarter":
      return key.replace("-Q", " Q")
    case "year":
      return key
  }
}
