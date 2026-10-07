/**
 * components/Home/Tracking/time-grid.tsx — TimeGrid life tracker
 *
 * Paint the day with colored pens. Time is stored minute-accurately as intervals
 * (`lib/time-entries.ts`); `gridStep` only decides how coarsely this view draws
 * and paints, so switching from 5-minute cells to 1-minute cells reveals finer
 * detail rather than converting anything. Hour rows carry a hairline gray rule
 * on `.trk-plot`; minute cells use a 1px lighter tick so the plot stays paper,
 * not a heavy lattice.
 *
 * Three labels stack on a block, each doing a different job:
 *   - **Pen** — the activity. One per minute per scope.
 *   - **Variant** — a finer cut inside the pen, several allowed at once
 *     (`variant-chips.tsx`). Analytics breaks the pen down by these.
 *   - **Tag** — cross-scope, and the join to Habits: tagged time flows into any
 *     linked daily habit via `lib/habit-tracking-sync.ts`, which
 *     `useHabitTrackingSync` keeps running while this view is mounted.
 *
 * Totals come from `lib/tracking-summary.ts` as occupancy — overlapping blocks
 * on the same minute count once — the same module the Activity Log and the
 * Analytics Tracking tab use, so the three can never disagree. TIME/DIV, Cell
 * size (1 / 5 / 10 / 15 / 30), and Fill sit on one equal-height silkscreen
 * strip on the plot bezel (`TrkPlotBezel`); leftover width and height go to
 * the white plot, not a gray slab beside `width: fit-content` modules. The live
 * cell step is navy inset with a phosphor cap. Day view date row is the same
 * period toolbar as Plan (previous, centered date, next, Today). Fill lives in
 * `fill-range-control.tsx` (longest empty gap; View-settings Day fill clocks
 * are the fully-untracked fallback). Hidden pens stay in View settings.
 * **Infinite scroll** sits next to Day/Week — one continuous strip, not two toggles.
 * **Superimpose** is the milled row under the view-mode bar and above this plot
 * (`superimpose-bar.tsx`). The wash is per view and survives a day change.
 * Day view now / sunrise / sunset are **horizontal** lines across the plot (same
 * clock as Plan agenda and the Day Log tab). Discrete events stay vertical ticks.
 * Do not remove the now line or the sunrise/sunset lines.
 */
