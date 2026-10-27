/**
 * components/Home/ToDo/SpentBlocks.tsx — The minutes counted as spent
 *
 * One row per stretch in `taskActualSegments`, so the rows add up to the
 * total. A block's clocks and step can be edited, and the block can be
 * deleted, through the same time-grid calls as the grid. Durations follow the
 * card's h/m switch. A typed bare number is minutes unless the text includes
 * h. Start and end stay wall-clock times. The step is a searchable picker. A typed log and a
 * saved actual with no block are their own rows: change the duration, point
 * the log at a step, or clear it.
 *
 * A written block with a pen shows that pen's color as a dot. Double-click
 * the row (not a clock field) opens `EntryDialog` for that entry.
 *
 * _Last mapped: 2026-10-25_
 */
"use client"

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react"
import { createPortal } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { placeSteps } from "@/lib/next-step"
import { tieNowObjectiveToStep } from "@/lib/now-objective"
import { whenLabel } from "@/lib/session-debrief"
import { compactDuration, parseDurationInput } from "@/lib/time-entries"
import { formatStatMinutes, useTaskCardTimeUnit } from "./task-card-unit"
import { findPen, taskActualSegments, type ActualSegment } from "@/lib/tracked-time"
import type { Subtask, Task, TimeLogEntry } from "@/lib/types"

export interface SpentBlocksScope {
  taskId: string
  /** Limit to these steps (a sub-card's root and what is inside it). Omitted = the whole task. */
  stepIds?: ReadonlySet<string>
  /** Step id to name, for the "on" column. */
  names: ReadonlyMap<string, string>
  logs?: readonly TimeLogEntry[]
  /** Task writes (a log, a saved actual). The card passes its undo path. */
  onPatch?: (patch: Partial<Task>) => void
}

