/**
 * components/Home/Tracking/week-grid.tsx — Seven days at once
 *
 * The day grid answers "where did today go". This one answers the questions a
 * single column cannot: is there a routine, which days never got logged, and can
 * I fill Monday through Friday without visiting five screens.
 *
 * Nothing new is stored. A stroke here calls the same `paintMinutes` with the
 * same pen and variants. A click on a cell that already shows a block opens
 * the same `EntryDialog` the day grid opens, even while a pen is selected;
 * empty time still paints. Totals come from `lib/tracking-summary.ts` as
 * occupancy of each day, then summed — so a week's coverage cannot exceed 100%
 * even when Sleep and Work share a morning, and the week's numbers are the
 * sum of its days by construction rather than by agreement.
 *
 * Three things make a week's worth of cells usable rather than merely dense:
 *
 * - **A stroke belongs to one day.** Dragging sideways across columns would mean
 *   "9 to 5 on Tuesday and also on Wednesday", which is never what a diagonal
 *   drag was meant to say, so the stroke stays in the column it started in.
 * - **Range fill takes days.** Type 9:00–17:00, tick Mon–Fri, and one press
 *   paints five blocks. This is the week view's reason to exist: catching up on
 *   a routine is bulk work, and doing it by hand is why tracking gets abandoned.
 * - **Cells are 15 minutes at the finest.** A minute-resolution week is 1440
 *   rows of nothing; anything finer than a quarter hour is a job for the day
 *   grid or the block editor, both one click away.
 * - **Only the rows in view are mounted.** Same window as the day grid's hours:
 *   the scrollport, one row above, two below. Spacers keep the day the same
 *   height, so a row that scrolls in is still the cell it always was.
 *
 * A merged run shows one `.trk-block-label` on its first cell (display name,
 * else the pen). Later rows stay quiet, and the label does not take the click.
 * On today's column, cells after now wear `.trk-future`. Other days do not.
 */
"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { displayedPen, penCellStyle, useTimeTrackingStore, type TimeEntry, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { penNameById, scopeTicksWithDiscreteLogs, tickPen } from "@/components/Home/Tracking/discrete-log-instants"
import { strokeCellStyle } from "@/components/Home/Tracking/grid-stroke"
import {
  MINUTES_PER_DAY,
  WEEK_STEPS,
  dominantEntry,
  formatDuration,
  minuteMap,
  minutesToLabel,
  timeStringToMinutes,
  entryDisplayName,
} from "@/lib/time-entries"
import { entriesInRange, penTotals, tagTotals as tagTotalsOf, totalsFor, uniqueMinutesByDate } from "@/lib/tracking-summary"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { ERASE, SCISSORS } from "@/components/Home/Tracking/pen-palette"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { useSuperimposeScope, useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { focusTrackingPlot } from "@/components/Home/Tracking/tracking-undo"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { cellPaintClass, SuperimposeWash, trackingProbeText, TrkBlockLabel, TrkProbePlate, TrkRibbon, TrkTagStrip, writeTrkProbe } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingSunMap, type TrackingSunTimes } from "@/components/Home/Tracking/trk-time-markers"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { WeekSummaryNest } from "@/components/Home/Tracking/tracking-summaries"
import { runAsAction } from "@/lib/action-history"
import "./tracking-chrome.css"

/**
 * Week rows are only a few pixels tall, so a click often slips into the next
 * cell. That slip is still a click. A stroke that actually travels paints.
 */
const CLICK_SLOP_PX = 6

/**
 * Visible week rows, plus the day grid's hour overscan (one above, two below).
 * A zero-height scrollport mounts the whole day — jsdom, and the first measure
 * before the plot has a box. Stored minutes are untouched; this only picks nodes.
 */
export function weekRowBand(
  scrollTop: number,
  clientHeight: number,
  rowHeight: number,
  rowCount: number,
): { start: number; end: number } {
  if (clientHeight <= 0 || rowHeight <= 0 || rowCount <= 0) return { start: 0, end: rowCount }
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 1)
  const end = Math.min(rowCount, Math.ceil((scrollTop + clientHeight) / rowHeight) + 2)
  return { start, end }
}

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

