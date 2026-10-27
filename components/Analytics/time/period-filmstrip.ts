/**
 * components/Analytics/period-filmstrip.ts — Chronological pen segments for a range
 *
 * One continuous bar from range start through range end. Each minute has one
 * owner (the time-grid minute map); a fully covered block stays out of the bar.
 * Gaps follow Show untracked. Painted minutes plus gaps equal days × 1440.
 * Pure helpers; day-boundary labels reuse the heat-axis sparse rule
 * (first / month / last). Entries are indexed by day once per build.
 */
import { penAtDepth, type DisplayDepth } from "@/lib/pen-tree"
import { MINUTES_PER_DAY, minuteMap, untrackedRanges, type TimeEntry } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"

export type FilmstripSegment = {
  id: string
  date: string
  startMin: number
  endMin: number
  minutes: number
  penId: string
  penName: string
  color: string
  /** Existing entry id when this is painted; null for an untracked gap. */
  entryId: string | null
  kind: "block" | "gap"
  /**
   * Silent gaps keep the bar chronologically full when Show untracked is off —
   * white well, not clickable as Untracked.
   */
  silent?: boolean
}

export type FilmstripDayTick = {
  date: string
  /** Offset in minutes from range start (0 = first midnight). */
  offsetMin: number
  label: string
}

/** Sparse day labels: first day, each month boundary, last day. */
export function formatFilmstripDay(date: string, index: number, dates: readonly string[]): string {
  const last = dates.length - 1
  if (index === 0 || index === last) {
    const d = parseLocalDate(date)
    if (!d) return date
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
  if (index > 0 && date.slice(0, 7) !== dates[index - 1].slice(0, 7)) {
    const d = parseLocalDate(date)
    if (!d) return date.slice(0, 7)
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
  return ""
}

export function buildFilmstripDayTicks(dateKeys: readonly string[]): FilmstripDayTick[] {
  return dateKeys.map((date, index) => ({
    date,
    offsetMin: index * 1440,
    label: formatFilmstripDay(date, index, dateKeys),
  }))
}

const EMPTY_DAY: TimeEntry[] = []

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

export function buildPeriodFilmstrip(opts: {
  dateKeys: readonly string[]
  entries: readonly TimeEntry[]
  pens: { id: string; name: string; color: string; parentId?: string }[]
  depth: DisplayDepth
  scopeId: string
  showUntracked: boolean
  untrackedColor: string
  untrackedLabel: string
}): FilmstripSegment[] {
  const { dateKeys, entries, pens, depth, scopeId, showUntracked, untrackedColor, untrackedLabel } = opts
  const byDate = indexEntriesByDay(entries)
  const byId = new Map(pens.map((p) => [p.id, p]))
  const segments: FilmstripSegment[] = []

  for (const date of dateKeys) {
    const bucket = byDate.get(date) ?? EMPTY_DAY
    // endMin tie-break matches the old per-day filter so last-writer owners stay put.
    // `minuteMap` then stable-sorts by startMin only.
    const dayEntries = bucket
      .filter((e) => e.scopeId === scopeId && e.kind !== "instant")
      .filter((e) => e.endMin > e.startMin)
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

    const owners = minuteMap(dayEntries, date, scopeId)
    let minute = 0
    while (minute < MINUTES_PER_DAY) {
      const owner = owners[minute]
      if (!owner) {
        minute++
        continue
      }
      let end = minute + 1
      while (end < MINUTES_PER_DAY && owners[end]?.id === owner.id) end++
      const shown = penAtDepth(pens, owner.penId, depth)
      const pen = shown ? byId.get(shown.id) : byId.get(owner.penId)
      segments.push({
        id: `${owner.id}:${date}:${minute}`,
        date,
        startMin: minute,
        endMin: end,
        minutes: end - minute,
        penId: shown?.id ?? owner.penId,
        penName: pen?.name ?? shown?.name ?? owner.penId,
        color: pen?.color ?? shown?.color ?? "#94a3b8",
        entryId: owner.id,
        kind: "block",
      })
      minute = end
    }

    for (const gap of untrackedRanges(bucket, date, scopeId)) {
      const minutes = gap.endMin - gap.startMin
      if (minutes <= 0) continue
      segments.push({
        id: `gap-${date}-${gap.startMin}-${gap.endMin}`,
        date,
        startMin: gap.startMin,
        endMin: gap.endMin,
        minutes,
        penId: untrackedLabel,
        penName: untrackedLabel,
        color: untrackedColor,
        entryId: null,
        kind: "gap",
        silent: !showUntracked,
      })
    }
  }

  return segments.sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.endMin - b.endMin,
  )
}
