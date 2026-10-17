/**
 * components/People/person-notes.tsx — The Notes tab for a person
 *
 * Dated notes are `task.noteLog`, like every item. Old person notes on
 * `personProfile.noteLog` are folded in for display (`foldPersonNoteLog`), and
 * the fold is written to the draft on the first edit, so opening the tab never
 * dirties the item by itself.
 *
 * The standing note is the `notes` attribute, not `task.notes`, because the
 * People list column reads it. Text an ingest left on `task.notes` shows as a
 * pinned "Captured" note with a key that moves it into the standing note.
 * Nothing is deleted. Plan: `docs/PERSON_DETAIL_REDESIGN.md` 3.3.
 */
"use client"

import { useMemo } from "react"
import { Inbox } from "lucide-react"
import { ItemNotesLog } from "@/components/ItemDetail/ItemNotesLog"
import { foldPersonNoteLog } from "@/lib/person-notes-fold"
import { PERSON_ATTR } from "@/lib/person-types"
import type { Task } from "@/lib/types"
import "./person-detail.css"

type Attributes = NonNullable<Task["attributes"]>

export function PersonNotes({
  person,
  onChange,
  onLive,
  readDraft,
}: {
  person: Task
  /** Draft write that re-renders (host `writeDraft`). */
  onChange: (patch: Partial<Task>) => void
  /** Draft write with no render (host `touchDraft`). */
  onLive?: (patch: Partial<Task>) => void
  readDraft?: () => Task | null
}) {
  const folded = useMemo(() => foldPersonNoteLog(person), [person])
  const latest = () => {
    const draft = readDraft?.()
    return draft && draft.id === person.id ? draft : person
  }
  const standing = person.attributes?.[PERSON_ATTR.notes]
  const standingText = typeof standing === "string" ? standing : ""
  const captured = person.notes?.trim() ? person.notes : ""

  const attributesWith = (notes: string): Attributes => ({ ...(latest().attributes ?? {}), [PERSON_ATTR.notes]: notes })

  const moveCaptured = () => {
    const current = latest().attributes?.[PERSON_ATTR.notes]
    const before = typeof current === "string" ? current.trim() : ""
    const notes = before ? `${before}\n\n${captured.trim()}` : captured.trim()
    onChange({ attributes: attributesWith(notes), notes: undefined })
  }

  return (
    <div className="person-notes">
      {captured ? (
        <div className="id-note-standing person-notes-captured">
          <span className="id-attrs-subplate">
            <Inbox className="h-3 w-3" /> Captured
          </span>
          <p className="person-notes-captured-text">{captured}</p>
          <button type="button" className="person-key" onClick={moveCaptured}>
            Move into standing note
          </button>
        </div>
      ) : null}
      <ItemNotesLog
        entries={folded.noteLog}
        standing={standingText}
        onChangeEntries={(noteLog) => {
          const now = latest()
          const fold = foldPersonNoteLog(now)
          onChange(fold === now ? { noteLog } : { noteLog, personProfile: fold.personProfile })
        }}
        onLiveStanding={(notes) => onLive?.({ attributes: attributesWith(notes) })}
        onChangeStanding={(notes) => onChange({ attributes: attributesWith(notes) })}
      />
    </div>
  )
}
