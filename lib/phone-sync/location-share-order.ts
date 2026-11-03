/**
 * lib/phone-sync/location-share-order.ts — iOS location first, BIM as backup
 *
 * The iPhone app (`LocationPlugin.swift`) records significant moves and visits
 * and uploads them. Those rows are the location writer while the phone app is
 * in use. A BIM Live Location update is the same presence told a second way,
 * so it paints only when the iOS share did not happen, was turned off, or has
 * gone quiet. A typed `gps:` is the person asking, and still paints.
 *
 * The Mac learns the phone shared when a batch is applied (`noteIosLocationShare`)
 * or when a phone-sync Location row is already on the grid. It does not yet
 * hear "recording is on" before the first batch. That heartbeat is Planned.
 */
import type { TimeEntry } from "@/lib/time-entries"

/** Product order. The first source that actually shared wins. */
export const LOCATION_SHARE_ORDER = ["ios", "bim"] as const

/**
 * After the latest iOS location time, BIM Live Location stays quiet.
 * Significant-change and visits can sit still for hours. Gaps stay gaps
 * instead of a second writer filling them.
 */
export const IOS_LOCATION_QUIET_MS = 12 * 60 * 60 * 1000

const IOS_LOCATION_STAMP = /^location:/

let lastIosLocationAt = 0
let iosShareUnavailable: () => boolean = () => false

/** The phone uploaded a location event at `at` (ms). Same process, before the vault flush. */
export function noteIosLocationShare(at: number): void {
  if (Number.isFinite(at) && at > lastIosLocationAt) lastIosLocationAt = at
}

/**
 * Hub sets this from Settings → Phone sync. Location off means the iOS share
 * is unavailable, so a BIM update may paint even if older phone rows remain.
 */
export function setIosLocationShareUnavailable(read: () => boolean): void {
  iosShareUnavailable = read
}

export function resetIosLocationShareForTests(): void {
  lastIosLocationAt = 0
  iosShareUnavailable = () => false
}

export function isIosLocationEntry(entry: Pick<TimeEntry, "scopeId" | "generatedBy">): boolean {
  return (
    entry.scopeId === "location" &&
    entry.generatedBy?.kind === "phone-sync" &&
    IOS_LOCATION_STAMP.test(entry.generatedBy.id)
  )
}

function localMinuteMs(date: string, min: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  if (!Number.isFinite(day)) return null
  return day + min * 60_000
}

/**
 * True when the iOS app already shared around `sampleAt`, so BIM should not
 * paint that sample. A visit block covers its own minutes. Otherwise the
 * latest iOS time holds for `IOS_LOCATION_QUIET_MS`.
 */
export function iosLocationShareCovers(
  entries: readonly TimeEntry[],
  sampleAt: Date,
  holdMs = IOS_LOCATION_QUIET_MS,
): boolean {
  if (iosShareUnavailable()) return false
  const sampleMs = sampleAt.getTime()
  let latest = lastIosLocationAt
  for (const entry of entries) {
    if (!isIosLocationEntry(entry)) continue
    const start = localMinuteMs(entry.date, entry.startMin)
    const endMin = entry.kind === "instant" ? entry.startMin : entry.endMin
    const end = localMinuteMs(entry.date, endMin)
    if (start == null || end == null) continue
    const exclusiveEnd = Math.max(end, start + 60_000)
    if (sampleMs >= start && sampleMs < exclusiveEnd) return true
    if (end > latest) latest = end
  }
  if (!latest) return false
  return Math.abs(sampleMs - latest) <= holdMs
}

/** True when this BIM Live Location sample should paint. */
export function bimLocationUpdateShouldApply(sampleAt: Date, entries: readonly TimeEntry[]): boolean {
  return !iosLocationShareCovers(entries, sampleAt)
}
