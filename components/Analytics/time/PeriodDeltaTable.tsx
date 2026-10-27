/**
 * components/Analytics/PeriodDeltaTable.tsx — Up / down vs previous equal window
 *
 * Ink ± deltas only — pen color stays on the swatch. Sorted by |Δ| descending.
 */
"use client"

import { memo } from "react"
import { formatDuration } from "@/lib/time-entries"
import {
  formatDeltaPercent,
  formatSignedDuration,
  type PeriodDeltaRow,
} from "./period-delta"
import "./analytics-boards.css"

export const PeriodDeltaTable = memo(function PeriodDeltaTable({
  rows,
  hint,
}: {
  rows: PeriodDeltaRow[]
  hint: string
}) {
  return (
    <section className="an-plate" data-testid="period-delta">
      <p className="an-canvas-title">Up / down</p>
      <p className="an-delta-hint">{hint}</p>
      {rows.length === 0 ? (
        <p className="an-delta-empty">No pens in this window or the previous one.</p>
      ) : (
        <div className="an-plot-well an-delta-well">
          <div className="an-delta-rows">
            {rows.map((row) => (
              <div key={row.id} className="an-delta-row">
                <span className="an-delta-swatch" style={{ background: row.color }} aria-hidden />
                <span className="an-delta-name">{row.name}</span>
                <span className="an-delta-num">{formatDuration(row.currentMinutes)}</span>
                <span className="an-delta-num an-delta-sign">{formatSignedDuration(row.deltaMinutes)}</span>
                <span className="an-delta-num an-delta-sign">{formatDeltaPercent(row)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
})
