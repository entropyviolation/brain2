/**
 * components/Home/Tracking/tracking-log-view.tsx — Intake, events, cycle; Day | Week
 *
 * Follows the Tracking day cursor. Local Day | Week (default Day; not persisted)
 * mirrors Day Log. Week replaces the day shelves with a seven-column board;
 * the composer still writes the selected day. The composer is one row of modes:
 * Event, Switch, Intake, Spent, Note, Thought process. Spent asks for an amount,
 * what it was spent on, and the source. Event’s location is one field over
 * the Location pens. Note and Thought process are a few-line textarea; the other
 * modes stay one line. A thought process is a guiding strand of this moment,
 * stored as `eventKind` `thought-process`, and listed under Thought process.
 * Food, drink, and drugs are Intake presets on an Intake-pen instant.
 * Note is the opening key. It paints a Text log instant and does not append
 * onto a covering block. Notes is its own steel shelf. Each day shelf except
 * Spent and Switch has a bottom add for this minute; Spent focuses the composer.
 * Week columns stay browse-only. A shelf dialog can widen the day.
 * The clock stays visible. Custom phrases are added in Tracking settings
 * (the gear), not on this composer. Counts sits under the composer.
 * Estimated and Unknown are checkboxes. Cycle marks
 * label a phase from bleed days and ovulation; spotting is recorded and does
 * not change that label. The cycle section renders only when Enable cycle
 * tracking is on.
 *
 * Desk look (docs/TRACKING_REDESIGN.md): the date sits in a CRT with the
 * day's readouts (Spent, Intake, Events, Notes, Thoughts) beside it. The composer is
 * one console: mode keys, then the fields. Intake shows a **Recent** row of
 * your most-used foods / drinks / drugs for the chosen class — one click fills
 * the name field (it does not log); Add writes it. Every successful Add raises
 * the floating bottom-right flag ("COFFEE · INTAKE LOGGED · 14:43"), X to close,
 * gone after one minute. Spent has a large dollar field, source keys built
 * from your history (cash, card, …), and recent purchases that refill the
 * form in one tap. The day's shelves sit on a multi-column board; the Spent
 * shelf carries a small ledger with bars per source and per thing.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { addDays, addWeeks, format, subDays, subWeeks } from "date-fns"
import { CountStatusesSection } from "@/components/Home/Tracking/count-statuses-section"
import { CycleLogSection } from "@/components/Home/Tracking/cycle-log-section"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { LogShelfDialog } from "@/components/Home/Tracking/log-shelf-dialog"
import { SpendingDialog } from "@/components/Home/Tracking/spending-dialog"
import { TrackingLogWeek } from "@/components/Home/Tracking/tracking-log-week"
import { TelegramFeedWell } from "@/components/Home/Tracking/telegram-feed-well"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import {
  LOCATION_SCOPE_ID,
  asLogEntry,
  classifyLogBookRow,
  compareLogRows,
  ensureLocationPen,
  logClockLabel,
  logRowWhenLabel,
  submitTrackingLog,
  switchLogCopy,
  type IntakeClass,
  type LogBookEntry,
  type LogBookList,
  type LogClockChoice,
  type LogComposerMode,
  loggedFlag,
  recentIntakeByClass,
} from "@/components/Home/Tracking/tracking-log-model"

export { loggedFlag }
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { formatSpendAmount, parseSpendAmount, spendSourceOptions, summarizeSpend } from "@/lib/spend"
import { materializeMissingFeedLogs } from "@/lib/ingest/file-feed-row"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ScopeReadout } from "@/components/Home/Tracking/trk-scope"
import { minutesToTimeString, timeStringToMinutes } from "@/lib/time-entries"
import { raiseQuickAddWrote } from "@/components/quick-add-wrote"
import { getTrackingViewPrefs, useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import "./tracking-chrome.css"
import "./daylog-week.css"
import { NativeSelect } from "@/components/ui/native-select"

const MODES: { id: LogComposerMode; label: string }[] = [
  { id: "event", label: "Event" },
  { id: "switch", label: "Switch" },
  { id: "intake", label: "Intake" },
  { id: "spend", label: "Spent" },
  { id: "note", label: "Note" },
  { id: "thought", label: "Thought process" },
]

const INTAKE_PRESETS: { id: IntakeClass; label: string; placeholder: string }[] = [
  { id: "food", label: "Food", placeholder: "coffee" },
  { id: "drink", label: "Drink", placeholder: "water" },
  { id: "drug", label: "Drug", placeholder: "name" },
]

const INTAKE_LISTS: { id: IntakeClass; title: string }[] = [
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
  if (mode === "thought") return "Thought process"
  if (mode === "intake") return "Name"
  return "Title"
}

function fieldPlaceholder(mode: LogComposerMode, intake: IntakeClass): string {
  if (mode === "thought") return "A strand from what you are doing, to what it leads to, to how it feels."
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
  lead,
  showDate,
  onOpen,
  onRemove,
}: {
  entry: LogBookEntry
  copy?: string
  meta?: string
  lead?: ReactNode
  showDate?: boolean
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  const clock = logClockLabel(entry)
  const dated = showDate ? logRowWhenLabel(entry, { showDate: true }) : null
  const timeText = dated ? dated.when : clock.time
  const badge = dated?.badge ?? clock.badge
  const shown = copy ? { ...entry, title: copy } : entry
  const scope = meta ? <span className="trk-log-scope">{meta}</span> : null
  if (badge === "Unknown") {
    return (
      <div className="trk-log-row is-unknown">
        {timeText ? <span className="trk-log-when">{timeText}</span> : null}
        <span className="trk-logbook-badge">Unknown</span>
        {lead}
        <LogCopy entry={shown} />
        {scope}
        <button type="button" onClick={() => onOpen(entry.id)}>
          Edit
        </button>
        <button type="button" onClick={() => onRemove(entry.id)}>
          Remove
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="trk-log-row" onClick={() => onOpen(entry.id)}>
      {timeText ? <span className="trk-log-when">{timeText}</span> : null}
      {lead}
      <LogCopy entry={shown} />
      {scope}
      {badge ? <span className="trk-logbook-badge">{badge}</span> : null}
    </button>
  )
}

const EMPTY_SHELF: Record<string, string> = {
  Food: "Nothing eaten this day.",
  Drink: "Nothing drunk this day.",
  Drugs: "Nothing taken this day.",
  Intake: "No other intake this day.",
  Events: "No events this day.",
  Notes: "No notes this day.",
  "Thought process": "No thought process this day.",
  Switch: "No switches this day.",
  Spent: "Nothing spent this day.",
}

function LogListWell({
  title,
  note,
  rows,
  extra,
  copyFor,
  metaFor,
  leadFor,
  face,
  onTitleOpen,
  quickAdd,
  onOpen,
  onRemove,
}: {
  title: string
  note?: string
  rows: LogBookEntry[]
  extra?: ReactNode
  copyFor?: (entry: LogBookEntry) => string
  metaFor?: (entry: LogBookEntry) => string
  leadFor?: (entry: LogBookEntry) => ReactNode
  /** `steel` — the light well with black text, as in the Now popup. Default is the CRT shelf. */
  face?: "steel"
  /** Makes the heading a button, such as Spent opening the Spending dialog. */
  onTitleOpen?: () => void
  /** Bottom of the well. Week columns do not mount this shelf. */
  quickAdd?: ReactNode
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <section className="trk-aside-well" aria-label={title} data-empty={rows.length === 0 ? "true" : "false"} data-face={face}>
      <h3 className="trk-logbook-heading">
        {onTitleOpen ? (
          <button type="button" className="trk-logbook-heading-open" onClick={onTitleOpen} title={`Open ${title.toLowerCase()}`}>
            {title}
            <span aria-hidden="true"> ›</span>
          </button>
        ) : (
          title
        )}
        {rows.length > 0 ? (
          <span className="trk-logbook-count" aria-hidden="true">
            {rows.length}
          </span>
        ) : null}
      </h3>
      {note ? <p className="trk-logbook-note">{note}</p> : null}
      {extra}
      {rows.length === 0 ? (
        <p className="trk-logbook-note trk-logbook-empty">{EMPTY_SHELF[title] ?? "Nothing logged this day."}</p>
      ) : (
        <div className="trk-log">
          {rows.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              copy={copyFor?.(entry)}
              meta={metaFor?.(entry)}
              lead={leadFor?.(entry)}
              onOpen={onOpen}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      {quickAdd}
    </section>
  )
}

function LogShelfQuickAdd({
  label,
  placeholder,
  onAdd,
}: {
  label: string
  placeholder: string
  onAdd: (text: string) => boolean
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState("")

  function add() {
    if (!onAdd(text)) return
    setText("")
    if (fieldRef.current) fieldRef.current.style.height = ""
  }

  return (
    <div className="trk-logbook-well-add">
      <textarea
        ref={fieldRef}
        aria-label={label}
        rows={1}
        value={text}
        placeholder={placeholder}
        title="Enter adds this line. Shift+Enter starts another line."
        onChange={(event) => {
          setText(event.target.value)
          const el = event.currentTarget
          el.style.height = "0px"
          el.style.height = `${el.scrollHeight}px`
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.shiftKey) return
          event.preventDefault()
          add()
        }}
      />
      <button type="button" aria-label={label} onClick={add} disabled={!text.trim()}>
        Add
      </button>
    </div>
  )
}

function LedgerBars({ title, rows, total }: { title: string; rows: { label: string; amount: number }[]; total: number }) {
  return (
    <div className="trk-ledger-bars" aria-label={title}>
      {rows.map((row) => (
        <div key={row.label} className="trk-ledger-bar">
          <span className="trk-ledger-label">{row.label}</span>
          <span className="trk-ledger-track" aria-hidden>
            <i style={{ width: `${Math.max(4, (row.amount / total) * 100)}%` }} />
          </span>
          <span className="trk-ledger-amount">{formatSpendAmount(row.amount)}</span>
        </div>
      ))}
    </div>
  )
}

function SpendLedger({ rows }: { rows: LogBookEntry[] }) {
  const summary = summarizeSpend(rows)
  if (summary.total <= 0) return null
  return (
    <div className="trk-logbook-ledger" aria-label="Spent this day">
      <p>
        <span className="trk-logbook-spent-total">{formatSpendAmount(summary.total)}</span> spent this day
      </p>
      <p className="sr-only">{summary.bySource.map((row) => `${row.label} ${formatSpendAmount(row.amount)}`).join(" · ")}</p>
      <LedgerBars title="By source" rows={summary.bySource} total={summary.total} />
      {summary.byWhat.length > 1 ? <LedgerBars title="By thing" rows={summary.byWhat} total={summary.total} /> : null}
    </div>
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

  // Tracking settings → Tracking log: opening key, span, Recent chips, and the logged flag.
  const viewPrefs = useTrackingViewPrefs()
  const [mode, setMode] = useState<LogComposerMode>(() => getTrackingViewPrefs().logDefaultMode)
  const [intake, setIntake] = useState<IntakeClass>("food")
  const [title, setTitle] = useState("")
  const [spendAmount, setSpendAmount] = useState("")
  const [spendOn, setSpendOn] = useState("")
  const [spendSource, setSpendSource] = useState("")
  const [switchFrom, setSwitchFrom] = useState("")
  const [switchTo, setSwitchTo] = useState("")
  const [switchScopeId, setSwitchScopeId] = useState("activity")
  const [estimated, setEstimated] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [timeValue, setTimeValue] = useState(() => defaultClock(currentDate))
  const [locationPenId, setLocationPenId] = useState("")
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [spendingOpen, setSpendingOpen] = useState(false)
  const [shelf, setShelf] = useState<string | null>(null)
  const feedRows = useTelegramFeedStore((s) => s.rows)
  const ingestEvents = useIngestStore((s) => s.events)
  useEffect(() => {
    if (feedRows.length === 0) return
    materializeMissingFeedLogs(ingestEvents)
  }, [feedRows, ingestEvents])
  const nameFieldRef = useRef<HTMLInputElement | null>(null)
  const composeRef = useRef<HTMLElement | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)
  const [span, setSpan] = useState<"day" | "week">(() => getTrackingViewPrefs().logSpan)
  const isWeek = lockDate ? false : span === "week"
  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekDates[6], "MMM d, yyyy")}`

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

  const allGrouped = useMemo(() => {
    const groups: Record<LogBookList, LogBookEntry[]> = {
      food: [],
      drink: [],
      drug: [],
      intake: [],
      event: [],
      note: [],
      switch: [],
      thought: [],
      spend: [],
    }
    for (const entry of entries) {
      const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
      if (!row) continue
      groups[row.list].push(row)
    }
    for (const list of Object.keys(groups) as LogBookList[]) groups[list].sort(compareLogRows)
    return groups
  }, [entries, penName])

  const grouped = useMemo(() => {
    const groups = {} as Record<LogBookList, LogBookEntry[]>
    for (const list of Object.keys(allGrouped) as LogBookList[]) {
      groups[list] = allGrouped[list].filter((row) => row.date === dateKey)
    }
    return groups
  }, [allGrouped, dateKey])

  // Recent intake by class (most used first) and recent purchases, across every day.
  const recents = useMemo(() => {
    const intake = recentIntakeByClass(entries, penName)
    const buys: { amount: number; on: string; source: string; when: string }[] = []
    for (const entry of entries) {
      const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
      if (!row) continue
      const when = `${entry.date} ${String(entry.startMin).padStart(4, "0")}`
      if (row.list === "spend" && typeof row.spendAmount === "number") {
        buys.push({ amount: row.spendAmount, on: row.spendOn?.trim() || row.title?.trim() || "", source: row.spendSource?.trim() || "", when })
      }
    }
    buys.sort((a, b) => b.when.localeCompare(a.when))
    const seen = new Set<string>()
    const purchases = buys.filter((buy) => {
      const key = `${buy.on.toLowerCase()}|${buy.amount}|${buy.source.toLowerCase()}`
      if (!buy.on || seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { intake, purchases: purchases.slice(0, 6) }
  }, [entries, penName])

  const intakeCount = grouped.food.length + grouped.drink.length + grouped.drug.length + grouped.intake.length
  const spentToday = summarizeSpend(grouped.spend).total

  const clock: LogClockChoice = unknown ? "unknown" : estimated ? "estimated" : "exact"
  const openEntry = openEntryId ? entries.find((entry) => entry.id === openEntryId) : undefined
  const scopeName = (scopeId: string) => scopes.find((scope) => scope.id === scopeId)?.name ?? scopeId
  const parsedSpend = parseSpendAmount(spendAmount)
  const spendReady = parsedSpend != null && spendOn.trim().length > 0 && spendSource.trim().length > 0
  const sourceOptions = useMemo(() => spendSourceOptions(entries), [entries])

  const add = () => {
    const minute = timeStringToMinutes(timeValue)
    if (clock !== "unknown" && minute == null) return
    const id = submitTrackingLog({
      date: dateKey,
      title: mode === "switch" ? switchTo : mode === "spend" ? spendOn : title,
      mode,
      intakeClass: intake,
      clock,
      minute: minute ?? 0,
      locationPenId: mode === "event" ? locationPenId || undefined : undefined,
      switchFrom: mode === "switch" ? switchFrom : undefined,
      switchTo: mode === "switch" ? switchTo : undefined,
      scopeId: mode === "switch" ? switchScopeId : undefined,
      spendAmount: mode === "spend" ? (parsedSpend ?? undefined) : undefined,
      spendOn: mode === "spend" ? spendOn : undefined,
      spendSource: mode === "spend" ? spendSource : undefined,
    })
    if (!id) return
    if (viewPrefs.logFlagOnAdd) raiseQuickAddWrote(loggedFlag(mode, intake, mode === "switch" ? switchTo : mode === "spend" ? spendOn : title, clock, timeValue, parsedSpend))
    setTitle("")
    if (mode === "switch") {
      setSwitchFrom("")
      setSwitchTo("")
    }
    if (mode === "spend") {
      setSpendAmount("")
      setSpendOn("")
      setSpendSource("")
    }
  }

  /** A Recent chip only fills the name. Add (or Enter) logs it. */
  const fillIntakeName = (name: string) => {
    setTitle(name)
    window.requestAnimationFrame(() => {
      const field = nameFieldRef.current
      if (!field) return
      field.focus()
      field.setSelectionRange(name.length, name.length)
    })
  }

  const canAdd = mode === "switch" ? Boolean(switchTo.trim()) : mode === "spend" ? spendReady : Boolean(title.trim())

  const addShelfLine = (shelfMode: LogComposerMode, text: string, intakeClass?: IntakeClass) => {
    const minute = timeStringToMinutes(defaultClock(currentDate))
    if (minute == null) return false
    const id = submitTrackingLog({
      date: dateKey,
      title: text,
      mode: shelfMode,
      intakeClass,
      clock: "exact",
      minute,
      logSource: "tracking-shelf-now",
    })
    return Boolean(id)
  }

  const focusSpentComposer = () => {
    setMode("spend")
    composeRef.current?.scrollIntoView({ block: "nearest" })
    window.setTimeout(() => amountRef.current?.focus(), 0)
  }

  const openDayFromWeek = (date: Date) => {
    setCurrentDate(date)
    setSpan("day")
  }

  return (
    <div className="trk95 trk-canvas trk-logbook" data-ui-name="Tracking log" data-testid="tracking-log-view">
      <TrackingPeriodNav
        label={
          isWeek
            ? weekLabel
            : currentDate.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })
        }
        previousLabel={isWeek ? "Previous week" : "Previous day"}
        nextLabel={isWeek ? "Next week" : "Next day"}
        onPrevious={() => setCurrentDate(isWeek ? subWeeks(currentDate, 1) : subDays(currentDate, 1))}
        onNext={() => setCurrentDate(isWeek ? addWeeks(currentDate, 1) : addDays(currentDate, 1))}
        onToday={() => setCurrentDate(new Date())}
        locked={lockDate}
        variant="crt"
        readouts={
          isWeek ? undefined : (
            <>
              <ScopeReadout label="Spent" value={formatSpendAmount(spentToday)} />
              <ScopeReadout label="Intake" value={intakeCount} />
              <ScopeReadout label="Events" value={grouped.event.length} />
              <ScopeReadout label="Notes" value={grouped.note.length} />
              <ScopeReadout label="Thoughts" value={grouped.thought.length} />
            </>
          )
        }
      />

      {!lockDate ? (
        <div className="daylog-week-switch trk-span-switch" role="toolbar" aria-label="Tracking log span">
          <button type="button" aria-pressed={!isWeek} onClick={() => setSpan("day")}>
            Day
          </button>
          <button type="button" aria-pressed={isWeek} onClick={() => setSpan("week")}>
            Week
          </button>
        </div>
      ) : null}

      <div className="trk-logbook-inputs">
      <section ref={composeRef} className="trk-aside-well trk-logbook-compose" aria-label="Add to the tracking log">
        <h3 className="trk-logbook-heading">Add a line</h3>
        <div className="trk-span-switch trk-logbook-modes" role="toolbar" aria-label="What to log">
          {MODES.map((row) => (
            <button key={row.id} type="button" data-no95="" aria-pressed={mode === row.id} onClick={() => setMode(row.id)}>
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
                  data-no95=""
                  aria-pressed={intake === row.id}
                  onClick={() => setIntake(row.id)}
                >
                  {row.label}
                </button>
              ))}
            </div>
            {viewPrefs.logShowRecents && recents.intake[intake].length ? (
              <div className="trk-logbook-quick" role="group" aria-label="Recent intake">
                <span className="trk-logbook-quick-label">Recent</span>
                {recents.intake[intake].map((row) => (
                  <button
                    key={row.title}
                    type="button"
                    data-no95=""
                    className="trk-logbook-chip"
                    aria-pressed={title.trim().toLowerCase() === row.title.toLowerCase()}
                    title={`Use “${row.title}” as the name · ${row.count}× before. Press Add to log it.`}
                    onClick={() => fillIntakeName(row.title)}
                  >
                    <span className="trk-logbook-chip-name">{row.title}</span>
                    <span className="trk-logbook-chip-count" aria-hidden>
                      {row.count}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
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
                <NativeSelect
                  aria-label="View"
                  value={switchScopeId}
                  onChange={(event) => setSwitchScopeId(event.target.value)}
                >
                  {scopes.map((scope) => (
                    <option key={scope.id} value={scope.id}>
                      {scope.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <datalist id="tracking-log-switch-pens">
                {switchPens.map((pen) => (
                  <option key={pen.id} value={pen.name} />
                ))}
              </datalist>
            </>
          ) : mode === "spend" ? (
            <div className="trk-logbook-money">
              <label className="trk-logbook-field">
                <span>Amount</span>
                <span className="trk-logbook-amount">
                  <span aria-hidden="true">$</span>
                  <input
                    ref={amountRef}
                    aria-label="Amount"
                    inputMode="decimal"
                    placeholder="4.50"
                    value={spendAmount}
                    onChange={(event) => setSpendAmount(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        add()
                      }
                    }}
                  />
                </span>
              </label>
              <label className="trk-logbook-field">
                <span>On</span>
                <input
                  aria-label="On"
                  placeholder="coffee"
                  value={spendOn}
                  onChange={(event) => setSpendOn(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      add()
                    }
                  }}
                />
              </label>
              <label className="trk-logbook-field">
                <span>Source</span>
                <input
                  aria-label="Source"
                  placeholder="cash, card, account, person"
                  list="tracking-log-spend-sources"
                  value={spendSource}
                  onChange={(event) => setSpendSource(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      add()
                    }
                  }}
                />
              </label>
              <datalist id="tracking-log-spend-sources">
                {sourceOptions.map((source) => (
                  <option key={source} value={source} />
                ))}
              </datalist>
              {sourceOptions.length ? (
                <div className="trk-logbook-quick" role="group" aria-label="Sources">
                  <span className="trk-logbook-quick-label">Paid with</span>
                  {sourceOptions.slice(0, 8).map((source) => (
                    <button
                      key={source}
                      type="button"
                      data-no95=""
                      className="trk-logbook-chip"
                      aria-pressed={spendSource.trim().toLowerCase() === source.toLowerCase()}
                      onClick={() => setSpendSource(source)}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              ) : null}
              {viewPrefs.logShowRecents && recents.purchases.length ? (
                <div className="trk-logbook-quick" role="group" aria-label="Recent purchases">
                  <span className="trk-logbook-quick-label">Again</span>
                  {recents.purchases.map((buy) => (
                    <button
                      key={`${buy.on}|${buy.amount}|${buy.source}`}
                      type="button"
                      data-no95=""
                      className="trk-logbook-chip"
                      title="Fill the form with this purchase — press Add to log it"
                      onClick={() => {
                        setSpendAmount((buy.amount / 100).toFixed(2)) // stored in cents
                        setSpendOn(buy.on)
                        setSpendSource(buy.source)
                      }}
                    >
                      {buy.on} · {formatSpendAmount(buy.amount)}
                      {buy.source ? <span className="trk-logbook-chip-count">{buy.source}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <input
              ref={nameFieldRef}
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
          {mode === "spend" && spendAmount.trim() && parsedSpend == null ? (
            <p className="trk-logbook-note trk-logbook-hint">Amount is dollars and cents, such as 4.50.</p>
          ) : null}
          <ClockPicker aria-label="Time of day" value={timeValue} onChange={setTimeValue} />
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
          <button type="button" onClick={add} disabled={!canAdd}>
            Add
          </button>
        </div>
      </section>

      <CountStatusesSection />
      </div>

      {isWeek ? (
        <TrackingLogWeek
          currentDate={currentDate}
          onOpenDay={openDayFromWeek}
          onOpenEntry={setOpenEntryId}
          onRemoveEntry={removeEntry}
        />
      ) : (
        <div className="trk-logbook-board">
          <LogListWell
            title="Spent"
            note="Amount, what it was spent on, and the source."
            rows={grouped.spend}
            extra={<SpendLedger rows={grouped.spend} />}
            onTitleOpen={() => setSpendingOpen(true)}
            quickAdd={
              <div className="trk-logbook-well-add">
                <button type="button" onClick={focusSpentComposer}>
                  Add spent now
                </button>
              </div>
            }
            copyFor={(entry) => entry.spendOn?.trim() || entry.title?.trim() || "Untitled"}
            metaFor={(entry) => entry.spendSource?.trim() || ""}
            leadFor={(entry) =>
              typeof entry.spendAmount === "number" ? (
                <span className="trk-log-amount">{formatSpendAmount(entry.spendAmount)}</span>
              ) : null
            }
            onOpen={setOpenEntryId}
            onRemove={removeEntry}
          />

          {INTAKE_LISTS.map((list) => (
            <LogListWell
              key={list.id}
              title={list.title}
              rows={grouped[list.id]}
              onTitleOpen={() => setShelf(list.id)}
              quickAdd={
                <LogShelfQuickAdd
                  label={`Add to ${list.title}`}
                  placeholder={INTAKE_PRESETS.find((row) => row.id === list.id)?.placeholder ?? "coffee"}
                  onAdd={(text) => addShelfLine("intake", text, list.id)}
                />
              }
              onOpen={setOpenEntryId}
              onRemove={removeEntry}
            />
          ))}

          {grouped.intake.length > 0 ? (
            <LogListWell
              title="Intake"
              note="Intake with no food, drink, or drug class."
              rows={grouped.intake}
              onTitleOpen={() => setShelf("intake")}
              quickAdd={
                <LogShelfQuickAdd
                  label="Add to Intake"
                  placeholder="name"
                  onAdd={(text) => addShelfLine("intake", text)}
                />
              }
              onOpen={setOpenEntryId}
              onRemove={removeEntry}
            />
          ) : null}

          <LogListWell
            title="Events"
            note="Any repeated phrase can be counted later. Example: left room."
            rows={grouped.event}
            face="steel"
            onTitleOpen={() => setShelf("event")}
            quickAdd={
              <LogShelfQuickAdd label="Add to Events" placeholder="left room" onAdd={(text) => addShelfLine("event", text)} />
            }
            onOpen={setOpenEntryId}
            onRemove={removeEntry}
          />

          <LogListWell
            title="Notes"
            note="A general note for this minute. Example: landlord called back."
            rows={grouped.note}
            face="steel"
            onTitleOpen={() => setShelf("note")}
            quickAdd={
              <LogShelfQuickAdd
                label="Add to Notes"
                placeholder="landlord called back"
                onAdd={(text) => addShelfLine("note", text)}
              />
            }
            onOpen={setOpenEntryId}
            onRemove={removeEntry}
          />

          <LogListWell
            title="Thought process"
            note="A strand from what you are doing, to what it leads to, to how it feels."
            rows={grouped.thought}
            face="steel"
            onTitleOpen={() => setShelf("thought")}
            quickAdd={
              <LogShelfQuickAdd
                label="Add to Thought process"
                placeholder="A strand from what you are doing…"
                onAdd={(text) => addShelfLine("thought", text)}
              />
            }
            onOpen={setOpenEntryId}
            onRemove={removeEntry}
          />

          {grouped.switch.length > 0 ? (
            <LogListWell
              title="Switch"
              rows={grouped.switch}
              copyFor={(entry) => switchLogCopy(entry, penName.get(entry.penId))}
              metaFor={(entry) => scopeName(entry.scopeId)}
              onTitleOpen={() => setShelf("switch")}
              onOpen={setOpenEntryId}
              onRemove={removeEntry}
            />
          ) : null}

          <TelegramFeedWell dayKey={dateKey} />
        </div>
      )}

      <CycleLogSection date={dateKey} />

      {(
        [
          ["food", "Food", allGrouped.food, "What was eaten this day."],
          ["drink", "Drink", allGrouped.drink, "What was drunk this day."],
          ["drug", "Drugs", allGrouped.drug, "What was taken this day."],
          ["intake", "Intake", allGrouped.intake, "Intake with no food, drink, or drug class."],
          ["event", "Events", allGrouped.event, "Any repeated phrase can be counted later. Example: left room."],
          ["note", "Notes", allGrouped.note, "A general note for this minute. Example: landlord called back."],
          ["thought", "Thought process", allGrouped.thought, "A strand from what you are doing, to what it leads to, to how it feels."],
          ["switch", "Switch", allGrouped.switch, "From one thing to the next."],
        ] as const
      ).map(([id, title, rows, note]) => (
        <LogShelfDialog
          key={id}
          open={shelf === id}
          onOpenChange={(next) => setShelf(next ? id : null)}
          title={title}
          description={note}
          anchor={currentDate}
          entries={rows}
          renderEntry={(entry, showDate) => (
            <LogRow
              key={entry.id}
              entry={entry}
              showDate={showDate}
              copy={id === "switch" ? switchLogCopy(entry, penName.get(entry.penId)) : undefined}
              meta={id === "switch" ? scopeName(entry.scopeId) : undefined}
              onOpen={setOpenEntryId}
              onRemove={removeEntry}
            />
          )}
        >
          <p className="trk-shelf-empty">{EMPTY_SHELF[title] ?? "Nothing logged this day."}</p>
        </LogShelfDialog>
      ))}

      <SpendingDialog
        open={spendingOpen}
        onOpenChange={setSpendingOpen}
        dayLabel={currentDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        ledger={<SpendLedger rows={grouped.spend} />}
        anchor={currentDate}
        rows={allGrouped.spend}
      />
      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </div>
  )
}
