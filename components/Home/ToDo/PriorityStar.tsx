/**
 * components/Home/ToDo/PriorityStar.tsx — The task card's priority star
 *
 * Works like Prioritize habit: a press is an intent that must be reaffirmed.
 * The star loses 10 points a day from `Task.priorityRefreshedOn`
 * (`priorityStarFade`, the habit rule). Each press can carry a plain-text
 * reason; every press is kept on `Task.priorityLog`. The on/off mark itself
 * still goes through the host (`onToggle`), so lists and sorting agree.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Star } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { priorityStarFade } from "@/lib/habit-priority"
import type { Task, TaskPriorityEntry } from "@/lib/types"

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const KIND = { set: "Prioritized", refreshed: "Reaffirmed", off: "Removed" } as const

export function PriorityStar({ task, on, periodLabel, onToggle }: { task: Task; on: boolean; periodLabel: string; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState("")
  const wrap = useRef<HTMLSpanElement>(null)
  const strength = on ? priorityStarFade(task.priorityRefreshedOn, new Date()) : 0
  const log = task.priorityLog ?? []

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      wrap.current?.querySelector<HTMLElement>(".tc-star")?.focus()
    }
    const onDown = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  const press = (kind: TaskPriorityEntry["kind"]) => {
    if (kind === "set" ? !on : kind === "off") onToggle()
    const now = new Date()
    const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task
    const entry: TaskPriorityEntry = { at: now.toISOString(), dayKey: dayKey(now), kind, ...(why.trim() ? { reasoning: why.trim() } : {}) }
    useTaskStore.getState().updateTask({
      ...fresh,
      priorityLog: [...(fresh.priorityLog ?? []), entry],
      ...(kind === "off" ? {} : { priorityRefreshedOn: dayKey(now) }),
    })
    setWhy("")
    setOpen(false)
  }

  return (
    <span className="tcs-stat-wrap" ref={wrap}>
      <button
        type="button"
        className="task-card-jewel is-prioritized is-icon tc-star"
        aria-pressed={on}
        aria-expanded={open}
        aria-label="Prioritized"
        title={on ? `Prioritized for ${periodLabel.toLowerCase()} · star at ${strength}%. Click to reaffirm or remove.` : "Prioritize: do this before the rest. Click to say why."}
        onClick={() => setOpen((o) => !o)}
      >
        <Star size={17} aria-hidden fill={on ? "currentColor" : "none"} style={{ opacity: on ? Math.max(0.25, strength / 100) : 1 }} />
      </button>
      {open ? (
        <div className="tcs-stat-pop tc-star-pop" role="group" aria-label="Priority">
          <p className="tcs-pop-lead">
            {on ? `Star at ${strength}%. It loses 10 points a day until you reaffirm it.` : "Prioritizing is an intent. Reaffirm it to keep the star bright."}
          </p>
          <label className="tc-why">
            <span>Why this is a priority</span>
            <textarea autoFocus rows={3} value={why} placeholder="In plain words…" onChange={(e) => setWhy(e.target.value)} />
          </label>
          <div className="tc-star-actions">
            <button type="button" className="task-card-key" onClick={() => press(on ? "refreshed" : "set")}>
              {on ? "Reaffirm" : "Prioritize"}
            </button>
            {on ? (
              <button type="button" className="task-card-key" onClick={() => press("off")}>
                Remove priority
              </button>
            ) : null}
          </div>
          {log.length ? (
            <ul className="tc-star-log" aria-label="Priority history">
              {log
                .slice(-6)
                .reverse()
                .map((e) => (
                  <li key={e.at}>
                    <b>{e.dayKey}</b> {KIND[e.kind]}
                    {e.reasoning ? <> — {e.reasoning}</> : null}
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </span>
  )
}
