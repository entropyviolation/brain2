/**
 * components/Home/home-budget-tile.tsx — Budget widget
 *
 * The viewed month's net: received earnings less received spending. Expected
 * (🔮) money sits on the foot and in the detail, never in the net. Spending is
 * read from the Tracking log, earnings from `lib/budget-store.ts`. Edit in
 * Tracking log → Spent → Budget. Plan: `docs/BUDGET_REDESIGN.md`.
 */
"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { CopyCaption } from "@/components/Home/widgets/copy-context"
import { breakdown, budgetRows, monthTotals } from "@/lib/budget-math"
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
  const face = useMemo(() => {
    const rows = budgetRows(entries, lines)
    const month = rows.filter((r) => r.date.startsWith(monthKey))
    return { ...monthTotals(rows, monthKey), spendBy: breakdown(month, "spend", "category"), earnBy: breakdown(month, "earning", "source") }
  }, [entries, lines, monthKey])
  const foot =
    face.aheadAll !== 0
      ? `🔮 ${short(face.aheadSure)} sure · ${short(face.aheadAll)} with maybes`
      : `earned ${formatSpendAmount(face.earned)} · spent ${formatSpendAmount(face.spent)}`

  return (
    <>
      <div className="home-tile is-budget" data-widget="budget" data-testid="home-budget-tile">
        <TileHide id="budget" onHide={onHide} />
        <TileOpen label="Budget" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Budget</CopyCaption>
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
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title={`Budget · ${format(currentDate, "MMMM yyyy")}`}>
        <p className="home-widget-lead">{face.net >= 0 ? "🐽 More came in than went out." : "🥺 More went out than came in."}</p>
        <WidgetWells>
          <WidgetWell label="Earned" tone="nixie">{formatSpendAmount(face.earned)}</WidgetWell>
          <WidgetWell label="Spent">{formatSpendAmount(face.spent)}</WidgetWell>
        </WidgetWells>
        {face.spendBy.slice(0, 4).map((g) => (
          <p key={g.label} className="home-widget-note">
            {g.label}: {formatSpendAmount(g.cents)}
          </p>
        ))}
        <p className="home-widget-note">
          Expected money (🔮) is kept apart: {formatSpendAmount(Math.abs(face.aheadSure))} for sure,{" "}
          {formatSpendAmount(Math.abs(face.aheadAll))} with maybes. Add and edit in Tracking log → Spent → Budget.
        </p>
      </HomeWidgetDialog>
    </>
  )
}
