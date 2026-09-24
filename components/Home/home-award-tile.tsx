/**
 * components/Home/home-award-tile.tsx — Latest points and why
 *
 * The CRT is the newest positive ledger row. The footer is the reason:
 * completed task, high-completion bonus, grade lift vs yesterday, or a
 * weekly-habit grade that beat last week. Click lists recent awards.
 * Bonus amounts are edited in Habits → Settings.
 */
"use client"

import { useState } from "react"
import { awardFace, awardReason, formatAwardPoints, latestPointAward, recentPointAwards } from "@/lib/habit-points"
import { parseLocalDate } from "@/lib/date-utils"
import { usePointsStore } from "@/lib/points-store"
import { HomeWidgetDialog, TileHide, TileOpen } from "@/components/Home/home-widget-dialog"

function awardDateLabel(dateKey: string): string {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function AwardTile({ onHide }: { onHide: () => void }) {
  const history = usePointsStore((s) => s.pointsHistory)
  const [open, setOpen] = useState(false)
  const latest = latestPointAward(history)
  const face = awardFace(latest)
  const recent = recentPointAwards(history, 8)

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
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Latest award">
        {recent.length === 0 ? (
          <p className="home-widget-lead">No points yet.</p>
        ) : (
          recent.map((entry) => (
            <p key={`${entry.date}:${entry.taskId}:${entry.taskDescription}`} className="home-widget-row">
              <span>
                {awardDateLabel(entry.date)} · {awardReason(entry)}
              </span>
              <strong>{formatAwardPoints(entry.points)}</strong>
            </p>
          ))
        )}
        <p className="home-widget-note">
          High completion, beating yesterday’s habit grades, and beating last week’s weekly habit grades are edited in
          Habits → Settings.
        </p>
      </HomeWidgetDialog>
    </>
  )
}
