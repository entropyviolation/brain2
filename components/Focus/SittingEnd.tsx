/**
 * components/Focus/SittingEnd.tsx — The end-of-sitting strip (Phase 15 A, UI-9)
 *
 * At Stop (focus bar) or on leaving Just Start: "Sat 52m. Left it here:" and
 * the next leaf (`rankStartSteps(task)[0]`), pre-written and editable.
 * **Keep** saves the text as that step's `context`, so the next sitting opens
 * on it. **Skip** closes the strip. Both call `onDone`. `paper` wears the
 * To Do panel's keys (a session's End), not the dark focus glass.
 */
"use client"

import { useMemo, useState } from "react"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { rankStartSteps, setStepContext } from "@/lib/next-step"
import "./focus-bar.css"

/** `52m`, `1h05`. */
export function formatSat(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`
}

export default function SittingEnd({
  task,
  minutes,
  onDone,
  paper = false,
}: {
  task: Task | undefined
  minutes: number
  onDone: () => void
  paper?: boolean
}) {
  const key = paper ? "todo-btn" : "focus-bar-key"
  const primary = paper ? "todo-btn is-primary" : "focus-bar-key is-primary"
  const next = useMemo(() => (task ? rankStartSteps(task, 1)[0] : undefined), [task])
  const [text, setText] = useState(() => next?.step.context ?? next?.step.description ?? "")

  const keep = () => {
    const words = text.trim()
    if (task && next && words && words !== (next.step.context ?? next.step.description)) {
      const live = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task
      useTaskStore.getState().updateTask({ ...live, subtasks: setStepContext(live.subtasks, next.step.id, words) })
    }
    onDone()
  }

  return (
    <div className={paper ? "sitting-end is-paper todo-session-ask" : "sitting-end"} role="dialog" aria-label="End of sitting" data-ui-name="End of sitting">
      <span className="sitting-end-text">Sat {formatSat(minutes)}.{next ? " Left it here:" : ""}</span>
      {next ? (
        <input
          className="sitting-end-field"
          type="text"
          autoFocus
          value={text}
          aria-label="Left it here"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") keep()
            if (e.key === "Escape") {
              e.stopPropagation()
              onDone()
            }
          }}
        />
      ) : null}
      {next ? (
        <button data-no95={paper ? undefined : ""} type="button" className={primary} onClick={keep}>
          Keep
        </button>
      ) : null}
      <button data-no95={paper ? undefined : ""} type="button" className={key} onClick={onDone}>
        {next ? "Skip" : "Close"}
      </button>
    </div>
  )
}
