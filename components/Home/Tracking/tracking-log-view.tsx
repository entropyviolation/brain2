/**
 * components/Home/Tracking/tracking-log-view.tsx — One calm day of intake, events, cycle
 *
 * Follows the Tracking day cursor. The composer is one row of modes: Event,
 * Switch task, Switch goal, Intake, Note. Food, drink, and drugs are Intake
 * presets on an Intake-pen instant. The clock stays visible. Estimated and
 * Unknown are checkboxes. Cycle marks label a phase from bleed days and
 * ovulation; spotting is recorded and does not change that label.
 * The cycle section renders only when Enable cycle tracking is on.
 */
"use client"

import { useMemo, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { addDays, subDays } from "date-fns"
import { CycleLogSection } from "@/components/Home/Tracking/cycle-log-section"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import {
  LOCATION_SCOPE_ID,
  asLogEntry,
  classifyLogBookRow,
  compareLogRows,
  ensureLocationPen,
  logClockLabel,
  submitTrackingLog,
  type IntakeClass,
  type LogBookEntry,
  type LogBookList,
  type LogClockChoice,
  type LogComposerMode,
  type LogList,
} from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useGoalsStore } from "@/lib/goals-store"
import { isTaskItem, itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesToTimeString, timeStringToMinutes } from "@/lib/time-entries"
import "./tracking-chrome.css"

const MODES: { id: LogComposerMode; label: string }[] = [
  { id: "event", label: "Event" },
  { id: "task", label: "Switch task" },
  { id: "goal", label: "Switch goal" },
  { id: "intake", label: "Intake" },
  { id: "note", label: "Note" },
]

const INTAKE_PRESETS: { id: IntakeClass; label: string; placeholder: string }[] = [
  { id: "food", label: "Food", placeholder: "coffee" },
  { id: "drink", label: "Drink", placeholder: "water" },
  { id: "drug", label: "Drug", placeholder: "name" },
]

const INTAKE_LISTS: { id: LogList; title: string }[] = [
  { id: "food", title: "Food" },
  { id: "drink", title: "Drink" },
  { id: "drug", title: "Drugs" },
]

function defaultClock(day: Date): string {
  const now = new Date()
  const sameDay =
    day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate()
  if (!sameDay) return "08:00"
  return minutesToTimeString(now.getHours() * 60 + now.getMinutes())
}

function fieldLabel(mode: LogComposerMode): string {
  if (mode === "task") return "Task"
  if (mode === "goal") return "Goal"
  if (mode === "note") return "Note"
  return "Title"
}

function fieldPlaceholder(mode: LogComposerMode, intake: IntakeClass): string {
  if (mode === "event" || mode === "note") return "left room"
  if (mode === "task") return "cleaning"
  if (mode === "goal") return "read"
  return INTAKE_PRESETS.find((row) => row.id === intake)?.placeholder ?? "coffee"
}

