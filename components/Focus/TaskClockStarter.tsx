/**
 * components/Focus/TaskClockStarter.tsx — ▶ for a task or step, and the pen it asks for
 *
 * `useTaskClockStarter()` returns `start(taskId, stepId?)` and a `picker`
 * element to render. Start puts the task on the Tracking pen clock
 * (`lib/task-clock.ts`). A task with no linked pen, while nothing is running,
 * asks once which pen to paint with; **Remember for this task** (on by
 * default) saves it in `Task.penLinks`.
 *
 * The picker is a Radix dialog, so it stacks over another open one (the
 * Session popup): Radix gives the top dialog the clicks, focus and Escape.
 * A plain portal to `body` sat under the Session dialog's modal layer and
 * could not be clicked or closed.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { startTaskClock } from "@/lib/task-clock"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import "./focus-bar.css"

interface PenRow {
  penId: string
  name: string
  color: string
  scopeName: string
  lastUsedAt: number
}

function TaskPenPicker({
  taskName,
  onPick,
  onCancel,
}: {
  taskName: string
  onPick: (penId: string, remember: boolean) => void
  onCancel: () => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [query, setQuery] = useState("")
  const [remember, setRemember] = useState(true)
  const rows = useMemo(() => {
    const all: PenRow[] = []
    for (const scope of scopes) {
      for (const pen of scope.pens) {
        all.push({ penId: pen.id, name: pen.name, color: pen.color, scopeName: scope.name, lastUsedAt: pen.lastUsedAt ?? 0 })
      }
    }
    const needle = query.trim().toLowerCase()
    return all
      .filter((row) => !needle || row.name.toLowerCase().includes(needle) || row.scopeName.toLowerCase().includes(needle))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt || a.name.localeCompare(b.name))
      .slice(0, 40)
  }, [scopes, query])

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="task-pen-picker"
        overlayClassName="task-pen-picker-scrim"
        hideClose
        aria-describedby={undefined}
        aria-label={`Pen for ${taskName}`}
        data-ui-name="Task pen"
        data-ui-docs="components/Focus/README.md"
      >
        <DialogTitle className="sr-only">Pen for {taskName}</DialogTitle>
        <p className="task-pen-picker-title">Which pen is {taskName}?</p>
        <p className="task-pen-picker-hint">Its time paints Tracking with this pen while the clock runs.</p>
        <input
          className="task-pen-picker-search"
          type="text"
          autoFocus
          value={query}
          placeholder="Search pens"
          aria-label="Search pens"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && rows[0]) onPick(rows[0].penId, remember)
          }}
        />
        <ul className="task-pen-picker-list">
          {rows.map((row) => (
            <li key={row.penId}>
              <button data-no95 type="button" onClick={() => onPick(row.penId, remember)}>
                <span className="task-pen-picker-swatch" style={{ background: row.color }} aria-hidden />
                <span className="task-pen-picker-name">{row.name}</span>
                <span className="task-pen-picker-view">{row.scopeName}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="task-pen-picker-empty">No pen matches. Make one in Tracking.</li> : null}
        </ul>
        <div className="task-pen-picker-foot">
          <label>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember for this task
          </label>
          <button data-no95 type="button" className="task-pen-picker-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useTaskClockStarter() {
  const [ask, setAsk] = useState<{ taskId: string; stepId?: string } | null>(null)
  const askedTask = useTaskStore((s) => (ask ? s.tasks.find((t) => t.id === ask.taskId) : undefined))

  const start = (taskId: string, stepId?: string) => {
    const result = startTaskClock(taskId, { stepId })
    if (result.kind === "needs-pen") setAsk({ taskId, stepId })
  }

  const picker = ask ? (
    <TaskPenPicker
      taskName={itemTitleOrUntitled(askedTask)}
      onCancel={() => setAsk(null)}
      onPick={(penId, remember) => {
        startTaskClock(ask.taskId, { stepId: ask.stepId, penId, rememberPen: remember })
        setAsk(null)
      }}
    />
  ) : null

  return { start, picker }
}
