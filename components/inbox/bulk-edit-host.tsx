/**
 * Bulk edit host. `afterAdd` keeps each idea's arrival, door, and monkey flag.
 * It reads `bulkSource` from the render that created the callback.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { EnhancedBulkAdd } from "@/components/enhanced-bulk-add"
import { useTaskStore } from "@/lib/task-store"
import { deleteInboxItems, openRevisitInboxIds } from "@/lib/inbox-batch"
import { creditInboxBatchHandling } from "@/lib/inbox-credit"
import { itemTitle } from "@/lib/item-utils"
import { safeToDate } from "@/lib/date-utils"
import type { Task } from "@/lib/types"

export function InboxBulkEditHost({
  bulkSource,
  setBulkSource,
  updateTask,
  setTasks,
  noteSitting,
  setSelectedIds,
  setUndoLabel,
}: {
  bulkSource: { ids: string[]; text: string; monkey: boolean } | null
  setBulkSource: Dispatch<SetStateAction<{ ids: string[]; text: string; monkey: boolean } | null>>
  updateTask: (task: Task) => void
  setTasks: (tasks: Task[], options?: { tombstoneIds?: readonly string[] }) => void
  noteSitting: (count: number, openBefore: number, openAfter: number) => void
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  setUndoLabel: Dispatch<SetStateAction<string | null>>
}) {
  return (
    <EnhancedBulkAdd
      hideTrigger
      open={bulkSource !== null}
      initialText={bulkSource?.text ?? ""}
      defaultSendToInbox
      actionLabel="inbox bulk edit"
      stampOrigin={false}
      title="Bulk edit"
      description="Each selected idea is one line. Edit freely, then add them the same way as Bulk Add. Leave “Send to Inbox” checked to put them back in this pile, or uncheck to file them onto their lists (or All Items)."
      onOpenChange={(next) => {
        if (!next) setBulkSource(null)
      }}
      afterAdd={({ sendToInbox, tasks }) => {
        if (!bulkSource) return
        const originals = bulkSource.ids
          .map((id) => useTaskStore.getState().tasks.find((task) => task.id === id))
          .filter((task): task is Task => !!task)
        for (let i = 0; i < tasks.length; i++) {
          const sourceAt = safeToDate(originals[i]?.createdAt)
          const sourceOrigin = originals[i]?.captureOrigin
          const live = useTaskStore.getState().tasks.find((row) => row.id === tasks[i].id) ?? tasks[i]
          const monkey = bulkSource.monkey && sendToInbox && live.stage === "inbox" && !live.monkeyBrain
          if (!sourceAt && !monkey && !sourceOrigin) continue
          updateTask({
            ...live,
            ...(sourceAt ? { createdAt: sourceAt } : {}),
            ...(sourceOrigin ? { captureOrigin: sourceOrigin } : {}),
            ...(monkey ? { monkeyBrain: true } : {}),
          })
        }
        const openBefore = openRevisitInboxIds(useTaskStore.getState().tasks).size
        const removed = bulkSource.ids
          .map((id) => useTaskStore.getState().tasks.find((task) => task.id === id))
          .filter((task): task is Task => !!task)
        setTasks(deleteInboxItems(useTaskStore.getState().tasks, bulkSource.ids), {
          tombstoneIds: bulkSource.ids,
        })
        if (!sendToInbox) {
          const openAfter = openRevisitInboxIds(useTaskStore.getState().tasks).size
          creditInboxBatchHandling(
            removed.map((task) => ({ taskId: task.id, title: itemTitle(task) })),
            openBefore,
            openAfter,
          )
          noteSitting(removed.length, openBefore, openAfter)
        }
        setSelectedIds([])
        setUndoLabel("inbox bulk edit")
        setBulkSource(null)
      }}
    />
  )
}
