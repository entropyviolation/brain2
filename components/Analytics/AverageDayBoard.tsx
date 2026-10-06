/**
 * components/Analytics/AverageDayBoard.tsx — Average-day ribbons (All + Mon–Sun)
 *
 * Replaces the Tracking mosaic. Clock-time ribbons: 96 × 15-minute slots,
 * averaged across the sample days for the selected scope / depth / untracked.
 */
"use client"

import { memo } from "react"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import { inkOnFill } from "./studio-kit"
import {
  LABEL_MIN_SLOTS,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  clockLabelForSlot,
  type AverageDayRibbon,
  type PenMeta,
  type SlotShare,
} from "./average-day"
import "./analytics-boards.css"

const HOUR_TICKS = [0, 24, 48, 72, 96] // 12a, 6a, 12p, 6p, 12a

function slotTitle(
  shares: readonly SlotShare[],
  pensById: Map<string, PenMeta>,
  startSlot: number,
  endSlot: number,
): string {
  const start = minutesToLabel(startSlot * SLOT_MINUTES)
  const endLabel = endSlot * SLOT_MINUTES >= 1440 ? "12:00 AM" : minutesToLabel(endSlot * SLOT_MINUTES)
  if (shares.length === 0) return `${start}–${endLabel} · empty`
  return shares
    .map((s) => {
      const pen = pensById.get(s.penId)
      return `${pen?.name ?? s.penId}: ${formatDuration(s.meanMinutes)} typical`
    })
    .join(" · ") + ` · ${start}–${endLabel}`
}

function RibbonSlots({
  ribbon,
  pensById,
  activeId,
  onActiveChange,
}: {
  ribbon: AverageDayRibbon
  pensById: Map<string, PenMeta>
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
}) {
  if (ribbon.n === 0) {
    return <div className="an-avg-ribbon is-empty" aria-label={`${ribbon.label}: no days`} />
  }

  const hasPaint = ribbon.slots.some((s) => s.length > 0)
  if (!hasPaint) {
    return <div className="an-avg-ribbon is-empty" aria-label={`${ribbon.label}: nothing tracked`} />
  }

  return (
    <div
      className="an-avg-ribbon"
      role="img"
      aria-label={`${ribbon.label} average day, ${ribbon.caption}`}
    >
      {ribbon.slots.map((shares, slot) => {
        const total = shares.reduce((sum, s) => sum + s.meanMinutes, 0)
        const sole = shares.length === 1 ? shares[0] : null
        // Label only on the first slot of a long sole-pen run.
        let showName = false
        if (sole) {
          let runStart = slot
          while (runStart > 0) {
            const prev = ribbon.slots[runStart - 1]
            if (prev.length === 1 && prev[0].penId === sole.penId) runStart--
            else break
          }
          let runEnd = slot + 1
          while (runEnd < SLOTS_PER_DAY) {
            const next = ribbon.slots[runEnd]
            if (next.length === 1 && next[0].penId === sole.penId) runEnd++
            else break
          }
          showName = slot === runStart && runEnd - runStart >= LABEL_MIN_SLOTS
        }

        return (
          <div key={slot} className="an-avg-slot" style={{ flex: `${SLOT_MINUTES} 1 0` }}>
            {shares.length === 0 ? (
              <span className="an-avg-seg" style={{ flex: 1, background: "transparent" }} aria-hidden />
            ) : (
              shares.map((share) => {
                const pen = pensById.get(share.penId)
                const color = pen?.color ?? "#94a3b8"
                const name = pen?.name ?? share.penId
                const ink = inkOnFill(color)
                const active = activeId === share.penId
                const flex = total > 0 ? share.meanMinutes : 1
                const title = slotTitle(shares, pensById, slot, slot + 1)
                return (
                  <span
                    key={share.penId}
                    className={active ? "an-avg-seg is-active" : "an-avg-seg"}
                    style={{
                      flex: `${Math.max(flex, 0.01)} 1 0`,
                      background: color,
                      color: ink,
                    }}
                    title={title}
                    aria-label={`${name}: ${formatDuration(share.meanMinutes)} typical · ${clockLabelForSlot(slot)}–${clockLabelForSlot(slot + 1)}`}
                    onMouseEnter={() => onActiveChange?.(share.penId)}
                    onMouseLeave={() => onActiveChange?.(null)}
                  >
                    {showName && share.penId === sole?.penId ? (
                      <span className="an-avg-seg-name">{name}</span>
                    ) : null}
                  </span>
                )
              })
            )}
          </div>
        )
      })}
    </div>
  )
}

export const AverageDayBoard = memo(function AverageDayBoard({
  ribbons,
  pens,
  activeId,
  onActiveChange,
}: {
  ribbons: AverageDayRibbon[]
  pens: PenMeta[]
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
}) {
  const pensById = new Map(pens.map((p) => [p.id, p]))

  return (
    <div className="an-avg-day" data-testid="average-day-board">
      <p className="an-avg-day-title">Average day</p>
      <div className="an-plot-well an-avg-day-well">
        <div className="an-avg-ticks" aria-hidden>
          <span className="an-avg-ticks-spacer" />
          <div className="an-avg-ticks-bar">
            {HOUR_TICKS.map((slot) => (
              <span key={slot}>{clockLabelForSlot(slot)}</span>
            ))}
          </div>
        </div>
        {ribbons.map((ribbon) => (
          <div key={ribbon.id} className="an-avg-row">
            <div className="an-avg-label">
              <span className="an-avg-label-name">{ribbon.label}</span>
              <span className="an-avg-label-n">{ribbon.caption}</span>
            </div>
            {ribbon.n === 0 ? (
              <p className="an-avg-empty-line">No {ribbon.label.toLowerCase()} in this window.</p>
            ) : (
              <RibbonSlots
                ribbon={ribbon}
                pensById={pensById}
                activeId={activeId}
                onActiveChange={onActiveChange}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
})
