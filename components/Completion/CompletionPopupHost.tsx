/**
 * components/Completion/CompletionPopupHost.tsx — Global completion popup host
 *
 * Mounted once at the app root. Subscribes to the completion event bus and shows
 * the CompletionDialog for every completed task (queuing rapid completions so
 * none are missed), so the popup appears each and every time a task is done.
 */
"use client"

import { useEffect, useState } from "react"
import { onTaskCompleted, type TaskCompletedEvent } from "@/lib/completion-events"
import { CompletionDialog } from "./CompletionDialog"

export function CompletionPopupHost() {
  const [queue, setQueue] = useState<TaskCompletedEvent[]>([])

  useEffect(() => onTaskCompleted((event) => setQueue((q) => [...q, event])), [])

  const current = queue[0]
  if (!current) return null

  return (
    <CompletionDialog
      key={`${current.taskId}-${current.at.getTime()}`}
      taskId={current.taskId}
      basePoints={current.basePoints}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  )
}
