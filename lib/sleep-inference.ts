/**
 * lib/sleep-inference.ts — Reading a night off the grid
 *
 * The sleep log (`lib/sleep-log.ts`) holds what the user *said*. The Tracking
 * grid holds what the user *painted*. Both describe the same nights, and until
 * now only the first one counted — so a user who paints sleep straight onto the
 * grid, or whose night came from an Operations session or an import, saw an empty
 * Sleep tab and a 9 PM guess in every completion window.
 *
 * This module closes that gap in one direction only: **painted time can fill a
 * gap in the log, never overwrite it.** A stated bedtime always wins over an
 * inferred one, and an inferred end is always marked `estimated`, because a
 * painted block says "I was asleep during these minutes", which is a weaker claim
 * than "I fell asleep at 11:30".
 *
 * ## How a night is read out of blocks
 *
 * Sleep is whatever carries the Sleep tag, from any scope and whether the tag is
 * on the pen or on the single block (`lib/tracked-time.ts`), so a nap painted in
 * Location counts exactly like one painted in Activity.
 *
 * - A run touching midnight on the evening before, plus a run starting at
 *   midnight on the morning itself, is the night: bedtime and wake time both
 *   fall out of it, however short either side is.
 * - Only one of those two exists → only that end is known. The other stays blank
 *   rather than being invented.
 * - A run that never touches midnight counts only if it sits wholly in the small
 *   hours and runs at least `MIN_STANDALONE_NIGHT` — otherwise a 25-minute
 *   morning doze would be logged as a night's sleep.
 *
 * Blocks the sleep log itself generated are ignored (`generatedBy.kind ===
 * "sleep"`), or the log would end up reading its own output back as evidence.
 */

import { previousDateKey, sleepIntervals, SLEEP_TAG_ID, type SleepNight } from "@/lib/sleep-log"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { effectiveTagIds, type TrackedTimeSource } from "@/lib/tracked-time"

/** Noon: the latest a run can start and still be plausibly "last night". */
const SMALL_HOURS_END = 12 * 60
/** A run that does not touch midnight has to be this long to be a night, not a nap. */
export const MIN_STANDALONE_NIGHT = 3 * 60

interface Run {
  startMin: number
  endMin: number
}

/** Sleep-tagged minutes on one date, as contiguous runs. */
export function sleepRunsOn(source: TrackedTimeSource, dateKey: string): Run[] {
  const minutes = new Set<number>()
  for (const entry of source.entries) {
    if (entry.date !== dateKey) continue
    if (isDerivedFromLog(entry)) continue
    if (!effectiveTagIds(entry, source.scopes).includes(SLEEP_TAG_ID)) continue
    for (let m = entry.startMin; m < entry.endMin; m++) minutes.add(m)
  }

  const sorted = [...minutes].sort((a, b) => a - b)
  const runs: Run[] = []
  for (const minute of sorted) {
    const last = runs[runs.length - 1]
    if (last && last.endMin === minute) last.endMin = minute + 1
    else runs.push({ startMin: minute, endMin: minute + 1 })
  }
  return runs
}

function isDerivedFromLog(entry: TimeEntry): boolean {
  return entry.generatedBy?.kind === "sleep"
}

/**
 * The night that ended on `morningKey`, as far as the painted grid shows it.
 * Either end may be missing; `undefined` means the grid says nothing at all.
 */
export function inferNight(source: TrackedTimeSource, morningKey: string): SleepNight | undefined {
  const evening = sleepRunsOn(source, previousDateKey(morningKey))
  const morning = sleepRunsOn(source, morningKey)

  const eveningRun = evening.find((r) => r.endMin >= MINUTES_PER_DAY)
  const acrossMidnight = morning.find((r) => r.startMin === 0)

  let sleptMin: number | undefined
  let wokeMin: number | undefined

  if (eveningRun) sleptMin = eveningRun.startMin - MINUTES_PER_DAY
  if (acrossMidnight) wokeMin = acrossMidnight.endMin

  if (sleptMin === undefined && wokeMin === undefined) {
    // No midnight crossing: a long stretch in the small hours is still a night —
    // someone who fell asleep at 1am has no evening block to find.
    const standalone = morning.find(
      (r) => r.startMin < SMALL_HOURS_END && r.endMin - r.startMin >= MIN_STANDALONE_NIGHT,
    )
    if (!standalone) return undefined
    sleptMin = standalone.startMin
    wokeMin = standalone.endMin
  }

  return {
    date: morningKey,
    sleptMin,
    wokeMin,
    // Painted time says "asleep during these minutes", not "asleep at 11:30".
    sleptPrecision: "estimated",
    wokePrecision: "estimated",
    source: "tracked",
  }
}

