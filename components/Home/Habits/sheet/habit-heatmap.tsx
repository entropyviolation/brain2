/**
 * components/Home/Habits/habit-heatmap.tsx — Compact completion mosaic
 *
 * Rows of soft squares, newest on the right. Scroll left to load older
 * columns (daily days, weekly weeks, or monthly months) without a hard stop.
 * Scroll position and the visible column window update once per animation frame,
 * and again when the scroller resizes. The window uses the real pitch
 * (cell + column gap) so the left of the scrollport stays mounted.
 * A zero-width scroller still paints the whole span.
 * Surface is a pearl handheld screen of flat dusty-aqua squares in the Habits metal well.
 */
"use client"

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { type HabitFrequency, type WeeklyData, type WeeklyTask } from "@/lib/types"
import {
  addCalendarDays,
  formatLocalDateKey,
  formatLocalMonthKey,
  getPrecedingMonthStarts,
  getPrecedingWeekStarts,
  getWeekStartDate,
  getWeekString,
  isToday,
} from "@/lib/date-utils"
import {
  autoPriorityWeight,
  effectivePriorityWeight,
  habitCellRatio,
  priorityMarkPercent,
  priorityWash,
  priorityWashVars,
} from "@/lib/habit-priority"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isMissedOpportunity, missedOpportunityEligible } from "@/lib/habit-missed-opportunity"
import { missReasonAsText } from "@/lib/blocked-reason"
import { MissReasonDialog } from "@/components/Reviews/MissReasonDialog"
import { habitHiddenWhenComplete } from "@/lib/habit-completion-source"
import { exemptionHeatTitle, isExemptKind, loggedExemptionDay, type ExemptionKind } from "@/lib/habit-exemption"
import { format } from "date-fns"
import { precedingQuarterStarts, quarterKey, seasonOfDate } from "@/lib/seasons"

export interface HeatmapColumn {
  key: string
  date: Date
  label: string
  sub: string
}

function dailyColumns(asOf: Date, days: number): HeatmapColumn[] {
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const cols: HeatmapColumn[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addCalendarDays(end, -i)
    cols.push({
      key: formatLocalDateKey(date),
      date,
      label: format(date, "d"),
      sub: format(date, "EEE"),
    })
  }
  return cols
}

function weekColumns(asOf: Date, count: number): HeatmapColumn[] {
  return getPrecedingWeekStarts(getWeekStartDate(asOf), count).map((start) => ({
    key: getWeekString(start),
    date: start,
    label: `${start.getMonth() + 1}/${start.getDate()}`,
    sub: "wk",
  }))
}

function seasonColumns(asOf: Date, count: number): HeatmapColumn[] {
  return precedingQuarterStarts(asOf, count).map((start) => ({
    key: quarterKey(start),
    date: start,
    label: seasonOfDate(start).slice(0, 2),
    sub: `Q${Math.floor(start.getMonth() / 3) + 1}`,
  }))
}

function monthColumns(asOf: Date, count: number): HeatmapColumn[] {
  return getPrecedingMonthStarts(asOf, count).map((start) => ({
    key: formatLocalMonthKey(start),
    date: start,
    label: format(start, "MMM"),
    sub: format(start, "yy"),
  }))
}

/** Must match `.habit-heat-grid` (10rem label, 14px cell, 2px column gap). */
export const HEAT_CELL_PX = 14
export const HEAT_GAP_PX = 2
export const HEAT_LABEL_PX = 160
const HEAT_BUFFER = 8

export interface HeatmapBandMetrics {
  cell?: number
  gap?: number
  label?: number
}

/**
 * Columns mounted around the scrollport.
 * Pitch is the cell plus the column gap. Dividing by the cell alone walks the
 * window too far right, and the left of the visible mosaic unmounts.
 * A zero-width scroller paints the whole span.
 */
export function heatmapColumnBand(
  scrollLeft: number,
  clientWidth: number,
  count: number,
  metrics: HeatmapBandMetrics = {},
) {
  if (count <= 0) return { start: 0, end: 0 }
  const cell = metrics.cell ?? HEAT_CELL_PX
  const gap = metrics.gap ?? HEAT_GAP_PX
  const label = metrics.label ?? HEAT_LABEL_PX
  const pitch = cell + gap
  if (!(clientWidth > 0) || !(pitch > 0)) return { start: 0, end: count }
  const origin = label + gap
  const viewEnd = scrollLeft + clientWidth
  let first = 0
  if (scrollLeft > origin) {
    first = Math.floor((scrollLeft - origin - cell) / pitch) + 1
    if (first < 0) first = 0
  }
  const last = Math.max(first, Math.floor((viewEnd - origin - 0.01) / pitch))
  const start = Math.max(0, Math.min(first, count) - HEAT_BUFFER)
  const end = Math.min(count, Math.max(last, first) + 1 + HEAT_BUFFER)
  return { start, end }
}

