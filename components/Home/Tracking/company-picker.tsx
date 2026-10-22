/**
 * components/Home/Tracking/company-picker.tsx — Search, multi-select, add people
 *
 * One box for Company blocks. Type to filter the people pens, click or press
 * Enter to toggle, and a name that matches nobody offers "+ Add". Alone,
 * Together and In conversation are the block's company status, not people, so
 * they are not listed here. The picker stays open so several people go in a row.
 *
 * `hideSelected` is for a block that already lists its people above: only the
 * people not on it are offered, so the picker never repeats the list.
 */
"use client"

import { useState } from "react"
import type { TrackPen } from "@/lib/time-tracking-store"

const STATUS_NAMES = new Set(["alone", "together", "in conversation"])

export const isCompanyStatusPen = (pen: Pick<TrackPen, "name">) => STATUS_NAMES.has(pen.name.trim().toLowerCase())

interface CompanyPickerProps {
  pens: TrackPen[]
  selected: string[]
  /** Selected and not removable here (the block's primary pen). */
  locked?: string[]
  /** Offer only people who are not selected yet. */
  hideSelected?: boolean
  onToggle: (penId: string) => void
  /** Make a person pen from a typed name, then select it. */
  onCreate: (name: string) => void
}

export function CompanyPicker({ pens, selected, locked = [], hideSelected = false, onToggle, onCreate }: CompanyPickerProps) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const people = pens.filter((pen) => !isCompanyStatusPen(pen))
  const shown = people.filter(
    (pen) => (!q || pen.name.toLowerCase().includes(q)) && !(hideSelected && selected.includes(pen.id)),
  )
  const exact = people.some((pen) => pen.name.trim().toLowerCase() === q)

  const toggle = (pen: TrackPen) => {
    if (!locked.includes(pen.id)) onToggle(pen.id)
  }

  const submit = () => {
    if (!q) return
    const hit = shown.find((pen) => pen.name.trim().toLowerCase() === q) ?? (shown.length === 1 ? shown[0] : undefined)
    if (hit) toggle(hit)
    else if (!exact) onCreate(query.trim())
    setQuery("")
  }

  return (
    <div className="trk-company-picker">
      <input
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return
          event.preventDefault()
          submit()
        }}
        placeholder="Search people — Enter adds or creates"
        aria-label="Search people"
      />
      <div className="trk-company-candidates" role="group" aria-label="People">
        {shown.map((pen) => {
          const on = selected.includes(pen.id)
          return (
            <button
              key={pen.id}
              type="button"
              data-no95=""
              aria-pressed={on}
              disabled={locked.includes(pen.id)}
              onClick={() => toggle(pen)}
              style={{ borderLeftColor: pen.color }}
            >
              {on ? "✓ " : ""}
              {pen.name}
            </button>
          )
        })}
        {q && !exact ? (
          <button type="button" data-no95="" className="trk-company-new" onClick={submit}>
            + Create “{query.trim()}”
          </button>
        ) : null}
        {shown.length === 0 && !q ? (
          <span className="trk-company-empty">
            {hideSelected && people.length > 0 ? "Everyone you know is here. Type a name to add someone new." : "No people yet — type a name."}
          </span>
        ) : null}
      </div>
    </div>
  )
}
