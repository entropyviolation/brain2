/**
 * lib/estimate-proposals.ts — Place assumed blocks into empty minutes
 *
 * Done items and imports that are not yet on the grid get a hatched proposal
 * in the first gap that can hold them. Confirming later clears `precision`;
 * this module only decides where the assumption would sit. It does not write.
 */
import { MINUTES_PER_DAY } from "@/lib/time-entries"

const MIN_PLACE = 15
const WAKE = 7 * 60
const MAX_BLOCK = 12 * 60

export interface DoneEstimateRequest {
  id: string
  title: string
  /** Minutes to try to place. Missing or tiny values become 30, then shrink to the gap. */
  minutes?: number
  /** Prefer this start when the whole block still fits in that gap. */
  preferredStart?: number
}

export interface ProposedEstimate {
  sourceId: string
  title: string
  startMin: number
  endMin: number
}

function mergeSpans(spans: { startMin: number; endMin: number }[]): { startMin: number; endMin: number }[] {
  const sorted = spans
    .filter((span) => span.endMin > span.startMin)
    .map((span) => ({
      startMin: Math.max(0, span.startMin),
      endMin: Math.min(MINUTES_PER_DAY, span.endMin),
    }))
    .sort((a, b) => a.startMin - b.startMin)
  const merged: { startMin: number; endMin: number }[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last && span.startMin <= last.endMin) last.endMin = Math.max(last.endMin, span.endMin)
    else merged.push({ ...span })
  }
  return merged
}

function freeGaps(
  occupied: { startMin: number; endMin: number }[],
  reserved: ProposedEstimate[],
): { startMin: number; endMin: number }[] {
  const merged = mergeSpans([
    ...occupied,
    ...reserved.map((block) => ({ startMin: block.startMin, endMin: block.endMin })),
  ])
  const gaps: { startMin: number; endMin: number }[] = []
  let cursor = 0
  for (const span of merged) {
    if (span.startMin > cursor) gaps.push({ startMin: cursor, endMin: span.startMin })
    cursor = Math.max(cursor, span.endMin)
  }
  if (cursor < MINUTES_PER_DAY) gaps.push({ startMin: cursor, endMin: MINUTES_PER_DAY })
  return gaps.filter((gap) => gap.endMin - gap.startMin >= MIN_PLACE)
}

/**
 * One proposal per item that is not already placed, packed into free gaps.
 * Later items see earlier proposals as occupied. A gap after wake wins over
 * a midnight gap when both can hold the block.
 */
export function proposeDoneEstimates(
  items: DoneEstimateRequest[],
  occupied: { startMin: number; endMin: number }[],
  alreadyPlaced: ReadonlySet<string>,
): ProposedEstimate[] {
  const placed: ProposedEstimate[] = []
  for (const item of items) {
    if (!item.id || alreadyPlaced.has(item.id)) continue
    const want = Math.max(MIN_PLACE, Math.min(MAX_BLOCK, Math.round(item.minutes || 30)))
    const gaps = freeGaps(occupied, placed)
    const preferred = item.preferredStart
    const ranked = [...gaps].sort((a, b) => score(a, want, preferred) - score(b, want, preferred))
    const gap = ranked[0]
    if (!gap) continue
    const minutes = Math.min(want, gap.endMin - gap.startMin)
    if (minutes < MIN_PLACE) continue
    let start = gap.startMin
    if (preferred != null && preferred >= gap.startMin && preferred + minutes <= gap.endMin) start = preferred
    else if (gap.startMin < WAKE && gap.endMin - WAKE >= minutes) start = WAKE
    placed.push({
      sourceId: item.id,
      title: item.title.trim() || "Done",
      startMin: start,
      endMin: start + minutes,
    })
  }
  return placed
}

function score(
  gap: { startMin: number; endMin: number },
  want: number,
  preferred: number | undefined,
): number {
  const fits = gap.endMin - gap.startMin >= want ? 0 : 1
  const holdsPreferred =
    preferred != null && preferred >= gap.startMin && preferred < gap.endMin ? 0 : 1
  const afterWake = gap.endMin > WAKE ? 0 : 1
  return fits * 8 + holdsPreferred * 4 + afterWake * 2 + gap.startMin / 10_000
}
