/**
 * components/Analytics/operation-debrief.ts — After-action means for Analytics
 *
 * Reads operation reports that are already stored. Execution, planning, and
 * morale are the 1–10 `ratings` keys the after-action dialog writes.
 * `hoursLogged` is that operation's total hours at the time the report was
 * filed, not a new sum of time logs.
 */
import type { OperationReview } from "@/lib/reviews-store"
import { clampReflectionScore } from "@/lib/completion-review"

export const DEBRIEF_RATING_KEYS = ["execution", "planning", "morale"] as const

export type DebriefRatingKey = (typeof DEBRIEF_RATING_KEYS)[number]

export const DEBRIEF_RATING_LABELS: Record<DebriefRatingKey, string> = {
  execution: "Execution",
  planning: "Planning",
  morale: "Morale",
}

export interface DebriefRatingMean {
  key: DebriefRatingKey
  label: string
  n: number
  mean: number
}

export interface DebriefText {
  id: string
  operationId: string
  title: string
  completedAt: Date
  summary: string
  whatWorked?: string
  whatFailed?: string
  lessons: string[]
}

export interface OperationDebriefSummary {
  /** Reports whose `completedAt` falls in the window. */
  reviewCount: number
  /** Means of integer 1–10 scores. A key with no valid score is omitted. */
  ratings: DebriefRatingMean[]
  /**
   * Sum of stored `hoursLogged` on reports that had a finite value ≥ 0.
   * A missing total is left out, not treated as zero.
   */
  hoursSum: number
  /** How many reports contributed to `hoursSum`. */
  hoursCount: number
  /** `hoursSum / hoursCount` when at least one report stored hours. */
  hoursMean?: number
  /** Reports in the window that wrote summary, worked, failed, or lessons. Newest first. */
  texts: DebriefText[]
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

function storedHours(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined
  return value
}

function completedAtOf(review: OperationReview): Date {
  return review.completedAt instanceof Date ? review.completedAt : new Date(review.completedAt)
}

function timeOf(date: Date): number {
  const time = date.getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Window summary of after-action reports.
 * A rating counts only when it is an integer from 1 to 10.
 * Hours are the stored `hoursLogged` totals, summed and averaged across
 * reports that have one.
 */
export function summarizeOperationDebriefs(args: {
  reviews: readonly OperationReview[]
  inWindow: (date: Date | string | undefined | null) => boolean
  titleOf: (operationId: string) => string
}): OperationDebriefSummary {
  const inWindow = args.reviews.filter((review) => args.inWindow(review.completedAt))
  const buckets = new Map<DebriefRatingKey, number[]>()
  let hoursSum = 0
  let hoursCount = 0
  const texts: DebriefText[] = []

  for (const review of inWindow) {
    for (const key of DEBRIEF_RATING_KEYS) {
      const score = clampReflectionScore(review.ratings?.[key])
      if (score === undefined) continue
      const bucket = buckets.get(key) ?? []
      bucket.push(score)
      buckets.set(key, bucket)
    }

    const hours = storedHours(review.hoursLogged)
    if (hours !== undefined) {
      hoursSum += hours
      hoursCount += 1
    }

    const summary = cleanText(review.summary) ?? ""
    const whatWorked = cleanText(review.whatWorked)
    const whatFailed = cleanText(review.whatFailed)
    const lessons = (review.lessons ?? []).map((line) => line.trim()).filter(Boolean)
    if (!summary && !whatWorked && !whatFailed && lessons.length === 0) continue
    const title = args.titleOf(review.operationId).trim() || "Operation"
    texts.push({
      id: review.id,
      operationId: review.operationId,
      title,
      completedAt: completedAtOf(review),
      summary,
      ...(whatWorked ? { whatWorked } : {}),
      ...(whatFailed ? { whatFailed } : {}),
      lessons,
    })
  }

  const ratings: DebriefRatingMean[] = DEBRIEF_RATING_KEYS.flatMap((key) => {
    const values = buckets.get(key) ?? []
    if (values.length === 0) return []
    const mean = values.reduce((sum, n) => sum + n, 0) / values.length
    return [{ key, label: DEBRIEF_RATING_LABELS[key], n: values.length, mean }]
  })

  texts.sort((a, b) => timeOf(b.completedAt) - timeOf(a.completedAt) || a.title.localeCompare(b.title))

  return {
    reviewCount: inWindow.length,
    ratings,
    hoursSum,
    hoursCount,
    ...(hoursCount > 0 ? { hoursMean: hoursSum / hoursCount } : {}),
    texts,
  }
}

/** One decimal when the stored hours are not a whole number. */
export function formatDebriefHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—"
  const rounded = Math.round(hours * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `${text} h`
}
