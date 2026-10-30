/**
 * components/Home/ToDo/task-card/EstimateCell.tsx — Click a time, type a duration, Enter
 *
 * One tap makes the figure an input. Enter saves and opens the next estimate
 * below it, so a whole branch can be estimated from the keyboard. Esc backs out.
 * The face follows the card's h/m switch. A bare number is minutes unless the
 * text includes h (`parseDurationInput`). The caller writes through `setEstimate`
 * (`lib/task-card.ts`), which logs every change on the step (`estimateLog`).
 *
 * `suggestion` is the sum of the steps inside, shown in ghost blue when this
 * step has no estimate of its own. Click starts the field from that sum.
 * Enter, or leaving the field, keeps it as the guess.
 */
"use client"

import { useState } from "react"
import { compactDuration, parseDurationInput } from "@/lib/time-entries"
import { formatStatMinutes, useTaskCardTimeUnit } from "./task-card-unit"

function asText(minutes: number, hours: boolean): string {
  return hours ? compactDuration(minutes, true) : String(minutes)
}

export function EstimateCell({ minutes, label, onSet, className = "", suggestion }: { minutes?: number; label: string; onSet: (m: number) => void; className?: string; suggestion?: number }) {
  const unit = useTaskCardTimeUnit()
  const hours = unit === "h"
  const [draft, setDraft] = useState<string | null>(null)
  const own = minutes && minutes > 0 ? minutes : 0
  const guess = !own && suggestion && suggestion > 0 ? suggestion : 0
  const done = (next: number | null) => {
    if (next != null && next !== own) onSet(next)
    setDraft(null)
  }
  const parse = (v: string): number | null => {
    const t = v.trim()
    if (t === "") return 0
    if (!hours) {
      const n = Number(t)
      return Number.isFinite(n) && n >= 0 ? Math.max(0, Math.round(n)) : null
    }
    if (/^\d+(?:\.\d+)?$/.test(t)) return Math.max(0, Math.round(Number(t)))
    if (t === "0h" || t === "0h00") return 0
    return parseDurationInput(t)
  }
  if (draft === null) {
    const ghost = guess > 0
    return (
      <button
        type="button"
        data-est=""
        className={`tc-est${own ? "" : ghost ? " is-ghost" : " is-empty"} ${className}`}
        title={ghost ? `Sum of the steps inside ${label}: ${formatStatMinutes(guess, unit)}. Click to start from it; Enter keeps it.` : `Estimate for ${label}: click to set`}
        aria-label={ghost ? `Suggested estimate for ${label}` : `Estimate for ${label}`}
        onClick={(e) => (e.stopPropagation(), setDraft(own ? asText(own, hours) : guess ? asText(guess, hours) : ""))}
      >
        {own ? formatStatMinutes(own, unit) : ghost ? formatStatMinutes(guess, unit) : "est"}
      </button>
    )
  }
  return (
    <input
      data-est=""
      className={`tc-est-input ${className}`}
      type={hours ? "text" : "number"}
      min={hours ? undefined : 0}
      inputMode={hours ? "text" : "numeric"}
      autoFocus
      placeholder={hours ? "0h00" : "min"}
      aria-label={`Estimate for ${label}`}
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = parse(draft)
        done(draft === "" && !own ? null : next)
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") return (e.preventDefault(), e.stopPropagation(), setDraft(null))
        if (e.key !== "Enter" && e.key !== "Tab") return
        const all = [...(e.currentTarget.closest(".task-card") ?? document).querySelectorAll<HTMLElement>("[data-est]")]
        const next = all[all.indexOf(e.currentTarget) + (e.shiftKey && e.key === "Tab" ? -1 : 1)]
        if (e.key === "Enter" || next) e.preventDefault()
        const parsed = parse(draft)
        if (parsed == null) return
        done(parsed)
        if (next) requestAnimationFrame(() => (next.isConnected ? next : null)?.click())
      }}
    />
  )
}
