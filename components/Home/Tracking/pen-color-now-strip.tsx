/**
 * components/Home/Tracking/pen-color-now-strip.tsx — Pen-color clock
 *
 * Sits under the Operations "Working on this now" bar, in the shared module
 * just below the Tracking view switcher (Time Grid, Activity Log, Day Log).
 * Search a pen color, or type a new name and **Create** it in a view, then
 * press **Working on right now**. A timer starts at this second. The pen's
 * view gains a block from the minute that contains that second until you stop.
 * While live, **Objectives for right now** opens as a popup checklist on the
 * row (add an objective, log one already completed, hide completed rows)
 * without growing the strip. Stop with any still open asks whether to save
 * them for the next time this pen, task, or subtask is tracked. The Operations clock is
 * a separate session. `compact` is the desk's one NOW row: no own lamp, and
 * the view / since caption stays short. `scopeId` limits search and create
 * to one view (the Now popup uses Activity). The live clock is still the
 * shared pen session, including a pen started on another view.
 */
"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { PEN_PALETTE, useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { ancestorChain } from "@/lib/pen-tree"
import { formatElapsedClock, isSessionPaused, sessionElapsedMs } from "@/lib/operation-work-session"
import {
  addPenColorCompletedObjective,
  addPenColorNowObjective,
  attachPenNowObjective,
  editPenColorNowObjectiveText,
  pausePenColorSession,
  PEN_COLOR_SESSION_TICK_MS,
  removePenColorNowObjective,
  resumePenColorSession,
  savePenObjectiveForLater,
  stopPenColorSession,
  tickPenColorSession,
  togglePenColorNowObjectiveComplete,
  togglePenColorSession,
} from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { activeNowObjectives } from "@/lib/now-objective"
import { attachChoicesForPen } from "@/lib/unfinished-objectives"
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { useTaskStore } from "@/lib/task-store"
import { NowObjectivesList } from "@/components/Home/Tracking/now-objectives-list"
import { ClockTaskButton } from "@/components/Home/Tracking/clock-task-panel"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { useClockTask } from "@/components/Focus/use-clock-task"
import "@/components/Operations/operations-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"
import { NativeSelect } from "@/components/ui/native-select"

interface PenChoice {
  penId: string
  name: string
  color: string
  scopeId: string
  scopeName: string
  /** Ancestors, not including the pen itself. */
  path: string
}

function choicesFrom(scopes: TrackScope[]): PenChoice[] {
  const out: PenChoice[] = []
  for (const scope of scopes) {
    for (const pen of scope.pens) {
      const chain = ancestorChain(scope.pens, pen.id)
      const path = chain
        .slice(0, -1)
        .map((p) => p.name)
        .join(" › ")
      out.push({
        penId: pen.id,
        name: pen.name,
        color: pen.color,
        scopeId: scope.id,
        scopeName: scope.name,
        path,
      })
    }
  }
  return out
}

function choiceLabel(choice: PenChoice): string {
  return choice.path ? `${choice.name} · ${choice.scopeName} · ${choice.path}` : `${choice.name} · ${choice.scopeName}`
}

function matchesQuery(choice: PenChoice, needle: string): boolean {
  if (!needle) return true
  const hay = `${choice.name} ${choice.scopeName} ${choice.path}`.toLowerCase()
  return hay.includes(needle)
}

function formatStartSecond(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
}

export function usePenColorSessionClock() {
  const session = usePenColorSessionStore((s) => s.session)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session) return
    tickPenColorSession()
    const ui = window.setInterval(() => {
      if (document.hidden) return
      setNow(Date.now())
    }, 1000)
    const grid = window.setInterval(() => {
      if (document.hidden) return
      tickPenColorSession()
    }, PEN_COLOR_SESSION_TICK_MS)
    const onVis = () => {
      if (!document.hidden) setNow(Date.now())
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.clearInterval(ui)
      window.clearInterval(grid)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [session?.penId, session?.startedAt, session?.pausedAt, session?.pausedAccumMs])

  return { session, now }
}

