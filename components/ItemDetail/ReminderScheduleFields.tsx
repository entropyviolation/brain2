"use client"

import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  applyReminderPrefs,
  applyReminderSchedule,
  parseReminderWhen,
  reminderPersists,
  reminderTexts,
  reminderWhenInputValue,
  type ReminderRepeat,
} from "@/lib/reminders"
import type { Task } from "@/lib/types"

/** Clock, repeat, Text me, and Persistent for an item already on the Reminders list. */
export function ReminderScheduleFields({
  task,
  onChange,
}: {
  task: Task
  onChange: (patch: Pick<Task, "scheduledDate" | "scheduledTime" | "reminder">) => void
}) {
  const repeat = task.reminder?.repeat ?? "once"
  const when = reminderWhenInputValue(task)

  const apply = (nextWhen: string, nextRepeat: ReminderRepeat) => {
    const at = parseReminderWhen(nextWhen)
    if (!at) return
    onChange(applyReminderSchedule(task, at, nextRepeat))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">When</Label>
        <input
          className="fm-input focus-ring"
          type="datetime-local"
          aria-label="Reminder time"
          value={when}
          onChange={(e) => apply(e.target.value, repeat)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Repeat</Label>
        <select
          className="fm-input focus-ring"
          aria-label="Repeat"
          value={repeat}
          onChange={(e) => apply(when, e.target.value as ReminderRepeat)}
        >
          <option value="once">Once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
          <option value="new-moon">Each new moon</option>
          <option value="full-moon">Each full moon</option>
        </select>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">Text me</Label>
          <p className="text-xs text-muted-foreground">
            Sends a Telegram text when it is due. Off still files the Inbox.
          </p>
        </div>
        <Switch
          aria-label="Text me"
          checked={reminderTexts(task.reminder)}
          onCheckedChange={(checked) => onChange(applyReminderPrefs(task, { textMe: checked }))}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-semibold">Persistent</Label>
          <p className="text-xs text-muted-foreground">
            Bothersome. Stays in the header bell until you dismiss it. Off still fires.
          </p>
        </div>
        <Switch
          aria-label="Persistent"
          checked={reminderPersists(task.reminder)}
          onCheckedChange={(checked) => onChange(applyReminderPrefs(task, { persistent: checked }))}
        />
      </div>
      {task.reminder?.repeat === "once" && task.reminder.deliveredKey ? (
        <p className="text-xs text-muted-foreground">Sent to Inbox.</p>
      ) : null}
      {task.reminder?.telegramNote ? (
        <p className="text-xs text-muted-foreground">Text skipped: {task.reminder.telegramNote}</p>
      ) : null}
    </div>
  )
}
