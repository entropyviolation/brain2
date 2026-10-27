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
 *     (`variant-chips.tsx`). Data breaks the pen down by these.
 *   - **Tag** — cross-scope, and the join to Habits: tagged time flows into any
 *     linked daily habit via `lib/habit-tracking-sync.ts`, which
 *     `useHabitTrackingSync` keeps running while this view is mounted.
 *
 * Totals come from `lib/tracking-summary.ts` as occupancy — overlapping blocks
 * on the same minute count once — the same module the Activity Log and the
 * Data Tracking tab use, so the three can never disagree. TIME/DIV, Cell
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

import { deferSyncs } from "@/lib/defer-sync"
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { addDays, subDays } from "date-fns"
import { displayedPen, penCellStyle, useTimeTrackingStore, type TimeEntry, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { overlayTicksBeside, penNameById, scopeTicksWithDiscreteLogs, tickPen, withoutDiscreteLogs } from "@/components/Home/Tracking/discrete-log-instants"
import { strokeCellStyle, strokeOverlapUnchanged } from "@/components/Home/Tracking/grids/grid-stroke"
import { focusTrackingPlot } from "@/components/Home/Tracking/tracking-undo"
import { TrackingFind } from "@/components/Home/Tracking/tracking-find"
import { useTransitSuggestions } from "@/components/Home/Tracking/grids/use-transit-suggestions"
import { acceptSuggestion, isSuggestion, overlaySuggestions } from "@/lib/transit-suggest"
import { ghostAttr, probeLayerFor, useGhostScopes, type GhostScope } from "@/components/Home/Tracking/grids/ghost-layers"
import {
  GRID_SPANS,
  GRID_STEPS,
  MINUTES_PER_DAY,
  WEEK_STEPS,
  type GridStep,
  type WeekStep,
  assignedPenIds,
  dominantEntry,
  entriesForDay,
  entriesOnDate,
  formatDuration,
  instantsForDay,
  minuteMap,
  minutesToLabel,
  entryDisplayName,
} from "@/lib/time-entries"
import { penTotals, tagTotals as tagTotalsOf, totalsFor } from "@/lib/tracking-summary"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { DayTubesDialog } from "@/components/Home/Tracking/grids/day-tubes-dialog"
import { noPaint } from "@/components/Home/Tracking/cabinet/tracking-tool-mode"
import { ERASE, SCISSORS, PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeBar } from "@/components/Home/Tracking/pen-mode-bar"
import { SuperimposeBar } from "@/components/Home/Tracking/grids/superimpose-bar"
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { WeekGrid } from "@/components/Home/Tracking/grids/week-grid"
import { InfiniteStrip } from "@/components/Home/Tracking/grids/infinite-strip"
import {
  DEFAULT_SUPERIMPOSE_OPACITY,
  setRibbonPercent,
  setScreenFace,
  setSuperimposeMulti,
  setSuperimposeOpacity,
  setTrackingViewPrefs,
  useTrackingViewPrefs,
} from "@/components/Home/Tracking/tracking-view-prefs"
import { TrackingDeskSlotsContext, useTrackingDeskSlots } from "@/components/Home/Tracking/tracking-desk-slots"
import { PushKey, ScopeKnob, ScopePanel, ScopeReadout, ScopeSection, SlideSwitch } from "@/components/Home/Tracking/trk-scope"
import { ToolDetail } from "@/components/Home/Tracking/cabinet/tool-detail"
import { playTrkMotion } from "@/components/Home/Tracking/trk-motion"
import { nextPaintPenId, trackingPaintTool, type TrackingPaintTool } from "@/components/Home/Tracking/cabinet/tracking-tool-mode"
import { depthOptions, maxTreeDepth } from "@/lib/pen-tree"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import {
  clearTimegridReveal,
  peekTimegridReveal,
  subscribeTimegridReveal,
  timegridBlockHour,
  timegridHourScrollTop,
} from "@/components/Home/Tracking/timegrid-reveal"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { CellSizeKeys } from "@/components/Home/Tracking/grids/cell-size-keys"
import { FillRangeControl } from "@/components/Home/Tracking/grids/fill-range-control"
import { cellPaintClass, ghostProbeText, SuperimposeWash, trackingProbeText, TrkBlockLabel, TrkChromeStack, TrkPlotBezel, TrkProbePlate, TrkRibbon, TrkTagStrip, writeTrkProbe } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers } from "@/components/Home/Tracking/grids/trk-time-markers"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { awakeWindowFor, useSleepSync } from "@/lib/sleep-sync"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import "./tracking-chrome.css"