export function PenColorNowStrip({
  compact = false,
  scopeId,
}: {
  compact?: boolean
  /** Search and create stay on this view. Omit to search every view. */
  scopeId?: string
} = {}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const { session, now } = usePenColorSessionClock()
  const clock = useClockTask(session)
  const tasks = useTaskStore((s) => s.tasks)
  const attachChoices = useMemo(
    () => attachChoicesForPen(tasks, session?.penId, session?.taskId),
    [tasks, session?.penId, session?.taskId],
  )
  const unfinished = useUnfinishedStop(activeNowObjectives(session?.nowObjectives).length, (park) =>
    stopPenColorSession(new Date(), park ? { parkUnfinished: true } : undefined),
  )
  const listId = useId()
  const allChoices = useMemo(() => choicesFrom(scopes), [scopes])
  const choices = useMemo(
    () => (scopeId ? allChoices.filter((choice) => choice.scopeId === scopeId) : allChoices),
    [allChoices, scopeId],
  )
  const [pickedId, setPickedId] = useState(session?.penId ?? "")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [newColor, setNewColor] = useState(PEN_PALETTE[0])
  const [createScopeId, setCreateScopeId] = useState(scopeId || activeScopeId || scopes[0]?.id || "")
  const activityOnly = scopeId === "activity"
  const searchLabel = activityOnly ? "Search activity pens" : "Search pen colors"
  const faceLabel = activityOnly ? "Activity" : "Pen color"

  const live = Boolean(session)
  const selectedId = session?.penId || pickedId
  const selected = allChoices.find((choice) => choice.penId === selectedId) ?? null
  const needle = query.trim().toLowerCase()
  const matches = useMemo(
    () => (open ? choices.filter((choice) => matchesQuery(choice, needle)).slice(0, 12) : []),
    [choices, needle, open],
  )
  const elapsed = session ? formatElapsedClock(sessionElapsedMs(session, now)) : null
  const fieldValue = open ? query : selected ? choiceLabel(selected) : ""

  const pick = (penId: string) => {
    setPickedId(penId)
    setQuery("")
    setOpen(false)
  }

  const draftName = query.trim()
  const nameTaken = Boolean(
    draftName &&
      choices.some(
        (choice) => choice.scopeId === createScopeId && choice.name.toLowerCase() === draftName.toLowerCase(),
      ),
  )
  const canCreate = Boolean(draftName && createScopeId && !nameTaken && !live)

  const createPen = () => {
    if (!canCreate) return
    const id = addPen(createScopeId, { name: draftName, color: newColor })
    if (!id) return
    setNewColor(PEN_PALETTE[(PEN_PALETTE.indexOf(newColor) + 1) % PEN_PALETTE.length] ?? PEN_PALETTE[0])
    pick(id)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      event.stopPropagation()
      setQuery("")
      setOpen(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open])

  const keepOpen = (event: { currentTarget: HTMLElement }) => {
    const root = event.currentTarget.closest(".trk-pen-now")
    window.setTimeout(() => {
      if (root?.contains(document.activeElement)) return
      setOpen(false)
    }, 150)
  }

  return (
    <div
      className={`ops-now-bar trk-pen-now${live ? " live" : ""}${compact ? " is-compact" : ""}`}
      data-ui-name="Working on right now"
    >
      {compact ? null : <span className={`ops-now-led${live ? " live" : ""}`} aria-hidden />}
      <label>
        {compact ? <span className="sr-only">{faceLabel}</span> : <span className="ops-now-kicker">{faceLabel}</span>}
        {!live && selected ? (
          <span className="trk-pen-now-bead" style={{ background: selected.color }} aria-hidden />
        ) : null}
        {live ? null : (
        <input
          className="trk-pen-now-field"
          role="combobox"
          aria-label={searchLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={fieldValue}
          placeholder={activityOnly ? "Search or create an activity pen" : "Starts this pen's clock"}
          onFocus={() => {
            if (!scopeId) setCreateScopeId(activeScopeId || scopes[0]?.id || "")
            setQuery("")
            setOpen(true)
            setHighlight(0)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onBlur={keepOpen}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
              setOpen(true)
              return
            }
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setHighlight((i) => Math.min(i + 1, Math.max(0, matches.length - 1)))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setHighlight((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter" && matches[highlight]) {
              e.preventDefault()
              pick(matches[highlight].penId)
            } else if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              setQuery("")
              setOpen(false)
            }
          }}
        />
        )}
      </label>
      {open && (
        <div className="trk-pen-now-pop">
          <ul id={listId} className="trk-pen-now-list" role="listbox" aria-label={activityOnly ? "Activity pens" : "Pen colors"}>
            {matches.length === 0 ? (
              <li className="trk-pen-now-empty">
                {needle
                  ? activityOnly
                    ? "No activity pens match. Create one below."
                    : "No pen colors match. Create one below."
                  : activityOnly
                    ? "Type a name to find an activity pen, or to create one."
                    : "Type a name to find a pen, or to create one."}
              </li>
            ) : (
              matches.map((choice, index) => (
                <li key={choice.penId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={choice.penId === selectedId}
                    data-active={index === highlight ? "true" : "false"}
                    className="trk-pen-now-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => pick(choice.penId)}
                  >
                    <span className="trk-pen-now-bead" style={{ background: choice.color }} aria-hidden />
                    <span>{choiceLabel(choice)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {draftName && !live && (
            <div className="trk-pen-now-create">
              <ColorSwatch value={newColor} onChange={setNewColor} size="sm" aria-label="New pen color" />
              {scopeId ? null : (
              <NativeSelect
                aria-label="View for the new pen"
                value={createScopeId}
                onChange={(e) => setCreateScopeId(e.target.value)}
              >
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name}
                  </option>
                ))}
              </NativeSelect>
              )}
              <button type="button" className="ops-btn" disabled={!canCreate} onMouseDown={(e) => e.preventDefault()} onClick={createPen}>
                {nameTaken ? "Already in this view" : `Create “${draftName}”`}
              </button>
            </div>
          )}
        </div>
      )}
      {live && selected && session && elapsed ? (
        <div className="trk-pen-now-live">
          <span className="trk-pen-now-bead" style={{ background: selected.color }} aria-hidden />
          <span className="trk-pen-now-live-name" title={clock.path ? `${clock.path} · ${choiceLabel(selected)}` : choiceLabel(selected)}>
            {clock.task ? (
              <button
                type="button"
                className="trk-pen-now-live-task"
                data-no95
                onClick={() => openItemDetailPopup(clock.task!.id)}
              >
                {clock.path} ·{" "}
              </button>
            ) : null}
            {choiceLabel(selected)}
          </span>
          <span className="ops-now-elapsed" aria-live="polite">
            {elapsed}
          </span>
          <DvdTransportKey
            className="trk-pen-now-icon"
            mark={isSessionPaused(session) ? "play" : "pause"}
            label={isSessionPaused(session) ? `Resume ${selected.name}` : `Pause ${selected.name}`}
            onClick={() => (isSessionPaused(session) ? resumePenColorSession() : pausePenColorSession())}
          />
          <NowObjectivesList
            objectives={session.nowObjectives}
            contextName={selected.name}
            onAdd={(text) => addPenColorNowObjective(text)}
            onAddCompleted={(text) => addPenColorCompletedObjective(text)}
            onEditText={(id, text) => editPenColorNowObjectiveText(id, text)}
            onToggleComplete={(id) => togglePenColorNowObjectiveComplete(id)}
            onRemove={(id) => removePenColorNowObjective(id)}
            onSaveForLater={(id) => savePenObjectiveForLater(id)}
            onAttach={(id, target) => attachPenNowObjective(id, target)}
            attachChoices={attachChoices}
            stepChoices={clock.stepChoices}
            onTieStep={clock.onTieStep}
            onSetCompletes={clock.onSetCompletes}
          />
          <ClockTaskButton />
          <DvdTransportKey
            className="trk-pen-now-icon"
            mark="stop"
            label={`Stop working on ${selected.name}`}
            onClick={() => unfinished.request()}
          />
        </div>
      ) : (
        <button
          type="button"
          className="ops-btn ops-btn-now"
          disabled={!selected}
          aria-label={selected ? "Start this pen's clock" : "Choose a pen to start its clock"}
          onClick={() => selected && togglePenColorSession(selected.penId)}
        >
          {compact ? "▶ Start" : selected ? "Start this pen's clock" : "Choose a pen to start its clock"}
        </button>
      )}
      {unfinished.dialog}
      {compact && !live ? null : (
      <span
        className="ops-now-meta"
        title={
          live && session
            ? `${selected?.scopeName ?? "Tracking"} · since ${formatStartSecond(session.startedAt)}`
            : selected
              ? `${selected.scopeName} · starts this second`
              : "Search a pen, or type a new name and create it. The timer starts this second."
        }
      >
        {live && session
          ? `${selected?.scopeName ?? "Tracking"} · since ${formatStartSecond(session.startedAt)}`
          : selected
            ? `${selected.scopeName} · starts this second`
            : "Search a pen, or type a new name and create it. The timer starts this second."}
      </span>
      )}
    </div>
  )
}

export default PenColorNowStrip
