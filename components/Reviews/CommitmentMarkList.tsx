/**
 * components/Reviews/CommitmentMarkList.tsx — Required / prioritized task checkboxes
 *
 * Shared mark UI for MorningReview (split Required vs Prioritized sections) and
 * StartRitualDialog (both marks on each row). Parents own section copy, id
 * lists, caps, and persistence via `tasksWithCommitment`.
 */
"use client"

import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"

export type CommitmentMarkKind = "required" | "prioritized"

/** One mark per row (morning sections) or both labeled marks on the right (start ritual). */
export type CommitmentMarkMode = "required" | "prioritized" | "both"

export function CommitmentMarkList({
  tasks,
  requiredIds,
  prioritizedIds = [],
  onToggle,
  marks = "required",
}: {
  tasks: Task[]
  requiredIds: readonly string[]
  prioritizedIds?: readonly string[]
  onToggle: (kind: CommitmentMarkKind, taskId: string) => void
  marks?: CommitmentMarkMode
}) {
  if (marks === "both") {
    return (
      <div className="space-y-1">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 border rounded-md p-2 text-sm">
            <span className="truncate flex-1">{itemTitle(task)}</span>
            <label className="flex items-center gap-1 shrink-0">
              <input
                type="checkbox"
                checked={requiredIds.includes(task.id)}
                onChange={() => onToggle("required", task.id)}
              />
              Required
            </label>
            <label className="flex items-center gap-1 shrink-0">
              <input
                type="checkbox"
                checked={prioritizedIds.includes(task.id)}
                onChange={() => onToggle("prioritized", task.id)}
              />
              Prioritized
            </label>
          </div>
        ))}
      </div>
    )
  }

  const ids = marks === "prioritized" ? prioritizedIds : requiredIds
  const kind: CommitmentMarkKind = marks

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <label
          key={task.id}
          className="flex items-center gap-2 border rounded-md p-2 text-sm cursor-pointer"
        >
          <input
            type="checkbox"
            checked={ids.includes(task.id)}
            onChange={() => onToggle(kind, task.id)}
          />
          <span className="truncate flex-1">{itemTitle(task)}</span>
        </label>
      ))}
    </div>
  )
}
