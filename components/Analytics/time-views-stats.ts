/**
 * components/Analytics/time-views-stats.ts — Small pure helpers for Time →
 * Places, People, Mood field and Diversity.
 *
 * Kept apart from the views so the math is testable without a render.
 * Docs: `docs/analytics/time-places.md`, `time-people.md`, `time-mood-field.md`,
 * `time-diversity.md`.
 */
import type { TimeEntry } from "@/lib/time-entries"
import { entryMinutes } from "./hour-day"

/** How many of the largest totals it takes to reach `share` (0–1) of the sum. 0 when the sum is 0. */
export function coverCount(minutes: readonly number[], share: number): number {
  const sorted = minutes.filter((m) => m > 0).sort((a, b) => b - a)
  const total = sorted.reduce((s, m) => s + m, 0)
  if (!total) return 0
  const goal = Math.min(1, Math.max(0, share)) * total
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    run += sorted[i]
    if (run >= goal - 1e-9) return i + 1
  }
  return sorted.length
}

/** Effective number of equal pens for an entropy in bits (2^H, Hill number of order 1). */
export function effectiveCount(bits: number): number {
  return Math.pow(2, Math.max(0, bits))
}

/** Share of the largest total (0–1). */
export function topShare(minutes: readonly number[]): number {
  const total = minutes.reduce((s, m) => s + Math.max(0, m), 0)
  return total ? Math.max(0, ...minutes) / total : 0
}

export interface WeekPenGrid {
  /** First date key of each 7-day ring, oldest first. */
  weeks: string[]
  /** Pen ids, largest window total first. */
  pens: { id: string; minutes: number }[]
  /** cells[week][pen] minutes. */
  cells: number[][]
  max: number
}

/**
 * Minutes per pen per 7-day slice of the window (slices start at dateKeys[0],
 * not on a weekday). Top `limit` pens by window minutes. Instants count 0.
 */
export function weekPenGrid(entries: readonly TimeEntry[], dateKeys: readonly string[], limit = 12): WeekPenGrid {
  const index = new Map(dateKeys.map((d, i) => [d, Math.floor(i / 7)]))
  const weekCount = Math.ceil(dateKeys.length / 7)
  const byPen = new Map<string, number[]>()
  for (const e of entries) {
    const w = index.get(e.date)
    const m = entryMinutes(e)
    if (w === undefined || m <= 0) continue
    const row = byPen.get(e.penId) ?? Array.from({ length: weekCount }, () => 0)
    row[w] += m
    byPen.set(e.penId, row)
  }
  const pens = [...byPen.entries()]
    .map(([id, row]) => ({ id, minutes: row.reduce((s, n) => s + n, 0) }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit)
  const cells = Array.from({ length: weekCount }, (_, w) => pens.map((p) => byPen.get(p.id)![w]))
  const weeks = Array.from({ length: weekCount }, (_, w) => dateKeys[w * 7])
  return { weeks, pens, cells, max: Math.max(0, ...cells.flat()) }
}

export interface PenTile {
  penId: string
  minutes: number
  blocks: number
  days: number
  first: string
  last: string
}

/** One tile per pen painted in `entries`: minutes, blocks, distinct days, first and last date. */
export function penTiles(entries: readonly TimeEntry[]): PenTile[] {
  const map = new Map<string, PenTile & { daySet: Set<string> }>()
  for (const e of entries) {
    const m = entryMinutes(e)
    if (m <= 0) continue
    const t = map.get(e.penId) ?? {
      penId: e.penId,
      minutes: 0,
      blocks: 0,
      days: 0,
      first: e.date,
      last: e.date,
      daySet: new Set<string>(),
    }
    t.minutes += m
    t.blocks += 1
    t.daySet.add(e.date)
    if (e.date < t.first) t.first = e.date
    if (e.date > t.last) t.last = e.date
    map.set(e.penId, t)
  }
  return [...map.values()]
    .map(({ daySet, ...t }) => ({ ...t, days: daySet.size }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** Mean entropy split by weekday (Mon–Fri) and weekend, over days with paint only. */
export function entropyByDayType(days: readonly { date: string; entropy: number; minutes: number }[]): {
  weekday: number | null
  weekend: number | null
} {
  const wd: number[] = []
  const we: number[] = []
  for (const d of days) {
    if (d.minutes <= 0) continue
    const [y, m, dd] = d.date.split("-").map(Number)
    const dow = new Date(y, m - 1, dd).getDay()
    ;(dow === 0 || dow === 6 ? we : wd).push(d.entropy)
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  return { weekday: avg(wd), weekend: avg(we) }
}
