"use client"

/**
 * A line's frozen or live estimate, click-to-edit, under/over words, and the hairline bar.
 */
import { useState } from "react"
import type { Task } from "@/lib/types"
import { lineMinutes, type SessionLine } from "@/lib/session-plan"
import { fmtMinutes } from "./format"

/** A line's estimate: frozen at Start, else what it adds up to now. */
function lineEst(line: SessionLine, tasks: Task[]): number {
  return line.estMin ?? lineMinutes(line, tasks)
}

/** An estimate you can click to change (minutes). Enter or leaving the field saves; Esc cancels. */
function EstEdit({ minutes, label, onSave }: { minutes: number; label: string; onSave: (minutes: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  if (draft === null) {
    return (
      <button type="button" data-no95 className="ses-est" aria-label={`Edit estimate for ${label}`} title="Edit estimate" onClick={() => setDraft(minutes ? String(Math.round(minutes)) : "")}>
        {minutes ? fmtMinutes(minutes) : "–"}
      </button>
    )
  }
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() !== "" && Number.isFinite(n) && n >= 0) onSave(n)
    setDraft(null)
  }
  return (
    <span className="ses-est-field">
      <input
        className="ses-est-input"
        type="number"
        min={0}
        step={1}
        autoFocus
        aria-label={`Estimate for ${label} in minutes`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") {
            e.stopPropagation()
            setDraft(null)
          }
        }}
      />
      m
    </span>
  )
}

/** Estimate vs actual in plain words: "3m under", "+5m over", "on the nose". Warm red only for overruns. */
function EstDelta({ estMin, actualSec, done }: { estMin: number; actualSec: number; done: boolean }) {
  if (!estMin || (!done && actualSec < estMin * 60)) return null
  const diff = Math.round(actualSec / 60 - estMin)
  if (diff > 0) return <span className="ses-delta is-over">+{fmtMinutes(diff)} over</span>
  if (!done) return null
  return <span className="ses-delta is-under">{diff === 0 ? "on the nose" : `${fmtMinutes(-diff)} under`}</span>
}

/** Actual against estimate as a hairline: fills to the estimate, then runs rose past it. */
function EstBar({ estMin, actualSec }: { estMin: number; actualSec: number }) {
  if (!estMin) return null
  const ratio = actualSec / (estMin * 60)
  return (
    <span className="ses-bar" aria-hidden>
      <span className={`ses-bar-fill${ratio > 1 ? " is-over" : ""}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </span>
  )
}

export { lineEst, EstEdit, EstDelta, EstBar }
