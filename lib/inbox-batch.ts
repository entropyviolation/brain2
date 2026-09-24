/**
 * lib/inbox-batch.ts — Inbox walk queue + batch list/deadline patches
 *
 * Pure helpers for the Inbox keyboard step-through and multi-select batch
 * actions. The open list is newest capture first (`sortInboxNewestFirst`).
 * Walk queues only the current selection (`walkQueueIds`). Merge
 * still goes through `lib/item-merge.ts`.
 */
import type { Task } from "@/lib/types"
import { safeToDate } from "@/lib/date-utils"
import { uniqueNonEmpty } from "@/lib/list-merge"
import { clarifyNeedsAttentionItem } from "@/lib/needs-attention"

function createdMs(task: Task): number {
  const date = safeToDate(task.createdAt)
  return date ? date.getTime() : Number.NEGATIVE_INFINITY
}

/**
 * Newest capture first. A missing or invalid `createdAt` sinks to the bottom.
 * Equal timestamps keep the later array entry above the earlier one.
 */
export function sortInboxNewestFirst(tasks: Task[]): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const delta = createdMs(b.task) - createdMs(a.task)
      if (delta !== 0) return delta
      return b.index - a.index
    })
    .map((row) => row.task)
}

/** Keyboard chords while the Inbox list (not a nested field) is focused. */
export const INBOX_CHORDS = {
  next: ["j", "ArrowDown"],
  prev: ["k", "ArrowUp"],
  toggle: ["x"],
  selectAll: ["a"],
  deselectAll: ["u"],
  clarify: ["c", "Enter"],
  walk: ["w"],
  applyList: ["l"],
  applyDeadline: ["d"],
  merge: ["m"],
  deleteSelection: ["#", "Backspace", "Delete"],
  markClarified: ["y"],
  toMonkey: ["b"],
  toInbox: ["i"],
  bulkEdit: ["e"],
} as const

/** Inbox is the pile to revisit. Monkey brain is the compulsive dump. */
export type InboxPartition = "inbox" | "monkey"

export function inInboxPartition(task: Task, partition: InboxPartition): boolean {
  if (task.stage !== "inbox" || task.completed) return false
  return partition === "monkey" ? task.monkeyBrain === true : task.monkeyBrain !== true
}

/** Open ideas in the revisit Inbox (Monkey brain does not count). */
export function openRevisitInboxIds(tasks: Task[]): Set<string> {
  return new Set(tasks.filter((task) => inInboxPartition(task, "inbox")).map((task) => task.id))
}

export function isInboxEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLInputElement) {
    const type = target.type
    if (type === "checkbox" || type === "radio" || type === "button" || type === "submit") return false
    return true
  }
  const tag = target.tagName
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  return target.isContentEditable
}

export function rotateInboxQueue(ids: string[], startId: string | null | undefined): string[] {
  if (!startId) return ids
  const i = ids.indexOf(startId)
  if (i <= 0) return ids
  return [...ids.slice(i), ...ids.slice(0, i)]
}

export function openInboxIds(tasks: Task[]): Set<string> {
  return new Set(tasks.filter((task) => task.stage === "inbox" && !task.completed).map((task) => task.id))
}

/**
 * Next remaining inbox id in `queue` after `afterId`.
 * Skipped items stay in the queue and wrap until only `afterId` is left
 * (then `null` — the walk stops rather than looping the same card).
 */
export function nextWalkId(queue: string[], openIds: Set<string>, afterId: string | null): string | null {
  if (queue.length === 0) return null
  const start = afterId ? queue.indexOf(afterId) : -1
  for (let step = 1; step <= queue.length; step++) {
    const id = queue[(Math.max(start, -1) + step) % queue.length]
    if (openIds.has(id) && id !== afterId) return id
  }
  return null
}

export function firstWalkId(queue: string[], openIds: Set<string>): string | null {
  return queue.find((id) => openIds.has(id)) ?? null
}

/**
 * Walk queue is the current checkbox selection only.
 * Select-all (`a`) is how you walk every open idea. Nothing selected → empty.
 */
/** Keep title + description in lockstep when the capture line was the name. */
export function renameInboxIdea(task: Task, name: string): Pick<Task, "title" | "description"> {
  const next = name.trim()
  const prev = task.title?.trim() || task.description?.trim() || ""
  const desc = task.description?.trim() || ""
  if (!next) return { title: task.title, description: task.description }
  if (!desc || desc === prev) return { title: next, description: next }
  return { title: next, description: task.description }
}

export function walkQueueIds(
  inboxIds: string[],
  selectedIds: string[],
  fromId?: string | null,
): string[] {
  if (selectedIds.length === 0) return []
  const selected = new Set(selectedIds)
  const queue = inboxIds.filter((id) => selected.has(id))
  const start = fromId && selected.has(fromId) ? fromId : queue[0]
  return rotateInboxQueue(queue, start)
}

export function toggleSelectedId(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
}

export function applyListsToInboxItems(tasks: Task[], itemIds: string[], listIds: string[]): Task[] {
  const ids = new Set(itemIds)
  const add = uniqueNonEmpty(listIds)
  if (ids.size === 0 || add.length === 0) return tasks
  return tasks.map((task) => {
    if (!ids.has(task.id)) return task
    return { ...task, lists: uniqueNonEmpty([...(task.lists ?? []), ...add]) }
  })
}

export function inboxAllSelected(inboxIds: string[], selectedIds: string[]): boolean {
  return inboxIds.length > 0 && inboxIds.every((id) => selectedIds.includes(id))
}

export function deleteInboxItems(tasks: Task[], itemIds: string[]): Task[] {
  const ids = new Set(itemIds)
  if (ids.size === 0) return tasks
  return tasks.filter((task) => !ids.has(task.id))
}

function withoutMonkeyBrain(task: Task): Task {
  if (!task.monkeyBrain) return task
  const { monkeyBrain: _gone, ...rest } = task
  return rest
}

/**
 * Leave Inbox. Items keep the lists already on them (those lists show the
 * item). With no list, stage becomes `list` so Home / global All Items still
 * holds them. Monkey brain is dropped — they are no longer a dump.
 */
export function clarifyInboxItems(tasks: Task[], itemIds: string[]): Task[] {
  const ids = new Set(itemIds)
  if (ids.size === 0) return tasks
  return tasks.map((task) => {
    if (!ids.has(task.id) || task.stage !== "inbox") return task
    return withoutMonkeyBrain(clarifyNeedsAttentionItem(task))
  })
}

/** Move open Inbox ideas between the revisit pile and Monkey brain. */
export function setInboxMonkeyBrain(tasks: Task[], itemIds: string[], monkeyBrain: boolean): Task[] {
  const ids = new Set(itemIds)
  if (ids.size === 0) return tasks
  return tasks.map((task) => {
    if (!ids.has(task.id) || task.stage !== "inbox") return task
    if (monkeyBrain) return task.monkeyBrain ? task : { ...task, monkeyBrain: true }
    return withoutMonkeyBrain(task)
  })
}

export function applyDeadlineToInboxItems(tasks: Task[], itemIds: string[], deadline: Date): Task[] {
  const ids = new Set(itemIds)
  if (ids.size === 0) return tasks
  return tasks.map((task) => (ids.has(task.id) ? { ...task, deadline } : task))
}

export function inboxBatchTargets(selectedIds: string[], focusId: string | null): string[] {
  if (selectedIds.length > 0) return selectedIds
  return focusId ? [focusId] : []
}
