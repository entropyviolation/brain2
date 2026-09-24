/**
 * lib/appearance-rev.ts — Monotonic stamp for snapshots that must not roll back
 *
 * `appearanceRev` decides which snapshot of the desktop plate and the habit
 * LED / tube hues wins a merge. `contentRev` on the habits vault does the same
 * for habit titles, details, and completion values. Wall-clock, so an edit
 * always beats whatever is on disk even when it happens *before* persist
 * rehydration finishes — Electron's `getItem` waits on the persist hub, and a
 * plain counter restarted at 0 each launch, so an early pick lost the merge
 * and was then written back onto the dedicated pins (the desktop rolled to
 * xray, the lamps to purple, a renamed habit snapped back to the old title).
 */

/** Strictly greater than `prev`, and greater than any earlier stamp. */
export function nextMonotonicRev(prev: unknown): number {
  const last = typeof prev === "number" && Number.isFinite(prev) ? prev : 0
  return Math.max(last + 1, Date.now())
}

/** Plate / hue stamp. */
export function nextAppearanceRev(prev: unknown): number {
  return nextMonotonicRev(prev)
}

/** Habit title, detail, and completion stamp. */
export function nextContentRev(prev: unknown): number {
  return nextMonotonicRev(prev)
}