interface WeekSlot {
  byDay: Record<string, TimeEntry | null>
  overlay: Record<string, TimeEntry | null>
}

interface WeekMinuteProps {
  minute: number
  rowHeight: number
  weekStep: number
  dateKeys: string[]
  slot: WeekSlot
  strokeLo: number
  strokeHi: number
  strokeDay: string
  scope: TrackScope
  scopes: readonly TrackScope[]
  overlayScope?: TrackScope
  selectedPenId: string | null
  selectedPen: TrackPen | null
  todayKey: string
  nowMinute: number | null
  sunByDate: Record<string, TrackingSunTimes>
  instants: Record<string, TimeEntry[]>
  onOpenInstant: (id: string) => void
  onProbe: (text: string | null) => void
}

function weekMinutePropsEqual(prev: WeekMinuteProps, next: WeekMinuteProps): boolean {
  if (prev.minute !== next.minute) return false
  if (prev.rowHeight !== next.rowHeight) return false
  if (prev.weekStep !== next.weekStep) return false
  if (prev.dateKeys !== next.dateKeys) return false
  if (prev.slot !== next.slot) return false
  if (prev.scope !== next.scope) return false
  if (prev.scopes !== next.scopes) return false
  if (prev.overlayScope !== next.overlayScope) return false
  if (prev.selectedPenId !== next.selectedPenId) return false
  if (prev.selectedPen !== next.selectedPen) return false
  if (prev.todayKey !== next.todayKey) return false
  if (prev.nowMinute !== next.nowMinute) return false
  if (prev.sunByDate !== next.sunByDate) return false
  if (prev.instants !== next.instants) return false
  if (prev.onOpenInstant !== next.onOpenInstant) return false
  if (prev.onProbe !== next.onProbe) return false
  const rowLo = prev.minute
  const rowHi = prev.minute + prev.weekStep
  if (prev.strokeDay !== next.strokeDay) {
    const prevHit = prev.strokeDay !== "" && prev.minute >= prev.strokeLo && prev.minute < prev.strokeHi
    const nextHit = next.strokeDay !== "" && next.minute >= next.strokeLo && next.minute < next.strokeHi
    return !prevHit && !nextHit
  }
  return strokeOverlapUnchanged(prev.strokeLo, prev.strokeHi, next.strokeLo, next.strokeHi, rowLo, rowHi)
}

