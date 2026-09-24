/**
 * components/Home/Tracking/trk-instrument.tsx — Canvas telemetry chrome
 *
 * CRT probe copy and the stacked-day ribbon share occupancy from
 * `lib/tracking-summary.ts`. Looks only: nothing new is stored.
 * `TrkLatchesWell` is the top Look cluster (Hide / View / Tags) on the SHOW AS
 * / SORT row — independent latches, not paint radios.
 * `TrkPenToolsRow` is the two-column rack: `.trk-pen-tray` (stable wrapper
 * for a sibling-owned velvet) in column one, `.trk-tools-rail` pinned to the
 * far right in column two (compact `.trk-tool-detail` jewel + how-to lives
 * inside `.trk-tools-tray`, under the Draw / Erase / Scissors throws). Pass
 * `showPens={false}` when the paint tool is not Draw — Erase / Scissors hide
 * the tray but leave a spacer so the rail does not jump left.
 * `TrkChromeStack` is the outer order: pen tray, then `.trk-grid-rail`
 * (`.trk-mode-bar` + optional grid action such as Log activity), then
 * TIME/DIV + plot. Omit `gridAction` when the child view already has Log
 * activity (Activity Log header); keep it on Time Grid and Day Log.
 * `TrkPlotBezel` is the plot chassis: one equal-height `.trk-plot-strip`
 * (TIME/DIV + Cell + Fill + occupancy + phosphor probe) over a growing
 * `.trk-plot-region`. Looks only: leftover width/height goes to white paper.
 */
import type { ReactNode } from "react"
import { formatDuration, minutesToLabel } from "@/lib/time-entries"
import type { TrackingSlice } from "@/lib/tracking-summary"

export function TrkLatchesWell({ children }: { children: ReactNode }) {
  return (
    <div className="trk-module trk-latches-well">
      <span className="trk-silk">Look</span>
      {children}
    </div>
  )
}

export function TrkPenToolsRow({
  pens,
  tools,
  showPens = true,
}: {
  pens: ReactNode
  tools: ReactNode
  /** False when Erase or Scissors is the paint tool. Default Draw shows the tray. */
  showPens?: boolean
}) {
  return (
    <div className="trk-pen-tools-row">
      {showPens ? (
        <div className="trk-pen-tray">{pens}</div>
      ) : (
        <div className="trk-pen-tools-spacer" aria-hidden />
      )}
      <div className="trk-tools-rail trk-tools-rail-silk">{tools}</div>
    </div>
  )
}

export function TrkChromeStack({
  pens,
  modeBar,
  gridAction,
  children,
}: {
  pens: ReactNode
  modeBar: ReactNode
  /** Grid-side latch (Log activity). Time Grid / Day Log; omit if the view already has one. */
  gridAction?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="trk-chrome-stack">
      {pens}
      {gridAction ? (
        <div className="trk-grid-rail">
          {modeBar}
          {gridAction}
        </div>
      ) : (
        modeBar
      )}
      {children}
    </div>
  )
}

export function TrkPlotBezel({
  strip,
  children,
}: {
  strip: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="trk-plot-bezel">
      <div className="trk-plot-strip">{strip}</div>
      <div className="trk-plot-region">{children}</div>
    </div>
  )
}

export function trackingProbeText(opts: {
  minute: number
  step?: number
  name?: string
  leafName?: string
  assumed?: boolean
  secondaries?: string[]
}): string {
  const end = opts.step && opts.step > 1 ? minutesToLabel(opts.minute + opts.step) : null
  const range = end ? `${minutesToLabel(opts.minute)}–${end}` : minutesToLabel(opts.minute)
  const parts = [range]
  if (opts.name) parts.push(opts.name)
  if (opts.leafName && opts.leafName !== opts.name) parts.push(opts.leafName)
  if (opts.assumed) parts.push("assumed")
  if (opts.secondaries?.length) parts.push(`also ${opts.secondaries.join(", ")}`)
  return parts.join(" · ")
}

export function TrkCrtProbe({ text }: { text: string | null }) {
  return (
    <div className="trk-probe" role="status" data-empty={text ? undefined : "true"}>
      {text || "\u00a0"}
    </div>
  )
}

export function TrkRibbon({
  pens,
  untracked,
  emptyLabel = "untracked",
  coverage,
  tracked,
}: {
  pens: TrackingSlice[]
  untracked: number
  emptyLabel?: string
  coverage?: number
  tracked?: number
}) {
  const voidMin = Math.max(0, untracked)
  return (
    <div className="trk-ribbon">
      {(coverage != null || tracked != null) && (
        <div className="trk-occ-readout">
          {coverage != null && <span className="trk-occ-pct">{Math.round(coverage)}%</span>}
          {tracked != null && (
            <span className="trk-occ-tracked">{formatDuration(tracked)} tracked</span>
          )}
        </div>
      )}
      <div className="trk-ribbon-bar" aria-hidden>
        {pens.map((pen) => (
          <span key={pen.id} style={{ flexGrow: Math.max(1, pen.minutes), background: pen.color }} />
        ))}
        {voidMin > 0 && <span className="trk-ribbon-void" style={{ flexGrow: voidMin }} />}
      </div>
      <div className="trk-ribbon-legend">
        {pens.map((pen) => (
          <span key={pen.id}>
            <span className="trk-ribbon-swatch" style={{ background: pen.color }} />
            {pen.name}: <span>{formatDuration(pen.minutes)}</span>
            <span className="trk-day-nav-meta"> {Math.round(pen.percentOfTracked)}%</span>
          </span>
        ))}
        <span className="trk-day-nav-meta">
          {emptyLabel}: {formatDuration(voidMin)}
        </span>
      </div>
    </div>
  )
}

export function cellPaintClass(opts: {
  painted: boolean
  quarter?: boolean
  five?: boolean
  spark?: boolean
}): string {
  const bits = ["trk-cell"]
  if (opts.painted) bits.push("trk-cell-painted")
  if (opts.quarter) bits.push("trk-cell-quarter")
  else if (opts.five) bits.push("trk-cell-tick")
  if (opts.spark) bits.push("trk-cell-spark")
  return bits.join(" ")
}
