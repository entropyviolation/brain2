/**
 * lib/inbox-credit.ts — Points for handling Inbox ideas
 *
 * Addressing an idea (clarify or discard) is worth 1 point. Emptying the
 * Inbox (0 open ideas) awards a 50-point clear bonus each time it happens.
 */
import { itemTitle } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import type { Task } from "@/lib/types"

export const INBOX_HANDLE_POINTS = 1
export const INBOX_CLEAR_BONUS = 50

export function shouldAwardInboxClear(openBefore: number, openAfter: number): boolean {
  return openBefore > 0 && openAfter === 0
}

export function inboxHandleLabel(task: Pick<Task, "title" | "description"> | string): string {
  const name = typeof task === "string" ? task.trim() : itemTitle(task)
  return `Inbox handled: ${name || "idea"}`
}

export function creditInboxBatchHandling(
  items: { taskId: string; title: string }[],
  openBefore: number,
  openAfter: number,
): void {
  const addPoints = usePointsStore.getState().addPoints
  for (const item of items) {
    addPoints(item.taskId, INBOX_HANDLE_POINTS, inboxHandleLabel(item.title))
  }
  if (items.length > 0 && shouldAwardInboxClear(openBefore, openAfter)) {
    addPoints(`inbox-clear:${Date.now()}`, INBOX_CLEAR_BONUS, "Inbox cleared")
  }
}

export function creditInboxHandling(opts: {
  taskId: string
  title: string
  openBefore: number
  openAfter: number
}): void {
  const addPoints = usePointsStore.getState().addPoints
  addPoints(opts.taskId, INBOX_HANDLE_POINTS, inboxHandleLabel(opts.title))
  if (shouldAwardInboxClear(opts.openBefore, opts.openAfter)) {
    addPoints(`inbox-clear:${Date.now()}`, INBOX_CLEAR_BONUS, "Inbox cleared")
  }
}
