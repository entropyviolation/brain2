/**
 * lib/pending-reviews.ts — Which end-of-period (review/end) rituals are still due
 *
 * Uses `endRitualPhase` so a morning-only or start-only shell does not mark
 * the end ritual complete. Start/morning availability lives in `lib/rituals.ts`.
 */
import type { PeriodReview, ReviewPeriod } from "@/lib/types"
import { REVIEW_PERIODS } from "@/lib/reviews-store"
import { endRitualNeeded } from "@/lib/rituals"

export type PendingReviewMap = Record<ReviewPeriod, { key: string; needed: boolean }>

export function getPendingReviews(reviews: PeriodReview[], now = new Date()): PendingReviewMap {
  const map = {} as PendingReviewMap
  REVIEW_PERIODS.forEach((period) => {
    map[period] = endRitualNeeded(reviews, period, now)
  })
  return map
}

export function countPendingReviews(reviews: PeriodReview[], now = new Date()): number {
  const pending = getPendingReviews(reviews, now)
  return REVIEW_PERIODS.filter((p) => pending[p].needed).length
}
