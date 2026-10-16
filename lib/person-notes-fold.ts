/**
 * lib/person-notes-fold.ts — Person dated notes join the item Notes log
 *
 * Older person records kept dated notes on `personProfile.noteLog`. The
 * Notes tab is the one place for notes now, so those entries move onto
 * `Task.noteLog` (the shapes match). Ids already there are skipped, the log
 * stays newest first, and `personProfile.noteLog` is dropped. Idempotent:
 * persist v19 runs it, and the person Notes tab runs it again on load so an
 * old-shape hub or backup import still folds.
 */
import type { ItemNoteEntry, Task } from "@/lib/types"

function newestFirst(rows: ItemNoteEntry[]): ItemNoteEntry[] {
  return [...rows].sort((a, b) => {
    const ak = `${a.date} ${a.time ?? ""}`
    const bk = `${b.date} ${b.time ?? ""}`
    return ak < bk ? 1 : ak > bk ? -1 : 0
  })
}

/** Same task when there is nothing to fold. */
export function foldPersonNoteLog<T extends Pick<Task, "noteLog" | "personProfile">>(task: T): T {
  const legacy = task.personProfile?.noteLog
  if (!legacy || legacy.length === 0) {
    if (task.personProfile && "noteLog" in task.personProfile) {
      const { noteLog: _drop, ...rest } = task.personProfile
      return { ...task, personProfile: Object.keys(rest).length > 0 ? rest : undefined }
    }
    return task
  }
  const current = task.noteLog ?? []
  const seen = new Set(current.map((entry) => entry.id))
  const moved: ItemNoteEntry[] = []
  for (const note of legacy) {
    if (!note || typeof note.text !== "string" || !note.text.trim() || seen.has(note.id)) continue
    seen.add(note.id)
    moved.push({ id: note.id, date: note.date, text: note.text })
  }
  const { noteLog: _old, ...rest } = task.personProfile!
  return {
    ...task,
    noteLog: moved.length > 0 ? newestFirst([...current, ...moved]) : task.noteLog,
    personProfile: Object.keys(rest).length > 0 ? rest : undefined,
  }
}

/** Persist v19: fold every task in a raw snapshot. */
export function migratePersonNotesToNoteLog<S extends { tasks?: unknown }>(state: S): S {
  if (!state || !Array.isArray(state.tasks)) return state
  let changed = false
  const tasks = (state.tasks as Task[]).map((task) => {
    if (!task || typeof task !== "object") return task
    const next = foldPersonNoteLog(task)
    if (next !== task) changed = true
    return next
  })
  return changed ? { ...state, tasks } : state
}
