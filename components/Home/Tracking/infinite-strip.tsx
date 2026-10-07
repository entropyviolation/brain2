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
 * `scrollTop` stays in a ref. Scroll events coalesce to one bounds update per
 * animation frame; the strip re-renders when that window changes. Prepend still
 * restores scrollTop in its own frame so the top sentinel cannot twitch. The
 * 15m cell floor is unchanged. A day row re-renders when the stroke range
 * covers or leaves that day.
 * Hover writes `.trk-probe` on the node, not as grid state.
 */
"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react"
import { displayedPen, penCellStyle, useTimeTrackingStore, type TimeEntry, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"
import { discreteLogInstants, overlayTicksBeside, penNameById, tickPen } from "@/components/Home/Tracking/discrete-log-instants"
import { penAtDepth } from "@/lib/pen-tree"
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
import { cellPaintClass, SuperimposeWash, trackingProbeText, TrkBlockLabel, TrkProbePlate, writeTrkProbe } from "@/components/Home/Tracking/trk-instrument"
import { focusTrackingPlot } from "@/components/Home/Tracking/tracking-undo"
import { useSuperimposeScope } from "@/components/Home/Tracking/tracking-view-prefs"
import { TrkPlotMarkers, useTrackingDayMarkers, useTrackingSunMap, type TrackingSunTimes } from "@/components/Home/Tracking/trk-time-markers"
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

const NO_ENTRIES: TimeEntry[] = []

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

function minuteFromPointer(target: EventTarget | null): { date: string; minute: number } | null {
  const el = target as HTMLElement | null
  const date = el?.dataset?.day
  const raw = el?.dataset?.minute
  if (!date || raw == null) return null
  const minute = Number(raw)
  return Number.isFinite(minute) ? { date, minute } : null
}

interface LiveStroke {
  date: string
  anchor: number
  head: number
  moved: boolean
}

interface InfiniteDayProps {
  day: Date
  dayKey: string
  dayH: number
  step: number
  compact: boolean
  painted: (TimeEntry | null)[] | undefined
  overlayPainted: (TimeEntry | null)[] | undefined
  dayList: TimeEntry[]
  overlayList: TimeEntry[]
  strokeLo: number
  strokeHi: number
  strokeDate: string
  scope: TrackScope
  scopes: readonly TrackScope[]
  overlayScope?: TrackScope
  logTicks: TimeEntry[]
  selectedPenId: string | null
  selectedPen: TrackPen | null
  isToday: boolean
  isCenter: boolean
  nowMinute: number | null
  sun: TrackingSunTimes | null
  onProbe: (text: string | null) => void
  onDateChange: (date: Date) => void
  onOpenDay?: (date: Date) => void
  onOpenEntry: (id: string) => void
  plotRef: RefObject<HTMLDivElement | null>
  liveDrag: RefObject<LiveStroke | null>
  onStroke: (drag: { date: string; anchor: number; head: number }) => void
  /** Coarser than the cell step: color the root category, not the painted leaf. */
  category?: boolean
}

function infiniteDayPropsEqual(prev: InfiniteDayProps, next: InfiniteDayProps): boolean {
  if (prev.day !== next.day) return false
  if (prev.dayKey !== next.dayKey) return false
  if (prev.dayH !== next.dayH) return false
  if (prev.step !== next.step) return false
  if (prev.compact !== next.compact) return false
  if (prev.painted !== next.painted) return false
  if (prev.overlayPainted !== next.overlayPainted) return false
  if (prev.dayList !== next.dayList) return false
  if (prev.overlayList !== next.overlayList) return false
  if (prev.scope !== next.scope) return false
  if (prev.scopes !== next.scopes) return false
  if (prev.overlayScope !== next.overlayScope) return false
  if (prev.logTicks !== next.logTicks) return false
  if (prev.selectedPenId !== next.selectedPenId) return false
  if (prev.selectedPen !== next.selectedPen) return false
  if (prev.isToday !== next.isToday) return false
  if (prev.isCenter !== next.isCenter) return false
  if (prev.isToday && prev.nowMinute !== next.nowMinute) return false
  if (prev.sun !== next.sun) return false
  if (prev.onProbe !== next.onProbe) return false
  if (prev.onDateChange !== next.onDateChange) return false
  if (prev.onOpenDay !== next.onOpenDay) return false
  if (prev.onOpenEntry !== next.onOpenEntry) return false
  if (prev.plotRef !== next.plotRef) return false
  if (prev.liveDrag !== next.liveDrag) return false
  if (prev.onStroke !== next.onStroke) return false
  if (prev.category !== next.category) return false
  const prevLo = prev.strokeDate === prev.dayKey ? prev.strokeLo : 0
  const prevHi = prev.strokeDate === prev.dayKey ? prev.strokeHi : 0
  const nextLo = next.strokeDate === next.dayKey ? next.strokeLo : 0
  const nextHi = next.strokeDate === next.dayKey ? next.strokeHi : 0
  return strokeOverlapUnchanged(prevLo, prevHi, nextLo, nextHi, 0, MINUTES_PER_DAY)
}

const InfiniteDayRow = memo(function InfiniteDayRow({
  day,
  dayKey,
  dayH,
  step,
  compact,
  painted,
  overlayPainted,
  dayList,
  overlayList,
  strokeLo,
  strokeHi,
  strokeDate,
  scope,
  scopes,
  overlayScope,
  logTicks,
  selectedPenId,
  selectedPen,
  isToday,
  isCenter,
  nowMinute,
  sun,
  onProbe,
  onDateChange,
  onOpenDay,
  onOpenEntry,
  plotRef,
  liveDrag,
  onStroke,
  category = false,
}: InfiniteDayProps) {
  const showPen = (view: TrackScope, penId: string) => {
    if (!category) return displayedPen(view, penId)
    const root = penAtDepth(view.pens, penId, 0)
    return (root && view.pens.find((pen) => pen.id === root.id)) || displayedPen(view, penId)
  }
  const cells = MINUTES_PER_DAY / step
  const labels: { id: string; name: string; color: string; left: number; width: number }[] = []
  const seen = new Set<string>()
  if (painted) {
    for (let i = 0; i < cells; i++) {
      const minute = i * step
      const entry = dominantEntry(painted, minute, step)
      if (!entry || seen.has(entry.id)) continue
      if (entry.startMin < minute || entry.startMin >= minute + step) continue
      seen.add(entry.id)
      const shown = showPen(scope, entry.penId)
      const color = shown?.color
      if (!color || entry.endMin <= entry.startMin) continue
      labels.push({
        id: entry.id,
        name: entryDisplayName(entry, shown.name),
        color,
        left: (entry.startMin / MINUTES_PER_DAY) * 100,
        width: ((entry.endMin - entry.startMin) / MINUTES_PER_DAY) * 100,
      })
    }
  }
  const ownInstants = instantsForDay(dayList, dayKey, scope.id)
  const instants = (() => {
    if (logTicks.length === 0) return ownInstants
    const seen = new Set(ownInstants.map((entry) => entry.id))
    const extra = logTicks.filter((entry) => !seen.has(entry.id))
    if (extra.length === 0) return ownInstants
    return [...ownInstants, ...extra].sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id))
  })()
  const overlayInstants = overlayScope
    ? overlayTicksBeside(instantsForDay(overlayList, dayKey, overlayScope.id), instants)
    : []
  return (
    <div
      className="trk-day-strip"
      data-day-row={dayKey}
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
          focusTrackingPlot(plotRef.current)
          const cell = minuteFromPointer(e.target)
          if (!cell) return
          if (selectedPenId === null) {
            const existing = painted?.[cell.minute]
            if (existing) onOpenEntry(existing.id)
            return
          }
          e.preventDefault()
          liveDrag.current = { date: cell.date, anchor: cell.minute, head: cell.minute, moved: false }
          onStroke({ date: cell.date, anchor: cell.minute, head: cell.minute })
        }}
        onMouseOver={(e) => {
          const state = liveDrag.current
          if (!state) return
          const cell = minuteFromPointer(e.target)
          if (!cell || cell.date !== state.date || cell.minute === state.head) return
          liveDrag.current = { ...state, head: cell.minute, moved: true }
          onStroke({ date: state.date, anchor: state.anchor, head: cell.minute })
        }}
      >
        {Array.from({ length: cells }, (_, i) => {
          const minute = i * step
          const cellEntry = painted ? dominantEntry(painted, minute, step) : null
          const pen = cellEntry ? showPen(scope, cellEntry.penId) : null
          const paintedPen = cellEntry ? scope.pens.find((p) => p.id === cellEntry.penId) : null
          const inDrag = strokeDate === dayKey && minute >= strokeLo && minute < strokeHi
          const fill = inDrag
            ? { background: selectedPenId === ERASE ? "#fca5a5" : selectedPen?.color }
            : penCellStyle(pen, cellEntry?.precision, minute)
          const overlayEntry = overlayPainted ? dominantEntry(overlayPainted, minute, step) : null
          const overlayPen = overlayEntry && overlayScope ? showPen(overlayScope, overlayEntry.penId) : null
          const futureCell = isToday && nowMinute != null && minute > nowMinute
          return (
            <div
              key={minute}
              data-day={dayKey}
              data-minute={minute}
              className={`${cellPaintClass({
                painted: Boolean(pen) || inDrag,
                quarter: minute % 60 === 0,
                five: minute % 15 === 0 && minute % 60 !== 0,
              })}${futureCell ? " trk-future" : ""}`}
              style={{ ...fill, minWidth: compact ? 2 : 3, opacity: inDrag ? 0.75 : 1 }}
              onMouseEnter={() =>
                onProbe(
                  trackingProbeText({
                    minute,
                    step,
                    name: cellEntry ? entryDisplayName(cellEntry, paintedPen?.name || pen?.name) : undefined,
                  }),
                )
              }
            >
              {overlayPen && !inDrag ? <SuperimposeWash color={overlayPen.color} /> : null}
            </div>
          )
        })}
        {labels.map((label) => (
          <TrkBlockLabel key={label.id} name={label.name} color={label.color} left={label.left} width={label.width} />
        ))}
        {overlayScope && overlayInstants.map((event) => {
          const pen = showPen(overlayScope, event.penId)
          return (
            <span
              key={`super-${event.id}`}
              className="trk-instant trk-super-instant"
              style={{
                left: `${(event.startMin / MINUTES_PER_DAY) * 100}%`,
                background: pen?.color,
              }}
              aria-hidden
            />
          )
        })}
        {instants.map((event) => {
          const pen = showPen(scope, event.penId) ?? tickPen(scopes, scope, event.penId)
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
                onOpenEntry(event.id)
              }}
            />
          )
        })}
        <TrkPlotMarkers
          origin={0}
          span={MINUTES_PER_DAY}
          axis="x"
          nowMinute={isToday ? nowMinute : null}
          sun={sun}
          showNowLabel={isToday}
        />
      </div>
    </div>
  )
}, infiniteDayPropsEqual)

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
  const scopeIds = useMemo(() => scopes.map((s) => s.id), [scopes])
  const overlayScopeId = useSuperimposeScope(scope?.id, scopeIds)
  const overlayScope = scopes.find((s) => s.id === overlayScopeId)
  const originRef = useRef(startOfDay(centerDate))
  const origin = originRef.current
  const [before, setBefore] = useState(mode === "week" ? INFINITE_WEEK_BEFORE : INFINITE_DAY_BEFORE)
  const [after, setAfter] = useState(mode === "week" ? INFINITE_WEEK_AFTER : INFINITE_DAY_AFTER)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ date: string; anchor: number; head: number } | null>(null)
  const [viewportH, setViewportH] = useState(compact ? 360 : 560)
  const [bounds, setBounds] = useState({ start: 0, end: 0 })
  const probeRef = useRef<HTMLDivElement>(null)
  const writeProbe = useCallback((text: string | null) => writeTrkProbe(probeRef.current, text), [])

  const scrollTopRef = useRef(0)
  const scrollFrame = useRef<number | null>(null)
  const visRef = useRef({ start: 0, end: 0 })
  const prefixRef = useRef<number[]>([0])
  const viewportRef = useRef(compact ? 360 : 560)
  const liveDrag = useRef<LiveStroke | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinel = useRef<HTMLDivElement>(null)
  const bottomSentinel = useRef<HTMLDivElement>(null)
  const extending = useRef(false)
  const aligned = useRef(false)

  const dayH = compact ? 28 : 36
  const bandH = 20
  const [zoom, setZoom] = useState<"cells" | "hour" | "watch" | "day">("cells")
  const step = zoom === "hour" ? 60 : zoom === "watch" ? 180 : zoom === "day" ? MINUTES_PER_DAY : infiniteCellStep(gridStep)
  const category = zoom !== "cells"
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
  prefixRef.current = prefix
  viewportRef.current = viewportH
  const vis = useMemo(
    () => visibleSlice(prefix, scrollTopRef.current, viewportH, INFINITE_OVERSCAN_PX),
    [prefix, viewportH, bounds],
  )
  visRef.current = vis
  const visibleItems = items.slice(vis.start, vis.end)
  const topSpacer = prefix[vis.start] ?? 0
  const bottomSpacer = (prefix[prefix.length - 1] ?? 0) - (prefix[vis.end] ?? 0)

  const byDate = useMemo(
    () => (scope ? indexScopeEntriesByDate(entries, scope.id) : new Map()),
    [entries, scope],
  )
  const penNames = useMemo(() => penNameById(scopes), [scopes])
  const logByDate = useMemo(() => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of discreteLogInstants(entries, penNames)) {
      const list = map.get(entry.date)
      if (list) list.push(entry)
      else map.set(entry.date, [entry])
    }
    return map
  }, [entries, penNames])

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

  const overlayByDate = useMemo(
    () => (overlayScope ? indexScopeEntriesByDate(entries, overlayScope.id) : new Map()),
    [entries, overlayScope],
  )
  const overlayMaps = useMemo(() => {
    const out: Record<string, ReturnType<typeof minuteMap>> = {}
    if (!overlayScope) return out
    for (let i = vis.start; i < vis.end; i++) {
      const item = items[i]
      if (!item || item.kind !== "day") continue
      const list = overlayByDate.get(item.key) ?? []
      out[item.key] = minuteMap(list, item.key, overlayScope.id)
    }
    return out
  }, [items, vis.start, vis.end, overlayByDate, overlayScope])

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

  useEffect(() => () => {
    if (scrollFrame.current != null) cancelAnimationFrame(scrollFrame.current)
  }, [])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportH((prev) => (prev === el.clientHeight ? prev : el.clientHeight))
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
    scrollTopRef.current = el.scrollTop
    aligned.current = true
    const next = visibleSlice(prefix, el.scrollTop, viewportRef.current, INFINITE_OVERSCAN_PX)
    setBounds((prev) => {
      const cur = visRef.current
      if (next.start === cur.start && next.end === cur.end) return prev
      return next
    })
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
                scrollTopRef.current = next.scrollTop
                const slice = visibleSlice(prefixRef.current, next.scrollTop, viewportRef.current, INFINITE_OVERSCAN_PX)
                setBounds((prev) => {
                  const cur = visRef.current
                  if (slice.start === cur.start && slice.end === cur.end) return prev
                  return slice
                })
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

  const openEntry = openEntryId ? entries.find((e) => e.id === openEntryId) : undefined
  if (!scope) return null

  const strokeLo = drag ? Math.min(drag.anchor, drag.head) : 0
  const strokeHi = drag ? Math.min(MINUTES_PER_DAY, Math.max(drag.anchor, drag.head) + step) : 0
  const strokeDate = drag?.date ?? ""

  return (
    <div className="space-y-2">
      <div className="trk-span-switch" role="toolbar" aria-label="Strip zoom">
        <button type="button" aria-pressed={zoom === "cells"} onClick={() => setZoom("cells")}>
          Cells
        </button>
        <button type="button" aria-pressed={zoom === "hour"} onClick={() => setZoom("hour")} title="One cell per hour, category color">
          Hour
        </button>
        <button type="button" aria-pressed={zoom === "watch"} onClick={() => setZoom("watch")} title="Three-hour cells, category color">
          3h
        </button>
        <button type="button" aria-pressed={zoom === "day"} onClick={() => setZoom("day")} title="One cell per day, category color. Scroll for a month or a year.">
          Day
        </button>
      </div>
      <div
        ref={scrollRef}
        className="trk-grid trk-infinite overflow-auto"
        tabIndex={-1}
        data-infinite={mode}
        data-superimpose={overlayScope?.id || undefined}
        style={{ maxHeight: compact ? 360 : 560 }}
        onMouseLeave={() => writeProbe(null)}
        onScroll={(e) => {
          scrollTopRef.current = e.currentTarget.scrollTop
          if (scrollFrame.current != null) return
          scrollFrame.current = requestAnimationFrame(() => {
            scrollFrame.current = null
            const next = visibleSlice(
              prefixRef.current,
              scrollTopRef.current,
              viewportRef.current,
              INFINITE_OVERSCAN_PX,
            )
            const cur = visRef.current
            if (next.start === cur.start && next.end === cur.end) return
            setBounds(next)
          })
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
            <InfiniteDayRow
              key={item.key}
              day={item.date}
              dayKey={item.key}
              dayH={dayH}
              step={step}
              compact={compact}
              painted={maps[item.key]}
              overlayPainted={overlayMaps[item.key]}
              dayList={byDate.get(item.key) ?? NO_ENTRIES}
              overlayList={overlayScope ? overlayByDate.get(item.key) ?? NO_ENTRIES : NO_ENTRIES}
              strokeLo={strokeLo}
              strokeHi={strokeHi}
              strokeDate={strokeDate}
              scope={scope}
              scopes={scopes}
              overlayScope={overlayScope}
              logTicks={logByDate.get(item.key) ?? NO_ENTRIES}
              selectedPenId={selectedPenId}
              selectedPen={selectedPen}
              isToday={item.key === todayKey}
              isCenter={item.key === centerKey}
              nowMinute={nowMinute}
              sun={sunByDate[item.key] ?? null}
              onProbe={writeProbe}
              onDateChange={onDateChange}
              onOpenDay={onOpenDay}
              onOpenEntry={setOpenEntryId}
              plotRef={scrollRef}
              liveDrag={liveDrag}
              onStroke={setDrag}
              category={category}
            />
          ),
        )}
        <div style={{ height: bottomSpacer }} aria-hidden />
        <div ref={bottomSentinel} className="trk-infinite-sentinel" aria-hidden />
        <TrkProbePlate nodeRef={probeRef} />
      </div>

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
    </div>
  )
}
