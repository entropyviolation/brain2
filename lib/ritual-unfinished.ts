/**
 * lib/ritual-unfinished.ts — Unfinished work for a ritual's own period
 *
 * The night / review ritual asks about work left unfinished in the period
 * being reviewed. A past day is the Undone ledger for that calendar day
 * (`tasksUndoneForPeriod`): placements survive after midnight rolls the live
 * schedule onto today. Reading `scheduledDate === today` hides yesterday's
 * unfinished rows. An open period uses the prospective To Do list for that
 * same key. A placement already marked pushed is off this ritual's list —
 * the Scheduler keeps it on Undone history, but the person already moved it.
 */
import type { ReviewPeriod, Task } from "@/lib/types"
import { tasksProspectiveForPeriod, tasksUndoneForPeriod } from "@/lib/period-ledger"
import { isPastFunnelPeriod, isPlacementPushed } from "@/lib/scheduling"

function monthsInQuarter(key: string): string[] {
  const [year, quarter] = key.split("-Q")
  const start = (Number(quarter) - 1) * 3 + 1
  if (!year || !Number.isFinite(start) || start < 1) return []
  return [0, 1, 2].map((i) => `${year}-${String(start + i).padStart(2, "0")}`)
}

function forLedgerPeriod(
  tasks: Task[],
  period: "day" | "week" | "month" | "year",
  value: string,
  now: Date,
): Task[] {
  if (isPastFunnelPeriod(period, value, now)) return tasksUndoneForPeriod(tasks, period, value, now)
  return tasksProspectiveForPeriod(tasks, period, value, now)
}

/**
 * Open work that belongs to this ritual's period, keyed by the ritual's
 * period key — never by "today" unless that key is today.
 */
export function unfinishedTasksForRitual(
  tasks: Task[],
  period: ReviewPeriod,
  periodKey: string,
  now: Date = new Date(),
): Task[] {
  if (period === "quarter") {
    const seen = new Set<string>()
    const rows: Task[] = []
    for (const month of monthsInQuarter(periodKey)) {
      for (const task of forLedgerPeriod(tasks, "month", month, now)) {
        if (seen.has(task.id)) continue
        seen.add(task.id)
        rows.push(task)
      }
    }
    return rows.filter((task) => stillOpen(task, "quarter", periodKey))
  }
  return forLedgerPeriod(tasks, period, periodKey, now).filter((task) => stillOpen(task, period, periodKey))
}

function stillOpen(task: Task, period: ReviewPeriod, periodKey: string): boolean {
  if (period === "quarter") {
    const months = monthsInQuarter(periodKey)
    const held = months.filter((month) =>
      (task.schedulePlacements ?? []).some((placement) => placement.period === "month" && placement.value === month),
    )
    if (!held.length) return true
    return held.some((month) => !isPlacementPushed(task, "month", month))
  }
  if (period === "day" || period === "week" || period === "month" || period === "year") {
    return !isPlacementPushed(task, period, periodKey)
  }
  return true
}
