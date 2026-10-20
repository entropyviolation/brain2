/**
 * components/Home/home-overview.tsx — The Visual dashboard
 *
 * The widget bank on the Home header, shared by Habits / Plan / To Do /
 * Goals / Tracking. It draws the installed copies (`lib/widgets/`) in the
 * chosen style: **Milled** is the original look, with each tile on its own
 * footprint; **Dash** is the vintage car display, small cells you read at a
 * glance. Clicking a face opens its detail; the detail's gear opens that
 * copy's settings. Moving and resizing happen only in edit mode
 * (`widgets/edit-mode.ts`). `currentDate` is the dashboard day: the selected
 * day, or the wall clock when Follow the clock is on (chosen in
 * `home-dashboard.tsx`). A copy can read the wall clock or the viewed day
 * instead (its Day source setting). The Widgets key on the date plate opens
 * the list and the Widget gallery. Plan: `docs/WIDGETS_REDESIGN.md`.
 */
"use client"

import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { homeInstrumentColorVars } from "@/lib/home-widgets"
import { useDashboardStore } from "@/lib/widgets/dashboard-store"
import { dashSizeOf, milledSizeOf, visibleCopies, unknownOnLayout } from "@/lib/widgets/dashboard"
import { DashboardCell } from "@/components/Home/widgets/dashboard-cell"
import { WidgetCopyProvider } from "@/components/Home/widgets/copy-context"
import { renderWidgetTile, UnknownWidgetFace } from "@/components/Home/widgets/registry"
import { useDashboardEditMode } from "@/components/Home/widgets/edit-mode"
import { dashFaceFor } from "@/components/Home/widgets/dash-face-registry"
import type { ReviewPeriod } from "@/lib/types"
import type { WidgetCopy } from "@/lib/widgets/types"

type HomeOverviewProps = {
  currentDate: Date
  /** The day selected on Home, for copies whose Day source is the viewed day. */
  viewedDate?: Date
  onStartReview?: (period: ReviewPeriod, periodKey: string) => void
  onOpenHomeTab?: (tab: "plan" | "todo") => void
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/** Minute clock for copies that read the wall clock. */
function useWallClock(on: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!on) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [on])
  return now
}

export function HomeOverview({ currentDate, viewedDate, onStartReview, onOpenHomeTab }: HomeOverviewProps) {
  const migrated = useDashboardStore((s) => s.migrated)
  const ensureReady = useDashboardStore((s) => s.ensureReady)
  const copies = useDashboardStore((s) => s.copies)
  const unknown = useDashboardStore((s) => s.unknown)
  const style = useDashboardStore((s) => s.style)
  const dash = useDashboardStore((s) => s.dash)
  const milled = useDashboardStore((s) => s.milled)
  const legacy = useDashboardStore((s) => s.legacy)
  const hideCopy = useDashboardStore((s) => s.hideCopy)
  const moveCopy = useDashboardStore((s) => s.moveCopy)
  const stepCopy = useDashboardStore((s) => s.stepCopy)
  const resizeCopy = useDashboardStore((s) => s.resizeCopy)
  const editing = useDashboardEditMode((s) => s.editing)
  const setEditing = useDashboardEditMode((s) => s.setEditing)

  const percentLedTint = useHabitsStore((s) => s.percentLedTint)
  const gradeTubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const outputGradeTubeColor = useHabitsStore((s) => s.outputGradeTubeColor)

  useIsoLayoutEffect(() => {
    if (!migrated) ensureReady()
  }, [migrated, ensureReady])

  const data = { copies, unknown, style, dash, milled, legacy }
  const visible = visibleCopies(data)
  const strays = unknownOnLayout(data)
  const wantsClock = visible.some((copy) => copy.daySource === "clock")
  const wall = useWallClock(wantsClock)
  const colorVars = homeInstrumentColorVars(percentLedTint, gradeTubeColor, outputGradeTubeColor)
  const order = style === "milled" ? milled.order : dash.order

  const dayFor = (copy: WidgetCopy): Date =>
    copy.daySource === "clock" ? wall : copy.daySource === "viewed" ? (viewedDate ?? currentDate) : currentDate

  const moveTo = (id: string, before: string | null, after: boolean) => {
    if (!before) return
    const without = order.filter((item) => item !== id)
    const at = without.indexOf(before)
    if (at < 0) return
    moveCopy(id, after ? at + 1 : at)
  }

  return (
    <>
      {editing ? (
        <div className="vd-edit-banner" role="status" data-testid="dashboard-edit-banner">
          <span className="vd-edit-lamp" aria-hidden="true" />
          <p>
            Edit mode. Drag a face to move it, pull its corner to resize, × hides it. Arrows move the focused face,
            Shift and arrows resize.
          </p>
          <button type="button" className="home-review-key" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
      ) : null}
      <div
        className="home-overview"
        data-testid="home-overview"
        data-style={style}
        data-editing={editing ? "true" : "false"}
        data-ui-name="Visual dashboard"
        data-ui-docs="components/Home/README.md"
        data-ui-docs-anchor="visual-dashboard"
        data-home-grad={`${colorVars["--home-grad-led"]}|${colorVars["--home-grad-grade"]}|${colorVars["--home-grad-output"]}`}
        style={colorVars as CSSProperties}
      >
        {visible.map((copy, index) => (
          <DashboardCell
            key={copy.id}
            copy={copy}
            style={style}
            size={style === "milled" ? milledSizeOf(data, copy) : dashSizeOf(data, copy)}
            editing={editing}
            index={index}
            onMoveTo={moveTo}
            onStep={(direction) => stepCopy(copy.id, direction)}
            onResize={(size) => resizeCopy(copy.id, size)}
            dashFace={style === "dash" ? dashFaceFor(copy.kind) : undefined}
            currentDate={dayFor(copy)}
            onHide={() => hideCopy(copy.id)}
          >
            <WidgetCopyProvider
              frame={{
                copy,
                style,
                size: style === "milled" ? null : dashSizeOf(data, copy),
                editing,
              }}
            >
              {renderWidgetTile({
                copy,
                currentDate: dayFor(copy),
                onHide: () => hideCopy(copy.id),
                onStartReview,
                onOpenHomeTab,
              })}
            </WidgetCopyProvider>
          </DashboardCell>
        ))}
        {strays.map((entry) => (
          <UnknownWidgetFace key={String(entry.id)} kind={String(entry.kind ?? "widget")} />
        ))}
      </div>
    </>
  )
}
