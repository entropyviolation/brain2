/**
 * components/Home/ToDo/PriorityStar.tsx — The task card's priority star
 *
 * Works like Prioritize habit: a press is an intent that must be reaffirmed.
 * The face is silver chrome. Shine is `priorityStarShine` (`priorityStarFade`:
 * 100 on `Task.priorityRefreshedOn`, −10 a day, 0 from day 10). At 14 days
 * the mark comes off on read (`priorityStarStale`). Each press can carry a
 * plain-text reason; every press is kept on `Task.priorityLog`. The on/off
 * mark itself still goes through the host (`onToggle`).
 */
"use client"

import { useEffect, useId, useRef, useState, type CSSProperties } from "react"
import { useTaskStore } from "@/lib/task-store"
import { priorityStarShine } from "@/lib/todo-commitment"
import type { Task, TaskPriorityEntry } from "@/lib/types"
import "./priority-star.css"

const STAR = "M12 1.7 14.85 8.15 21.8 8.85 16.55 13.55 18.05 20.55 12 16.85 5.95 20.55 7.45 13.55 2.2 8.85 9.15 8.15 Z"
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const KIND = { set: "Prioritized", refreshed: "Reaffirmed", off: "Removed" } as const

/** Bright chrome at shine 1, a flatter silver at 0. Still a readable star. */
function mixRgb(bright: readonly [number, number, number], dull: readonly [number, number, number], shine: number): string {
  const t = Math.min(1, Math.max(0, shine))
  const channel = (i: number) => Math.round(bright[i] * t + dull[i] * (1 - t))
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
}

function chromeStarPaint(shine: number) {
  const t = Math.min(1, Math.max(0, shine))
  return {
    hi: mixRgb([255, 255, 255], [186, 190, 196], t),
    mid: mixRgb([206, 214, 222], [152, 158, 164], t),
    edge: mixRgb([58, 66, 76], [128, 134, 140], t),
    rim: mixRgb([36, 42, 50], [112, 118, 124], t),
    gloss: 0.18 + t * 0.78,
    catch: 0.12 + t * 0.55,
  }
}

function ChromeStar({ on, shine }: { on: boolean; shine: number }) {
  const id = useId().replace(/:/g, "")
  if (!on) {
    return (
      <svg className="tc-star-face is-off" viewBox="0 0 24 24" width="17" height="17" aria-hidden>
        <path d={STAR} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    )
  }
  const paint = chromeStarPaint(shine)
  return (
    <svg className="tc-star-face is-on" viewBox="0 0 24 24" width="17" height="17" aria-hidden>
      <defs>
        <linearGradient id={`${id}-metal`} x1="12%" y1="0%" x2="88%" y2="100%">
          <stop offset="0%" stopColor={paint.hi} />
          <stop offset="38%" stopColor={paint.mid} />
          <stop offset="72%" stopColor={paint.edge} />
          <stop offset="100%" stopColor={paint.mid} />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="30%" y1="0%" x2="70%" y2="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={paint.gloss} />
          <stop offset="46%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={STAR} />
        </clipPath>
      </defs>
      <path d={STAR} fill={paint.rim} transform="translate(0.4 0.85)" />
      <g clipPath={`url(#${id}-clip)`}>
        <path d={STAR} fill={`url(#${id}-metal)`} />
        <ellipse cx="9.1" cy="7.2" rx="6.2" ry="3.6" fill="#ffffff" opacity={paint.gloss} transform="rotate(-32 9.1 7.2)" />
        <ellipse cx="15.6" cy="15.8" rx="2.4" ry="1.15" fill="#ffffff" opacity={paint.catch} />
        <path d={STAR} fill={`url(#${id}-gloss)`} />
      </g>
      <path d={STAR} fill="none" stroke={paint.rim} strokeWidth="0.65" strokeLinejoin="round" />
    </svg>
  )
}

export function PriorityStar({ task, on, periodLabel, onToggle }: { task: Task; on: boolean; periodLabel: string; onToggle: () => void }) {
  const [open, setOpen] = useState(false)
  const [why, setWhy] = useState("")
  const wrap = useRef<HTMLSpanElement>(null)
  const now = new Date()
  const shine = on ? priorityStarShine(task.priorityRefreshedOn, now) : 0
  const strength = Math.round(shine * 100)
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
    const pressedAt = new Date()
    const fresh = useTaskStore.getState().tasks.find((t) => t.id === task.id) ?? task
    const entry: TaskPriorityEntry = { at: pressedAt.toISOString(), dayKey: dayKey(pressedAt), kind, ...(why.trim() ? { reasoning: why.trim() } : {}) }
    useTaskStore.getState().updateTask({
      ...fresh,
      priorityLog: [...(fresh.priorityLog ?? []), entry],
      ...(kind === "off" ? {} : { priorityRefreshedOn: dayKey(pressedAt) }),
    })
    setWhy("")
    setOpen(false)
  }

  return (
    <span className="tcs-stat-wrap" ref={wrap}>
      <button
        type="button"
        className="task-card-jewel is-prioritized is-icon tc-star task-card-keycap"
        data-no95=""
        aria-pressed={on}
        aria-expanded={open}
        aria-label="Prioritized"
        title={on ? `Prioritized for ${periodLabel.toLowerCase()} · star at ${strength}%. Click to reaffirm or remove.` : "Prioritize: do this before the rest. Click to say why."}
        style={on ? ({ "--tc-star-shine": String(shine) } as CSSProperties) : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <ChromeStar on={on} shine={shine} />
      </button>
      {open ? (
        <div className="tcs-stat-pop tc-star-pop" role="group" aria-label="Priority">
          <p className="tcs-pop-lead">
            {on
              ? `Star at ${strength}%. It loses 10 points a day. After 14 days without a reaffirm, the mark comes off.`
              : "Prioritizing is an intent. Reaffirm it to keep the star bright."}
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