"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addDays, subDays } from "date-fns"
import { displayedPen, penCellStyle, useTimeTrackingStore, type TimeEntry, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { overlayTicksBeside, penNameById, scopeTicksWithDiscreteLogs, tickPen } from "@/components/Home/Tracking/discrete-log-instants"
import { strokeCellStyle } from "@/components/Home/Tracking/grid-stroke"
import { focusTrackingPlot } from "@/components/Home/Tracking/tracking-undo"
import { TrackingFind } from "@/components/Home/Tracking/tracking-find"
import { useSuperimposeScope } from "@/components/Home/Tracking/tracking-view-prefs"
import {
  GRID_SPANS,
  GRID_STEPS,
  MINUTES_PER_DAY,
  assignedPenIds,
  dominantEntry,
  entriesForDay,
  entriesOnDate,
  formatDuration,
  instantsForDay,
  minuteMap,
  minutesToLabel,
  minutesToTimeString,
  entryDisplayName,
} from "@/lib/time-entries"
import { penTotals, tagTotals as tagTotalsOf, totalsFor } from "@/lib/tracking-summary"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { ERASE, SCISSORS, PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeBar } from "@/components/Home/Tracking/pen-mode-bar"
import { SuperimposeBar } from "@/components/Home/Tracking/superimpose-bar"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { WeekGrid } from "@/components/Home/Tracking/week-grid"
import { InfiniteStrip } from "@/components/Home/Tracking/infinite-strip"
import { useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { CellSizeKeys } from "@/components/Home/Tracking/cell-size-keys"
import { FillRangeControl } from "@/components/Home/Tracking/fill-range-control"
import { cellPaintClass, SuperimposeWash, trackingProbeText, TrkBlockLabel, TrkChromeStack, TrkPlotBezel, TrkProbePlate, TrkRibbon, TrkTagStrip, writeTrkProbe } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers } from "@/components/Home/Tracking/trk-time-markers"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { awakeWindowFor, useSleepSync } from "@/lib/sleep-sync"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import "./tracking-chrome.css"

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** True when [lo, hi) still meets this row in the same clipped span. */
function strokeOverlapUnchanged(
  prevLo: number,
  prevHi: number,
  nextLo: number,
  nextHi: number,
  rowLo: number,
  rowHi: number,
): boolean {
  const clip = (lo: number, hi: number): [number, number] | null => {
    if (!(hi > rowLo && lo < rowHi)) return null
    const a = Math.max(lo, rowLo)
    const b = Math.min(hi, rowHi)
    return b > a ? [a, b] : null
  }
  const prev = clip(prevLo, prevHi)
  const next = clip(nextLo, nextHi)
  if (prev === next) return true
  if (!prev || !next) return false
  return prev[0] === next[0] && prev[1] === next[1]
}

interface HourOccupancy {
  map: (TimeEntry | null)[]
  overlay: (TimeEntry | null)[] | null
  instants: TimeEntry[]
  overlayInstants: TimeEntry[]
}

interface DayHourProps {
  hour: number
  rowHeight: number
  gridStep: number
  entries: HourOccupancy
  strokeLo: number
  strokeHi: number
  sparkLo: number
  sparkHi: number
  scope: TrackScope
  scopes: readonly TrackScope[]
  overlayScope?: TrackScope
  selectedPenId: string | null
  selectedPen: TrackPen | null
  onProbe: (text: string | null) => void
  onOpenInstant: (id: string) => void
  /** Today's minute, or null on any other day. Hairlines after this fade. */
  nowMinute: number | null
}

function dayHourPropsEqual(prev: DayHourProps, next: DayHourProps): boolean {
  if (prev.hour !== next.hour) return false
  if (prev.rowHeight !== next.rowHeight) return false
  if (prev.gridStep !== next.gridStep) return false
  if (prev.entries !== next.entries) return false
  if (prev.scope !== next.scope) return false
  if (prev.scopes !== next.scopes) return false
  if (prev.overlayScope !== next.overlayScope) return false
  if (prev.selectedPenId !== next.selectedPenId) return false
  if (prev.selectedPen !== next.selectedPen) return false
  if (prev.onProbe !== next.onProbe) return false
  if (prev.onOpenInstant !== next.onOpenInstant) return false
  if (prev.nowMinute !== next.nowMinute) return false
  const rowLo = prev.hour * 60
  const rowHi = rowLo + 60
  if (!strokeOverlapUnchanged(prev.strokeLo, prev.strokeHi, next.strokeLo, next.strokeHi, rowLo, rowHi)) return false
  if (!strokeOverlapUnchanged(prev.sparkLo, prev.sparkHi, next.sparkLo, next.sparkHi, rowLo, rowHi)) return false
  return true
}

const DayHourRow = memo(function DayHourRow({
  hour,
  rowHeight,
  gridStep,
  entries,
  strokeLo,
  strokeHi,
  sparkLo,
  sparkHi,
  scope,
  scopes,
  overlayScope,
  selectedPenId,
  selectedPen,
  onProbe,
  onOpenInstant,
  nowMinute,
}: DayHourProps) {
  const cellsPerHour = 60 / gridStep
  const origin = hour * 60
  const futureHour = nowMinute != null && origin + 60 > nowMinute && hour >= Math.floor(nowMinute / 60)
  const labels: { id: string; name: string; color: string; left: number; width: number }[] = []
  const seen = new Set<string>()
  for (let m = 0; m < 60; m += gridStep) {
    const entry = dominantEntry(entries.map, m, gridStep)
    if (!entry || seen.has(entry.id)) continue
    if (entry.startMin < origin + m || entry.startMin >= origin + m + gridStep) continue
    seen.add(entry.id)
    const shown = displayedPen(scope, entry.penId)
    const leaf = scope.pens.find((pen) => pen.id === entry.penId)
    const color = shown?.color || leaf?.color
    if (!color) continue
    const end = Math.min(entry.endMin, origin + 60)
    const start = entry.startMin
    if (end <= start) continue
    labels.push({
      id: entry.id,
      name: entryDisplayName(entry, shown?.name || leaf?.name),
      color,
      left: ((start - origin) / 60) * 100,
      width: ((end - start) / 60) * 100,
    })
  }
  return (
    <div
      data-hour={hour}
      className={`trk-hour-row relative flex shrink-0 items-stretch${futureHour ? " trk-future" : ""}`}
      style={{ height: rowHeight, minHeight: rowHeight }}
    >
      <div className="trk-hour-bezel flex items-center justify-end">
        {minutesToLabel(hour * 60)}
      </div>
      <div className="trk-plot">
        {Array.from({ length: cellsPerHour }, (_, c) => {
          const minute = hour * 60 + c * gridStep
          const index = c * gridStep
          const cellEntry = dominantEntry(entries.map, index, gridStep)
          const pen = cellEntry ? displayedPen(scope, cellEntry.penId) : null
          const painted = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
          const onQuarter = minute % 15 === 0 && c !== 0
          const onFive = minute % 5 === 0 && !onQuarter && c !== 0
          const inStroke = minute >= strokeLo && minute < strokeHi
          const erasing = selectedPenId === ERASE
          const strokePen = !erasing && selectedPen ? displayedPen(scope, selectedPen.id) ?? selectedPen : null
          const fill = strokeCellStyle({
            inStroke,
            erasing,
            samePen: Boolean(cellEntry && selectedPen && cellEntry.penId === selectedPen.id),
            existing: penCellStyle(pen, cellEntry?.precision, minute),
            incoming: penCellStyle(strokePen, undefined, minute),
          })
          const also = cellEntry
            ? assignedPenIds(cellEntry)
                .slice(1)
                .map((id) => scope.pens.find((p) => p.id === id)?.name)
                .filter((n): n is string => Boolean(n))
            : []
          const sparking = minute >= sparkLo && minute < sparkHi
          const futureCell = nowMinute != null && minute > nowMinute
          const overlayEntry = entries.overlay ? dominantEntry(entries.overlay, index, gridStep) : null
          const overlayPen = overlayEntry && overlayScope ? displayedPen(overlayScope, overlayEntry.penId) : null
          return (
            <div
              key={c}
              data-minute={minute}
              className={`${cellPaintClass({
                painted: Boolean(pen) || (inStroke && !erasing),
                quarter: onQuarter,
                five: onFive || (gridStep >= 5 && c !== 0 && !onQuarter),
                spark: sparking,
              })}${futureCell ? " trk-future" : ""}`}
              style={fill}
              onMouseEnter={() =>
                onProbe(
                  trackingProbeText({
                    minute,
                    step: gridStep,
                    name: cellEntry ? entryDisplayName(cellEntry, painted?.name || pen?.name) : undefined,
                    leafName: painted && painted.id !== pen?.id ? painted.name : undefined,
                    assumed: cellEntry?.precision === "estimated",
                    secondaries: also,
                  }),
                )
              }
            >
              {overlayPen && !inStroke ? <SuperimposeWash color={overlayPen.color} /> : null}
            </div>
          )
        })}
        {labels.map((label) => (
          <TrkBlockLabel key={label.id} name={label.name} color={label.color} left={label.left} width={label.width} />
        ))}
        {entries.overlayInstants.map((event) => {
          const eventPen = tickPen(scopes, overlayScope, event.penId)
          return (
            <span
              key={`super-${event.id}`}
              className="trk-instant trk-super-instant"
              style={{
                left: `${((event.startMin - hour * 60) / 60) * 100}%`,
                background: eventPen?.color,
              }}
              aria-hidden
            />
          )
        })}
        {entries.instants.map((event) => {
          const eventPen = tickPen(scopes, scope, event.penId)
          return (
            <button
              key={event.id}
              type="button"
              className="trk-instant"
              aria-label={`${minutesToLabel(event.startMin)} · ${entryDisplayName(event, eventPen?.name)}`}
              style={{
                left: `${((event.startMin - hour * 60) / 60) * 100}%`,
                background: eventPen?.color,
              }}
              onMouseEnter={() =>
                onProbe(
                  trackingProbeText({
                    minute: event.startMin,
                    name: entryDisplayName(event, eventPen?.name),
                  }),
                )
              }
              onClick={(e) => {
                e.stopPropagation()
                onOpenInstant(event.id)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}, dayHourPropsEqual)

export function TimeGrid({
  compact = false,
  showPalette = true,
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
  lockDate = false,
}: {
  compact?: boolean
  /** False when the parent already rendered `PenPalette` + `PenModeBar` + Log activity (Home Tracking). */
  showPalette?: boolean
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
  /** Stay on `currentDate`'s day grid. Does not rewrite the Tracking view prefs. */
  lockDate?: boolean
} = {}) {
  useHabitTrackingSync()
  // Erasing or clearing sleep on the grid is a statement about the night.
  useSleepSync()
  useScreenTimeSync()
  usePenActionSync()
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)
  const gridStep = useTimeTrackingStore((s) => s.gridStep)
  const gridSpan = useTimeTrackingStore((s) => s.gridSpan)
  const infiniteScroll = useTimeTrackingStore((s) => s.infiniteScroll)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const setGridSpan = useTimeTrackingStore((s) => s.setGridSpan)
  const setGridStep = useTimeTrackingStore((s) => s.setGridStep)
  const setInfiniteScroll = useTimeTrackingStore((s) => s.setInfiniteScroll)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const clearDay = useTimeTrackingStore((s) => s.clearDay)
  const prefs = useTrackingViewPrefs()
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])

  const [internalDate, setInternalDate] = useState(() => new Date())
  const date = controlledDate ?? internalDate
  const setDate = setControlledDate ?? setInternalDate
  const span = lockDate ? "day" : gridSpan
  const scrolling = lockDate ? false : infiniteScroll
  const dk = dateKey(date)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]

  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const rowHeight = compact ? 20 : 24
  const [hourBand, setHourBand] = useState({ start: 0, end: 24 })
  const [now, setNow] = useState(() => new Date())
  const [spark, setSpark] = useState<{ lo: number; hi: number } | null>(null)
  const probeRef = useRef<HTMLDivElement>(null)
  const writeProbe = useCallback((text: string | null) => writeTrkProbe(probeRef.current, text), [])
  const openInstant = useCallback((id: string) => setOpenEntryId(id), [])

  const dragRef = useRef<{ anchor: number; head: number; moved: boolean } | null>(null)
  const aligning = useRef(false)
  const [stroke, setStroke] = useState<{ lo: number; hi: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const sparkTimer = useRef<number | null>(null)

  const flashStroke = useCallback((lo: number, hi: number) => {
    if (sparkTimer.current) window.clearTimeout(sparkTimer.current)
    setSpark({ lo, hi })
    sparkTimer.current = window.setTimeout(() => {
      setSpark(null)
      sparkTimer.current = null
    }, 110)
  }, [])

  useEffect(() => () => {
    if (sparkTimer.current) window.clearTimeout(sparkTimer.current)
  }, [])

  const dayEntries = useMemo(
    () => (scope ? entriesForDay(entries, dk, scope.id) : []),
    [entries, dk, scope],
  )

  const penNames = useMemo(() => penNameById(scopes), [scopes])
  const dayInstants = useMemo(
    () => (scope ? scopeTicksWithDiscreteLogs(entries, dk, scope.id, penNames) : []),
    [entries, dk, scope, penNames],
  )

  const map = useMemo(
    () => (scope ? minuteMap(entries, dk, scope.id) : new Array(MINUTES_PER_DAY).fill(null)),
    [entries, dk, scope],
  )
  const overlayScopeId = useSuperimposeScope(scope?.id, scopeIds)
  const overlayScope = scopes.find((s) => s.id === overlayScopeId)
  const overlayMap = useMemo(
    () => (overlayScope ? minuteMap(entries, dk, overlayScope.id) : null),
    [entries, dk, overlayScope],
  )
  const overlayInstants = useMemo(
    () => (overlayScope ? overlayTicksBeside(instantsForDay(entries, dk, overlayScope.id), dayInstants) : []),
    [entries, dk, overlayScope, dayInstants],
  )

  const hourOccupancy = useMemo(() => {
    const bands: HourOccupancy[] = []
    for (let hour = 0; hour < 24; hour++) {
      const start = hour * 60
      const end = start + 60
      const instants: TimeEntry[] = []
      for (const event of dayInstants) {
        if (event.startMin >= start && event.startMin < end) instants.push(event)
      }
      const overInstants: TimeEntry[] = []
      for (const event of overlayInstants) {
        if (event.startMin >= start && event.startMin < end) overInstants.push(event)
      }
      bands.push({
        map: map.slice(start, end),
        overlay: overlayMap ? overlayMap.slice(start, end) : null,
        instants,
        overlayInstants: overInstants,
      })
    }
    return bands
  }, [map, overlayMap, dayInstants, overlayInstants])

  const isToday = dk === dateKey(now)
  const { nowMinute, sun } = useTrackingDayMarkers(date)
  useEffect(() => {
    if (!isToday) return
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [isToday])

  const effectivePenId = selectedPenId === ERASE ? null : selectedPenId
  const selectedPen = scope?.pens.find((p) => p.id === effectivePenId) ?? null

  const commitPaint = useCallback(
    (from: number, to: number) => {
      if (!scope || selectedPenId === null) return
      paintMinutes(
        dk,
        scope.id,
        Math.min(from, to),
        Math.max(from, to),
        selectedPenId === ERASE ? null : selectedPenId,
        selectedVariantIds,
      )
    },
    [scope, selectedPenId, selectedVariantIds, paintMinutes, dk],
  )

  // Drag is resolved on release so one stroke becomes one block, rather than a
  // run of adjacent one-cell blocks that merge back together afterwards.
  // The preview is React state: cells that already wear this pen keep their
  // fill, so the stroke joins them instead of blanking them until mouseup.
  const endDrag = useCallback(() => {
    const state = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (!state) return
    const lo = Math.min(state.anchor, state.head)
    const hi = Math.max(state.anchor, state.head) + gridStep
    if (selectedPenId === SCISSORS) {
      const existing = map[state.anchor]
      if (existing) {
        splitEntryAt(existing.id, state.anchor)
        flashStroke(state.anchor, state.anchor + gridStep)
      }
      return
    }
    if (state.moved) {
      commitPaint(lo, Math.min(MINUTES_PER_DAY, hi))
      flashStroke(lo, Math.min(MINUTES_PER_DAY, hi))
      return
    }
    const existing = map[state.anchor]
    if (existing && selectedPenId !== ERASE) setOpenEntryId(existing.id)
    else if (selectedPenId !== null) {
      commitPaint(state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + gridStep))
      flashStroke(state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + gridStep))
    }
  }, [commitPaint, flashStroke, gridStep, map, selectedPenId, splitEntryAt])

  useEffect(() => {
    window.addEventListener("mouseup", endDrag)
    window.addEventListener("touchend", endDrag)
    window.addEventListener("touchcancel", endDrag)
    return () => {
      window.removeEventListener("mouseup", endDrag)
      window.removeEventListener("touchend", endDrag)
      window.removeEventListener("touchcancel", endDrag)
    }
  }, [endDrag])

  const showStroke = (anchor: number, head: number) => {
    if (selectedPenId === null || selectedPenId === SCISSORS) return
    const lo = Math.min(anchor, head)
    const hi = Math.min(MINUTES_PER_DAY, Math.max(anchor, head) + gridStep)
    setStroke((prev) => (prev?.lo === lo && prev.hi === hi ? prev : { lo, hi }))
  }

  const beginDrag = (minute: number) => {
    dragRef.current = { anchor: minute, head: minute, moved: false }
    showStroke(minute, minute)
  }

  const extendDrag = (minute: number) => {
    const state = dragRef.current
    if (!state || state.head === minute) return
    dragRef.current = { ...state, head: minute, moved: true }
    showStroke(state.anchor, minute)
  }

  const minuteFromEvent = (target: EventTarget | null): number | null => {
    const el = target as HTMLElement | null
    const raw = el?.dataset?.minute
    if (raw == null) return null
    const minute = Number(raw)
    return Number.isFinite(minute) ? minute : null
  }

  const applyFillRange = (from: number, parsedTo: number) => {
    if (!scope || selectedPenId === null) return
    paintMinutes(
      dk,
      scope.id,
      from,
      parsedTo,
      selectedPenId === ERASE ? null : selectedPenId,
      selectedVariantIds,
    )
    flashStroke(from, parsedTo <= from && parsedTo !== 0 ? MINUTES_PER_DAY : parsedTo)
  }

  const pens = useMemo(() => penTotals(dayEntries, scope, [dk]), [dayEntries, scope, dk])
  const totals = useMemo(() => totalsFor(dayEntries, [dk]), [dayEntries, dk])
  const dayTagTotals = useMemo(
    () => tagTotalsOf(entriesOnDate(entries, dk), scopes, tags, [dk]),
    [entries, dk, scopes, tags],
  )
  const awake = awakeWindowFor(dk, date)
  const startHour = firstUnpaintedWakingHour({ map, wakeMin: awake?.wake, bedMin: awake?.bed })

  const syncHourBand = () => {
    if (aligning.current) return
    const root = gridRef.current
    if (!root) return
    if (root.clientHeight <= 0) {
      setHourBand((prev) => (prev.start === 0 && prev.end === 24 ? prev : { start: 0, end: 24 }))
      return
    }
    const start = Math.max(0, Math.floor(root.scrollTop / rowHeight) - 1)
    const end = Math.min(24, Math.ceil((root.scrollTop + root.clientHeight) / rowHeight) + 2)
    setHourBand((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }

  useLayoutEffect(() => {
    const root = gridRef.current
    if (!root) return
    const hour = startHour
    const align = () => {
      const row = root.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
      const ruler = root.querySelector(".sticky") as HTMLElement | null
      const top = row
        ? Math.max(0, row.offsetTop - (ruler?.offsetHeight ?? 0))
        : hour * rowHeight
      aligning.current = true
      root.scrollTop = top
      aligning.current = false
      if (root.clientHeight <= 0) return
      const start = Math.max(0, Math.floor(root.scrollTop / rowHeight) - 1)
      const end = Math.min(24, Math.ceil((root.scrollTop + root.clientHeight) / rowHeight) + 2)
      setHourBand((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    align()
    const id = requestAnimationFrame(align)
    return () => cancelAnimationFrame(id)
  }, [dk, awake?.wake, rowHeight])

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  useEffect(() => {
    if (openEntryId && !openEntry) setOpenEntryId(null)
  }, [openEntryId, openEntry])

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const cellsPerHour = 60 / gridStep
  const rulerEvery = gridStep <= 5 ? 5 : gridStep

  return (
    <div
      className={`trk95 trk-canvas select-none${compact ? " trk-canvas-compact" : ""}`}
      data-ui-name="Time grid"
      data-ui-docs="components/Home/Tracking/README.md"
      data-ui-docs-anchor="time-gridtsx-behavior"
    >
      {showPalette && (
        <TrkChromeStack
          pens={<PenPalette />}
          modeBar={<PenModeBar />}
          gridAction={<LogActivityLatch dateKey={dk} />}
        />
      )}

      <SuperimposeBar />

      <TrkPlotBezel
        strip={
          <>
            {!lockDate && <div className="trk-module">
              <span className="trk-silk">Time / Div</span>
              <div className="trk-span-switch" role="toolbar" aria-label="Time grid span">
                {GRID_SPANS.map((option) => {
                  const pressed = span === option && !scrolling
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setGridSpan(option)
                        setInfiniteScroll(false)
                      }}
                      aria-pressed={pressed}
                      title={
                        option === "day"
                          ? "One day, down to the minute"
                          : "Seven days side by side — fill a routine across several at once"
                      }
                      className="capitalize"
                    >
                      {option}
                    </button>
                  )
                })}
                <span className="trk-toolbar-split" aria-hidden />
                <button
                  type="button"
                  aria-pressed={scrolling}
                  title="Continuous time, day rows with week bands. Origin stays put when you pick a day."
                  onClick={() => setInfiniteScroll(!infiniteScroll)}
                >
                  Infinite scroll
                </button>
              </div>
            </div>}
            <CellSizeKeys steps={GRID_STEPS} value={gridStep} onChange={setGridStep} />
            <TrackingFind
              onJump={(hit) => {
                const [y, m, d] = hit.date.split("-").map(Number)
                setActiveScope(hit.scopeId)
                setDate(new Date(y, (m ?? 1) - 1, d ?? 1))
                setGridSpan("day")
                setInfiniteScroll(false)
                setOpenEntryId(hit.entryId)
              }}
            />
            {!scrolling && span === "day" && (
              <FillRangeControl
                dayEntries={dayEntries}
                fallbackFrom={prefs.fillFrom}
                fallbackTo={prefs.fillTo}
                selectedPenId={selectedPenId}
                penName={selectedPenId === ERASE ? "erase" : selectedPen?.name || "selected pen"}
                onFill={applyFillRange}
              />
            )}
            {!scrolling && span === "day" && (
              <div className="trk-occ-well">
                <span className="trk-silk">Occupancy</span>
                <div className="trk-occ-readout">
                  <span className="trk-occ-pct">{Math.round(totals.coverage)}%</span>
                  <span className="trk-occ-of">of the day</span>
                  <span className="trk-occ-tracked">{formatDuration(totals.tracked)} tracked</span>
                </div>
              </div>
            )}
            {!scrolling && span === "day" && <TrkProbePlate nodeRef={probeRef} />}
          </>
        }
      >
      {scrolling ? (
        <InfiniteStrip
          centerDate={date}
          onDateChange={setDate}
          onOpenDay={(day) => {
            setDate(day)
            setGridSpan("day")
            setInfiniteScroll(false)
          }}
          onOpenWeek={(weekStart) => {
            setDate(weekStart)
            setGridSpan("week")
            setInfiniteScroll(false)
          }}
          mode="week"
          compact={compact}
        />
      ) : span === "week" ? (
        <WeekGrid
          date={date}
          onDateChange={setDate}
          onOpenDay={(day) => {
            setDate(day)
            setGridSpan("day")
          }}
          compact={compact}
        />
      ) : (
        <>
      <TrackingPeriodNav
        label={date.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        previousLabel="Previous day"
        nextLabel="Next day"
        onPrevious={() => setDate(subDays(date, 1))}
        onNext={() => setDate(addDays(date, 1))}
        onToday={() => setDate(new Date())}
        locked={lockDate}
        trailing={
          <button type="button" className="trk-micro-danger trk-period-aux" onClick={() => clearDay(dk, scope.id)}>
            Clear day
          </button>
        }
      />

      {totals.tracked === 0 && <ScreenTimeEmptyHint date={dk} scopeId={scope.id} />}

      <div
        ref={gridRef}
        className="trk-grid trk-grid-full-day"
        tabIndex={-1}
        data-start-hour={startHour}
        data-superimpose={overlayScope?.id || undefined}
        style={compact ? { maxHeight: 360 } : undefined}
        onScroll={syncHourBand}
        onMouseLeave={() => writeProbe(null)}
      >
        <div
          className="trk-plot-paper"
          onMouseDown={(e) => {
            focusTrackingPlot(gridRef.current)
            const minute = minuteFromEvent(e.target)
            if (minute === null) return
            if (selectedPenId === null) {
              const existing = map[minute]
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            beginDrag(minute)
          }}
          onMouseOver={(e) => {
            if (!dragRef.current) return
            const minute = minuteFromEvent(e.target)
            if (minute !== null) extendDrag(minute)
          }}
          onTouchStart={(e) => {
            focusTrackingPlot(gridRef.current)
            const minute = minuteFromEvent(e.target)
            if (minute === null) return
            if (selectedPenId === null) {
              const existing = map[minute]
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            beginDrag(minute)
          }}
          onTouchMove={(e) => {
            if (!dragRef.current) return
            e.preventDefault()
            const touch = e.touches[0]
            if (!touch) return
            const minute = minuteFromEvent(document.elementFromPoint(touch.clientX, touch.clientY))
            if (minute !== null) extendDrag(minute)
          }}
        >
          <div className="trk-time-axis sticky top-0 z-20 flex items-stretch">
            <div className="trk-hour-bezel">min</div>
            <div className="flex flex-1">
              {Array.from({ length: cellsPerHour }, (_, c) => {
                const minute = c * gridStep
                return (
                  <div
                    key={c}
                    className={`flex-1 whitespace-nowrap ${
                      c !== 0 && minute % 15 === 0 ? "trk-cell-quarter" : ""
                    }`}
                  >
                    {minute % rulerEvery === 0 ? `:${String(minute).padStart(2, "0")}` : ""}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="relative">
          {hourBand.start > 0 ? <div style={{ height: hourBand.start * rowHeight }} /> : null}
          {Array.from({ length: Math.max(0, hourBand.end - hourBand.start) }, (_, index) => {
            const hour = hourBand.start + index
            const occupancy = hourOccupancy[hour]
            if (!occupancy) return null
            return (
              <DayHourRow
                key={hour}
                hour={hour}
                rowHeight={rowHeight}
                gridStep={gridStep}
                entries={occupancy}
                strokeLo={stroke?.lo ?? 0}
                strokeHi={stroke?.hi ?? 0}
                sparkLo={spark?.lo ?? 0}
                sparkHi={spark?.hi ?? 0}
                scope={scope}
                scopes={scopes}
                overlayScope={overlayScope}
                selectedPenId={selectedPenId}
                selectedPen={selectedPen}
                onProbe={writeProbe}
                onOpenInstant={openInstant}
                nowMinute={nowMinute}
              />
            )
          })}
          {hourBand.end < 24 ? <div style={{ height: (24 - hourBand.end) * rowHeight }} /> : null}
          <div
            className="trk-day-clock-markers"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 64,
              pointerEvents: "none",
              zIndex: 6,
            }}
            aria-hidden
          >
            <TrkPlotMarkers
              origin={0}
              span={MINUTES_PER_DAY}
              axis="y"
              nowMinute={nowMinute}
              sun={sun}
              showNowLabel
            />
          </div>
          </div>
          {totals.tracked === 0 && <div className="trk-silkscreen">untracked</div>}
        </div>
      </div>

      <TrkRibbon pens={pens} untracked={totals.untracked} coverage={totals.coverage} />

      <TrkTagStrip tags={dayTagTotals} />
        </>
      )}
      </TrkPlotBezel>

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}

export { dateKey as trackingDateKey, minutesToTimeString }
