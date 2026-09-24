/**
 * components/Home/ToDo/CompletionTimeLine.tsx — When a Done row happened
 *
 * The meta line under a completed item: its clock window and duration. Values the
 * app derived rather than observed are marked **est.** (`lib/estimated-values.ts`)
 * — a tilde on the numbers and a chip that opens an inline editor, so confirming
 * "yes, 7:50–8:30, 40 minutes" or correcting it takes one click from the Done list
 * instead of waiting for the review. When history has two observed sessions of
 * the same title (or named type), a read-only **usually ~N** glance sits beside
 * that — it never rewrites `estimatedDuration`.
 *
 * Nothing here writes to a store; the parent hands down `onConfirm`.
 */
"use client"

import { useState } from "react"
import { format } from "date-fns"
import type { Task } from "@/lib/types"
import type { ConfirmedTimes } from "@/lib/services/completion-time-service"
import { useTaskStore } from "@/lib/task-store"
import {
  describeEstimates,
  formatDurationMinutes,
  formatUsualDuration,
  hasUnconfirmedEstimates,
  isEstimated,
  usualDurationMinutes,
} from "@/lib/estimated-values"

/** "7:50 – 8:30 PM" when both ends are known, else just the finish time. */
export function formatCompletionWindow(startedAt: Date | undefined, completedAt: Date): string {
  if (!startedAt || startedAt.getTime() >= completedAt.getTime()) return format(completedAt, "h:mm a")
  const sameHalf = format(startedAt, "a") === format(completedAt, "a")
  return `${format(startedAt, sameHalf ? "h:mm" : "h:mm a")} – ${format(completedAt, "h:mm a")}`
}

export function CompletionTimeLine({
  task,
  completedAt,
  showDate = false,
  onConfirm,
  history,
}: {
  task: Task
  completedAt: Date
  /** Week/month lists span days, so they lead with the date. */
  showDate?: boolean
  onConfirm?: (taskId: string, values: ConfirmedTimes) => void
  /** Peer records for the usual-duration glance. Defaults to the item store. */
  history?: Task[]
}) {
  const storeTasks = useTaskStore((s) => s.tasks)
  const usual = usualDurationMinutes(history ?? storeTasks, task)
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(() => format(completedAt, "HH:mm"))
  const [minutes, setMinutes] = useState(() => String(task.actualDuration ?? ""))

  const assumed = hasUnconfirmedEstimates(task)
  const duration = task.actualDuration
  const durationAssumed = isEstimated(task.estimates, "actualDuration")
  const windowAssumed = isEstimated(task.estimates, "completedDate") || isEstimated(task.estimates, "startedAt")

  const save = () => {
    const [hours, mins] = time.split(":").map((part) => Number.parseInt(part, 10))
    const corrected = new Date(completedAt)
    if (Number.isFinite(hours) && Number.isFinite(mins)) corrected.setHours(hours, mins, 0, 0)
    const parsed = Number.parseFloat(minutes)
    onConfirm?.(task.id, {
      completedAt: corrected,
      durationMinutes: minutes.trim() === "" ? 0 : Number.isFinite(parsed) ? parsed : undefined,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="todo-time" onClick={(e) => e.stopPropagation()}>
        <label>
          Finished
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label>
          Took
          <input
            type="number"
            min="0"
            step="5"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="min"
          />
          <span> min</span>
        </label>
        <button type="button" className="todo-btn" onClick={save}>
          Confirm
        </button>
        <button type="button" className="todo-btn" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="todo-time">
      <span>
        {showDate && `${format(completedAt, "MMM d")}, `}
        {windowAssumed && "~"}
        {formatCompletionWindow(task.startedAt, completedAt)}
      </span>
      {duration !== undefined && (
        <>
          <span aria-hidden>·</span>
          <span>
            {durationAssumed && "~"}
            {formatDurationMinutes(duration)}
          </span>
        </>
      )}
      {usual && (
        <>
          <span aria-hidden>·</span>
          <span title={usual.basis} className="todo-est" style={{ cursor: "default" }}>
            {formatUsualDuration(usual)}
          </span>
        </>
      )}
      {assumed && (
        <>
          <span aria-hidden>·</span>
          {onConfirm ? (
            <button
              type="button"
              title={describeEstimates(task.estimates)}
              className="todo-est"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              est.
            </button>
          ) : (
            <span title={describeEstimates(task.estimates)} className="todo-est">
              est.
            </span>
          )}
          {onConfirm && (
            <button
              type="button"
              className="todo-btn"
              title="These times look right — confirm them"
              onClick={(e) => {
                e.stopPropagation()
                onConfirm(task.id, {})
              }}
            >
              Looks right
            </button>
          )}
        </>
      )}
    </div>
  )
}
