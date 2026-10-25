/**
 * components/ItemDetail/ItemTimeLedger.tsx — Time on a task, editable
 *
 * The Time tab for a task (and for a step's item). Blocks painted with this
 * task — pen clock, To Do start, a hand correction — list here with their
 * notes, objectives, and the clocks those objectives ran. A block from the
 * pen clock says it was added from Working On Now. Session lines that never
 * painted a block list under them. Edits to a block go through the time grid
 * (`updateEntry`). Edits to a log, a step's minutes, or the task's completed
 * mark go through the open draft, or onto the parent task when this item is
 * a step.
 *
 * _Last mapped: 2026-10-24_
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { findPen, stepSpentMinutes, timeTrio, trackedTimeForItem, partsMinutes } from "@/lib/tracked-time"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  addNowObjective,
  compactNowObjectives,
  editNowObjectiveText,
  objectiveCompletesTarget,
  removeNowObjective,
  setNowObjectiveCompletes,
  tieNowObjectiveToStep,
  type NowObjective,
} from "@/lib/now-objective"
import { finishStep, placeSteps } from "@/lib/next-step"
import { WORKING_ON_NOW_NOTE_PREFIX } from "@/lib/task-clock-log"
import { updateNestedStep } from "@/lib/todo-steps"
import { useTaskStore } from "@/lib/task-store"
import type { TimeEntry } from "@/lib/time-entries"
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"

/** How many blocks the ledger lists before "+ N more". */
const BLOCKS_SHOWN = 12

type LedgerTask = Pick<
  Task,
  "id" | "penLinks" | "timeLogs" | "estimatedDuration" | "subtasks" | "stepOf" | "completed"
>

