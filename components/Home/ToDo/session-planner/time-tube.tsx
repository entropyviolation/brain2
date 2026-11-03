"use client"

/**
 * Session length as a Dash tube: segment digits with a typed field over them.
 */
import { useState } from "react"
import { SegDigits } from "../../dash/dash-primitives"
import { fmtMinutes, parseLength } from "./format"

/**
 * The length as a Dash tube: segment digits with a typed field over them
 * (`docs/DESIGN_STYLE.md` → Dash readouts). While typing, the field shows
 * what you type, so "1:30" or "2h" reads as written; Enter or leaving it sets it.
 */
function TimeTube({ minutes, onChange }: { minutes: number; onChange: (minutes: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const next = draft == null ? null : parseLength(draft)
    if (next != null) onChange(Math.max(0, Math.min(24 * 60, next)))
    setDraft(null)
  }
  return (
    <span className={`ses-tube${draft != null ? " is-typing" : ""}`} title="Type minutes, or 1:30, 1h30, 2h">
      <span className="ses-tube-face">
        <SegDigits value={String(Math.round(minutes))} cells={3} label="" />
        <input
          className="ses-tube-input"
          type="text"
          inputMode="numeric"
          aria-label="Length in minutes"
          value={draft ?? String(minutes)}
          onFocus={(e) => {
            setDraft(String(minutes))
            e.currentTarget.select()
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") {
              e.stopPropagation()
              setDraft(null)
              e.currentTarget.blur()
            }
          }}
        />
      </span>
      <span className="ses-tube-unit">
        min
        {minutes >= 60 ? <b>{fmtMinutes(minutes)}</b> : null}
      </span>
    </span>
  )
}

export { TimeTube }
