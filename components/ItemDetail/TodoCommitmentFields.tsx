/**
 * components/ItemDetail/TodoCommitmentFields.tsx — Required / prioritized
 *
 * One row per To Do period this item is already assigned to. Scheduling is
 * what assigns it. These switches only add required or prioritized.
 * Marks write through immediately so To Do updates before the rest of the
 * draft is saved, without copying unsaved edits onto the stored item.
 */
"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import type { Task, TodoMarkPeriod } from "@/lib/types"
import {
  assignedCommitmentSlots,
  nextPriorityIds,
  patchTodoCommitment,
  taskIsPrioritized,
  taskIsRequired,
} from "@/lib/todo-commitment"

function writeDayPriority(dayKey: string, taskId: string, on: boolean) {
  const reviews = useReviewsStore.getState()
  const morning = reviews.getMorningReview(dayKey)
  if (!morning) return
  const priorityTaskIds = nextPriorityIds(morning.priorityTaskIds, taskId, on)
  if (!priorityTaskIds) return
  reviews.saveMorningReview(dayKey, { priorityTaskIds })
}

export function TodoCommitmentFields({
  task,
  onChange,
  disabled,
}: {
  task: Task
  onChange: (next: Task) => void
  disabled?: boolean
}) {
  const morningIds = useReviewsStore((s) => s.getMorningReview)
  const slots = assignedCommitmentSlots(task)
  if (slots.length === 0) return null

  const toggle = (period: TodoMarkPeriod, periodKey: string, flag: "required" | "prioritized", on: boolean) => {
    const next = patchTodoCommitment(task, period, periodKey, { [flag]: on })
    onChange(next)
    const stored = useTaskStore.getState().tasks.find((row) => row.id === task.id)
    if (stored) {
      useTaskStore.getState().updateTask({ ...stored, todoMarks: next.todoMarks })
    }
    if (period === "day" && flag === "prioritized") writeDayPriority(periodKey, task.id, on)
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <Label className="text-sm font-semibold">Required and prioritized</Label>
        <p className="text-xs text-muted-foreground">
          This item is assigned to every period below. Required must be done and sits on its own list. Prioritized
          stays on Assigned and is marked.
        </p>
      </div>
      {slots.map((slot) => {
        const ritualIds =
          slot.period === "day" ? morningIds(slot.key)?.priorityTaskIds : undefined
        const required = taskIsRequired(task, slot.period, slot.key)
        const prioritized = taskIsPrioritized(task, slot.period, slot.key, ritualIds)
        return (
          <div key={`${slot.period}:${slot.key}`} className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm">{slot.label}</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  aria-label={`Required for ${slot.label}`}
                  checked={required}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(slot.period, slot.key, "required", !!checked)}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  aria-label={`Prioritized for ${slot.label}`}
                  checked={prioritized}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(slot.period, slot.key, "prioritized", !!checked)}
                />
                Prioritized
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
