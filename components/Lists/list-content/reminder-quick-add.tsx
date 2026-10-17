"use client"

import { useState } from "react"
import {
  REMINDER_REPEAT_OPTIONS,
  addReminder,
  parseReminderWhen,
  reminderQuickWhen,
  reminderWhenForRepeat,
  reminderWhenInputFromDate,
  type ReminderQuickWhenId,
  type ReminderRepeat,
} from "@/lib/reminders"
import { NativeSelect } from "@/components/ui/native-select"

export type ReminderQuickAddProps = {
  /** Lists add-row: close the composer. Shell popup may omit. */
  onCancel?: () => void
  /** After a successful add (id of the new row). */
  onAdded?: (id: string) => void
  /**
   * Stay mounted and clear fields after add (header Reminders popup).
   * Lists closes via `onCancel` instead.
   */
  stayOpen?: boolean
  /** Prefill for `<input type="datetime-local">`. */
  defaultWhen?: string
  /** `lists` = File Manager quick-add chrome; `shell` = header hpp dialog. */
  chrome?: "lists" | "shell"
}

const QUICK_WHEN: { id: ReminderQuickWhenId; label: string }[] = [
  { id: "1h", label: "In 1 hour" },
  { id: "tonight", label: "Tonight 6pm" },
  { id: "tomorrow-morning", label: "Tomorrow 9am" },
  { id: "next-monday", label: "Next Monday" },
]

/** Add a timed reminder: name, when, repeat, Text me, Persistent. */
export function ReminderQuickAdd({
  onCancel,
  onAdded,
  stayOpen = false,
  defaultWhen = "",
  chrome = "lists",
}: ReminderQuickAddProps) {
  const [text, setText] = useState("")
  const [when, setWhen] = useState(defaultWhen)
  const [repeat, setRepeat] = useState<ReminderRepeat>("once")
  const [textMe, setTextMe] = useState(true)
  const [persistent, setPersistent] = useState(true)
  const [error, setError] = useState("")

  const reset = () => {
    setText("")
    setWhen(defaultWhen)
    setRepeat("once")
    setTextMe(true)
    setPersistent(true)
    setError("")
  }

  const setRepeatAndMaybeWhen = (next: ReminderRepeat) => {
    setRepeat(next)
    const lunar = reminderWhenForRepeat(next)
    if (lunar) setWhen(reminderWhenInputFromDate(lunar))
  }

  const submit = () => {
    const at = parseReminderWhen(when)
    if (!text.trim() || !at) {
      setError("Name and time are both required.")
      return
    }
    const id = addReminder(text, at, repeat, { textMe, persistent })
    onAdded?.(id)
    if (stayOpen) {
      reset()
      return
    }
    onCancel?.()
  }

  const shell = chrome === "shell"
  const inputClass = shell ? undefined : "fm-input"
  const btnClass = shell ? "hpp-key-go" : "fm-btn fm-btn-sm"
  const repeatSelect = (
    <NativeSelect
      className={inputClass}
      aria-label="Repeat"
      value={repeat}
      onChange={(e) => setRepeatAndMaybeWhen(e.target.value as ReminderRepeat)}
    >
      {REMINDER_REPEAT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  )

  if (!shell) {
    return (
      <div className="fm-quickadd" data-testid="reminder-compose">
        <input
          className="fm-input"
          style={{ width: "100%" }}
          placeholder="What should this remind you of?"
          aria-label="New reminder"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          autoFocus
        />
        <div className="flex gap-2" style={{ marginTop: 6 }}>
          <input
            className="fm-input"
            type="datetime-local"
            aria-label="Reminder time"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          {repeatSelect}
        </div>
        <div className="flex gap-4" style={{ marginTop: 6 }}>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={textMe} onChange={(e) => setTextMe(e.target.checked)} />
            Text me
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={persistent} onChange={(e) => setPersistent(e.target.checked)} />
            Persistent
          </label>
        </div>
        <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
          Text me sends a Telegram text. Persistent stays on the header bell until you dismiss it. Both start
          on.
        </p>
        {error ? (
          <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
            {error}
          </p>
        ) : null}
        <div className="flex gap-2" style={{ marginTop: 6 }}>
          <button type="button" className={btnClass} onClick={submit}>
            Add reminder
          </button>
          {onCancel ? (
            <button type="button" className="fm-btn fm-btn-sm" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="b2-reminder-compose" data-testid="reminder-compose">
      <div className="b2-reminder-compose-kicker">New reminder</div>

      <label className="b2-reminder-compose-field">
        <span className="b2-reminder-compose-label">Name</span>
        <input
          placeholder="What should this remind you of?"
          aria-label="New reminder"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          autoFocus
        />
      </label>

      <div className="b2-reminder-compose-field">
        <span className="b2-reminder-compose-label">When</span>
        <div className="b2-reminder-compose-chips" role="group" aria-label="Quick times">
          {QUICK_WHEN.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="b2-reminder-compose-chip"
              onClick={() => setWhen(reminderWhenInputFromDate(reminderQuickWhen(chip.id)))}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <input
          type="datetime-local"
          aria-label="Reminder time"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      </div>

      <label className="b2-reminder-compose-field">
        <span className="b2-reminder-compose-label">Repeat</span>
        {repeatSelect}
      </label>

      <div className="b2-reminder-compose-flags">
        <label className="b2-reminder-compose-flag-card">
          <input type="checkbox" checked={textMe} onChange={(e) => setTextMe(e.target.checked)} />
          <span className="b2-reminder-compose-flag-copy">
            <span className="b2-reminder-compose-flag-title">Text me</span>
            <span className="b2-reminder-compose-flag-hint">Telegram when due</span>
          </span>
        </label>
        <label className="b2-reminder-compose-flag-card">
          <input type="checkbox" checked={persistent} onChange={(e) => setPersistent(e.target.checked)} />
          <span className="b2-reminder-compose-flag-copy">
            <span className="b2-reminder-compose-flag-title">Persistent</span>
            <span className="b2-reminder-compose-flag-hint">Stay on the bell until dismiss</span>
          </span>
        </label>
      </div>

      {error ? <p className="b2-reminder-compose-error">{error}</p> : null}

      <div className="b2-reminder-compose-actions">
        <button type="button" className="hpp-key-go" onClick={submit}>
          Add reminder
        </button>
      </div>
    </div>
  )
}

/** Next half-hour strictly after `now`, as a datetime-local value. */
export function nextHalfHourWhenInput(now: Date = new Date()): string {
  const at = new Date(now.getTime())
  at.setSeconds(0, 0)
  if (at.getMinutes() < 30) {
    at.setMinutes(30)
  } else {
    at.setHours(at.getHours() + 1, 0, 0, 0)
  }
  return reminderWhenInputFromDate(at)
}
