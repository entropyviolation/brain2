/**
 * components/Analytics/hour-day.ts — Hour × day occupancy for Tracking scopes
 *
 * Pure. Instants have no duration and stay off the heatmap (listed separately).
 * Missing hours stay 0 (a real empty hour), not null — occupancy is observed
 * as soon as the day has any paint in the scope. Overlapping blocks on the
 * same minute count once, so an hour stays at most 60. A pen's hour column
 * still adds that occupancy across days.
 */
import type { TimeEntry } from "@/lib/time-entries"

export const HOURS = Array.from({ length: 24 }, (_, h) => h)

export interface HourDayGrid {
  dates: readonly string[]
  /** minutes[dateIndex][hour] */
  minutes: number[][]
  max: number
  observedDays: number
  instants: TimeEntry[]
  secondaryMinutes: number
}

export function entryMinutes(entry: Pick<TimeEntry, "kind" | "startMin" | "endMin">): number {
  if (entry.kind === "instant") return 0
  return Math.max(0, entry.endMin - entry.startMin)
}

export function overlapMinutes(startMin: number, endMin: number, hour: number): number {
  const hourStart = hour * 60
  const hourEnd = hourStart + 60
  const a = Math.max(startMin, hourStart)
  const b = Math.min(endMin, hourEnd)
  return Math.max(0, b - a)
}

const MINUTES_PER_DAY = 24 * 60

/** Mark each occupied minute once. Overlapping blocks do not raise the count. */
function paintOccupied(into: Uint8Array, startMin: number, endMin: number) {
  const from = Math.max(0, Math.min(MINUTES_PER_DAY, startMin))
  const to = Math.max(from, Math.min(MINUTES_PER_DAY, endMin))
  for (let m = from; m < to; m++) into[m] = 1
}

function occupiedInHour(day: Uint8Array, hour: number): number {
  const start = hour * 60
  let count = 0
  for (let m = start; m < start + 60; m++) count += day[m]
  return count
}

export function buildHourDayGrid(
  entries: readonly TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
): HourDayGrid {
  const keySet = new Set(dateKeys)
  const index = new Map(dateKeys.map((key, i) => [key, i]))
  const minutes = dateKeys.map(() => HOURS.map(() => 0))
  const occupied = dateKeys.map(() => new Uint8Array(MINUTES_PER_DAY))
  const instants: TimeEntry[] = []
  let secondaryMinutes = 0

  for (const entry of entries) {
    if (entry.scopeId !== scopeId) continue
    if (!keySet.has(entry.date)) continue
    const di = index.get(entry.date)
    if (di === undefined) continue
    if (entry.kind === "instant") {
      instants.push(entry)
      continue
    }
    const span = entryMinutes(entry)
    if (span <= 0) continue
    if ((entry.secondaryPenIds?.length ?? 0) > 0) secondaryMinutes += span
    paintOccupied(occupied[di], entry.startMin, entry.endMin)
  }

  for (let di = 0; di < occupied.length; di++) {
    for (const hour of HOURS) minutes[di][hour] = occupiedInHour(occupied[di], hour)
  }

  let max = 0
  let observedDays = 0
  for (const row of minutes) {
    const dayTotal = row.reduce((s, n) => s + n, 0)
    if (dayTotal > 0) observedDays++
    for (const n of row) if (n > max) max = n
  }

  return { dates: dateKeys, minutes, max, observedDays, instants, secondaryMinutes }
}

export function hourLabel(hour: number): string {
  if (hour === 0) return "12a"
  if (hour < 12) return `${hour}a`
  if (hour === 12) return "12p"
  return `${hour - 12}p`
}

export interface HourPenRow {
  id: string
  name: string
  color: string
  hours: number[]
  total: number
}

/**
 * Hour-of-day occupancy per pen (small multiples). Minutes overlap an hour
 * the same way as the hour×day grid. Top `limit` pens by total minutes.
 */
