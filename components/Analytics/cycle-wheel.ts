/**
 * components/Analytics/cycle-wheel.ts — Split the window into cycles
 *
 * Pure. A cycle starts on the first menstrual day after a non-menstrual day
 * inside the window. A window that opens mid-bleed starts with a partial run. Only a day whose
 * *marked* phase is menstrual can start one, so an estimate never invents an
 * onset. Days before the first onset form a leading partial cycle. A cycle is
 * complete when the next onset is inside the window. Not a diagnosis.
 */
import type { DatedPhase } from "./cycle-phase-stats"

export type CycleRun = {
  /** First day of the run (YYYY-MM-DD). */
  start: string
  days: DatedPhase[]
  /** True when both its onset and the next onset are in the window. */
  complete: boolean
  /** False for the leading days before the first onset. */
  hasOnset: boolean
}

function isOnset(day: DatedPhase, prev: DatedPhase | undefined): boolean {
  return day.markedPhase === "menstrual" && day.basis === "marked" && !!prev && prev.markedPhase !== "menstrual"
}

export function splitCycles(dated: readonly DatedPhase[]): CycleRun[] {
  const runs: CycleRun[] = []
  let current: CycleRun | null = null
  dated.forEach((day, i) => {
    if (isOnset(day, dated[i - 1])) {
      if (current?.hasOnset) current.complete = true
      current = { start: day.date, days: [], complete: false, hasOnset: true }
      runs.push(current)
    } else if (!current) {
      current = { start: day.date, days: [], complete: false, hasOnset: false }
      runs.push(current)
    }
    current.days.push(day)
  })
  return runs
}

/** Lengths of complete cycles, with median and range. Null with none. */
export function cycleLengths(runs: readonly CycleRun[]): { n: number; median: number; min: number; max: number } | null {
  const lengths = runs.filter((r) => r.complete).map((r) => r.days.length).sort((a, b) => a - b)
  if (lengths.length === 0) return null
  const mid = Math.floor(lengths.length / 2)
  const median = lengths.length % 2 ? lengths[mid]! : (lengths[mid - 1]! + lengths[mid]!) / 2
  return { n: lengths.length, median, min: lengths[0]!, max: lengths[lengths.length - 1]! }
}
