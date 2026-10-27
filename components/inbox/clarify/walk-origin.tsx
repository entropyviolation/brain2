/**
 * components/inbox/clarify/walk-origin.tsx
 * Stored door under the walk subtitle.
 * Blank when this idea stored no door.
 */
"use client"

import { captureOriginView } from "@/lib/capture-origin"
import type { Task } from "@/lib/types"

/** Quiet line under the walk subtitle. Blank when this idea stored no door. */
export function WalkOrigin({ task }: { task: Task }) {
  const line = captureOriginView(task)
  if (!line) return null
  const text = line.detail ? `${line.label} · ${line.detail}` : line.label
  return (
    <p className="inbox-walk-origin" data-testid="inbox-walk-origin" title={text}>
      <span className="inbox-walk-origin-type">{line.label}</span>
      {line.detail ? <span className="inbox-walk-origin-detail"> · {line.detail}</span> : null}
    </p>
  )
}
