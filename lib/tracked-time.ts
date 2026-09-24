/**
 * lib/tracked-time.ts — Tag rollups over the TimeGrid
 *
 * Pure reads over the shape held by `lib/time-tracking-store.ts`: given the pen
 * scopes and the tracked intervals, how many minutes carry a given tag?
 *
 * Minutes are unioned across scopes before they are counted. The same minute can
 * be painted in Activity, Location and Mood at once, so summing per-scope totals
 * would triple-count a minute whenever several of those pens share a tag.
 *
 * Minute indices (0–1439), not slot indices — the grid has been interval-based
 * since v4 of the store (`lib/time-entries.ts`). `lib/completion-window.ts` reads
 * the same sets to find when in the day a habit actually closed.
 *
 * Consumers: `lib/habit-tracking-sync.ts` (habit auto-fill), `lib/habit-done-log.ts`,
 * and the Tracking day totals. Everything here takes plain state so tests never
 * touch a store.
 */
import type { TimeEntry } from "@/lib/time-entries"
import { assignedPenIds } from "@/lib/time-entries"
import type { TrackPen, TrackScope, TrackTag } from "@/lib/time-tracking-store"

/** The slice of the tracking store these helpers need. */
export interface TrackedTimeSource {
  scopes: TrackScope[]
  entries: TimeEntry[]
}

export function penTagIds(pen: Pick<TrackPen, "tags"> | undefined | null): string[] {
  return pen?.tags ?? []
}

/**
 * The tags a block actually carries: whatever **every assigned pen** always
 * carries (primary plus any secondaries), plus any pinned to this block alone.
 *
 * Tags are a property of *time*, not of pens — a pen tag is just the convenient
 * way to say "always". Secondary pens are not cosmetic: a youtube block that
 * also counts as studying spanish feeds both pens' tags into habits, operations,
 * and goals. Everything downstream (habit auto-fill, the By-tag totals,
 * analytics) counts minutes through this.
 */
export function effectiveTagIds(
  entry: Pick<TimeEntry, "penId" | "secondaryPenIds" | "tagIds">,
  scopes: TrackScope[],
): string[] {
  const ids = new Set<string>()
  for (const penId of assignedPenIds(entry)) {
    for (const id of penTagIds(findPen(scopes, penId))) ids.add(id)
  }
  for (const id of entry.tagIds ?? []) ids.add(id)
  return [...ids]
}

export function findPen(scopes: TrackScope[], penId: string): TrackPen | undefined {
  for (const scope of scopes) {
    const pen = scope.pens.find((p) => p.id === penId)
    if (pen) return pen
  }
  return undefined
}

export function tagsForPen(tags: TrackTag[], pen: Pick<TrackPen, "tags"> | undefined | null): TrackTag[] {
  const ids = new Set(penTagIds(pen))
  return tags.filter((t) => ids.has(t.id))
}

/** Every pen across every scope carrying at least one of `tagIds`. */
export function penIdsForTags(scopes: TrackScope[], tagIds: string[]): Set<string> {
  const wanted = new Set(tagIds)
  const penIds = new Set<string>()
  if (wanted.size === 0) return penIds
  for (const scope of scopes) {
    for (const pen of scope.pens) {
      if (penTagIds(pen).some((id) => wanted.has(id))) penIds.add(pen.id)
    }
  }
  return penIds
}

/** Minutes past midnight on `dateKey` carrying one of `tagIds`, from any scope. */
export function trackedMinuteSetForTags(
  source: TrackedTimeSource,
  dateKey: string,
  tagIds: string[],
): Set<number> {
  const minutes = new Set<number>()
  const wanted = new Set(tagIds)
  if (wanted.size === 0) return minutes
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    if (!effectiveTagIds(entry, source.scopes).some((id) => wanted.has(id))) continue
    for (let m = entry.startMin; m < entry.endMin; m++) minutes.add(m)
  }
  return minutes
}

/** @deprecated Slot-era name kept for call sites; returns minute indices. */
export const trackedSlotsForTags = trackedMinuteSetForTags

export function trackedMinutesForTags(source: TrackedTimeSource, dateKey: string, tagIds: string[]): number {
  return trackedMinuteSetForTags(source, dateKey, tagIds).size
}

export function trackedMinutesForTagsInRange(
  source: TrackedTimeSource,
  dateKeys: string[],
  tagIds: string[],
): number {
  return dateKeys.reduce((sum, key) => sum + trackedMinutesForTags(source, key, tagIds), 0)
}

/** Minutes per tag for one day, for the Tracking footer and analytics. */
export function trackedMinutesByTag(source: TrackedTimeSource, dateKey: string): Record<string, number> {
  const totals: Record<string, number> = {}
  const minutesByTag = new Map<string, Set<number>>()
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    for (const tagId of effectiveTagIds(entry, source.scopes)) {
      const set = minutesByTag.get(tagId) ?? new Set<number>()
      for (let m = entry.startMin; m < entry.endMin; m++) set.add(m)
      minutesByTag.set(tagId, set)
    }
  }
  for (const [tagId, minutes] of minutesByTag) totals[tagId] = minutes.size
  return totals
}

/** Dates that have any painted data, newest first — the sync's re-check window. */
export function trackedDateKeys(source: TrackedTimeSource): string[] {
  return [...new Set(source.entries.map((e) => e.date))].sort((a, b) => b.localeCompare(a))
}
