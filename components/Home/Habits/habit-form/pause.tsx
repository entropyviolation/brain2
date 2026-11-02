/**
 * components/Home/Habits/habit-form/pause.tsx — Pause key at the top of the habit form.
 *
 * Reads **Pause habit**, or **Unpause habit** while a span covers today.
 * Pause opens a small popup: until a date (the last paused day) or
 * indefinitely. Both edit the draft; Save writes it, like every other field.
 * Span math lives in `lib/habit-pause.ts`.
 */
"use client"

import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isPausedNow, pauseLabel, withPause, withUnpause } from "@/lib/habit-pause"
import type { WeeklyTask } from "@/lib/types"

export function HabitFormPause({
  task,
  setTask,
}: {
  task: WeeklyTask
  setTask: Dispatch<SetStateAction<WeeklyTask>>
}) {
  const todayKey = formatLocalDateKey(new Date())
  const paused = isPausedNow(task, todayKey)
  const label = pauseLabel(task, todayKey)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"until" | "indefinitely">("until")
  const [until, setUntil] = useState(todayKey)
  const rootRef = useRef<HTMLDivElement>(null)
  const popupId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const confirm = () => {
    setTask((current) => withPause(current, todayKey, mode === "until" ? until : undefined))
    setOpen(false)
  }

  return (
    <div className="habit95-field habit95-sec-pause" ref={rootRef}>
      <div className="habit-priority-actions">
        <button
          type="button"
          className="habit95-btn"
          aria-expanded={paused ? undefined : open}
          aria-controls={paused ? undefined : popupId}
          onClick={() => {
            if (paused) setTask((current) => withUnpause(current, todayKey))
            else setOpen((v) => !v)
          }}
        >
          {paused ? "Unpause habit" : "Pause habit"}
        </button>
        {label ? <span className="habit95-hint">{label}</span> : null}
      </div>
      {open && !paused ? (
        <div id={popupId} role="dialog" aria-label="Pause habit" className="habit95-group">
          <p className="habit95-hint">
            While paused, the habit leaves every list and every period it touches is exempt. Nothing is deleted.
          </p>
          <label className="habit95-check">
            <input type="radio" name={`${popupId}-mode`} checked={mode === "until"} onChange={() => setMode("until")} />
            Until a date
          </label>
          {mode === "until" ? (
            <input
              type="date"
              className="habit95-input"
              aria-label="Last paused day"
              min={todayKey}
              value={until}
              onChange={(e) => setUntil(e.target.value || todayKey)}
            />
          ) : null}
          <label className="habit95-check">
            <input
              type="radio"
              name={`${popupId}-mode`}
              checked={mode === "indefinitely"}
              onChange={() => setMode("indefinitely")}
            />
            Indefinitely
          </label>
          <div className="habit-priority-actions">
            <button type="button" className="habit95-btn" onClick={confirm}>
              Pause
            </button>
            <button type="button" className="habit95-btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
