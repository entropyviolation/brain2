/**
 * components/ItemDetail/ItemNotesLog.tsx — Dated notes on any item
 *
 * Notes are a log by default: each entry is stamped with the day (and clock)
 * it is about, newest first, grouped under day plates. The composer sits on
 * top: type, pick the day if it is not today, Add entry (or Cmd/Ctrl+Enter).
 * Entries edit in place and can be removed. The item's older single `notes`
 * string stays as the pinned **Standing note** above the log, since ingest and
 * other screens still append there.
 *
 * `NotesPeek` is the compact face for the Details rail: a one-line add and the
 * latest entries, with a key that opens the Notes tab.
 *
 * Both write through the host's draft (`onChangeEntries` / `onChangeStanding`),
 * so Save and the save lamp treat notes like any other field.
 */
"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { IsolatedTextarea } from "@/components/ui/isolated-text-field"
import { Pencil, Pin, Plus, Trash2 } from "lucide-react"
import type { ItemNoteEntry } from "@/lib/types"
import {
  groupNotesByDay,
  localDayIso,
  makeNoteEntry,
  noteClockLabel,
  noteDayLabel,
  notesNewestFirst,
} from "@/lib/item-notes"

export interface ItemNotesLogProps {
  entries: ItemNoteEntry[] | undefined
  standing: string | undefined
  onChangeEntries: (entries: ItemNoteEntry[] | undefined) => void
  onChangeStanding: (text: string) => void
  /** Live keystrokes in the standing note (save lamp). */
  onLiveStanding?: (text: string) => void
}

function NoteComposer({
  onAdd,
  compact = false,
}: {
  onAdd: (text: string, date: string, withTime: boolean) => void
  compact?: boolean
}) {
  const [text, setText] = useState("")
  const [date, setDate] = useState(() => localDayIso())
  const [withTime, setWithTime] = useState(true)
  const today = localDayIso()

  const add = () => {
    if (!text.trim()) return
    onAdd(text, date, withTime)
    setText("")
    setDate(localDayIso())
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey || compact) && !e.shiftKey) {
      e.preventDefault()
      add()
    }
  }

  if (compact) {
    return (
      <div className="id-note-quick">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a note for today…"
          aria-label="Quick note"
          className="id-note-quick-input"
        />
        <button type="button" className="id-attr-icon-key" onClick={add} disabled={!text.trim()} aria-label="Add note">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="id-note-composer">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="What happened, what you noticed, what to remember…"
        aria-label="New note"
        rows={3}
        className="id-note-composer-field"
      />
      <div className="id-note-composer-row">
        <label className="id-note-date">
          Day
          <input
            type="date"
            value={date}
            max="9999-12-31"
            onChange={(e) => setDate(e.target.value || today)}
            aria-label="Note day"
          />
        </label>
        {date !== today && (
          <button type="button" className="attr-mini-key" onClick={() => setDate(today)}>
            Today
          </button>
        )}
        <label className="id-note-time-toggle">
          <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} />
          Stamp the time
        </label>
        <span className="id-note-hint">⌘/Ctrl + Enter</span>
        <Button type="button" className="id-btn id-btn-primary" onClick={add} disabled={!text.trim()}>
          <Plus className="h-4 w-4" />
          Add entry
        </Button>
      </div>
    </div>
  )
}

function NoteRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: ItemNoteEntry
  onChange: (next: ItemNoteEntry) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.text)

  const save = () => {
    const text = draft.trim()
    if (text && text !== entry.text) onChange({ ...entry, text, editedAt: new Date().toISOString() })
    setEditing(false)
  }

  return (
    <li className="id-note-row" data-testid="note-entry">
      <span className="id-note-clock">{noteClockLabel(entry.time) || "—"}</span>
      {editing ? (
        <div className="id-note-edit">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              } else if (e.key === "Escape") {
                e.stopPropagation()
                setDraft(entry.text)
                setEditing(false)
              }
            }}
            aria-label="Edit note"
            rows={3}
            autoFocus
          />
          <div className="id-note-edit-keys">
            <button type="button" className="attr-mini-key" onClick={save}>
              Done
            </button>
            <button
              type="button"
              className="attr-mini-key"
              onClick={() => {
                setDraft(entry.text)
                setEditing(false)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="id-note-text" onDoubleClick={() => setEditing(true)} title="Double-click to edit">
          {entry.text}
          {entry.editedAt && <span className="id-note-edited"> (edited)</span>}
        </p>
      )}
      {!editing && (
        <span className="id-note-keys">
          <button type="button" className="id-attr-icon-key" onClick={() => setEditing(true)} aria-label="Edit note">
            <Pencil className="h-3 w-3" />
          </button>
          <button type="button" className="id-attr-icon-key" onClick={onRemove} aria-label="Delete note">
            <Trash2 className="h-3 w-3" />
          </button>
        </span>
      )}
    </li>
  )
}

