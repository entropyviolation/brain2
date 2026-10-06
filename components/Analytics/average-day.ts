/**
 * components/Analytics/average-day.ts — Average-day ribbons for Tracking
 *
 * Split each sample day into 15-minute slots (96). Attribute each minute to the
 * pen shown at the current display depth (primary pen only — grid color). When
 * Show untracked is on, empty minutes become the Untracked id. Average each
 * pen's minutes per slot across the sample days, then merge adjacent slots that
 * share a single dominant pen for labeling.
 *
 * Pure: no store, no React. The board indexes entries by day once, then paints
 * each sample day from that bucket — same owners and slot means as scanning
 * the full list per day.
 */
import { penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import type { TimeEntry } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"

export const SLOT_MINUTES = 15
export const SLOTS_PER_DAY = 96
export const MINUTES_PER_DAY = 1440

/** Minimum merged width (slots) before a pen name is drawn on the ribbon. */
export const LABEL_MIN_SLOTS = 3

export type PenMeta = { id: string; name: string; color: string }

export type SlotShare = { penId: string; meanMinutes: number }

export type MergedSection = {
  penId: string
  /** Inclusive start slot index 0–95. */
  startSlot: number
  /** Exclusive end slot index 1–96. */
  endSlot: number
  /** Mean minutes of this pen across the merged span (sum of slot means). */
  meanMinutes: number
  /** True when this section is a single-pen run (eligible for an on-ribbon label). */
  sole: boolean
}

export type AverageDayRibbon = {
  id: string
  label: string
  /** Caption like "12 days" / "4 Wednesdays". */
  caption: string
  n: number
  /** Per-slot mean occupancy by pen (stable pen order). */
  slots: SlotShare[][]
  sections: MergedSection[]
}

/** Monday-first weekday index: Mon=0 … Sun=6. */
export function mondayIndex(dateKey: string): number | null {
  const d = parseLocalDate(dateKey)
  if (!d) return null
  return (d.getDay() + 6) % 7
}

export const WEEKDAY_RIBBON_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const WEEKDAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export function weekdayCaption(weekday: number, n: number): string {
  const full = WEEKDAY_FULL[weekday] ?? "day"
  if (n === 0) return `0 ${full}s`
  if (n === 1) return `1 ${full}`
  return `${n} ${full}s`
}

export function allDaysCaption(n: number): string {
  if (n === 0) return "0 days"
  if (n === 1) return "1 day"
  return `${n} days`
}

const EMPTY_DAY: readonly TimeEntry[] = []

/** One pass: date → entries, in input order. Same shape as `dayBuckets` in `lib/time-entries.ts`. */
function indexEntriesByDay(entries: readonly TimeEntry[]): Map<string, TimeEntry[]> {
  const byDate = new Map<string, TimeEntry[]>()
  for (const entry of entries) {
    const bucket = byDate.get(entry.date)
    if (bucket) bucket.push(entry)
    else byDate.set(entry.date, [entry])
  }
  return byDate
}

type PenTree = { id: string; name: string; color: string; parentId?: string }[]

/**
 * Minute → pen id for one day's entries. Later-overlapping primary paint wins
 * (same spirit as the grid). Instants are skipped. Untracked minutes stay null
 * unless `untrackedId` is provided — then nulls become that id.
 */
function ownersFromDayEntries(
  dayEntries: readonly TimeEntry[],
  pens: PenTree,
  depth: DisplayDepth,
  scopeId: string,
  untrackedId?: string | null,
): (string | null)[] {
  const owners: (string | null)[] = Array.from({ length: MINUTES_PER_DAY }, () => null)
  const day = dayEntries
    .filter((e) => e.scopeId === scopeId && e.kind !== "instant")
    .filter((e) => e.endMin > e.startMin)
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  for (const entry of day) {
    const shown = penAtDepth(pens, entry.penId, depth)
    const id = shown?.id ?? entry.penId
    const from = Math.max(0, entry.startMin)
    const to = Math.min(MINUTES_PER_DAY, entry.endMin)
    for (let m = from; m < to; m++) owners[m] = id
  }

  if (untrackedId) {
    for (let m = 0; m < MINUTES_PER_DAY; m++) {
      if (owners[m] == null) owners[m] = untrackedId
    }
  }
  return owners
}

/**
 * Minute → pen id for one calendar day. Later-overlapping primary paint wins
 * (same spirit as the grid). Instants are skipped. Untracked minutes stay null
 * unless `untrackedId` is provided — then nulls become that id.
 */
export function dayMinuteOwners(
  entries: readonly TimeEntry[],
  date: string,
  pens: PenTree,
  depth: DisplayDepth,
  scopeId: string,
  untrackedId?: string | null,
): (string | null)[] {
  const dayEntries: TimeEntry[] = []
  for (const entry of entries) {
    if (entry.date === date) dayEntries.push(entry)
  }
  return ownersFromDayEntries(dayEntries, pens, depth, scopeId, untrackedId)
}

/** Per-slot minute counts by pen for one day. */
export function slotOccupancyFromOwners(owners: readonly (string | null)[]): Map<string, number>[] {
  const slots: Map<string, number>[] = Array.from({ length: SLOTS_PER_DAY }, () => new Map())
  for (let m = 0; m < MINUTES_PER_DAY; m++) {
    const penId = owners[m]
    if (!penId) continue
    const slot = Math.floor(m / SLOT_MINUTES)
    const map = slots[slot]
    map.set(penId, (map.get(penId) ?? 0) + 1)
  }
  return slots
}

/**
 * Average slot occupancy across sample days. `penOrder` is the stable draw /
 * stack order (ranked rows). Empty occupancy stays out of the maps (white well).
 */
export function averageSlotShares(
  daySlots: readonly (readonly Map<string, number>[])[],
  penOrder: readonly string[],
): SlotShare[][] {
  const n = daySlots.length
  if (n === 0) {
    return Array.from({ length: SLOTS_PER_DAY }, () => [])
  }
  return Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
    const means = new Map<string, number>()
    for (const day of daySlots) {
      const map = day[slot]
      if (!map) continue
      for (const [penId, mins] of map) {
        means.set(penId, (means.get(penId) ?? 0) + mins / n)
      }
    }
    const shares: SlotShare[] = []
    for (const penId of penOrder) {
      const meanMinutes = means.get(penId) ?? 0
      if (meanMinutes > 0.001) shares.push({ penId, meanMinutes })
      means.delete(penId)
    }
    // Any pens not in order (shouldn't happen) — append stably by id.
    for (const penId of [...means.keys()].sort()) {
      const meanMinutes = means.get(penId) ?? 0
      if (meanMinutes > 0.001) shares.push({ penId, meanMinutes })
    }
    return shares
  })
}

