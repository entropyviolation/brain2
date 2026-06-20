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
import type { PeriodReview, ReviewPeriod } from "@/lib/types"
import { getWeekString, parseWeekString } from "@/lib/date-utils"

interface ReviewsState {
  reviews: PeriodReview[]
  saveReview: (review: PeriodReview) => void
  getReview: (period: ReviewPeriod, key: string) => PeriodReview | undefined
}

export const useReviewsStore = create<ReviewsState>()(
  persist(
    (set, get) => ({
      reviews: [],
      saveReview: (review) =>
        set((state) => {
          const others = state.reviews.filter((r) => r.id !== review.id)
          return { reviews: [...others, review] }
        }),
      getReview: (period, key) => get().reviews.find((r) => r.period === period && r.periodKey === key),
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
