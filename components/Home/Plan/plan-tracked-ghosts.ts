/**
 * components/Home/Plan/plan-tracked-ghosts.ts
 *
 * Past-only ghost outlines for the Plan day agenda. The blocks are Day Log's
 * slabs (`trackedAgendaBlocks`): the active scope’s intervals, plus discrete
 * log instants from any view. Future minutes, and a day that has not started,
 * stay empty.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import {
  trackedAgendaBlocks,
  type TrackedAgendaBlock,
} from "@/components/Home/Tracking/tracked-agenda-blocks"

/**
 * Minutes past midnight that are still ahead on `viewedDay`.
 * 0 = the whole day is still in the future. 1440 = the day is already over.
 */
export function pastMinuteCutoff(viewedDay: Date, now: Date): number {
  const viewedKey = formatLocalDateKey(viewedDay)
  const nowKey = formatLocalDateKey(now)
  if (viewedKey > nowKey) return 0
  if (viewedKey < nowKey) return MINUTES_PER_DAY
  return now.getHours() * 60 + now.getMinutes()
}

/** Keep the part of each slab that has already happened. Drop the rest. */
export function clipTrackedBlocksBefore(
  blocks: readonly TrackedAgendaBlock[],
  cutoffMinutes: number,
): TrackedAgendaBlock[] {
  if (cutoffMinutes <= 0) return []
  const out: TrackedAgendaBlock[] = []
  for (const block of blocks) {
    if (block.startMinutes >= cutoffMinutes) continue
    const end = block.startMinutes + Math.max(1, block.durationMinutes)
    const visibleEnd = Math.min(end, cutoffMinutes)
    const durationMinutes = visibleEnd - block.startMinutes
    if (durationMinutes <= 0) continue
    out.push(durationMinutes === block.durationMinutes ? block : { ...block, durationMinutes })
  }
  return out
}

/** Day-view ghosts: Day Log blocks for this scope-day, clipped to the past. */
export function planDayTrackedGhosts(input: {
  entries: TimeEntry[]
  scope: TrackScope | undefined
  scopes?: readonly TrackScope[]
  dayKey: string
  viewedDay: Date
  now: Date
}): TrackedAgendaBlock[] {
  const blocks = trackedAgendaBlocks(input.entries, input.scope, input.dayKey, input.scopes)
  return clipTrackedBlocksBefore(blocks, pastMinuteCutoff(input.viewedDay, input.now))
}
