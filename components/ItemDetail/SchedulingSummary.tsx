/**
 * components/ItemDetail/SchedulingSummary.tsx — Scheduling tab readout
 *
 * One CRT strip that answers "where does this item sit right now": its
 * placement (day and time, week, month, or year), its deadline, whether it is
 * in the Scheduler, and whether Auto-push is on. Read-only; the fields below
 * it stay the editors. Shared by the popup and the page.
 */
"use client"

import { isTaskScheduleable } from "@/components/Scheduler/scheduler-utils"
import type { Task } from "@/lib/types"

function day(value: Date | string | undefined): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function placement(task: Task): string {
  const date = day(task.scheduledDate)
  if (date) return task.scheduledTime ? `${date} · ${task.scheduledTime}` : date
  if (task.scheduledWeek) return `Week ${task.scheduledWeek}`
  if (task.scheduledMonth) return `Month ${task.scheduledMonth}`
  if (task.scheduledYear) return `Year ${task.scheduledYear}`
  return "Not placed"
}

export function SchedulingSummary({ task, scheduleableCategoryIds }: { task: Task; scheduleableCategoryIds: Set<string> }) {
  const inScheduler = isTaskScheduleable(task, scheduleableCategoryIds)
  const deadline = day(task.deadline)
  const rows: { label: string; value: string; on?: boolean }[] = [
    { label: "Placed", value: placement(task), on: placement(task) !== "Not placed" },
    { label: "Deadline", value: deadline ?? "None", on: Boolean(deadline) },
    { label: "Scheduler", value: inScheduler ? "Sent" : "Not sent", on: inScheduler },
    { label: "Auto-push", value: task.autoPush === true ? "On" : "Off", on: task.autoPush === true },
  ]
  return (
    <div className="id-sched-readout" role="group" aria-label="Scheduling summary" data-testid="scheduling-summary">
      {rows.map((row) => (
        <div key={row.label} className="id-sched-cell" data-on={row.on ? "true" : "false"}>
          <span className="id-sched-cell-label">{row.label}</span>
          <span className="id-sched-cell-value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