function readHeatMetrics(scroller: HTMLElement): HeatmapBandMetrics {
  const grid = scroller.querySelector(".habit-heat-grid") as HTMLElement | null
  const head = grid?.querySelector(".habit-heat-head") as HTMLElement | null
  const corner = grid?.querySelector(".habit-heat-corner") as HTMLElement | null
  if (!head || head.offsetWidth <= 0) return {}
  const cell = head.offsetWidth
  const label = corner && corner.offsetWidth > 0 ? corner.offsetWidth : HEAT_LABEL_PX
  const parsed = grid ? Number.parseFloat(getComputedStyle(grid).columnGap) : Number.NaN
  const gap = Number.isFinite(parsed) && parsed >= 0 ? parsed : HEAT_GAP_PX
  return { cell, gap, label }
}

/** Flat dusty aqua. Empty stays quiet metal; full is a deeper blue-green. */
export function heatmapCellFill(ratio: number): string {
  if (ratio <= 0) return "transparent"
  if (ratio >= 1) return "#6f9e98"
  if (ratio >= 0.75) return "#8fb3af"
  if (ratio >= 0.5) return "#afc7c4"
  if (ratio >= 0.25) return "#c5d9d6"
  return "#d7e6e4"
}

interface HabitHeatmapProps {
  tasks: WeeklyTask[]
  data: WeeklyData
  asOf: Date
  frequency: HabitFrequency
  onEditTask: (task: WeeklyTask) => void
  hideCompleted?: boolean
  focusKey?: string
  exemptionWand?: boolean
  exemptionKindFor?: (task: WeeklyTask, periodKey: string) => ExemptionKind
  onToggleExempt?: (taskId: string, periodKey: string, exempt: boolean) => void
  missedOpWand?: boolean
  hideCompletedAndMissed?: boolean
  onToggleMissed?: (taskId: string, periodKey: string, missed: boolean, missReason?: string) => void
  /** Row percent the sheet paints. 100 hides a row the focus cell has not met. */
  periodPercentFor?: (taskId: string) => number | null
  highlightPriorities?: boolean
  ritualIds?: readonly string[]
  ritualMultiplier?: number
  showStreakMarks?: boolean
}

