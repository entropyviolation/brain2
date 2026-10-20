/**
 * components/Home/ToDo/EstimateCell.tsx — Click a time, type minutes, Enter
 *
 * One tap makes the figure an input. Enter saves and opens the next estimate
 * below it, so a whole branch can be estimated from the keyboard. Esc backs out.
 * The caller writes through `setEstimate` (`lib/task-card.ts`), which logs every
 * change on the step (`estimateLog`).
 */
"use client"

import { useState } from "react"

export function EstimateCell({ minutes, label, onSet, className = "" }: { minutes?: number; label: string; onSet: (m: number) => void; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const done = (next: number | null) => {
    if (next != null && next !== (minutes ?? 0)) onSet(next)
    setDraft(null)
  }
  const parse = (v: string) => (v.trim() === "" ? 0 : Math.max(0, Math.round(Number(v)) || 0))
  if (draft === null) {
    return (
      <button
        type="button"
        data-est=""
        className={`tc-est${minutes ? "" : " is-empty"} ${className}`}
        title={`Estimate for ${label}: click to set minutes`}
        aria-label={`Estimate for ${label}`}
        onClick={(e) => (e.stopPropagation(), setDraft(minutes ? String(minutes) : ""))}
      >
        {minutes ? `${minutes}m` : "est"}
      </button>
    )
  }
  return (
    <input
      data-est=""
      className={`tc-est-input ${className}`}
      type="number"
      min={0}
      inputMode="numeric"
      autoFocus
      placeholder="min"
      aria-label={`Estimate in minutes for ${label}`}
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(draft === "" && !minutes ? null : parse(draft))}
      onKeyDown={(e) => {
        if (e.key === "Escape") return (e.preventDefault(), e.stopPropagation(), setDraft(null))
        if (e.key !== "Enter" && e.key !== "Tab") return
        const all = [...(e.currentTarget.closest(".task-card") ?? document).querySelectorAll<HTMLElement>("[data-est]")]
        const next = all[all.indexOf(e.currentTarget) + (e.shiftKey && e.key === "Tab" ? -1 : 1)]
        if (e.key === "Enter" || next) e.preventDefault()
        done(parse(draft))
        if (next) requestAnimationFrame(() => (next.isConnected ? next : null)?.click())
      }}
    />
  )
}
