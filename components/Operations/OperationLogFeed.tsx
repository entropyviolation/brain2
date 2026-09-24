/**
 * components/Operations/OperationLogFeed.tsx — Operation activity log
 *
 * A reverse-chronological feed of the time logged across the operation and its
 * task tree (each `TimeLogEntry`), plus a quick "log time" form that appends an
 * entry to the operation. Shows which task each entry belongs to and a running
 * total of hours.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { getOperationTaskTree, loggedMinutes, minutesToHours, rollupMinutes } from "@/lib/operations"
import type { Task, TimeLogEntry } from "@/lib/types"
import { logTime } from "./operation-actions"
import { itemTitle } from "@/lib/item-utils"

interface FeedRow {
  log: TimeLogEntry
  taskTitle: string
}

export function OperationLogFeed({ operation }: { operation: Task }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const [minutesDraft, setMinutesDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")

  const { rows, totalHours } = useMemo(() => {
    const tree = getOperationTaskTree(operation.id, allTasks)
    const contributors = [operation, ...tree]
    const rows: FeedRow[] = []
    for (const task of contributors) {
      for (const log of task.timeLogs ?? []) {
        rows.push({ log, taskTitle: itemTitle(task) })
      }
    }
    rows.sort((a, b) => (a.log.date < b.log.date ? 1 : a.log.date > b.log.date ? -1 : 0))
    const totalMinutes = loggedMinutes(operation) + rollupMinutes(tree)
    return { rows, totalHours: minutesToHours(totalMinutes) }
  }, [operation, allTasks])

  const submit = () => {
    const minutes = Number(minutesDraft)
    if (!Number.isFinite(minutes) || minutes <= 0) return
    logTime(operation.id, { durationMinutes: minutes, notes: noteDraft.trim() || undefined })
    setMinutesDraft("")
    setNoteDraft("")
  }

  return (
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">
          Log
          <span>{totalHours}h total</span>
        </div>
        <div className="ops-add-row">
          <input
            className="ops-input"
            style={{ flex: "0 0 5.5rem", width: "5.5rem" }}
            type="number"
            min={1}
            value={minutesDraft}
            onChange={(e) => setMinutesDraft(e.target.value)}
            placeholder="min"
            aria-label="Minutes"
          />
          <input
            className="ops-input"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="What did you work on?"
          />
          <button type="button" className="ops-btn ops-btn-default" onClick={submit} disabled={!Number(minutesDraft)}>
            Log time
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="ops-hint">No time logged yet.</p>
      ) : (
        <ul className="ops-log">
          {rows.map((row) => (
            <li key={row.log.id}>
              <span className="w-24 shrink-0 tabular-nums">{row.log.date}</span>
              <span className="w-16 shrink-0 font-medium tabular-nums">{row.log.durationMinutes}m</span>
              <span className="min-w-0 flex-1 truncate">{row.log.notes || row.log.activityLabel || row.taskTitle}</span>
              <span className="hidden max-w-[8rem] truncate sm:block">{row.taskTitle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OperationLogFeed