/** Dominant pen in a slot when it alone accounts for the occupancy. */
export function soleDominantPen(shares: readonly SlotShare[]): string | null {
  const present = shares.filter((s) => s.meanMinutes > 0.001)
  if (present.length !== 1) return null
  return present[0].penId
}

/**
 * Merge adjacent slots that share the same single dominant pen into labeled
 * sections. Multi-pen slots stay as one-slot sections (stacked, no name).
 */
export function mergeDominantSections(slots: readonly SlotShare[][]): MergedSection[] {
  const sections: MergedSection[] = []
  let i = 0
  while (i < slots.length) {
    const sole = soleDominantPen(slots[i])
    if (sole) {
      let j = i + 1
      while (j < slots.length && soleDominantPen(slots[j]) === sole) j++
      let meanMinutes = 0
      for (let k = i; k < j; k++) {
        meanMinutes += slots[k].find((s) => s.penId === sole)?.meanMinutes ?? 0
      }
      sections.push({
        penId: sole,
        startSlot: i,
        endSlot: j,
        meanMinutes,
        sole: true,
      })
      i = j
      continue
    }
    // Multi-pen or empty slot — keep as a single-slot section for stacking.
    const top = slots[i][0]
    if (top) {
      sections.push({
        penId: top.penId,
        startSlot: i,
        endSlot: i + 1,
        meanMinutes: top.meanMinutes,
        sole: false,
      })
    }
    i++
  }
  return sections
}

export function clockLabelForSlot(slot: number): string {
  const mins = Math.min(MINUTES_PER_DAY, Math.max(0, slot * SLOT_MINUTES))
  if (mins === 0 || mins === MINUTES_PER_DAY) return "12a"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? "p" : "a"
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`
}

function ribbonFromDayIndex(opts: {
  id: string
  label: string
  caption: string
  dateKeys: readonly string[]
  byDate: Map<string, TimeEntry[]>
  pens: PenTree
  depth: DisplayDepth
  scopeId: string
  showUntracked: boolean
  untrackedId: string
  penOrder: readonly string[]
}): AverageDayRibbon {
  const { dateKeys, byDate, pens, depth, scopeId, showUntracked, untrackedId, penOrder } = opts
  const untracked = showUntracked ? untrackedId : null
  const daySlots = dateKeys.map((date) =>
    slotOccupancyFromOwners(
      ownersFromDayEntries(byDate.get(date) ?? EMPTY_DAY, pens, depth, scopeId, untracked),
    ),
  )
  const slots = averageSlotShares(daySlots, penOrder)
  return {
    id: opts.id,
    label: opts.label,
    caption: opts.caption,
    n: dateKeys.length,
    slots,
    sections: mergeDominantSections(slots),
  }
}

export function buildAverageDayRibbon(opts: {
  id: string
  label: string
  caption: string
  dateKeys: readonly string[]
  entries: readonly TimeEntry[]
  pens: PenTree
  depth: DisplayDepth
  scopeId: string
  showUntracked: boolean
  untrackedId: string
  penOrder: readonly string[]
}): AverageDayRibbon {
  return ribbonFromDayIndex({ ...opts, byDate: indexEntriesByDay(opts.entries) })
}

/** All-days + Mon–Sun ribbons for the window. */
export function buildAverageDayBoard(opts: {
  dateKeys: readonly string[]
  entries: readonly TimeEntry[]
  pens: PenTree
  depth: DisplayDepth
  scopeId: string
  showUntracked: boolean
  untrackedId: string
  penOrder: readonly string[]
}): AverageDayRibbon[] {
  const byDate = indexEntriesByDay(opts.entries)
  const all = ribbonFromDayIndex({
    id: "all",
    label: "All days",
    caption: allDaysCaption(opts.dateKeys.length),
    ...opts,
    dateKeys: opts.dateKeys,
    byDate,
  })

  const byWeekday: string[][] = Array.from({ length: 7 }, () => [])
  for (const key of opts.dateKeys) {
    const wi = mondayIndex(key)
    if (wi == null) continue
    byWeekday[wi].push(key)
  }

  const weekdays = WEEKDAY_RIBBON_LABELS.map((label, wi) =>
    ribbonFromDayIndex({
      id: `wd-${wi}`,
      label,
      caption: weekdayCaption(wi, byWeekday[wi].length),
      ...opts,
      dateKeys: byWeekday[wi],
      byDate,
    }),
  )

  return [all, ...weekdays]
}
