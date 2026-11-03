/**
 * components/Home/ToDo/desk/todo-desk-schedule.ts — Where a scheduled task lands
 *
 * Day writes `scheduledDate`, week writes `scheduledWeek`, month writes
 * `scheduledMonth`. Season adds use month, on `seasonMonthDate`.
 */
import type { Task } from "@/lib/types"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { quarterKey, quarterStartDate } from "@/lib/seasons"
import { getMonthKey, type TodoPeriod } from "../todo-utils"

export function scheduleTaskForPeriod(task: Task, period: TodoPeriod, refDate: Date) {
  if (period === "day") {
    task.scheduledDate = toLocalCalendarDate(refDate)
  } else if (period === "week") {
    task.scheduledWeek = getWeekString(refDate)
  } else {
    task.scheduledMonth = getMonthKey(refDate)
  }
}

/** This month while the season is current, else the season's first month. */
export function seasonMonthDate(focusedDate: Date) {
  return quarterKey(focusedDate) === quarterKey(new Date()) ? new Date() : quarterStartDate(focusedDate)
}
