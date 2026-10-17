/**
 * lib/person-notes-fold.ts — Person dated notes move into the item notes log
 *
 * People used to keep dated notes on `personProfile.noteLog`. They now live in
 * `task.noteLog` with every other item's notes, shown in the Notes tab
 * (plan `docs/PERSON_DETAIL_REDESIGN.md` 3.3). Same shape: `PersonDatedNote`
 * is a subset of `ItemNoteEntry`.
 *
 * The fold runs in the task-store v19 migrate, and again when a person's Notes
 * tab opens, so hub / backup imports in the old shape still fold. It is
 * idempotent: ids already on `task.noteLog` are skipped, nothing is lost.
 */
import { notesNewestFirst } from "@/lib/item-notes"
import type { ItemNoteEntry, Task } from "@/lib/types"

function cleanEntry(raw: unknown): ItemNoteEntry | null {
  if (!raw || typeof raw !== "object") return null
  const { id, date, text } = raw as { id?: unknown; date?: unknown; text?: unknown }
  if (typeof id !== "string" || typeof text !== "string" || !text.trim()) return null
  return { id, date: typeof date === "string" ? date : "", text }
}

/** True when the task still carries notes in the old person place. */
export function hasPersonNoteLog(task: Pick<Task, "personProfile"> | null | undefined): boolean {
  return !!task?.personProfile && "noteLog" in task.personProfile
}

/**
 * Move `personProfile.noteLog` into `task.noteLog` (newest first, deduped by
 * id) and drop the old field. Returns the same object when there is nothing
 * to fold.
 */
export function foldPersonNoteLog<T extends Pick<Task, "personProfile" | "noteLog">>(task: T): T {
  if (!hasPersonNoteLog(task)) return task
  const { noteLog: old, ...profile } = task.personProfile!
  const have = new Set((task.noteLog ?? []).map((entry) => entry.id))
  const moved: ItemNoteEntry[] = []
  for (const raw of Array.isArray(old) ? old : []) {
    const entry = cleanEntry(raw)
    if (entry && !have.has(entry.id)) {
      have.add(entry.id)
      moved.push(entry)
    }
  }
  const next: T = { ...task, personProfile: Object.keys(profile).length > 0 ? profile : undefined }
  if (moved.length > 0) next.noteLog = notesNewestFirst([...(task.noteLog ?? []), ...moved])
  if (!next.personProfile) delete next.personProfile
  return next
}

/** v18 → v19: fold every task in a persisted task-store payload. */
export function migratePersonNoteLogs<S extends { tasks?: unknown }>(state: S): S {
  if (!state || !Array.isArray(state.tasks)) return state
  let changed = false
  const tasks = state.tasks.map((task: Task) => {
    const next = task && typeof task === "object" ? foldPersonNoteLog(task) : task
    if (next !== task) changed = true
    return next
  })
  return changed ? { ...state, tasks } : state
}
