/**
 * components/Lists/lib/lists-shelf-sync.ts
 *
 * Equality checks for the Lists shelf maintenance pass. A wash sync must not
 * publish a new folder tree or list shelf. A title-only task edit must not
 * rebuild the maintenance key.
 */
import type { Folder, List, Task } from "@/lib/types"

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** A sync that moves a folder and moves it back must not publish a new tree. */
export function sameFolderTree(before: Folder[], after: Folder[]): boolean {
  if (before.length !== after.length) return false
  for (let i = 0; i < before.length; i++) {
    const a = before[i]
    const b = after[i]
    if (a === b) continue
    if (a.id !== b.id || a.name !== b.name || a.parentFolderId !== b.parentFolderId) return false
    if (!sameIds(a.listIds, b.listIds)) return false
  }
  return true
}

export function sameListShelf(before: List[], after: List[]): boolean {
  if (before.length !== after.length) return false
  for (let i = 0; i < before.length; i++) {
    const a = before[i]
    const b = after[i]
    if (a === b) continue
    if (a.id !== b.id || a.name !== b.name || a.autoArchive !== b.autoArchive) return false
  }
  return true
}

/** Fields the Lists maintenance pass actually reads. Title edits must not rerun it. */
export function scheduleMaintenanceKey(tasks: Task[]): string {
  let h = tasks.length || 1
  const mix = (s: string | undefined) => {
    if (!s) {
      h = Math.imul(h ^ 0, 33)
      return
    }
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 33)
  }
  const stamp = (value: unknown) => {
    if (value instanceof Date) mix(String(value.getTime()))
    else if (typeof value === "string" || typeof value === "number") mix(String(value))
  }
  for (const t of tasks) {
    mix(t.id)
    mix(t.completed ? "1" : "0")
    mix(t.status)
    for (const id of t.lists ?? []) mix(id)
    stamp(t.scheduledDate)
    stamp(t.deadline)
    mix(t.scheduledYear)
    mix(t.scheduledMonth)
    mix(t.scheduledWeek)
  }
  return (h >>> 0).toString(36)
}