export function ItemNotesLog({ entries, standing, onChangeEntries, onChangeStanding, onLiveStanding }: ItemNotesLogProps) {
  const sorted = useMemo(() => notesNewestFirst(entries), [entries])
  const groups = useMemo(() => groupNotesByDay(sorted), [sorted])
  const [standingOpen, setStandingOpen] = useState(Boolean(standing?.trim()))

  const all = entries ?? []
  const write = (next: ItemNoteEntry[]) => onChangeEntries(next.length ? next : undefined)
  const add = (text: string, date: string, withTime: boolean) => {
    const entry = makeNoteEntry(text, { date, time: withTime ? undefined : null })
    if (entry) write([...all, entry])
  }

  return (
    <section className="id-notes" aria-label="Notes">
      <NoteComposer onAdd={add} />

      {standingOpen || standing?.trim() ? (
        <div className="id-note-standing">
          <span className="id-attrs-subplate">
            <Pin className="h-3 w-3" /> Standing note
          </span>
          <IsolatedTextarea
            value={standing ?? ""}
            onLiveChange={onLiveStanding}
            onCommit={onChangeStanding}
            aria-label="Standing note"
            placeholder="Something that stays true about this item, not tied to a day."
            rows={2}
            className="attr-text"
          />
        </div>
      ) : (
        <button type="button" className="id-note-pin-key" onClick={() => setStandingOpen(true)}>
          <Pin className="h-3 w-3" /> Pin a standing note
        </button>
      )}

      {groups.length === 0 ? (
        <p className="id-attrs-empty">No entries yet. Each note you add is dated, so this becomes a log over time.</p>
      ) : (
        <div className="id-note-log">
          {groups.map((group) => (
            <div key={group.date} className="id-note-day">
              <div className="id-note-day-plate">
                <span>{noteDayLabel(group.date)}</span>
                <span className="id-note-day-iso">{group.date}</span>
                <span className="id-note-day-count">{group.entries.length}</span>
              </div>
              <ul className="id-note-rows">
                {group.entries.map((entry) => (
                  <NoteRow
                    key={entry.id}
                    entry={entry}
                    onChange={(next) => write(all.map((e) => (e.id === next.id ? next : e)))}
                    onRemove={() => write(all.filter((e) => e.id !== entry.id))}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Compact notes face for the Details rail. */
export function NotesPeek({
  entries,
  onChangeEntries,
  onOpenAll,
}: {
  entries: ItemNoteEntry[] | undefined
  onChangeEntries: (entries: ItemNoteEntry[] | undefined) => void
  onOpenAll?: () => void
}) {
  const sorted = useMemo(() => notesNewestFirst(entries), [entries])
  const latest = sorted.slice(0, 2)
  return (
    <div className="id-notes-peek">
      <NoteComposer
        compact
        onAdd={(text) => {
          const entry = makeNoteEntry(text)
          if (entry) onChangeEntries([...(entries ?? []), entry])
        }}
      />
      {latest.length > 0 && (
        <ul className="id-note-rows">
          {latest.map((entry) => (
            <li key={entry.id} className="id-note-peek-row">
              <span className="id-note-clock">{noteDayLabel(entry.date)}</span>
              <p className="id-note-text">{entry.text}</p>
            </li>
          ))}
        </ul>
      )}
      {onOpenAll && (
        <button type="button" className="id-note-pin-key" onClick={onOpenAll}>
          {sorted.length > 2 ? `All ${sorted.length} notes →` : "Open notes →"}
        </button>
      )}
    </div>
  )
}
