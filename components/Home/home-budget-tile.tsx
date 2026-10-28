/**
 * components/Home/home-budget-tile.tsx — Money widget
 *
 * The face is the viewed month's net: received earnings less received spending.
 * Expected money sits on the foot, never in the net. The detail is the money
 * book (`tracking-log/money-book.tsx`), the same one Tracking log → Spent opens.
 * Kind id stays `budget` so a saved dashboard keeps the tile. Plan: `docs/BUDGET_REDESIGN.md`.
 */
"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"
import { MoneyBook } from "@/components/Home/Tracking/tracking-log/money-book"
import { CopyCaption } from "@/components/Home/widgets/copy-context"
import { budgetRows, monthTotals } from "@/lib/budget-math"
import { useBudgetStore } from "@/lib/budget-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { formatSpendAmount } from "@/lib/spend"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

/** $1,234,567 reads as $1.2M on the square so it fits. */
export function short(cents: number): string {
  const abs = Math.abs(cents) / 100
  const sign = cents < 0 ? "-" : "+"
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e4) return `${sign}$${(abs / 1e3).toFixed(0)}K`
  return `${sign}${formatSpendAmount(Math.abs(cents))}`
}

export function BudgetTile({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const lines = useBudgetStore((s) => s.lines)
  const [open, setOpen] = useState(false)
  const monthKey = formatLocalDateKey(currentDate).slice(0, 7)
  const face = useMemo(() => monthTotals(budgetRows(entries, lines), monthKey), [entries, lines, monthKey])
  const foot =
    face.aheadAll !== 0
      ? `🔮 ${short(face.aheadSure)} sure · ${short(face.aheadAll)} with maybes`
      : `earned ${formatSpendAmount(face.earned)} · spent ${formatSpendAmount(face.spent)}`

  return (
    <>
      <div className="home-tile is-budget" data-widget="budget" data-testid="home-budget-tile">
        <TileHide id="budget" onHide={onHide} />
        <TileOpen label="Money" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Money</CopyCaption>
            </span>
          </div>
          <div className="home-crt">
            <span className="home-daylamp-word">{short(face.net)}</span>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{foot}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} className="is-money" title={`Money · ${format(currentDate, "MMMM yyyy")}`}>
        <MoneyBook open={open} anchor={currentDate} />
      </HomeWidgetDialog>
    </>
  )
}
