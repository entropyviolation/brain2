/**
 * components/Home/Tracking/block-pen-section.tsx — Pens on one painted block
 *
 * Opening a block is not a trip through the catalog. Default: only the colors
 * already on this block (primary + secondaries). The full well — search, add
 * new, every pen, tree — waits behind **add pen color**.
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { assignedPenIds } from "@/lib/time-entries"
import type { PenSortMode } from "@/lib/pen-sort"
import type { TrackPen, TrackTag } from "@/lib/time-tracking-store"
import { PenSwatches } from "@/components/Home/Tracking/pen-swatches"
import { SecondaryPensField } from "@/components/Home/Tracking/secondary-pens-field"
import "./tracking-chrome.css"

function AssociatedBead({
  pen,
  primary,
  onPromote,
}: {
  pen: TrackPen
  primary: boolean
  onPromote: (id: string) => void
}) {
  return (
    <span className="trk-pen-slot">
      <button
        type="button"
        data-no95
        data-selected={primary ? "true" : "false"}
        data-block-pen={primary ? "primary" : "secondary"}
        onClick={() => onPromote(pen.id)}
        title={primary ? `${pen.name} — primary (grid color)` : `${pen.name} — also on this block; click to make primary`}
        className="trk-pen"
        style={{ background: pen.color }}
      >
        <span
          className="trk-pen-bead"
          style={{
            background: pen.color,
            backgroundImage: pen.image ? `url("${pen.image}")` : undefined,
            backgroundSize: "cover",
          }}
          aria-hidden
        />
        <span className="trk-pen-name">{pen.name}</span>
        {!primary && (
          <span className="trk-pen-meta" title="Also on this block">
            also
          </span>
        )}
      </button>
    </span>
  )
}

export function BlockPenSection({
  pens,
  tags = [],
  primaryId,
  secondaryPenIds,
  onPrimary,
  onSecondaries,
  onCreate,
  sortMode = "recent",
}: {
  pens: TrackPen[]
  tags?: TrackTag[]
  primaryId: string
  secondaryPenIds: string[]
  onPrimary: (id: string) => void
  onSecondaries: (ids: string[]) => void
  onCreate: (name: string, color: string) => void
  sortMode?: PenSortMode
}) {
  const [libraryOpen, setLibraryOpen] = useState(false)
  const assigned = assignedPenIds({ penId: primaryId, secondaryPenIds })
  const byId = new Map(pens.map((p) => [p.id, p]))
  const associated = assigned.flatMap((id) => {
    const pen = byId.get(id)
    return pen ? [pen] : []
  })

  const promoteOnBlock = (id: string) => {
    if (id === primaryId) return
    onSecondaries(
      [primaryId, ...secondaryPenIds.filter((x) => x !== id && x !== primaryId)],
    )
    onPrimary(id)
  }

  const pickFromLibrary = (id: string) => {
    onPrimary(id)
    onSecondaries(secondaryPenIds.filter((x) => x !== id))
  }

  return (
    <div className="trk-section space-y-1.5">
      <Label className="trk-section-title">Pen</Label>
      <p className="trk-help">
        {libraryOpen
          ? "Primary color on the grid. Search or create a pen, then attach extras."
          : "Colors already on this block. Primary paints the grid."}
      </p>
      <div className="trk-pen-row" role="group" aria-label="Pens on this block">
        {associated.map((pen) => (
          <AssociatedBead
            key={pen.id}
            pen={pen}
            primary={pen.id === primaryId}
            onPromote={promoteOnBlock}
          />
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-auto self-start"
        aria-expanded={libraryOpen}
        aria-controls="block-pen-library"
        onClick={() => setLibraryOpen((open) => !open)}
      >
        add pen color
      </Button>
      {libraryOpen && (
        <div id="block-pen-library" className="space-y-1.5">
          <PenSwatches
            pens={pens}
            tags={tags}
            selectedId={primaryId}
            onSelect={pickFromLibrary}
            onCreate={onCreate}
            sortMode={sortMode}
            compact
          />
          <SecondaryPensField
            pens={pens}
            primaryId={primaryId}
            selectedIds={secondaryPenIds}
            onChange={onSecondaries}
          />
        </div>
      )}
    </div>
  )
}
