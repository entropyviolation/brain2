/**
 * components/Analytics/time/WardrobeView.tsx — Time → Wardrobe
 *
 * Wear counts for the shared range. One outfit is one wear. A row opens
 * the days. Pieces with no wear in the window stay at the bottom.
 */
"use client"

import { useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { PIECE_CATEGORY_LABEL, useWardrobeStore } from "@/lib/wardrobe"
import { useAnalyticsRange } from "../chrome/analytics-range-store"
import { ChartFrame } from "../studio/chart-frame"
import { CanvasTitle, StudioBars, StudioReadout } from "../studio/studio-kit"
import { wearByCategory, wearByPiece, wearBySubtype } from "./wardrobe-stats"

export function WardrobeView() {
  const pieces = useWardrobeStore((state) => state.pieces)
  const outfits = useWardrobeStore((state) => state.outfits)
  const { dateKeys, label } = useAnalyticsRange()
  const today = formatLocalDateKey(new Date())
  const [openId, setOpenId] = useState<string | null>(null)
  const rows = wearByPiece(pieces, outfits, dateKeys, today)
  const categories = wearByCategory(pieces, outfits, dateKeys)
  const subtypes = wearBySubtype(pieces, outfits, dateKeys)
  const open = rows.find((row) => row.pieceId === openId) ?? null
  const looks = outfits.filter((outfit) => dateKeys.includes(outfit.dayKey)).length

  return (
    <div className="an-canvas an-stack" data-testid="wardrobe-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Wardrobe"
            help="One outfit is one wear. Times worn and days worn use looks in this range. Days since last worn is as of today. Category outfits are distinct looks; links count each piece on a look."
          />
          <p className="an-canvas-kicker">{label}</p>
        </div>
      </header>

      {pieces.length === 0 ? (
        <ChartFrame empty emptySentence="No pieces in the closet." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Looks" value={looks} note={looks < 2 ? "n stays visible" : "in this window"} />
            <StudioReadout label="Pieces" value={pieces.length} />
          </div>
          {looks < 2 ? <ChartFrame thin thinSentence={`n = ${looks}. Not a finding.`} /> : null}
          <ul className="an-list" aria-label="Times worn">
            {rows.map((row) => (
              <li key={row.pieceId}>
                <button type="button" className="an-list-row" onClick={() => setOpenId(row.pieceId)}>
                  <span className="truncate">{row.name}</span>
                  <span className="an-n">
                    {row.timesWorn} worn · {row.daysWorn} days
                    {row.daysSince != null ? ` · ${row.daysSince} days ago` : ""}
                  </span>
                </button>
                {open?.pieceId === row.pieceId ? (
                  <p className="an-readout-note">
                    {open.dayKeys.length ? open.dayKeys.join(", ") : "No wear in this window."}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <StudioBars
            rows={categories.map((row) => ({ name: PIECE_CATEGORY_LABEL[row.category], value: row.outfits }))}
            max={Math.max(1, ...categories.map((row) => row.outfits))}
            unit=""
          />
          <ul className="an-list" aria-label="Piece links">
            {categories.map((row) => (
              <li key={row.category} className="an-list-row">
                <span>{PIECE_CATEGORY_LABEL[row.category]}</span>
                <span className="an-n">{row.outfits} outfits · {row.links} links</span>
              </li>
            ))}
          </ul>
          {subtypes.length ? (
            <ul className="an-list" aria-label="By subtype">
              {subtypes.map((row) => (
                <li key={row.subtype} className="an-list-row">
                  <span>{row.subtype}</span>
                  <span className="an-n">{row.outfits} outfits · {row.links} links</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}
