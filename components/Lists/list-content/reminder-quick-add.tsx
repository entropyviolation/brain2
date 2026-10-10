"use client"

import { useState } from "react"
import { addReminder, parseReminderWhen, type ReminderRepeat } from "@/lib/reminders"

/** Add row for the built-in Reminders list: a name, a time, once / daily / weekly, Text me, and Persistent. */
export function ReminderQuickAdd({ onCancel }: { onCancel: () => void }) {
  const [text, setText] = useState("")
  const [when, setWhen] = useState("")
  const [repeat, setRepeat] = useState<ReminderRepeat>("once")
  const [textMe, setTextMe] = useState(true)
  const [persistent, setPersistent] = useState(true)
  const [error, setError] = useState("")

  const submit = () => {
    const at = parseReminderWhen(when)
    if (!text.trim() || !at) {
      setError("Name and time are both required.")
      return
    }
    addReminder(text, at, repeat, { textMe, persistent })
    onCancel()
  }

  return (
    <div className="fm-quickadd">
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
        <select
          className="fm-input"
          aria-label="Repeat"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
        >
          <option value="once">Once</option>
          <option value="daily">Every day</option>
          <option value="weekly">Every week</option>
        </select>
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
        Text me sends a Telegram text. Persistent stays on the header bell until you dismiss it. Both start on.
      </p>
      {error ? (
        <p className="text-xs text-muted-foreground" style={{ marginTop: 4 }}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2" style={{ marginTop: 6 }}>
        <button className="fm-btn fm-btn-sm" onClick={submit}>
          Add reminder
        </button>
        <button className="fm-btn fm-btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
