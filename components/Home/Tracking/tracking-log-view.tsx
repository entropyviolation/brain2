/**
 * components/Home/Tracking/tracking-log-view.tsx — One calm day of intake, events, cycle
 *
 * Follows the Tracking day cursor. The composer is one row of modes: Event,
 * Switch, Intake, Note, Thought. Event’s location is one field over
 * the Location pens. Note and Thought are a few-line textarea; the other
 * modes stay one line. Thought is the crystallized thought of this moment,
 * stored as `eventKind` `thought-process`, and listed under Thought.
 * Food, drink, and drugs are Intake presets on an Intake-pen instant.
 * The clock stays visible. Custom phrases are added in Tracking settings
 * (the gear), not on this composer. Counts sits under the composer.
 * Estimated and Unknown are checkboxes. Cycle marks
 * label a phase from bleed days and ovulation; spotting is recorded and does
 * not change that label. The cycle section renders only when Enable cycle
 * tracking is on.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { addDays, subDays } from "date-fns"
import { CountStatusesSection } from "@/components/Home/Tracking/count-statuses-section"
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
  switchLogCopy,
  type IntakeClass,
  type LogBookEntry,
  type LogBookList,
  type LogClockChoice,
  type LogComposerMode,
  type LogList,
} from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesToTimeString, timeStringToMinutes } from "@/lib/time-entries"
import "./tracking-chrome.css"

const MODES: { id: LogComposerMode; label: string }[] = [
  { id: "event", label: "Event" },
  { id: "switch", label: "Switch" },
  { id: "intake", label: "Intake" },
  { id: "note", label: "Note" },
  { id: "thought", label: "Thought" },
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
  if (mode === "note") return "Note"
  if (mode === "thought") return "Thought"
  return "Title"
}

function fieldPlaceholder(mode: LogComposerMode, intake: IntakeClass): string {
  if (mode === "thought") return "opening the editor to fix the clock"
  if (mode === "event" || mode === "note") return "left room"
  return INTAKE_PRESETS.find((row) => row.id === intake)?.placeholder ?? "coffee"
}

/** The note path stamps a pipeline line under the words the person wrote. */
function visibleNoteBody(notes: string | undefined): string {
  if (!notes) return ""
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "from text pipeline" && !/^from text message at\b/i.test(line))
    .join("\n")
}

function LogCopy({ entry }: { entry: LogBookEntry }) {
  const title = entry.title?.trim() || "Untitled"
  const body = visibleNoteBody(entry.notes)
  return (
    <span className="trk-log-copy">
      {title}
      {body ? <span className="trk-log-body">{body}</span> : null}
    </span>
  )
}

type LocationPen = { id: string; name: string }
type LocationChoice = { kind: "pen"; id: string; name: string } | { kind: "create"; name: string }

