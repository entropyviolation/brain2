/**
 * components/Home/ToDo/SpentBlocks.tsx — The blocks of time counted as spent on a task
 *
 * Lives in the Spent stat popover. Each row is one tracking block tagged with
 * this task (or, in a sub-card, with the root step or a step inside it): date,
 * clock span, minutes, and which step it was on. Start and end are editable
 * (`H:MM`, Enter or blur saves, Esc backs out) and a block can be deleted after
 * a second click. Edits go through `updateEntry` / `removeEntry`, the same
 * calls the time grid uses. Typed time logs (no block behind them) are listed
 * under the blocks, read-only.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import type { TimeLogEntry } from "@/lib/types"

export interface SpentBlocksScope {
  taskId: string
  /** Limit to these steps (a sub-card's root and what is inside it). Omitted = the whole task. */
  stepIds?: ReadonlySet<string>
  /** Step id to name, for the "on" column. */
  names: ReadonlyMap<string, string>
  logs?: readonly TimeLogEntry[]
}

const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`

/** "9:30", "930", "9.5" is not supported; returns minutes since midnight or null. */
function parseClock(v: string): number | null {
  const m = v.trim().match(/^(\d{1,2})(?::?(\d{2}))?$/)
  if (!m) return null
  const min = Number(m[1]) * 60 + Number(m[2] ?? 0)
  return min >= 0 && min <= 1440 && Number(m[2] ?? 0) < 60 ? min : null
}

const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })

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

export function SpentBlocks({ scope }: { scope: SpentBlocksScope }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const updateEntry = useTimeTrackingStore((s) => s.updateEntry)
  const removeEntry = useTimeTrackingStore((s) => s.removeEntry)
  const [sure, setSure] = useState<string | null>(null)
  const { taskId, stepIds, names, logs = [] } = scope

  const blocks = useMemo(
    () =>
      entries
        .filter((e) => e.taskId === taskId && e.kind !== "instant" && e.endMin > e.startMin && (!stepIds || (!!e.stepId && stepIds.has(e.stepId))))
        .sort((a, b) => (a.date === b.date ? b.startMin - a.startMin : a.date < b.date ? 1 : -1)),
    [entries, taskId, stepIds],
  )
  const blockIds = new Set(blocks.map((b) => b.id))
  const typed = logs.filter((l) => (!stepIds || (!!l.stepId && stepIds.has(l.stepId))) && !(l.entryIds ?? []).some((id) => blockIds.has(id)))

  const edit = (e: TimeEntry, startMin: number, endMin: number) => {
    if (endMin <= startMin) return
    updateEntry(e.id, { startMin, endMin })
  }
  if (!blocks.length && !typed.length) return <p className="is-quiet">No blocks tagged with this yet. Tag a block in the time grid, or run ▶ on a step.</p>
  return (
    <>
      {blocks.length ? (
        <ul className="tcs-spent" aria-label="Blocks of time spent">
          {blocks.map((e) => {
            const on = e.stepId ? names.get(e.stepId) : undefined
            return (
              <li key={e.id}>
                <time dateTime={e.date}>{dayLabel(e.date)}</time>
                <span className="tcs-spent-span">
                  <ClockField value={e.startMin} label={`Start of the block on ${e.date}`} onCommit={(m) => edit(e, m, e.endMin)} />
                  <i aria-hidden>–</i>
                  <ClockField value={e.endMin} label={`End of the block on ${e.date}`} onCommit={(m) => edit(e, e.startMin, m)} />
                </span>
                <b>{e.endMin - e.startMin}m</b>
                <em title={on ?? "Tagged to the task, not to a step"}>{on ?? "whole task"}</em>
                {sure === e.id ? (
                  <button type="button" className="tcs-spent-x is-sure" onClick={() => (removeEntry(e.id), setSure(null))} onBlur={() => setSure(null)} autoFocus>
                    delete?
                  </button>
                ) : (
                  <button type="button" className="tcs-spent-x" title="Delete this block from the time grid" aria-label="Delete this block" onClick={() => setSure(e.id)}>
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
      {typed.length ? (
        <>
          <h4>Typed in, no block</h4>
          <ul className="tcs-spent is-typed">
            {typed.map((l) => (
              <li key={l.id}>
                <time dateTime={l.date}>{dayLabel(l.date)}</time>
                <span className="tcs-spent-span">{l.startTime && l.endTime ? `${l.startTime}–${l.endTime}` : "—"}</span>
                <b>{l.durationMinutes}m</b>
                <em>{(l.stepId && names.get(l.stepId)) || l.notes || "whole task"}</em>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}