export function HabitHeatmap({
  tasks,
  data,
  asOf,
  frequency,
  onEditTask,
  hideCompleted = false,
  focusKey,
  exemptionWand = false,
  exemptionKindFor,
  onToggleExempt,
  missedOpWand = false,
  hideCompletedAndMissed = false,
  onToggleMissed,
  periodPercentFor,
  highlightPriorities = false,
  ritualIds = [],
  ritualMultiplier = 0,
  showStreakMarks = true,
}: HabitHeatmapProps) {
  const [span, setSpan] = useState(frequency === "daily" ? 42 : 16)
  const [band, setBand] = useState({ start: 0, end: 48 })
  const scroller = useRef<HTMLDivElement>(null)
  const pendingRestore = useRef<number | null>(null)
  const didInitScroll = useRef(false)
  const scrollFrame = useRef(0)
  const frequencyRef = useRef(frequency)
  const columnCountRef = useRef(0)
  if (frequencyRef.current !== frequency) {
    didInitScroll.current = false
    pendingRestore.current = null
  }
  frequencyRef.current = frequency

  const columns =
    frequency === "quarterly"
      ? seasonColumns(asOf, span)
      : frequency === "monthly"
        ? monthColumns(asOf, span)
        : frequency === "weekly"
          ? weekColumns(asOf, span)
          : dailyColumns(asOf, span)
  columnCountRef.current = columns.length

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (pendingRestore.current !== null) {
      el.scrollLeft = el.scrollWidth - pendingRestore.current
      pendingRestore.current = null
    } else if (!didInitScroll.current) {
      el.scrollLeft = el.scrollWidth
      didInitScroll.current = true
    }
    const next = heatmapColumnBand(el.scrollLeft, el.clientWidth, columns.length, readHeatMetrics(el))
    setBand((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
  }, [span, columns.length, frequency])

  useEffect(() => {
    const next = frequency === "daily" ? 42 : 16
    setSpan((current) => {
      if (current !== next) didInitScroll.current = false
      return next
    })
    if (scrollFrame.current) {
      cancelAnimationFrame(scrollFrame.current)
      scrollFrame.current = 0
    }
  }, [frequency])

  useEffect(() => {
    const el = scroller.current
    if (!el || typeof ResizeObserver === "undefined") {
      return () => {
        if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current)
      }
    }
    const ro = new ResizeObserver(() => {
      const node = scroller.current
      if (!node) return
      const next = heatmapColumnBand(node.scrollLeft, node.clientWidth, columnCountRef.current, readHeatMetrics(node))
      setBand((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      if (scrollFrame.current) cancelAnimationFrame(scrollFrame.current)
    }
  }, [])

  const onScroll = () => {
    if (scrollFrame.current) return
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0
      const el = scroller.current
      if (!el) return
      const next = heatmapColumnBand(el.scrollLeft, el.clientWidth, columnCountRef.current, readHeatMetrics(el))
      setBand((prev) => (prev.start === next.start && prev.end === next.end ? prev : next))
      if (el.scrollLeft > 24) return
      pendingRestore.current = el.scrollWidth - el.scrollLeft
      const step = frequencyRef.current === "daily" ? 28 : 12
      setSpan((n) => n + step)
    })
  }

  const shownColumns = columns.slice(band.start, band.end)
  const padBefore = band.start
  const padAfter = Math.max(0, columns.length - band.end)

  const shown =
    hideCompleted && focusKey
      ? tasks.filter((task) => {
          const kind = exemptionKindFor?.(task, focusKey)
          const column = columns.find((col) => col.key === focusKey)
          return !habitHiddenWhenComplete(task, data[focusKey]?.[task.id], {
            date: column?.date ?? asOf,
            weeklyData: data,
            exempt: isExemptKind(kind),
            periodPercent: periodPercentFor?.(task.id),
          })
        })
      : tasks

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No habits yet. Add one to get started.</p>
  }

  return (
    <div
      className="habit-heat"
      aria-label={exemptionWand ? "Exemption wand" : missedOpWand ? "Missed op wand" : "Habit heatmap"}
    >
      <div className="habit-heat-scroll" ref={scroller} onScroll={onScroll}>
        <div
          className="habit-heat-grid"
          style={{
            gridTemplateColumns: `10rem repeat(${columns.length}, ${HEAT_CELL_PX}px)`,
            columnGap: HEAT_GAP_PX,
          }}
        >
          <div className="habit-heat-corner" />
          {padBefore > 0 ? <div style={{ gridColumn: `span ${padBefore}` }} /> : null}
          {shownColumns.map((col) => (
            <div
              key={col.key}
              className={`habit-heat-head ${isToday(col.date) ? "is-today" : ""}`}
              title={`${col.sub} ${col.label}`}
            >
              <span>{col.label}</span>
            </div>
          ))}
          {padAfter > 0 ? <div style={{ gridColumn: `span ${padAfter}` }} /> : null}
          {shown.map((task) => {
            const weight = effectivePriorityWeight(task, data, asOf, frequency)
            const neglect = autoPriorityWeight(task, data, asOf, frequency)
            const ritual = ritualIds.includes(task.id)
            const wash = priorityWash({
              highlight: highlightPriorities,
              ritual,
              neglect,
              selected: priorityMarkPercent(task, asOf, ritual),
            })
            return (
              <HeatmapRow
                key={task.id}
                task={task}
                columns={shownColumns}
                padBefore={padBefore}
                padAfter={padAfter}
                data={data}
                weight={weight}
                washClass={wash.className}
                washStyle={priorityWashVars(wash) as CSSProperties | undefined}
                ritualMultiplier={ritual ? ritualMultiplier : 0}
                showStreakMarks={showStreakMarks}
                onEdit={() => onEditTask(task)}
                exemptionWand={exemptionWand}
                exemptionKindFor={exemptionKindFor}
                onToggleExempt={onToggleExempt}
                missedOpWand={missedOpWand}
                hideCompletedAndMissed={hideCompletedAndMissed}
                onToggleMissed={onToggleMissed}
                frequency={frequency}
              />
            )
          })}
        </div>
      </div>
      <p className="habit-heat-hint">
        {exemptionWand
          ? "Grey squares are exempt. Click a square to waive or restore that period."
          : missedOpWand
            ? "Grey squares are already done or exempt. Click an open square to mark that period definitely not done."
            : `Scroll left for older ${frequency === "quarterly" ? "seasons" : frequency === "monthly" ? "months" : frequency === "weekly" ? "weeks" : "days"}. Squares fill with how complete that period was.`}
      </p>
    </div>
  )
}