interface HourOccupancy {
  map: (TimeEntry | null)[]
  /** One minute slice per ghost, in `ghosts` order. */
  overlays: (TimeEntry | null)[][]
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
  ghosts: readonly GhostScope[]
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
  if (prev.ghosts !== next.ghosts) return false
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
  ghosts,
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
          const ghostCells = ghosts.map((ghost, g) => {
            const ghostEntry = entries.overlays[g] ? dominantEntry(entries.overlays[g], index, gridStep) : null
            return { ghost, entry: ghostEntry, pen: ghostEntry ? displayedPen(ghost.scope, ghostEntry.penId) : null }
          })
          return (
            <div
              key={c}
              data-minute={minute}
              data-entry-id={
                cellEntry && cellEntry.startMin >= minute && cellEntry.startMin < minute + gridStep
                  ? cellEntry.id
                  : undefined
              }
              className={`${cellPaintClass({
                painted: Boolean(pen) || (inStroke && !erasing),
                quarter: onQuarter,
                five: onFive || (gridStep >= 5 && c !== 0 && !onQuarter),
                spark: sparking,
              })}${futureCell ? " trk-future" : ""}`}
              style={fill}
              onMouseEnter={() =>
                onProbe(
                  ghostProbeText({
                    base: trackingProbeText({
                      minute,
                      step: gridStep,
                      name: cellEntry ? entryDisplayName(cellEntry, painted?.name || pen?.name) : undefined,
                      leafName: painted && painted.id !== pen?.id ? painted.name : undefined,
                      assumed: cellEntry?.precision === "estimated",
                      secondaries: also,
                    }),
                    minute,
                    step: gridStep,
                    primary: probeLayerFor(scope, cellEntry),
                    ghosts: ghostCells.flatMap((cell) => probeLayerFor(cell.ghost.scope, cell.entry) ?? []),
                  }),
                )
              }
            >
              {inStroke
                ? null
                : ghostCells.map((cell) =>
                    cell.pen ? (
                      <SuperimposeWash key={cell.ghost.scope.id} color={cell.pen.color} opacity={cell.ghost.opacity} />
                    ) : null,
                  )}
            </div>
          )
        })}
        {labels.map((label) => (
          <TrkBlockLabel
            key={label.id}
            entryId={label.id}
            name={label.name}
            color={label.color}
            left={label.left}
            width={label.width}
          />
        ))}
        {entries.overlayInstants.map((event) => {
          const ghost = ghosts.find((g) => g.scope.id === event.scopeId)
          const eventPen = tickPen(scopes, ghost?.scope, event.penId)
          return (
            <span
              key={`super-${event.id}`}
              className="trk-instant trk-super-instant"
              style={{
                left: `${((event.startMin - hour * 60) / 60) * 100}%`,
                background: eventPen?.color,
                ...(ghost?.opacity == null ? null : { opacity: Math.min(1, ghost.opacity + 0.08) }),
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
              data-entry-id={event.id}
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
  desk = false,
  deck,
}: {
  compact?: boolean
  /** False when the parent already rendered `PenPalette` + `PenModeBar` + Log activity (Home Tracking). */
  showPalette?: boolean
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
  /** Stay on `currentDate`'s day grid. Does not rewrite the Tracking view prefs. */
  lockDate?: boolean
  /**
   * Home Tracking desk: the screen bay (view deck, period CRT, glass/paper
   * screen, readouts) plus the instrument column (tools, Fill, TIME/DIV, CELL,
   * SHOW AS, screen face, Find, ghost flags). The pen rack is the parent's.
   */
  desk?: boolean
  /** The view deck (`PenModeDeck`) at the top of the screen bay. */
  deck?: ReactNode
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
  const weekStep = useTimeTrackingStore((s) => s.weekStep)
  const setWeekStep = useTimeTrackingStore((s) => s.setWeekStep)
  const gridSpan = useTimeTrackingStore((s) => s.gridSpan)
  const infiniteScroll = useTimeTrackingStore((s) => s.infiniteScroll)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const setGridSpan = useTimeTrackingStore((s) => s.setGridSpan)
  const setGridStep = useTimeTrackingStore((s) => s.setGridStep)
  const setSelectedPen = useTimeTrackingStore((s) => s.setSelectedPen)
  const setScopeDisplayDepth = useTimeTrackingStore((s) => s.setScopeDisplayDepth)
  const setInfiniteScroll = useTimeTrackingStore((s) => s.setInfiniteScroll)
  const setActiveScope = useTimeTrackingStore((s) => s.setActiveScope)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const clearDay = useTimeTrackingStore((s) => s.clearDay)
  const prefs = useTrackingViewPrefs()
  const deskSlots = useTrackingDeskSlots()
  const [fillArmed, setFillArmed] = useState(false)
  const [fillSlot, setFillSlot] = useState<HTMLDivElement | null>(null)

  const [internalDate, setInternalDate] = useState(() => new Date())
  const date = controlledDate ?? internalDate
  const setDate = setControlledDate ?? setInternalDate
  const [tubesOpen, setTubesOpen] = useState(false)
  const span = lockDate ? "day" : gridSpan
  const scrolling = lockDate ? false : infiniteScroll
  const dk = formatLocalDateKey(date)
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
  const [revealNonce, setRevealNonce] = useState(0)
  useEffect(() => subscribeTimegridReveal(() => setRevealNonce((n) => n + 1)), [])

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
  const dayInstants = useMemo(() => {
    const ticks = scope ? scopeTicksWithDiscreteLogs(entries, dk, scope.id, penNames) : []
    return prefs.hideLogFlags ? withoutDiscreteLogs(ticks, penNames) : ticks
  }, [entries, dk, scope, penNames, prefs.hideLogFlags])

  const map = useMemo(
    () => (scope ? minuteMap(entries, dk, scope.id) : new Array(MINUTES_PER_DAY).fill(null)),
    [entries, dk, scope],
  )
  const transit = useTransitSuggestions(entries, dk, scope)
  // Suggestions are drawn only; painting, totals and the fill logic keep reading the real `map`.
  const shownMap = useMemo(() => overlaySuggestions(map, transit), [map, transit])
  const ghosts = useGhostScopes(scope, scopes)
  const overlayMaps = useMemo(
    () => ghosts.map((ghost) => minuteMap(entries, dk, ghost.scope.id)),
    [entries, dk, ghosts],
  )
  const overlayInstants = useMemo(() => {
    const out: TimeEntry[] = []
    for (const ghost of ghosts) {
      const ticks = overlayTicksBeside(instantsForDay(entries, dk, ghost.scope.id), [...dayInstants, ...out])
      out.push(...(prefs.hideLogFlags ? withoutDiscreteLogs(ticks, penNames) : ticks))
    }
    return out
  }, [entries, dk, ghosts, dayInstants, prefs.hideLogFlags, penNames])

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
        map: shownMap.slice(start, end),
        overlays: overlayMaps.map((ghostMap) => ghostMap.slice(start, end)),
        instants,
        overlayInstants: overInstants,
      })
    }
    return bands
  }, [shownMap, overlayMaps, dayInstants, overlayInstants])

  const isToday = dk === formatLocalDateKey(now)
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
      if (!scope || noPaint(selectedPenId)) return
      deferSyncs(() => paintMinutes(
        dk,
        scope.id,
        Math.min(from, to),
        Math.max(from, to),
        selectedPenId === ERASE ? null : selectedPenId,
        selectedVariantIds,
      ))
    },
    [scope, selectedPenId, selectedVariantIds, paintMinutes, dk],
  )

  // A tentative transit tile is accepted with a click: no pen in hand, or the Transit pen itself.
  const acceptAt = useCallback(
    (minute: number) => {
      const s = shownMap[minute]
      if (!isSuggestion(s) || map[minute]) return false
      if (selectedPenId !== null && selectedPenId !== s.penId) return false
      acceptSuggestion(s, paintMinutes)
      return true
    },
    [shownMap, map, selectedPenId, paintMinutes],
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
        playTrkMotion(gridRef.current, "cut", state.anchor, state.anchor + gridStep)
      }
      return
    }
    if (state.moved) {
      commitPaint(lo, Math.min(MINUTES_PER_DAY, hi))
      flashStroke(lo, Math.min(MINUTES_PER_DAY, hi))
      playTrkMotion(gridRef.current, selectedPenId === ERASE ? "erase" : "paint", lo, Math.min(MINUTES_PER_DAY, hi))
      return
    }
    const existing = map[state.anchor]
    if (existing && selectedPenId !== ERASE) setOpenEntryId(existing.id)
    else if (selectedPenId !== null) {
      commitPaint(state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + gridStep))
      flashStroke(state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + gridStep))
      playTrkMotion(
        gridRef.current,
        selectedPenId === ERASE ? "erase" : "paint",
        state.anchor,
        Math.min(MINUTES_PER_DAY, state.anchor + gridStep),
      )
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
    if (noPaint(selectedPenId) || selectedPenId === SCISSORS) return
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
    if (!scope || noPaint(selectedPenId)) return
    deferSyncs(() => paintMinutes(
      dk,
      scope.id,
      from,
      parsedTo,
      selectedPenId === ERASE ? null : selectedPenId,
      selectedVariantIds,
    ))
    flashStroke(from, parsedTo <= from && parsedTo !== 0 ? MINUTES_PER_DAY : parsedTo)
    playTrkMotion(gridRef.current, "fill", from, parsedTo <= from && parsedTo !== 0 ? MINUTES_PER_DAY : parsedTo || MINUTES_PER_DAY)
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
    const pending = peekTimegridReveal()
    const headerGrid = Boolean(root.closest(".htk-desk"))
    const canReveal = Boolean(pending && !headerGrid && !lockDate && span === "day" && !scrolling && scope)
    if (canReveal && pending && pending.scopeId === scope?.id && pending.date !== dk) {
      const next = parseLocalDate(pending.date)
      if (!next) clearTimegridReveal(pending.entryId)
      else setDate(next)
      return
    }
    const reveal = canReveal && pending && pending.scopeId === scope?.id && pending.date === dk ? pending : null
    const hour = reveal ? timegridBlockHour(reveal.startMin) : startHour
    const align = () => {
      const row = root.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
      const ruler = root.querySelector(".sticky") as HTMLElement | null
      const top = timegridHourScrollTop(hour, rowHeight, row ? row.offsetTop : null, ruler?.offsetHeight ?? 0)
      aligning.current = true
      root.scrollTop = top
      aligning.current = false
      if (reveal) {
        root.dataset.revealedEntry = reveal.entryId
        root.dataset.revealHour = String(hour)
        const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(reveal.entryId) : reveal.entryId
        const block = root.querySelector(`[data-entry-id="${escaped}"]`)
        const target = block instanceof HTMLElement ? block : row
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "center", inline: "nearest" })
        }
        clearTimegridReveal(reveal.entryId)
      }
      if (root.clientHeight <= 0) return
      const start = Math.max(0, Math.floor(root.scrollTop / rowHeight) - 1)
      const end = Math.min(24, Math.ceil((root.scrollTop + root.clientHeight) / rowHeight) + 2)
      setHourBand((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
    }
    align()
    const id = requestAnimationFrame(align)
    return () => cancelAnimationFrame(id)
  }, [dk, awake?.wake, rowHeight, startHour, span, scrolling, scope?.id, lockDate, revealNonce, setDate])

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  useEffect(() => {
    if (openEntryId && !openEntry) setOpenEntryId(null)
  }, [openEntryId, openEntry])

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const cellsPerHour = 60 / gridStep
  const rulerEvery = gridStep <= 5 ? 5 : gridStep

  const findControl = (
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
  )
  const fillControl = (
            <FillRangeControl
                dayEntries={dayEntries}
                fallbackFrom={prefs.fillFrom}
                fallbackTo={prefs.fillTo}
                selectedPenId={selectedPenId}
                penName={selectedPenId === ERASE ? "erase" : selectedPen?.name || "selected pen"}
                onFill={applyFillRange}
              />
  )
  const infiniteStrip = (
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
  )
  const dayGrid = (
      <div
        ref={gridRef}
        className="trk-grid trk-grid-full-day"
        tabIndex={-1}
        data-start-hour={startHour}
        data-superimpose={ghostAttr(ghosts)}
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
            if (acceptAt(minute)) {
              e.preventDefault()
              return
            }
            if (noPaint(selectedPenId)) {
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
            if (acceptAt(minute)) {
              e.preventDefault()
              return
            }
            if (noPaint(selectedPenId)) {
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
                ghosts={ghosts}
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
  )
  const dayRibbon = (
    <>
      <TrkRibbon
        pens={pens}
        untracked={totals.untracked}
        coverage={totals.coverage}
        percentBasis={prefs.ribbonPercent.day}
        periodLabel="day"
        onPercentBasis={(basis) => setRibbonPercent("day", basis)}
      />

      <TrkTagStrip tags={dayTagTotals} />
    </>
  )


  if (desk) {
    const spanKey: "day" | "week" | "infinite" = scrolling ? "infinite" : span === "week" ? "week" : "day"
    const face = prefs.screenFace[spanKey]
    const paintTool = trackingPaintTool(selectedPenId)
    const selectTool = (tool: TrackingPaintTool) => {
      setFillArmed(false)
      setSelectedPen(nextPaintPenId(tool, selectedPenId, scope.pens[0]?.id ?? null))
    }
    const weekCells = !scrolling && span === "week"
    const cellSteps: readonly number[] = weekCells ? WEEK_STEPS : GRID_STEPS
    const cellValue = weekCells ? weekStep : gridStep
    const depthMarks = maxTreeDepth(scope.pens) > 0 ? depthOptions(scope.pens, scope.depthLabels) : []
    const depthIndex = Math.max(0, depthMarks.findIndex((option) => option.depth === (scope.displayDepth ?? null)))
    return (
      <div
        className="trk95 trk-canvas trk-grid-desk select-none"
        data-ui-name="Time grid"
        data-ui-docs="components/Home/Tracking/README.md"
        data-ui-docs-anchor="time-gridtsx-behavior"
      >
        <TrackingDeskSlotsContext.Provider value={{ ...deskSlots, fillSlot: fillArmed ? fillSlot : null }}>
          <ScopePanel as="main" className="trk-center-bay" badge="TRK" name="3132 · SCREEN" label="Time grid screen" julia={1}>
            {deck}
            {scrolling ? (
              <div className="trk-screen-bezel" data-face={face}>
                {infiniteStrip}
              </div>
            ) : span === "week" ? (
              <WeekGrid
                date={date}
                onDateChange={setDate}
                onOpenDay={(day) => {
                  setDate(day)
                  setGridSpan("day")
                }}
                compact={compact}
                desk
                face={face}
              />
            ) : (
              <>
                <TrackingPeriodNav
                  variant="crt"
                  label={date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  previousLabel="Previous day"
                  nextLabel="Next day"
                  onPrevious={() => setDate(subDays(date, 1))}
                  onNext={() => setDate(addDays(date, 1))}
                  onToday={() => setDate(new Date())}
                  date={date}
                  onPickDate={setDate}
                  locked={lockDate}
                  meta={`${formatDuration(totals.tracked)} tracked · ${Math.round(totals.coverage)}% of the day`}
                  readouts={
                    <>
                      <ScopeReadout label="Tracked" value={formatDuration(totals.tracked)} />
                      <ScopeReadout label="Of day" value={`${Math.round(totals.coverage)}%`} />
                    </>
                  }
                  trailing={
                    <button type="button" className="trk-micro-danger trk-period-aux" onClick={() => clearDay(dk, scope.id)}>
                      Clear day
                    </button>
                  }
                />
                <TrkProbePlate nodeRef={probeRef} />
                {totals.tracked === 0 && <ScreenTimeEmptyHint date={dk} scopeId={scope.id} />}
                <div className="trk-screen-bezel" data-face={face}>
                  {dayGrid}
                </div>
                {dayRibbon}
              </>
            )}
          </ScopePanel>

          <ScopePanel
            as="aside"
            className="trk-instruments"
            badge="TRK"
            name="3132 · TIME RECORDER"
            label="Instruments"
            julia={2}
          >
            <ScopeSection band="Tools">
              <div className="trk-pushes" role="group" aria-label="Paint tools">
                <PushKey label="Draw" pressed={!fillArmed && paintTool === "draw"} onClick={() => selectTool("draw")} title="Paint with the selected pen" />
                <PushKey label="Erase" pressed={!fillArmed && paintTool === "erase"} onClick={() => selectTool("erase")} title="Drag to clear minutes" />
                <PushKey
                  label="Scissors"
                  pressed={!fillArmed && paintTool === "scissors"}
                  onClick={() => selectTool("scissors")}
                  title="Split a block at the minute you click"
                />
                <PushKey
                  label="Point"
                  pressed={!fillArmed && paintTool === "point"}
                  onClick={() => selectTool("point")}
                  title="Click opens a block — nothing ever paints"
                />
                <PushKey
                  label="Fill"
                  pressed={fillArmed}
                  onClick={() => setFillArmed((armed) => !armed)}
                  title="Type a clock range and fill it on one or more days"
                />
              </div>
              <div className="trk-instrument-detail">
                {fillArmed ? (
                  <>
                    <span className="trk-instrument-detail-plate">
                      Fill with {paintTool === "erase" ? "erase" : selectedPen?.name || "selected pen"}
                    </span>
                    {scrolling ? (
                      <p>Fill works on Day or Week. Turn TIME / DIV to one of them.</p>
                    ) : span === "week" ? (
                      <div ref={setFillSlot} className="trk-fill-slot" />
                    ) : (
                      fillControl
                    )}
                  </>
                ) : (
                  <ToolDetail paintTool={paintTool} />
                )}
              </div>
              <div className="trk-logkey">
                <LogActivityLatch dateKey={dk} />
              </div>
            </ScopeSection>

            <ScopeSection band="Time base">
              {lockDate ? null : (
                <ScopeKnob
                  title="Time / Div"
                  ariaLabel="Time grid span"
                  exposeMarks
                  size={136}
                  marks={[
                    { mark: "DAY", read: "DAY", label: "day" },
                    { mark: "WEEK", read: "WEEK", label: "week" },
                    { mark: "∞", read: "INFINITE", label: "Infinite scroll" },
                  ]}
                  index={scrolling ? 2 : span === "week" ? 1 : 0}
                  onIndex={(i) => {
                    if (i === 2) {
                      setInfiniteScroll(true)
                      return
                    }
                    setGridSpan(i === 1 ? "week" : "day")
                    setInfiniteScroll(false)
                  }}
                />
              )}
              <div className="trk-knobs2">
                <ScopeKnob
                  key={weekCells ? "week" : "day"}
                  title="Cell"
                  ariaLabel={weekCells ? "Week cell size" : "Cell size"}
                  marks={cellSteps.map((step) => ({ mark: String(step), read: `${step} MIN` }))}
                  index={Math.max(0, cellSteps.indexOf(cellValue))}
                  valueNow={cellValue}
                  onIndex={(i) => (weekCells ? setWeekStep(WEEK_STEPS[i] as WeekStep) : setGridStep(GRID_STEPS[i] as GridStep))}
                />
                {depthMarks.length ? (
                  <ScopeKnob
                    title="Show as"
                    ariaLabel={`${scope.name} detail level`}
                    marks={depthMarks.map((option) => ({
                      mark: option.label.slice(0, 4).toUpperCase(),
                      read: option.label.toUpperCase(),
                    }))}
                    index={depthIndex}
                    onIndex={(i) => setScopeDisplayDepth(scope.id, depthMarks[i]?.depth ?? null)}
                  />
                ) : null}
              </div>
            </ScopeSection>

            <ScopeSection band="Display">
              <SlideSwitch
                title="SCREEN"
                options={[
                  { value: "glass", label: "GLASS" },
                  { value: "paper", label: "PAPER" },
                ]}
                value={face}
                onChange={(next) => setScreenFace(spanKey, next)}
              />
              {findControl}
              <PushKey
                label="Day tubes"
                pressed={tubesOpen}
                onClick={() => setTubesOpen(true)}
                title="Your tracked week as tubes of liquid or sand, or as hourglasses. Optional."
              />
              <DayTubesDialog open={tubesOpen} onOpenChange={setTubesOpen} date={date} setDate={setDate} />
            </ScopeSection>

            <ScopeSection band="Flags">
              <div className="trk-pushes" role="group" aria-label="Flags">
                <PushKey
                  tone="mint"
                  label="Multi"
                  pressed={prefs.superimposeMulti}
                  onClick={() => setSuperimposeMulti(!prefs.superimposeMulti)}
                  title="Light several ghost LEDs at once"
                />
                <PushKey
                  tone="mint"
                  label="Advanced"
                  pressed={prefs.superimposeAdvanced}
                  onClick={() => setTrackingViewPrefs({ superimposeAdvanced: !prefs.superimposeAdvanced })}
                  title="Set each ghost's opacity"
                />
                <PushKey
                  tone="mint"
                  label="Hide log flags"
                  pressed={prefs.hideLogFlags}
                  onClick={() => setTrackingViewPrefs({ hideLogFlags: !prefs.hideLogFlags })}
                  title="Hide log flags on the screen (entries stay)"
                />
                <PushKey
                  tone="mint"
                  label="Hide sun lines"
                  note="☼ ☾"
                  pressed={prefs.hideSunLines}
                  onClick={() => setTrackingViewPrefs({ hideSunLines: !prefs.hideSunLines })}
                  title="Hide sunrise / sunset lines (the now line stays)"
                />
              </div>
              {prefs.superimposeAdvanced && ghosts.length > 0 ? (
                <div className="trk-opacity-rows" role="group" aria-label="Ghost opacity">
                  {ghosts.map((ghost) => {
                    const value = Math.round((ghost.opacity ?? DEFAULT_SUPERIMPOSE_OPACITY) * 100)
                    return (
                      <label key={ghost.scope.id}>
                        <span>{ghost.scope.name}</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={value}
                          aria-label={`${ghost.scope.name} ghost opacity`}
                          onChange={(event) => setSuperimposeOpacity(ghost.scope.id, Number(event.target.value) / 100)}
                        />
                        <span>{value}%</span>
                      </label>
                    )
                  })}
                </div>
              ) : null}
            </ScopeSection>
          </ScopePanel>
        </TrackingDeskSlotsContext.Provider>

        {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
      </div>
    )
  }

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
            {!scrolling && span === "week" ? (
              <CellSizeKeys key="week" steps={WEEK_STEPS} value={weekStep} onChange={setWeekStep} ariaLabel="Week cell size" />
            ) : (
              <CellSizeKeys key="day" steps={GRID_STEPS} value={gridStep} onChange={setGridStep} />
            )}
            {findControl}
            <div className="trk-module">
              <span className="trk-silk">Tubes</span>
              <button
                type="button"
                aria-haspopup="dialog"
                title="Your tracked week as tubes of liquid or sand, or as hourglasses. Optional."
                onClick={() => setTubesOpen(true)}
              >
                Day tubes
              </button>
            </div>
            <DayTubesDialog open={tubesOpen} onOpenChange={setTubesOpen} date={date} setDate={setDate} />
            {!scrolling && span === "day" && fillControl}
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
        infiniteStrip
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
        date={date}
        onPickDate={setDate}
        locked={lockDate}
        trailing={
          <button type="button" className="trk-micro-danger trk-period-aux" onClick={() => clearDay(dk, scope.id)}>
            Clear day
          </button>
        }
      />

      {totals.tracked === 0 && <ScreenTimeEmptyHint date={dk} scopeId={scope.id} />}

      {dayGrid}

      {dayRibbon}
        </>
      )}
      </TrkPlotBezel>

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}
