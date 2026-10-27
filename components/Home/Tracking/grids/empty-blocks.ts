/**
 * components/Home/Tracking/empty-blocks.ts — Untracked gaps for Time Grid Fill
 *
 * Fill wants the day's empty (untracked) stretches, not a static 9:00–10:00.
 * Occupancy is a union of interval entries for that scope-day. Discrete events
 * do not occupy a minute; Sleep and other painted cells do.
 *
 * Gaps are listed **chronologically** by start. The longest gap is the default
 * Fill selection (ties go to the earlier start). If both midnight ends of the
 * day are empty, those two runs merge into one wrapping gap (23:00–07:00).
 *
 * A day with no tracked minutes is not "24 hours empty" — Fill falls back to
 * the View-settings waking window (`fillFrom`/`fillTo`). A fully tracked day
 * has no gaps.
 */
import { isInstant, MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"

export type EmptyBlock = {
  startMin: number
  /** Exclusive. 1440 = end of this day. Earlier than `startMin` means wrap. */
  endMin: number
  wraps: boolean
}

export type FillFallbackWindow = {
  startMin: number
  endMin: number
}

export function emptyBlockDuration(block: EmptyBlock): number {
  if (block.wraps) return MINUTES_PER_DAY - block.startMin + block.endMin
  return Math.max(0, block.endMin - block.startMin)
}

export function clocksToEmptyBlock(startMin: number, endMin: number): EmptyBlock {
  const from = clampDay(startMin)
  const to = clampDay(endMin)
  if (to > from) return { startMin: from, endMin: to, wraps: false }
  if (to === 0 || to === from) {
    return { startMin: from, endMin: MINUTES_PER_DAY, wraps: false }
  }
  return { startMin: from, endMin: to, wraps: true }
}

function clampDay(minute: number): number {
  if (!Number.isFinite(minute)) return 0
  return Math.min(MINUTES_PER_DAY, Math.max(0, Math.round(minute)))
}

function occupancy(dayEntries: TimeEntry[]): boolean[] {
  const map = new Array<boolean>(MINUTES_PER_DAY).fill(false)
  for (const entry of dayEntries) {
    if (isInstant(entry)) continue
    const from = Math.max(0, Math.min(MINUTES_PER_DAY, entry.startMin))
    const to = Math.max(0, Math.min(MINUTES_PER_DAY, entry.endMin))
    for (let m = from; m < to; m++) map[m] = true
  }
  return map
}

/**
 * Empty stretches on one scope-day, chronological.
 *
 * `fallback` is the View-settings Day fill window — used only when nothing on
 * the day is tracked (whole waking window). Fully tracked → `[]`.
 */
export function emptyBlocksForDay(
  dayEntries: TimeEntry[],
  fallback: FillFallbackWindow,
): EmptyBlock[] {
  const map = occupancy(dayEntries)
  if (!map.some(Boolean)) return [clocksToEmptyBlock(fallback.startMin, fallback.endMin)]

  const runs: { startMin: number; endMin: number }[] = []
  let i = 0
  while (i < MINUTES_PER_DAY) {
    if (map[i]) {
      i += 1
      continue
    }
    const startMin = i
    while (i < MINUTES_PER_DAY && !map[i]) i += 1
    runs.push({ startMin, endMin: i })
  }

  if (runs.length === 0) return []

  if (runs.length >= 2 && runs[0].startMin === 0 && runs[runs.length - 1].endMin === MINUTES_PER_DAY) {
    const morning = runs.shift()!
    const evening = runs.pop()!
    runs.push({ startMin: evening.startMin, endMin: morning.endMin })
  }

  const blocks = runs.map((run) =>
    run.endMin < run.startMin
      ? { startMin: run.startMin, endMin: run.endMin, wraps: true as const }
      : { startMin: run.startMin, endMin: run.endMin, wraps: false as const },
  )
  blocks.sort((a, b) => a.startMin - b.startMin)
  return blocks.filter((block) => emptyBlockDuration(block) > 0)
}

/** Index of the longest gap in chronological order; earlier start wins ties. `-1` if none. */
export function longestEmptyBlockIndex(blocks: EmptyBlock[]): number {
  if (blocks.length === 0) return -1
  let best = 0
  let bestDur = emptyBlockDuration(blocks[0])
  for (let i = 1; i < blocks.length; i++) {
    const dur = emptyBlockDuration(blocks[i])
    if (dur > bestDur) {
      best = i
      bestDur = dur
    }
  }
  return best
}
