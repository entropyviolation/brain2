"use client"

/**
 * Fascia Pick list. No session until Session or Just 25.
 */
import { useMemo, useState } from "react"
import type { Task } from "@/lib/types"
import { JUST_25_TEMPLATE_ID, lineLabel, lineMinutes } from "@/lib/session-plan"
import { placeSteps, startOrderFor } from "@/lib/next-step"
import { isStepAvailable } from "@/lib/prereqs"
import { hasUnmetDependencies } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import { NativeSelect } from "@/components/ui/native-select"
import { fmtMinutes } from "./format"


/**
 * The pick list on its own (opened from the fascia **Pick list** key or the
 * caption): every open lowest-level step and step-less task, flat, with its
 * minutes and lock. Nothing is made until **Session** or **Just 25** is pressed.
 */
function FlatListView({
  tasks,
  periodTasks,
  periodLabel,
  onSession,
}: {
  tasks: Task[]
  periodTasks: Task[]
  periodLabel: string
  onSession: (ref: { taskId: string; stepId?: string }, templateId?: string) => void
}) {
  const [scope, setScope] = useState<"period" | "all">("period")
  const [query, setQuery] = useState("")
  const [onlyReady, setOnlyReady] = useState(false)
  const rows = useMemo(() => {
    const base = scope === "period" ? periodTasks : tasks.filter((t) => !t.completed && !isClearedFromWork(t))
    const live = base.map((t) => tasks.find((x) => x.id === t.id) ?? t).filter((t) => !t.completed)
    const needle = query.trim().toLowerCase()
    const out: { key: string; ref: { taskId: string; stepId?: string }; label: string; minutes: number; locked: boolean }[] = []
    for (const task of live) {
      const taskLocked = hasUnmetDependencies(task, tasks)
      // Same rank as Just Start (`startOrderFor`): level, unlock value, estimate, spark, atomic, tree order.
      const leaves = placeSteps(task.subtasks)
        .filter((p) => !p.step.completed && !p.step.subtasks?.some((c) => !c.completed))
        .sort(startOrderFor(task.subtasks))
      const refs: { taskId: string; stepId?: string }[] = task.subtasks?.length ? leaves.map((p) => ({ taskId: task.id, stepId: p.step.id })) : [{ taskId: task.id }]
      for (const ref of refs) {
        const locked = taskLocked || (!!ref.stepId && !isStepAvailable(task.subtasks, ref.stepId))
        if (onlyReady && locked) continue
        const label = lineLabel(ref, tasks)
        if (needle && !label.toLowerCase().includes(needle)) continue
        out.push({ key: `${ref.taskId}|${ref.stepId ?? ""}`, ref, label, minutes: lineMinutes(ref, tasks), locked })
      }
    }
    return out
  }, [scope, periodTasks, tasks, query, onlyReady])
  return (
    <section className="todo-session-pick todo-session-flat" aria-label="Flat pick list">
      <div className="todo-session-pick-bar">
        <NativeSelect aria-label="Which tasks" value={scope} onChange={(e) => setScope(e.target.value as "period" | "all")}>
          <option value="period">{periodLabel || "This day"}</option>
          <option value="all">All open tasks</option>
        </NativeSelect>
        <input type="search" placeholder="Search tasks and steps" aria-label="Search pick list" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Available now
        </label>
      </div>
      <ul className="todo-session-picklist">
        {rows.length === 0 ? <li className="todo-empty">Nothing open here.</li> : null}
        {rows.map((row) => (
          <li key={row.key} className="todo-session-pickline">
            <span className="todo-session-pickname">{row.label}</span>
            {row.locked ? <span className="todo-row-lock">waits</span> : null}
            <span className="todo-session-mins">{row.minutes ? fmtMinutes(row.minutes) : "–"}</span>
            <button type="button" className="todo-verb" aria-label={`Session with ${row.label}`} onClick={() => onSession(row.ref)}>
              Session
            </button>
            <button type="button" className="todo-verb" aria-label={`Just 25 on ${row.label}`} onClick={() => onSession(row.ref, JUST_25_TEMPLATE_ID)}>
              Just 25
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

export { FlatListView }
