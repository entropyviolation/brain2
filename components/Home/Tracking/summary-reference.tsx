/**
 * components/Home/Tracking/summary-reference.tsx — Read-only day reference
 *
 * Sits above the Day summary field. Toggle Plans, Events, Thoughts, and Log to
 * read what the day held while writing what actually happened. Nothing here
 * edits data; it reads the planned-action store and the tracking entries.
 */
"use client"

import { useMemo, useState } from "react"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { entryDisplayName, entriesOnDate, formatDuration, minutesToLabel } from "@/lib/time-entries"
import { penNameById } from "./discrete-log-instants"
import { asLogEntry, classifyLogBookRow, compareLogRows, logClockLabel, switchLogCopy } from "./tracking-log-model"

type Shelf = "plans" | "events" | "thoughts" | "log"
const SHELVES: { id: Shelf; label: string }[] = [
  { id: "plans", label: "Plans" },
  { id: "events", label: "Events" },
  { id: "thoughts", label: "Thoughts" },
  { id: "log", label: "Log" },
]

interface Row {
  key: string
  when: string
  text: string
  note?: string
}

function clock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? minutesToLabel(h! * 60 + m!) : time
}

export function SummaryReference({ dateKey }: { dateKey: string }) {
  const [open, setOpen] = useState<Shelf[]>([])
  const actions = usePlannedActionStore((s) => s.actions)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)

  const shelves = useMemo(() => {
    const penName = penNameById(scopes)
    const out: Record<Shelf, Row[]> = { plans: [], events: [], thoughts: [], log: [] }
    out.plans = actions
      .filter((a) => a.date === dateKey)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((a) => ({ key: a.id, when: `${clock(a.startTime)}–${clock(a.endTime)}`, text: a.title || "Planned block", note: a.notes }))
    const day = entriesOnDate(entries, dateKey)
    const logged = day
      .map((entry) => {
        const row = classifyLogBookRow(asLogEntry(entry), penName(entry.penId))
        return row ? { entry, row } : null
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => compareLogRows(a.row, b.row))
    for (const { entry, row } of logged) {
      const face = logClockLabel(entry)
      const when = face.time ?? face.badge ?? ""
      const text =
        row.list === "switch"
          ? switchLogCopy(entry, penName(entry.penId))
          : entryDisplayName(entry, penName(entry.penId))
      const item = { key: entry.id, when, text }
      if (row.list === "thought") out.thoughts.push(item)
      else out.events.push(item)
    }
    out.log = day
      .filter((entry) => entry.kind !== "instant")
      .sort((a, b) => a.startMin - b.startMin)
      .map((entry) => ({
        key: entry.id,
        when: `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin % 1440)}`,
        text: entryDisplayName(entry, penName(entry.penId)),
        note: formatDuration(entry.endMin - entry.startMin),
      }))
    return out
  }, [actions, entries, scopes, dateKey])

  const toggle = (id: Shelf) => setOpen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  return (
    <div className="trk-sumref" data-testid="summary-reference">
      <div className="trk-span-switch trk-sumref-keys" role="toolbar" aria-label="Show for this day">
        <span className="trk-sumref-lead">Refer to</span>
        {SHELVES.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={open.includes(id)} onClick={() => toggle(id)}>
            {label} · {shelves[id].length}
          </button>
        ))}
      </div>
      {open.length > 0 ? (
        <div className="trk-sumref-shelves">
          {SHELVES.filter(({ id }) => open.includes(id)).map(({ id, label }) => (
            <section key={id} className="trk-sumref-shelf" aria-label={label}>
              <h4>{label}</h4>
              {shelves[id].length === 0 ? (
                <p className="trk-sumref-empty">Nothing saved for this day.</p>
              ) : (
                <ul>
                  {shelves[id].map((row) => (
                    <li key={row.key}>
                      <span className="trk-sumref-when">{row.when}</span>
                      <span className="trk-sumref-text">{row.text}</span>
                      {row.note ? <span className="trk-sumref-note">{row.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