function HeatmapRow({
  task,
  columns,
  data,
  weight,
  washClass = "",
  washStyle,
  ritualMultiplier = 0,
  showStreakMarks = true,
  onEdit,
  exemptionWand = false,
  exemptionKindFor,
  onToggleExempt,
  missedOpWand = false,
  hideCompletedAndMissed = false,
  onToggleMissed,
  frequency,
  padBefore = 0,
  padAfter = 0,
}: {
  task: WeeklyTask
  columns: HeatmapColumn[]
  data: WeeklyData
  weight: number
  washClass?: string
  washStyle?: CSSProperties
  ritualMultiplier?: number
  showStreakMarks?: boolean
  onEdit: () => void
  exemptionWand?: boolean
  exemptionKindFor?: (task: WeeklyTask, periodKey: string) => ExemptionKind
  onToggleExempt?: (taskId: string, periodKey: string, exempt: boolean) => void
  missedOpWand?: boolean
  hideCompletedAndMissed?: boolean
  onToggleMissed?: (taskId: string, periodKey: string, missed: boolean, missReason?: string) => void
  frequency: HabitFrequency
  padBefore?: number
  padAfter?: number
}) {
  const [askKey, setAskKey] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className={`habit-heat-name${washClass ? ` ${washClass}` : ""}`}
        style={washStyle}
        onClick={onEdit}
        title="Edit habit"
      >
        <span>{task.name}</span>
        {showStreakMarks && ritualMultiplier > 0 && <em>×{ritualMultiplier}</em>}
        {showStreakMarks && weight > 0 && <em>×{weight}</em>}
      </button>
      {padBefore > 0 ? <div style={{ gridColumn: `span ${padBefore}` }} /> : null}
      {columns.map((col) => {
        const kind = exemptionKindFor?.(task, col.key) ?? "required"
        const exempt = isExemptKind(kind)
        const cell = data[col.key]?.[task.id]
        const met = isHabitGoalMet(task, cell, { date: col.date, weeklyData: data })
        const missed = isMissedOpportunity(cell)
        const todayClass = isToday(col.date) ? "is-today" : ""
        if (exemptionWand && onToggleExempt) {
          const logDay = kind === "logged" ? loggedExemptionDay(task, col.key, frequency) : null
          const title = exemptionHeatTitle(task.name, kind, logDay)
          const className = `habit-heat-cell${exempt ? " is-exempt" : ""} ${todayClass}`
          return (
            <button
              key={col.key}
              type="button"
              className={className}
              title={title}
              aria-pressed={exempt}
              aria-label={title}
              onClick={() => onToggleExempt(task.id, col.key, !exempt)}
            />
          )
        }
        if (missedOpWand && onToggleMissed) {
          if (!missedOpportunityEligible(exempt, met)) {
            const title = exempt
              ? exemptionHeatTitle(task.name, kind, kind === "logged" ? loggedExemptionDay(task, col.key, frequency) : null)
              : `${task.name} · already done`
            return (
              <div
                key={col.key}
                className={`habit-heat-cell is-exempt ${todayClass}`}
                title={title}
                aria-label={title}
              />
            )
          }
          const title = missed
            ? `${task.name} · missed opportunity. Click to clear.`
            : `${task.name} · click to mark missed opportunity`
          return (
            <button
              key={col.key}
              type="button"
              className={`habit-heat-cell${missed ? " is-exempt" : ""} ${todayClass}`}
              title={title}
              aria-pressed={missed}
              aria-label={title}
              onClick={() => {
                if (missed) {
                  onToggleMissed(task.id, col.key, false)
                  return
                }
                setAskKey(col.key)
              }}
            />
          )
        }
        if (exempt || (hideCompletedAndMissed && (met || missed))) {
          const logDay = kind === "logged" ? loggedExemptionDay(task, col.key, frequency) : null
          const title = exempt
            ? exemptionHeatTitle(task.name, kind, logDay)
            : met
              ? `${task.name} · completed`
              : `${task.name} · missed opportunity`
          return (
            <div
              key={col.key}
              className={`habit-heat-cell is-exempt ${todayClass}`}
              title={title}
              aria-label={title}
            />
          )
        }
        const ratio = habitCellRatio(task, cell, data, col.date)
        return (
          <div
            key={col.key}
            className={`habit-heat-cell ${ratio > 0 ? "is-lit" : ""} ${ratio >= 1 ? "is-full" : ""} ${isToday(col.date) ? "is-today" : ""}`}
            style={
              ratio > 0 && !isToday(col.date)
                ? { backgroundColor: heatmapCellFill(ratio) }
                : undefined
            }
            title={`${task.name} · ${format(col.date, "EEE MMM d")} · ${Math.round(ratio * 100)}%`}
          />
        )
      })}
      {padAfter > 0 ? <div style={{ gridColumn: `span ${padAfter}` }} /> : null}
      <MissReasonDialog
        open={askKey !== null}
        subject={task.name}
        onResolve={(reason) => {
          const key = askKey
          setAskKey(null)
          if (!key) return
          onToggleMissed?.(task.id, key, true, missReasonAsText(reason))
        }}
      />
    </>
  )
}
