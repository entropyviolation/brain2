/**
 * components/Analytics/PeriodFilmstrip.tsx — Whole-period chronological pen bar
 *
 * Echoes Home → Tracking's stacked ribbon language: pen color across time,
 * white well, milled rim. Segments click into the same entry / log dialogs.
 */
"use client"

import { memo, useEffect, useRef } from "react"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import type { FilmstripDayTick, FilmstripSegment } from "./period-filmstrip"
import "./analytics-boards.css"

export const PeriodFilmstrip = memo(function PeriodFilmstrip({
  segments,
  ticks,
  totalMinutes,
  onSelectBlock,
  onSelectGap,
  highlightEntryId,
}: {
  segments: FilmstripSegment[]
  ticks: FilmstripDayTick[]
  /** Span of the whole range in minutes (days × 1440). Used for min width. */
  totalMinutes: number
  onSelectBlock: (entryId: string) => void
  onSelectGap: (date: string, startMin: number, endMin: number) => void
  /** Block a search jump asked to show. The first segment of that entry scrolls into view. */
  highlightEntryId?: string | null
}) {
  const hitRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    hitRef.current?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [highlightEntryId, segments])

  if (totalMinutes <= 0) return null

  // ~4px per hour keeps long ranges scrollable without wrapping.
  const minWidthPx = Math.max(320, Math.round((totalMinutes / 60) * 4))
  const firstHitKey = highlightEntryId
    ? (segments.find((seg) => seg.kind === "block" && seg.entryId === highlightEntryId)?.id ?? null)
    : null

  return (
    <div className="an-film" data-testid="period-filmstrip">
      <p className="an-film-title">Period</p>
      <div className="an-film-scroll">
        <div
          className="an-plot-well an-film-well"
          style={{ ["--an-film-min" as string]: `${minWidthPx}px` }}
        >
          {segments.length === 0 ? (
            <p className="an-film-empty">Nothing painted in this window.</p>
          ) : (
            <>
              <div className="an-film-bar" role="list" aria-label="Period filmstrip">
                {segments.map((seg) => {
                  const highlighted = Boolean(highlightEntryId && seg.entryId === highlightEntryId)
                  const clock = `${minutesToLabel(seg.startMin)}–${
                    seg.endMin >= 1440 ? "12:00 AM" : minutesToLabel(seg.endMin)
                  }`
                  const title = `${seg.date} · ${clock} · ${seg.penName} · ${formatDuration(seg.minutes)}`
                  const flex = { ["--an-film-flex" as string]: String(Math.max(seg.minutes, 1)) }
                  if (seg.kind === "gap" && seg.silent) {
                    return (
                      <span
                        key={seg.id}
                        role="listitem"
                        className="an-film-seg"
                        style={{ ...flex, background: "transparent", cursor: "default" }}
                        aria-hidden
                      />
                    )
                  }
                  const hitClass = highlighted ? " is-hit" : ""
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      role="listitem"
                      ref={seg.id === firstHitKey ? hitRef : undefined}
                      data-entry-id={seg.entryId ?? undefined}
                      className={(seg.kind === "gap" ? "an-film-seg is-gap" : "an-film-seg") + hitClass}
                      style={{
                        ...flex,
                        background: seg.kind === "gap" ? undefined : seg.color,
                      }}
                      title={title}
                      aria-label={title}
                      onClick={() => {
                        if (seg.kind === "gap") onSelectGap(seg.date, seg.startMin, seg.endMin)
                        else if (seg.entryId) onSelectBlock(seg.entryId)
                      }}
                    />
                  )
                })}
              </div>
              <div className="an-film-ticks" aria-hidden>
                {ticks.map((tick, i) => {
                  const left = totalMinutes > 0 ? (tick.offsetMin / totalMinutes) * 100 : 0
                  const labeled = Boolean(tick.label)
                  return (
                    <span
                      key={tick.date}
                      className={labeled ? "an-film-tick" : "an-film-tick is-hairline"}
                      style={{ left: `${left}%` }}
                      title={tick.date}
                    >
                      {tick.label || (i === 0 ? "·" : "")}
                    </span>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
})
