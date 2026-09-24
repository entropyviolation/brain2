/**
 * lib/tracking-summary.ts — One set of numbers for every tracking view
 *
 * The Time Grid footer, the Activity Log, and the Analytics Tracking tab all used
 * to total time their own way, so the same day could read differently depending on
 * where you looked. Every one of them now calls this module, so a disagreement is
 * a bug in one place rather than a discrepancy between three.
 *
 * Occupancy (`totalsFor`, `uniqueMinutes`) is a union: two blocks on the same
 * minute — typically derived Sleep sitting on Work that was already there —
 * count once. Summing durations is how a day reported 30 hours and 128%.
 *
 * ## Variants and why there are two breakdowns
 *
 * A pen may carry several variants over the same minutes — an hour of "Hanging
 * out" can be with Elijah *and* Rebecca. That makes two different, both-correct
 * questions:
 *
 * - **Reach** (`variantTotals`): how much of the pen's time included Elijah?
 *   Overlapping, so these can add up to more than the pen's total. Read as bars.
 * - **Split** (`combinationTotals`): each distinct set of variants is counted
 *   once, so "Elijah only / Rebecca only / both / unlabeled" partitions the pen
 *   exactly. Read as a pie, because it genuinely sums to 100%.
 *
 * ## Categories and display depth
 *
 * Pens can nest (`parentId`). `penTotals` uses the scope's `displayDepth` so the
 * Time Grid footer, Activity Log, Day Log and Analytics Tracking tab all roll up
 * the same way. `penTotalsAtDepth` takes an explicit depth (Analytics' own
 * control). `childPenTotals` is the drill: minutes under a parent, grouped by
 * the next child.
 *
 * `withPrecision(entries, includeSpeculative)` drops `precision: "estimated"`
 * blocks when Analytics asks for observed time only.
 *
 * Pure: takes entries and pen definitions, touches no store.
 */