function LocationField({
  pens,
  penId,
  onPenId,
}: {
  pens: LocationPen[]
  penId: string
  onPenId: (id: string) => void
}) {
  const fieldRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<"idle" | "browse" | "filter">("idle")
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const selectedName = pens.find((pen) => pen.id === penId)?.name ?? ""
  const value = phase === "filter" ? query : selectedName
  const needle = phase === "filter" ? query.trim().toLowerCase() : ""
  const matches = needle ? pens.filter((pen) => pen.name.toLowerCase().includes(needle)) : pens
  const createName = phase === "filter" ? query.trim() : ""
  const showCreate = Boolean(createName) && matches.length === 0
  const options: LocationChoice[] = [
    ...matches.map((pen) => ({ kind: "pen" as const, id: pen.id, name: pen.name })),
    ...(showCreate ? [{ kind: "create" as const, name: createName }] : []),
  ]
  const open = phase !== "idle"
  const safeActive = options.length === 0 ? 0 : Math.min(active, options.length - 1)

  useEffect(() => {
    if (!open) return
    document.getElementById(`tracking-log-loc-opt-${safeActive}`)?.scrollIntoView?.({ block: "nearest" })
  }, [open, safeActive])

  const close = () => {
    setQuery("")
    setPhase("idle")
  }

  const commit = (id: string) => {
    onPenId(id)
    setQuery("")
    setPhase("idle")
  }

  const choose = (option: LocationChoice) => {
    if (option.kind === "pen") {
      commit(option.id)
      return
    }
    const id = ensureLocationPen(option.name)
    if (id) commit(id)
  }

  const openBrowse = () => {
    const index = pens.findIndex((pen) => pen.id === penId)
    setActive(index < 0 ? 0 : index)
    setPhase("browse")
    queueMicrotask(() => fieldRef.current?.select())
  }

  return (
    <div className="trk-logbook-location">
      <input
        ref={fieldRef}
        role="combobox"
        aria-label="Location"
        aria-expanded={open}
        aria-controls={open && options.length > 0 ? "tracking-log-location-list" : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? `tracking-log-loc-opt-${safeActive}` : undefined}
        placeholder="Location"
        autoComplete="off"
        value={value}
        onFocus={() => {
          if (phase !== "idle") return
          openBrowse()
        }}
        onClick={() => {
          if (phase === "idle") openBrowse()
          else if (phase === "browse") fieldRef.current?.select()
        }}
        onChange={(event) => {
          const next = event.target.value
          setQuery(next)
          setPhase("filter")
          setActive(0)
          if (!next.trim()) onPenId("")
        }}
        onBlur={() => {
          if (phase === "filter") {
            const typed = query.trim()
            const exact = pens.find((pen) => pen.name.trim().toLowerCase() === typed.toLowerCase())
            if (exact) onPenId(exact.id)
            else if (!typed) onPenId("")
          }
          close()
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            if (phase === "idle") {
              const index = pens.findIndex((pen) => pen.id === penId)
              const count = pens.length
              const start = index < 0 ? 0 : index
              const next =
                count === 0
                  ? 0
                  : event.key === "ArrowDown"
                    ? Math.min(start + (index < 0 ? 0 : 1), count - 1)
                    : Math.max(start - 1, 0)
              setActive(next)
              setPhase("browse")
              return
            }
            setActive((current) => {
              if (options.length === 0) return 0
              return event.key === "ArrowDown"
                ? Math.min(current + 1, options.length - 1)
                : Math.max(current - 1, 0)
            })
            return
          }
          if (event.key === "Enter") {
            event.preventDefault()
            if (phase === "idle") {
              openBrowse()
              return
            }
            const option = options[safeActive]
            if (option) choose(option)
            else close()
            return
          }
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            close()
          }
        }}
      />
      {open && options.length > 0 ? (
        <ul
          id="tracking-log-location-list"
          className="trk-logbook-location-menu"
          role="listbox"
          aria-label="Locations"
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li key={option.kind === "pen" ? option.id : "create"}>
              <button
                type="button"
                id={`tracking-log-loc-opt-${index}`}
                role="option"
                aria-selected={option.kind === "pen" && option.id === penId}
                data-active={index === safeActive ? "true" : "false"}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
              >
                {option.kind === "pen" ? option.name : `Create “${option.name}”`}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function LogRow({
  entry,
  copy,
  meta,
  onOpen,
  onRemove,
}: {
  entry: LogBookEntry
  copy?: string
  meta?: string
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  const clock = logClockLabel(entry)
  const shown = copy ? { ...entry, title: copy } : entry
  const scope = meta ? <span className="trk-log-scope">{meta}</span> : null
  if (clock.badge === "Unknown") {
    return (
      <div className="trk-log-row is-unknown">
        <span className="trk-logbook-badge">Unknown</span>
        <LogCopy entry={shown} />
        {scope}
        <button type="button" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="trk-log-row" onClick={() => onOpen(entry.id)}>
      {clock.time ? <span className="trk-log-when">{clock.time}</span> : null}
      <LogCopy entry={shown} />
      {scope}
      {clock.badge ? <span className="trk-logbook-badge">{clock.badge}</span> : null}
    </button>
  )
}

function LogListWell({
  title,
  note,
  rows,
  copyFor,
  metaFor,
  onOpen,
  onRemove,
}: {
  title: string
  note?: string
  rows: LogBookEntry[]
  copyFor?: (entry: LogBookEntry) => string
  metaFor?: (entry: LogBookEntry) => string
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
            <LogRow
              key={entry.id}
              entry={entry}
              copy={copyFor?.(entry)}
              meta={metaFor?.(entry)}
              onOpen={onOpen}
              onRemove={onRemove}
            />
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
  const dateKey = formatLocalDateKey(currentDate)

  const [mode, setMode] = useState<LogComposerMode>("event")
  const [intake, setIntake] = useState<IntakeClass>("food")
  const [title, setTitle] = useState("")
  const [switchFrom, setSwitchFrom] = useState("")
  const [switchTo, setSwitchTo] = useState("")
  const [switchScopeId, setSwitchScopeId] = useState("activity")
  const [estimated, setEstimated] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [timeValue, setTimeValue] = useState(() => defaultClock(currentDate))
  const [locationPenId, setLocationPenId] = useState("")
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

  const switchPens = useMemo(() => {
    return scopes.find((scope) => scope.id === switchScopeId)?.pens ?? []
  }, [scopes, switchScopeId])

  const grouped = useMemo(() => {
    const groups: Record<LogBookList, LogBookEntry[]> = {
      food: [],
      drink: [],
      drug: [],
      intake: [],
      event: [],
      switch: [],
      thought: [],
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
  const scopeName = (scopeId: string) => scopes.find((scope) => scope.id === scopeId)?.name ?? scopeId

  const stampNow = () => {
    const now = new Date()
    setTimeValue(minutesToTimeString(now.getHours() * 60 + now.getMinutes()))
    setUnknown(false)
  }

  const add = () => {
    const minute = timeStringToMinutes(timeValue)
    if (clock !== "unknown" && minute == null) return
    const id = submitTrackingLog({
      date: dateKey,
      title: mode === "switch" ? switchTo : title,
      mode,
      intakeClass: intake,
      clock,
      minute: minute ?? 0,
      locationPenId: mode === "event" ? locationPenId || undefined : undefined,
      switchFrom: mode === "switch" ? switchFrom : undefined,
      switchTo: mode === "switch" ? switchTo : undefined,
      scopeId: mode === "switch" ? switchScopeId : undefined,
    })
    if (!id) return
    setTitle("")
    if (mode === "switch") {
      setSwitchFrom("")
      setSwitchTo("")
    }
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
          {mode === "note" || mode === "thought" ? (
            <textarea
              aria-label={fieldLabel(mode)}
              placeholder={fieldPlaceholder(mode, intake)}
              rows={4}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          ) : mode === "switch" ? (
            <>
              <input
                aria-label="From"
                placeholder="email"
                value={switchFrom}
                list="tracking-log-switch-pens"
                onChange={(event) => setSwitchFrom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    add()
                  }
                }}
              />
              <input
                aria-label="To"
                placeholder="cleaning"
                value={switchTo}
                list="tracking-log-switch-pens"
                onChange={(event) => setSwitchTo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    add()
                  }
                }}
              />
              <label className="trk-logbook-view">
                View
                <select
                  aria-label="View"
                  value={switchScopeId}
                  onChange={(event) => setSwitchScopeId(event.target.value)}
                >
                  {scopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>
                      {scope.name}
                    </option>
                  ))}
                </select>
              </label>
              <datalist id="tracking-log-switch-pens">
                {switchPens.map((pen) => (
                  <option key={pen.id} value={pen.name} />
                ))}
              </datalist>
            </>
          ) : (
            <input
              aria-label={fieldLabel(mode)}
              placeholder={fieldPlaceholder(mode, intake)}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  add()
                }
              }}
            />
          )}
          {mode === "event" ? (
            <LocationField pens={locationPens} penId={locationPenId} onPenId={setLocationPenId} />
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
          <button type="button" onClick={add} disabled={mode === "switch" ? !switchTo.trim() : !title.trim()}>
            Add
          </button>
        </div>
      </section>

      <CountStatusesSection />

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

      <LogListWell
        title="Thought"
        note="The crystallized thought of this moment."
        rows={grouped.thought}
        onOpen={setOpenEntryId}
        onRemove={removeEntry}
      />

      {grouped.switch.length > 0 ? (
        <LogListWell
          title="Switch"
          rows={grouped.switch}
          copyFor={(entry) => switchLogCopy(entry, penName.get(entry.penId))}
          metaFor={(entry) => scopeName(entry.scopeId)}
          onOpen={setOpenEntryId}
          onRemove={removeEntry}
        />
      ) : null}

      <CycleLogSection date={dateKey} />

      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </div>
  )
}
