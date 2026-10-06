/**
 * components/Analytics/period-delta.ts — Current vs previous window pen deltas
 *
 * Comparison math only. The previous calendar window comes from
 * `previousAnalyticsWindow` in analytics-range.ts (same stepper as the range
 * bar) — do not invent a second calendar here.
 *
 * Pure: no store.
 */
import { formatDuration } from "@/lib/time-entries"
import type { TrackingSlice } from "@/lib/tracking-summary"

export type PeriodDeltaRow = {
  id: string
  name: string
  color: string
  currentMinutes: number
  previousMinutes: number
  deltaMinutes: number
  /** Signed percent vs previous total, or null when previous is 0 and current is not ("new"). */
  deltaPercent: number | null
  isNew: boolean
  isSame: boolean
}

export function comparePenMinutes(
  current: readonly Pick<TrackingSlice, "id" | "name" | "color" | "minutes">[],
  previous: readonly Pick<TrackingSlice, "id" | "name" | "color" | "minutes">[],
): PeriodDeltaRow[] {
  const byId = new Map<string, PeriodDeltaRow>()

  for (const slice of previous) {
    byId.set(slice.id, {
      id: slice.id,
      name: slice.name,
      color: slice.color,
      currentMinutes: 0,
      previousMinutes: slice.minutes,
      deltaMinutes: -slice.minutes,
      deltaPercent: slice.minutes === 0 ? null : -100,
      isNew: false,
      isSame: slice.minutes === 0,
    })
  }

  for (const slice of current) {
    const prev = byId.get(slice.id)
    if (!prev) {
      byId.set(slice.id, {
        id: slice.id,
        name: slice.name,
        color: slice.color,
        currentMinutes: slice.minutes,
        previousMinutes: 0,
        deltaMinutes: slice.minutes,
        deltaPercent: null,
        isNew: slice.minutes > 0,
        isSame: slice.minutes === 0,
      })
      continue
    }
    prev.name = slice.name
    prev.color = slice.color
    prev.currentMinutes = slice.minutes
    prev.deltaMinutes = slice.minutes - prev.previousMinutes
    prev.isNew = prev.previousMinutes === 0 && slice.minutes > 0
    prev.isSame = prev.deltaMinutes === 0
    prev.deltaPercent =
      prev.previousMinutes === 0 ? null : (prev.deltaMinutes / prev.previousMinutes) * 100
  }

  return [...byId.values()].sort((a, b) => {
    const absA = Math.abs(a.deltaMinutes)
    const absB = Math.abs(b.deltaMinutes)
    if (absA !== absB) return absB - absA
    if (a.isSame !== b.isSame) return a.isSame ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

export function formatSignedDuration(deltaMinutes: number): string {
  if (deltaMinutes === 0) return "same"
  const sign = deltaMinutes > 0 ? "+" : "−"
  return `${sign}${formatDuration(Math.abs(deltaMinutes))}`
}

export function formatDeltaPercent(row: PeriodDeltaRow): string {
  if (row.isSame) return "same"
  if (row.isNew || (row.previousMinutes === 0 && row.currentMinutes > 0)) return "new"
  if (row.deltaPercent == null) return "—"
  const sign = row.deltaPercent > 0 ? "+" : row.deltaPercent < 0 ? "−" : ""
  return `${sign}${Math.abs(row.deltaPercent).toFixed(0)}%`
}

/** One-line hint for the up/down plate. */
export function previousWindowHint(previousKeys: readonly string[]): string {
  if (previousKeys.length === 0) return "Against the previous period"
  const n = previousKeys.length
  const from = previousKeys[0]
  const to = previousKeys[previousKeys.length - 1]
  return `Against the previous ${n} days (${from} – ${to})`
}
