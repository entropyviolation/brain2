/**
 * lib/inbox-bimby/apply.ts — Using a suggestion (pure)
 *
 * File: adds the list to the idea and takes it out of the Inbox.
 * Merge: the item the idea matches survives; the Inbox idea is folded into it
 * (`lib/item-merge.ts`, every detail kept). The caller remembers the world first,
 * so Cmd/Ctrl-Z undoes, and passes `discardedIds` to the store as tombstones.
 */

import { applyListsToInboxItems, clarifyInboxItems } from "@/lib/inbox-batch"
import { applyItemMerge, defaultItemMergePlan, type ItemMergePlan } from "@/lib/item-merge"
import type { List, Task } from "@/lib/types"

export function applyFile(tasks: Task[], taskId: string, listId: string): Task[] {
  return clarifyInboxItems(applyListsToInboxItems(tasks, [taskId], [listId]), [taskId])
}

/** The plan that folds `taskId` into `targetId`, or null when either is gone. */
export function mergePlan(tasks: readonly Task[], lists: readonly List[], taskId: string, targetId: string): ItemMergePlan | null {
  const idea = tasks.find((t) => t.id === taskId)
  const target = tasks.find((t) => t.id === targetId)
  if (!idea || !target || idea.id === target.id) return null
  return defaultItemMergePlan([target, idea], [...lists])
}

export function applyMerge(tasks: Task[], plan: ItemMergePlan): Task[] {
  return applyItemMerge(tasks, plan)
}