export function buildHourPenRows(
  entries: readonly TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
  pens: { id: string; name: string; color: string }[],
  limit = 8,
): { rows: HourPenRow[]; max: number } {
  const keySet = new Set(dateKeys)
  const byPenDay = new Map<string, Map<string, Uint8Array>>()
  for (const entry of entries) {
    if (entry.scopeId !== scopeId || !keySet.has(entry.date) || entry.kind === "instant") continue
    if (entry.endMin <= entry.startMin) continue
    let days = byPenDay.get(entry.penId)
    if (!days) {
      days = new Map()
      byPenDay.set(entry.penId, days)
    }
    let bits = days.get(entry.date)
    if (!bits) {
      bits = new Uint8Array(MINUTES_PER_DAY)
      days.set(entry.date, bits)
    }
    paintOccupied(bits, entry.startMin, entry.endMin)
  }
  const byPen = new Map<string, number[]>()
  for (const [penId, days] of byPenDay) {
    const hours = HOURS.map(() => 0)
    for (const bits of days.values()) {
      for (const hour of HOURS) hours[hour] += occupiedInHour(bits, hour)
    }
    byPen.set(penId, hours)
  }
  const named = pens.map((p) => {
    const hours = byPen.get(p.id) ?? HOURS.map(() => 0)
    return { ...p, hours, total: hours.reduce((s, n) => s + n, 0) }
  })
  const extra = [...byPen.entries()]
    .filter(([id]) => !pens.some((p) => p.id === id))
    .map(([id, hours]) => ({
      id,
      name: id,
      color: "#64748b",
      hours,
      total: hours.reduce((s, n) => s + n, 0),
    }))
  const rows = [...named, ...extra]
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
  const max = Math.max(0, ...rows.flatMap((r) => r.hours))
  return { rows, max }
}

/**
 * Cleveland cycle plot: mean occupancy by hour, small-multiplied by weekday
 * (0 = Sunday). Blank weekdays stay 0, not imputed.
 */
export function buildWeekdayHourCycle(
  entries: readonly TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
): { mean: number[][]; days: number[]; max: number } {
  const keySet = new Set(dateKeys)
  const sums = Array.from({ length: 7 }, () => HOURS.map(() => 0))
  const days = Array.from({ length: 7 }, () => 0)
  const seen = new Set<string>()
  const grid = buildHourDayGrid(entries, dateKeys, scopeId)
  for (let di = 0; di < dateKeys.length; di++) {
    const key = dateKeys[di]
    if (!keySet.has(key)) continue
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
    const wd = d.getDay()
    const row = grid.minutes[di]
    const dayTotal = row.reduce((s, n) => s + n, 0)
    if (dayTotal <= 0) continue
    if (!seen.has(key)) {
      days[wd]++
      seen.add(key)
    }
    for (const hour of HOURS) sums[wd][hour] += row[hour]
  }
  const mean = sums.map((row, wd) => row.map((n) => (days[wd] ? n / days[wd] : 0)))
  const max = Math.max(0, ...mean.flat())
  return { mean, days, max }
}

/** Count pen-changes by the start hour of the incoming block. Instants ignored. */
export function switchCountsByHour(
  entries: readonly TimeEntry[],
  dateKeys: readonly string[],
  scopeId: string,
): number[] {
  const hours = HOURS.map(() => 0)
  const keySet = new Set(dateKeys)
  const byDay = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    if (entry.scopeId !== scopeId || !keySet.has(entry.date) || entry.kind === "instant") continue
    const list = byDay.get(entry.date) ?? []
    list.push(entry)
    byDay.set(entry.date, list)
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startMin - b.startMin)
    for (let i = 1; i < list.length; i++) {
      if (list[i].penId === list[i - 1].penId) continue
      const hour = Math.min(23, Math.max(0, Math.floor(list[i].startMin / 60)))
      hours[hour]++
    }
  }
  return hours
}
