/**
 * components/Analytics/tag-trends.ts — Per-tag minutes by calendar month
 *
 * Weekly series already live in `tagWeekTrend` (`lib/tracking-summary.ts`).
 * This is the same union — a minute tagged in two scopes counts once — bucketed
 * by `YYYY-MM`. Months the window touches stay in the series at 0 so the bars
 * line up. Not a second clock: `startMin` / `endMin` on `TimeEntry`.
 */
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { effectiveTagIds } from "@/lib/tracked-time"
import type { TrackScope, TrackTag } from "@/lib/time-tracking-store"
import type { TagTrendRow } from "@/lib/tracking-summary"

function addSpan(set: Set<string>, date: string, from: number, to: number) {
  for (let minute = from; minute < to; minute++) set.add(`${date}#${minute}`)
}

export function tagMonthTrend(
  entries: TimeEntry[],
  scopes: TrackScope[],
  tags: TrackTag[],
  dateKeys: string[],
): TagTrendRow[] {
  const months: string[] = []
  const seen = new Set<string>()
  for (const key of dateKeys) {
    const month = key.slice(0, 7)
    if (!month || seen.has(month)) continue
    seen.add(month)
    months.push(month)
  }
  const byTag = new Map<string, Map<string, Set<string>>>()
  const wanted = new Set(dateKeys)
  for (const entry of entries) {
    if (wanted.size && !wanted.has(entry.date)) continue
    const entryTags = effectiveTagIds(entry, scopes)
    if (!entryTags.length) continue
    const month = entry.date.slice(0, 7)
    for (const tagId of entryTags) {
      let monthsMap = byTag.get(tagId)
      if (!monthsMap) {
        monthsMap = new Map()
        byTag.set(tagId, monthsMap)
      }
      let set = monthsMap.get(month)
      if (!set) {
        set = new Set()
        monthsMap.set(month, set)
      }
      addSpan(set, entry.date, Math.max(0, entry.startMin), Math.min(MINUTES_PER_DAY, entry.endMin))
    }
  }
  return tags
    .filter((tag) => byTag.has(tag.id))
    .map((tag) => {
      const monthsMap = byTag.get(tag.id)
      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        points: months.map((key) => ({ key, minutes: monthsMap?.get(key)?.size ?? 0 })),
      }
    })
}
