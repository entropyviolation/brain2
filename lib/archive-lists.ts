/**
 * lib/archive-lists.ts — Next Actions Completed / Missed Opportunities membership
 *
 * Those two collections are real lists under Next Actions. Completing a task
 * joins Completed (unless the user removed it by hand — `listMembershipExclusions`);
 * marking missed joins Missed Opportunities. Leaving a state drops auto
 * membership. A join-only sweep backfills existing done/missed rows.
 *
 * Period To Do smart lists stay live filters; these archives do not.
 */
import type { Folder, List, Task } from "@/lib/types"
import { isMissed } from "@/lib/completion-status"
import {
  findNextActionsFolder,
  NA_SMART_COMPLETED,
  NA_SMART_MISSED,
} from "@/lib/scheduled-lists-sync"

export const ARCHIVE_COMPLETED_NAME = "Completed"
export const ARCHIVE_MISSED_NAME = "Missed Opportunities"

export type ArchiveKind = "completed" | "missed"

export const ARCHIVE_LIST_SPECS: {
  kind: ArchiveKind
  id: string
  name: string
  color: string
}[] = [
  { kind: "completed", id: NA_SMART_COMPLETED, name: ARCHIVE_COMPLETED_NAME, color: "#059669" },
  { kind: "missed", id: NA_SMART_MISSED, name: ARCHIVE_MISSED_NAME, color: "#b45309" },
]

function canonicalArchiveId(kind: ArchiveKind): string {
  return kind === "completed" ? NA_SMART_COMPLETED : NA_SMART_MISSED
}

function archiveName(kind: ArchiveKind): string {
  return kind === "completed" ? ARCHIVE_COMPLETED_NAME : ARCHIVE_MISSED_NAME
}

export function isArchiveKind(value: unknown): value is ArchiveKind {
  return value === "completed" || value === "missed"
}

/** Resolve the live list id, preferring a tagged/canonical/name match. */
export function resolveArchiveListId(lists: List[], folders: Folder[], kind: ArchiveKind): string {
  const tagged = lists.find((l) => l.autoArchive === kind)
  if (tagged) return tagged.id
  const canonical = canonicalArchiveId(kind)
  if (lists.some((l) => l.id === canonical)) return canonical
  const na = findNextActionsFolder(folders)
  if (na) {
    const name = archiveName(kind)
    const hit = lists.find((l) => na.listIds.includes(l.id) && l.name === name)
    if (hit) return hit.id
  }
  return canonical
}

export function isNaArchiveListId(id: string, lists?: List[]): boolean {
  if (id === NA_SMART_COMPLETED || id === NA_SMART_MISSED) return true
  return !!lists?.some((l) => l.id === id && isArchiveKind(l.autoArchive))
}

function uniqueLists(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function excludedFrom(task: Task, listId: string): boolean {
  return (task.listMembershipExclusions ?? []).includes(listId)
}

function hasList(task: Task, listId: string): boolean {
  return (task.lists ?? []).includes(listId)
}

function joinList(task: Task, listId: string): Task {
  if (!listId || excludedFrom(task, listId) || hasList(task, listId)) return task
  return { ...task, lists: uniqueLists([...(task.lists ?? []), listId]) }
}

function leaveList(task: Task, listId: string): Task {
  if (!listId || !hasList(task, listId)) return task
  return { ...task, lists: (task.lists ?? []).filter((id) => id !== listId) }
}

/**
 * Keep archive membership in sync with completion/missed transitions.
 * Pass `previous === task` (sweep) to **join only** — never yank a hand-added row.
 */
export function withArchiveListMembership(
  task: Task,
  previous: Task | undefined,
  lists: List[],
  folders: Folder[],
): Task {
  const completedId = resolveArchiveListId(lists, folders, "completed")
  const missedId = resolveArchiveListId(lists, folders, "missed")
  const joinOnly = !previous || previous === task

  if (joinOnly) {
    let next = task
    if (task.completed) next = joinList(next, completedId)
    if (isMissed(next)) next = joinList(next, missedId)
    return next
  }

  const wasCompleted = previous.completed
  const nowCompleted = task.completed
  const wasMissed = isMissed(previous)
  const nowMissed = isMissed(task)

  let next = task
  if (nowCompleted && !wasCompleted) {
    next = joinList(next, completedId)
    next = leaveList(next, missedId)
  }
  if (!nowCompleted && wasCompleted) {
    next = leaveList(next, completedId)
  }
  if (nowMissed && !wasMissed) {
    next = joinList(next, missedId)
    next = leaveList(next, completedId)
  }
  if (!nowMissed && wasMissed && !nowCompleted) {
    next = leaveList(next, missedId)
  }
  return next
}

/** Join-only backfill so existing done/missed rows appear on the auto lists. */
export function joinArchiveListMembership(tasks: Task[], lists: List[], folders: Folder[]): Task[] {
  let changed = false
  const next = tasks.map((task) => {
    const applied = withArchiveListMembership(task, task, lists, folders)
    if (applied !== task) changed = true
    return applied
  })
  return changed ? next : tasks
}

function archiveTime(task: Task, field: "completedDate" | "missedAt"): number {
  const raw = task[field]
  if (!raw) return 0
  const d = raw instanceof Date ? raw : new Date(raw)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

/** Open an archive list like any other: membership on `Task.lists`. */
export function tasksForArchiveList(tasks: Task[], listId: string, kind?: ArchiveKind): Task[] {
  const members = tasks.filter((t) => hasList(t, listId))
  const sortField: "completedDate" | "missedAt" =
    kind === "missed" || listId === NA_SMART_MISSED ? "missedAt" : "completedDate"
  return members.sort((a, b) => archiveTime(b, sortField) - archiveTime(a, sortField))
}
