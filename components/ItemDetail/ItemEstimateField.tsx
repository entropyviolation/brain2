/**
 * components/ItemDetail/ItemEstimateField.tsx — Estimated duration LiveInput
 *
 * Shared draft wiring for the Details-tab duration field on popup and page.
 * Presentation stays shell-specific via `variant` (labels, icon, read-only).
 * The popup Time tab uses a different empty→undefined parse — leave that alone.
 */
"use client"

import type { Dispatch, SetStateAction } from "react"
import { Clock } from "lucide-react"
import { IsolatedInput } from "@/components/ui/isolated-text-field"
import { Label } from "@/components/ui/label"
import type { Task } from "@/lib/types"

export function ItemEstimateField({
  estimatedDuration,
  touchDraft,
  setTask,
  variant,
  isEditing = true,
}: {
  estimatedDuration: number | undefined
  touchDraft: (patch: Partial<Task>) => void
  setTask: Dispatch<SetStateAction<Task | null>>
  variant: "popup" | "page"
  /** Page-only: when false, shows a read-only duration line. */
  isEditing?: boolean
}) {
  const value = String(estimatedDuration ?? "")
  // Same parse as both shells used before extract: empty / NaN → 0 (not undefined).
  const onLiveChange = (v: string) => touchDraft({ estimatedDuration: Number.parseInt(v) || 0 })
  const onCommit = (v: string) =>
    setTask((prev) => (prev ? { ...prev, estimatedDuration: Number.parseInt(v) || 0 } : prev))

  if (variant === "popup") {
    return (
      <div className="space-y-3">
        <Label htmlFor="estimated-duration" className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Estimated Duration
        </Label>
        <div className="relative">
          <IsolatedInput
            id="estimated-duration"
            type="number"
            value={value}
            onLiveChange={onLiveChange}
            onCommit={onCommit}
            className="focus-ring pr-12"
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground">
            min
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="estimated-duration">Estimated Duration (minutes)</Label>
      {isEditing ? (
        <IsolatedInput
          id="estimated-duration"
          type="number"
          value={value}
          onLiveChange={onLiveChange}
          onCommit={onCommit}
        />
      ) : (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{estimatedDuration} minutes</span>
        </div>
      )}
    </div>
  )
}