const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`

function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2] ?? 0)
  return min >= 0 && min <= 1440 && Number(m[2] ?? 0) < 60 ? min : null
}

function clockOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function withClock(iso: string, min: number): string {
  const d = new Date(iso)
  d.setHours(Math.floor(min / 60), min % 60, 0, 0)
  return d.toISOString()
}

function isoAt(date: string, min: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, Math.floor(min / 60), min % 60, 0, 0).toISOString()
}

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })

function subtreeIds(steps: readonly Subtask[] | undefined, id: string): Set<string> {
  const placed = placeSteps(steps).find((p) => p.step.id === id)
  const ids = new Set<string>([id])
  const walk = (list?: readonly Subtask[]) => {
    for (const step of list ?? []) {
      ids.add(step.id)
      walk(step.subtasks)
    }
  }
  if (placed) walk(placed.step.subtasks)
  return ids
}

function logKind(log: TimeLogEntry): string {
  const notes = log.notes ?? ""
  if (notes.startsWith("Session")) return "Session"
  if (notes.startsWith("Clock")) return "Clock"
  if (notes.startsWith(WORKING_ON_NOW_NOTE_PREFIX)) return "Now"
  return "Log"
}

function ClockField({
  value,
  label,
  disabled,
  allowEmpty,
  onCommit,
}: {
  value: number | null
  label: string
  disabled?: boolean
  allowEmpty?: boolean
  onCommit: (min: number | null) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = value == null ? "" : clock(value)
  const finish = (keep: boolean) => {
    if (!keep || draft == null) {
      setDraft(null)
      return
    }
    if (draft.trim() === "") {
      if (allowEmpty && value != null) onCommit(null)
      setDraft(null)
      return
    }
    const next = parseClock(draft)
    if (next != null && next !== value) onCommit(next)
    setDraft(null)
  }
  return (
    <input
      className="ipt-clock"
      aria-label={label}
      inputMode="numeric"
      size={5}
      disabled={disabled}
      placeholder={allowEmpty ? "open" : undefined}
      value={draft ?? shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          finish(true)
          e.currentTarget.blur()
        } else if (e.key === "Escape" && draft != null) {
          e.preventDefault()
          e.stopPropagation()
          finish(false)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

export function ItemTimeLedger({
  task,
  onPatch,
  readOnly = false,
}: {
  task: LedgerTask
  onPatch: (patch: Partial<Task>) => void
  readOnly?: boolean
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const paintMinutes = useTimeTrackingStore((s) => s.paintMinutes)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const tasks = useTaskStore((s) => s.tasks)
  const [showAll, setShowAll] = useState(false)
  const [sure, setSure] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const parent = task.stepOf ? tasks.find((row) => row.id === task.stepOf!.taskId) : undefined
  const record = parent ?? task
  const focus = task.stepOf ? subtreeIds(record.subtasks, task.stepOf.stepId) : null
  const names = useMemo(() => {
    const map = new Map<string, string>()
    for (const placed of placeSteps(record.subtasks)) {
      map.set(placed.step.id, [...placed.path.map((s) => s.description), placed.step.description].join(" › "))
    }
    return map
  }, [record.subtasks])
  const choices = useMemo(
    () => [...names.entries()].map(([id, label]) => ({ id, label: label + (placeSteps(record.subtasks).find((p) => p.step.id === id)?.step.completed ? " ✓" : "") })),
    [names, record.subtasks],
  )

  const tracked = useMemo(
    () =>
      trackedTimeForItem(
        { id: record.id, penLinks: record.penLinks ?? task.penLinks, timeLogs: record.timeLogs, estimatedDuration: task.estimatedDuration, subtasks: record.subtasks },
        entries,
        { penScope: "tagged" },
      ),
    [record.id, record.penLinks, record.timeLogs, record.subtasks, task.penLinks, task.estimatedDuration, entries],
  )

  const blocks = useMemo(() => {
    const rows = tracked.entries.filter((entry) => {
      if (!focus) return entry.taskId === record.id
      if (entry.stepId && focus.has(entry.stepId)) return true
      return (entry.nowObjectives ?? []).some((row) => !!row.stepId && focus.has(row.stepId))
    })
    return rows
  }, [tracked.entries, focus, record.id])

  const blockIds = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks])
  const logs = (record.timeLogs ?? []).filter((log) => {
    if (focus && log.stepId && !focus.has(log.stepId)) return false
    if (focus && !log.stepId) return false
    return !(log.entryIds ?? []).some((id) => blockIds.has(id))
  })

  const shown = showAll ? blocks : blocks.slice(0, BLOCKS_SHOWN)
  const spent = focus && task.stepOf ? stepSpentMinutes(
    { id: record.id, timeLogs: record.timeLogs, subtasks: record.subtasks },
    task.stepOf.stepId,
    entries,
  ) : tracked.total
  const est = task.estimatedDuration ?? 0
  const parts = partsMinutes(record.subtasks)
  const link = (record.penLinks ?? task.penLinks)?.[0]
  const pen = link ? findPen(scopes, link.penId) : scopes[0]?.pens[0]
  const scopeId = link?.scopeId ?? (pen ? scopes.find((s) => s.pens.some((p) => p.id === pen.id))?.id : undefined)

  const writeHost = (patch: Partial<Task>) => {
    if (task.stepOf) {
      const latest = useTaskStore.getState().tasks.find((row) => row.id === task.stepOf!.taskId)
      if (latest) useTaskStore.getState().updateTask({ ...latest, ...patch })
      return
    }
    onPatch(patch)
  }

  const hostSteps = (): Subtask[] | undefined => {
    if (task.stepOf) return useTaskStore.getState().tasks.find((row) => row.id === task.stepOf!.taskId)?.subtasks
    return task.subtasks
  }

  const saveLogs = (next: TimeLogEntry[]) => {
    writeHost({ timeLogs: next.length ? next : undefined })
  }

  const syncObjective = (row: NowObjective) => {
    if (!objectiveCompletesTarget(row)) return
    if (!row.stepId) {
      writeHost({
        completed: !!row.completedAt,
        completedDate: row.completedAt ? new Date(row.completedAt) : undefined,
      })
      return
    }
    const steps = hostSteps()
    if (!steps) return
    if (row.completedAt) {
      const mins = Math.round((Date.parse(row.completedAt) - Date.parse(row.addedAt)) / 60_000)
      writeHost({
        subtasks: finishStep(steps, row.stepId, mins >= 1 ? mins : undefined, new Date(row.completedAt)),
      })
    } else {
      writeHost({ subtasks: updateNestedStep(steps, row.stepId, { completed: false }) })
    }
  }

  const putObjectives = (entry: TimeEntry, next: NowObjective[] | undefined, sync?: NowObjective) => {
    updateEntry(entry.id, { nowObjectives: compactNowObjectives(next) })
    if (sync) syncObjective(sync)
  }

  const setBlockStep = (entry: TimeEntry, stepId: string) => {
    updateEntry(entry.id, { stepId: stepId || undefined })
    const logsNow = record.timeLogs ?? []
    if (!logsNow.some((log) => log.entryIds?.includes(entry.id))) return
    saveLogs(
      logsNow.map((log) => {
        if (!log.entryIds?.includes(entry.id)) return log
        const next = { ...log }
        if (stepId) next.stepId = stepId
        else delete next.stepId
        return next
      }),
    )
  }

  return (
    <div className="ipt-ledger" data-ui-name="Task time">
      <p className="ipt-total">
        <strong>{formatDuration(spent)}</strong> {focus ? "on this step" : "tracked"}
        {!focus && est > 0 && (est >= spent ? <> · {formatDuration(est - spent)} est left</> : <> · {formatDuration(spent - est)} past est</>)}
      </p>
      {!focus && est > 0 && (
        <div
          className={`ipt-bar${spent > est ? " is-over" : ""}`}
          role="meter"
          aria-label="Tracked against estimate"
          aria-valuemin={0}
          aria-valuemax={est}
          aria-valuenow={Math.min(spent, est)}
        >
          <span style={{ width: `${Math.min(1, est ? spent / est : 0) * 100}%` }} />
        </div>
      )}
      {!focus && parts > 0 && (
        <p className="ipt-quiet" aria-label="Estimate, parts and time spent">
          {timeTrio(est, parts, spent)}
        </p>
      )}
      {!focus && tracked.total > 0 && (
        <p className="ipt-quiet">
          {[
            tracked.penMinutes > 0 && `${formatDuration(tracked.penMinutes)} by pen`,
            tracked.clockMinutes > 0 && `${formatDuration(tracked.clockMinutes)} on the clock`,
            tracked.logMinutes > 0 && `${formatDuration(tracked.logMinutes)} logged`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {tracked.penPoolMinutes > 0 && !focus && (
        <p className="ipt-quiet" title="Time on the linked pen that is not tagged with this task.">
          pen overall {formatDuration(tracked.penPoolMinutes)} (not tagged to this)
        </p>
      )}

      {shown.length > 0 && (
        <ul className="ipt-blocks ipt-blocks-edit" aria-label="Blocks of time on this task">
          {shown.map((entry) => {
            const paint = findPen(scopes, entry.penId)
            const on = entry.stepId ? names.get(entry.stepId) : undefined
            return (
              <li key={entry.id} className="ipt-block">
                <div className="ipt-block-row">
                  <time dateTime={entry.date}>{dayLabel(entry.date)}</time>
                  <input
                    className="ipt-date"
                    type="date"
                    aria-label={`Date of the block on ${entry.date} at ${clock(entry.startMin)}`}
                    disabled={readOnly}
                    value={entry.date}
                    onChange={(e) => {
                      if (e.target.value) updateEntry(entry.id, { date: e.target.value })
                    }}
                  />
                  <span className="ipt-span">
                    <ClockField
                      value={entry.startMin}
                      label={`Start of the block on ${entry.date} at ${clock(entry.startMin)}`}
                      disabled={readOnly}
                      onCommit={(min) => {
                        if (min != null && min < entry.endMin) updateEntry(entry.id, { startMin: min })
                      }}
                    />
                    <i aria-hidden>–</i>
                    <ClockField
                      value={entry.endMin}
                      label={`End of the block on ${entry.date} at ${clock(entry.startMin)}`}
                      disabled={readOnly}
                      onCommit={(min) => {
                        if (min != null && min > entry.startMin) updateEntry(entry.id, { endMin: min })
                      }}
                    />
                  </span>
                  <b>{formatDuration(entry.endMin - entry.startMin)}</b>
                  <span className="ipt-dot" style={{ background: paint?.color ?? "transparent" }} aria-hidden />
                  <span className="ipt-block-name">{entry.title || paint?.name || "Block"}</span>
                  {names.size > 0 && (
                    <select
                      className="ipt-step"
                      aria-label={`Step for the block on ${entry.date} at ${clock(entry.startMin)}`}
                      disabled={readOnly}
                      value={entry.stepId ?? ""}
                      onChange={(e) => setBlockStep(entry, e.target.value)}
                    >
                      <option value="">Whole task</option>
                      {[...names.entries()].map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!names.size && <em className="ipt-quiet">{on ?? "whole task"}</em>}
                  {!readOnly &&
                    (sure === entry.id ? (
                      <button type="button" className="ipt-x is-sure" onClick={() => (removeEntry(entry.id), setSure(null))}>
                        delete?
                      </button>
                    ) : (
                      <button type="button" className="ipt-x" aria-label={`Delete the block on ${entry.date} at ${clock(entry.startMin)}`} onClick={() => setSure(entry.id)}>
                        ×
                      </button>
                    ))}
                </div>
                <label className="ipt-label-line">
                  <span>Label</span>
                  <input
                    className="ipt-text"
                    aria-label={`Label of the block on ${entry.date} at ${clock(entry.startMin)}`}
                    disabled={readOnly}
                    defaultValue={entry.title ?? ""}
                    placeholder={paint?.name || "Block"}
                    key={`${entry.id}:${entry.title ?? ""}`}
                    onBlur={(e) => {
                      const title = e.target.value.trim()
                      if (title !== (entry.title ?? "")) updateEntry(entry.id, { title: title || undefined })
                    }}
                  />
                </label>
                <label className="ipt-label-line">
                  <span>Notes</span>
                  <input
                    className="ipt-text"
                    aria-label={`Notes of the block on ${entry.date} at ${clock(entry.startMin)}`}
                    disabled={readOnly}
                    defaultValue={entry.notes ?? ""}
                    title={entry.notes || undefined}
                    key={`${entry.id}:notes:${entry.notes ?? ""}`}
                    onBlur={(e) => {
                      const notes = e.target.value.trim()
                      if (notes !== (entry.notes ?? "")) updateEntry(entry.id, { notes: notes || undefined })
                    }}
                  />
                </label>
                <ObjectiveList
                  entry={entry}
                  names={names}
                  readOnly={readOnly}
                  onChange={(next, sync) => putObjectives(entry, next, sync)}
                />
              </li>
            )
          })}
        </ul>
      )}
      {blocks.length > BLOCKS_SHOWN && (
        <button type="button" className="ipt-add" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `+ ${blocks.length - BLOCKS_SHOWN} more`}
        </button>
      )}
      {blocks.length === 0 && logs.length === 0 && (
        <p className="ipt-quiet">No time is tagged to this yet. A session, the pen clock, or a To Do start writes it here.</p>
      )}

      {logs.length > 0 && (
        <div className="ipt-logs">
          <h3>Logged, no painted block</h3>
          <ul className="ipt-blocks ipt-blocks-edit" aria-label="Time logs without a painted block">
            {logs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                names={names}
                readOnly={readOnly}
                sure={sure === log.id}
                onSure={() => setSure(log.id)}
                onDelete={() => {
                  saveLogs((record.timeLogs ?? []).filter((row) => row.id !== log.id))
                  setSure(null)
                }}
                onChange={(patch) => saveLogs((record.timeLogs ?? []).map((row) => (row.id === log.id ? { ...row, ...patch } : row)))}
              />
            ))}
          </ul>
        </div>
      )}

      {!readOnly && !adding && (
        <button type="button" className="ipt-add" onClick={() => setAdding(true)}>
          Add time
        </button>
      )}
      {!readOnly && adding && (
        <AddTime
          choices={choices}
          penName={pen?.name}
          onCancel={() => setAdding(false)}
          onAdd={(row) => {
            const objective = row.objective.trim()
            const objectives = objective
              ? [
                  {
                    id: `nobj-${Date.now().toString(36)}`,
                    text: objective,
                    addedAt: isoAt(row.date, row.start),
                    ...(row.done ? { completedAt: isoAt(row.date, row.end) } : {}),
                    ...(row.stepId ? { stepId: row.stepId } : {}),
                  },
                ]
              : undefined
            if (pen && scopeId) {
              paintMinutes(row.date, scopeId, row.start, row.end, pen.id, undefined, undefined, undefined, {
                title: row.note || undefined,
                taskId: record.id,
                ...(row.stepId ? { stepId: row.stepId } : {}),
                ...(objectives ? { nowObjectives: objectives } : {}),
              })
              const made = objectives?.find((item) => item.completedAt && objectiveCompletesTarget(item))
              if (made) syncObjective(made)
            } else {
              const entry: TimeLogEntry = {
                id: `tl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                date: row.date,
                startTime: hhmm(row.start),
                endTime: hhmm(row.end),
                durationMinutes: row.end - row.start,
                notes: [row.note, objective].filter(Boolean).join(" · ") || undefined,
                taskId: record.id,
                ...(row.stepId ? { stepId: row.stepId } : {}),
              }
              saveLogs([...(record.timeLogs ?? []), entry])
            }
            setAdding(false)
          }}
        />
      )}
    </div>
  )
}

