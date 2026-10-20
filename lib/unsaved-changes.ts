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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

/**
 * Equal when every field serializes the same. Fields that are the very same
 * reference skip serializing, so a draft that touched one field does not
 * re-stringify a large note log or resource list on every dirty check (the
 * save lamp asks on each keystroke).
 */
export function snapshotsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (isPlainObject(a) && isPlainObject(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[key] === b[key]) continue
      if (serializeSnapshot(a[key]) !== serializeSnapshot(b[key])) return false
    }
    return true
  }
  return serializeSnapshot(a) === serializeSnapshot(b)
}