function LogRow({
  entry,
  onOpen,
  onRemove,
}: {
  entry: LogBookEntry
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  const clock = logClockLabel(entry)
  const title = entry.title?.trim() || "Untitled"
  if (clock.badge === "Unknown") {
    return (
      <div className="trk-log-row is-unknown">
        <span className="trk-logbook-badge">Unknown</span>
        <span className="trk-log-copy">{title}</span>
        <button type="button" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="trk-log-row" onClick={() => onOpen(entry.id)}>
      {clock.time ? <span className="trk-log-when">{clock.time}</span> : null}
      <span className="trk-log-copy">{title}</span>
      {clock.badge ? <span className="trk-logbook-badge">{clock.badge}</span> : null}
    </button>
  )
}

function LogListWell({
  title,
  note,
  rows,
  onOpen,
  onRemove,
}: {
  title: string
  note?: string
  rows: LogBookEntry[]
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="trk-aside-well" aria-label={title}>
      <h3 className="trk-logbook-heading">{title}</h3>
      {note ? <p className="trk-logbook-note">{note}</p> : null}
      {rows.length === 0 ? (
        <p className="trk-logbook-note">None</p>
      ) : (
        <div className="trk-log">
          {rows.map((entry) => (
            <LogRow key={entry.id} entry={entry} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  )
}

export function TrackingLogView({
  currentDate,
  setCurrentDate,
  lockDate = false,
}: {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  lockDate?: boolean
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const tasks = useTaskStore((s) => s.tasks)
  const folders = useTaskStore((s) => s.folders)
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const dateKey = formatLocalDateKey(currentDate)

  const [mode, setMode] = useState<LogComposerMode>("event")
  const [intake, setIntake] = useState<IntakeClass>("food")
  const [title, setTitle] = useState("")
  const [estimated, setEstimated] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [timeValue, setTimeValue] = useState(() => defaultClock(currentDate))
  const [locationPenId, setLocationPenId] = useState("")
  const [locationDraft, setLocationDraft] = useState("")
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  const locationPens = useMemo(() => {
    return scopes.find((scope) => scope.id === LOCATION_SCOPE_ID)?.pens ?? []
  }, [scopes])

  const taskNames = useMemo(() => {
    const names = new Set<string>()
    for (const task of tasks) {
      if (!isTaskItem(task, folders)) continue
      const name = itemTitle(task)
      if (name) names.add(name)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [tasks, folders])

  const goalNames = useMemo(() => {
    const names = new Set<string>()
    for (const objective of objectives) {
      if (objective.archived) continue
      const name = objective.title.trim()
      if (name) names.add(name)
    }
    for (const goal of goals) {
      const name = goal.title.trim()
      if (name) names.add(name)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [objectives, goals])

  const grouped = useMemo(() => {
    const groups: Record<LogBookList, LogBookEntry[]> = {
      food: [],
      drink: [],
      drug: [],
      intake: [],
      event: [],
      task: [],
      goal: [],
    }
    for (const entry of entries) {
      if (entry.date !== dateKey) continue
      const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
      if (!row) continue
      groups[row.list].push(row)
    }
    for (const list of Object.keys(groups) as LogBookList[]) groups[list].sort(compareLogRows)
    return groups
  }, [entries, dateKey, penName])

  const clock: LogClockChoice = unknown ? "unknown" : estimated ? "estimated" : "exact"
  const openEntry = openEntryId ? entries.find((entry) => entry.id === openEntryId) : undefined
  const suggestions = mode === "task" ? taskNames : mode === "goal" ? goalNames : []

  const stampNow = () => {
    const now = new Date()
    setTimeValue(minutesToTimeString(now.getHours() * 60 + now.getMinutes()))
    setUnknown(false)
  }

  const addLocation = () => {
    const id = ensureLocationPen(locationDraft)
    if (!id) return
    setLocationPenId(id)
    setLocationDraft("")
  }

  const add = () => {
    const minute = timeStringToMinutes(timeValue)
    if (clock !== "unknown" && minute == null) return
    const id = submitTrackingLog({
      date: dateKey,
      title,
      mode,
      intakeClass: intake,
      clock,
      minute: minute ?? 0,
      locationPenId: mode === "event" ? locationPenId || undefined : undefined,
    })
    if (!id) return
    setTitle("")
  }

  return (
    <div className="trk95 trk-canvas trk-logbook" data-ui-name="Tracking log" data-testid="tracking-log-view">
      <TrackingPeriodNav
        label={currentDate.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        previousLabel="Previous day"
        nextLabel="Next day"
        onPrevious={() => setCurrentDate(subDays(currentDate, 1))}
        onNext={() => setCurrentDate(addDays(currentDate, 1))}
        onToday={() => setCurrentDate(new Date())}
        locked={lockDate}
      />

      <section className="trk-aside-well trk-logbook-compose" aria-label="Add to the tracking log">
        <div className="trk-span-switch trk-logbook-modes" role="toolbar" aria-label="What to log">
          {MODES.map((row) => (
            <button key={row.id} type="button" aria-pressed={mode === row.id} onClick={() => setMode(row.id)}>
              {row.label}
            </button>
          ))}
        </div>

        {mode === "intake" ? (
          <div className="trk-logbook-sub">
            <div className="trk-span-switch" role="toolbar" aria-label="Intake">
              {INTAKE_PRESETS.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  aria-pressed={intake === row.id}
                  onClick={() => setIntake(row.id)}
                >
                  {row.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="trk-logbook-add trk-logbook-fields">
          <input
            aria-label={fieldLabel(mode)}
            placeholder={fieldPlaceholder(mode, intake)}
            value={title}
            list={suggestions.length > 0 ? "tracking-log-names" : undefined}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                add()
              }
            }}
          />
          {suggestions.length > 0 ? (
            <datalist id="tracking-log-names">
              {suggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}
          <ClockPicker aria-label="Time of day" value={timeValue} onChange={setTimeValue} />
          <button type="button" onClick={stampNow}>
            Now
          </button>
          <label className="trk-logbook-check">
            <input
              type="checkbox"
              checked={estimated}
              onChange={() => {
                setEstimated((on) => {
                  if (!on) setUnknown(false)
                  return !on
                })
              }}
            />
            Estimated
          </label>
          <label className="trk-logbook-check">
            <input
              type="checkbox"
              checked={unknown}
              onChange={() => {
                setUnknown((on) => {
                  if (!on) setEstimated(false)
                  return !on
                })
              }}
            />
            Unknown
          </label>
          <button type="button" onClick={add} disabled={!title.trim()}>
            Add
          </button>
        </div>

        {mode === "event" ? (
          <div className="trk-logbook-sub">
            <div className="trk-span-switch" role="toolbar" aria-label="Location">
              {locationPens.map((pen) => (
                <button
                  key={pen.id}
                  type="button"
                  aria-pressed={locationPenId === pen.id}
                  onClick={() => setLocationPenId((current) => (current === pen.id ? "" : pen.id))}
                >
                  {pen.name}
                </button>
              ))}
            </div>
            <div className="trk-logbook-add">
              <input
                aria-label="New location"
                placeholder="kitchen"
                value={locationDraft}
                onChange={(event) => setLocationDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addLocation()
                  }
                }}
              />
              <button type="button" onClick={addLocation} disabled={!locationDraft.trim()}>
                Add location
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {INTAKE_LISTS.map((list) => (
        <LogListWell
          key={list.id}
          title={list.title}
          rows={grouped[list.id]}
          onOpen={setOpenEntryId}
          onRemove={removeEntry}
        />
      ))}

      {grouped.intake.length > 0 ? (
        <LogListWell
          title="Intake"
          note="Intake with no food, drink, or drug class."
          rows={grouped.intake}
          onOpen={setOpenEntryId}
          onRemove={removeEntry}
        />
      ) : null}

      <LogListWell
        title="Events"
        note="Any repeated phrase can be counted later. Example: left room."
        rows={grouped.event}
        onOpen={setOpenEntryId}
        onRemove={removeEntry}
      />

      {grouped.task.length > 0 ? (
        <LogListWell title="Switch task" rows={grouped.task} onOpen={setOpenEntryId} onRemove={removeEntry} />
      ) : null}

      {grouped.goal.length > 0 ? (
        <LogListWell title="Switch goal" rows={grouped.goal} onOpen={setOpenEntryId} onRemove={removeEntry} />
      ) : null}

      <CycleLogSection date={dateKey} />

      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </div>
  )
}
