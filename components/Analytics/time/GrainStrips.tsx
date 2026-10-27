/**
 * components/Analytics/GrainStrips.tsx — Day and week category color
 *
 * Equal cells, one per day and (when the window spans two weeks) one per week.
 * Color is the pen that occupied the most minutes at the current display depth.
 */
"use client"

import { memo } from "react"
import { formatDuration } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"
import type { GrainCell } from "./grain-strips"
import "./analytics-boards.css"

function labelFor(key: string): string {
  const parsed = parseLocalDate(key)
  if (!parsed) return key
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function Strip({
  title,
  cells,
  aria,
}: {
  title: string
  cells: GrainCell[]
  aria: string
}) {
  return (
    <div className="an-grain-block">
      <p className="an-film-title">{title}</p>
      <div className="an-grain-scroll">
        <div className="an-plot-well an-grain-well">
          <div className="an-grain-track" role="img" aria-label={aria}>
            {cells.map((cell) => {
              const when = title === "Weeks" ? `Week of ${labelFor(cell.key)}` : labelFor(cell.key)
              const text =
                cell.minutes > 0
                  ? `${when} · ${cell.penName} · ${formatDuration(cell.minutes)}`
                  : `${when} · nothing painted`
              return (
                <span
                  key={cell.key}
                  className="an-grain-cell"
                  style={{ background: cell.minutes > 0 ? cell.color : undefined }}
                  title={text}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export const GrainStrips = memo(function GrainStrips({
  days,
  weeks,
}: {
  days: GrainCell[]
  weeks: GrainCell[]
}) {
  const paintedDays = days.some((cell) => cell.minutes > 0)
  if (!paintedDays) return null
  const showWeeks = weeks.length >= 2 && weeks.some((cell) => cell.minutes > 0)
  return (
    <div className="an-grain" data-testid="grain-strips">
      <Strip title="Days" cells={days} aria="Day colors by the pen that took the most minutes" />
      {showWeeks && (
        <Strip title="Weeks" cells={weeks} aria="Week colors by the pen that took the most minutes" />
      )}
      <p className="an-canvas-hint">
        Each cell is the pen that occupied the most minutes that day or week, at the depth selected above. A tie keeps
        the earlier pen. Empty days stay white. Overlapping blocks vote once.
      </p>
    </div>
  )
})