import { assignedPenIds, entriesForDay, entryMinutes, isSpeculative, MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { childrenOf, penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import { effectiveTagIds } from "@/lib/tracked-time"
import type { TrackPen, TrackScope, TrackTag } from "@/lib/time-tracking-store"

export interface TrackingSlice {
  id: string
  name: string
  color: string
  minutes: number
  /** Share of the tracked total this slice belongs to, 0–100. */
  percentOfTracked: number
  /** Share of the whole period including untracked time, 0–100. */
  percentOfPeriod: number
}

export interface TrackingTotals {
  /** Minutes with a pen on them. Overlapping blocks on the same minute count once. */
  tracked: number
  /** Minutes in the period with nothing painted. */
  untracked: number
  /** Days the period spans. */
  days: number
  /** Days holding at least one entry. */
  daysWithData: number
  /** Tracked minutes ÷ days. */
  averagePerDay: number
  /** Tracked ÷ period, 0–100. */
  coverage: number
}

const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)

/**
 * Distinct minutes these blocks cover.
 *
 * A scope can hold two records of the same minute — derived Sleep sitting on
 * top of Work the user already painted, which `applySleepEntries` refuses to
 * delete. Summing durations then reports 30 hours in a 24-hour day and 128%
 * coverage. "% of the day" is occupancy, so overlapping blocks count once,
 * the same way the grid draws them.
 */
export function uniqueMinutes(entries: TimeEntry[], dateKeys?: string[]): number {
  const wanted = dateKeys?.length ? new Set(dateKeys) : null
  const minutes = new Set<string>()
  for (const e of entries) {
    if (wanted && !wanted.has(e.date)) continue
    const from = Math.max(0, e.startMin)
    const to = Math.min(MINUTES_PER_DAY, e.endMin)
    for (let m = from; m < to; m++) minutes.add(`${e.date}#${m}`)
  }
  return minutes.size
}

/** Occupancy per calendar day — the number under each week-grid column. */
export function uniqueMinutesByDate(entries: TimeEntry[]): Record<string, number> {
  const sets = new Map<string, Set<number>>()
  for (const e of entries) {
    let set = sets.get(e.date)
    if (!set) {
      set = new Set()
      sets.set(e.date, set)
    }
    const from = Math.max(0, e.startMin)
    const to = Math.min(MINUTES_PER_DAY, e.endMin)
    for (let m = from; m < to; m++) set.add(m)
  }
  const out: Record<string, number> = {}
  for (const [date, set] of sets) out[date] = set.size
  return out
}

/** Entries for one scope over a list of dates. */
export function entriesInRange(
  entries: TimeEntry[],
  dateKeys: string[],
  scopeId: string,
): TimeEntry[] {
  const wanted = new Set(dateKeys)
  return entries
    .filter((e) => e.scopeId === scopeId && wanted.has(e.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
}

export function totalsFor(entries: TimeEntry[], dateKeys: string[]): TrackingTotals {
  const tracked = uniqueMinutes(entries, dateKeys)
  const days = Math.max(1, dateKeys.length)
  const period = days * MINUTES_PER_DAY
  const inRange = dateKeys.length ? new Set(dateKeys) : null
  const daysWithData = new Set(
    entries.filter((e) => !inRange || inRange.has(e.date)).map((e) => e.date),
  ).size
  return {
    tracked,
    untracked: Math.max(0, period - tracked),
    days: dateKeys.length,
    daysWithData,
    averagePerDay: tracked / days,
    coverage: percent(tracked, period),
  }
}

/** Other views that have paint on this day — used when the current view is empty. */
export function otherScopeOccupancy(
  entries: TimeEntry[],
  scopes: TrackScope[],
  date: string,
  exceptScopeId: string,
): { id: string; name: string; minutes: number }[] {
  return scopes
    .filter((scope) => scope.id !== exceptScopeId)
    .map((scope) => ({
      id: scope.id,
      name: scope.name,
      minutes: totalsFor(entriesForDay(entries, date, scope.id), [date]).tracked,
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
}

/** Minutes per pen, largest first. Uses the view's current display depth. */
export function penTotals(
  entries: TimeEntry[],
  scope: TrackScope | undefined,
  dateKeys: string[],
): TrackingSlice[] {
  return penTotalsAtDepth(entries, scope, dateKeys, scope?.displayDepth ?? null)
}

/**
 * Same occupancy as `penTotals`, grouped by the ancestor at `depth`.
 * `null` is Exact — the painted leaf.
 */
export function penTotalsAtDepth(
  entries: TimeEntry[],
  scope: TrackScope | undefined,
  dateKeys: string[],
  depth: DisplayDepth,
): TrackingSlice[] {
  if (!scope) return []
  const minutes = new Map<string, Set<string>>()
  const wanted = new Set(dateKeys)
  for (const e of entries) {
    if (wanted.size && !wanted.has(e.date)) continue
    for (const penId of assignedPenIds(e)) {
      const shown = penAtDepth(scope.pens, penId, depth)
      const id = shown?.id ?? penId
      let set = minutes.get(id)
      if (!set) {
        set = new Set()
        minutes.set(id, set)
      }
      const from = Math.max(0, e.startMin)
      const to = Math.min(MINUTES_PER_DAY, e.endMin)
      for (let m = from; m < to; m++) set.add(`${e.date}#${m}`)
    }
  }
  const tracked = uniqueMinutes(entries, dateKeys)
  const period = Math.max(1, dateKeys.length) * MINUTES_PER_DAY
  const byId = new Map(scope.pens.map((p) => [p.id, p]))

  return [...minutes.entries()]
    .filter(([, set]) => set.size)
    .map(([id, set]) => {
      const pen = byId.get(id)
      const count = set.size
      return {
        id,
        name: pen?.name ?? id,
        color: pen?.color ?? "#94a3b8",
        minutes: count,
        percentOfTracked: percent(count, tracked),
        percentOfPeriod: percent(count, period),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}

/**
 * Minutes that roll up to `parentId`, grouped by the next child. Time painted
 * on the parent itself (Mexico as Mexico, no city) lands in a slice with the
 * parent's id.
 */
export function childPenTotals(
  entries: TimeEntry[],
  scope: TrackScope | undefined,
  dateKeys: string[],
  parentId: string,
): TrackingSlice[] {
  if (!scope) return []
  const wanted = new Set(dateKeys)
  const minutes = new Map<string, Set<string>>()
  for (const e of entries) {
    if (wanted.size && !wanted.has(e.date)) continue
    for (const penId of assignedPenIds(e)) {
      const shown = penAtDepth(scope.pens, penId, null)
      if (!shown) continue
      // Walk: if this pen or an ancestor is parentId, bucket at the child of parent.
      const chain: string[] = []
      const byId = new Map(scope.pens.map((p) => [p.id, p]))
      let current = byId.get(penId)
      const seen = new Set<string>()
      while (current && !seen.has(current.id)) {
        seen.add(current.id)
        chain.unshift(current.id)
        current = current.parentId ? byId.get(current.parentId) : undefined
      }
      const idx = chain.indexOf(parentId)
      if (idx < 0) continue
      const bucket = chain[idx + 1] ?? parentId
      let set = minutes.get(bucket)
      if (!set) {
        set = new Set()
        minutes.set(bucket, set)
      }
      const from = Math.max(0, e.startMin)
      const to = Math.min(MINUTES_PER_DAY, e.endMin)
      for (let m = from; m < to; m++) set.add(`${e.date}#${m}`)
    }
  }
  const tracked = uniqueMinutes(entries, dateKeys)
  const period = Math.max(1, dateKeys.length) * MINUTES_PER_DAY
  const byId = new Map(scope.pens.map((p) => [p.id, p]))
  const childIds = new Set(childrenOf(scope.pens, parentId).map((p) => p.id))
  childIds.add(parentId)

  return [...minutes.entries()]
    .filter(([, set]) => set.size)
    .map(([id, set]) => {
      const pen = byId.get(id)
      const count = set.size
      const isParentSelf = id === parentId
      return {
        id,
        name: isParentSelf ? `${pen?.name ?? id} (this level)` : (pen?.name ?? id),
        color: pen?.color ?? "#94a3b8",
        minutes: count,
        percentOfTracked: percent(count, tracked),
        percentOfPeriod: percent(count, period),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}

/** Drop reconstructed blocks when Analytics asks for observed time only. */
export function withPrecision(entries: TimeEntry[], includeSpeculative: boolean): TimeEntry[] {
  if (includeSpeculative) return entries
  return entries.filter((e) => !isSpeculative(e))
}

export const UNLABELED_VARIANT_ID = "__unlabeled__"
export const UNLABELED_VARIANT_NAME = "Unlabeled"
const UNLABELED_COLOR = "#94a3b8"

/**
 * **Reach** — minutes of this pen that included each variant. Overlapping blocks
 * are counted under every variant they carry, so these can exceed the pen total;
 * `percentOfTracked` is "share of this pen's time", not a slice of a pie.
 */
export function variantTotals(entries: TimeEntry[], pen: TrackPen | undefined): TrackingSlice[] {
  if (!pen) return []
  const penEntries = entries.filter((e) => assignedPenIds(e).includes(pen.id))
  const penMinutes = penEntries.reduce((sum, e) => sum + entryMinutes(e), 0)
  const minutes = new Map<string, number>()
  let unlabeled = 0

  for (const e of penEntries) {
    // Variants belong to the primary pen. A secondary assignment still counts
    // the minutes, but they are unlabeled for this pen.
    if (e.penId !== pen.id) {
      unlabeled += entryMinutes(e)
      continue
    }
    const ids = e.variantIds ?? []
    if (ids.length === 0) {
      unlabeled += entryMinutes(e)
      continue
    }
    for (const id of ids) minutes.set(id, (minutes.get(id) ?? 0) + entryMinutes(e))
  }

  const slices: TrackingSlice[] = (pen.variants ?? [])
    .filter((v) => minutes.get(v.id))
    .map((v) => ({
      id: v.id,
      name: v.name,
      color: v.color || pen.color,
      minutes: minutes.get(v.id) ?? 0,
      percentOfTracked: percent(minutes.get(v.id) ?? 0, penMinutes),
      percentOfPeriod: 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)

  if (unlabeled > 0) {
    slices.push({
      id: UNLABELED_VARIANT_ID,
      name: UNLABELED_VARIANT_NAME,
      color: UNLABELED_COLOR,
      minutes: unlabeled,
      percentOfTracked: percent(unlabeled, penMinutes),
      percentOfPeriod: 0,
    })
  }
  return slices
}

/**
 * **Split** — one slice per distinct combination of variants ("Elijah", "Elijah +
 * Rebecca", "Unlabeled"). Every minute of the pen lands in exactly one slice, so
 * this is the breakdown that may be drawn as a pie.
 */
export function combinationTotals(entries: TimeEntry[], pen: TrackPen | undefined): TrackingSlice[] {
  if (!pen) return []
  const penEntries = entries.filter((e) => assignedPenIds(e).includes(pen.id))
  const penMinutes = penEntries.reduce((sum, e) => sum + entryMinutes(e), 0)
  const byKey = new Map<string, { name: string; minutes: number; count: number }>()
  const nameOf = (id: string) => pen.variants?.find((v) => v.id === id)?.name ?? "?"

  for (const e of penEntries) {
    const ids = e.penId === pen.id ? [...(e.variantIds ?? [])].sort() : []
    const key = ids.length ? ids.join("+") : UNLABELED_VARIANT_ID
    const name = ids.length ? ids.map(nameOf).join(" + ") : UNLABELED_VARIANT_NAME
    const bucket = byKey.get(key) ?? { name, minutes: 0, count: ids.length }
    bucket.minutes += entryMinutes(e)
    byKey.set(key, bucket)
  }

  const palette = pen.variants ?? []
  return [...byKey.entries()]
    .map(([key, bucket]) => ({
      id: key,
      name: bucket.name,
      // A single-variant slice keeps that variant's color; blends and the
      // unlabeled remainder fall back to the pen and a neutral grey.
      color:
        key === UNLABELED_VARIANT_ID
          ? UNLABELED_COLOR
          : palette.find((v) => v.id === key)?.color || pen.color,
      minutes: bucket.minutes,
      percentOfTracked: percent(bucket.minutes, penMinutes),
      percentOfPeriod: 0,
    }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** Minutes per tag across every scope, de-duplicated per minute. */
export function tagTotals(
  entries: TimeEntry[],
  scopes: TrackScope[],
  tags: TrackTag[],
  dateKeys: string[],
): TrackingSlice[] {
  // A minute painted "Do dishes" in Activity and "Home" in Location, both tagged
  // Cleaning, is one minute of cleaning — so count distinct date+minute pairs.
  const minutesByTag = new Map<string, Set<string>>()
  for (const entry of entries) {
    const entryTags = effectiveTagIds(entry, scopes)
    if (entryTags.length === 0) continue
    for (const tagId of entryTags) {
      const set = minutesByTag.get(tagId) ?? new Set<string>()
      for (let m = entry.startMin; m < entry.endMin; m++) set.add(`${entry.date}#${m}`)
      minutesByTag.set(tagId, set)
    }
  }

  const tracked = entries.reduce((sum, e) => sum + entryMinutes(e), 0)
  const period = Math.max(1, dateKeys.length) * MINUTES_PER_DAY
  return tags
    .filter((tag) => minutesByTag.get(tag.id)?.size)
    .map((tag) => {
      const minutes = minutesByTag.get(tag.id)?.size ?? 0
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        minutes,
        percentOfTracked: percent(minutes, tracked),
        percentOfPeriod: percent(minutes, period),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}

/** Longest unbroken stretch on one pen — "your longest focus block". */
export function longestBlock(entries: TimeEntry[]): TimeEntry | undefined {
  return entries.reduce<TimeEntry | undefined>(
    (best, e) => (!best || entryMinutes(e) > entryMinutes(best) ? e : best),
    undefined,
  )
}

/** Pen changes across a day, as a fragmentation signal. */
export function switchCount(entries: TimeEntry[], date: string, scopeId: string): number {
  const day = entriesForDay(entries, date, scopeId)
  let switches = 0
  for (let i = 1; i < day.length; i++) {
    if (day[i].penId !== day[i - 1].penId) switches++
  }
  return switches
}

/** Local date keys for the N days ending today, oldest first. */
export function recentDateKeys(days: number, today = new Date()): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    )
  }
  return keys
}
