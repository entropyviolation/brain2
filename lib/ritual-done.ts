/**
 * lib/ritual-done.ts — When "Done" in an end ritual says the work finished
 *
 * Done on a night (or week–year review) row means it was finished some time
 * in the period being reviewed, not when the button was pressed. The clock
 * time is unknown, so the stamp is noon on the period's last day (or now, if
 * that is still ahead) and carries an unconfirmed `completedDate` estimate.
 * That estimate puts the row in Assumed times, where the person sets it.
 */
import { dateFromPeriodKey, nextPeriodDate } from "@/lib/reviews-store"
import type { FieldEstimate, ReviewPeriod, Task } from "@/lib/types"

export const RITUAL_DONE_BASIS = "Done in the ritual; time not known"

/** Noon on the last day of the period, never later than `now`. */
export function ritualDoneStamp(period: ReviewPeriod, periodKey: string, now = new Date()): Date {
  const start = dateFromPeriodKey(period, periodKey)
  const anchor = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0)
  const next = period === "day" ? anchor : nextPeriodDate(period, anchor)
  const last =
    period === "day" ? anchor : new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1, 12, 0, 0)
  return last.getTime() > now.getTime() ? now : last
}

/** The task as completed inside the period, with its time left to confirm. */
export function ritualDonePatch(task: Task, period: ReviewPeriod, periodKey: string, now = new Date()): Task {
  const estimate: FieldEstimate = {
    field: "completedDate",
    kind: "anchor",
    basis: RITUAL_DONE_BASIS,
    generatedAt: now.toISOString(),
  }
  return {
    ...task,
    completed: true,
    completedDate: ritualDoneStamp(period, periodKey, now),
    completedCertainty: "estimated",
    estimates: [...(task.estimates ?? []).filter((e) => e.field !== "completedDate"), estimate],
  }
}
