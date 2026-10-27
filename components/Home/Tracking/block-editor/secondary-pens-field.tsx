/**
 * components/Home/Tracking/secondary-pens-field.tsx — Extra pens on one block
 *
 * The grid still shows the primary color. Secondaries are not cosmetic: their
 * tags feed habits, operations, and goals through the same pipeline as the
 * primary. Search + chips, so this stays out of the way of painting.
 */
"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TrackPen } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

export function SecondaryPensField({
  pens,
  primaryId,
  selectedIds,
  onChange,
}: {
  pens: TrackPen[]
  primaryId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const chosen = new Set(selectedIds.filter((id) => id && id !== primaryId))
  const others = pens.filter((p) => p.id !== primaryId)
  const needle = query.trim().toLowerCase()
  const matches = useMemo(
    () => others.filter((p) => !needle || p.name.toLowerCase().includes(needle)),
    [others, needle],
  )

  const toggle = (id: string) => {
    if (chosen.has(id)) onChange(selectedIds.filter((x) => x !== id))
    else onChange([...selectedIds, id])
  }

  return (
    <div className="space-y-1.5">
      <Label>Also these pens</Label>
      <p className="trk-help">
        One primary (grid color). Anything extra still counts toward every habit, tag, operation, or
        goal those pens fulfil.
      </p>
      <div className="trk-secondary-row">
        {others
          .filter((p) => chosen.has(p.id))
          .map((pen) => (
            <button
              key={pen.id}
              type="button"
              className="trk-chain-node"
              title={`Remove ${pen.name}`}
              onClick={() => toggle(pen.id)}
            >
              <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
              {pen.name}
              <span aria-hidden>×</span>
            </button>
          ))}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Add another pen…"
        aria-label="Add a secondary pen"
        className="h-7 text-sm"
      />
      {/*
        Only once something is typed. The primary picker directly above is the
        same well of pens, so listing them all again by default put every pen on
        screen twice inside one dialog.
      */}
      {needle && (
        <div className="trk-secondary-row max-h-24 overflow-auto">
          {matches.slice(0, 12).map((pen) => (
            <button
              key={pen.id}
              type="button"
              className="trk-chain-node"
              data-current={chosen.has(pen.id) ? "true" : undefined}
              onClick={() => toggle(pen.id)}
            >
              <span className="trk-chain-bead" style={{ background: pen.color }} aria-hidden />
              {pen.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
