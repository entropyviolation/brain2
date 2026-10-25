/**
 * components/ItemDetail/ItemTaskCardKey.tsx — Open this task's To Do card
 *
 * Sits in the Details rail (and the page's right column) for every task,
 * including a step item. A step opens the parent's card at that step.
 * When To Do is already mounted, the card opens there. Otherwise Home
 * switches to To Do so the card has a host.
 * _Last mapped: 2026-10-24_
 */
"use client"

import { Button } from "@/components/ui/button"
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { openTaskCard, useTaskCardStore } from "@/lib/task-card"
import type { Task } from "@/lib/types"

export function ItemTaskCardKey({
  task,
  onBeforeOpen,
}: {
  task: Pick<Task, "id" | "stepOf">
  /** Close item detail first, the same way the fascia Card key does. */
  onBeforeOpen?: () => void
}) {
  const hosts = useTaskCardStore((s) => s.hosts)
  return (
    <Button
      type="button"
      variant="outline"
      className="id-btn"
      title="Open the To Do task card"
      onClick={() => {
        const step = task.stepOf
        onBeforeOpen?.()
        openTaskCard(step ? step.taskId : task.id, step?.stepId)
        if (hosts > 0) return
        writeStoredTab(APP_NAV_KEYS.appTab, "home")
        writeStoredTab(APP_NAV_KEYS.homeTab, "todo")
        window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
      }}
    >
      Open task card
    </Button>
  )
}