const WeekMinuteRow = memo(function WeekMinuteRow({
  minute,
  rowHeight,
  weekStep,
  dateKeys,
  slot,
  strokeLo,
  strokeHi,
  strokeDay,
  scope,
  scopes,
  overlayScope,
  selectedPenId,
  selectedPen,
  todayKey,
  nowMinute,
  sunByDate,
  instants,
  onOpenInstant,
  onProbe,
}: WeekMinuteProps) {
  const onHour = minute % 60 === 0
  return (
    <div
      data-hour={onHour ? minute / 60 : undefined}
      className={`trk-hour-row flex items-stretch ${onHour ? "trk-cell-quarter" : "trk-cell-tick"}`}
      style={{ height: rowHeight }}
    >
      <div className="trk-hour-bezel flex items-center justify-end" style={{ width: 48, fontSize: 9 }}>
        {onHour ? minutesToLabel(minute) : ""}
      </div>
      {dateKeys.map((key) => {
        const cellEntry = slot.byDay[key] ?? null
        const pen = cellEntry ? displayedPen(scope, cellEntry.penId) : null
        const painted = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
        const inDrag = strokeDay === key && minute >= strokeLo && minute < strokeHi
        const erasing = selectedPenId === ERASE
        const strokePen = !erasing && selectedPen ? displayedPen(scope, selectedPen.id) ?? selectedPen : null
        const inStroke = inDrag && selectedPenId !== SCISSORS
        const overlayEntry = slot.overlay[key] ?? null
        const overlayPen = overlayEntry && overlayScope ? displayedPen(overlayScope, overlayEntry.penId) : null
        const futureCell = key === todayKey && nowMinute != null && minute > nowMinute
        const runStarts =
          cellEntry != null && cellEntry.startMin >= minute && cellEntry.startMin < minute + weekStep
        const runColor = runStarts ? pen?.color || painted?.color : undefined
        return (
          <div
            key={key}
            data-day={key}
            data-minute={minute}
            className={`${cellPaintClass({ painted: Boolean(pen) || (inDrag && !erasing) })} relative${futureCell ? " trk-future" : ""}`}
            style={strokeCellStyle({
              inStroke,
              erasing,
              samePen: Boolean(cellEntry && selectedPen && cellEntry.penId === selectedPen.id),
              existing: penCellStyle(pen, cellEntry?.precision, minute),
              incoming: penCellStyle(strokePen, undefined, minute),
            })}
            onMouseEnter={() =>
              onProbe(
                trackingProbeText({
                  minute,
                  step: weekStep,
                  name: cellEntry ? entryDisplayName(cellEntry, painted?.name || pen?.name) : undefined,
                  leafName: painted && painted.id !== pen?.id ? painted.name : undefined,
                  assumed: cellEntry?.precision === "estimated",
                }),
              )
            }
          >
            {overlayPen && !inStroke ? <SuperimposeWash color={overlayPen.color} /> : null}
            {cellEntry && runColor ? (
              <TrkBlockLabel
                name={entryDisplayName(cellEntry, pen?.name || painted?.name)}
                color={runColor}
                left={0}
                width={100}
              />
            ) : null}
            {(instants[key] ?? [])
              .filter((event) => event.startMin >= minute && event.startMin < minute + weekStep)
              .map((event) => {
                const eventPen = tickPen(scopes, scope, event.penId)
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="trk-instant trk-instant-week"
                    aria-label={`${minutesToLabel(event.startMin)} · ${entryDisplayName(event, eventPen?.name)}`}
                    style={{
                      top: `${((event.startMin - minute) / weekStep) * 100}%`,
                      background: eventPen?.color,
                    }}
                    onMouseDown={(eventClick) => eventClick.stopPropagation()}
                    onClick={(eventClick) => {
                      eventClick.stopPropagation()
                      onOpenInstant(event.id)
                    }}
                  />
                )
              })}
            <TrkPlotMarkers
              origin={minute}
              span={weekStep}
              axis="y"
              nowMinute={key === todayKey ? nowMinute : null}
              sun={sunByDate[key] ?? null}
            />
          </div>
        )
      })}
    </div>
  )
}, weekMinutePropsEqual)

interface WeekGridProps {
  /** Any day inside the week to show. Shared with the day grid, so switching spans keeps your place. */
  date: Date
  onDateChange: (date: Date) => void
  /** Open one day in the day grid — the way out of the week when a cell is too coarse. */
  onOpenDay?: (date: Date) => void
  compact?: boolean
}

interface Drag {
  day: string
  anchor: number
  head: number
}

