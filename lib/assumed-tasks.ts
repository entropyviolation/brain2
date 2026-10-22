/**
 * lib/assumed-tasks.ts — Which finished tasks still have assumed times
 *
 * Plain TypeScript so Node scripts (the phone hub, via lib/ingest/apply-ritual.ts)
 * can use it without loading the React section in components/Reviews/.
 */
import type { ReviewPeriod, Task } from "@/lib/types"
import { hasUnconfirmedEstimates } from "@/lib/estimated-values"
import { dateFromPeriodKey } from "@/lib/reviews-store"
import { taskCompletedInMonth, taskCompletedInWeek, taskCompletedOnDay } from "@/components/Home/ToDo/todo-utils"

export function pendingAssumedTasks(tasks: Task[], period: ReviewPeriod, periodKey: string): Task[] {
  return tasks
    .filter((task) => task.completed && hasUnconfirmedEstimates(task) && completedInPeriod(task, period, periodKey))
    .sort((a, b) => (a.completedDate?.getTime() ?? 0) - (b.completedDate?.getTime() ?? 0))
}

function completedInPeriod(task: Task, period: ReviewPeriod, key: string): boolean {
  const ref = dateFromPeriodKey(period, key)
  switch (period) {
    case "day":
      return taskCompletedOnDay(task, ref)
    case "week":
      return taskCompletedInWeek(task, key)
    case "month":
      return taskCompletedInMonth(task, key)
    default:
      // Quarter/year reviews are too coarse for minute-level confirmation.
      return false
  }
}
