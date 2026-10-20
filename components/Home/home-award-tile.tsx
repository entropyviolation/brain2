/**
 * components/Home/home-award-tile.tsx — Latest points and why
 *
 * The CRT is the newest positive ledger row. The footer is the reason:
 * completed task, high-completion bonus, grade lift vs yesterday, or a
 * weekly-habit grade that beat last week. Click lists recent awards; each
 * row opens its breakdown (`award-detail.tsx`: kind, item, multipliers,
 * rules, the day's other rows); its item opens on top of the dialog, like
 * Today's Progress. **Every award in Analytics** at the foot jumps
 * to the Analytics Points ledger (`lib/points-ledger-nav.ts`), with the open
 * row expanded there. Bonus amounts are edited in Habits → Settings.
 */
"use client"

import { useState } from "react"
import { awardFace, awardReason, formatAwardPoints, latestPointAward, recentPointAwards } from "@/lib/habit-points"
import { parseLocalDate } from "@/lib/date-utils"
import { usePointsStore } from "@/lib/points-store"
import { openPointsLedger } from "@/lib/points-ledger-nav"
import { AwardDetail } from "@/components/Home/award-detail"
import { useItemDetailPopup } from "@/components/Home/use-item-detail-popup"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"

function awardDateLabel(dateKey: string): string {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function rowKey(entry: { date: string; taskId: string; taskDescription: string }): string {
  return `${entry.date}:${entry.taskId}:${entry.taskDescription}`
}

/**
 * The open row and the open item live here, outside the dialog. Radix swaps
 * the dialog content when `modal` flips for the stacked popup.
 */
export function AwardTile({ onHide }: { onHide: () => void }) {
  const history = usePointsStore((s) => s.pointsHistory)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const latest = latestPointAward(history)
  const face = awardFace(latest)
  const recent = recentPointAwards(history, 12)
  const openEntry = recent.find((entry) => rowKey(entry) === expanded)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const ItemPopup = useItemDetailPopup(openItemId)

  return (
    <>
      <div className="home-tile is-award" data-widget="award" data-testid="home-award-tile">
        <TileHide id="award" onHide={onHide} />
        <TileOpen label="Latest award" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Latest</span>
          </div>
          <div className="hab-score-readout home-award-readout" data-centered="true">
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub" title={face.footer}>
              {face.footer}
            </p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Latest award" modal={!openItemId}>
        {recent.length === 0 ? (
          <p className="home-widget-lead">No points yet.</p>
        ) : (
          <div className="home-award-list">
            {recent.map((entry) => {
              const key = rowKey(entry)
              const isOpen = expanded === key
              return (
                <div key={key}>
                  <button
                    type="button"
                    className="home-widget-row home-award-row"
                    aria-expanded={isOpen}
                    title="Show multipliers, rules, and the item"
                    onClick={() => setExpanded(isOpen ? null : key)}
                  >
                    <span>
                      {awardDateLabel(entry.date)} · {awardReason(entry)}
                    </span>
                    <strong>{formatAwardPoints(entry.points)}</strong>
                  </button>
                  {isOpen ? <AwardDetail entry={entry} onOpenItem={setOpenItemId} /> : null}
                </div>
              )
            })}
          </div>
        )}
        <button
          type="button"
          className="home-review-key"
          data-testid="home-award-ledger"
          onClick={() => {
            setOpen(false)
            openPointsLedger(openEntry ? { date: openEntry.date, taskId: openEntry.taskId } : undefined)
          }}
        >
          Every award in Analytics ›
        </button>
        <p className="home-widget-note">
          High completion, beating yesterday’s habit grades, and beating last week’s weekly habit grades are edited in
          Habits → Settings.
        </p>
      </HomeWidgetDialog>
      {ItemPopup ? (
        <ItemPopup taskId={openItemId} open={!!openItemId} onClose={() => setOpenItemId(null)} stackAbove />
      ) : null}
    </>
  )
}
