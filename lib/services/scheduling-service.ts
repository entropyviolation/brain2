/**
 * lib/services/scheduling-service.ts — Task scheduling workflow
 *
 * Scheduling operations on top of the repository: place a task in a period
 * bucket, pin it to a specific day + time (the agenda), unschedule it, push it
 * forward one period, or roll an unfinished past period up one level while
 * keeping the prior placement in `schedulePlacements`. Field math is delegated
 * to `lib/scheduling.ts` and `lib/item-utils.ts` so the Scheduler UI and this
 * service stay in lockstep.
 *
 * Spec: §7 (Scheduler period funnel).
 */
import type { Task, SchedulePeriod } from "@/lib/types"
import { taskRepository, type TaskRepository } from "@/lib/data/task-repository"
import {
  scheduleFieldsForPeriod,
  clearedScheduleFields,
  rollUpScheduleFieldsCascaded,
} from "@/lib/scheduling"
import { pushTaskOnePeriod } from "@/lib/item-utils"

/** Schedule a task to a period bucket (year/month/week/day or always=clear). */
export function scheduleTask(
  id: string,
  period: SchedulePeriod,
  value: string,
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  if (period === "always") return repo.update({ ...task, ...clearedScheduleFields() })
  return repo.update({ ...task, ...scheduleFieldsForPeriod(period, value) })
}

/** Pin a task to a specific date + time of day (used by the daily agenda). */
export function scheduleTaskToTime(
  id: string,
  date: Date,
  time: string,
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return repo.update({
    ...task,
    scheduledDate: date,
    scheduledTime: time,
    scheduledWeek: undefined,
    scheduledMonth: undefined,
    scheduledYear: undefined,
  })
}

/** Remove all scheduling from a task. */
export function unscheduleTask(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return repo.update({ ...task, ...clearedScheduleFields() })
}

/** Toggle whether a task shows in the Scheduler (the "Show in Scheduler" flag). */
export function setTaskScheduleable(
  id: string,
  scheduleable: boolean,
  repo: TaskRepository = taskRepository,
): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return repo.update({ ...task, scheduleable })
}

/** Clear only the time-of-day slot (keeps the scheduled date). */
export function clearScheduledTime(id: string, repo: TaskRepository = taskRepository): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return repo.update({ ...task, scheduledTime: undefined })
}

/**
 * Roll unfinished past period assignments up one (or more) levels.
 * day → week → month → year → fully unscheduled. Records each vacated period
 * on `schedulePlacements` so gray past cells still show what was planned.
 * Does not increment daysPushed / weeksPushed / monthsPushed. Completed and
 * missed stay put. An explicit push already wrote a current/future period, so
 * it is not rolled. Returns the ids that were updated.
 */
export function rollUpExpiredSchedules(
  now: Date = new Date(),
  repo: TaskRepository = taskRepository,
): string[] {
  const rolled: string[] = []
  for (const task of repo.getAll()) {
    const patch = rollUpScheduleFieldsCascaded(task, now)
    if (!patch) continue
    repo.update({ ...task, ...patch })
    rolled.push(task.id)
  }
  return rolled
}

/**
 * @deprecated Prefer `rollUpExpiredSchedules`. Kept as an alias so older call
 * sites keep working during the carry-over switch.
 */
export function releaseExpiredDaySchedules(
  now: Date = new Date(),
  repo: TaskRepository = taskRepository,
): string[] {
  return rollUpExpiredSchedules(now, repo)
}

/** Push a task forward one period in the day/week/month To-Do views. */
export function pushTask(
  id: string,
  period: "day" | "week" | "month",
  repo: TaskRepository = taskRepository,
  refDate: Date = new Date(),
): Task | undefined {
  const task = repo.getById(id)
  if (!task) return undefined
  return repo.update({ ...task, ...pushTaskOnePeriod(task, period, refDate) })
}
