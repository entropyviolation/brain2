/**
 * components/Analytics/log-event-stats.ts — Counts and clocks for Tracking log
 *
 * Pure. Unknown clocks are a count, never a point at the stored minute.
 * The phase strip is labeled from bleed days and ovulation marks.
 */
import type { CycleDayMark } from "@/lib/cycle-marks"
import { phaseForDate, type CyclePhase } from "@/lib/cycle-phase"
import type { TrackingClockCertainty } from "@/lib/time-entries"

export type LogEventPoint = {
  id: string
  date: string
  startMin: number
  kindKey: string
  clockCertainty?: TrackingClockCertainty
}

export type LogDayCount = { date: string; count: number }
export type LogKindCount = { kind: string; count: number }
export type LogClockPoint = { id: string; date: string; minute: number; kind: string }
export type LogPhaseCell = { date: string; phase: CyclePhase }

export function countLogEventsByDay(points: readonly LogEventPoint[], dateKeys: readonly string[]): LogDayCount[] {
  return dateKeys.map((date) => ({
    date,
    count: points.filter((point) => point.date === date).length,
  }))
}

export function countLogEventsByKind(points: readonly LogEventPoint[]): LogKindCount[] {
  const counts = new Map<string, number>()
  for (const point of points) counts.set(point.kindKey, (counts.get(point.kindKey) ?? 0) + 1)
  return [...counts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}

/** Exact and estimated (and omitted) clocks only. Unknown stays a separate count. */
export function logClockScatter(points: readonly LogEventPoint[]): {
  points: LogClockPoint[]
  unknownCount: number
} {
  const plotted: LogClockPoint[] = []
  let unknownCount = 0
  for (const point of points) {
    if (point.clockCertainty === "unknown") {
      unknownCount += 1
      continue
    }
    plotted.push({ id: point.id, date: point.date, minute: point.startMin, kind: point.kindKey })
  }
  return { points: plotted, unknownCount }
}

export function logPhaseStrip(dateKeys: readonly string[], marksByDate: Record<string, CycleDayMark>): LogPhaseCell[] {
  return dateKeys.map((date) => ({ date, phase: phaseForDate(date, marksByDate) }))
}
