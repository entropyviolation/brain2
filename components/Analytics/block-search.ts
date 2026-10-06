/**
 * components/Analytics/block-search.ts — Find blocks on the Analytics surface
 *
 * The matcher is `searchTracking` in `lib/tracking-search.ts` (display name,
 * notes, primary pen, secondary pens, counts-as chains, action-format
 * templates). This file only decides what Analytics does with those hits:
 * list them, jump to one, or keep the Tracking measures on the matching set.
 *
 * A filter is a set of entry ids. Minutes that did not match are omitted.
 * They are not relabeled as untracked.
 */
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { searchTracking, type TrackingSearchHit } from "@/lib/tracking-search"

/** Dropdown length. The filter uses a higher cap so a long vault is not clipped. */
export const SEARCH_LIST_LIMIT = 40
export const SEARCH_FILTER_LIMIT = 2000

export function findBlocks(
  query: string,
  entries: TimeEntry[],
  scopes: TrackScope[],
  limit = SEARCH_LIST_LIMIT,
): TrackingSearchHit[] {
  return searchTracking(query, entries, scopes, limit)
}

/** Entries whose id is in `hits`, in the original order. */
export function entriesMatching(entries: TimeEntry[], hits: readonly { entryId: string }[]): TimeEntry[] {
  if (hits.length === 0) return []
  const ids = new Set(hits.map((hit) => hit.entryId))
  return entries.filter((entry) => ids.has(entry.id))
}

export interface SearchPlacement {
  /** Hits in `scopeId` and inside `dateKeys`. */
  inView: number
  /** Hits inside the window but on another scope. */
  otherScope: number
  /** Hits whose date is outside the window. */
  outsideWindow: number
}

export function placeHits(
  hits: readonly TrackingSearchHit[],
  dateKeys: readonly string[],
  scopeId: string,
): SearchPlacement {
  const dates = new Set(dateKeys)
  let inView = 0
  let otherScope = 0
  let outsideWindow = 0
  for (const hit of hits) {
    if (!dates.has(hit.date)) outsideWindow++
    else if (hit.scopeId !== scopeId) otherScope++
    else inView++
  }
  return { inView, otherScope, outsideWindow }
}

/** Scope id that owns the most hits. Null when `hits` is empty. */
export function scopeWithMostHits(hits: readonly TrackingSearchHit[]): string | null {
  const counts = new Map<string, number>()
  for (const hit of hits) counts.set(hit.scopeId, (counts.get(hit.scopeId) ?? 0) + 1)
  let best: string | null = null
  let bestCount = 0
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id
      bestCount = count
    }
  }
  return best
}
