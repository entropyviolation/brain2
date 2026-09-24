/**
 * components/Home/Tracking/infinite-strip.tsx — Continuous days, time across
 *
 * The paged grid stands hours as rows. This view rotates that 90° counterclockwise:
 * clock time runs left to right, days stack and touch, so you can scroll back as
 * far as you like and the hour labels stay put. The Time Grid **Infinite scroll**
 * control always uses week mode — day-scale rows with week bands — so there is
 * one continuous looking, not two half modes.
 *
 * Origin is frozen at mount. A single click on a day gutter only highlights
 * it — it does not rebuild the list. Double-click a day gutter to open the
 * paged day grid on that date; double-click a week band to open the paged
 * week. Entries are indexed by date once; only the virtual window gets cells.
 * Prepend restores scrollTop so the top sentinel cannot twitch.
 */
"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { displayedPen, penCellStyle, useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  MINUTES_PER_DAY,
  dominantEntry,
  entryDisplayName,
  instantsForDay,
  minuteMap,
  minutesToLabel,
} from "@/lib/time-entries"
import { formatLocalDateKey } from "@/lib/date-utils"
import { ERASE, SCISSORS } from "@/components/Home/Tracking/pen-palette"
import { cellPaintClass, trackingProbeText, TrkCrtProbe } from "@/components/Home/Tracking/trk-instrument"
import { TrkPlotMarkers, useTrackingDayMarkers, useTrackingSunMap } from "@/components/Home/Tracking/trk-time-markers"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import {
  INFINITE_DAY_AFTER,
  INFINITE_DAY_BEFORE,
  INFINITE_MAX_AFTER,
  INFINITE_MAX_BEFORE,
  INFINITE_OVERSCAN_PX,
  INFINITE_WEEK_AFTER,
  INFINITE_WEEK_BEFORE,
  daysInRange,
  indexScopeEntriesByDate,
  infiniteCellStep,
  prefixHeights,
  restoreScrollAfterPrepend,
  startOfDay,
  stripItems,
  visibleSlice,
  type StripMode,
} from "@/components/Home/Tracking/infinite-window"
import "./tracking-chrome.css"

