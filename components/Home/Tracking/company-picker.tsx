/**
 * components/Home/Tracking/company-picker.tsx — Search, multi-select, add people
 *
 * One box for Company blocks. Type to filter the people pens, click or press
 * Enter to toggle, and a name that matches nobody offers "+ Add". Alone,
 * Together and In conversation are the block's company status, not people, so
 * they are not listed here. The picker stays open so several people go in a row.
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
  onToggle: (penId: string) => void
  /** Make a person pen from a typed name, then select it. */
  onCreate: (name: string) => void
}

export function CompanyPicker({ pens, selected, locked = [], onToggle, onCreate }: CompanyPickerProps) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const people = pens.filter((pen) => !isCompanyStatusPen(pen))
  const shown = people.filter((pen) => !q || pen.name.toLowerCase().includes(q))
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
    <div className="trk-company-picker flex w-full flex-col gap-1.5">
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
        placeholder="Search people, Enter to add or create…"
        aria-label="Search people"
        className="h-7 w-full rounded border bg-white px-2 text-[12px] text-black"
      />
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto" role="group" aria-label="People">
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
              className={`rounded border px-2 py-0.5 text-[11px] ${on ? "bg-foreground text-background" : "hover:bg-muted"}`}
              style={{ borderColor: pen.color }}
            >
              {on ? "✓ " : ""}
              {pen.name}
            </button>
          )
        })}
        {q && !exact ? (
          <button type="button" data-no95="" className="rounded border border-dashed px-2 py-0.5 text-[11px]" onClick={submit}>
            + Add “{query.trim()}”
          </button>
        ) : null}
        {shown.length === 0 && !q ? <span className="text-[11px] text-muted-foreground">No people yet — type a name.</span> : null}
      </div>
    </div>
  )
}