export function WeekGrid({ date, onDateChange, onOpenDay, compact = false }: WeekGridProps) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const entries = useTimeTrackingStore((s) => s.entries)
  const weekStep = useTimeTrackingStore((s) => s.weekStep)
  const setWeekStep = useTimeTrackingStore((s) => s.setWeekStep)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const prefs = useTrackingViewPrefs()
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])
  const overlayScopeId = useSuperimposeScope(scope?.id, scopeIds)
  const overlayScope = scopes.find((s) => s.id === overlayScopeId)

  const [rangeFrom, setRangeFrom] = useState(prefs.weekFillFrom)
  const [rangeTo, setRangeTo] = useState(prefs.weekFillTo)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [now, setNow] = useState(() => new Date())
  const probeRef = useRef<HTMLDivElement>(null)
  const writeProbe = useCallback((text: string | null) => writeTrkProbe(probeRef.current, text), [])

  const dragRef = useRef<(Drag & { moved: boolean; originY: number | null }) | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const aligning = useRef(false)
  const rowCount = MINUTES_PER_DAY / weekStep
  const rowHeight = compact ? 10 : weekStep === 60 ? 22 : weekStep === 30 ? 14 : 9
  const [rowBand, setRowBand] = useState({ start: 0, end: 0 })

  const publishRowBand = useCallback((scrollTop: number, clientHeight: number) => {
    const next = weekRowBand(scrollTop, clientHeight, rowHeight, rowCount)
    setRowBand((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
  }, [rowHeight, rowCount])
  const layoutRef = useRef({ rowHeight, weekStep, publishRowBand })
  layoutRef.current = { rowHeight, weekStep, publishRowBand }

  const days = useMemo(() => getWeekDates(getWeekStartDate(date)), [date])
  const dateKeys = useMemo(() => days.map(formatLocalDateKey), [days])
  const todayKey = formatLocalDateKey(now)
  const nowMinute = dateKeys.includes(todayKey) ? now.getHours() * 60 + now.getMinutes() : null
  const sunByDate = useTrackingSunMap(dateKeys)

  // Fill defaults to the day you are looking at rather than the whole week: a
  // mistyped range should cost one day, not seven. Cmd/Ctrl-Z then reverses the
  // fill as a single step, however many days were ticked.
  const [fillDays, setFillDays] = useState<string[]>([formatLocalDateKey(date)])
  useEffect(() => {
    setFillDays((current) => {
      const kept = current.filter((key) => dateKeys.includes(key))
      return kept.length ? kept : [dateKeys.includes(formatLocalDateKey(date)) ? formatLocalDateKey(date) : dateKeys[0]]
    })
  }, [dateKeys, date])

  useEffect(() => {
    setRangeFrom(prefs.weekFillFrom)
    setRangeTo(prefs.weekFillTo)
  }, [prefs.weekFillFrom, prefs.weekFillTo])

  const weekEntries = useMemo(
    () => (scope ? entriesInRange(entries, dateKeys, scope.id) : []),
    [entries, dateKeys, scope],
  )

  const penNames = useMemo(() => penNameById(scopes), [scopes])
  const instants = useMemo(() => {
    const byDay: Record<string, TimeEntry[]> = {}
    for (const key of dateKeys) {
      byDay[key] = scope ? scopeTicksWithDiscreteLogs(entries, key, scope.id, penNames) : []
    }
    return byDay
  }, [dateKeys, entries, scope, penNames])

  const maps = useMemo(() => {
    const byDay: Record<string, (TimeEntry | null)[]> = {}
    for (const key of dateKeys) byDay[key] = scope ? minuteMap(entries, key, scope.id) : []
    return byDay
  }, [dateKeys, entries, scope])

  const overlayMaps = useMemo(() => {
    const byDay: Record<string, (TimeEntry | null)[]> = {}
    if (!overlayScope) return byDay
    for (const key of dateKeys) byDay[key] = minuteMap(entries, key, overlayScope.id)
    return byDay
  }, [dateKeys, entries, overlayScope])

  const slots = useMemo(() => {
    const out: WeekSlot[] = []
    for (let r = rowBand.start; r < rowBand.end; r++) {
      const minute = r * weekStep
      const byDay: Record<string, TimeEntry | null> = {}
      const overlay: Record<string, TimeEntry | null> = {}
      for (const key of dateKeys) {
        byDay[key] = dominantEntry(maps[key] ?? [], minute, weekStep)
        overlay[key] = overlayMaps[key] ? dominantEntry(overlayMaps[key], minute, weekStep) : null
      }
      out.push({ byDay, overlay })
    }
    return out
  }, [maps, overlayMaps, dateKeys, weekStep, rowBand.start, rowBand.end])

  const dayTotals = useMemo(() => {
    const covered = uniqueMinutesByDate(weekEntries)
    const totals: Record<string, number> = {}
    for (const key of dateKeys) totals[key] = covered[key] ?? 0
    return totals
  }, [dateKeys, weekEntries])

  const focusKey = formatLocalDateKey(date)
  const awake = awakeWindowFor(focusKey, date)
  const startHour = firstUnpaintedWakingHour({
    map: maps[focusKey] ?? [],
    wakeMin: awake?.wake,
    bedMin: awake?.bed,
  })

  useLayoutEffect(() => {
    const root = gridRef.current
    if (!root) return
    publishRowBand(root.scrollTop, root.clientHeight)
  }, [publishRowBand])

  useLayoutEffect(() => {
    const root = gridRef.current
    if (!root) return
    const hour = startHour
    const align = () => {
      const { rowHeight: height, weekStep: step, publishRowBand: publish } = layoutRef.current
      const row = root.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
      const heading = root.querySelector(".sticky") as HTMLElement | null
      const rowIndex = Math.floor((hour * 60) / step)
      const top = row
        ? Math.max(0, row.offsetTop - (heading?.offsetHeight ?? 0))
        : rowIndex * height
      aligning.current = true
      root.scrollTop = top
      aligning.current = false
      publish(root.scrollTop, root.clientHeight)
    }
    align()
    const id = requestAnimationFrame(align)
    return () => cancelAnimationFrame(id)
    // The day and the wake time move the scroll. A stroke does not, so startHour
    // stays the value from this run; row size is read live from layoutRef.
  }, [focusKey, awake?.wake])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const commitPaint = useCallback(
    (day: string, from: number, to: number) => {
      if (!scope || selectedPenId === null) return
      paintMinutes(
        day,
        scope.id,
        Math.min(from, to),
        Math.max(from, to),
        selectedPenId === ERASE ? null : selectedPenId,
        selectedVariantIds,
      )
    },
    [scope, selectedPenId, selectedVariantIds, paintMinutes],
  )

  // Resolved on release, so one stroke is one block rather than a run of
  // adjacent cells that merge back together afterwards.
  const endDrag = useCallback(() => {
    const state = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!state) return
    const lo = Math.min(state.anchor, state.head)
    const hi = Math.min(MINUTES_PER_DAY, Math.max(state.anchor, state.head) + weekStep)
    if (selectedPenId === SCISSORS) {
      const existing = maps[state.day]?.[state.anchor]
      if (existing) splitEntryAt(existing.id, state.anchor)
      return
    }
    if (state.moved) {
      commitPaint(state.day, lo, hi)
      return
    }
    // The block the cell is painted with — not only the entry on its first
    // minute. A block that starts mid-cell still owns the click, so the pen
    // in hand opens it instead of painting over it. Same rule as the day grid.
    const existing = dominantEntry(maps[state.day] ?? [], state.anchor, weekStep)
    if (existing && selectedPenId !== ERASE) setOpenEntryId(existing.id)
    else if (selectedPenId !== null) commitPaint(state.day, state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + weekStep))
  }, [commitPaint, maps, selectedPenId, weekStep, splitEntryAt])

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

  const cellFromEvent = (target: EventTarget | null): { day: string; minute: number } | null => {
    const start = target instanceof Element ? target : null
    const el = start?.closest("[data-day][data-minute]")
    if (!(el instanceof HTMLElement)) return null
    const day = el.dataset.day
    const raw = el.dataset.minute
    if (!day || raw == null) return null
    const minute = Number(raw)
    return Number.isFinite(minute) ? { day, minute } : null
  }

  const blockOnCell = (day: string, minute: number) => dominantEntry(maps[day] ?? [], minute, weekStep)

  const beginDrag = (cell: { day: string; minute: number }, originY: number | null) => {
    dragRef.current = { day: cell.day, anchor: cell.minute, head: cell.minute, moved: false, originY }
    setDrag({ day: cell.day, anchor: cell.minute, head: cell.minute })
  }

  const extendDrag = (cell: { day: string; minute: number }, pointerY: number | null) => {
    const state = dragRef.current
    // A stroke stays in its own column: a diagonal drag means a longer block on
    // one day, never the same block on two.
    if (!state || state.day !== cell.day || state.head === cell.minute) return
    const steps = Math.abs(cell.minute - state.anchor) / weekStep
    const slipped =
      pointerY != null &&
      state.originY != null &&
      steps <= 1 &&
      Math.abs(pointerY - state.originY) < CLICK_SLOP_PX
    if (slipped) return
    dragRef.current = { ...state, head: cell.minute, moved: true }
    setDrag({ day: state.day, anchor: state.anchor, head: cell.minute })
  }

  const applyTypedRange = () => {
    const from = timeStringToMinutes(rangeFrom)
    const parsedTo = timeStringToMinutes(rangeTo)
    if (from === null || parsedTo === null) return
    runAsAction("fill days", () => {
      for (const day of fillDays) {
        if (!scope || selectedPenId === null) return
        paintMinutes(
          day,
          scope.id,
          from,
          parsedTo,
          selectedPenId === ERASE ? null : selectedPenId,
          selectedVariantIds,
        )
      }
    })
  }

  const pens = useMemo(() => penTotals(weekEntries, scope, dateKeys), [weekEntries, scope, dateKeys])
  const totals = useMemo(() => totalsFor(weekEntries, dateKeys), [weekEntries, dateKeys])
  const weekTagTotals = useMemo(
    () => tagTotalsOf(entries.filter((e) => dateKeys.includes(e.date)), scopes, tags, dateKeys),
    [entries, dateKeys, scopes, tags],
  )

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  useEffect(() => {
    if (openEntryId && !openEntry) setOpenEntryId(null)
  }, [openEntryId, openEntry])

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const dragLo = drag ? Math.min(drag.anchor, drag.head) : -1
  const dragHi = drag ? Math.max(drag.anchor, drag.head) + weekStep : -1
  const selectedPen = scope.pens.find((p) => p.id === selectedPenId) ?? null
  const shift = (weeks: number) => onDateChange(new Date(days[0].getTime() + weeks * 7 * 864e5))

  return (
    <div className="trk95 trk-canvas select-none">
      <TrackingPeriodNav
        label={`${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
        previousLabel="Previous week"
        nextLabel="Next week"
        onPrevious={() => shift(-1)}
        onNext={() => shift(1)}
        onToday={() => onDateChange(new Date())}
        meta={`${formatDuration(totals.tracked)} tracked · ${Math.round(totals.coverage)}% of the week · ${totals.daysWithData} of 7 days logged`}
        trailing={
          <div className="trk-module-keys" role="group" aria-label="Week cell size">
            {WEEK_STEPS.map((step) => (
              <button key={step} type="button" aria-pressed={weekStep === step} onClick={() => setWeekStep(step)}>
                {step}m
              </button>
            ))}
          </div>
        }
      />

      {totals.tracked === 0 && <ScreenTimeEmptyHint date={formatLocalDateKey(date)} scopeId={scope.id} />}

      <div className="trk-fill-row">
        <label className="trk-field">
          <span className="trk-field-label">From</span>
          <ClockPicker id="week-from" value={rangeFrom} onChange={setRangeFrom} />
        </label>
        <label className="trk-field">
          <span className="trk-field-label">To</span>
          <ClockPicker id="week-to" value={rangeTo} onChange={setRangeTo} />
        </label>
        <div className="trk-field">
          <span className="trk-field-label">On</span>
          <div className="trk-module-keys">
            {days.map((day) => {
              const key = formatLocalDateKey(day)
              const on = fillDays.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFillDays((current) => (on ? current.filter((d) => d !== key) : [...current, key]))}
                  aria-pressed={on}
                  aria-label={`Fill ${day.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}`}
                  className="trk-micro"
                >
                  {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                </button>
              )
            })}
            <button type="button" onClick={() => setFillDays(dateKeys.filter((_, i) => i < 5))}>
              Mon–Fri
            </button>
            <button type="button" onClick={() => setFillDays(dateKeys)}>
              All 7
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={applyTypedRange}
          disabled={selectedPenId === null || fillDays.length === 0}
        >
          {`Fill ${fillDays.length} ${fillDays.length === 1 ? "day" : "days"} with ${
            selectedPenId === ERASE ? "erase" : selectedPen?.name || "selected pen"
          }`}
        </button>
      </div>

      <div
        ref={gridRef}
        className="trk-grid trk-week-plot"
        tabIndex={-1}
        data-start-hour={startHour}
        data-superimpose={overlayScope?.id || undefined}
        style={{ maxHeight: compact ? 360 : 620 }}
        onMouseLeave={() => writeProbe(null)}
        onScroll={() => {
          if (aligning.current) return
          const root = gridRef.current
          if (!root) return
          publishRowBand(root.scrollTop, root.clientHeight)
        }}
      >
        <div
          className="min-w-[640px]"
          onMouseDown={(e) => {
            focusTrackingPlot(gridRef.current)
            const cell = cellFromEvent(e.target)
            if (!cell) return
            if (selectedPenId === null) {
              const existing = blockOnCell(cell.day, cell.minute)
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            beginDrag(cell, e.clientY)
          }}
          onMouseOver={(e) => {
            if (!dragRef.current) return
            const cell = cellFromEvent(e.target)
            if (cell) extendDrag(cell, e.clientY)
          }}
          onTouchStart={(e) => {
            focusTrackingPlot(gridRef.current)
            const cell = cellFromEvent(e.target)
            if (!cell) return
            if (selectedPenId === null) {
              const existing = blockOnCell(cell.day, cell.minute)
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            const touch = e.touches[0]
            beginDrag(cell, touch?.clientY ?? null)
          }}
          onTouchMove={(e) => {
            if (!dragRef.current) return
            e.preventDefault()
            const touch = e.touches[0]
            if (!touch) return
            const cell = cellFromEvent(document.elementFromPoint(touch.clientX, touch.clientY))
            if (cell) extendDrag(cell, touch.clientY)
          }}
        >
          {/* ---- day headings ---- */}
          <div className="trk-time-axis sticky top-0 z-20 flex items-stretch">
            <div className="trk-hour-bezel" style={{ width: 48 }} />
            {days.map((day) => {
              const key = formatLocalDateKey(day)
              const isToday = key === todayKey
              return (
                <div key={key} className="flex-1 border-l px-1 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenDay?.(day)}
                    aria-label={`Open ${day.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}`}
                    className={`block w-full text-xs ${isToday ? "font-semibold" : ""}`}
                    style={isToday ? { color: "#000080" } : undefined}
                    title={`Open ${day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} on its own`}
                  >
                    {day.toLocaleDateString(undefined, { weekday: "short" })} {day.getDate()}
                  </button>
                  <span className="block text-[10px] tabular-nums">
                    {dayTotals[key] ? formatDuration(dayTotals[key]) : "—"}
                  </span>
                </div>
              )
            })}
          </div>

          {rowBand.start > 0 ? (
            <div data-week-spacer="" aria-hidden style={{ height: rowBand.start * rowHeight }} />
          ) : null}
          {slots.map((slot, index) => {
            const minute = (rowBand.start + index) * weekStep
            return (
              <WeekMinuteRow
                key={minute}
                minute={minute}
                rowHeight={rowHeight}
                weekStep={weekStep}
                dateKeys={dateKeys}
                slot={slot}
                strokeLo={dragLo}
                strokeHi={dragHi}
                strokeDay={drag?.day ?? ""}
                scope={scope}
                scopes={scopes}
                overlayScope={overlayScope}
                selectedPenId={selectedPenId}
                selectedPen={selectedPen}
                todayKey={todayKey}
                nowMinute={nowMinute}
                sunByDate={sunByDate}
                instants={instants}
                onOpenInstant={setOpenEntryId}
                onProbe={writeProbe}
              />
            )
          })}
          {rowBand.end < rowCount ? (
            <div data-week-spacer="" aria-hidden style={{ height: (rowCount - rowBand.end) * rowHeight }} />
          ) : null}
        </div>
        <TrkProbePlate nodeRef={probeRef} />
      </div>

      <div className="trk-ribbon-legend">
        {days.map((day) => {
          const key = formatLocalDateKey(day)
          return (
            <span key={key}>
              {day.toLocaleDateString(undefined, { weekday: "short" })}{" "}
              <span className="tabular-nums">{formatDuration(dayTotals[key] ?? 0)}</span>
            </span>
          )
        })}
      </div>

      <WeekSummaryNest anchor={date} gutter="time" />

      <TrkRibbon pens={pens} untracked={totals.untracked} />

      <TrkTagStrip tags={weekTagTotals} />

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}
