/**
 * lib/ritual-carry.ts — Night fields the next morning reads
 *
 * Wake-up reminder and "what matters most" live on the night ritual for the
 * day they were written. The following morning shows reminder first, then
 * what matters most. Empty text shows nothing. Goal focus is the same night's
 * `tomorrowFocusGoalIds`, honored on that next day.
 */
import type { PeriodReview } from "@/lib/types"
import { localDayKey, previousPeriodDate } from "@/lib/reviews-store"

export interface NightCarry {
  /** Night ritual key these notes were saved on. */
  nightKey: string
  wakeReminder: string
  tomorrowMatters: string
  focusGoalIds: string[]
}

export function previousDayKey(day: Date): string {
  return localDayKey(previousPeriodDate("day", day))
}

export function nightReviewForKey(reviews: PeriodReview[], nightKey: string): PeriodReview | undefined {
  return reviews.find((review) => review.period === "day" && review.periodKey === nightKey)
}

/** Notes written on `nightKey` for the morning that follows it. */
export function nightCarryFromReview(review: PeriodReview | undefined, nightKey: string): NightCarry {
  return {
    nightKey,
    wakeReminder: review?.wakeReminder?.trim() ?? "",
    tomorrowMatters: review?.tomorrowMatters?.trim() ?? "",
    focusGoalIds: review?.tomorrowFocusGoalIds ?? [],
  }
}

/** What the morning ritual on `morning` should show from the night before. */
export function nightCarryForMorning(reviews: PeriodReview[], morning: Date): NightCarry {
  const nightKey = previousDayKey(morning)
  return nightCarryFromReview(nightReviewForKey(reviews, nightKey), nightKey)
}