function ObjectiveList({
  entry,
  names,
  readOnly,
  onChange,
}: {
  entry: TimeEntry
  names: Map<string, string>
  readOnly: boolean
  onChange: (next: NowObjective[] | undefined, sync?: NowObjective) => void
}) {
  const [text, setText] = useState("")
  const rows = entry.nowObjectives ?? []
  const add = () => {
    const next = addNowObjective(rows, text, new Date(isoAt(entry.date, entry.startMin)))
    if (next === rows) return
    setText("")
    onChange(next)
  }
  return (
    <div className="ipt-objs">
      {rows.length > 0 && (
        <ul aria-label="Objectives on this block">
          {rows.map((row) => {
            const mins =
              row.completedAt ? Math.max(0, Math.round((Date.parse(row.completedAt) - Date.parse(row.addedAt)) / 60_000)) : null
            return (
              <li key={row.id} className={row.completedAt ? "is-done" : undefined}>
                <input
                  type="checkbox"
                  aria-label={`Done: ${row.text}`}
                  disabled={readOnly}
                  checked={!!row.completedAt}
                  onChange={() => {
                    const completedAt = row.completedAt ? undefined : isoAt(entry.date, entry.endMin)
                    const nextRow = { ...row }
                    if (completedAt) nextRow.completedAt = completedAt
                    else delete nextRow.completedAt
                    onChange(
                      rows.map((item) => (item.id === row.id ? nextRow : item)),
                      nextRow,
                    )
                  }}
                />
                <input
                  className="ipt-text"
                  aria-label={`Objective ${row.text}`}
                  disabled={readOnly}
                  defaultValue={row.text}
                  key={`${row.id}:${row.text}`}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (!value || value === row.text) return
                    onChange(editNowObjectiveText(rows, row.id, value))
                  }}
                />
                <ClockField
                  value={clockOf(row.addedAt)}
                  label={`Added time for ${row.text}`}
                  disabled={readOnly}
                  onCommit={(min) => {
                    if (min == null) return
                    const nextRow = { ...row, addedAt: withClock(row.addedAt, min) }
                    onChange(
                      rows.map((item) => (item.id === row.id ? nextRow : item)),
                      nextRow.completedAt ? nextRow : undefined,
                    )
                  }}
                />
                <i aria-hidden>→</i>
                <ClockField
                  value={row.completedAt ? clockOf(row.completedAt) : null}
                  label={`Done time for ${row.text}`}
                  disabled={readOnly}
                  allowEmpty
                  onCommit={(min) => {
                    const nextRow = { ...row }
                    if (min == null) delete nextRow.completedAt
                    else nextRow.completedAt = withClock(row.completedAt ?? row.addedAt, min)
                    onChange(
                      rows.map((item) => (item.id === row.id ? nextRow : item)),
                      nextRow,
                    )
                  }}
                />
                {mins != null && <b>{mins}m</b>}
                {names.size > 0 && (
                  <select
                    className="ipt-step"
                    aria-label={`Step for ${row.text}`}
                    disabled={readOnly}
                    value={row.stepId ?? ""}
                    onChange={(e) => {
                      const stepId = e.target.value || undefined
                      const tied = tieNowObjectiveToStep(rows, row.id, stepId)
                      const next = setNowObjectiveCompletes(tied, row.id, false)
                      onChange(next)
                    }}
                  >
                    <option value="">No step</option>
                    {[...names.entries()].map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                {row.stepId && !readOnly && (
                  <button
                    type="button"
                    className="ipt-mode"
                    aria-pressed={objectiveCompletesTarget(row)}
                    onClick={() => {
                      const next = setNowObjectiveCompletes(rows, row.id, !objectiveCompletesTarget(row))
                      const updated = next.find((item) => item.id === row.id)
                      onChange(next, updated)
                    }}
                  >
                    {objectiveCompletesTarget(row) ? "finished step" : "counts toward"}
                  </button>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    className="ipt-x"
                    aria-label={`Remove objective ${row.text}`}
                    onClick={() => onChange(removeNowObjective(rows, row.id))}
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!readOnly && (
        <form
          className="ipt-obj-add"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            className="ipt-text"
            aria-label={`Add an objective on ${entry.date} at ${clock(entry.startMin)}`}
            placeholder="Objective"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="ipt-add">
            Add
          </button>
        </form>
      )}
    </div>
  )
}

function LogRow({
  log,
  names,
  readOnly,
  sure,
  onSure,
  onDelete,
  onChange,
}: {
  log: TimeLogEntry
  names: Map<string, string>
  readOnly: boolean
  sure: boolean
  onSure: () => void
  onDelete: () => void
  onChange: (patch: Partial<TimeLogEntry>) => void
}) {
  const from = log.startTime ? parseClock(log.startTime) : null
  const to = log.endTime ? parseClock(log.endTime) : null
  return (
    <li className="ipt-block">
      <div className="ipt-block-row">
        <span className="ipt-kind">{logKind(log)}</span>
        <time dateTime={log.date}>{log.date ? dayLabel(log.date) : "No date"}</time>
        <span className="ipt-span">
          <ClockField
            value={from}
            label={`Start of log ${log.id}`}
            disabled={readOnly}
            allowEmpty
            onCommit={(min) => {
              if (min == null) return
              const end = to != null && to > min ? to : min + (log.durationMinutes || 0)
              onChange({ startTime: hhmm(min), endTime: hhmm(end), durationMinutes: Math.max(1, end - min) })
            }}
          />
          <i aria-hidden>–</i>
          <ClockField
            value={to}
            label={`End of log ${log.id}`}
            disabled={readOnly}
            allowEmpty
            onCommit={(min) => {
              if (min == null || from == null || min <= from) return
              onChange({ endTime: hhmm(min), durationMinutes: min - from })
            }}
          />
        </span>
        <input
          className="ipt-mins"
          aria-label={`Minutes of log ${log.id}`}
          inputMode="numeric"
          disabled={readOnly}
          defaultValue={String(log.durationMinutes)}
          key={`${log.id}:${log.durationMinutes}`}
          onBlur={(e) => {
            const mins = Number.parseInt(e.target.value, 10)
            if (!Number.isFinite(mins) || mins < 1 || mins === log.durationMinutes) return
            if (from != null) onChange({ durationMinutes: mins, endTime: hhmm(Math.min(1440, from + mins)) })
            else onChange({ durationMinutes: mins })
          }}
        />
        <span className="ipt-quiet">m</span>
        {names.size > 0 && (
          <select
            className="ipt-step"
            aria-label={`Step for log ${log.id}`}
            disabled={readOnly}
            value={log.stepId ?? ""}
            onChange={(e) => onChange(e.target.value ? { stepId: e.target.value } : { stepId: undefined })}
          >
            <option value="">Whole task</option>
            {[...names.entries()].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        )}
        {!readOnly &&
          (sure ? (
            <button type="button" className="ipt-x is-sure" onClick={onDelete}>
              delete?
            </button>
          ) : (
            <button type="button" className="ipt-x" aria-label={`Delete log ${log.id}`} onClick={onSure}>
              ×
            </button>
          ))}
      </div>
      <input
        className="ipt-text"
        aria-label={`Note for log ${log.id}`}
        disabled={readOnly}
        defaultValue={log.notes ?? ""}
        placeholder="What this time was"
        key={`${log.id}:notes:${log.notes ?? ""}`}
        onBlur={(e) => {
          const notes = e.target.value.trim()
          if (notes !== (log.notes ?? "")) onChange({ notes: notes || undefined })
        }}
      />
    </li>
  )
}

function AddTime({
  choices,
  penName,
  onCancel,
  onAdd,
}: {
  choices: { id: string; label: string }[]
  penName?: string
  onCancel: () => void
  onAdd: (row: { date: string; start: number; end: number; stepId?: string; note: string; objective: string; done: boolean }) => void
}) {
  const [date, setDate] = useState(() => formatLocalDateKey(new Date()))
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [stepId, setStepId] = useState("")
  const [note, setNote] = useState("")
  const [objective, setObjective] = useState("")
  const [done, setDone] = useState(true)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="ipt-add-form"
      onSubmit={(e) => {
        e.preventDefault()
        const a = parseClock(start)
        const b = parseClock(end)
        if (a == null || b == null || b <= a) {
          setError("Start and end are clock times, and the end is later.")
          return
        }
        onAdd({ date, start: a, end: b, stepId: stepId || undefined, note: note.trim(), objective: objective.trim(), done })
      }}
    >
      <label>
        Date
        <input className="ipt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Start
        <input className="ipt-clock" aria-label="Start" value={start} onChange={(e) => setStart(e.target.value)} placeholder="9:00" />
      </label>
      <label>
        End
        <input className="ipt-clock" aria-label="End" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="10:30" />
      </label>
      {choices.length > 0 && (
        <label>
          Step
          <select className="ipt-step" aria-label="Step" value={stepId} onChange={(e) => setStepId(e.target.value)}>
            <option value="">Whole task</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="ipt-add-wide">
        Note
        <input className="ipt-text" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label className="ipt-add-wide">
        Objective
        <input className="ipt-text" aria-label="Objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
      </label>
      <label className="ipt-add-check">
        <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Done at the end
      </label>
      <div className="ipt-add-actions">
        <button type="submit" className="ipt-add">
          {penName ? "Add this block" : "Add this log"}
        </button>
        <button type="button" className="ipt-add" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <p className="ipt-quiet">{penName ? `Paints with ${penName}.` : "No pen is linked. This writes a time log."}</p>
      {error && <p className="ipt-quiet">{error}</p>}
    </form>
  )
}
