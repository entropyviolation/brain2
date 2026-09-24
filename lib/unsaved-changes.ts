/**
 * lib/unsaved-changes.ts — Dirty snapshot compare (house unsaved-changes law)
 *
 * Editors compare a frozen open-baseline to the live draft. Equal snapshots
 * mean close immediately; unequal means the Win95 confirm in
 * `components/ui/unsaved-changes-guard.tsx`.
 *
 * Dates serialize to ISO so calendar drafts compare stably.
 */

export function serializeSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current instanceof Date) return `Date:${current.toISOString()}`
    return current
  })
}

export function snapshotsEqual(a: unknown, b: unknown): boolean {
  return serializeSnapshot(a) === serializeSnapshot(b)
}
