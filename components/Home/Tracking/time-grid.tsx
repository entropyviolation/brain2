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
 * Day view now / sunrise / sunset are **horizontal** lines across the plot (same
 * clock as Plan agenda and the Day Log tab). Discrete events stay vertical ticks.
 * Do not remove the now line or the sunrise/sunset lines.
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { addDays, subDays } from "date-fns"
import { displayedPen, penCellStyle, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  GRID_SPANS,
  GRID_STEPS,
  MINUTES_PER_DAY,
  assignedPenIds,
  dominantEntry,
  entriesForDay,
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
import { LogActivityLatch } from "@/components/Home/Tracking/log-activity-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { WeekGrid } from "@/components/Home/Tracking/week-grid"
import { InfiniteStrip } from "@/components/Home/Tracking/infinite-strip"
import { useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { CellSizeKeys } from "@/components/Home/Tracking/cell-size-keys"
import { FillRangeControl } from "@/components/Home/Tracking/fill-range-control"
import { cellPaintClass, trackingProbeText, TrkChromeStack, TrkCrtProbe, TrkPlotBezel, TrkRibbon } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers } from "@/components/Home/Tracking/trk-time-markers"
import { useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { awakeWindowFor, useSleepSync } from "@/lib/sleep-sync"
import { useScreenTimeSync } from "@/hooks/use-screentime-sync"
import { usePenActionSync } from "@/lib/pen-action-sync"
import "./tracking-chrome.css"

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function TimeGrid({
  compact = false,
  showPalette = true,
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  compact?: boolean
  /** False when the parent already rendered `PenPalette` + `PenModeBar` + Log activity (Home Tracking). */
  showPalette?: boolean
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
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
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)
  const clearDay = useTimeTrackingStore((s) => s.clearDay)
  const prefs = useTrackingViewPrefs()

  const [internalDate, setInternalDate] = useState(() => new Date())
  const date = controlledDate ?? internalDate
  const setDate = setControlledDate ?? setInternalDate
  const dk = dateKey(date)
  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]

  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ anchor: number; head: number } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [probe, setProbe] = useState<string | null>(null)
  const [spark, setSpark] = useState<{ lo: number; hi: number } | null>(null)

  const dragRef = useRef<{ anchor: number; head: number; moved: boolean } | null>(null)
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

  const dayInstants = useMemo(
    () => (scope ? instantsForDay(entries, dk, scope.id) : []),
    [entries, dk, scope],
  )

  const map = useMemo(
    () => (scope ? minuteMap(entries, dk, scope.id) : new Array(MINUTES_PER_DAY).fill(null)),
    [entries, dk, scope],
  )

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
  const endDrag = useCallback(() => {
    const state = dragRef.current
    dragRef.current = null
    setDrag(null)
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

  const beginDrag = (minute: number) => {
    dragRef.current = { anchor: minute, head: minute, moved: false }
    setDrag({ anchor: minute, head: minute })
  }

  const extendDrag = (minute: number) => {
    const state = dragRef.current
    if (!state || state.head === minute) return
    dragRef.current = { ...state, head: minute, moved: true }
    setDrag({ anchor: state.anchor, head: minute })
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
    () => tagTotalsOf(entries.filter((e) => e.date === dk), scopes, tags, [dk]),
    [entries, dk, scopes, tags],
  )
  const awake = awakeWindowFor(dk, date)
  const startHour = firstUnpaintedWakingHour({ map, wakeMin: awake?.wake, bedMin: awake?.bed })
  const rowHeight = compact ? 20 : 24

  useLayoutEffect(() => {
    const root = gridRef.current
    if (!root) return
    const hour = startHour
    const align = () => {
      const row = root.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
      if (!row) return
      const ruler = root.querySelector(".sticky") as HTMLElement | null
      root.scrollTop = Math.max(0, row.offsetTop - (ruler?.offsetHeight ?? 0))
    }
    align()
    const id = requestAnimationFrame(align)
    return () => cancelAnimationFrame(id)
  }, [dk, awake?.wake])

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  useEffect(() => {
    if (openEntryId && !openEntry) setOpenEntryId(null)
  }, [openEntryId, openEntry])

  if (!scope) return <div className="text-sm text-muted-foreground">No tracking scopes.</div>

  const cellsPerHour = 60 / gridStep
  const rulerEvery = gridStep <= 5 ? 5 : gridStep
  const dragLo = drag ? Math.min(drag.anchor, drag.head) : -1
  const dragHi = drag ? Math.max(drag.anchor, drag.head) + gridStep : -1

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

      <TrkPlotBezel
        strip={
          <>
            <div className="trk-module">
              <span className="trk-silk">Time / Div</span>
              <div className="trk-span-switch" role="toolbar" aria-label="Time grid span">
                {GRID_SPANS.map((option) => {
                  const pressed = gridSpan === option && !infiniteScroll
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
                  aria-pressed={infiniteScroll}
                  title="Continuous time, day rows with week bands. Origin stays put when you pick a day."
                  onClick={() => setInfiniteScroll(!infiniteScroll)}
                >
                  Infinite scroll
                </button>
              </div>
            </div>
            <CellSizeKeys steps={GRID_STEPS} value={gridStep} onChange={setGridStep} />
            {!infiniteScroll && gridSpan === "day" && (
              <FillRangeControl
                dayEntries={dayEntries}
                fallbackFrom={prefs.fillFrom}
                fallbackTo={prefs.fillTo}
                selectedPenId={selectedPenId}
                penName={selectedPenId === ERASE ? "erase" : selectedPen?.name || "selected pen"}
                onFill={applyFillRange}
              />
            )}
            {!infiniteScroll && gridSpan === "day" && (
              <div className="trk-occ-well">
                <span className="trk-silk">Occupancy</span>
                <div className="trk-occ-readout">
                  <span className="trk-occ-pct">{Math.round(totals.coverage)}%</span>
                  <span className="trk-occ-tracked">{formatDuration(totals.tracked)} tracked</span>
                </div>
              </div>
            )}
            {!infiniteScroll && gridSpan === "day" && <TrkCrtProbe text={probe} />}
          </>
        }
      >
      {infiniteScroll ? (
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
      ) : gridSpan === "week" ? (
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
        data-start-hour={startHour}
        style={compact ? { maxHeight: 360 } : undefined}
        onMouseLeave={() => setProbe(null)}
      >
        <div
          className="trk-plot-paper"
          onMouseDown={(e) => {
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
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={hour}
              data-hour={hour}
              className="trk-hour-row relative flex shrink-0 items-stretch"
              style={{ height: rowHeight, minHeight: rowHeight }}
            >
              <div className="trk-hour-bezel flex items-center justify-end">
                {minutesToLabel(hour * 60)}
              </div>
              <div className="trk-plot">
                {Array.from({ length: cellsPerHour }, (_, c) => {
                  const minute = hour * 60 + c * gridStep
                  const cellEntry = dominantEntry(map, minute, gridStep)
                  const pen = cellEntry ? displayedPen(scope, cellEntry.penId) : null
                  const painted = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
                  const inDrag = minute >= dragLo && minute < dragHi
                  const onQuarter = minute % 15 === 0 && c !== 0
                  const onFive = minute % 5 === 0 && !onQuarter && c !== 0
                  const fill = inDrag
                    ? { background: selectedPenId === ERASE ? "#fca5a5" : selectedPen?.color }
                    : penCellStyle(pen, cellEntry?.precision, minute)
                  const also = cellEntry
                    ? assignedPenIds(cellEntry)
                        .slice(1)
                        .map((id) => scope.pens.find((p) => p.id === id)?.name)
                        .filter((n): n is string => Boolean(n))
                    : []
                  const sparking = Boolean(spark && minute >= spark.lo && minute < spark.hi)
                  return (
                    <div
                      key={c}
                      data-minute={minute}
                      className={cellPaintClass({
                        painted: Boolean(pen) || inDrag,
                        quarter: onQuarter,
                        five: onFive || (gridStep >= 5 && c !== 0 && !onQuarter),
                        spark: sparking,
                      })}
                      style={{
                        ...fill,
                        opacity: inDrag ? 0.75 : 1,
                      }}
                      onMouseEnter={() =>
                        setProbe(
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
                    />
                  )
                })}
                {dayInstants
                  .filter((event) => event.startMin >= hour * 60 && event.startMin < (hour + 1) * 60)
                  .map((event) => {
                    const eventPen = displayedPen(scope, event.penId)
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
                          setProbe(
                            trackingProbeText({
                              minute: event.startMin,
                              name: entryDisplayName(event, eventPen?.name),
                            }),
                          )
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenEntryId(event.id)
                        }}
                      />
                    )
                  })}
              </div>
            </div>
          ))}
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

      {dayTagTotals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground">By tag (all scopes)</span>
          {dayTagTotals.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t.color }} />
              {t.name}: <span className="font-medium">{formatDuration(t.minutes)}</span>
            </span>
          ))}
        </div>
      )}
        </>
      )}
      </TrkPlotBezel>

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}

export { dateKey as trackingDateKey, minutesToTimeString }
