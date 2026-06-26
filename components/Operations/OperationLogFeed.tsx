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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { getOperationTaskTree, loggedMinutes, minutesToHours, rollupMinutes } from "@/lib/operations"
import type { Task, TimeLogEntry } from "@/lib/types"
import { logTime } from "./operation-actions"

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
        rows.push({ log, taskTitle: task.description })
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-teal-600" />
          Log
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{totalHours}h total</span>
      </div>

      <div className="flex items-end gap-2">
        <div className="w-24">
          <Input
            type="number"
            min={1}
            value={minutesDraft}
            onChange={(e) => setMinutesDraft(e.target.value)}
            placeholder="min"
          />
        </div>
        <Input
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="What did you work on?"
        />
        <Button onClick={submit} disabled={!Number(minutesDraft)}>
          Log time
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No time logged yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((row) => (
            <li key={row.log.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{row.log.date}</span>
              <span className="w-16 shrink-0 font-medium tabular-nums">{row.log.durationMinutes}m</span>
              <span className="min-w-0 flex-1 truncate">
                {row.log.notes || row.log.activityLabel || row.taskTitle}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block sm:max-w-[8rem]">
                {row.taskTitle}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OperationLogFeed
