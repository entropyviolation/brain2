/**
 * components/ItemDetail/tabs/details/ItemRewardField.tsx — Details-tab Reward Value
 *
 * The number is `Task.pointsOverride`, the same field the task card's
 * On done dial writes. Empty clears it, so the list rule can return.
 * `rewardValue` stays the older item-value fallback and is not this control.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Award } from "lucide-react"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import type { Task } from "@/lib/types"

/** Blank clears the override. A number is points on done, zero allowed. */
export function pointsOnDoneFromInput(raw: string): number | undefined {
  const t = raw.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n)) return undefined
  return Math.max(0, n)
}

function withPointsOnDone(task: Task, raw: string): Task {
  const n = pointsOnDoneFromInput(raw)
  if (n === undefined) {
    if (task.pointsOverride === undefined) return task
    const next = { ...task }
    delete next.pointsOverride
    return next
  }
  return task.pointsOverride === n ? task : { ...task, pointsOverride: n }
}

export function ItemRewardField({
  task,
  touchDraft,
  setTask,
  variant,
  isEditing = true,
}: {
  task: Task
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  variant: "popup" | "page"
  /** Page-only: when false, shows the stored on-done points. */
  isEditing?: boolean
}) {
  const shown = task.pointsOverride
  const value = shown == null ? "" : String(shown)
  const onLiveChange = (raw: string) => touchDraft({ pointsOverride: pointsOnDoneFromInput(raw) })
  const onCommit = (raw: string) => setTask((prev) => (prev ? withPointsOnDone(prev, raw) : prev))

  if (variant === "popup") {
    return (
      <div className="space-y-3">
        <Label htmlFor="reward-value" className="text-sm font-semibold flex items-center gap-2">
          <Award className="h-4 w-4" />
          Reward Value
        </Label>
        <IsolatedInput
          id="reward-value"
          type="number"
          min={0}
          value={value}
          onLiveChange={onLiveChange}
          onCommit={onCommit}
          className="focus-ring"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="reward-value">Reward Value</Label>
      {isEditing ? (
        <IsolatedInput
          id="reward-value"
          type="number"
          min={0}
          value={value}
          onLiveChange={onLiveChange}
          onCommit={onCommit}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          <span>{shown == null ? "—" : shown}</span>
        </div>
      )}
    </div>
  )
}
