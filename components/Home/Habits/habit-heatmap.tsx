/**
 * components/Home/Habits/habit-heatmap.tsx — Compact completion mosaic
 *
 * Rows of beveled squares, newest on the right. Scroll left to load older
 * columns (daily days, weekly weeks, or monthly months) without a hard stop.
 * Chrome matches the Daily checklist: light metal / paper well, gem fills.
 */
"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
import { effectivePriorityWeight, habitCellRatio } from "@/lib/habit-priority"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { exemptionHeatTitle, isExemptKind, loggedExemptionDay, type ExemptionKind } from "@/lib/habit-exemption"
import { format } from "date-fns"

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

function monthColumns(asOf: Date, count: number): HeatmapColumn[] {
  return getPrecedingMonthStarts(asOf, count).map((start) => ({
    key: formatLocalMonthKey(start),
    date: start,
    label: format(start, "MMM"),
    sub: format(start, "yy"),
  }))
}

function cellFill(ratio: number): string {
  if (ratio <= 0) return "transparent"
  if (ratio >= 1) return "linear-gradient(135deg, #8cd4a5, #c9f0d8)"
  if (ratio >= 0.75) return "linear-gradient(135deg, #8b7ecc, #d4c4e8)"
  if (ratio >= 0.5) return "linear-gradient(135deg, #5f756d, #adc29f)"
  if (ratio >= 0.25) return "linear-gradient(135deg, #571833, #8b7ecc)"
  return "linear-gradient(135deg, #404040, #6b6b6b)"
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
}: HabitHeatmapProps) {
  const [span, setSpan] = useState(frequency === "daily" ? 42 : 16)
  const scroller = useRef<HTMLDivElement>(null)
  const pendingRestore = useRef<number | null>(null)
  const didInitScroll = useRef(false)

  const columns =
    frequency === "monthly"
      ? monthColumns(asOf, span)
      : frequency === "weekly"
        ? weekColumns(asOf, span)
        : dailyColumns(asOf, span)

  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (pendingRestore.current !== null) {
      el.scrollLeft = el.scrollWidth - pendingRestore.current
      pendingRestore.current = null
      return
    }
    if (!didInitScroll.current) {
      el.scrollLeft = el.scrollWidth
      didInitScroll.current = true
    }
  }, [span, columns.length])

  useEffect(() => {
    didInitScroll.current = false
    setSpan(frequency === "daily" ? 42 : 16)
  }, [frequency])

  const onScroll = () => {
    const el = scroller.current
    if (!el || el.scrollLeft > 24) return
    pendingRestore.current = el.scrollWidth - el.scrollLeft
    setSpan((n) => n + (frequency === "daily" ? 28 : 12))
  }

  const shown =
    hideCompleted && focusKey
      ? tasks.filter((task) => {
          const kind = exemptionKindFor?.(task, focusKey)
          if (isExemptKind(kind)) return false
          const column = columns.find((col) => col.key === focusKey)
          return !isHabitGoalMet(task, data[focusKey]?.[task.id], {
            date: column?.date ?? asOf,
            weeklyData: data,
          })
        })
      : tasks

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No habits yet. Add one to get started.</p>
  }

  return (
    <div className="habit-heat" aria-label={exemptionWand ? "Exemption wand" : "Habit heatmap"}>
      <div className="habit-heat-scroll" ref={scroller} onScroll={onScroll}>
        <div className="habit-heat-grid" style={{ gridTemplateColumns: `10rem repeat(${columns.length}, 20px)` }}>
          <div className="habit-heat-corner" />
          {columns.map((col) => (
            <div
              key={col.key}
              className={`habit-heat-head ${isToday(col.date) ? "is-today" : ""}`}
              title={`${col.sub} ${col.label}`}
            >
              <span>{col.label}</span>
            </div>
          ))}
          {shown.map((task) => {
            const weight = effectivePriorityWeight(task, data, asOf, frequency)
            return (
              <HeatmapRow
                key={task.id}
                task={task}
                columns={columns}
                data={data}
                weight={weight}
                onEdit={() => onEditTask(task)}
                exemptionWand={exemptionWand}
                exemptionKindFor={exemptionKindFor}
                onToggleExempt={onToggleExempt}
                frequency={frequency}
              />
            )
          })}
        </div>
      </div>
      <p className="habit-heat-hint">
        {exemptionWand
          ? "Grey squares are exempt. Click a square to waive or restore that period."
          : `Scroll left for older ${frequency === "monthly" ? "months" : frequency === "weekly" ? "weeks" : "days"}. Squares fill with how complete that period was.`}
      </p>
    </div>
  )
}

function HeatmapRow({
  task,
  columns,
  data,
  weight,
  onEdit,
  exemptionWand = false,
  exemptionKindFor,
  onToggleExempt,
  frequency,
}: {
  task: WeeklyTask
  columns: HeatmapColumn[]
  data: WeeklyData
  weight: number
  onEdit: () => void
  exemptionWand?: boolean
  exemptionKindFor?: (task: WeeklyTask, periodKey: string) => ExemptionKind
  onToggleExempt?: (taskId: string, periodKey: string, exempt: boolean) => void
  frequency: HabitFrequency
}) {
  return (
    <>
      <button type="button" className="habit-heat-name" onClick={onEdit} title="Edit habit">
        <span>{task.name}</span>
        {weight > 0 && <em>×{weight}</em>}
      </button>
      {columns.map((col) => {
        const kind = exemptionKindFor?.(task, col.key) ?? "required"
        const exempt = isExemptKind(kind)
        if (exempt || (exemptionWand && onToggleExempt)) {
          const logDay = kind === "logged" ? loggedExemptionDay(task, col.key, frequency) : null
          const title = exemptionHeatTitle(task.name, kind, logDay)
          const className = `habit-heat-cell${exempt ? " is-exempt" : ""} ${isToday(col.date) ? "is-today" : ""}`
          if (exemptionWand && onToggleExempt) {
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
          return <div key={col.key} className={className} title={title} aria-label={title} />
        }
        const ratio = habitCellRatio(task, data[col.key]?.[task.id], data, col.date)
        return (
          <div
            key={col.key}
            className={`habit-heat-cell ${ratio > 0 ? "is-lit" : ""} ${ratio >= 1 ? "is-full" : ""} ${isToday(col.date) ? "is-today" : ""}`}
            style={{ ["--hab-heat-fill" as string]: cellFill(ratio) }}
            title={`${task.name} · ${format(col.date, "EEE MMM d")} · ${Math.round(ratio * 100)}%`}
          />
        )
      })}
    </>
  )
}
