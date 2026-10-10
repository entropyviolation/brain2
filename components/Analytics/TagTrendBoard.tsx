/**
 * components/Analytics/TagTrendBoard.tsx — Tag minutes as aligned bars
 *
 * Week bars come from `tagWeekTrend`. Month bars come from `tagMonthTrend`.
 * A zero bucket stays a hairline so tags share one axis. Bar color is the tag.
 */
"use client"

import { memo } from "react"
import { formatDuration } from "@/lib/time-entries"
import type { TagTrendRow } from "@/lib/tracking-summary"
import "./analytics-boards.css"

function Bars({ points, color, unit }: { points: TagTrendRow["points"]; color: string; unit: string }) {
  const max = Math.max(...points.map((point) => point.minutes), 1)
  return (
    <div className="an-tag-bars" role="img" aria-label={`${unit} minutes`}>
      {points.map((point) => {
        const height = point.minutes <= 0 ? 2 : Math.max(4, Math.round((point.minutes / max) * 100))
        return (
          <span
            key={point.key}
            className={point.minutes > 0 ? "an-tag-bar" : "an-tag-bar is-zero"}
            style={{
              height: `${height}%`,
              background: point.minutes > 0 ? color : undefined,
            }}
            title={`${point.key}: ${formatDuration(point.minutes)}`}
          />
        )
      })}
    </div>
  )
}

function Board({ title, rows, unit }: { title: string; rows: TagTrendRow[]; unit: string }) {
  const visible = rows.filter((row) => row.points.length > 1 && row.points.some((point) => point.minutes > 0))
  if (visible.length === 0) return null
  return (
    <div className="an-tag-board-block">
      <p className="an-canvas-kicker">{title}</p>
      <div className="an-tag-board">
        {visible.map((row) => (
          <div key={row.id} className="an-tag-row">
            <span className="an-slice-swatch" style={{ background: row.color }} aria-hidden />
            <span className="an-tag-name">{row.name}</span>
            <Bars points={row.points} color={row.color} unit={`${row.name} ${unit}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function hasSeries(rows: TagTrendRow[]): boolean {
  return rows.some((row) => row.points.length > 1 && row.points.some((point) => point.minutes > 0))
}

export const TagTrendBoard = memo(function TagTrendBoard({
  weeks,
  months,
}: {
  weeks: TagTrendRow[]
  months: TagTrendRow[]
}) {
  const showWeeks = hasSeries(weeks)
  const showMonths = hasSeries(months)
  if (!showWeeks && !showMonths) return null
  return (
    <div data-testid="tag-trend-board">
      {showWeeks && <Board title="Tracked-minute tags · weeks in this window" rows={weeks} unit="by week" />}
      {showMonths && <Board title="Tracked-minute tags · months in this window" rows={months} unit="by month" />}
      <p className="an-canvas-hint">
        Bar height is that Tracking tag’s minutes in the bucket (not Library → Tags item names). A minute tagged in two
        scopes counts once. Empty buckets stay in line at zero. The bars read every scope; the charts above stay on the
        scope selected in the header. Chart tiles drill; they do not open tag settings.
      </p>
    </div>
  )
})
