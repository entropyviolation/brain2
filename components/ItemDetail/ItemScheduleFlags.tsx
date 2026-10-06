/**
 * components/ItemDetail/ItemScheduleFlags.tsx — Send to Scheduler + Auto-push
 *
 * Shared by the popup and page scheduling tabs. Same copy and the same
 * inherit-on / force-off scheduleable wiring. Date, week, month, year, and
 * deadline fields stay in each shell — those differ (clear siblings vs patch,
 * week picker vs free text, edit gating).
 */
"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  isTaskScheduleable,
  nextTaskScheduleableFlag,
  taskInheritsScheduleableFromLists,
} from "@/components/Scheduler/scheduler-utils"
import type { Task } from "@/lib/types"

export function ItemScheduleFlags({
  task,
  scheduleableCategoryIds,
  onChange,
  disabled,
}: {
  task: Task
  scheduleableCategoryIds: Set<string>
  onChange: (next: Task) => void
  disabled?: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="text-sm font-semibold">Send to Scheduler</Label>
          <p className="text-xs text-muted-foreground">
            Off unless you turn it on, or a list this item is on is already sent. Dates, deadlines,
            and an itinerary are not the Scheduler.
          </p>
        </div>
        <Switch
          aria-label="Send to Scheduler"
          checked={isTaskScheduleable(task, scheduleableCategoryIds)}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({
              ...task,
              scheduleable: nextTaskScheduleableFlag({
                turnOn: !!checked,
                inheritsOnFromLists: taskInheritsScheduleableFromLists(task, scheduleableCategoryIds),
              }),
            })
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="text-sm font-semibold">Auto-push</Label>
          <p className="text-xs text-muted-foreground">
            Off unless you turn it on. When this day, week, or month ends unfinished, it stays Undone for
            that period and is scheduled on the next one in To Do. This does not put the item in the Scheduler.
          </p>
        </div>
        <Switch
          aria-label="Auto-push"
          checked={task.autoPush === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...task, autoPush: !!checked })}
        />
      </div>
    </>
  )
}
