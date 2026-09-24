/**
 * components/Home/Tracking/infinite-window.ts — Stable window math for the strip
 *
 * The paged grid remounts around "today". This strip must not: origin is frozen
 * at mount, selected date is only a highlight, and the DOM is a virtual window
 * over a date-indexed map. Prepending days restores scrollTop by the height
 * added so the IntersectionObserver cannot chase its own sentinel.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"

export const INFINITE_DAY_BEFORE = 14
export const INFINITE_DAY_AFTER = 7
export const INFINITE_WEEK_BEFORE = 21
export const INFINITE_WEEK_AFTER = 14
export const INFINITE_MAX_BEFORE = 400
export const INFINITE_MAX_AFTER = 90
export const INFINITE_OVERSCAN_PX = 240
/** Finest cell the strip will draw — 1m/5m rows are too many DOM nodes to stay still. */
export const INFINITE_MIN_CELL = 15

export type StripMode = "day" | "week"

export type StripItem =
  | { kind: "band"; key: string; label: string; date: Date }
  | { kind: "day"; key: string; date: Date }

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function mondayOf(date: Date): Date {
  const next = startOfDay(date)
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7))
  return next
}

export function daysInRange(origin: Date, before: number, after: number): Date[] {
  const start = startOfDay(origin)
  const list: Date[] = []
  for (let i = -before; i <= after; i++) list.push(addDays(start, i))
  return list
}

export function infiniteCellStep(gridStep: number): number {
  return gridStep >= INFINITE_MIN_CELL ? gridStep : INFINITE_MIN_CELL
}

export function cellsPerDay(step: number): number {
  return MINUTES_PER_DAY / step
}

export function stripItems(days: Date[], mode: StripMode): StripItem[] {
  if (mode !== "week") {
    return days.map((date) => ({ kind: "day" as const, key: formatLocalDateKey(date), date }))
  }
  const items: StripItem[] = []
  let bandLabel = ""
  for (const date of days) {
    const start = mondayOf(date)
    const label = `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    if (label !== bandLabel) {
      bandLabel = label
      items.push({ kind: "band", key: `band-${formatLocalDateKey(start)}`, label, date: start })
    }
    items.push({ kind: "day", key: formatLocalDateKey(date), date })
  }
  return items
}

export function itemHeight(item: StripItem, dayH: number, bandH: number): number {
  return item.kind === "band" ? bandH : dayH
}

/** Prefix offsets, last value = total height. */
export function prefixHeights(items: StripItem[], dayH: number, bandH: number): number[] {
  const out = [0]
  let sum = 0
  for (const item of items) {
    sum += itemHeight(item, dayH, bandH)
    out.push(sum)
  }
  return out
}

export function visibleSlice(
  prefix: number[],
  scrollTop: number,
  viewportH: number,
  overscanPx = INFINITE_OVERSCAN_PX,
): { start: number; end: number } {
  const n = Math.max(0, prefix.length - 1)
  if (n === 0) return { start: 0, end: 0 }
  const lo = Math.max(0, scrollTop - overscanPx)
  const hi = scrollTop + Math.max(1, viewportH) + overscanPx
  let start = 0
  while (start < n && prefix[start + 1] <= lo) start++
  let end = start
  while (end < n && prefix[end] < hi) end++
  return { start, end }
}

export function restoreScrollAfterPrepend(prevHeight: number, nextHeight: number, prevScrollTop: number): number {
  return prevScrollTop + Math.max(0, nextHeight - prevHeight)
}

export function indexScopeEntriesByDate(entries: TimeEntry[], scopeId: string): Map<string, TimeEntry[]> {
  const map = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    if (entry.scopeId !== scopeId) continue
    const list = map.get(entry.date)
    if (list) list.push(entry)
    else map.set(entry.date, [entry])
  }
  return map
}

export function clampRange(before: number, after: number, mode: StripMode): { before: number; after: number } {
  const stepBefore = mode === "week" ? INFINITE_WEEK_BEFORE : INFINITE_DAY_BEFORE
  const stepAfter = mode === "week" ? INFINITE_WEEK_AFTER : INFINITE_DAY_AFTER
  return {
    before: Math.min(INFINITE_MAX_BEFORE, Math.max(stepBefore, before)),
    after: Math.min(INFINITE_MAX_AFTER, Math.max(stepAfter, after)),
  }
}
