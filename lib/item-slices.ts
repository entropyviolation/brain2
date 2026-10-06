/**
 * lib/item-slices.ts — small task slices for views that do not need the vault
 *
 * Each function takes the task array (and the dates or keys it already
 * filters by) and returns that subset. No React and no store. A view passes
 * the function to `useTaskStore` so the snapshot is the slice.
 *
 * The previous array is reused when the chosen task objects are the same
 * objects in the same order. An edit to some other item then keeps the
 * snapshot, and the view does not re-derive that slice during render.
 */
import { sortInboxNewestFirst, inInboxPartition } from "@/lib/inbox-batch"
import {
  dateKeyOf,
  formatDateKey,
  formatLocalDateKey,
  isPastLocalCalendarDay,
  sameCalendarDay,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { scheduledDateCountsOnPlan } from "@/lib/item-utils"
import { selectOperations } from "@/lib/operations"
import type { Task } from "@/lib/types"

type Held = { source: readonly Task[]; slice: Task[] }

const held = new Map<string, Held>()

function sameTaskRefs(a: readonly Task[], b: readonly Task[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function holdSlice(slot: string, tasks: readonly Task[], key: string, build: () => Task[]): Task[] {
  const id = `${slot}\0${key}`
  const prev = held.get(id)
  if (prev && prev.source === tasks) return prev.slice
  const next = build()
  if (prev && sameTaskRefs(prev.slice, next)) {
    held.set(id, { source: tasks, slice: prev.slice })
    return prev.slice
  }
  held.set(id, { source: tasks, slice: next })
  return next
}

function daysKey(days: readonly Date[]): string {
  let key = ""
  for (const day of days) {
    if (key) key += ","
    key += formatLocalDateKey(day)
  }
  return key
}

/** Tasks whose `scheduledDate` falls on this local calendar day. Inbox prose dates do not count. */
export function tasksScheduledOnCalendarDay(tasks: readonly Task[], day: Date): Task[] {
  const key = formatLocalDateKey(day)
  return holdSlice("scheduled-day", tasks, key, () =>
    tasks.filter(
      (task) =>
        scheduledDateCountsOnPlan(task) && !!task.scheduledDate && sameCalendarDay(task.scheduledDate, day),
    ),
  )
}

/** Tasks with both a date and a clock time on one of these local days. */
export function tasksTimedOnDays(tasks: readonly Task[], days: readonly Date[]): Task[] {
  const key = daysKey(days)
  return holdSlice("timed-days", tasks, key, () => {
    if (days.length === 0) return []
    const keys = new Set(days.map((day) => formatLocalDateKey(day)))
    return tasks.filter((task) => {
      if (!scheduledDateCountsOnPlan(task) || !task.scheduledDate || !task.scheduledTime) return false
      const scheduled = dateKeyOf(task.scheduledDate)
      return scheduled != null && keys.has(scheduled)
    })
  })
}

/**
 * Month-calendar membership for one local day.
 *
 * A chip belongs on that day when the item is scheduled there, or when the
 * day is already over and the item was completed that day. Inbox captures
 * are not a schedule: Quick Add can copy a date out of the prose into
 * `scheduledDate`, and Inbox has no Scheduling tab, so that field does not
 * place them. A past completion still does. List membership (Reminders and
 * the rest) does not.
 */
export function taskOnPlanCalendarDay(
  task: Pick<Task, "stage" | "scheduledDate" | "completed" | "completedDate">,
  day: Date,
  now: Date = new Date(),
): boolean {
  if (scheduledDateCountsOnPlan(task) && task.scheduledDate && sameCalendarDay(task.scheduledDate, day)) {
    return true
  }
  if (!isPastLocalCalendarDay(day, now)) return false
  return !!task.completed && sameCalendarDay(task.completedDate, day)
}

/** Tasks that belong on at least one of these month-grid days. */
export function tasksForPlanCalendar(
  tasks: readonly Task[],
  days: readonly Date[],
  now: Date = new Date(),
): Task[] {
  const key = `${daysKey(days)}\0${formatLocalDateKey(now)}`
  return holdSlice("plan-calendar", tasks, key, () => {
    if (days.length === 0) return []
    return tasks.filter((task) => days.some((day) => taskOnPlanCalendarDay(task, day, now)))
  })
}

/** Tasks whose `scheduledDate` falls on one of these local days (timed or not). */
export function tasksScheduledOnDays(tasks: readonly Task[], days: readonly Date[]): Task[] {
  const key = daysKey(days)
  return holdSlice("scheduled-days", tasks, key, () => {
    if (days.length === 0) return []
    const keys = new Set(days.map((day) => formatLocalDateKey(day)))
    return tasks.filter((task) => {
      if (!scheduledDateCountsOnPlan(task) || !task.scheduledDate) return false
      const scheduled = dateKeyOf(task.scheduledDate)
      return scheduled != null && keys.has(scheduled)
    })
  })
}

/**
 * Month gem cell: scheduled on this day, or completed on this day.
 * A completion can sit on a day the item was not scheduled.
 */
export function tasksForGemDay(tasks: readonly Task[], day: Date): Task[] {
  const key = formatLocalDateKey(day)
  return holdSlice("gem-day", tasks, key, () =>
    tasks.filter(
      (task) =>
        (!!task.scheduledDate && sameCalendarDay(task.scheduledDate, day)) ||
        (!!task.completed && sameCalendarDay(task.completedDate, day)),
    ),
  )
}

/** Home day counts: not hidden from To Do, and scheduled or due this day. */
export function homeDayTodoTasks(tasks: readonly Task[], day: Date): Task[] {
  const key = formatLocalDateKey(day)
  return holdSlice("home-day-todos", tasks, key, () =>
    tasks.filter((task) => !task.hiddenFromTodo && taskScheduledOnDay(task, day)),
  )
}

/** Next tile: open To Do rows that land on this day. */
export function openTodosOnDay(tasks: readonly Task[], day: Date): Task[] {
  const key = formatLocalDateKey(day)
  return holdSlice("open-todos-day", tasks, key, () =>
    tasks.filter((task) => !task.hiddenFromTodo && !task.completed && taskScheduledOnDay(task, day)),
  )
}

/** Revisit Inbox, newest first. Monkey brain and done rows stay out. */
export function revisitInboxTasks(tasks: readonly Task[]): Task[] {
  return holdSlice("revisit-inbox", tasks, "", () =>
    sortInboxNewestFirst(tasks.filter((task) => inInboxPartition(task, "inbox"))),
  )
}

/** Operation items. Same membership as `selectOperations`. */
export function operationTasks(tasks: readonly Task[]): Task[] {
  return holdSlice("operations", tasks, "", () => selectOperations(tasks as Task[]))
}

/** Items with a `timeLogs` row whose date is one of these keys. */
export function tasksWithTimeLogOnDays(tasks: readonly Task[], dayKeys: readonly string[]): Task[] {
  const key = dayKeys.join(",")
  return holdSlice("time-log-days", tasks, key, () => {
    if (dayKeys.length === 0) return []
    const keys = new Set(dayKeys)
    return tasks.filter((task) => (task.timeLogs ?? []).some((log) => keys.has(log.date)))
  })
}

/**
 * Day Log columns: an open item scheduled on one of these days, or any item
 * with a time log on one of them. Log dates match the local key or the UTC
 * key, the same pair Day Log already accepts.
 */
export function tasksForDayLog(tasks: readonly Task[], days: readonly Date[]): Task[] {
  const key = daysKey(days)
  return holdSlice("day-log", tasks, key, () => {
    if (days.length === 0) return []
    const local = new Set(days.map((day) => formatLocalDateKey(day)))
    const aliases = new Set<string>()
    for (const day of days) {
      aliases.add(formatLocalDateKey(day))
      aliases.add(formatDateKey(day))
    }
    return tasks.filter((task) => {
      if (!task.completed && task.scheduledDate) {
        const scheduled = dateKeyOf(task.scheduledDate)
        if (scheduled != null && local.has(scheduled)) return true
      }
      return (task.timeLogs ?? []).some((log) => aliases.has(log.date))
    })
  })
}
