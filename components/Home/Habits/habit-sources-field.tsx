/**
 * components/Home/Habits/habit-sources-field.tsx — Completion sources, most trusted first
 *
 * A Win95 menu, not a native select. Rows sit in trust order: checked sources
 * from most trusted to least, then the unchecked catalog. Up and Down move the
 * row itself.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { HabitCompletionSourceId } from "@/lib/types"
import {
  COMPLETION_SOURCE_HINTS,
  COMPLETION_SOURCE_LABELS,
  HABIT_COMPLETION_SOURCE_ORDER,
} from "@/lib/habit-completion-trust"

export function HabitSourcesField({
  order,
  onChange,
}: {
  order: HabitCompletionSourceId[]
  onChange: (order: HabitCompletionSourceId[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const enabled = new Set(order)
  const rows = [...order, ...HABIT_COMPLETION_SOURCE_ORDER.filter((id) => !enabled.has(id))]
  const summary = order.length
    ? order.map((id) => COMPLETION_SOURCE_LABELS[id]).join(", then ")
    : "None"

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const toggle = (id: HabitCompletionSourceId) => {
    if (enabled.has(id)) onChange(order.filter((source) => source !== id))
    else onChange([...order, id])
  }

  const move = (id: HabitCompletionSourceId, dir: -1 | 1) => {
    const index = order.indexOf(id)
    const next = index + dir
    if (index < 0 || next < 0 || next >= order.length) return
    const copy = order.slice()
    const [row] = copy.splice(index, 1)
    copy.splice(next, 0, row)
    onChange(copy)
  }

  return (
    <div className="habit95-sources" ref={rootRef}>
      <button
        type="button"
        className="habit95-select"
        aria-label="Completion sources"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="habit95-select-label">{summary}</span>
        <span className="habit95-select-arrow" aria-hidden />
      </button>
      {open ? (
        <div className="habit95-select-menu" id={menuId} role="group" aria-label="Trust order">
          <p className="habit95-hint">Most trusted first. An empty source is skipped. The first one with something to say wins.</p>
          {rows.map((id) => {
            const on = enabled.has(id)
            const rank = order.indexOf(id)
            return (
              <div key={id} className="habit95-source-row">
                <label className="habit95-check">
                  <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                  <span>
                    {COMPLETION_SOURCE_LABELS[id]}
                    {on ? <span className="habit95-source-rank"> {rank + 1}</span> : null}
                  </span>
                </label>
                <span className="habit95-source-moves">
                  <button type="button" className="habit95-btn" disabled={!on || rank === 0} onClick={() => move(id, -1)} aria-label={`Trust ${COMPLETION_SOURCE_LABELS[id]} more`}>
                    Up
                  </button>
                  <button
                    type="button"
                    className="habit95-btn"
                    disabled={!on || rank === order.length - 1}
                    onClick={() => move(id, 1)}
                    aria-label={`Trust ${COMPLETION_SOURCE_LABELS[id]} less`}
                  >
                    Down
                  </button>
                </span>
                <span className="habit95-hint habit95-source-hint">{COMPLETION_SOURCE_HINTS[id]}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