export function InfiniteStrip({
  centerDate,
  onDateChange,
  onOpenDay,
  onOpenWeek,
  mode,
  compact = false,
}: {
  centerDate: Date
  onDateChange: (date: Date) => void
  /** Double-click a left day tile — leave Infinite for the paged day grid. */
  onOpenDay?: (date: Date) => void
  /** Double-click a week band — leave Infinite for the paged week grid. */
  onOpenWeek?: (date: Date) => void
  mode: StripMode
  compact?: boolean
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const gridStep = useTimeTrackingStore((s) => s.gridStep)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const splitEntryAt = useTimeTrackingStore((s) => s.splitEntryAt)

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const originRef = useRef(startOfDay(centerDate))
  const origin = originRef.current
  const [before, setBefore] = useState(mode === "week" ? INFINITE_WEEK_BEFORE : INFINITE_DAY_BEFORE)
  const [after, setAfter] = useState(mode === "week" ? INFINITE_WEEK_AFTER : INFINITE_DAY_AFTER)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ date: string; anchor: number; head: number } | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(compact ? 360 : 560)
  const [probe, setProbe] = useState<string | null>(null)

  const liveDrag = useRef<{ date: string; anchor: number; head: number; moved: boolean } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const bottomSentinel = useRef<HTMLDivElement>(null)
  const extending = useRef(false)
  const aligned = useRef(false)

  const dayH = compact ? 28 : 36
  const bandH = 20
  const step = infiniteCellStep(gridStep)
  const cells = MINUTES_PER_DAY / step
  const selectedPen = scope?.pens.find((p) => p.id === selectedPenId) ?? null
  const centerKey = formatLocalDateKey(centerDate)
  const todayKey = formatLocalDateKey(new Date())
  const { nowMinute } = useTrackingDayMarkers(new Date())
  const originKey = formatLocalDateKey(origin)

  const days = useMemo(() => daysInRange(origin, before, after), [origin, before, after])
  const dayKeys = useMemo(() => days.map((d) => formatLocalDateKey(d)), [days])
  const sunByDate = useTrackingSunMap(dayKeys)
  const items = useMemo(() => stripItems(days, mode), [days, mode])
  const prefix = useMemo(() => prefixHeights(items, dayH, bandH), [items, dayH, bandH])
  const vis = useMemo(
    () => visibleSlice(prefix, scrollTop, viewportH, INFINITE_OVERSCAN_PX),
    [prefix, scrollTop, viewportH],
  )
  const visibleItems = items.slice(vis.start, vis.end)
  const topSpacer = prefix[vis.start] ?? 0
  const bottomSpacer = (prefix[prefix.length - 1] ?? 0) - (prefix[vis.end] ?? 0)

  const byDate = useMemo(
    () => (scope ? indexScopeEntriesByDate(entries, scope.id) : new Map()),
    [entries, scope],
  )

  const maps = useMemo(() => {
    const out: Record<string, ReturnType<typeof minuteMap>> = {}
    for (let i = vis.start; i < vis.end; i++) {
      const item = items[i]
      if (!item || item.kind !== "day") continue
      const list = byDate.get(item.key) ?? []
      out[item.key] = minuteMap(list, item.key, scope?.id ?? "")
    }
    return out
  }, [items, vis.start, vis.end, byDate, scope])

  const commitPaint = useCallback(
    (date: string, from: number, to: number) => {
      if (!scope || selectedPenId === null || selectedPenId === SCISSORS) return
      paintMinutes(
        date,
        scope.id,
        Math.min(from, to),
        Math.max(from, to),
        selectedPenId === ERASE ? null : selectedPenId,
        selectedVariantIds,
      )
    },
    [scope, selectedPenId, selectedVariantIds, paintMinutes],
  )

  const endDrag = useCallback(() => {
    const state = liveDrag.current
    liveDrag.current = null
    setDrag(null)
    if (!state || !scope) return
    const lo = Math.min(state.anchor, state.head)
    const hi = Math.min(MINUTES_PER_DAY, Math.max(state.anchor, state.head) + step)
    const map = maps[state.date]
    if (selectedPenId === SCISSORS) {
      const existing = map?.[state.anchor]
      if (existing) splitEntryAt(existing.id, state.anchor)
      return
    }
    if (state.moved) {
      commitPaint(state.date, lo, hi)
      return
    }
    const existing = map?.[state.anchor]
    if (existing && selectedPenId !== ERASE) setOpenEntryId(existing.id)
    else if (selectedPenId !== null) commitPaint(state.date, state.anchor, Math.min(MINUTES_PER_DAY, state.anchor + step))
  }, [commitPaint, maps, selectedPenId, splitEntryAt, step, scope])

  useEffect(() => {
    window.addEventListener("mouseup", endDrag)
    window.addEventListener("touchend", endDrag)
    return () => {
      window.removeEventListener("mouseup", endDrag)
      window.removeEventListener("touchend", endDrag)
    }
  }, [endDrag])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportH(el.clientHeight)
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || aligned.current) return
    const idx = items.findIndex((item) => item.kind === "day" && item.key === originKey)
    if (idx < 0) return
    const axis = el.querySelector(".trk-time-axis") as HTMLElement | null
    el.scrollTop = Math.max(0, (prefix[idx] ?? 0) - (axis?.offsetHeight ?? 0))
    setScrollTop(el.scrollTop)
    aligned.current = true
  }, [items, originKey, prefix])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || typeof IntersectionObserver === "undefined") return
    const obs = new IntersectionObserver(
      (hits) => {
        if (extending.current) return
        for (const hit of hits) {
          if (!hit.isIntersecting) continue
          const atTop = root.scrollTop < 48
          const atBottom = root.scrollTop + root.clientHeight > root.scrollHeight - 48
          if (hit.target === topSentinel.current && atTop && before < INFINITE_MAX_BEFORE) {
            extending.current = true
            const prevHeight = root.scrollHeight
            const prevScroll = root.scrollTop
            const add = mode === "week" ? INFINITE_WEEK_BEFORE : INFINITE_DAY_BEFORE
            setBefore((n) => Math.min(INFINITE_MAX_BEFORE, n + add))
            requestAnimationFrame(() => {
              const next = scrollRef.current
              if (next) {
                next.scrollTop = restoreScrollAfterPrepend(prevHeight, next.scrollHeight, prevScroll)
                setScrollTop(next.scrollTop)
              }
              extending.current = false
            })
          }
          if (hit.target === bottomSentinel.current && atBottom && after < INFINITE_MAX_AFTER) {
            extending.current = true
            const add = mode === "week" ? INFINITE_WEEK_AFTER : INFINITE_DAY_AFTER
            setAfter((n) => Math.min(INFINITE_MAX_AFTER, n + add))
            requestAnimationFrame(() => {
              extending.current = false
            })
          }
        }
      },
      { root, rootMargin: "80px", threshold: 0 },
    )
    if (topSentinel.current) obs.observe(topSentinel.current)
    if (bottomSentinel.current) obs.observe(bottomSentinel.current)
    return () => obs.disconnect()
  }, [mode, before, after])

  const minuteFromEvent = (target: EventTarget | null): { date: string; minute: number } | null => {
    const el = target as HTMLElement | null
    const date = el?.dataset?.day
    const raw = el?.dataset?.minute
    if (!date || raw == null) return null
    const minute = Number(raw)
    return Number.isFinite(minute) ? { date, minute } : null
  }

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  if (!scope) return null

  const dragLo = drag ? Math.min(drag.anchor, drag.head) : -1
  const dragHi = drag ? Math.max(drag.anchor, drag.head) + step : -1

  const renderDay = (day: Date) => {
    const key = formatLocalDateKey(day)
    const map = maps[key]
    const dayEntries = byDate.get(key) ?? []
    const instants = instantsForDay(dayEntries, key, scope.id)
    const isToday = key === todayKey
    const isCenter = key === centerKey
    return (
      <div
        key={key}
        className="trk-day-strip"
        data-day-row={key}
        data-today={isToday ? "true" : "false"}
        data-center={isCenter ? "true" : "false"}
        style={{ height: dayH }}
      >
        <button
          type="button"
          className="trk-day-gutter text-left"
          title="Click to select · double-click to open this day"
          onClick={() => onDateChange(day)}
          onDoubleClick={() => onOpenDay?.(day)}
        >
          {day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
        </button>
        <div
          className="trk-day-cells"
          onMouseDown={(e) => {
            const cell = minuteFromEvent(e.target)
            if (!cell) return
            if (selectedPenId === null) {
              const existing = map?.[cell.minute]
              if (existing) setOpenEntryId(existing.id)
              return
            }
            e.preventDefault()
            liveDrag.current = { date: cell.date, anchor: cell.minute, head: cell.minute, moved: false }
            setDrag({ date: cell.date, anchor: cell.minute, head: cell.minute })
          }}
          onMouseOver={(e) => {
            const state = liveDrag.current
            if (!state) return
            const cell = minuteFromEvent(e.target)
            if (!cell || cell.date !== state.date || cell.minute === state.head) return
            liveDrag.current = { ...state, head: cell.minute, moved: true }
            setDrag({ date: state.date, anchor: state.anchor, head: cell.minute })
          }}
        >
          {Array.from({ length: cells }, (_, i) => {
            const minute = i * step
            const cellEntry = map ? dominantEntry(map, minute, step) : null
            const pen = cellEntry ? displayedPen(scope, cellEntry.penId) : null
            const painted = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
            const inDrag = drag?.date === key && minute >= dragLo && minute < dragHi
            const fill = inDrag
              ? { background: selectedPenId === ERASE ? "#fca5a5" : selectedPen?.color }
              : penCellStyle(pen, cellEntry?.precision, minute)
            return (
              <div
                key={minute}
                data-day={key}
                data-minute={minute}
                className={cellPaintClass({
                  painted: Boolean(pen) || inDrag,
                  quarter: minute % 60 === 0,
                  five: minute % 15 === 0 && minute % 60 !== 0,
                })}
                style={{ ...fill, minWidth: compact ? 2 : 3, opacity: inDrag ? 0.75 : 1 }}
                onMouseEnter={() =>
                  setProbe(
                    trackingProbeText({
                      minute,
                      step,
                      name: cellEntry ? entryDisplayName(cellEntry, painted?.name || pen?.name) : undefined,
                    }),
                  )
                }
              />
            )
          })}
          {instants.map((event) => {
            const pen = displayedPen(scope, event.penId)
            return (
              <button
                key={event.id}
                type="button"
                className="trk-instant"
                aria-label={`${minutesToLabel(event.startMin)} · ${entryDisplayName(event, pen?.name)}`}
                style={{
                  left: `${(event.startMin / MINUTES_PER_DAY) * 100}%`,
                  background: pen?.color,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenEntryId(event.id)
                }}
              />
            )
          })}
          <TrkPlotMarkers
            origin={0}
            span={MINUTES_PER_DAY}
            axis="x"
            nowMinute={isToday ? nowMinute : null}
            sun={sunByDate[key] ?? null}
            showNowLabel={isToday}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        className="trk-grid trk-infinite overflow-auto"
        data-infinite={mode}
        style={{ maxHeight: compact ? 360 : 560 }}
        onMouseLeave={() => setProbe(null)}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          if (Math.abs(top - scrollTop) < 8) return
          setScrollTop(top)
        }}
      >
        <div className="trk-time-axis">
          <div className="trk-day-gutter">day</div>
          <div className="flex flex-1">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="flex-1 px-0.5" style={{ boxShadow: "inset 1px 0 0 rgb(80 72 64 / 0.35)" }}>
                {minutesToLabel(hour * 60).replace(" ", "")}
              </div>
            ))}
          </div>
        </div>
        <div ref={topSentinel} className="trk-infinite-sentinel" aria-hidden />
        <div style={{ height: topSpacer }} aria-hidden />
        {visibleItems.map((item) =>
          item.kind === "band" ? (
            <button
              key={item.key}
              type="button"
              className="trk-week-band-label"
              data-week-band={formatLocalDateKey(item.date)}
              title="Double-click to open this week"
              style={{ height: bandH }}
              onDoubleClick={() => onOpenWeek?.(item.date)}
            >
              {item.label}
            </button>
          ) : (
            renderDay(item.date)
          ),
        )}
        <div style={{ height: bottomSpacer }} aria-hidden />
        <div ref={bottomSentinel} className="trk-infinite-sentinel" aria-hidden />
        <TrkCrtProbe text={probe} />
      </div>

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}
