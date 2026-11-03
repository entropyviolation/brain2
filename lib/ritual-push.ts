/**
 * lib/ritual-push.ts — Push a task out of the period a ritual is reviewing
 *
 * Same move as the Scheduler card: `pushCardWorkingQueue` reassigns the task
 * to the next open period and marks the one being left `pushed`. The ritual
 * then drops the row. Quarter has no scheduler card, so the push lands on the
 * month inside that season the task actually sits on, and the season's other
 * months that held it are marked pushed too — one schedule step, not three.
 */
import type { ReviewPeriod, SchedulePlacement, Task } from "@/lib/types"
import { pushCardWorkingQueue } from "@/components/Scheduler/schedule-card-detail"
import { recordPushedPlacement, taskWasScheduledForPeriod } from "@/lib/scheduling"
import { monthsInQuarter } from "@/lib/seasons"

export function ritualPushPatch(task: Task, period: ReviewPeriod, periodKey: string, now: Date = new Date()): Partial<Task> {
  if (period === "quarter") {
    const months = monthsInQuarter(periodKey)
    const anchor = months.find((month) => taskWasScheduledForPeriod(task, "month", month)) ?? months[0]
    if (!anchor) return {}
    const stepped = pushCardWorkingQueue(task, "month", anchor, now)
    let placements = (stepped.schedulePlacements as SchedulePlacement[] | undefined) ?? task.schedulePlacements
    for (const month of months) {
      if (month === anchor || taskWasScheduledForPeriod(task, "month", month)) {
        placements = recordPushedPlacement(placements, "month", month)
      }
    }
    return { ...stepped, schedulePlacements: placements }
  }
  return pushCardWorkingQueue(task, period, periodKey, now)
}
