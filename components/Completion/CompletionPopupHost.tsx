/**
 * components/Completion/CompletionPopupHost.tsx — Global completion popup host
 *
 * Mounted once at the app root. Subscribes to the completion event bus and
 * shows the completion dialog for every completed task (queuing rapid
 * completions so none are missed). The dialog chunk loads on the first
 * completion event, not on first paint, so a refresh does not parse it.
 * Events that arrive while that chunk loads stay in the queue.
 */
"use client"

import { useEffect, useRef, useState, type ComponentType } from "react"
import { onTaskCompleted, type TaskCompletedEvent } from "@/lib/completion-events"

type CompletionDialogProps = {
  taskId: string
  basePoints: number
  pending?: boolean
  onClose: () => void
}

export function CompletionPopupHost() {
  const [queue, setQueue] = useState<TaskCompletedEvent[]>([])
  const [Dialog, setDialog] = useState<ComponentType<CompletionDialogProps> | null>(null)
  const requested = useRef(false)

  useEffect(() => {
    let live = true
    const stop = onTaskCompleted((event) => {
      setQueue((q) => (q.some((e) => e.taskId === event.taskId) ? q : [...q, event]))
      if (requested.current) return
      requested.current = true
      void import("./CompletionDialog").then((mod) => {
        if (live) setDialog(() => mod.CompletionDialog)
      })
    })
    return () => {
      live = false
      stop()
    }
  }, [])

  const current = queue[0]
  if (!current || !Dialog) return null

  return (
    <Dialog
      key={`${current.taskId}-${current.at.getTime()}`}
      taskId={current.taskId}
      basePoints={current.basePoints}
      pending={!!current.pending}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  )
}
