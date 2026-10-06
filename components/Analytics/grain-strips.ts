/**
 * components/Analytics/grain-strips.ts — One color per day, one color per week
 *
 * The period filmstrip is minute paint. These strips answer a coarser question
 * with the same blocks: which pen, at the current display depth, occupied the
 * most minutes of this day or this week?
 *
 * Occupancy matches the time grid: `minuteMap` gives each minute one owner, so
 * overlapping blocks do not vote twice. Instants have no duration and stay off
 * the strip. An empty day stays a blank cell so the row is still the calendar.
 */
import { formatLocalDateKey, getWeekStartDate, parseLocalDate } from "@/lib/date-utils"
import { penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import { MINUTES_PER_DAY, minuteMap, type TimeEntry } from "@/lib/time-entries"

export type GrainPen = {
  id: string
  name: string
  color: string
  parentId?: string
  parentIds?: string[]
}

export type GrainCell = {
  /** Day key, or the Monday of the week (`YYYY-MM-DD`). */
  key: string
  penId: string | null
  penName: string
  color: string
  minutes: number
}

function weekKey(dateKey: string): string {
  const parsed = parseLocalDate(dateKey)
  if (!parsed) return dateKey
  return formatLocalDateKey(getWeekStartDate(parsed))
}

function tally(
  dateKeys: readonly string[],
  entries: readonly TimeEntry[],
  pens: readonly GrainPen[],
  depth: DisplayDepth,
  scopeId: string,
  bucketOf: (date: string) => string,
): Map<string, Map<string, number>> {
  const byBucket = new Map<string, Map<string, number>>()
  for (const date of dateKeys) {
    const bucket = bucketOf(date)
    let counts = byBucket.get(bucket)
    if (!counts) {
      counts = new Map()
      byBucket.set(bucket, counts)
    }
    const owners = minuteMap(entries as TimeEntry[], date, scopeId)
    for (let minute = 0; minute < MINUTES_PER_DAY; minute++) {
      const owner = owners[minute]
      if (!owner) continue
      const shown = penAtDepth(pens, owner.penId, depth)
      const penId = shown?.id ?? owner.penId
      counts.set(penId, (counts.get(penId) ?? 0) + 1)
    }
  }
  return byBucket
}

function cellFor(key: string, counts: Map<string, number> | undefined, pens: readonly GrainPen[]): GrainCell {
  if (!counts || counts.size === 0) {
    return { key, penId: null, penName: "Empty", color: "", minutes: 0 }
  }
  const order = new Map(pens.map((pen, index) => [pen.id, index]))
  let bestId: string | null = null
  let bestMinutes = 0
  for (const [id, minutes] of counts) {
    if (minutes <= 0) continue
    const better =
      minutes > bestMinutes ||
      (minutes === bestMinutes &&
        bestId !== null &&
        (order.get(id) ?? Number.MAX_SAFE_INTEGER) < (order.get(bestId) ?? Number.MAX_SAFE_INTEGER))
    if (bestId === null || better) {
      bestId = id
      bestMinutes = minutes
    }
  }
  const pen = pens.find((item) => item.id === bestId)
  return {
    key,
    penId: bestId,
    penName: pen?.name ?? bestId ?? "Empty",
    color: pen?.color ?? "#94a3b8",
    minutes: bestMinutes,
  }
}

/** One cell per date in `dateKeys`, oldest first. */
export function buildDayGrain(opts: {
  dateKeys: readonly string[]
  entries: readonly TimeEntry[]
  pens: readonly GrainPen[]
  depth: DisplayDepth
  scopeId: string
}): GrainCell[] {
  const counts = tally(opts.dateKeys, opts.entries, opts.pens, opts.depth, opts.scopeId, (date) => date)
  return opts.dateKeys.map((date) => cellFor(date, counts.get(date), opts.pens))
}

/**
 * One cell per Monday that `dateKeys` touches, oldest first.
 * A week is colored by minutes across its days in the window, not by which
 * day-cell won.
 */
export function buildWeekGrain(opts: {
  dateKeys: readonly string[]
  entries: readonly TimeEntry[]
  pens: readonly GrainPen[]
  depth: DisplayDepth
  scopeId: string
}): GrainCell[] {
  const weeks: string[] = []
  const seen = new Set<string>()
  for (const date of opts.dateKeys) {
    const key = weekKey(date)
    if (seen.has(key)) continue
    seen.add(key)
    weeks.push(key)
  }
  const counts = tally(opts.dateKeys, opts.entries, opts.pens, opts.depth, opts.scopeId, weekKey)
  return weeks.map((key) => cellFor(key, counts.get(key), opts.pens))
}
