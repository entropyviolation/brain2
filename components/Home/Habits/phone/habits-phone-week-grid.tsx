/**
 * components/Home/Habits/phone/habits-phone-week-grid.tsx — Phone week grid
 *
 * The Week key's sheet on the phone. Full width, one row per habit, simple
 * squares lit in proportion to progress. Daily habits get the seven days of
 * the viewed week; weekly, monthly, and season habits get the columns of the
 * windows picked in Tools. A lamp square does nothing on tap. Any other
 * square opens a sheet with the value and the cell's change history.
 * The desktop `TaskGrid` and `PeriodHabitList` are not used here.
 */
"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { format } from "date-fns"
import { HabitNumberField, HabitTextField } from "@/components/Home/Habits/habit-value-field"
import {
  cellChangeSourceLabel,
  formatCellChangeValue,
  isLampHabit,
  phoneCellBrightness,
  phoneCellHistory,
  phoneHabitLabel,
  phonePausedOn,
  phonePausedOverlaps,
} from "@/components/Home/Habits/phone/habits-phone-week"
import { isExemptKind, type ExemptionKind } from "@/lib/habit-exemption"
import { isMissedOpportunity } from "@/lib/habit-missed-opportunity"
import { isGoalType, normalizeTaskType } from "@/lib/habit-utils"
import { incrementalCompletionPayload } from "@/lib/incremental-habits"
import { formatLocalDateKey } from "@/lib/date-utils"
import { TaskType, type HabitFrequency, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"

export type PhoneWeekColumn = {
  key: string
  date: Date
  /** Last day the column covers, for the paused hatch. Same as `date` for a day. */
  end: Date
  kicker: string
  num: string
  title: string
  isCurrent: boolean
}

export type PhoneWeekSection = {
  id: HabitFrequency
  title: string
  columns: PhoneWeekColumn[]
  tasks: WeeklyTask[]
  data: WeeklyData
  kindFor?: (task: WeeklyTask, key: string) => ExemptionKind
  onUpdate: (taskId: string, date: Date, completion: TaskCompletion) => void
}

/** Above this many columns the name sits on its own line, so 28pt squares still fit 390pt. */
const STACK_AFTER = 9

type OpenCell = { sectionId: HabitFrequency; taskId: string; key: string }

export function HabitsPhoneWeekGrid({ sections }: { sections: PhoneWeekSection[] }) {
  const [open, setOpen] = useState<OpenCell | null>(null)
  const close = useCallback(() => setOpen(null), [])
  const shown = sections.filter((section) => section.tasks.length > 0 && section.columns.length > 0)
  const openSection = open ? sections.find((section) => section.id === open.sectionId) : undefined
  const openTask = open ? openSection?.tasks.find((task) => task.id === open.taskId) : undefined
  const openColumn = open ? openSection?.columns.find((column) => column.key === open.key) : undefined

  return (
    <div className="hab-phone-wk" data-testid="habits-phone-week">
      {shown.length === 0 ? <p className="hab-phone-empty">No habits in this week yet.</p> : null}
      {shown.map((section) => {
        const stacked = section.columns.length > STACK_AFTER
        return (
          <section key={section.id} className="hab-phone-wk-section" aria-label={section.title}>
            <h4 className="hab-phone-kind">{section.title}</h4>
            <div
              role="grid"
              aria-label={`${section.title} grid`}
              className={`hab-phone-wk-grid${stacked ? " is-stacked" : ""}`}
              style={{ "--wk-cols": section.columns.length } as CSSProperties}
            >
              <div role="row" className="hab-phone-wk-head">
                <span className="hab-phone-wk-corner" aria-hidden="true" />
                {section.columns.map((column) => (
                  <span
                    key={column.key}
                    role="columnheader"
                    aria-label={column.title}
                    className={`hab-phone-wk-col${column.isCurrent ? " is-current" : ""}`}
                  >
                    <span className="hab-phone-wk-kicker">{column.kicker}</span>
                    <span className="hab-phone-wk-num">{column.num}</span>
                  </span>
                ))}
              </div>
              {section.tasks.map((task) => (
                <div key={task.id} role="row" className="hab-phone-wk-row" data-habit-id={task.id}>
                  <span role="rowheader" className="hab-phone-wk-name" title={task.name}>
                    {phoneHabitLabel(task)}
                  </span>
                  {section.columns.map((column) => (
                    <PhoneWeekCell
                      key={column.key}
                      section={section}
                      task={task}
                      column={column}
                      onOpen={() => setOpen({ sectionId: section.id, taskId: task.id, key: column.key })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        )
      })}
      {openSection && openTask && openColumn ? (
        <PhoneCellSheet
          section={openSection}
          task={openTask}
          column={openColumn}
          onClose={close}
        />
      ) : null}
    </div>
  )
}

function PhoneWeekCell({
  section,
  task,
  column,
  onOpen,
}: {
  section: PhoneWeekSection
  task: WeeklyTask
  column: PhoneWeekColumn
  onOpen: () => void
}) {
  const completion = section.data[column.key]?.[task.id]
  const exempt = isExemptKind(section.kindFor?.(task, column.key))
  const startKey = formatLocalDateKey(column.date)
  const paused =
    column.end.getTime() === column.date.getTime()
      ? phonePausedOn(task, startKey)
      : phonePausedOverlaps(task, startKey, formatLocalDateKey(column.end))
  const missed = isMissedOpportunity(completion)
  const lit = phoneCellBrightness(task, completion, section.data, column.date, section.id === "daily")
  const state = exempt || paused ? "rest" : missed ? "missed" : lit >= 1 ? "met" : lit > 0 ? "partial" : "off"
  const name = phoneHabitLabel(task)
  const label = `${name} · ${column.title} · ${
    state === "rest" ? (paused ? "paused" : "exempt") : state === "missed" ? "missed opportunity" : `${Math.round(lit * 100)}%`
  }`
  const className = `hab-phone-wk-cell is-${state}${column.isCurrent ? " is-current" : ""}`
  const style = { "--wk-lit": lit } as CSSProperties
  // A lamp square only shows the lamp. The day list and the desktop toggle it.
  if (isLampHabit(task)) {
    return (
      <span role="gridcell" aria-label={label} className={className} style={style} data-lamp="">
        <span className="hab-phone-wk-square" />
      </span>
    )
  }
  return (
    <span role="gridcell" className="hab-phone-wk-gridcell">
      <button type="button" aria-label={label} className={className} style={style} onClick={onOpen}>
        <span className="hab-phone-wk-square" />
      </button>
    </span>
  )
}

function PhoneCellSheet({
  section,
  task,
  column,
  onClose,
}: {
  section: PhoneWeekSection
  task: WeeklyTask
  column: PhoneWeekColumn
  onClose: () => void
}) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])
  const completion = section.data[column.key]?.[task.id]
  const history = phoneCellHistory(completion)
  const kind = normalizeTaskType(task.type)
  const write = (next: TaskCompletion) => section.onUpdate(task.id, column.date, next)
  const name = phoneHabitLabel(task)

  return (
    <div className="hab-phone-shade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${task.name} · ${column.title}`}
        className={`hab-phone-sheet hab-phone-cell-sheet${shown ? " is-in" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="hab-phone-cell-head">
          <div className="hab-phone-cell-title">
            <strong>{task.name}</strong>
            <span>{column.title}</span>
          </div>
          <button type="button" className="hab-phone-key" data-no95="" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="hab-phone-cell-value">
          <span className="hab-phone-cell-name">{name}</span>
          {kind === TaskType.TEXT ? (
            <HabitTextField
              value={completion?.text ?? ""}
              onValue={(text) => write({ text })}
              ariaLabel={`${task.name} ${column.title}`}
              placeholder="Note"
              popup
            />
          ) : (
            <span className="hab-phone-cell-num">
              <HabitNumberField
                value={completion?.value}
                ariaLabel={`${task.name} ${column.title} value`}
                placeholder="0"
                onValue={(value) => {
                  if (kind === TaskType.INCREMENTAL) write(incrementalCompletionPayload(value))
                  else if (isGoalType(task.type)) write({ value, goal: task.goal || 0 })
                }}
              />
              {isGoalType(task.type) && task.goal ? (
                <span className="hab-phone-cell-goal">
                  / {task.goal}
                  {task.unit ? ` ${task.unit}` : ""}
                </span>
              ) : null}
            </span>
          )}
        </div>
        <h5 className="hab-phone-kind">History</h5>
        {history.length === 0 ? (
          <p className="hab-phone-cell-none">No history yet</p>
        ) : (
          <ol className="hab-phone-cell-history" aria-label="History">
            {history.map((change, index) => (
              <li key={`${change.at}-${index}`}>
                <span className="hab-phone-cell-when">{formatChangeTime(change.at)}</span>
                <span className="hab-phone-cell-delta">
                  {formatCellChangeValue(change.from)} → {formatCellChangeValue(change.to)}
                </span>
                <span className="hab-phone-cell-source">{cellChangeSourceLabel(change.source)}</span>
                {change.note ? <span className="hab-phone-cell-note">{change.note}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function formatChangeTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : format(date, "MMM d, h:mm a")
}
