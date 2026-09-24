/**
 * components/Home/Tracking/working-now-strip.tsx — Operations clock on Tracking
 *
 * The same "Working on this now" control as the operation workspace. On Home
 * Tracking it sits in `.trk-now-module` directly under the Time Grid / Activity
 * Log / Day Log switcher, shared by all three, so a session started here still
 * paints those views. Pick an operation, start; the toggle becomes **Stop working on
 * {name}** and the minutes stay editable like any other block. While a session
 * is live, a dashed steel **usually ~N** chip shows the median of past
 * `timeLogs` / unflagged `actualDuration` for that title or type.
 */
"use client"

import { useMemo, useState } from "react"
import { Wand2 } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { selectOperations } from "@/lib/operations"
import { getOperationTrackingTagIds } from "@/lib/operation-types"
import { activeTrackingLink } from "@/lib/habit-tracking"
import {
  formatElapsedClock,
  sessionElapsedMs,
  toggleWorkingOnOperation,
} from "@/lib/operation-work-session"
import { useWorkSessionClock } from "@/components/Operations/WorkingNowControl"
import { formatUsualDuration, usualDurationMinutes } from "@/lib/estimated-values"
import "@/components/Operations/operations-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"

export function WorkingNowStrip() {
  const tasks = useTaskStore((s) => s.tasks)
  const tags = useTimeTrackingStore((s) => s.tags)
  const habits = useHabitsStore((s) => s.tasks)
  const operations = useMemo(() => selectOperations(tasks), [tasks])
  const { session, now } = useWorkSessionClock()
  const [pickedId, setPickedId] = useState(session?.operationId ?? operations[0]?.id ?? "")

  const selectedId = session?.operationId || pickedId || operations[0]?.id || ""
  const selected = operations.find((op) => op.id === selectedId)
  const tagIds = selected ? getOperationTrackingTagIds(selected) : []
  const tagNames = tags.filter((t) => tagIds.includes(t.id)).map((t) => t.name)
  const fedHabits = habits.filter((habit) => {
    const link = activeTrackingLink(habit)
    return link ? link.tagIds.some((id) => tagIds.includes(id)) : false
  })

  const live = Boolean(session)
  const elapsed = session ? formatElapsedClock(sessionElapsedMs(session, now)) : null
  const usual = live && selected ? usualDurationMinutes(tasks, selected) : null

  if (operations.length === 0) return null

  return (
    <div className={`ops-now-bar${live ? " live" : ""}`}>
      <span className={`ops-now-led${live ? " live" : ""}`} aria-hidden />
      <label>
        Working on
        <select
          aria-label="Operation to work on"
          value={selectedId}
          disabled={live}
          onChange={(e) => setPickedId(e.target.value)}
        >
          {operations.map((op) => (
            <option key={op.id} value={op.id}>
              {op.description}
            </option>
          ))}
        </select>
      </label>
      {live && elapsed && <span className="ops-now-elapsed">{elapsed}</span>}
      {usual && (
        <span
          title={usual.basis}
          className="trk-est inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium"
        >
          <Wand2 className="h-2.5 w-2.5" />
          {formatUsualDuration(usual)}
        </span>
      )}
      <button
        type="button"
        className={`ops-btn ops-btn-now${live ? " live" : ""}`}
        disabled={!selected}
        onClick={() => selected && toggleWorkingOnOperation(selected.id)}
      >
        {live && selected ? `Stop working on ${selected.description}` : "Working on this now"}
      </button>
      <span className="ops-now-meta">
        {tagNames.length > 0
          ? `Tags: ${tagNames.join(", ")}`
          : "No tracking tags — set them on the operation in Settings."}
        {fedHabits.length > 0 && ` · feeds ${fedHabits.map((h) => h.name).join(", ")}`}
      </span>
    </div>
  )
}

export default WorkingNowStrip
