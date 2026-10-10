/**
 * Now → Plan pane. A short sequence for the hours ahead, the agenda,
 * and the same day plan log as Home → Plan. Current moment sits above the switch.
 */
"use client"

import { useMemo, useState } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { createHeaderPlan, plannedMinutesOf, renameHeaderPlanAction, retimesHeaderPlanAction } from "@/lib/header-tracking-plan"
import { itemTitle } from "@/lib/item-utils"
import { actionsForDay, hhmmToMinutes, minutesToHhmm } from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { tasksScheduledOnCalendarDay } from "@/lib/item-slices"
import { AgendaGrid } from "@/components/Home/Plan/agenda-grid"
import { PlanTextLog } from "@/components/Home/Plan/plan-text-log"
import { PlannedActionDialog } from "@/components/Home/Plan/planned-action-dialog"
import { EstMark, ExactClock } from "@/components/header-tracking/est-mark"
import type { PlannedAction } from "@/lib/planned-actions"

type DraftRow = { key: string; title: string; minutes: string }

function minutesNow(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function freshDraft(): DraftRow {
  return {
    key: `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title: "",
    minutes: "30",
  }
}

export function PlanPane({ onOpenTracking }: { onOpenTracking: () => void }) {
  const [day, setDay] = useState(() => new Date())
  const dayKey = formatLocalDateKey(day)
  const tasks = useTaskStore((s) => s.tasks)
  const events = useEventStore((s) => s.events)
  const actions = usePlannedActionStore((s) => s.actions)
  const dayTasks = useMemo(() => tasksScheduledOnCalendarDay(tasks, day), [tasks, day])
  const dayActions = actionsForDay(actions, dayKey)
  const [start, setStart] = useState(() => minutesToHhmm(minutesNow()))
  const [startEstimated, setStartEstimated] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>(() => [freshDraft(), freshDraft()])
  const [note, setNote] = useState("")
  const [editing, setEditing] = useState<PlannedAction | null>(null)

  function save() {
    const created = createHeaderPlan({
      date: dayKey,
      startMin: hhmmToMinutes(start),
      startEstimated,
      actions: rows.map((row) => ({ title: row.title, minutes: Number(row.minutes) })),
    })
    if (created.taskIds.length === 0) {
      setNote("Name at least one action.")
      return
    }
    setNote(`Saved ${created.taskIds.length}.`)
    setRows([freshDraft(), freshDraft()])
  }

  return (
    <div className="htk-pane" role="tabpanel" aria-label="Plan">
      <div className="hpp-body htk-plan-form">
        <div className="htk-row">
          <span className="htk-kicker">{day.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
          <button type="button" onClick={() => setDay(new Date())}>
            Today
          </button>
          <button type="button" onClick={onOpenTracking}>
            Back to tracking
          </button>
        </div>
        <div className="htk-row">
          <button
            type="button"
            onClick={() => {
              setStart(minutesToHhmm(minutesNow()))
              setStartEstimated(false)
            }}
          >
            Right now
          </button>
          <button
            type="button"
            onClick={() => {
              setStart("19:00")
              setStartEstimated(true)
            }}
          >
            After dinner
          </button>
          <label className="htk-kicker">
            Starts
            <input
              aria-label="Plan starts"
              type="time"
              className={startEstimated ? "trk-est htk-est" : undefined}
              value={start}
              onChange={(event) => setStart(event.target.value)}
            />
          </label>
          <ExactClock estimated={startEstimated} onEstimated={setStartEstimated} label="Start time is estimated" />
        </div>
        {rows.map((row, index) => (
          <div key={row.key} className="htk-row">
            <label className="htk-kicker">
              Action {index + 1}
              <input
                aria-label={`Action ${index + 1}`}
                value={row.title}
                placeholder="What comes next"
                onChange={(event) =>
                  setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, title: event.target.value } : item)))
                }
              />
            </label>
            <label className="htk-kicker">
              Minutes
              <input
                aria-label={`Minutes for action ${index + 1}`}
                inputMode="numeric"
                value={row.minutes}
                onChange={(event) =>
                  setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, minutes: event.target.value } : item)))
                }
              />
            </label>
          </div>
        ))}
        <div className="htk-row">
          <button type="button" onClick={() => setRows((prev) => [...prev, freshDraft()])}>
            Add action
          </button>
          <button type="button" className="hpp-key-go" onClick={save}>
            Save plan
          </button>
        </div>
        {note ? <p className="htk-hint">{note}</p> : null}
        <p className="htk-hint">The lengths are the plan. A later comparison of plan and actual is marked est.</p>
      </div>

      {dayActions.length > 0 ? (
        <ul className="htk-plan-list" aria-label="Today's plan">
          {dayActions.map((action) => {
            const task = action.sourceId ? tasks.find((item) => item.id === action.sourceId) : undefined
            const estimatedStart = task?.startCertainty === "estimated"
            return (
              <li key={action.id} className="htk-plan-line">
                <EstMark estimated={estimatedStart}>{action.startTime}</EstMark>
                <input
                  aria-label={`Rename ${action.title}`}
                  defaultValue={itemTitle(task) || action.title}
                  onBlur={(event) => renameHeaderPlanAction(action.id, event.target.value)}
                />
                <input
                  aria-label={`Minutes for ${action.title}`}
                  inputMode="numeric"
                  defaultValue={String(task?.estimatedDuration || plannedMinutesOf(action))}
                  onBlur={(event) => retimesHeaderPlanAction(action.id, Number(event.target.value))}
                />
                <button type="button" onClick={() => setEditing(action)}>
                  Edit
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="htk-agenda" data-testid="htk-plan-agenda">
        <AgendaGrid
          date={day}
          events={events}
          tasks={dayTasks}
          mode="plan"
          plannedActions={dayActions}
          maxHeight="320px"
          showCurrentTimeIndicator
          onPlannedActionClick={setEditing}
          onCreatePlannedAction={(date, startMinutes, endMinutes) => {
            createHeaderPlan({
              date: formatLocalDateKey(date),
              startMin: startMinutes,
              startEstimated: false,
              actions: [{ title: "Planned action", minutes: Math.max(15, endMinutes - startMinutes) }],
            })
          }}
        />
      </div>
      <PlannedActionDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} action={editing} />
      <section className="htk-plan-log" aria-label="Day plan">
        <p className="htk-kicker">Day plan</p>
        <PlanTextLog
          period="day"
          periodKey={dayKey}
          placeholder="Write your day plan, goals, and objectives..."
          size="day"
        />
      </section>
    </div>
  )
}
