/**
 * components/Home/Tracking/week-grid.tsx — Seven days at once
 *
 * The day grid answers "where did today go". This one answers the questions a
 * single column cannot: is there a routine, which days never got logged, and can
 * I fill Monday through Friday without visiting five screens.
 *
 * Nothing new is stored. A stroke here calls the same `paintMinutes` with the
 * same pen and variants, a cell click opens the same `EntryDialog`, and the
 * totals come from `lib/tracking-summary.ts` as occupancy of each day, then
 * summed — so a week's coverage cannot exceed 100% even when Sleep and Work
 * share a morning, and the week's numbers are the sum of its days by
 * construction rather than by agreement.
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
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { displayedPen, penCellStyle, useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
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
import { useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import { firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { cellPaintClass, trackingProbeText, TrkCrtProbe, TrkRibbon } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers, useTrackingSunMap } from "@/components/Home/Tracking/trk-time-markers"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { runAsAction } from "@/lib/action-history"
import "./tracking-chrome.css"

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
  const clearDay = useTimeTrackingStore((s) => s.clearDay)

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const prefs = useTrackingViewPrefs()

  const [rangeFrom, setRangeFrom] = useState(prefs.weekFillFrom)
  const [rangeTo, setRangeTo] = useState(prefs.weekFillTo)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [probe, setProbe] = useState<string | null>(null)

  const dragRef = useRef<(Drag & { moved: boolean }) | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => getWeekDates(getWeekStartDate(date)), [date])
  const dateKeys = useMemo(() => days.map(formatLocalDateKey), [days])
  const todayKey = formatLocalDateKey(now)
  const { nowMinute } = useTrackingDayMarkers(date)
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

  const maps = useMemo(() => {
    const byDay: Record<string, (TimeEntry | null)[]> = {}
    for (const key of dateKeys) byDay[key] = scope ? minuteMap(entries, key, scope.id) : []
    return byDay
  }, [dateKeys, entries, scope])

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
    const hour = startHour
    const align = () => {
      const row = root.querySelector(`[data-hour="${hour}"]`) as HTMLElement | null
      if (!row) return
      const heading = root.querySelector(".sticky") as HTMLElement | null
      root.scrollTop = Math.max(0, row.offsetTop - (heading?.offsetHeight ?? 0))
    }
    align()
    const id = requestAnimationFrame(align)
    return () => cancelAnimationFrame(id)
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
    const existing = maps[state.day]?.[state.anchor]
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
    const el = target as HTMLElement | null
    const day = el?.dataset?.day
    const raw = el?.dataset?.minute
    if (!day || raw == null) return null
    const minute = Number(raw)
    return Number.isFinite(minute) ? { day, minute } : null
  }

  const beginDrag = (cell: { day: string; minute: number }) => {
    dragRef.current = { day: cell.day, anchor: cell.minute, head: cell.minute, moved: false }
    setDrag({ day: cell.day, anchor: cell.minute, head: cell.minute })
  }

  const extendDrag = (cell: { day: string; minute: number }) => {
    const state = dragRef.current
    // A stroke stays in its own column: a diagonal drag means a longer block on
    // one day, never the same block on two.
    if (!state || state.day !== cell.day || state.head === cell.minute) return
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

  const rows = MINUTES_PER_DAY / weekStep
  const rowHeight = compact ? 10 : weekStep === 60 ? 22 : weekStep === 30 ? 14 : 9
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
          <input
            id="week-from"
            type="time"
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
          />
        </label>
        <label className="trk-field">
          <span className="trk-field-label">To</span>
          <input
            id="week-to"
            type="time"
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
          />
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
        data-start-hour={startHour}
        style={{ maxHeight: compact ? 360 : 620 }}
        onMouseLeave={() => setProbe(null)}
      >
        <div
          className="min-w-[640px]"
          onMouseDown={(e) => {
            const cell = cellFromEvent(e.target)
            if (!cell) return
            if (selectedPenId === null) {
              const existing = maps[cell.day]?.[cell.minute]
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            beginDrag(cell)
          }}
          onMouseOver={(e) => {
            if (!dragRef.current) return
            const cell = cellFromEvent(e.target)
            if (cell) extendDrag(cell)
          }}
          onTouchStart={(e) => {
            const cell = cellFromEvent(e.target)
            if (!cell) return
            if (selectedPenId === null) {
              const existing = maps[cell.day]?.[cell.minute]
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            beginDrag(cell)
          }}
          onTouchMove={(e) => {
            if (!dragRef.current) return
            e.preventDefault()
            const touch = e.touches[0]
            if (!touch) return
            const cell = cellFromEvent(document.elementFromPoint(touch.clientX, touch.clientY))
            if (cell) extendDrag(cell)
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

          {/* ---- rows ---- */}
          {Array.from({ length: rows }, (_, r) => {
            const minute = r * weekStep
            const onHour = minute % 60 === 0
            return (
              <div
                key={r}
                data-hour={onHour ? minute / 60 : undefined}
                className={`trk-hour-row flex items-stretch ${onHour ? "trk-cell-quarter" : "trk-cell-tick"}`}
                style={{ height: rowHeight }}
              >
                <div className="trk-hour-bezel flex items-center justify-end" style={{ width: 48, fontSize: 9 }}>
                  {onHour ? minutesToLabel(minute) : ""}
                </div>
                {dateKeys.map((key) => {
                  const cellEntry = dominantEntry(maps[key] ?? [], minute, weekStep)
                  const pen = cellEntry ? displayedPen(scope, cellEntry.penId) : null
                  const painted = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
                  const inDrag = drag?.day === key && minute >= dragLo && minute < dragHi
                  return (
                    <div
                      key={key}
                      data-day={key}
                      data-minute={minute}
                      className={cellPaintClass({ painted: Boolean(pen) || inDrag })}
                      style={{
                        ...((() => {
                          if (inDrag) return { background: selectedPenId === ERASE ? "#fca5a5" : selectedPen?.color }
                          return penCellStyle(pen, cellEntry?.precision, minute)
                        })()),
                        opacity: inDrag ? 0.75 : 1,
                      }}
                      onMouseEnter={() =>
                        setProbe(
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
          })}
        </div>
        <TrkCrtProbe text={probe} />
      </div>

      <div className="trk-ribbon-legend">
        {days.map((day) => {
          const key = formatLocalDateKey(day)
          return (
            <span key={key}>
              {day.toLocaleDateString(undefined, { weekday: "short" })}{" "}
              <span className="tabular-nums">{formatDuration(dayTotals[key] ?? 0)}</span>
              {dayTotals[key] > 0 && (
                <button
                  type="button"
                  onClick={() => clearDay(key, scope.id)}
                  aria-label={`Clear ${day.toLocaleDateString(undefined, { weekday: "long" })}`}
                  title="Clear this day in this scope"
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
      </div>

      <TrkRibbon pens={pens} untracked={totals.untracked} />

      {weekTagTotals.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-muted-foreground">By tag (all scopes)</span>
          {weekTagTotals.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: t.color }} />
              {t.name}: <span className="font-medium">{formatDuration(t.minutes)}</span>
            </span>
          ))}
        </div>
      )}

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}
