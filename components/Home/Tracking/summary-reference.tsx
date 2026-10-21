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
import { feedOutcomeLabel, feedRowDayKey, feedRowMinute } from "@/lib/ingest/telegram-feed"
import { useTelegramFeedStore } from "@/lib/ingest/telegram-feed-store"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { asLogEntry, classifyLogBookRow, compareLogRows, logClockLabel, switchLogCopy } from "./tracking-log-model"

type Shelf = "plans" | "events" | "thoughts" | "log" | "telegram"
const SHELVES: { id: Shelf; label: string }[] = [
  { id: "plans", label: "Plans" },
  { id: "events", label: "Events" },
  { id: "thoughts", label: "Thoughts" },
  { id: "log", label: "Log" },
  { id: "telegram", label: "Telegram log" },
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
  const feed = useTelegramFeedStore((s) => s.rows)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const [notesOpen, setNotesOpen] = useState(false)

  const blockNotes = useMemo(() => {
    const penName = penNameById(scopes)
    const view = scopes.find((scope) => scope.id === activeScopeId)
    const blocks = entriesOnDate(entries, dateKey)
      .filter((entry) => entry.kind !== "instant" && entry.scopeId === activeScopeId)
      .sort((a, b) => a.startMin - b.startMin)
      .map((entry) => ({
        key: entry.id,
        when: `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin % 1440)}`,
        name: entryDisplayName(entry, penName(entry.penId)),
        length: formatDuration(entry.endMin - entry.startMin),
        notes: entry.notes?.trim() ?? "",
      }))
    return { viewName: view?.name ?? "this view", blocks }
  }, [entries, scopes, activeScopeId, dateKey])
  const notedCount = blockNotes.blocks.filter((b) => b.notes).length

  const shelves = useMemo(() => {
    const penName = penNameById(scopes)
    const out: Record<Shelf, Row[]> = { plans: [], events: [], thoughts: [], log: [], telegram: [] }
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
    out.telegram = feed
      .filter((row) => feedRowDayKey(row) === dateKey)
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((row) => ({
        key: row.id,
        when: minutesToLabel(feedRowMinute(row)),
        text: row.text,
        note: feedOutcomeLabel(row.outcome),
      }))
    return out
  }, [actions, entries, scopes, feed, dateKey])

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
        <button type="button" aria-haspopup="dialog" onClick={() => setNotesOpen(true)}>
          Timeblock notes · {notedCount}
        </button>
      </div>
      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="trk-dialog max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Timeblock notes · {blockNotes.viewName}</DialogTitle>
          </DialogHeader>
          {blockNotes.blocks.length === 0 ? (
            <p>No timeblocks tracked on this day in this view.</p>
          ) : (
            <ul className="space-y-3">
              {blockNotes.blocks.map((block) => (
                <li key={block.key}>
                  <div className="text-xs opacity-70">
                    {block.when} · {block.length}
                  </div>
                  <div className="font-medium">{block.name}</div>
                  {block.notes ? (
                    <p className="whitespace-pre-wrap text-sm">{block.notes}</p>
                  ) : (
                    <p className="text-sm opacity-50">No notes.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
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
