/**
 * components/ItemDetail/chrome/ItemTaskCardKey.tsx — Open this task's To Do card
 *
 * Sits in the Details rail (and the page's right column) for every task,
 * including a step item. A step opens the parent's card at that step.
 * When To Do is already mounted, the card opens there. Otherwise Home
 * switches to To Do so the card has a host. The shell now row uses the
 * same door (`openTodoTaskCard`) for the task already on the pen clock.
 * _Last mapped: 2026-10-24_
 */
"use client"

import { Button } from "@/components/ui/button"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { openTaskCard, useTaskCardStore } from "@/lib/task-card"
import type { Task } from "@/lib/types"

/** Open the To Do task card. A step item opens its parent at that step. */
export function openTodoTaskCard(task: Pick<Task, "id" | "stepOf">, stepId?: string): void {
  const owned = task.stepOf
  openTaskCard(owned ? owned.taskId : task.id, owned ? owned.stepId : stepId)
  if (useTaskCardStore.getState().hosts > 0) return
  writeStoredTab(APP_NAV_KEYS.appTab, "home")
  writeStoredTab(APP_NAV_KEYS.homeTab, "todo")
  window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

export function ItemTaskCardKey({
  task,
  onBeforeOpen,
}: {
  task: Pick<Task, "id" | "stepOf">
  /** Close item detail first, the same way the fascia Card key does. */
  onBeforeOpen?: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="id-btn"
      title="Open the To Do task card"
      onClick={() => {
        onBeforeOpen?.()
        openTodoTaskCard(task)
      }}
    >
      Open task card
    </Button>
  )
}