/**
 * The night its own derived blocks currently describe.
 *
 * Only blocks the log generated are read, and only for this night — this answers
 * "what does the grid now say about the night I derived here?", which is the
 * question worth asking after the user has dragged, split or deleted one of
 * them. Hand-painted sleep is not consulted: that is `inferNight`'s job, and
 * mixing the two would let an unrelated nap rewrite a stated bedtime.
 *
 * The ends are the outermost ones, so a night broken by a 3am gap still reports
 * "asleep 11:30, up at 7" — which is what a person means by those words, and the
 * only thing a single-interval night can represent.
 */
export function nightFromGeneratedBlocks(
  entries: TimeEntry[],
  date: string,
): { sleptMin: number; wokeMin: number } | undefined {
  const evening = previousDateKey(date)
  let sleptMin = Number.POSITIVE_INFINITY
  let wokeMin = Number.NEGATIVE_INFINITY

  for (const entry of entries) {
    if (entry.generatedBy?.kind !== "sleep" || entry.generatedBy.id !== date) continue
    // The evening half lives on the day before, so shift it onto this morning's
    // axis: 11:30 PM on the 16th is -30 against the morning of the 17th.
    const shift = entry.date === evening ? -MINUTES_PER_DAY : entry.date === date ? 0 : undefined
    if (shift === undefined) continue
    sleptMin = Math.min(sleptMin, entry.startMin + shift)
    wokeMin = Math.max(wokeMin, entry.endMin + shift)
  }

  if (!Number.isFinite(sleptMin) || !Number.isFinite(wokeMin)) return undefined
  return { sleptMin, wokeMin }
}

/**
 * The log and the grid reconciled, for one range of mornings.
 *
 * Per end, not per night: a logged wake time with no logged bedtime keeps its
 * wake time and borrows the bedtime from the grid. `source` reports where the
 * night as a whole came from, so the UI can mark what it did not hear from the
 * user directly.
 */
export function resolveNights(
  logged: Record<string, SleepNight>,
  source: TrackedTimeSource,
  dateKeys: string[],
): Record<string, SleepNight> {
  const resolved: Record<string, SleepNight> = {}

  for (const key of dateKeys) {
    const stated = logged[key]
    if (stated?.sleptMin !== undefined && stated?.wokeMin !== undefined) {
      resolved[key] = stated
      continue
    }

    const painted = inferNight(source, key)
    if (!painted) {
      if (stated) resolved[key] = stated
      continue
    }
    if (!stated) {
      resolved[key] = painted
      continue
    }

    const merged: SleepNight = {
      ...stated,
      sleptMin: stated.sleptMin ?? painted.sleptMin,
      wokeMin: stated.wokeMin ?? painted.wokeMin,
      sleptPrecision: stated.sleptMin !== undefined ? stated.sleptPrecision : "estimated",
      wokePrecision: stated.wokeMin !== undefined ? stated.wokePrecision : "estimated",
      // Half-borrowed is still borrowed; the tab should say so.
      source: stated.sleptMin === undefined || stated.wokeMin === undefined ? "mixed" : "logged",
    }
    resolved[key] = merged
  }

  return resolved
}

export interface StraySleep {
  /** Sleep-tagged minutes on the grid that no night in this range accounts for. */
  minutes: number
  /** The days they fall on, most recent first. */
  days: { date: string; minutes: number }[]
}

/**
 * Sleep painted on the grid that the night-by-night view does not cover.
 *
 * A `SleepNight` is one interval, so an afternoon nap, a second stretch after an
 * early alarm, or a flight slept through has nowhere to live in it — and before
 * this those minutes were simply absent from the Sleep tab even though the
 * tracker showed them plainly. Counting them separately keeps the nightly
 * averages meaning "per night" while still reporting everything the user
 * recorded.
 *
 * Minutes already claimed by a night — including the ones the log painted
 * itself — are subtracted, so nothing is counted twice.
 */
export function straySleep(
  source: TrackedTimeSource,
  nights: Record<string, SleepNight>,
  dateKeys: string[],
): StraySleep {
  const claimed = new Map<string, Set<number>>()
  for (const night of Object.values(nights)) {
    for (const interval of sleepIntervals(night)) {
      const set = claimed.get(interval.date) ?? new Set<number>()
      for (let m = interval.startMin; m < interval.endMin; m++) set.add(m)
      claimed.set(interval.date, set)
    }
  }

  const days: { date: string; minutes: number }[] = []
  let minutes = 0

  for (const date of dateKeys) {
    const taken = claimed.get(date)
    let loose = 0
    for (const run of sleepRunsOn(source, date)) {
      for (let m = run.startMin; m < run.endMin; m++) if (!taken?.has(m)) loose++
    }
    if (loose > 0) {
      days.push({ date, minutes: loose })
      minutes += loose
    }
  }

  return { minutes, days: days.reverse() }
}