const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`

/** "9:30", "930". Returns minutes since midnight, or null. */
function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2] ?? 0)
  return min >= 0 && min <= 1440 && Number(m[2] ?? 0) < 60 ? min : null
}

const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })

/** The entry's pen, when it has a real color. A missing pen is not given one. */
function blockPen(kind: ActualSegment["kind"], penId: string | undefined, scopes: TrackScope[]) {
  if (kind !== "block" || !penId) return null
  const pen = findPen(scopes, penId)
  const color = pen?.color?.trim()
  if (!pen || !color) return null
  return { color, name: pen.name }
}

function withActual(steps: readonly Subtask[] | undefined, id: string, minutes: number | undefined): Subtask[] {
  return (steps ?? []).map((step) => {
    if (step.id !== id) {
      if (!step.subtasks?.length) return step
      const subtasks = withActual(step.subtasks, id, minutes)
      return subtasks === step.subtasks ? step : { ...step, subtasks }
    }
    const next = { ...step }
    if (minutes != null && minutes > 0) next.actualDuration = minutes
    else delete next.actualDuration
    return next
  })
}

function ClockField({ value, label, onCommit }: { value: number; label: string; onCommit: (min: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const done = (keep: boolean) => {
    const next = draft == null ? null : parseClock(draft)
    if (keep && next != null && next !== value) onCommit(next)
    setDraft(null)
  }
  return (
    <input
      className="tcs-spent-clock"
      aria-label={label}
      inputMode="numeric"
      size={5}
      value={draft ?? clock(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") return (e.preventDefault(), done(true), e.currentTarget.blur())
        if (e.key === "Escape" && draft != null) return (e.preventDefault(), e.stopPropagation(), done(false), e.currentTarget.blur())
      }}
    />
  )
}

function readDuration(raw: string, hours: boolean): number | null {
  const t = raw.trim()
  if (t === "") return 0
  if (!hours) {
    const n = Number(t)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }
  if (/^\d+(?:\.\d+)?$/.test(t)) return Math.max(0, Math.round(Number(t)))
  if (t === "0h" || t === "0h00") return 0
  return parseDurationInput(t)
}

function MinuteField({ value, label, onCommit }: { value: number; label: string; onCommit: (min: number) => void }) {
  const hours = useTaskCardTimeUnit() === "h"
  const [draft, setDraft] = useState<string | null>(null)
  const shown = hours ? compactDuration(value, true) : String(value)
  const done = (keep: boolean) => {
    const next = draft == null ? null : readDuration(draft, hours)
    if (keep && next != null && next !== value) onCommit(next)
    setDraft(null)
  }
  return (
    <input
      className="tcs-spent-clock"
      aria-label={label}
      inputMode={hours ? "text" : "numeric"}
      size={hours ? 6 : 4}
      value={draft ?? shown}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") return (e.preventDefault(), done(true), e.currentTarget.blur())
        if (e.key === "Escape" && draft != null) return (e.preventDefault(), e.stopPropagation(), done(false), e.currentTarget.blur())
      }}
    />
  )
}

function splitStep(label: string): { name: string; path?: string } {
  const parts = label.split(" › ")
  if (parts.length < 2) return { name: label }
  return { name: parts[parts.length - 1]!, path: parts.slice(0, -1).join(" › ") }
}

/** Searchable step for one spent row. The closed face is the step's own name. */
function StepAim({ value, label, choices, onChange }: { value: string; label: string; choices: { id: string; label: string }[]; onChange: (id: string) => void }) {
  const listId = useId()
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [hi, setHi] = useState(0)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const current = choices.find((choice) => choice.id === value)
  const face = current ? splitStep(current.label).name : "Whole task"

  const needle = q.trim().toLowerCase()
  const options = useMemo(() => {
    const all = [{ id: "", label: "Whole task" }, ...choices]
    return all.filter((choice) => !needle || choice.label.toLowerCase().includes(needle)).slice(0, 40)
  }, [choices, needle])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const rect = btn.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(320, window.innerWidth - 24)
      let left = rect.left
      if (left + width > window.innerWidth - 12) left = window.innerWidth - width - 12
      const top = rect.bottom + 6 + 280 > window.innerHeight && rect.top > 280 ? Math.max(12, rect.top - 286) : rect.bottom + 6
      setBox({ top, left: Math.max(12, left), width })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (btn.current?.contains(target) || pop.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const choose = (id: string) => {
    onChange(id)
    setOpen(false)
    setQ("")
    setHi(0)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tcs-spent-aim"
        data-no95=""
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        title={current?.label ?? "Whole task"}
        onClick={() => {
          setHi(0)
          setOpen((v) => !v)
        }}
      >
        {face}
      </button>
      {open && box
        ? createPortal(
            <div ref={pop} className="tcs-step-pop" data-spent-step-pop="" role="dialog" aria-label={label} style={{ top: box.top, left: box.left, width: box.width }}>
              <input
                className="tcs-wait-search"
                data-draft=""
                data-no95=""
                autoFocus
                value={q}
                placeholder="Search steps"
                aria-label="Search steps"
                autoComplete="off"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                onChange={(e) => {
                  setQ(e.target.value)
                  setHi(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setHi((n) => Math.min(n + 1, Math.max(0, options.length - 1)))
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setHi((n) => Math.max(n - 1, 0))
                  } else if (e.key === "Enter") {
                    e.preventDefault()
                    const pick = options[Math.min(hi, options.length - 1)]
                    if (pick) choose(pick.id)
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                  }
                }}
              />
              <ul id={listId} className="tcs-step-list" role="listbox" aria-label="Steps">
                {options.length === 0 ? <li className="tcs-hint">Nothing matches.</li> : null}
                {options.map((choice, i) => {
                  const { name, path } = splitStep(choice.label)
                  return (
                    <li key={choice.id || "whole"} role="presentation">
                      <button
                        type="button"
                        role="option"
                        className={`tcs-step-row${choice.id === value ? " is-current" : ""}`}
                        data-no95=""
                        aria-selected={i === hi}
                        onMouseEnter={() => setHi(i)}
                        onClick={() => choose(choice.id)}
                      >
                        <span>{name}</span>
                        {path ? <span className="tcs-step-path">{path}</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function SpentBlocks({ scope }: { scope: SpentBlocksScope }) {
  const unit = useTaskCardTimeUnit()
  const dur = (n: number) => formatStatMinutes(n, unit)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const updateTask = useTaskStore((s) => s.updateTask)
  const [sure, setSure] = useState<string | null>(null)
  const { taskId, stepIds, names, onPatch } = scope
  const task = useTaskStore((st) => st.tasks.find((t) => t.id === taskId))
  const choices = useMemo(
    () =>
      task
        ? placeSteps(task.subtasks).map((p) => ({
            id: p.step.id,
            label: [...p.path.map((x) => x.description), p.step.description].join(" › "),
          }))
        : [],
    [task],
  )
  const rows = useMemo(() => {
    if (!task) return []
    const all = taskActualSegments(task, entries)
    if (!stepIds) return all
    return all.filter((row) => !!row.stepId && stepIds.has(row.stepId))
  }, [task, entries, stepIds])

  const write = (patch: Partial<Task>) => {
    if (!task) return
    if (onPatch) onPatch(patch)
    else updateTask({ ...task, ...patch })
  }

  const aim = (row: ActualSegment, stepId: string) => {
    const next = stepId || undefined
    if (row.kind === "block" && row.entryId) {
      const entry = entries.find((item) => item.id === row.entryId)
      if (!entry) return
      if (row.objectiveId) {
        updateEntry(entry.id, { nowObjectives: tieNowObjectiveToStep(entry.nowObjectives, row.objectiveId, next) })
        return
      }
      updateEntry(entry.id, { stepId: next })
      return
    }
    if (row.kind === "log" && row.logId) {
      write({
        timeLogs: (task?.timeLogs ?? []).map((log) => (log.id === row.logId ? { ...log, ...(next ? { stepId: next } : { stepId: undefined }) } : log)),
      })
    }
  }

  const drop = (row: ActualSegment) => {
    if (row.kind === "block" && row.entryId) {
      removeEntry(row.entryId)
      return
    }
    if (row.kind === "log" && row.logId) {
      write({ timeLogs: (task?.timeLogs ?? []).filter((log) => log.id !== row.logId) })
      return
    }
    if (row.kind === "saved") {
      if (!row.stepId) write({ actualDuration: undefined })
      else write({ subtasks: withActual(task?.subtasks, row.stepId, undefined) })
    }
  }

  const editSaved = (row: ActualSegment, minutes: number) => {
    if (!row.stepId) write({ actualDuration: minutes > 0 ? minutes : undefined })
    else write({ subtasks: withActual(task?.subtasks, row.stepId, minutes) })
  }

  const editLog = (row: ActualSegment, minutes: number) => {
    if (!row.logId) return
    write({
      timeLogs: (task?.timeLogs ?? []).map((log) => (log.id === row.logId ? { ...log, durationMinutes: minutes } : log)),
    })
  }

  if (!rows.length) return <p className="is-quiet">No time recorded on this yet.</p>

  const byDay = new Map<string, ActualSegment[]>()
  const saved: ActualSegment[] = []
  for (const row of rows) {
    if (!row.date) saved.push(row)
    else {
      const list = byDay.get(row.date) ?? []
      list.push(row)
      byDay.set(row.date, list)
    }
  }
  const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1))
  const entryOf = (id: string | undefined) => (id ? entries.find((item) => item.id === id) : undefined)

  const line = (row: ActualSegment) => {
    const entry = entryOf(row.entryId)
    const whole = !!(entry && row.kind === "block" && !row.objectiveId && row.startMin === entry.startMin && row.endMin === entry.endMin)
    const where = row.stepId ? (names.get(row.stepId) ?? "a step") : "whole task"
    const mark = blockPen(row.kind, entry ? entry.penId : row.penId, scopes)
    const openDetail = row.kind === "block" && entry
      ? (event: ReactMouseEvent) => {
          const target = event.target
          if (target instanceof Element && target.closest("input, textarea, button, [data-spent-step-pop]")) return
          openBlockDetail(entry.id)
        }
      : undefined
    return (
      <li key={row.id} onDoubleClick={openDetail}>
        <span className="tcs-spent-span">
          {mark ? <span className="task-card-pen-dot" style={{ backgroundColor: mark.color, display: "inline-block", flex: "none" }} title={mark.name} aria-hidden /> : null}
          {whole && entry ? (
            <>
              <ClockField value={entry.startMin} label={`Start on ${row.date}`} onCommit={(m) => entry.endMin > m && updateEntry(entry.id, { startMin: m })} />
              <i aria-hidden>–</i>
              <ClockField value={entry.endMin} label={`End on ${row.date}`} onCommit={(m) => m > entry.startMin && updateEntry(entry.id, { endMin: m })} />
            </>
          ) : row.startMin != null && row.endMin != null ? (
            `${clock(row.startMin)}–${clock(row.endMin)}`
          ) : row.kind === "saved" ? (
            "no block"
          ) : (
            "logged"
          )}
        </span>
        {row.kind === "saved" ? (
          <MinuteField value={row.minutes} label="Recorded actual minutes" onCommit={(m) => editSaved(row, m)} />
        ) : row.kind === "log" && row.logId ? (
          <MinuteField value={row.minutes} label="Logged minutes" onCommit={(m) => editLog(row, m)} />
        ) : (
          <b>{dur(row.minutes)}</b>
        )}
        {row.kind === "saved" ? (
          <em title={where}>{where}</em>
        ) : (
          <StepAim value={row.stepId ?? ""} label={`Step for ${dur(row.minutes)} on ${row.date ?? "this record"}`} choices={choices} onChange={(id) => aim(row, id)} />
        )}
        {sure === row.id ? (
          <button type="button" className="tcs-spent-x is-sure" onClick={() => (drop(row), setSure(null))} onBlur={() => setSure(null)} autoFocus>
            delete?
          </button>
        ) : (
          <button
            type="button"
            className="tcs-spent-x"
            title={row.kind === "block" ? "Delete this block from the time grid" : row.kind === "log" ? "Remove this log" : "Clear this recorded actual"}
            aria-label={row.kind === "saved" ? "Clear recorded actual" : "Delete this time"}
            onClick={() => setSure(row.id)}
          >
            ×
          </button>
        )}
      </li>
    )
  }

  return (
    <ul className="tcs-spent" aria-label="Minutes counted as spent">
      {days.flatMap((date) => {
        const list = byDay.get(date) ?? []
        const sum = list.reduce((n, row) => n + row.minutes, 0)
        return [
          <li key={date} className="tcs-spent-day">
            {dayLabel(date)} · {dur(sum)}
          </li>,
          ...list.map(line),
        ]
      })}
      {saved.length ? (
        <li className="tcs-spent-day">Recorded actual, no block · {dur(saved.reduce((n, row) => n + row.minutes, 0))}</li>
      ) : null}
      {saved.map(line)}
    </ul>
  )
}

const diaryDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

/** Local wall time for `whenLabel`. Minutes past midnight roll onto the next day. */
function diaryIso(date: string, minute: number): string {
  const day = new Date(`${date}T00:00:00`)
  day.setMinutes(minute)
  const y = day.getFullYear()
  const mo = String(day.getMonth() + 1).padStart(2, "0")
  const d = String(day.getDate()).padStart(2, "0")
  const h = String(day.getHours()).padStart(2, "0")
  const mi = String(day.getMinutes()).padStart(2, "0")
  return `${y}-${mo}-${d}T${h}:${mi}:00`
}

function stretchWhen(row: ActualSegment): string {
  if (!row.date || row.startMin == null || row.endMin == null) return ""
  return whenLabel(diaryIso(row.date, row.startMin), diaryIso(row.date, row.endMin))
}

/**
 * Read-only diary of `taskActualSegments` for the header spent pill.
 * Days newest first. No clock editors, delete, or account split.
 */
export function SpentDiary({ scope }: { scope: SpentBlocksScope }) {
  const unit = useTaskCardTimeUnit()
  const dur = (n: number) => formatStatMinutes(n, unit)
  const entries = useTimeTrackingStore((s) => s.entries)
  const task = useTaskStore((st) => st.tasks.find((t) => t.id === scope.taskId))
  const rows = useMemo(() => {
    if (!task) return []
    const all = taskActualSegments(task, entries)
    if (!scope.stepIds) return all
    return all.filter((row) => !!row.stepId && scope.stepIds!.has(row.stepId))
  }, [task, entries, scope.stepIds])

  if (!rows.length) return <p className="is-quiet">No time recorded on this yet.</p>

  const byDay = new Map<string, ActualSegment[]>()
  const saved: ActualSegment[] = []
  for (const row of rows) {
    if (!row.date) saved.push(row)
    else {
      const list = byDay.get(row.date) ?? []
      list.push(row)
      byDay.set(row.date, list)
    }
  }
  const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1))
  const whereOf = (row: ActualSegment) => {
    if (row.objectiveId && row.entryId) {
      const title = entries.find((item) => item.id === row.entryId)?.nowObjectives?.find((item) => item.id === row.objectiveId)?.text?.trim()
      if (title) return title
    }
    if (row.stepId) return scope.names.get(row.stepId) || "on this task"
    return "on this task"
  }

  return (
    <div className="tcs-spent-diary" aria-label="Spent diary">
      {days.map((date) => {
        const list = [...(byDay.get(date) ?? [])].sort((a, b) => (b.startMin ?? 0) - (a.startMin ?? 0))
        const sum = list.reduce((n, row) => n + row.minutes, 0)
        return (
          <section key={date}>
            <h4 className="tcs-diary-day">
              <span>{diaryDay(date)}</span>
              <span>{dur(sum)}</span>
            </h4>
            <ul>
              {list.map((row) => {
                const when = stretchWhen(row)
                return (
                  <li key={row.id} className="tcs-diary-row">
                    {when ? <span className="tcs-diary-when">{when}</span> : <span className="tcs-diary-when">logged</span>}
                    <span className="tcs-diary-where">{whereOf(row)}</span>
                    <span className="tcs-diary-dur">{dur(row.minutes)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {saved.length ? (
        <section>
          <h4 className="tcs-diary-day">
            <span>Recorded, no day</span>
            <span>{dur(saved.reduce((n, row) => n + row.minutes, 0))}</span>
          </h4>
          <ul>
            {saved.map((row) => (
              <li key={row.id} className="tcs-diary-row">
                <span className="tcs-diary-when">saved</span>
                <span className="tcs-diary-where">{whereOf(row)}</span>
                <span className="tcs-diary-dur">{dur(row.minutes)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

/**
 * The Spent popover unmounts on any pointerdown outside the stat card.
 * This editor lives in its own root so that click still reaches `EntryDialog`
 * (including the unsaved-changes guard). A pointerdown inside the editor does
 * not close the popover.
 */
let detailId: string | null = null
const detailListeners = new Set<() => void>()
let detailRoot: Root | null = null

function getDetailId() {
  return detailId
}

function getServerDetailId() {
  return null
}

function subscribeDetail(listener: () => void) {
  detailListeners.add(listener)
  return () => detailListeners.delete(listener)
}

function emitDetail() {
  for (const listener of detailListeners) listener()
}

function closeBlockDetail() {
  if (detailId == null) return
  detailId = null
  emitDetail()
}

function openBlockDetail(entryId: string) {
  detailId = entryId
  if (!detailRoot && typeof document !== "undefined") {
    const el = document.createElement("div")
    el.dataset.spentBlockDetail = ""
    document.body.appendChild(el)
    detailRoot = createRoot(el)
    detailRoot.render(<BlockDetailHost />)
  }
  emitDetail()
}

function BlockDetailHost() {
  const id = useSyncExternalStore(subscribeDetail, getDetailId, getServerDetailId)
  const entry = useTimeTrackingStore((s) => (id ? s.entries.find((item) => item.id === id) : undefined))
  useEffect(() => {
    if (id && !entry) closeBlockDetail()
  }, [id, entry])
  useEffect(() => {
    if (!id || !entry) return
    const stopPointer = (event: Event) => {
      const node = event.target
      if (node instanceof Element && node.closest("[data-ui-name='Tracking entry'], .w95-confirm")) event.stopPropagation()
    }
    const stopEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.stopPropagation()
    }
    document.body.addEventListener("pointerdown", stopPointer)
    document.addEventListener("keydown", stopEscape, true)
    return () => {
      document.body.removeEventListener("pointerdown", stopPointer)
      document.removeEventListener("keydown", stopEscape, true)
    }
  }, [id, entry])
  if (!entry) return null
  return <EntryDialog entry={entry} onClose={closeBlockDetail} />
}
