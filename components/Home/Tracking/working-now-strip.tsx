/**
 * components/Home/Tracking/working-now-strip.tsx — Operations clock on Tracking
 *
 * The same "Working on this now" control as the operation workspace. On Home
 * Tracking it sits in `.trk-now-module` directly under the Time Grid / Activity
 * Log / Day Log switcher, shared by all three, so a session started here still
 * paints those views. Search an operation, or type a new name and create it, then start; the toggle becomes **Stop working on
 * {name}** and the minutes stay editable like any other block. While a session
 * is live, a dashed steel **usually ~N** chip shows the median of past
 * `timeLogs` / unflagged `actualDuration` for that title or type.
 * Tracking tags show as catalog beads; double-click opens tag settings.
 * `compact` is the desk's one NOW row: no own lamp, a short Start / Stop key,
 * and the tags line moves into the tooltip.
 */
"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Wand2 } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { selectOperations } from "@/lib/operations"
import { getOperationTrackingTagIds } from "@/lib/operation-types"
import { activeTrackingLink } from "@/lib/habit-tracking"
import {
  addWorkCompletedObjective,
  addWorkNowObjective,
  attachWorkNowObjective,
  editWorkNowObjectiveText,
  formatElapsedClock,
  removeWorkNowObjective,
  saveWorkObjectiveForLater,
  sessionElapsedMs,
  toggleWorkNowObjectiveComplete,
  toggleWorkingOnOperation,
} from "@/lib/operation-work-session"
import { useWorkSessionClock } from "@/components/Operations/WorkingNowControl"
import { formatUsualDuration, usualDurationMinutes } from "@/lib/estimated-values"
import { CatalogTagLabel } from "@/components/Home/Tracking/catalog-tag-chip"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { reviewWorkStop } from "@/lib/session-debrief"
import { activeNowObjectives } from "@/lib/now-objective"
import { attachChoicesForOperation } from "@/lib/unfinished-objectives"
import { createOperation } from "@/components/Operations/operation-actions"
import "@/components/Operations/operations-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"

type OpRow = { kind: "op"; id: string; label: string } | { kind: "create"; id: "create"; label: string }

