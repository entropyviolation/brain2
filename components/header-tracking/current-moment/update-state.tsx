/**
 * Update state — the panel a Current moment lane opens.
 * Now stamps through `applyScopeNowUpdate`. Recent sequence reads the view's
 * blocks and can still paint an exact or estimated sequence.
 * A pen's detail splits (`variants`) are optional push keys. Update keeps the
 * pen across the open stretch and switches the stored detail at this minute.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { formatLoggedMoment, recentScopeSequence, applyScopeNowUpdate, paintScopeSequence, type ScopeSequenceStep, type ScopeStatusLane } from "@/lib/tracking-presence"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ExactClock, EstMark } from "@/components/header-tracking/est-mark"
import { PenSearchSelect } from "@/components/header-tracking/current-moment/pen-search-select"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { PEN_COLOR_OPEN_TITLE, openPenSettings } from "@/components/Home/Tracking/open-pen-settings"

function clockValue(total: number): string {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function parseClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

type SequenceRow = {
  key: string
  name: string
  start: string
  end: string
  estimated: boolean
}

function freshRow(startMin: number): SequenceRow {
  return {
    key: `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    start: clockValue(startMin),
    end: clockValue(Math.min(startMin + 30, 24 * 60 - 1)),
    estimated: false,
  }
}

function sameValue(chosen: string, lane: ScopeStatusLane): boolean {
  if (lane.kind === "empty") return false
  const next = chosen.trim().toLowerCase()
  return next.length > 0 && next === lane.name.trim().toLowerCase()
}

function stepClock(date: string, startMin: number, endMin: number, today: string): string {
  const start = formatLoggedMoment({ date, minute: startMin }, today)
  if (endMin <= startMin) return start
  const end = formatLoggedMoment({ date, minute: endMin }, today)
  return `${start}–${end}`
}

export function UpdateState({
  lane,
  today,
  nowName,
  onName,
}: {
  lane: ScopeStatusLane
  today: string
  nowName: string
  onName: (name: string) => void
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [mode, setMode] = useState<"now" | "sequence">("now")
  const [recentOpen, setRecentOpen] = useState(true)
  const [rows, setRows] = useState<SequenceRow[]>(() => [freshRow(Math.max(0, new Date().getHours() * 60 + new Date().getMinutes() - 30))])
  const [sequenceNote, setSequenceNote] = useState("")
  const [blockNote, setBlockNote] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const pen = useMemo(() => {
    const needle = nowName.trim().toLowerCase()
    if (!needle) return undefined
    return scopes
      .find((scope) => scope.id === lane.scopeId)
      ?.pens.find((item) => item.name.trim().toLowerCase() === needle)
  }, [scopes, lane.scopeId, nowName])
  const details = pen?.variants ?? []
  const recent = useMemo(
    () => recentScopeSequence(lane.scopeId, entries, scopes),
    [lane.scopeId, entries, scopes],
  )
  const matches = sameValue(nowName, lane)
  const openEntry = openEntryId ? entries.find((entry) => entry.id === openEntryId) ?? null : null

  useEffect(() => {
    setSequenceNote("")
    setBlockNote("")
    setDetailId(null)
    setRecentOpen(true)
  }, [lane.scopeId])

  useEffect(() => {
    setDetailId(null)
  }, [pen?.id])

  function stamp(span: "open" | "minute") {
    if (!nowName.trim()) return
    const wrote = applyScopeNowUpdate(lane.scopeId, nowName, new Date(), span, {
      variantIds: detailId ? [detailId] : undefined,
      notes: blockNote,
    })
    if (wrote) setBlockNote("")
    setSequenceNote(wrote ? (span === "minute" ? "Saved a separate block at this minute." : "Saved through this minute.") : "Could not save that value.")
  }

  function saveSequence() {
    const steps: ScopeSequenceStep[] = []
    for (const row of rows) {
      const startMin = parseClock(row.start)
      const endMin = parseClock(row.end)
      if (!row.name.trim() || startMin === null || endMin === null) continue
      steps.push({ name: row.name, startMin, endMin, estimated: row.estimated })
    }
    const painted = paintScopeSequence(lane.scopeId, today, steps, blockNote)
    if (painted > 0) setBlockNote("")
    setSequenceNote(painted > 0 ? `Saved ${painted} on ${lane.scopeName}.` : "Add a name and a range that moves forward.")
  }

  return (
    <section className="hpp-body htk-tools htk-update b2-now" aria-labelledby="htk-update-title" data-testid="htk-update-state">
      <div className="htk-update-head">
      <p id="htk-update-title" className="htk-moment-title">
        Update state
      </p>
      <div className="htk-keys" role="group" aria-label="How to log this view">
        <button type="button" className={`todo-cap${mode === "now" ? " is-primary" : ""}`} aria-pressed={mode === "now"} onClick={() => setMode("now")}>
          Now
        </button>
        <button
          type="button"
          className={`todo-cap${mode === "sequence" ? " is-primary" : ""}`}
          aria-pressed={mode === "sequence"}
          aria-expanded={mode === "sequence"}
          onClick={() => {
            setMode((current) => {
              if (current === "sequence") return "now"
              setRecentOpen(true)
              return "sequence"
            })
          }}
        >
          Recent sequence
        </button>
      </div>
      </div>
      {mode === "now" ? (
        <div className="htk-update-now htk-update-card">
          <div className="htk-update-pick">
            <span className="htk-kicker">{lane.scopeName}</span>
            <div className="htk-update-value">
              {pen ? (
                <span
                  className="htk-pen-dot"
                  style={{ background: pen.color }}
                  title={PEN_COLOR_OPEN_TITLE}
                  aria-label={`Pen color for ${pen.name}`}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    openPenSettings(lane.scopeId, pen.id)
                  }}
                />
              ) : (
                <span className="htk-pen-dot is-empty" aria-hidden />
              )}
              <PenSearchSelect scopeId={lane.scopeId} label={lane.scopeName} value={nowName} onValue={onName} />
            </div>
          </div>
          {details.length > 0 ? (
            <div className="htk-details" role="group" aria-label={pen?.variantLabel?.trim() || "Detail"}>
              {details.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className="todo-cap"
                  aria-pressed={detailId === variant.id}
                  onClick={() => setDetailId((current) => (current === variant.id ? null : variant.id))}
                >
                  {variant.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="htk-row htk-update-actions">
            {matches ? (
              <>
                <button type="button" className="todo-cap is-primary" onClick={() => stamp("minute")}>
                  Add for now
                </button>
                <button type="button" className="todo-cap" onClick={() => stamp("open")}>
                  Update
                </button>
              </>
            ) : (
              <button type="button" className="todo-cap is-primary" onClick={() => stamp("open")} disabled={!nowName.trim()}>
                Add for now
              </button>
            )}
          </div>
          {matches ? (
            <p className="htk-hint">Add for now starts another block at this minute. Update continues the last one through now. A detail is optional.</p>
          ) : null}
        </div>
      ) : (
        <div className="htk-tools htk-sequence-pane htk-update-card">
          <div className="htk-row">
            <button
              type="button"
              className="todo-cap is-mod"
              aria-expanded={recentOpen}
              onClick={() => setRecentOpen((current) => !current)}
            >
              {recentOpen ? "Hide recent" : "Show recent"}
            </button>
          </div>
          {recentOpen ? (
            <div className="trk95 trk-logbook htk-sequence" aria-label="Recent sequence">
              {recent.length === 0 ? (
                <p className="trk-logbook-note">None yet</p>
              ) : (
                <div className="trk-log" role="list" aria-label="Recent values">
                  {recent.map((step) => {
                    const clock = stepClock(step.date, step.startMin, step.endMin, today)
                    return (
                      <div
                        key={step.id}
                        className="trk-log-row"
                        role="listitem"
                        title="Double-click to open this block"
                        onDoubleClick={() => setOpenEntryId(step.id)}
                      >
                        <span className="trk-log-when">
                          <EstMark estimated={step.estimated}>{clock}</EstMark>
                        </span>
                        <span className="trk-log-copy">
                          <EstMark estimated={step.estimated}>{step.name}</EstMark>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
          <p className="htk-hint">Times on today. Check est. when the clock is approximate. Double-click a row to open that block.</p>
          {rows.map((row) => (
            <div key={row.key} className="htk-row">
              <PenSearchSelect
                scopeId={lane.scopeId}
                label="Value"
                value={row.name}
                onValue={(name) => setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, name } : item)))}
              />
              <label className="htk-kicker">
                From
                <input
                  aria-label="From"
                  type="time"
                  className={row.estimated ? "trk-est htk-est" : undefined}
                  value={row.start}
                  onChange={(event) =>
                    setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, start: event.target.value } : item)))
                  }
                />
              </label>
              <label className="htk-kicker">
                To
                <input
                  aria-label="To"
                  type="time"
                  className={row.estimated ? "trk-est htk-est" : undefined}
                  value={row.end}
                  onChange={(event) =>
                    setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, end: event.target.value } : item)))
                  }
                />
              </label>
              <ExactClock
                estimated={row.estimated}
                label="Clock is estimated"
                onEstimated={(estimated) =>
                  setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, estimated } : item)))
                }
              />
            </div>
          ))}
          <div className="htk-row">
            <button
              type="button"
              className="todo-cap"
              onClick={() => {
                const last = rows[rows.length - 1]
                const from = last ? parseClock(last.end) ?? new Date().getHours() * 60 + new Date().getMinutes() : 0
                setRows((prev) => [...prev, freshRow(from)])
              }}
            >
              Add step
            </button>
            <button type="button" className="todo-cap is-primary" onClick={saveSequence}>
              Save sequence
            </button>
          </div>
        </div>
      )}
      <label className="htk-note">
        <span className="htk-kicker">Notes</span>
        <input
          aria-label="Notes for this block"
          value={blockNote}
          placeholder="Optional note on the blocks this saves"
          onChange={(event) => setBlockNote(event.target.value)}
        />
      </label>
      {sequenceNote ? <p className="htk-hint">{sequenceNote}</p> : null}
      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </section>
  )
}
