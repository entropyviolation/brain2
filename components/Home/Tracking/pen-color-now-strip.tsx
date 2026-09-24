/**
 * components/Home/Tracking/pen-color-now-strip.tsx — Pen-color clock
 *
 * Sits under the Operations "Working on this now" bar, in the shared module
 * just below the Tracking view switcher (Time Grid, Activity Log, Day Log).
 * Search a pen color, or type a new name and **Create** it in a view, then
 * press **Working on right now**. A timer starts at this second. The pen's
 * view gains a block from the minute that contains that second until you stop.
 * The Operations clock is a separate session.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { PEN_PALETTE, useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { ancestorChain } from "@/lib/pen-tree"
import { formatElapsedClock, sessionElapsedMs } from "@/lib/operation-work-session"
import {
  PEN_COLOR_SESSION_TICK_MS,
  tickPenColorSession,
  togglePenColorSession,
} from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import "@/components/Operations/operations-chrome.css"
import "@/components/Home/Tracking/tracking-chrome.css"

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
    const ui = window.setInterval(() => setNow(Date.now()), 1000)
    const grid = window.setInterval(() => tickPenColorSession(), PEN_COLOR_SESSION_TICK_MS)
    return () => {
      window.clearInterval(ui)
      window.clearInterval(grid)
    }
  }, [session?.penId, session?.startedAt, session?.pausedAt, session?.pausedAccumMs])

  return { session, now }
}

export function PenColorNowStrip() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const { session, now } = usePenColorSessionClock()
  const choices = useMemo(() => choicesFrom(scopes), [scopes])
  const [pickedId, setPickedId] = useState(session?.penId ?? "")
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [newColor, setNewColor] = useState(PEN_PALETTE[0])
  const [createScopeId, setCreateScopeId] = useState(activeScopeId || scopes[0]?.id || "")

  const live = Boolean(session)
  const selectedId = session?.penId || pickedId
  const selected = choices.find((choice) => choice.penId === selectedId) ?? null
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

  const keepOpen = (event: { currentTarget: HTMLElement }) => {
    const root = event.currentTarget.closest(".trk-pen-now")
    window.setTimeout(() => {
      if (root?.contains(document.activeElement)) return
      setOpen(false)
    }, 150)
  }

  return (
    <div className={`ops-now-bar trk-pen-now${live ? " live" : ""}`} data-ui-name="Working on right now">
      <span className={`ops-now-led${live ? " live" : ""}`} aria-hidden />
      <label>
        Pen color
        {selected && (
          <span className="trk-pen-now-bead" style={{ background: selected.color }} aria-hidden />
        )}
        <input
          className="trk-pen-now-field"
          role="combobox"
          aria-label="Search pen colors"
          aria-expanded={open}
          aria-controls="pen-color-now-list"
          aria-autocomplete="list"
          value={fieldValue}
          disabled={live}
          placeholder="Search pen colors"
          onFocus={() => {
            if (live) return
            setCreateScopeId(activeScopeId || scopes[0]?.id || "")
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
              setOpen(false)
            }
          }}
        />
      </label>
      {open && (
        <div className="trk-pen-now-pop">
          <ul id="pen-color-now-list" className="trk-pen-now-list" role="listbox" aria-label="Pen colors">
            {matches.length === 0 ? (
              <li className="trk-pen-now-empty">
                {needle ? "No pen colors match. Create one below." : "Type a name to find a pen, or to create one."}
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
              <select
                aria-label="View for the new pen"
                value={createScopeId}
                onChange={(e) => setCreateScopeId(e.target.value)}
              >
                {scopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name}
                  </option>
                ))}
              </select>
              <button type="button" className="ops-btn" disabled={!canCreate} onMouseDown={(e) => e.preventDefault()} onClick={createPen}>
                {nameTaken ? "Already in this view" : `Create “${draftName}”`}
              </button>
            </div>
          )}
        </div>
      )}
      {live && elapsed && (
        <span className="ops-now-elapsed" aria-live="polite">
          {elapsed}
        </span>
      )}
      <button
        type="button"
        className={`ops-btn ops-btn-now${live ? " live" : ""}`}
        disabled={!selected}
        onClick={() => selected && togglePenColorSession(selected.penId)}
      >
        {live && selected ? `Stop working on ${selected.name}` : "Working on right now"}
      </button>
      <span className="ops-now-meta">
        {live && session
          ? `${selected?.scopeName ?? "Tracking"} · since ${formatStartSecond(session.startedAt)}`
          : selected
            ? `${selected.scopeName} · starts this second`
            : "Search a pen, or type a new name and create it. The timer starts this second."}
      </span>
    </div>
  )
}

export default PenColorNowStrip