export function WorkingNowStrip({ compact = false }: { compact?: boolean } = {}) {
  const tasks = useTaskStore((s) => s.tasks)
  const tags = useTimeTrackingStore((s) => s.tags)
  const habits = useHabitsStore((s) => s.tasks)
  const operations = useMemo(() => selectOperations(tasks), [tasks])
  const { session, now } = useWorkSessionClock()
  const listId = useId()
  const [pickedId, setPickedId] = useState(session?.operationId ?? operations[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const selectedId = session?.operationId || pickedId || operations[0]?.id || ""
  const selected = operations.find((op) => op.id === selectedId)
  const tagIds = selected ? getOperationTrackingTagIds(selected) : []
  const opTags = tags.filter((t) => tagIds.includes(t.id))
  const fedHabits = habits.filter((habit) => {
    const link = activeTrackingLink(habit)
    return link ? link.tagIds.some((id) => tagIds.includes(id)) : false
  })

  const live = Boolean(session)
  const elapsed = session ? formatElapsedClock(sessionElapsedMs(session, now)) : null
  const usual = live && selected ? usualDurationMinutes(tasks, selected) : null
  const attachChoices = useMemo(
    () => (session ? attachChoicesForOperation(tasks, session.operationId) : []),
    [tasks, session],
  )
  const unfinished = useUnfinishedStop(activeNowObjectives(session?.nowObjectives).length, (park) =>
    reviewWorkStop(park),
  )
  const needle = query.trim().toLowerCase()
  const draft = query.trim()
  const rows = useMemo(() => {
    if (!menuOpen) return [] as OpRow[]
    const found: OpRow[] = operations
      .filter((op) => !needle || op.description.toLowerCase().includes(needle))
      .slice(0, 12)
      .map((op) => ({ kind: "op", id: op.id, label: op.description }))
    const taken = operations.some((op) => op.description.trim().toLowerCase() === draft.toLowerCase())
    if (draft && !taken) found.push({ kind: "create", id: "create", label: draft })
    return found
  }, [operations, needle, draft, menuOpen])

  const pick = (id: string) => {
    setPickedId(id)
    setQuery("")
    setMenuOpen(false)
  }

  const createNamed = (name: string) => {
    const op = createOperation(name)
    pick(op.id)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setQuery("")
      setMenuOpen(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [menuOpen])

  const keepOpen = (event: { currentTarget: HTMLElement }) => {
    const root = event.currentTarget.closest(".ops-now-bar")
    window.setTimeout(() => {
      if (root?.contains(document.activeElement)) return
      setMenuOpen(false)
    }, 150)
  }

  const fieldValue = menuOpen ? query : selected?.description ?? ""

  return (
    <div
      className={`ops-now-bar b2-now${live ? " live" : ""}${compact ? " is-compact" : ""}`}
      title={
        compact
          ? opTags.length > 0
            ? `Tags: ${opTags.map((t) => t.name).join(", ")}${fedHabits.length > 0 ? ` · feeds ${fedHabits.map((h) => h.name).join(", ")}` : ""}`
            : "No tracking tags — set them on the operation in Settings."
          : undefined
      }
    >
      {compact ? null : <span className={`ops-now-led${live ? " live" : ""}`} aria-hidden />}
      <label>
        {compact ? <span className="sr-only">Working on</span> : <span className="ops-now-kicker">Working on</span>}
        {live ? (
          <input
            className="ops-now-field"
            role="combobox"
            aria-label="Operation to work on"
            aria-expanded={false}
            value={selected?.description ?? ""}
            disabled
          />
        ) : (
          <input
            className="ops-now-field"
            role="combobox"
            aria-label="Operation to work on"
            aria-expanded={menuOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            value={fieldValue}
            placeholder="Search or create an operation"
            onFocus={() => {
              setQuery("")
              setMenuOpen(true)
              setHighlight(0)
            }}
            onChange={(event) => {
              setQuery(event.target.value)
              setMenuOpen(true)
              setHighlight(0)
            }}
            onBlur={keepOpen}
            onKeyDown={(event) => {
              if (!menuOpen && (event.key === "ArrowDown" || event.key === "Enter")) {
                setMenuOpen(true)
                setHighlight(0)
                return
              }
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setHighlight((index) => Math.min(index + 1, Math.max(0, rows.length - 1)))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setHighlight((index) => Math.max(index - 1, 0))
              } else if (event.key === "Enter") {
                event.preventDefault()
                const row = rows[highlight]
                if (!row) return
                if (row.kind === "create") createNamed(row.label)
                else pick(row.id)
              } else if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                setQuery("")
                setMenuOpen(false)
              }
            }}
          />
        )}
      </label>
      {menuOpen && !live ? (
        <div className="ops-now-pop">
          <ul id={listId} className="ops-now-list" role="listbox" aria-label="Operations">
            {rows.length === 0 ? (
              <li className="ops-now-empty">{needle ? "No operations match." : "Type a name to find an operation, or to create one."}</li>
            ) : (
              rows.map((row, index) => (
                <li key={row.kind === "create" ? "create" : row.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={row.kind === "op" && row.id === selectedId}
                    data-active={index === highlight ? "true" : "false"}
                    className={row.kind === "create" ? "ops-now-option is-create" : "ops-now-option"}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => (row.kind === "create" ? createNamed(row.label) : pick(row.id))}
                  >
                    {row.kind === "create" ? `Create “${row.label}”` : row.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
      {live && elapsed && <span className="ops-now-elapsed">{elapsed}</span>}
      {live && session && (
        <NowObjectivesList
          objectives={session.nowObjectives}
          contextName={selected?.description}
          onAdd={(text) => addWorkNowObjective(text)}
          onAddCompleted={(text) => addWorkCompletedObjective(text)}
          onEditText={(id, text) => editWorkNowObjectiveText(id, text)}
          onToggleComplete={(id) => toggleWorkNowObjectiveComplete(id)}
          onRemove={(id) => removeWorkNowObjective(id)}
          onSaveForLater={(id) => saveWorkObjectiveForLater(id)}
          onAttach={(id, target) => attachWorkNowObjective(id, target)}
          attachChoices={attachChoices}
        />
      )}
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
        className={`todo-cap${live ? "" : " is-primary"}`}
        disabled={!selected}
        aria-label={live && selected ? `Stop working on ${selected.description}` : "Working on this now"}
        onClick={() => {
          if (!selected) return
          if (live) unfinished.request()
          else toggleWorkingOnOperation(selected.id)
        }}
      >
        {compact
          ? live
            ? "■ Stop"
            : "▶ Start"
          : live && selected
            ? `Stop working on ${selected.description}`
            : "Working on this now"}
      </button>
      {unfinished.dialog}
      {compact ? null : (
      <span
        className="ops-now-meta"
        title={
          opTags.length > 0
            ? `Tags: ${opTags.map((t) => t.name).join(", ")}${fedHabits.length > 0 ? ` · feeds ${fedHabits.map((h) => h.name).join(", ")}` : ""}`
            : "No tracking tags — set them on the operation in Settings."
        }
      >
        {opTags.length > 0 ? (
          <span className="ops-now-tags">
            Tags:{" "}
            {opTags.map((tag) => (
              <CatalogTagLabel key={tag.id} tag={tag} />
            ))}
          </span>
        ) : (
          "No tracking tags — set them on the operation in Settings."
        )}
        {fedHabits.length > 0 && ` · feeds ${fedHabits.map((h) => h.name).join(", ")}`}
      </span>
      )}
    </div>
  )
}

export default WorkingNowStrip
