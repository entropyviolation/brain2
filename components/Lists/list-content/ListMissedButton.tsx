"use client"

import { isMissed } from "@/lib/completion-status"
import type { Task } from "@/lib/types"

export function ListMissedButton({
  task,
  onMissed,
}: {
  task: Task
  onMissed?: (taskId: string) => void
}) {
  if (!onMissed) return null
  return (
    <button
      className="fm-checkbox fm-missed"
      onClick={(e) => {
        e.stopPropagation()
        onMissed(task.id)
      }}
      aria-label="Missed opportunity — too late"
      title="Missed opportunity — too late"
    >
      {isMissed(task) ? "✗" : ""}
    </button>
  )
}
